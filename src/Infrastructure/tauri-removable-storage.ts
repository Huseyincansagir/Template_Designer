import type {
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
 * Native removable-storage transport: the browser half of the Tauri command
 * boundary. It contains no filesystem logic — every operation is a call into
 * Rust, which owns the actual writes (`src-tauri/src/sd_card.rs`).
 *
 * This is the only place in the frontend that knows Tauri exists for deployment
 * purposes. `createRemovableStorageAdapter` returns `undefined` in a plain
 * browser, so the service reports "no transport configured" honestly instead of
 * pretending a card could be written.
 */

type InvokeFn = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

type RustVolume = {
  id: string;
  mount_path: string;
  volume_name: string;
  file_system: string | null;
  total_bytes: number | null;
  free_bytes: number | null;
  removable: boolean;
  read_only: boolean;
};

type RustProbe = {
  present: boolean;
  writable: boolean;
  free_bytes: number | null;
  reason: string | null;
};

type RustWriteResult = {
  written_files: number;
  written_bytes: number;
  root_path: string;
};

type RustError = {
  code?: string;
  message?: string;
  failed_path?: string;
  written_files?: number;
  unsupported?: boolean;
};

function asRustError(error: unknown): RustError {
  if (error && typeof error === "object") return error as RustError;
  return { message: typeof error === "string" ? error : "The native transport failed." };
}

export class TauriRemovableStorage implements RemovableStorageAdapter {
  readonly kind = "native-tauri" as const;

  constructor(private readonly invoke: InvokeFn) {}

  async listVolumes(): Promise<readonly RemovableVolume[]> {
    const volumes = await this.invoke<RustVolume[]>("sd_list_volumes");
    return volumes.map((volume) => ({
      id: volume.id,
      mountPath: volume.mount_path,
      volumeName: volume.volume_name,
      ...(volume.file_system ? { fileSystem: volume.file_system } : {}),
      ...(volume.total_bytes !== null ? { totalBytes: volume.total_bytes } : {}),
      ...(volume.free_bytes !== null ? { freeBytes: volume.free_bytes } : {}),
      removable: volume.removable,
      readOnly: volume.read_only,
    }));
  }

  async probe(volumeId: string): Promise<VolumeProbe> {
    const probe = await this.invoke<RustProbe>("sd_probe_volume", { volumeId });
    return {
      present: probe.present,
      writable: probe.writable,
      ...(probe.free_bytes !== null ? { freeBytes: probe.free_bytes } : {}),
      ...(probe.reason ? { reason: probe.reason } : {}),
    };
  }

  async writePackage(
    volumeId: string,
    rootDirectory: string,
    files: readonly PackageFileWrite[],
    onProgress?: (progress: WriteProgress) => void,
  ): Promise<WriteReport> {
    const totalBytes = files.reduce((total, file) => total + new TextEncoder().encode(file.content).length, 0);
    // Progress is reported per file from this side. Streaming it from Rust would
    // need an event channel; the package is a small set of text files, so
    // per-file granularity is honest rather than decorative.
    onProgress?.({ writtenFiles: 0, totalFiles: files.length, writtenBytes: 0, totalBytes });
    try {
      const result = await this.invoke<RustWriteResult>("sd_write_package", {
        volumeId,
        rootDirectory,
        files: files.map((file) => ({ path: file.path, content: file.content })),
      });
      onProgress?.({ writtenFiles: result.written_files, totalFiles: files.length, writtenBytes: result.written_bytes, totalBytes });
      return { ok: true, writtenFiles: result.written_files, writtenBytes: result.written_bytes, rootPath: result.root_path };
    } catch (error) {
      const failure = asRustError(error);
      return {
        ok: false,
        code: failure.code ?? "NATIVE_WRITE_FAILED",
        message: failure.message ?? "The native transport could not write the package.",
        ...(failure.failed_path ? { failedPath: failure.failed_path } : {}),
        writtenFiles: failure.written_files ?? 0,
      };
    }
  }

  async readBack(volumeId: string, rootDirectory: string, relativePath: string): Promise<ReadBackReport> {
    try {
      const content = await this.invoke<string>("sd_read_file", { volumeId, rootDirectory, relativePath });
      return { ok: true, content };
    } catch (error) {
      const failure = asRustError(error);
      return { ok: false, code: failure.code ?? "NATIVE_READ_FAILED", message: failure.message ?? "The written file could not be read back." };
    }
  }

  async eject(volumeId: string): Promise<EjectReport> {
    try {
      await this.invoke<void>("sd_eject_volume", { volumeId });
      return { ok: true };
    } catch (error) {
      const failure = asRustError(error);
      return {
        ok: false,
        code: failure.code ?? "EJECT_FAILED",
        message: failure.message ?? "The volume could not be ejected.",
        ...(failure.unsupported ? { unsupported: true } : {}),
      };
    }
  }
}

/**
 * Returns the native adapter only inside a Tauri shell. A plain browser gets
 * `undefined`, which the service turns into an explicit "no transport" state —
 * the alternative would be a deployment button that cannot deploy.
 */
export async function createRemovableStorageAdapter(): Promise<RemovableStorageAdapter | undefined> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return undefined;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return new TauriRemovableStorage(invoke as InvokeFn);
  } catch {
    // The shell is present but the API module is not; better to report no
    // transport than to fail at the first click.
    return undefined;
  }
}
