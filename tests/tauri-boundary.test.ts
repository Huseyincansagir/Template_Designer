import { describe, expect, it, vi } from "vitest";
import { TauriRemovableStorage } from "../src/Infrastructure/tauri-removable-storage";

/**
 * The Tauri boundary, tested by injecting the `invoke` function.
 *
 * This is the piece most likely to fail silently: a field-name typo between the
 * Rust `snake_case` payload and the TypeScript `camelCase` model produces
 * `undefined` rather than an error, so a card could report unknown capacity, or
 * a failure could lose its code, with nothing raised. Cargo is absent here, so
 * this contract test is the only automated check the boundary gets.
 *
 * The argument names asserted below matter: Tauri converts command parameters to
 * camelCase on the JS side, so `volume_id` in Rust is `volumeId` here.
 */

describe("Tauri removable-storage boundary", () => {
  it("maps the Rust volume payload onto the domain model, dropping nulls", async () => {
    const invoke = vi.fn().mockResolvedValue([
      {
        id: "E:\\",
        mount_path: "E:\\",
        volume_name: "ELEVATOR",
        file_system: "FAT32",
        total_bytes: 8_000_000_000,
        free_bytes: 4_000_000_000,
        removable: true,
        read_only: false,
      },
      {
        // A card whose capacity could not be read: null must become ABSENT, not 0,
        // because 0 free space would wrongly fail pre-flight.
        id: "F:\\",
        mount_path: "F:\\",
        volume_name: "",
        file_system: null,
        total_bytes: null,
        free_bytes: null,
        removable: true,
        read_only: true,
      },
    ]);
    const adapter = new TauriRemovableStorage(invoke);
    const volumes = await adapter.listVolumes();

    expect(invoke).toHaveBeenCalledWith("sd_list_volumes");
    expect(volumes[0]).toEqual({
      id: "E:\\",
      mountPath: "E:\\",
      volumeName: "ELEVATOR",
      fileSystem: "FAT32",
      totalBytes: 8_000_000_000,
      freeBytes: 4_000_000_000,
      removable: true,
      readOnly: false,
    });
    expect("fileSystem" in volumes[1]).toBe(false);
    expect("freeBytes" in volumes[1]).toBe(false);
    expect("totalBytes" in volumes[1]).toBe(false);
    expect(volumes[1].readOnly).toBe(true);
    expect(adapter.kind).toBe("native-tauri");
  });

  it("passes camelCase argument names, which is what Tauri expects", async () => {
    const invoke = vi.fn()
      .mockResolvedValueOnce({ present: true, writable: true, free_bytes: 512, reason: null })
      .mockResolvedValueOnce({ written_files: 2, written_bytes: 40, root_path: "E:\\pkg" })
      .mockResolvedValueOnce("{}")
      .mockResolvedValueOnce(undefined);
    const adapter = new TauriRemovableStorage(invoke);

    await adapter.probe("E:\\");
    expect(invoke).toHaveBeenCalledWith("sd_probe_volume", { volumeId: "E:\\" });

    await adapter.writePackage("E:\\", "pkg", [{ path: "manifest.json", content: "{}" }]);
    expect(invoke).toHaveBeenCalledWith("sd_write_package", {
      volumeId: "E:\\",
      rootDirectory: "pkg",
      files: [{ path: "manifest.json", content: "{}" }],
    });

    await adapter.readBack("E:\\", "pkg", "manifest.json");
    expect(invoke).toHaveBeenCalledWith("sd_read_file", { volumeId: "E:\\", rootDirectory: "pkg", relativePath: "manifest.json" });

    await adapter.eject("E:\\");
    expect(invoke).toHaveBeenCalledWith("sd_eject_volume", { volumeId: "E:\\" });
  });

  it("maps a probe result and treats a null free-space reading as unknown", async () => {
    const invoke = vi.fn().mockResolvedValue({ present: true, writable: false, free_bytes: null, reason: "read-only" });
    const probe = await new TauriRemovableStorage(invoke).probe("E:\\");
    expect(probe).toEqual({ present: true, writable: false, reason: "read-only" });
    expect("freeBytes" in probe).toBe(false);
  });

  it("reports a write success with the native counters and calls progress", async () => {
    const invoke = vi.fn().mockResolvedValue({ written_files: 3, written_bytes: 120, root_path: "E:\\template-designer" });
    const progress: number[] = [];
    const report = await new TauriRemovableStorage(invoke).writePackage(
      "E:\\",
      "template-designer",
      [{ path: "a.json", content: "aa" }, { path: "b/c.json", content: "bbb" }],
      (update) => progress.push(update.writtenFiles),
    );
    expect(report).toEqual({ ok: true, writtenFiles: 3, writtenBytes: 120, rootPath: "E:\\template-designer" });
    // Progress is reported at the start and at completion.
    expect(progress).toEqual([0, 3]);
  });

  it("preserves the structured failure a Rust command rejects with", async () => {
    const invoke = vi.fn().mockRejectedValue({
      code: "TARGET_REMOVED_DURING_WRITE",
      message: "The volume disappeared while writing.",
      failed_path: "themes/t/theme.json",
      written_files: 2,
    });
    const report = await new TauriRemovableStorage(invoke).writePackage("E:\\", "pkg", [{ path: "x.json", content: "{}" }]);
    expect(report.ok).toBe(false);
    if (report.ok) return;
    // The code and the partial count must survive the boundary: the service uses
    // both to tell the user the card is in an incomplete state.
    expect(report.code).toBe("TARGET_REMOVED_DURING_WRITE");
    expect(report.failedPath).toBe("themes/t/theme.json");
    expect(report.writtenFiles).toBe(2);
  });

  it("survives a rejection that is a bare string rather than a structured error", async () => {
    const invoke = vi.fn().mockRejectedValue("permission denied");
    const report = await new TauriRemovableStorage(invoke).readBack("E:\\", "pkg", "manifest.json");
    expect(report.ok).toBe(false);
    if (report.ok) return;
    expect(report.message).toBe("permission denied");
    expect(report.code).toBe("NATIVE_READ_FAILED");
  });

  it("carries the unsupported flag so an eject limitation is not read as a failure", async () => {
    const invoke = vi.fn().mockRejectedValue({
      code: "EJECT_UNSUPPORTED",
      message: "This build does not request the privileges needed to eject a volume.",
      unsupported: true,
    });
    const report = await new TauriRemovableStorage(invoke).eject("E:\\");
    expect(report.ok).toBe(false);
    if (report.ok) return;
    expect(report.unsupported).toBe(true);
    expect(report.code).toBe("EJECT_UNSUPPORTED");
  });

  it("does not invent an unsupported flag for a genuine eject failure", async () => {
    const invoke = vi.fn().mockRejectedValue({ code: "IO_ERROR", message: "device busy" });
    const report = await new TauriRemovableStorage(invoke).eject("E:\\");
    expect(report.ok).toBe(false);
    if (report.ok) return;
    expect("unsupported" in report).toBe(false);
  });
});
