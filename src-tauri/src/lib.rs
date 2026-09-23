mod project;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            project::save_canvas,
            project::load_canvas,
            project::get_last_project,
            project::set_last_project,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
