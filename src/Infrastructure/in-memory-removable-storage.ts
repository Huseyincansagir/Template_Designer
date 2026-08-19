import type {
  CopyReport,
  EjectReport,
  PackageFileWrite,
  ReadBackReport,
  RemovableStorageAdapter,
  RemovableVolume,
  VolumeProbe,
  WriteProgress,
  WriteReport,
} from "../Core/removable-storage";

/**
 * In-memory removable storage: a filesystem abstraction that makes the entire
 * deployment pipeline — including every failure path the hardware could produce
 * — testable without a card, a reader, or a Rust toolchain.
 *
 * It is NOT a fake SD card offered to users. It is never wired into the app; the
 * app gets either the native adapter or nothing. Its only consumer is the test
 * suite, which is why fault injection is a first-class feature here.
 */

export type FaultInjection = {
  /** Volume disappears at the next probe (card pulled between detect and write). */
  readonly removeBeforeWrite?: boolean;
  /** Volume disappears part-way through the write. */
  readonly removeAfterFiles?: number;
  /** Reject every write with a permission error. */
  readonly permissionDenied?: boolean;
  /** Fail binary copies (source missing or unreadable). */
  readonly copyFailPath?: string;
  /** Report the volume as read-only. */
  readonly readOnly?: boolean;
  /** Silently corrupt one written file, so only verification can catch it. */
  readonly corruptPath?: string;
  /** Truncate one written file, so verification sees a size mismatch. */
  readonly truncatePath?: string;
  /** Fail the read-back of one path. */
  readonly unreadablePath?: string;
  /** Report eject as unsupported by the platform. */
  readonly ejectUnsupported?: boolean;
};

export type InMemoryVolumeSeed = {
  readonly id: string;
  readonly mountPath: string;
  readonly volumeName: string;
  readonly fileSystem?: string;
  readonly totalBytes?: number;
  readonly freeBytes?: number;
  readonly removable: boolean;
  readOnly?: boolean;
};

export class InMemoryRemovableStorage implements RemovableStorageAdapter {
  readonly kind = "in-memory" as const;
  /** Written content, keyed by `volumeId::rootDirectory/relativePath`. */
  private readonly files = new Map<string, string>();
  private readonly present = new Set<string>();
  private ejected: string | undefined;

  constructor(
    private volumes: readonly InMemoryVolumeSeed[],
    private faults: FaultInjection = {},
  ) {
    volumes.forEach((volume) => this.present.add(volume.id));
  }

  /** Test helper: what actually landed, so a test can assert bytes rather than a boolean. */
  snapshot(): ReadonlyMap<string, string> {
    return new Map(this.files);
  }

  wasEjected(volumeId: string): boolean {
    return this.ejected === volumeId;
  }

  setFaults(faults: FaultInjection): void {
    this.faults = faults;
  }

  /** Test helper: pull the card. */
  detach(volumeId: string): void {
    this.present.delete(volumeId);
  }

  private key(volumeId: string, rootDirectory: string, relativePath: string): string {
    return `${volumeId}::${rootDirectory}/${relativePath}`;
  }

  private byteLength(content: string): number {
    return new TextEncoder().encode(content).length;
  }

  async listVolumes(): Promise<readonly RemovableVolume[]> {
    return this.volumes
      .filter((volume) => this.present.has(volume.id))
      .map((volume) => ({
        id: volume.id,
        mountPath: volume.mountPath,
        volumeName: volume.volumeName,
        ...(volume.fileSystem ? { fileSystem: volume.fileSystem } : {}),
        ...(volume.totalBytes !== undefined ? { totalBytes: volume.totalBytes } : {}),
        ...(volume.freeBytes !== undefined ? { freeBytes: volume.freeBytes } : {}),
        removable: volume.removable,
        readOnly: this.faults.readOnly === true || volume.readOnly === true,
      }));
  }

  async probe(volumeId: string): Promise<VolumeProbe> {
    if (this.faults.removeBeforeWrite) this.present.delete(volumeId);
    const seed = this.volumes.find((volume) => volume.id === volumeId);
    if (!seed || !this.present.has(volumeId)) {
      return { present: false, writable: false, reason: "The volume is not present." };
    }
    if (this.faults.readOnly === true || seed.readOnly === true) {
      return { present: true, writable: false, freeBytes: seed.freeBytes, reason: "The volume is mounted read-only." };
    }
    if (this.faults.permissionDenied) {
      return { present: true, writable: false, freeBytes: seed.freeBytes, reason: "Permission denied on the volume root." };
    }
    return { present: true, writable: true, ...(seed.freeBytes !== undefined ? { freeBytes: seed.freeBytes } : {}) };
  }

  async writePackage(
    volumeId: string,
    rootDirectory: string,
    files: readonly PackageFileWrite[],
    onProgress?: (progress: WriteProgress) => void,
  ): Promise<WriteReport> {
    const seed = this.volumes.find((volume) => volume.id === volumeId);
    const totalBytes = files.reduce((total, file) => total + this.byteLength(file.content), 0);
    if (!seed || !this.present.has(volumeId)) {
      return { ok: false, code: "TARGET_UNAVAILABLE", message: "The volume is not present.", writtenFiles: 0 };
    }
    if (this.faults.permissionDenied) {
      return { ok: false, code: "PERMISSION_DENIED", message: "Permission denied writing to the volume.", writtenFiles: 0 };
    }
    if (this.faults.readOnly === true || seed.readOnly === true) {
      return { ok: false, code: "TARGET_READ_ONLY", message: "The volume is mounted read-only.", writtenFiles: 0 };
    }

    let writtenFiles = 0;
    let writtenBytes = 0;
    for (const file of files) {
      if (this.faults.removeAfterFiles !== undefined && writtenFiles >= this.faults.removeAfterFiles) {
        this.present.delete(volumeId);
        return {
          ok: false,
          code: "TARGET_REMOVED_DURING_WRITE",
          message: "The volume disappeared while writing.",
          failedPath: file.path,
          writtenFiles,
        };
      }
      const free = seed.freeBytes;
      if (free !== undefined && writtenBytes + this.byteLength(file.content) > free) {
        return { ok: false, code: "TARGET_INSUFFICIENT_SPACE", message: "The volume ran out of space.", failedPath: file.path, writtenFiles };
      }
      // Corruption and truncation are written to disk as-if by a faulty card, so
      // only the read-back comparison can detect them - exactly like reality.
      const stored = file.path === this.faults.corruptPath
        ? `${file.content} `
        : file.path === this.faults.truncatePath
          ? file.content.slice(0, Math.max(0, file.content.length - 5))
          : file.content;
      this.files.set(this.key(volumeId, rootDirectory, file.path), stored);
      writtenFiles += 1;
      writtenBytes += this.byteLength(file.content);
      onProgress?.({ writtenFiles, totalFiles: files.length, writtenBytes, totalBytes, currentPath: file.path });
    }
    return { ok: true, writtenFiles, writtenBytes, rootPath: `${seed.mountPath}${rootDirectory}` };
  }

  async copyFile(volumeId: string, rootDirectory: string, destRelativePath: string, sourceAbsolutePath: string): Promise<CopyReport> {
    if (!this.present.has(volumeId)) {
      return { ok: false, code: "TARGET_UNAVAILABLE", message: "The volume is not present.", destPath: destRelativePath };
    }
    if (this.faults.permissionDenied) {
      return { ok: false, code: "PERMISSION_DENIED", message: "Permission denied writing to the volume.", destPath: destRelativePath };
    }
    if (this.faults.copyFailPath === destRelativePath || this.faults.copyFailPath === sourceAbsolutePath) {
      return { ok: false, code: "SOURCE_MISSING", message: `'${sourceAbsolutePath}' could not be copied.`, destPath: destRelativePath };
    }
    if (sourceAbsolutePath.trim().length === 0) {
      return { ok: false, code: "SOURCE_INVALID", message: "The source path must be absolute.", destPath: destRelativePath };
    }
    this.files.set(this.key(volumeId, rootDirectory, destRelativePath), `BINARY:${sourceAbsolutePath}`);
    return { ok: true, bytes: sourceAbsolutePath.length, destPath: destRelativePath };
  }

  async readBack(volumeId: string, rootDirectory: string, relativePath: string): Promise<ReadBackReport> {
    if (!this.present.has(volumeId)) {
      return { ok: false, code: "TARGET_UNAVAILABLE", message: "The volume is not present." };
    }
    if (relativePath === this.faults.unreadablePath) {
      return { ok: false, code: "READ_FAILED", message: "The file could not be read back." };
    }
    const content = this.files.get(this.key(volumeId, rootDirectory, relativePath));
    if (content === undefined) {
      return { ok: false, code: "FILE_MISSING", message: "The expected file is not on the target." };
    }
    return { ok: true, content };
  }

  async eject(volumeId: string): Promise<EjectReport> {
    if (this.faults.ejectUnsupported) {
      return { ok: false, code: "EJECT_UNSUPPORTED", message: "This platform does not expose a reliable eject mechanism.", unsupported: true };
    }
    if (!this.present.has(volumeId)) {
      return { ok: false, code: "TARGET_UNAVAILABLE", message: "The volume is not present." };
    }
    this.ejected = volumeId;
    this.present.delete(volumeId);
    return { ok: true };
  }
}
