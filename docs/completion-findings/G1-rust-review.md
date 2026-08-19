# G1 — Rust Review: SD-card native layer

- **Repo:** `C:\Users\b1601\Template_Designer`
- **Branch:** `manus2`
- **Tag/baseline:** `audit-baseline-v2` = commit `588b7e1c4541c430e097a9ecb0c07b94e3f0cf6d`
- **`git status`:** clean (tree has not moved; citations below are against the working tree == `588b7e1`)
- **Reviewer:** RUST REVIEW SPECIALIST G1 (read-only; no Cargo toolchain available)

## Verdict

**WILL COMPILE** — I found **no** compile errors in the Rust sources as written. There are no `serde` derive mismatches, no broken `#[tauri::command]` signatures, no Win32 FFI signature errors, and no `#[cfg]`-arm type errors. The issues below are runtime/behavioural (correctness, safety, packaging), not compile blockers.

**BLOCKER list: empty.** (Nothing fails to compile and nothing in the reachable deployment path will corrupt a fixed disk.)

---

## Priority 1 — Compile review (read-as-a-compiler)

All of the following were checked and pass:

| Check | Result |
|---|---|
| `SdError` derives `Serialize` only; all field types (`String`, `Option<String>`, `Option<u32>`, `Option<bool>`) are `Serialize` | PASS. `Option<bool>` serializes fine; the three `#[serde(skip_serializing_if = "Option::is_none")]` attributes are valid. `SdError` needs only `Serialize` (returned, never received). |
| Tauri 2 `Result<T, E>` error bound (`E: Serialize + Send`) | PASS. `SdError` is auto-`Send` (all fields `Send`) and `Serialize`. |
| `SdFile` derives `Deserialize` (received via `Vec<SdFile>` arg) | PASS. `DeserializeOwned` holds (`'static` `String` fields). |
| `SdVolume` / `SdProbe` / `SdWriteResult` derive `Serialize` only | PASS. Return shapes are `Serialize + Send`. |
| `#[tauri::command]` return `()` (in `sd_eject_volume`) | PASS. `(): Serialize`. |
| `std::ptr::null_mut()` passed to `*mut u32` FFI params | PASS. Type inferred from the declared extern signature. |
| `1 << index` where `index: &u32` (in `drive_letters`) | PASS. `impl Shl<&u32> for u32` exists via `forward_ref_binop!`; `1` is inferred `u32` by `mask & (…)`. |
| `b'A' + index as u8` (map closure receives owned `u32`, not `&u32`) | PASS. `index as u8` is a valid cast; max `65+25` fits `u8`. |
| `OsString::from(&str)`, `encode_wide()` (`OsStrExt`), `OsString::from_wide` (`OsStringExt`) | PASS. Both traits imported in `mod win` (`sd_card.rs:100`). |
| `#[cfg(windows)]` vs `#[cfg(not(windows))]` arms | PASS. `sd_list_volumes` both arms return `Result<Vec<SdVolume>, SdError>`; `sd_probe_volume` `free_bytes` is `Option<u64>` in both arms (inferred from the `SdProbe` field); `mod win` is entirely `#[cfg(windows)]` so no unused-import/unused-module warnings off Windows. |
| `#[cfg(test)]` tests | PASS. `use super::*` reaches private `safe_relative`/`volume_root`; all asserted paths behave as asserted on both platforms (`safe_relative("C:/elsewhere")` errors on Unix too because `Normal("C:")` contains `:`). |
| Unused imports/vars/moves/borrows | PASS. `BTreeSet`, `fs`, `File`, `Write`, `Component/Path/PathBuf`, `Deserialize/Serialize` all used. `total`/`total_free` locals are only FFI-written but are "used" via `&mut`, so no lint fires. No move/borrow errors in the write loop (`bytes: &[u8]` is `Copy`). |
| `tauri` / `tauri-build` versions | PASS (resolvable). `Cargo.lock` pins **tauri 2.11.5** and **tauri-build 2.6.3**, so the `"2.8.0"` / `"2.4.1"` carets resolve. (`Cargo.lock:3043-3045`, `:3094-3096`.) |
| `build.rs` / `main.rs` / `[lib]` | PASS for compilation. `build.rs` calls `tauri_build::build()`; `main.rs` calls `template_designer_lib::run()`; lib `crate-type = ["staticlib","cdylib","rlib"]` is the standard Tauri shape. (See MAJOR-4 for a packaging defect, not a compile error.) |

**UNVERIFIED (would be settled by running `cargo`):**
- Exact lint surface (I read for warnings; none are expected, but I cannot run `cargo check`).
- `generate_context!` vs an empty `"icon": []` and a possibly-absent `../dist` at build time. These are build-environment concerns, not Rust source errors; `dev` builds use `devUrl` and do not need `../dist`.

---

## Priority 2 — Filesystem-contract correctness

### `sync_all` coverage
- `sd_write_package` (`sd_card.rs:376-381`): every file is `File::create → write_all → sync_all`, and the error is propagated via `?` inside the closure, then turned into `SdError::at(...)` at `:382-385`. **PASS** — flush errors are not swallowed.
- **MAJOR — `sd_copy_file` swallows its flush and the flush is structurally broken** (`sd_card.rs:437-446`). `fs::copy` succeeds (data still in OS cache), then it reopens the destination with `File::open` (read-only) and calls `sync_all`. On Windows `File::sync_all` calls `FlushFileBuffers`, which requires `GENERIC_WRITE` on the handle; a read-only `File::open` handle does not have it, so this `sync_all` returns `Err(ACCESS_DENIED)` and the error is discarded with `let _ =`. Net effect: `sd_copy_file` reports `Ok(copied)` without any durability guarantee, contradicting the module's own "never claim success" contract. Currently unexposed by the TS adapter (the seam is not wired), so not a live data path — but it is a registered, reachable command. Fix: open the destination for write (`OpenOptions::new().write(true).open(...)`) and `?`-propagate `sync_all`, or open the source and copy manually with a writable handle and flush it.

### `safe_relative` (path-escape analysis)
- Correctly rejects: empty/whitespace-only, absolute (`/…`), `ParentDir`/`CurDir` components, drive prefixes (`C:/…`), UNC prefixes (`//server/…` → `Prefix` on Windows, `RootDir` on Unix), and any `Normal` component containing `:` (`sd_card.rs:156-178`).
- **MAJOR — it does NOT account for Windows trailing-dot/trailing-space normalization or reserved device names.** A component such as `".. "` (dot-dot + trailing space), `".. ."`, or `"..  "` is parsed by Rust as `Component::Normal(".. ")` (only the exact bytes `".."` are `ParentDir`), passes the `:` check, and is then handed to `File::create`. Win32 strips trailing spaces/dots per component before resolving `.`/`..`, so `".. "` → `".."`, and `package_root.join(".. ")` resolves to the *parent* of the intended directory. Concrete escape: with `volume_id = "E:\\"`, `root_directory = "template-designer"`, a file path `".. \evil.txt"` is written to `E:\evil.txt` instead of `E:\template-designer\evil.txt`. It is bounded to the removable drive (Win32 cannot walk above a drive root), so this is same-volume traversal + name-confusion, not a fixed-disk write. Also unhandled: Windows reserved names — `"NUL"`, `"CON"`, `"AUX"`, `"PRN"`, `"COM1"…"COM9"`, `"LPT1"…"LPT9"` (with or without an extension) — where `File::create("…/NUL")` succeeds and silently discards the bytes, so `sd_write_package` can report success while writing nothing. `"manifest.json."` (trailing dot) silently writes `manifest.json`.
  - **Note on the TS pre-flight:** `removable-storage.ts:134` does reject `file.path.includes("..")`, so the obvious `.. ` variants are caught in the *normal* flow. But `sd_card.rs` explicitly documents itself as the untrusted-path backstop and "the guard that matters" (`sd_card.rs:3-5`, `:16-19`, `:322`); as a standalone native command it is not protected, and the reserved-name (NUL/CON) case is *not* caught by the TS regex either.
  - Fix: in `safe_relative`, additionally reject any `Normal` component that (a) ends in `.` or a space after Windows normalization, (b) normalizes to `"."` or `".."`, or (c) matches a reserved device name case-insensitively (including `name.ext` forms). Simplest robust form: reject components ending in `.` or whitespace, reject the literal `..`/`.` (already done), and reject the reserved-name set. Consider canonicalizing by actually creating the target and comparing canonical paths, but the name blacklist + trailing-dot/space rejection is sufficient for this boundary.

### `sd_write_package` fixed-disk refusal
- On Windows (`sd_card.rs:334-344`): re-checks `GetDriveTypeW(volume_id) == DRIVE_REMOVABLE` and refuses otherwise. Solid — fixed (`DRIVE_FIXED`), remote/UNC (`DRIVE_REMOTE`), and optical (`DRIVE_CDROM`) are all refused. PASS.
- **MAJOR — on non-Windows there is no refusal at all** (`sd_card.rs:334-344` is `#[cfg(windows)]` only). `volume_root` only checks `is_absolute()`, so on a non-Windows build `sd_write_package`/`sd_copy_file` will happily write to any absolute path (`/`, `/home/…`, etc.). Practically gated because `sd_list_volumes` returns `PLATFORM_UNSUPPORTED` on non-Windows (`:263-269`) and the app targets Windows, but it is a missing guard and a reachable `invoke` surface. Fix: return `PLATFORM_UNSUPPORTED` from `sd_write_package`/`sd_copy_file` on `#[cfg(not(windows))]`, or gate the write path behind `cfg!(windows)`.

### `sd_probe_volume` probe-file cleanup
- If `File::create` succeeds, `remove_file` is attempted on every path (success *and* write/sync failure) after `drop(file)` (`sd_card.rs:283-292`). If `File::create` fails (write-protected card) there is nothing to remove. **PASS with caveat** — `let _ = fs::remove_file(...)` swallows removal failure, so a card that goes read-only between write and remove (or any removal error) leaves `.template-designer-write-probe` behind. MINOR.

### `sd_read_file` vs `sd_write_package` path parity
- Identical construction on both sides: `volume_root(volume_id) → safe_relative(root_directory) → root.join(...) → package_root.join(safe_relative(relative_path))` (`sd_card.rs:401-404` vs `:329,346,373-374`). TS passes the same `PACKAGE_ROOT_DIRECTORY` and `file.path` to both (`deployment-service.ts:191,207`; `removable-storage.ts:94`). **PASS** — read-back reads exactly what was written.

### `GetVolumeInformationW` returning 0 skips the volume
- Correct for a removable reader with no media: the drive letter appears in `GetLogicalDrives`, `GetDriveTypeW` says `DRIVE_REMOVABLE`, and `GetVolumeInformationW` fails → skip (`sd_card.rs:235-237`). Correct behaviour.
- **MINOR** — it does not call `GetLastError`, so a *valid* card that is transiently not ready (mounting, `ERROR_NOT_READY`) is silently skipped and will not appear until the next re-enumeration. Re-enumeration recovers; this is a UX robustness gap, not data loss.

---

## Priority 3 — Boundary agreement (Rust ⇄ TypeScript)

Return shapes match field-for-field and snake_case-for-snake_case:

| Command | Rust return | TS consumer | Agreement |
|---|---|---|---|
| `sd_list_volumes` | `Vec<SdVolume>` | `RustVolume[]` (`tauri-removable-storage.ts:25-34`) | MATCH (`id`, `mount_path`, `volume_name`, `file_system`, `total_bytes`, `free_bytes`, `removable`, `read_only`). `Option<T>` → `null`, and TS checks `!== null` / truthiness. |
| `sd_probe_volume` | `SdProbe` | `RustProbe` (`:36-41`) | MATCH (`present`, `writable`, `free_bytes`, `reason`; `reason: None` → `null`). |
| `sd_write_package` | `SdWriteResult` | `RustWriteResult` (`:43-47`) | MATCH (`written_files`, `written_bytes`, `root_path`). |
| `sd_read_file` | `String` | `string` (`:124`) | MATCH. |
| error (`Err(SdError)`) | `{code, message, failed_path?, written_files?, unsupported?}` | `RustError` (`:49-55`) | MATCH. `skip_serializing_if` omits `None` fields; TS treats them optional. |

**MINOR — `u64` → JS `number` precision.** `total_bytes`/`free_bytes`/`written_bytes` are `u64` (`sd_card.rs:68-69,78,91`) mapped to `number` (`tauri-removable-storage.ts:30-31,45`). Values above `Number.MAX_SAFE_INTEGER` (2^53−1 ≈ 9.0×10^15 bytes ≈ 8 PiB) lose precision. Unrealistic for SD cards (≤ 2 TB ≈ 2×10^12), but the *fixed* disks that are also enumerated (as `removable: false`) could theoretically be large; the pre-flight space comparison (`removable-storage.ts:159-161`) is the only consumer that does arithmetic, and it operates on free bytes, which for any real card is far below the limit. Note only, no action required for V1.

---

## Priority 4 — Safety / data-loss / hang

- **Formatting:** no format command exists anywhere in the native layer. PASS (and the module documents why `sd_eject_volume` deliberately returns `EJECT_UNSUPPORTED` instead of a fake eject, `sd_card.rs:456-463`).
- **MAJOR — synchronous commands run blocking I/O on the main thread** (`sd_card.rs:202-463`; all six commands are `fn`, none `async`). Per the Tauri 2 docs, commands without `async` execute on the main thread, so `sd_write_package`'s per-file `sync_all` (which can block for seconds on a slow SD card) and `sd_copy_file`'s copy freeze the entire UI for the duration of the invoke. The TS progress callback only fires once before and once after the single `invoke` (`tauri-removable-storage.ts:101,108`), so there is no streaming progress to mask the freeze. Fix: make the commands `async fn` and wrap the blocking filesystem work in `tauri::async_runtime::spawn_blocking(...)`; then stream per-file progress via a channel/event if desired.
- **MINOR — non-atomic write, no rollback.** `sd_write_package` pre-creates directories then writes files in order (`sd_card.rs:352-388`). A mid-way failure returns an error but leaves a partial tree and partial `written_files` on the card (the code documents this as intentional, `:352-353`). The service surfaces it as `partial` (`deployment-service.ts:199`), which is honest, but there is no cleanup/rollback. Acceptable for V1; note as a hardening item.

---

## Priority 5 — Tauri permissions (capabilities)

### Answer to the camelCase-argument question
**The TS side is CORRECT — this is not a bug.** Tauri 2's `#[tauri::command]` macro, by default, exposes each Rust parameter under its **camelCase** spelling (`rename_all = "camelCase"`). So the Rust `snake_case` parameters map exactly to the TS keys used here:

| Rust param | Tauri JS key | TS key used | Match |
|---|---|---|---|
| `volume_id` | `volumeId` | `volumeId` | ✓ |
| `root_directory` | `rootDirectory` | `rootDirectory` | ✓ |
| `relative_path` | `relativePath` | `relativePath` | ✓ |
| `source_path` | `sourcePath` | (unused seam) | ✓ |
| `files` | `files` | `files` | ✓ |

Reference: [Tauri v2 — Calling Rust from the Frontend](https://v2.tauri.app/develop/calling-rust/) ("Arguments should be passed as a JSON object with camelCase keys"). If the keys *were* snake_case, the invoke would fail at runtime with a serde `missing field` deserialization error (not silently succeed) — so this code is on the correct side of the boundary.

### Answer to the Tauri-permission question
**Custom `invoke` commands are callable with only `"core:default"`; no explicit permission entry is required.** In Tauri 2 the capability/ACL system gates **plugin** commands (including `core:*` plugin commands); commands defined by the application itself via `#[tauri::command]` + `generate_handler!` are always allowed and are not subject to capability entries. The frontend uses only `invoke` from `@tauri-apps/api/core` (the raw IPC transport) and no plugin APIs, so `core:default` (the standard `create-tauri-app` default, identical to this file) is sufficient. The capability's `"windows": ["main"]` correctly matches the default window label (the config window has no `label`, so it defaults to `"main"`). Reference: [Tauri v2 — Capabilities](https://v2.tauri.app/security/capabilities/). The capability file is correct as written.

---

## Findings summary

### BLOCKER
None.

### MAJOR
1. **`safe_relative` bypass via Windows trailing-dot/space + reserved device names** — `src-tauri/src/sd_card.rs:156-178` (consumed at `:346`, `:356`, `:373`, `:404`, `:430`). `".. "`/`".. ."` escape the package directory on Windows; `NUL`/`CON`/`COM1…` silently discard writes and report success. Fix: reject components that end in `.` or whitespace, and reject the reserved-name set (case-insensitive, with-extension forms).
2. **`sd_copy_file` never actually flushes and swallows the error** — `src-tauri/src/sd_card.rs:437-446`. `fs::copy` then read-only `File::open` + `sync_all` (fails on Windows) with `let _ =`. Fix: copy through a writable handle and `?`-propagate `sync_all`.
3. **No removable guard on non-Windows** — `src-tauri/src/sd_card.rs:334-344` (`#[cfg(windows)]` only). `sd_write_package`/`sd_copy_file` would write any absolute path off Windows. Fix: `#[cfg(not(windows))]` → return `PLATFORM_UNSUPPORTED` before any write.
4. **Sync commands block the main thread** — `src-tauri/src/sd_card.rs:202-463` + registration `src-tauri/src/lib.rs:27-36`. Deployment write/flush/copy freezes the UI. Fix: `async fn` + `spawn_blocking`.
5. **`windows_subsystem = "windows"` is on the lib, not the binary** — `src-tauri/src/lib.rs:1` (should be in `src-tauri/src/main.rs:1`, which has it missing). The release executable will link with the console subsystem and show a console window. Fix: move `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]` to `main.rs`.

### MINOR
1. `u64` → JS `number` precision ceiling (`sd_card.rs:68-69,78,91`; `tauri-removable-storage.ts:30-31,45`) — not realistic for SD cards.
2. Probe-file removal error swallowed (`sd_card.rs:287`) — possible leftover `.template-designer-write-probe`.
3. Partial writes not rolled back (`sd_card.rs:352-388`) — acknowledged in code; hardening item.
4. `GetVolumeInformationW` failure skips valid-but-transiently-not-ready cards; no `GetLastError` discrimination (`sd_card.rs:235-237`).
5. `volume_root` accepts any absolute path, not just a drive root (`sd_card.rs:180-186`) — bounded by the drive-type re-check on Windows, but `root_path`/`mount_path` need not be a true root.
6. `sd_read_file` is `read_to_string` (UTF-8 only) and cannot verify binary written by `sd_copy_file` (`sd_card.rs:405`) — unused in the current text-only flow.

### NIT
- `safe_relative` rejects harmless `CurDir` (`./a`) and `a/./b` paths (`sd_card.rs:169-175`) — stricter than necessary, safe.
- `GetDriveTypeW` can misclassify some USB/SD readers as `DRIVE_FIXED`, causing a valid card to be refused (false-negative, safe direction) — `sd_card.rs:213`.
- Empty `"icon": []` in `tauri.conf.json:30` (an `icons/icon.png` exists but is unreferenced); Tauri falls back to a default icon with a warning — bundling cosmetic issue only.

---

## Things that are explicitly CORRECT (do not "fix")
- Argument naming: TS camelCase keys correctly match Tauri 2's default camelCase mapping.
- Permissions: `core:default` is sufficient; custom commands need no capability entry.
- `sync_all` on every `sd_write_package` file, with propagated errors.
- Write/read path construction is character-identical.
- Win32 FFI signatures and constants match the documented API (`GetLogicalDrives`, `GetDriveTypeW`, `GetDiskFreeSpaceExW`, `GetVolumeInformationW`, `FILE_READ_ONLY_VOLUME = 0x80000`).
- `sd_write_package` refuses non-removable volumes on Windows (fixed/remote/optical all refused).
- Probe file is removed on the success-of-create path including the write/sync error path.
- No formatting anywhere.
