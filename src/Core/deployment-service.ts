import { buildDeploymentPackage, verifyDeploymentPackage } from "./export";
import { ApplicationError } from "./application";
import {
  PACKAGE_ROOT_DIRECTORY,
  binaryMediaCopiesFromPackage,
  contentByteLength,
  packageFileWrites,
  preflightDeployment,
  type EjectReport,
  type PreflightReport,
  type RemovableStorageAdapter,
  type RemovableVolume,
  type VolumeProbe,
  type WriteProgress,
} from "./removable-storage";
import type { DeploymentPackage, DeviceProfile, Project } from "../Domain/models";

/**
 * The application service the UI talks to for packaging and deployment.
 *
 * `AGENTS.md` mandates `UI -> Application Service -> Platform/Deployment
 * Adapter`. The UI never learns which transport is configured, and an
 * unavailable transport reports its own reason instead of being silently absent.
 *
 * Every stage returns a report. Nothing here claims a state it did not observe:
 * a write is not a deployment, and a deployment is not verified until the bytes
 * have been read back and compared against the package.
 */
export type PackageBuildOutcome =
  | { readonly status: "built"; readonly package: DeploymentPackage }
  | { readonly status: "blocked"; readonly reason: string; readonly code: string };

export type SdDeploymentStage = "preflight" | "write" | "verify" | "complete";

export type SdVerificationDetail = {
  readonly path: string;
  readonly ok: boolean;
  readonly reason?: string;
};

export type SdDeploymentResult =
  | {
    readonly status: "verified";
    readonly volume: RemovableVolume;
    readonly rootPath: string;
    readonly writtenFiles: number;
    readonly writtenBytes: number;
    readonly verified: readonly SdVerificationDetail[];
    readonly copiedBinaries: readonly { readonly path: string; readonly bytes: number }[];
  }
  | {
    readonly status: "failed";
    readonly stage: SdDeploymentStage;
    readonly code: string;
    readonly message: string;
    readonly remediation: string;
    /** Present when the failure happened after some bytes had already landed. */
    readonly partial?: { readonly writtenFiles: number };
    readonly preflight?: PreflightReport;
    readonly verified?: readonly SdVerificationDetail[];
  };

export class DeploymentService {
  constructor(private readonly storage?: RemovableStorageAdapter) {}

  /** Whether a real removable-storage transport is wired in this build. */
  get storageKind(): RemovableStorageAdapter["kind"] | undefined {
    return this.storage?.kind;
  }

  /**
   * Builds and verifies in one call, because a package the caller has not
   * verified must never be presented as deployable. Verification is still a
   * separate step inside: `buildDeploymentPackage` returns `verified: false` and
   * only `verifyDeploymentPackage` may set it true.
   */
  async buildVerified(project: Project, profile: DeviceProfile): Promise<PackageBuildOutcome> {
    try {
      const built = await buildDeploymentPackage(project, profile);
      const verified = await verifyDeploymentPackage(built);
      if (!verified.verified) {
        return { status: "blocked", reason: "The package checksum did not match after building.", code: "DEPLOYMENT_PACKAGE_NOT_VERIFIED" };
      }
      return { status: "built", package: verified };
    } catch (error) {
      if (error instanceof ApplicationError) return { status: "blocked", reason: error.message, code: error.code };
      return { status: "blocked", reason: error instanceof Error ? error.message : "Package build failed.", code: "EXPORT_FAILED" };
    }
  }

  // ------------------------------------------------------------- SD card path

  /**
   * Candidate targets. Non-removable volumes are returned too so the UI can show
   * why they are refused, but `preflightDeployment` rejects them: a deployment
   * must never silently land on a fixed disk.
   */
  async detectTargets(): Promise<{ readonly volumes: readonly RemovableVolume[]; readonly transport: string; readonly error?: string }> {
    if (!this.storage) {
      return { volumes: [], transport: "none", error: "No removable-storage transport is configured in this build." };
    }
    try {
      return { volumes: await this.storage.listVolumes(), transport: this.storage.kind };
    } catch (error) {
      return { volumes: [], transport: this.storage.kind, error: error instanceof Error ? error.message : "Volume enumeration failed." };
    }
  }

  async probeTarget(volumeId: string): Promise<VolumeProbe> {
    if (!this.storage) return { present: false, writable: false, reason: "No removable-storage transport is configured." };
    try {
      return await this.storage.probe(volumeId);
    } catch (error) {
      return { present: false, writable: false, reason: error instanceof Error ? error.message : "Probe failed." };
    }
  }

  preflight(packageFile: DeploymentPackage, volume: RemovableVolume | undefined, probe: VolumeProbe | undefined): PreflightReport {
    return preflightDeployment(packageFile, volume, probe);
  }

  /**
   * The full destructive path: pre-flight, write, flush, read back and compare,
   * and only then report success. A failure at any stage stops the pipeline and
   * says which stage, what to do, and whether anything had already landed.
   */
  async deployToSdCard(
    packageFile: DeploymentPackage,
    volume: RemovableVolume,
    options: { readonly onStage?: (stage: SdDeploymentStage) => void; readonly onProgress?: (progress: WriteProgress) => void } = {},
  ): Promise<SdDeploymentResult> {
    if (!this.storage) {
      return {
        status: "failed",
        stage: "preflight",
        code: "NO_STORAGE_TRANSPORT",
        message: "No removable-storage transport is configured in this build.",
        remediation: "Run the desktop (Tauri) build. The browser build has no filesystem access and cannot write to a card.",
      };
    }

    options.onStage?.("preflight");
    const probe = await this.probeTarget(volume.id);
    const preflight = this.preflight(packageFile, volume, probe);
    if (!preflight.ok) {
      const blocking = preflight.findings.find((finding) => finding.severity === "error");
      return {
        status: "failed",
        stage: "preflight",
        code: blocking?.code ?? "PREFLIGHT_FAILED",
        message: blocking?.message ?? "Pre-flight validation failed.",
        remediation: blocking?.remediation ?? "Resolve the reported problem and try again.",
        preflight,
      };
    }

    const binaries = binaryMediaCopiesFromPackage(packageFile);
    const binaryBytes = binaries.reduce((total, copy) => total + copy.sizeBytes, 0);
    const free = probe.freeBytes ?? volume.freeBytes;
    if (free !== undefined && binaryBytes > 0 && free < preflight.totalBytes + binaryBytes) {
      return {
        status: "failed",
        stage: "preflight",
        code: "TARGET_INSUFFICIENT_SPACE",
        message: `The package plus ${binaries.length} media file(s) need ${preflight.totalBytes + binaryBytes} bytes but '${volume.mountPath}' has ${free} free.`,
        remediation: "Free space on the card or use a larger one.",
        preflight,
      };
    }

    options.onStage?.("write");
    const files = packageFileWrites(packageFile);
    const write = await this.storage.writePackage(volume.id, PACKAGE_ROOT_DIRECTORY, files, options.onProgress);
    if (!write.ok) {
      return {
        status: "failed",
        stage: "write",
        code: write.code,
        message: write.failedPath ? `${write.message} (at ${write.failedPath})` : write.message,
        remediation: "The target may be full, removed or write-protected. Nothing on the card should be trusted until a write completes and verifies.",
        partial: { writtenFiles: write.writtenFiles },
        preflight,
      };
    }

    options.onStage?.("verify");
    const verified: SdVerificationDetail[] = [];
    for (const file of files) {
      const readBack = await this.storage.readBack(volume.id, PACKAGE_ROOT_DIRECTORY, file.path);
      if (!readBack.ok) {
        verified.push({ path: file.path, ok: false, reason: readBack.message });
        continue;
      }
      if (readBack.content !== file.content) {
        const expectedBytes = contentByteLength(file.content);
        const actualBytes = contentByteLength(readBack.content);
        verified.push({
          path: file.path,
          ok: false,
          reason: expectedBytes === actualBytes ? "content differs from the package" : `size differs: expected ${expectedBytes} bytes, read ${actualBytes}`,
        });
        continue;
      }
      verified.push({ path: file.path, ok: true });
    }
    const mismatch = verified.filter((detail) => !detail.ok);
    if (mismatch.length > 0) {
      return {
        status: "failed",
        stage: "verify",
        code: "VERIFICATION_MISMATCH",
        message: `${mismatch.length} of ${verified.length} file(s) on the target do not match the package.`,
        remediation: "Do not use this card. Re-run the deployment; if it fails again the card or the reader may be faulty.",
        partial: { writtenFiles: write.writtenFiles },
        preflight,
        verified,
      };
    }

    const copiedBinaries: { path: string; bytes: number }[] = [];
    for (const copy of binaries) {
      const copied = await this.storage.copyFile(volume.id, PACKAGE_ROOT_DIRECTORY, copy.destPath, copy.sourcePath);
      if (!copied.ok) {
        return {
          status: "failed",
          stage: "write",
          code: copied.code,
          message: `Could not copy '${copy.sourcePath}' to '${copy.destPath}': ${copied.message}`,
          remediation: "The logical package is on the card but this media file is missing. Re-import the file from a real path in the desktop build, then deploy again.",
          partial: { writtenFiles: write.writtenFiles },
          preflight,
          verified,
        };
      }
      copiedBinaries.push({ path: copied.destPath, bytes: copied.bytes });
    }

    options.onStage?.("complete");
    return {
      status: "verified",
      volume,
      rootPath: write.rootPath,
      writtenFiles: write.writtenFiles,
      writtenBytes: write.writtenBytes,
      verified,
      copiedBinaries,
    };
  }

  /** Safe removal. `unsupported` is reported as such, never as success. */
  async ejectTarget(volumeId: string): Promise<EjectReport> {
    if (!this.storage) return { ok: false, code: "NO_STORAGE_TRANSPORT", message: "No removable-storage transport is configured in this build.", unsupported: true };
    try {
      return await this.storage.eject(volumeId);
    } catch (error) {
      return { ok: false, code: "EJECT_FAILED", message: error instanceof Error ? error.message : "Eject failed." };
    }
  }
}

export function createDeploymentService(storage?: RemovableStorageAdapter): DeploymentService {
  return new DeploymentService(storage);
}
