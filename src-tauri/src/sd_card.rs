//! SD-card deployment: the native end of the Tauri command boundary.
//!
//! This module owns every filesystem operation in the deployment path. The
//! frontend never touches a path; it calls these commands and inspects the
//! reports they return.
//!
//! Design constraints that shaped it:
//!
//! * **No third-party crates.** Volume enumeration needs Win32, and the
//!   `windows`/`windows-sys` crates could not be compile-verified in the
//!   environment this was written in (no Cargo). A small, explicit `extern
//!   "system"` block against `kernel32` has no version-resolution risk and is
//!   auditable in one screen.
//! * **Never claim success.** Every write is flushed with `sync_all` before the
//!   command returns, and the flush error is propagated rather than swallowed.
//!   Verification is a separate read-back the caller compares.
//! * **Never write a fixed disk by accident.** `sd_write_package` re-checks the
//!   drive type itself; the frontend's pre-flight refusal is defence in depth,
//!   not the only guard.
//! * **Never block the UI.** Writing a package is I/O on removable media and can
//!   take seconds. Tauri runs synchronous commands on the main thread, so every
//!   filesystem command here is `async` and does its work on the blocking pool.

use std::collections::BTreeSet;
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};

/// A structured failure. The frontend maps `code` onto its own reporting, so the
/// message never has to be parsed.
#[derive(Debug, Serialize)]
pub struct SdError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failed_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub written_files: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unsupported: Option<bool>,
}

impl SdError {
    fn new(code: &str, message: impl Into<String>) -> Self {
        Self { code: code.into(), message: message.into(), failed_path: None, written_files: None, unsupported: None }
    }

    fn at(code: &str, message: impl Into<String>, path: &str, written_files: u32) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            failed_path: Some(path.to_string()),
            written_files: Some(written_files),
            unsupported: None,
        }
    }

    fn unsupported(code: &str, message: impl Into<String>) -> Self {
        Self { code: code.into(), message: message.into(), failed_path: None, written_files: None, unsupported: Some(true) }
    }
}

#[derive(Debug, Serialize)]
pub struct SdVolume {
    pub id: String,
    pub mount_path: String,
    pub volume_name: String,
    pub file_system: Option<String>,
    pub total_bytes: Option<u64>,
    pub free_bytes: Option<u64>,
    pub removable: bool,
    pub read_only: bool,
}

#[derive(Debug, Serialize)]
pub struct SdProbe {
    pub present: bool,
    pub writable: bool,
    pub free_bytes: Option<u64>,
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SdFile {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct SdWriteResult {
    pub written_files: u32,
    pub written_bytes: u64,
    pub root_path: String,
}

// ---------------------------------------------------------------- Win32 access

#[cfg(windows)]
mod win {
    use std::ffi::OsString;
    use std::os::windows::ffi::{OsStrExt, OsStringExt};

    pub const DRIVE_REMOVABLE: u32 = 2;
    pub const DRIVE_FIXED: u32 = 3;
    pub const DRIVE_REMOTE: u32 = 4;
    pub const DRIVE_CDROM: u32 = 5;

    #[link(name = "kernel32")]
    extern "system" {
        pub fn GetLogicalDrives() -> u32;
        pub fn GetDriveTypeW(root: *const u16) -> u32;
        pub fn GetDiskFreeSpaceExW(
            directory: *const u16,
            free_bytes_available_to_caller: *mut u64,
            total_bytes: *mut u64,
            total_free_bytes: *mut u64,
        ) -> i32;
        pub fn GetVolumeInformationW(
            root: *const u16,
            volume_name: *mut u16,
            volume_name_size: u32,
            serial: *mut u32,
            max_component_len: *mut u32,
            flags: *mut u32,
            file_system_name: *mut u16,
            file_system_name_size: u32,
        ) -> i32;
    }

    /// `FILE_READ_ONLY_VOLUME`
    pub const FS_READ_ONLY: u32 = 0x0008_0000;

    pub fn wide(value: &str) -> Vec<u16> {
        OsString::from(value).as_os_str().encode_wide().chain(std::iter::once(0)).collect()
    }

    pub fn from_wide(buffer: &[u16]) -> String {
        let end = buffer.iter().position(|&c| c == 0).unwrap_or(buffer.len());
        OsString::from_wide(&buffer[..end]).to_string_lossy().to_string()
    }

    pub fn drive_letters() -> Vec<String> {
        let mask = unsafe { GetLogicalDrives() };
        (0u32..26)
            .filter(|index| mask & (1 << index) != 0)
            .map(|index| format!("{}:\\", (b'A' + index as u8) as char))
            .collect()
    }

    pub fn free_bytes_for(root: &str) -> Option<u64> {
        let wide_root = wide(root);
        let mut free_to_caller: u64 = 0;
        let mut total: u64 = 0;
        let mut total_free: u64 = 0;
        let ok = unsafe { GetDiskFreeSpaceExW(wide_root.as_ptr(), &mut free_to_caller, &mut total, &mut total_free) };
        if ok != 0 { Some(free_to_caller) } else { None }
    }

    pub fn is_removable(root: &str) -> bool {
        let wide_root = wide(root);
        unsafe { GetDriveTypeW(wide_root.as_ptr()) == DRIVE_REMOVABLE }
    }
}

// ------------------------------------------------------------- path safety

/// Windows reserved device names. `File::create("…/NUL")` SUCCEEDS and discards
/// every byte, so without this a write could report success having stored
/// nothing — the exact false-success this module exists to prevent.
const RESERVED_DEVICE_NAMES: [&str; 22] = [
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

fn is_reserved_device_name(component: &str) -> bool {
    // A reserved name is reserved with or without an extension: `NUL` and
    // `NUL.json` both address the null device.
    let stem = component.split('.').next().unwrap_or(component);
    RESERVED_DEVICE_NAMES.iter().any(|reserved| stem.eq_ignore_ascii_case(reserved))
}

/// Rejects anything that is not a plain, literal relative path.
///
/// A package path arrives from the frontend, so it is treated as untrusted: no
/// absolute paths, no parent traversal, no drive prefixes.
///
/// Windows normalization is the subtle part. Win32 strips trailing dots and
/// spaces from each component *before* resolving `.` and `..`, so `".. "` is
/// parsed by Rust as an ordinary name, passes a naive check, and then resolves to
/// `..` — escaping the package directory. Trailing dots also mean
/// `"manifest.json."` silently writes `manifest.json`, a different file than the
/// one the caller named.
fn safe_relative(relative: &str) -> Result<PathBuf, SdError> {
    if relative.trim().is_empty() {
        return Err(SdError::new("PATH_INVALID", "An empty package path cannot be written."));
    }
    let candidate = PathBuf::from(relative.replace('\\', "/"));
    for component in candidate.components() {
        match component {
            Component::Normal(part) => {
                let text = part.to_string_lossy();
                if text.contains(':') {
                    return Err(SdError::new("PATH_INVALID", format!("Package path '{relative}' contains a drive separator.")));
                }
                // Windows-normalized form: what the filesystem will actually use.
                let normalized = text.trim_end_matches(|c: char| c == '.' || c.is_whitespace());
                if normalized.is_empty() || normalized == "." || normalized == ".." {
                    return Err(SdError::new(
                        "PATH_INVALID",
                        format!("Package path '{relative}' contains a component that normalizes to a traversal."),
                    ));
                }
                if normalized != text {
                    return Err(SdError::new(
                        "PATH_INVALID",
                        format!("Package path '{relative}' has a component ending in a dot or space, which the filesystem would silently rename."),
                    ));
                }
                if is_reserved_device_name(&text) {
                    return Err(SdError::new(
                        "PATH_INVALID",
                        format!("Package path '{relative}' names a reserved device; writing it would discard the data."),
                    ));
                }
            }
            _ => {
                return Err(SdError::new(
                    "PATH_INVALID",
                    format!("Package path '{relative}' must be a plain relative path."),
                ));
            }
        }
    }
    Ok(candidate)
}

fn volume_root(volume_id: &str) -> Result<PathBuf, SdError> {
    let root = PathBuf::from(volume_id);
    if !root.is_absolute() {
        return Err(SdError::new("VOLUME_INVALID", format!("'{volume_id}' is not an absolute volume path.")));
    }
    Ok(root)
}

/// Every write path must confirm the target is removable. Off Windows there is no
/// drive-type API here, so the write path is refused outright rather than
/// defaulting to "allow" — an unguarded absolute path is how unrelated data gets
/// destroyed.
fn ensure_removable(volume_id: &str) -> Result<(), SdError> {
    #[cfg(windows)]
    {
        if !win::is_removable(volume_id) {
            return Err(SdError::new(
                "TARGET_NOT_REMOVABLE",
                "Refusing to write a deployment package to a volume that is not removable.",
            ));
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = volume_id;
        Err(SdError::unsupported(
            "PLATFORM_UNSUPPORTED",
            "Removable-media writing is implemented for Windows only in V1, and writing without a removable-drive check is refused.",
        ))
    }
}

fn describe_io(error: &std::io::Error) -> (&'static str, String) {
    match error.kind() {
        std::io::ErrorKind::PermissionDenied => ("PERMISSION_DENIED", "Permission denied by the operating system.".to_string()),
        std::io::ErrorKind::NotFound => ("TARGET_UNAVAILABLE", "The path is no longer available.".to_string()),
        std::io::ErrorKind::AlreadyExists => ("PATH_CONFLICT", "A conflicting entry already exists.".to_string()),
        _ => ("IO_ERROR", error.to_string()),
    }
}

/// Turns a blocking-pool join failure into a reportable error rather than a panic.
fn join_failure(error: impl std::fmt::Display) -> SdError {
    SdError::new("TASK_FAILED", format!("The filesystem task did not complete: {error}"))
}

// --------------------------------------------------------- blocking internals

fn list_volumes_blocking() -> Result<Vec<SdVolume>, SdError> {
    #[cfg(windows)]
    {
        let mut volumes = Vec::new();
        for root in win::drive_letters() {
            let wide_root = win::wide(&root);
            let drive_type = unsafe { win::GetDriveTypeW(wide_root.as_ptr()) };
            if drive_type == win::DRIVE_CDROM || drive_type == win::DRIVE_REMOTE {
                continue;
            }
            let removable = drive_type == win::DRIVE_REMOVABLE;
            if !removable && drive_type != win::DRIVE_FIXED {
                continue;
            }

            let mut name_buffer = [0u16; 261];
            let mut fs_buffer = [0u16; 64];
            let mut flags: u32 = 0;
            let ok = unsafe {
                win::GetVolumeInformationW(
                    wide_root.as_ptr(),
                    name_buffer.as_mut_ptr(),
                    name_buffer.len() as u32,
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                    &mut flags,
                    fs_buffer.as_mut_ptr(),
                    fs_buffer.len() as u32,
                )
            };
            // A removable slot with no card returns 0 here; skip it rather than
            // offering an empty reader as a target.
            if ok == 0 {
                continue;
            }

            let label = win::from_wide(&name_buffer);
            let free = win::free_bytes_for(&root);
            let mut total_bytes: u64 = 0;
            let mut total_free: u64 = 0;
            let mut free_to_caller: u64 = 0;
            let space_ok = unsafe {
                win::GetDiskFreeSpaceExW(wide_root.as_ptr(), &mut free_to_caller, &mut total_bytes, &mut total_free)
            };
            volumes.push(SdVolume {
                id: root.clone(),
                mount_path: root.clone(),
                volume_name: if label.is_empty() { "Removable volume".to_string() } else { label },
                file_system: {
                    let fs = win::from_wide(&fs_buffer);
                    if fs.is_empty() { None } else { Some(fs) }
                },
                total_bytes: if space_ok != 0 { Some(total_bytes) } else { None },
                free_bytes: free,
                removable,
                read_only: flags & win::FS_READ_ONLY != 0,
            });
        }
        Ok(volumes)
    }
    #[cfg(not(windows))]
    {
        Err(SdError::unsupported(
            "PLATFORM_UNSUPPORTED",
            "Removable-volume enumeration is implemented for Windows only in V1.",
        ))
    }
}

fn probe_volume_blocking(volume_id: String) -> Result<SdProbe, SdError> {
    let root = volume_root(&volume_id)?;
    if !root.exists() {
        return Ok(SdProbe { present: false, writable: false, free_bytes: None, reason: Some("The volume is not present.".into()) });
    }

    // A filesystem can report itself writable while the card's physical
    // write-protect switch is engaged, so writability is proven, not read.
    let probe_path = root.join(".template-designer-write-probe");
    let attempt = File::create(&probe_path).and_then(|mut file| {
        file.write_all(b"probe")?;
        file.sync_all()
    });
    // The probe file is removed on every path, including failure.
    let _ = fs::remove_file(&probe_path);

    #[cfg(windows)]
    let free_bytes = win::free_bytes_for(&volume_id);
    #[cfg(not(windows))]
    let free_bytes: Option<u64> = None;

    match attempt {
        Ok(()) => Ok(SdProbe { present: true, writable: true, free_bytes, reason: None }),
        Err(error) => {
            let (_, message) = describe_io(&error);
            Ok(SdProbe { present: true, writable: false, free_bytes, reason: Some(message) })
        }
    }
}

fn write_package_blocking(volume_id: String, root_directory: String, files: Vec<SdFile>) -> Result<SdWriteResult, SdError> {
    let root = volume_root(&volume_id)?;
    if !root.exists() {
        return Err(SdError::new("TARGET_UNAVAILABLE", "The volume is not present."));
    }
    ensure_removable(&volume_id)?;

    let live_root = safe_relative(&root_directory).map(|relative| root.join(relative))?;
    // Write into `<root>.next` first. A failed write must not replace a previous
    // complete package, and a second deploy must not merge leftover files.
    let staging_directory = format!("{root_directory}.next");
    let package_root = safe_relative(&staging_directory).map(|relative| root.join(relative))?;
    if package_root.exists() {
        let _ = fs::remove_dir_all(&package_root);
    }

    // Every path is validated BEFORE the first handle opens, so a bad path cannot
    // leave a half-written tree behind.
    let mut planned: Vec<(PathBuf, &SdFile)> = Vec::with_capacity(files.len());
    for file in &files {
        let relative = safe_relative(&file.path)?;
        planned.push((package_root.join(&relative), file));
    }

    fs::create_dir_all(&package_root).map_err(|error| {
        let (code, message) = describe_io(&error);
        SdError::new(code, format!("Could not create the package directory: {message}"))
    })?;

    // Directories are created once, in a deterministic order, so a failure part
    // way through leaves a predictable tree rather than a random one.
    let mut directories: BTreeSet<PathBuf> = BTreeSet::new();
    for (absolute, _) in &planned {
        if let Some(parent) = absolute.parent() {
            directories.insert(parent.to_path_buf());
        }
    }
    for directory in &directories {
        fs::create_dir_all(directory).map_err(|error| {
            let (code, message) = describe_io(&error);
            SdError::new(code, format!("Could not create '{}': {message}", directory.display()))
        })?;
    }

    let mut written_files: u32 = 0;
    let mut written_bytes: u64 = 0;
    for (absolute, file) in &planned {
        let bytes = file.content.as_bytes();
        let result = File::create(absolute).and_then(|mut handle| {
            handle.write_all(bytes)?;
            // Flush to the device, not just to the OS cache. Without this a card
            // pulled seconds later can contain nothing while the write "succeeded".
            handle.sync_all()
        });
        if let Err(error) = result {
            let (code, message) = describe_io(&error);
            return Err(SdError::at(code, message, &file.path, written_files));
        }
        written_files += 1;
        written_bytes += bytes.len() as u64;
    }

    if live_root.exists() {
        let backup_directory = format!("{root_directory}.bak");
        let backup_root = safe_relative(&backup_directory).map(|relative| root.join(relative))?;
        if backup_root.exists() {
            let _ = fs::remove_dir_all(&backup_root);
        }
        fs::rename(&live_root, &backup_root).map_err(|error| {
            let (code, message) = describe_io(&error);
            SdError::new(code, format!("Could not retire the previous package: {message}"))
        })?;
        if let Err(error) = fs::rename(&package_root, &live_root) {
            let _ = fs::rename(&backup_root, &live_root);
            let (code, message) = describe_io(&error);
            return Err(SdError::new(code, format!("Could not promote the staged package: {message}")));
        }
        let _ = fs::remove_dir_all(&backup_root);
    } else {
        fs::rename(&package_root, &live_root).map_err(|error| {
            let (code, message) = describe_io(&error);
            SdError::new(code, format!("Could not promote the staged package: {message}"))
        })?;
    }

    Ok(SdWriteResult {
        written_files,
        written_bytes,
        root_path: live_root.to_string_lossy().to_string(),
    })
}

fn read_file_blocking(volume_id: String, root_directory: String, relative_path: String) -> Result<String, SdError> {
    let root = volume_root(&volume_id)?;
    let package_root = safe_relative(&root_directory).map(|relative| root.join(relative))?;
    let absolute = package_root.join(safe_relative(&relative_path)?);
    fs::read_to_string(&absolute).map_err(|error| {
        let (code, message) = describe_io(&error);
        SdError::new(code, format!("Could not read '{}' back: {message}", absolute.display()))
    })
}

fn copy_file_blocking(volume_id: String, root_directory: String, relative_path: String, source_path: String) -> Result<u64, SdError> {
    let source = Path::new(&source_path);
    if !source.is_absolute() {
        return Err(SdError::new("SOURCE_INVALID", "The source path must be absolute."));
    }
    if !source.exists() {
        return Err(SdError::new("SOURCE_MISSING", format!("'{source_path}' does not exist.")));
    }
    let root = volume_root(&volume_id)?;
    ensure_removable(&volume_id)?;
    let package_root = safe_relative(&root_directory).map(|relative| root.join(relative))?;
    let destination = package_root.join(safe_relative(&relative_path)?);
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            let (code, message) = describe_io(&error);
            SdError::new(code, message)
        })?;
    }
    let copied = fs::copy(source, &destination).map_err(|error| {
        let (code, message) = describe_io(&error);
        SdError::at(code, message, &relative_path, 0)
    })?;
    // `fs::copy` leaves the data in the OS cache. The flush needs a WRITABLE
    // handle — `File::open` is read-only and its `sync_all` fails on Windows —
    // and the error must be propagated, or this reports durability it never had.
    OpenOptions::new()
        .write(true)
        .open(&destination)
        .and_then(|handle| handle.sync_all())
        .map_err(|error| {
            let (code, message) = describe_io(&error);
            SdError::at(code, format!("Copied bytes could not be flushed to the device: {message}"), &relative_path, 0)
        })?;
    Ok(copied)
}

// --------------------------------------------------------------- commands
//
// Every filesystem command is `async` and hands its work to the blocking pool.
// Tauri runs synchronous commands on the main thread, so a synchronous write to
// slow removable media would freeze the window for the duration.

#[tauri::command]
pub async fn sd_list_volumes() -> Result<Vec<SdVolume>, SdError> {
    tauri::async_runtime::spawn_blocking(list_volumes_blocking)
        .await
        .map_err(join_failure)?
}

#[tauri::command]
pub async fn sd_probe_volume(volume_id: String) -> Result<SdProbe, SdError> {
    tauri::async_runtime::spawn_blocking(move || probe_volume_blocking(volume_id))
        .await
        .map_err(join_failure)?
}

#[tauri::command]
pub async fn sd_write_package(
    volume_id: String,
    root_directory: String,
    files: Vec<SdFile>,
) -> Result<SdWriteResult, SdError> {
    tauri::async_runtime::spawn_blocking(move || write_package_blocking(volume_id, root_directory, files))
        .await
        .map_err(join_failure)?
}

/// Reads one written file back so the caller can compare it against the package.
/// Verification lives on the caller's side on purpose: the component that wrote
/// the bytes is not the component that should certify them.
#[tauri::command]
pub async fn sd_read_file(volume_id: String, root_directory: String, relative_path: String) -> Result<String, SdError> {
    tauri::async_runtime::spawn_blocking(move || read_file_blocking(volume_id, root_directory, relative_path))
        .await
        .map_err(join_failure)?
}

/// Copies a real file onto the target, for the day assets carry resolvable
/// absolute paths. The V1 package itself contains logical asset records, so this
/// is the seam for binary media rather than something the current package needs.
#[tauri::command]
pub async fn sd_copy_file(
    volume_id: String,
    root_directory: String,
    relative_path: String,
    source_path: String,
) -> Result<u64, SdError> {
    tauri::async_runtime::spawn_blocking(move || copy_file_blocking(volume_id, root_directory, relative_path, source_path))
        .await
        .map_err(join_failure)?
}

/// Safe removal.
///
/// Windows only offers a reliable eject through `DeviceIoControl` on a volume
/// handle, which needs privileges this application does not request. Rather than
/// pretend, this reports `unsupported` and the UI tells the user to use the
/// operating system's own eject. Flushing already happened during the write, so
/// the data is on the card either way.
#[tauri::command]
pub async fn sd_eject_volume(volume_id: String) -> Result<(), SdError> {
    let _ = volume_root(&volume_id)?;
    Err(SdError::unsupported(
        "EJECT_UNSUPPORTED",
        "This build does not request the privileges needed to eject a volume. Every written file was flushed to the device, so the card can be removed using the operating system's own Safely Remove Hardware.",
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_plain_relative_paths() {
        assert!(safe_relative("manifest.json").is_ok());
        assert!(safe_relative("themes/theme-1/theme.json").is_ok());
        assert!(safe_relative("assets/asset-1.asset.json").is_ok());
    }

    #[test]
    fn rejects_traversal_and_absolute_paths() {
        assert!(safe_relative("").is_err());
        assert!(safe_relative("/absolute").is_err());
        assert!(safe_relative("../escape").is_err());
        assert!(safe_relative("C:/elsewhere").is_err());
        assert!(safe_relative("a/../../escape").is_err());
    }

    #[test]
    fn rejects_windows_normalized_traversal() {
        // Win32 strips trailing spaces and dots per component BEFORE resolving
        // `..`, so these escape the package directory despite parsing as
        // ordinary names.
        assert!(safe_relative(".. /evil.txt").is_err());
        assert!(safe_relative(".. ./evil.txt").is_err());
        assert!(safe_relative("..  /evil.txt").is_err());
        // A trailing dot silently renames the file the caller asked for.
        assert!(safe_relative("manifest.json.").is_err());
        assert!(safe_relative("manifest.json ").is_err());
    }

    #[test]
    fn rejects_reserved_device_names() {
        // These SUCCEED at File::create and discard every byte, which would let a
        // write report success having stored nothing.
        for name in ["NUL", "nul", "CON", "aux", "PRN", "COM1", "LPT9"] {
            assert!(safe_relative(name).is_err(), "{name} must be refused");
            assert!(safe_relative(&format!("{name}.json")).is_err(), "{name}.json must be refused");
            assert!(safe_relative(&format!("themes/{name}")).is_err(), "nested {name} must be refused");
        }
        // A name that merely contains a reserved word is fine.
        assert!(safe_relative("console.json").is_ok());
        assert!(safe_relative("nullable.json").is_ok());
    }

    #[test]
    fn rejects_relative_volume_ids() {
        assert!(volume_root("relative").is_err());
    }

    #[test]
    #[cfg(not(windows))]
    fn refuses_writes_without_a_removable_check() {
        // Off Windows there is no drive-type API here, so the write path must
        // refuse rather than default to allowing any absolute path.
        assert!(ensure_removable("/tmp").is_err());
    }
}
