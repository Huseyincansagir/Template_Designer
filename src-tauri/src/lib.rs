mod sd_card;

#[tauri::command]
fn app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

/// Reports what the native layer can actually do, so the frontend describes the
/// build from fact rather than assuming a capability. `safeEject` is false on
/// purpose: this build does not request the privileges a reliable eject needs,
/// and claiming otherwise would be the kind of false success the deployment
/// contract forbids.
#[tauri::command]
fn native_capabilities() -> serde_json::Value {
    serde_json::json!({
        "removableStorage": cfg!(windows),
        "safeEject": false,
        "platform": std::env::consts::OS,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            app_version,
            native_capabilities,
            sd_card::sd_list_volumes,
            sd_card::sd_probe_volume,
            sd_card::sd_write_package,
            sd_card::sd_read_file,
            sd_card::sd_copy_file,
            sd_card::sd_eject_volume,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Template Designer");
}
