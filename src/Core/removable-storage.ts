import type { DeploymentPackage } from "../Domain/models";

/**
 * Removable-storage boundary for the SD-card deployment transport.
 *
 * The UI never touches this. The chain is
 * `UI → DeploymentService → RemovableStorageAdapter → Tauri command → Rust →
 * filesystem → SD card`, and every step below the service is replaceable: the
 * native adapter talks to Rust, the in-memory adapter exists so the whole
 * pipeline — including its failure paths — is testable without hardware.
 *
 * Nothing here reports success it did not observe. Every operation returns a
 * report the caller must inspect; there is no boolean "worked" shortcut.
 */

export interface RemovableVolume {
  /** Stable handle the adapter understands, e.g. a Windows drive root. */
  readonly id: string;
  /** Human-readable mount path shown to the user. */
  readonly mountPath: string;
  readonly volumeName: string;
  readonly fileSystem?: string;
  /**
   * Byte counts cross the native boundary as `u64` and land in a JS `number`, so
   * a value above 2^53-1 (about 8 PiB) would lose precision. Every SD card is
   * orders of magnitude below that, and the only arithmetic performed on these is
   * the free-space comparison in `preflightDeployment`.
   */
  readonly totalBytes?: number;
  readonly freeBytes?: number;
  /** False for fixed disks. A non-removable volume must never be written by default. */
  readonly removable: boolean;
  readonly readOnly: boolean;
}

export type VolumeProbe = {
  readonly present: boolean;
  readonly writable: boolean;
  readonly freeBytes?: number;
  /** Why it is not writable, when the adapter can tell. */
  readonly reason?: string;
};

export type PackageFileWrite = {
  /** Path relative to the package root on the target. Always forward-slashed. */
  readonly path: string;
  readonly content: string;
};

export type WriteProgress = {
  readonly writtenFiles: number;
  readonly totalFiles: number;
  readonly writtenBytes: number;
  readonly totalBytes: number;
  readonly currentPath?: string;
};

export type WriteReport =
  | { readonly ok: true; readonly writtenFiles: number; readonly writtenBytes: number; readonly rootPath: string }
  | { readonly ok: false; readonly code: string; readonly message: string; readonly failedPath?: string; readonly writtenFiles: number };

export type ReadBackReport =
  | { readonly ok: true; readonly content: string }
  | { readonly ok: false; readonly code: string; readonly message: string };

export type EjectReport =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: string; readonly message: string; readonly unsupported?: boolean };

export type CopyReport =
  | { readonly ok: true; readonly bytes: number; readonly destPath: string }
  | { readonly ok: false; readonly code: string; readonly message: string; readonly destPath: string };

export type BinaryMediaCopy = {
  readonly assetId: string;
  readonly sourcePath: string;
  readonly destPath: string;
  readonly sizeBytes: number;
};

export interface RemovableStorageAdapter {
  readonly kind: "native-tauri" | "in-memory";
  /** Every candidate volume. Filtering to removable ones is the caller's decision, not the adapter's. */
  listVolumes(): Promise<readonly RemovableVolume[]>;
  probe(volumeId: string): Promise<VolumeProbe>;
  /** Creates directories, writes each file, and flushes before returning. */
  writePackage(volumeId: string, rootDirectory: string, files: readonly PackageFileWrite[], onProgress?: (progress: WriteProgress) => void): Promise<WriteReport>;
  /** Reads one written file back so the caller can verify what actually landed. */
  readBack(volumeId: string, rootDirectory: string, relativePath: string): Promise<ReadBackReport>;
  /**
   * Copies a real source file onto the target (binary media). The source must
   * be an absolute path the adapter can open. Logical `*.asset.json` records
   * stay in the package; this is the materialization step.
   */
  copyFile(volumeId: string, rootDirectory: string, destRelativePath: string, sourceAbsolutePath: string): Promise<CopyReport>;
  /** Best-effort safe removal. `unsupported: true` is an honest answer, not a failure to hide. */
  eject(volumeId: string): Promise<EjectReport>;
}

// ---------------------------------------------------------------- pre-flight

export type PreflightFinding = {
  readonly severity: "error" | "warning";
  readonly code: string;
  readonly message: string;
  readonly remediation: string;
};

export type PreflightReport = {
  readonly ok: boolean;
  readonly findings: readonly PreflightFinding[];
  readonly totalBytes: number;
  readonly fileCount: number;
};

/** Package root directory on the target. One place, so write and verify agree. */
export const PACKAGE_ROOT_DIRECTORY = "template-designer";

/** Bytes a UTF-8 string occupies on disk. */
export function contentByteLength(content: string): number {
  return new TextEncoder().encode(content).length;
}

export function packageFileWrites(packageFile: DeploymentPackage): readonly PackageFileWrite[] {
  return packageFile.files.map((file) => ({ path: file.path, content: file.content }));
}

/** Windows drive, UNC, or POSIX absolute. Relative package paths never match. */
export function isAbsoluteFilesystemPath(path: string): boolean {
  const trimmed = path.trim();
  if (trimmed.length === 0) return false;
  if (/^[A-Za-z]:[\\/]/.test(trimmed)) return true;
  if (trimmed.startsWith("\\\\")) return true;
  return trimmed.startsWith("/") && !trimmed.startsWith("//.");
}

function sourceExtension(path: string): string {
  const match = /\.([A-Za-z0-9]+)$/.exec(path.replace(/\\/g, "/"));
  const extension = match ? match[1].toLowerCase() : "";
  return extension && extension !== "json" ? extension : "bin";
}

/**
 * Binary copies implied by a verified package. Only assets whose import
 * recorded a real absolute path (`metadata.resolvedPath`) are included. The
 * rest stay as logical `*.asset.json` records — that is the honest browser
 * outcome, not a silent drop.
 */
export function binaryMediaCopiesFromPackage(packageFile: DeploymentPackage): readonly BinaryMediaCopy[] {
  const copies: BinaryMediaCopy[] = [];
  for (const file of packageFile.files) {
    if (file.kind !== "asset") continue;
    let record: { id?: unknown; sourcePath?: unknown; metadata?: Record<string, unknown> };
    try {
      record = JSON.parse(file.content) as { id?: unknown; sourcePath?: unknown; metadata?: Record<string, unknown> };
    } catch {
      continue;
    }
    const sourcePath = typeof record.sourcePath === "string" ? record.sourcePath : "";
    const assetId = typeof record.id === "string" ? record.id : file.assetId;
    const resolved = record.metadata?.resolvedPath === true;
    if (!assetId || !resolved || !isAbsoluteFilesystemPath(sourcePath)) continue;
    const destPath = `assets/${assetId}.${sourceExtension(sourcePath)}`;
    if (unsafePackagePathReason(destPath)) continue;
    const sizeBytes = typeof record.metadata?.sizeBytes === "number" && Number.isFinite(record.metadata.sizeBytes)
      ? Math.max(0, record.metadata.sizeBytes)
      : 0;
    copies.push({ assetId, sourcePath, destPath, sizeBytes });
  }
  return copies;
}

/**
 * Everything that must hold before a single byte is written. Pure, so every
 * refusal is testable without a device: a destructive write must never begin on
 * a maybe.
 */
/**
 * Windows reserved device names. `NUL`, `CON`, `COM1`… are writable paths that
 * DISCARD every byte, so a package containing one would report a successful write
 * having stored nothing. The native layer refuses them too; this check exists so
 * the refusal reaches the user as a readable pre-flight finding rather than as a
 * mid-write native error.
 */
const RESERVED_DEVICE_NAMES = new Set([
  "CON", "PRN", "AUX", "NUL",
  "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
]);

/** Why a package path is unsafe, or undefined when it is fine. */
export function unsafePackagePathReason(path: string): string | undefined {
  if (path.trim().length === 0) return "it is empty";
  if (path.startsWith("/") || path.startsWith("\\") || /^[A-Za-z]:/.test(path)) return "it is absolute";
  if (/[:*?"<>|]/.test(path)) return "it contains a character the target filesystem forbids";
  for (const segment of path.split(/[\\/]/)) {
    if (segment.length === 0) continue;
    // Windows strips trailing dots and spaces per segment BEFORE resolving `..`,
    // so `".. "` traverses upwards and `"a.json."` silently renames the file.
    const normalized = segment.replace(/[.\s]+$/, "");
    if (normalized === "" || normalized === "." || normalized === "..") return `the segment '${segment}' resolves to a directory traversal`;
    if (normalized !== segment) return `the segment '${segment}' ends in a dot or space, which the filesystem would silently rename`;
    if (RESERVED_DEVICE_NAMES.has((segment.split(".")[0] ?? segment).toUpperCase())) return `the segment '${segment}' names a reserved device, and writing it would discard the data`;
  }
  return undefined;
}
export function preflightDeployment(
  packageFile: DeploymentPackage,
  volume: RemovableVolume | undefined,
  probe: VolumeProbe | undefined,
): PreflightReport {
  const findings: PreflightFinding[] = [];
  const files = packageFileWrites(packageFile);
  const totalBytes = files.reduce((total, file) => total + contentByteLength(file.content), 0);

  if (!packageFile.verified) {
    findings.push({
      severity: "error",
      code: "PACKAGE_NOT_VERIFIED",
      message: "The package has not been verified since it was built.",
      remediation: "Run Build & Verify Package first; an unverified package is never written.",
    });
  }
  if (files.length === 0) {
    findings.push({ severity: "error", code: "PACKAGE_EMPTY", message: "The package contains no files.", remediation: "Rebuild the package." });
  }
  if (!files.some((file) => file.path === "manifest.json")) {
    findings.push({ severity: "error", code: "PACKAGE_MANIFEST_MISSING", message: "The package has no manifest.json.", remediation: "Rebuild the package; a target without a manifest cannot be read by the device." });
  }
  for (const file of files) {
    const reason = unsafePackagePathReason(file.path);
    if (reason) {
      findings.push({
        severity: "error",
        code: "PACKAGE_FILE_NAME_INVALID",
        message: `Package path '${file.path}' is not a safe relative path: ${reason}.`,
        remediation: "Rebuild the package. A path may not be absolute, traverse upwards, name a reserved device, end a segment in a dot or space, or contain characters the target filesystem forbids.",
      });
    }
  }

  if (!volume) {
    findings.push({ severity: "error", code: "NO_TARGET_SELECTED", message: "No target volume is selected.", remediation: "Choose a detected removable target." });
  } else {
    if (!volume.removable) {
      // Refusing a fixed disk is a safety rule, not a capability limit.
      findings.push({
        severity: "error",
        code: "TARGET_NOT_REMOVABLE",
        message: `'${volume.mountPath}' is not a removable volume.`,
        remediation: "Select a removable SD card. Writing a deployment package to a fixed disk is refused.",
      });
    }
    if (volume.readOnly) {
      findings.push({ severity: "error", code: "TARGET_READ_ONLY", message: `'${volume.mountPath}' is mounted read-only.`, remediation: "Release the write-protect switch on the card, or use another card." });
    }
    const free = probe?.freeBytes ?? volume.freeBytes;
    if (free !== undefined && free < totalBytes) {
      findings.push({
        severity: "error",
        code: "TARGET_INSUFFICIENT_SPACE",
        message: `The package needs ${totalBytes} bytes but '${volume.mountPath}' has ${free} free.`,
        remediation: "Free space on the card or use a larger one.",
      });
    } else if (free === undefined) {
      findings.push({ severity: "warning", code: "TARGET_SPACE_UNKNOWN", message: "Free space on the target could not be read.", remediation: "The write will proceed but may fail on a full card." });
    }
  }

  if (probe) {
    if (!probe.present) {
      findings.push({ severity: "error", code: "TARGET_UNAVAILABLE", message: "The target volume is no longer available.", remediation: "Re-insert the card and detect targets again." });
    } else if (!probe.writable) {
      findings.push({ severity: "error", code: "TARGET_NOT_WRITABLE", message: probe.reason ?? "The target volume rejected a test write.", remediation: "Check the card's write protection and your permissions on the volume." });
    }
  } else if (volume) {
    findings.push({ severity: "warning", code: "TARGET_NOT_PROBED", message: "The target was not probed before writing.", remediation: "Detect targets again to confirm the card is writable." });
  }

  return {
    ok: findings.every((finding) => finding.severity !== "error"),
    findings,
    totalBytes,
    fileCount: files.length,
  };
}
