mod agents;
mod capture;
mod project;

/// Front-end events for a capture made with the global shortcut.
const SHORTCUT_CAPTURE: &str = "shortcut-capture";
const SHORTCUT_CAPTURE_FAILED: &str = "shortcut-capture-failed";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            use tauri::Emitter;
            use tauri_plugin_global_shortcut::{Code, Modifiers, ShortcutState};

            // Cmd+Shift+X from any app captures the window in front, on the current
            // desktop. ScreenForge is not brought forward: that would switch desktop
            // and hide the window (macOS only lists windows of the current desktop).
            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_shortcuts(["super+shift+x"])?
                    .with_handler(|app, shortcut, event| {
                        if event.state == ShortcutState::Pressed
                            && shortcut.matches(Modifiers::SUPER | Modifiers::SHIFT, Code::KeyX)
                        {
                            let app = app.clone();
                            tauri::async_runtime::spawn_blocking(move || {
                                let _ = match capture::capture_frontmost() {
                                    Ok(capture) => app.emit(SHORTCUT_CAPTURE, capture),
                                    Err(message) => app.emit(SHORTCUT_CAPTURE_FAILED, message),
                                };
                            });
                        }
                    })
                    .build(),
            )?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            project::save_canvas,
            project::load_canvas,
            project::export_png,
            project::get_last_project,
            project::set_last_project,
            capture::list_windows,
            capture::capture_window,
            capture::ensure_screen_capture_access,
            capture::open_screen_capture_settings,
            agents::agent_status,
            agents::configure_claude_code,
            agents::configure_claude_desktop,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
