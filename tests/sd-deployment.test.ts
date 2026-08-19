import { describe, expect, it } from "vitest";
import { InMemoryDocumentStore } from "../src/Core/document-store";
import { CommandHistory } from "../src/Core/commands";
import { createEditorApplication } from "../src/Core/editor-application";
import { createDeploymentService } from "../src/Core/deployment-service";
import { PACKAGE_ROOT_DIRECTORY, binaryMediaCopiesFromPackage, contentByteLength, isAbsoluteFilesystemPath, preflightDeployment, unsafePackagePathReason } from "../src/Core/removable-storage";
import { InMemoryRemovableStorage, type InMemoryVolumeSeed } from "../src/Infrastructure/in-memory-removable-storage";
import { createEmptyProject, foundationDeviceProfile } from "../src/Domain/factories";
import type { DeploymentPackage, Project } from "../src/Domain/models";

/**
 * The SD-card pipeline, exercised against a filesystem abstraction so every
 * failure a real card can produce is covered without hardware: removal mid-write,
 * read-only media, permission denial, exhausted space, silent corruption, a
 * truncated file, an unreadable file and an unsupported eject.
 *
 * These tests assert BYTES ON THE TARGET, not booleans. A pipeline that reports
 * success without the content matching is the exact defect they exist to catch.
 */

const CARD: InMemoryVolumeSeed = {
  id: "E:\\",
  mountPath: "E:\\",
  volumeName: "ELEVATOR",
  fileSystem: "FAT32",
  totalBytes: 8_000_000_000,
  freeBytes: 4_000_000_000,
  removable: true,
};

const FIXED_DISK: InMemoryVolumeSeed = {
  id: "C:\\",
  mountPath: "C:\\",
  volumeName: "System",
  fileSystem: "NTFS",
  totalBytes: 500_000_000_000,
  freeBytes: 100_000_000_000,
  removable: false,
};

function sceneProject(): Project {
  const base = createEmptyProject("Deployable", foundationDeviceProfile);
  const theme = base.themeProjectGroups[0].themeProjects[0];
  const [first, ...rest] = theme.rotations;
  return {
    ...base,
    themeProjectGroups: [{
      ...base.themeProjectGroups[0],
      themeProjects: [{
        ...theme,
        rotations: [
          {
            ...first,
            scenes: [{
              id: "scene-1",
              name: "Lobby",
              widgets: [{
                id: "w1", name: "Floor", widgetType: "digit", enabled: true, visible: true, locked: false,
                geometry: { x: 10, y: 10, width: 100, height: 60 }, zIndex: 1, bindings: [], assetIds: [],
              }],
              priority: 0,
              activationConditions: [],
            }],
          },
          ...rest,
        ],
      }],
    }],
  };
}

async function builtPackage(storage?: InMemoryRemovableStorage): Promise<{ pkg: DeploymentPackage; service: ReturnType<typeof createDeploymentService> }> {
  const store = new InMemoryDocumentStore(new CommandHistory());
  store.open(sceneProject());
  createEditorApplication(store);
  const service = createDeploymentService(storage);
  const outcome = await service.buildVerified(store.getCurrent() as Project, foundationDeviceProfile);
  if (outcome.status !== "built") throw new Error(`expected a built package, got ${outcome.reason}`);
  return { pkg: outcome.package, service };
}

describe("SD deployment: pre-flight refuses before anything destructive happens", () => {
  it("refuses an unverified package, a fixed disk, a read-only card and a full card", async () => {
    const { pkg } = await builtPackage();
    const volume = { id: "E:\\", mountPath: "E:\\", volumeName: "ELEVATOR", removable: true, readOnly: false, freeBytes: 4_000_000_000 };

    const unverified = preflightDeployment({ ...pkg, verified: false }, volume, { present: true, writable: true });
    expect(unverified.ok).toBe(false);
    expect(unverified.findings.some((finding) => finding.code === "PACKAGE_NOT_VERIFIED")).toBe(true);

    // Writing a deployment package to a fixed disk is refused as a safety rule.
    const fixed = preflightDeployment(pkg, { ...volume, id: "C:\\", mountPath: "C:\\", removable: false }, { present: true, writable: true });
    expect(fixed.ok).toBe(false);
    expect(fixed.findings.some((finding) => finding.code === "TARGET_NOT_REMOVABLE")).toBe(true);

    const readOnly = preflightDeployment(pkg, { ...volume, readOnly: true }, { present: true, writable: false, reason: "read-only" });
    expect(readOnly.ok).toBe(false);
    expect(readOnly.findings.some((finding) => finding.code === "TARGET_READ_ONLY")).toBe(true);

    const full = preflightDeployment(pkg, { ...volume, freeBytes: 8 }, { present: true, writable: true, freeBytes: 8 });
    expect(full.ok).toBe(false);
    expect(full.findings.some((finding) => finding.code === "TARGET_INSUFFICIENT_SPACE")).toBe(true);

    const gone = preflightDeployment(pkg, volume, { present: false, writable: false });
    expect(gone.findings.some((finding) => finding.code === "TARGET_UNAVAILABLE")).toBe(true);

    // Every finding tells the user what to do.
    for (const report of [unverified, fixed, readOnly, full, gone]) {
      expect(report.findings.every((finding) => finding.remediation.length > 0)).toBe(true);
    }
  });

  it("refuses a package path that could escape the target directory", async () => {
    const { pkg } = await builtPackage();
    const volume = { id: "E:\\", mountPath: "E:\\", volumeName: "SD", removable: true, readOnly: false, freeBytes: 1_000_000 };
    for (const badPath of ["/absolute.json", "../escape.json", "a:b.json"]) {
      const tampered: DeploymentPackage = { ...pkg, files: [...pkg.files, { path: badPath, kind: "manifest", content: "{}" }] };
      const report = preflightDeployment(tampered, volume, { present: true, writable: true });
      expect(report.ok, badPath).toBe(false);
      expect(report.findings.some((finding) => finding.code === "PACKAGE_FILE_NAME_INVALID")).toBe(true);
    }
  });

  it("accepts a sound package on a writable removable card", async () => {
    const { pkg } = await builtPackage();
    const report = preflightDeployment(pkg, { id: "E:\\", mountPath: "E:\\", volumeName: "SD", removable: true, readOnly: false, freeBytes: 4_000_000_000 }, { present: true, writable: true, freeBytes: 4_000_000_000 });
    expect(report.ok).toBe(true);
    expect(report.fileCount).toBe(pkg.files.length);
    expect(report.totalBytes).toBe(pkg.files.reduce((total, file) => total + contentByteLength(file.content), 0));
  });
});

describe("SD deployment: the happy path writes, flushes and verifies real content", () => {
  it("writes every package file and reports only after reading them back", async () => {
    const storage = new InMemoryRemovableStorage([CARD, FIXED_DISK]);
    const { pkg, service } = await builtPackage(storage);

    const detected = await service.detectTargets();
    expect(detected.transport).toBe("in-memory");
    // The fixed disk is listed so the UI can explain the refusal, not hidden.
    expect(detected.volumes.map((volume) => volume.id).sort()).toEqual(["C:\\", "E:\\"]);

    const card = detected.volumes.find((volume) => volume.id === "E:\\");
    if (!card) throw new Error("card missing");
    const stages: string[] = [];
    const result = await service.deployToSdCard(pkg, card, { onStage: (stage) => stages.push(stage) });

    expect(result.status).toBe("verified");
    if (result.status !== "verified") return;
    expect(stages).toEqual(["preflight", "write", "verify", "complete"]);
    expect(result.writtenFiles).toBe(pkg.files.length);
    expect(result.verified.every((detail) => detail.ok)).toBe(true);

    // The bytes on the target are the package's bytes.
    const snapshot = storage.snapshot();
    for (const file of pkg.files) {
      expect(snapshot.get(`E:\\::${PACKAGE_ROOT_DIRECTORY}/${file.path}`)).toBe(file.content);
    }
    expect(result.copiedBinaries).toEqual([]);
    expect(snapshot.has(`E:\\::${PACKAGE_ROOT_DIRECTORY}/manifest.json`)).toBe(true);
  });

  it("reports progress across the whole file set", async () => {
    const storage = new InMemoryRemovableStorage([CARD]);
    const { pkg, service } = await builtPackage(storage);
    const card = (await service.detectTargets()).volumes[0];
    const progress: number[] = [];
    await service.deployToSdCard(pkg, card, { onProgress: (update) => progress.push(update.writtenFiles) });
    expect(progress[progress.length - 1]).toBe(pkg.files.length);
    expect(progress).toEqual([...progress].sort((left, right) => left - right));
  });
});

describe("SD deployment: every hardware failure is reported honestly", () => {
  it("does not claim success when the card is pulled mid-write", async () => {
    const storage = new InMemoryRemovableStorage([CARD], { removeAfterFiles: 2 });
    const { pkg, service } = await builtPackage(storage);
    const card = { id: "E:\\", mountPath: "E:\\", volumeName: "ELEVATOR", removable: true, readOnly: false, freeBytes: 4_000_000_000 };
    const result = await service.deployToSdCard(pkg, card);
    expect(result.status).toBe("failed");
    if (result.status !== "failed") return;
    expect(result.stage).toBe("write");
    expect(result.code).toBe("TARGET_REMOVED_DURING_WRITE");
    // A partial write must be declared, so the card is not trusted.
    expect(result.partial?.writtenFiles).toBe(2);
    expect(result.remediation).toMatch(/must not be used|should be trusted/i);
  });

  it("catches silent corruption only verification could find", async () => {
    const storage = new InMemoryRemovableStorage([CARD], { corruptPath: "manifest.json" });
    const { pkg, service } = await builtPackage(storage);
    const card = (await service.detectTargets()).volumes[0];
    const result = await service.deployToSdCard(pkg, card);
    // The write itself succeeded; only the read-back comparison reveals the fault.
    expect(result.status).toBe("failed");
    if (result.status !== "failed") return;
    expect(result.stage).toBe("verify");
    expect(result.code).toBe("VERIFICATION_MISMATCH");
    expect(result.verified?.find((detail) => detail.path === "manifest.json")?.ok).toBe(false);
    expect(result.remediation).toMatch(/Do not use this card/i);
    expect(pkg.files.length).toBeGreaterThan(0);
  });

  it("detects a truncated file by size", async () => {
    const storage = new InMemoryRemovableStorage([CARD], { truncatePath: "manifest.json" });
    const { pkg, service } = await builtPackage(storage);
    const card = (await service.detectTargets()).volumes[0];
    const result = await service.deployToSdCard(pkg, card);
    expect(result.status).toBe("failed");
    if (result.status !== "failed") return;
    expect(result.verified?.find((detail) => detail.path === "manifest.json")?.reason).toMatch(/size differs/);
  });

  it("stops at pre-flight for read-only media, permission denial and a vanished card", async () => {
    for (const [faults, expectedCode] of [
      [{ readOnly: true }, "TARGET_READ_ONLY"],
      [{ permissionDenied: true }, "TARGET_NOT_WRITABLE"],
      [{ removeBeforeWrite: true }, "TARGET_UNAVAILABLE"],
    ] as const) {
      const storage = new InMemoryRemovableStorage([CARD], faults);
      const { pkg, service } = await builtPackage(storage);
      // The volume comes from detection, as it does in the product: a stale
      // handle would report a different (also correct) refusal from the probe,
      // which is not the path a user takes.
      const detected = await service.detectTargets();
      const card = detected.volumes[0] ?? { id: "E:\\", mountPath: "E:\\", volumeName: "ELEVATOR", removable: true, readOnly: false };
      const result = await service.deployToSdCard(pkg, card);
      expect(result.status, expectedCode).toBe("failed");
      if (result.status !== "failed") continue;
      expect(result.stage).toBe("preflight");
      expect(result.code).toBe(expectedCode);
      // Nothing was written.
      expect(storage.snapshot().size).toBe(0);
    }
  });

  it("refuses a fixed disk even when it is explicitly chosen", async () => {
    const storage = new InMemoryRemovableStorage([CARD, FIXED_DISK]);
    const { pkg, service } = await builtPackage(storage);
    const fixed = (await service.detectTargets()).volumes.find((volume) => volume.id === "C:\\");
    if (!fixed) throw new Error("fixed disk missing");
    const result = await service.deployToSdCard(pkg, fixed);
    expect(result.status).toBe("failed");
    if (result.status !== "failed") return;
    expect(result.code).toBe("TARGET_NOT_REMOVABLE");
    expect(storage.snapshot().size).toBe(0);
  });

  it("reports an unreadable file as a verification failure, not a success", async () => {
    const storage = new InMemoryRemovableStorage([CARD], { unreadablePath: "manifest.json" });
    const { pkg, service } = await builtPackage(storage);
    const card = (await service.detectTargets()).volumes[0];
    const result = await service.deployToSdCard(pkg, card);
    expect(result.status).toBe("failed");
    if (result.status !== "failed") return;
    expect(result.stage).toBe("verify");
    expect(result.verified?.find((detail) => detail.path === "manifest.json")?.reason).toMatch(/could not be read/i);
  });

  it("reports an unsupported eject as a limitation rather than a failure to hide", async () => {
    const storage = new InMemoryRemovableStorage([CARD], { ejectUnsupported: true });
    const { service } = await builtPackage(storage);
    const report = await service.ejectTarget("E:\\");
    expect(report.ok).toBe(false);
    if (report.ok) return;
    expect(report.unsupported).toBe(true);
    expect(report.code).toBe("EJECT_UNSUPPORTED");
  });

  it("ejects when the platform supports it", async () => {
    const storage = new InMemoryRemovableStorage([CARD]);
    const { service } = await builtPackage(storage);
    expect((await service.ejectTarget("E:\\")).ok).toBe(true);
    expect(storage.wasEjected("E:\\")).toBe(true);
    // Once ejected the volume is no longer offered.
    expect((await service.detectTargets()).volumes).toEqual([]);
  });
});

describe("SD deployment: no transport is an explicit state, never a fake success", () => {
  it("reports the missing transport instead of pretending to deploy", async () => {
    const { pkg, service } = await builtPackage();
    expect(service.storageKind).toBeUndefined();
    const detected = await service.detectTargets();
    expect(detected.volumes).toEqual([]);
    expect(detected.error).toMatch(/no removable-storage transport/i);

    const result = await service.deployToSdCard(pkg, { id: "E:\\", mountPath: "E:\\", volumeName: "SD", removable: true, readOnly: false });
    expect(result.status).toBe("failed");
    if (result.status !== "failed") return;
    expect(result.code).toBe("NO_STORAGE_TRANSPORT");
    expect(result.remediation).toMatch(/desktop/i);

    const eject = await service.ejectTarget("E:\\");
    expect(eject.ok).toBe(false);
  });
});

describe("Package path safety mirrors the native guard (G1 review)", () => {
  it("refuses the Windows-normalized traversals a naive check misses", () => {
    // Win32 strips trailing dots and spaces per segment BEFORE resolving `..`,
    // so these parse as ordinary names and then escape the package directory.
    for (const path of [".. /evil.txt", ".. ./evil.txt", "..  /evil.txt"]) {
      expect(unsafePackagePathReason(path), path).toMatch(/traversal/);
    }
    // A trailing dot or space silently renames the file that was asked for.
    expect(unsafePackagePathReason("manifest.json.")).toMatch(/dot or space/);
    expect(unsafePackagePathReason("manifest.json ")).toMatch(/dot or space/);
    expect(unsafePackagePathReason("themes/theme. /x.json")).toBeDefined();
  });

  it("refuses reserved device names, which would discard the data silently", () => {
    // File creation on these SUCCEEDS and writes nothing, so a package
    // containing one could report a fully successful, fully empty deployment.
    for (const name of ["NUL", "nul", "CON", "aux", "PRN", "COM1", "LPT9"]) {
      expect(unsafePackagePathReason(name), name).toMatch(/reserved device/);
      expect(unsafePackagePathReason(`${name}.json`), `${name}.json`).toMatch(/reserved device/);
      expect(unsafePackagePathReason(`themes/${name}/theme.json`), `nested ${name}`).toMatch(/reserved device/);
    }
    // A name that merely contains a reserved word is fine.
    expect(unsafePackagePathReason("console.json")).toBeUndefined();
    expect(unsafePackagePathReason("nullable.json")).toBeUndefined();
  });

  it("accepts the shapes the package builder actually produces", () => {
    for (const path of ["manifest.json", "themes/theme-1/theme.json", "themes/theme-1/rotations/rot-1.json", "assets/asset-1.asset.json"]) {
      expect(unsafePackagePathReason(path), path).toBeUndefined();
    }
  });

  it("surfaces every unsafe shape through pre-flight with a remediation", async () => {
    const { pkg } = await builtPackage();
    const volume = { id: "E:\\", mountPath: "E:\\", volumeName: "SD", removable: true, readOnly: false, freeBytes: 1_000_000 };
    for (const badPath of ["/absolute.json", "../escape.json", "a:b.json", ".. /evil.txt", "NUL.json", "manifest.json."]) {
      const tampered: DeploymentPackage = { ...pkg, files: [...pkg.files, { path: badPath, kind: "manifest", content: "{}" }] };
      const report = preflightDeployment(tampered, volume, { present: true, writable: true });
      expect(report.ok, badPath).toBe(false);
      const finding = report.findings.find((candidate) => candidate.code === "PACKAGE_FILE_NAME_INVALID");
      expect(finding, badPath).toBeDefined();
      expect(finding?.remediation.length).toBeGreaterThan(0);
    }
  });
});

describe("SD deployment: binary media copy", () => {
  function packageWithResolvedAsset(pkg: DeploymentPackage, sourcePath = "D:\\media\\lobby.png"): DeploymentPackage {
    return {
      ...pkg,
      files: [...pkg.files, {
        path: "assets/asset-1.asset.json",
        kind: "asset",
        assetId: "asset-1",
        content: JSON.stringify({
          id: "asset-1",
          name: "Lobby",
          mediaType: "image",
          sourcePath,
          metadata: { resolvedPath: true, sizeBytes: 2048, originalFileName: "lobby.png" },
          binary: false,
        }),
      }],
    };
  }

  it("derives copies only from absolute resolved paths", () => {
    expect(isAbsoluteFilesystemPath("D:\\media\\lobby.png")).toBe(true);
    expect(isAbsoluteFilesystemPath("assets/lobby.png")).toBe(false);
    const logical = {
      files: [{
        path: "assets/a.asset.json", kind: "asset" as const, assetId: "a",
        content: JSON.stringify({ id: "a", sourcePath: "assets/lobby.png", metadata: { resolvedPath: false }, binary: false }),
      }],
    } as unknown as DeploymentPackage;
    expect(binaryMediaCopiesFromPackage(logical)).toEqual([]);
  });

  it("copies resolved media onto the target after the logical package verifies", async () => {
    const storage = new InMemoryRemovableStorage([CARD]);
    const { pkg, service } = await builtPackage(storage);
    const card = (await service.detectTargets()).volumes[0];
    const result = await service.deployToSdCard(packageWithResolvedAsset(pkg), card);
    expect(result.status).toBe("verified");
    if (result.status !== "verified") return;
    expect(result.copiedBinaries).toEqual([{ path: "assets/asset-1.png", bytes: "D:\\media\\lobby.png".length }]);
    expect(storage.snapshot().get(`E:\\::${PACKAGE_ROOT_DIRECTORY}/assets/asset-1.png`)).toBe("BINARY:D:\\media\\lobby.png");
  });

  it("fails the deployment when a resolved source cannot be copied", async () => {
    const storage = new InMemoryRemovableStorage([CARD], { copyFailPath: "assets/asset-1.png" });
    const { pkg, service } = await builtPackage(storage);
    const card = (await service.detectTargets()).volumes[0];
    const result = await service.deployToSdCard(packageWithResolvedAsset(pkg), card);
    expect(result.status).toBe("failed");
    if (result.status !== "failed") return;
    expect(result.stage).toBe("write");
    expect(result.code).toBe("SOURCE_MISSING");
  });
});