mod capture;
mod project;

/// Front-end event that opens the window picker.
const OPEN_CAPTURE_PICKER: &str = "open-capture-picker";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            use tauri::{Emitter, Manager};
            use tauri_plugin_global_shortcut::{Code, Modifiers, ShortcutState};

            // Cmd+Shift+X from any app: bring ScreenForge forward and open the picker.
            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_shortcuts(["super+shift+x"])?
                    .with_handler(|app, shortcut, event| {
                        if event.state == ShortcutState::Pressed
                            && shortcut.matches(Modifiers::SUPER | Modifiers::SHIFT, Code::KeyX)
                        {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                            let _ = app.emit(OPEN_CAPTURE_PICKER, ());
                        }
                    })
                    .build(),
            )?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            project::save_canvas,
            project::load_canvas,
            project::get_last_project,
            project::set_last_project,
            capture::list_windows,
            capture::capture_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
