mod agents;
mod capture;
mod pill;
mod project;

/// Front-end events for a capture made with the global shortcut.
const SHORTCUT_CAPTURE: &str = "shortcut-capture";
const SHORTCUT_CAPTURE_FAILED: &str = "shortcut-capture-failed";

#[cfg(target_os = "macos")]
fn tauri_nspanel_init() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri_nspanel::init()
}

#[cfg(not(target_os = "macos"))]
fn tauri_nspanel_init() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::new("no-nspanel").build()
}

/// Captures the window in front and tells every window, like the global shortcut does.
#[tauri::command]
async fn capture_front(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Emitter;
    let capture = tauri::async_runtime::spawn_blocking(capture::capture_frontmost)
        .await
        .map_err(|e| e.to_string())??;
    app.emit(SHORTCUT_CAPTURE, capture).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(pill::PillTop::default())
        .plugin(tauri_nspanel_init())
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
            pill::create(app.handle())?;
            Ok(())
        })
        // Closing the main window hides it: the canvas stays alive for the pill.
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            project::save_canvas,
            project::load_canvas,
            project::export_png,
            project::last_agent_read,
            project::get_last_project,
            project::set_last_project,
            project::recent_projects,
            pill::pill_set_state,
            pill::pill_set_top,
            pill::show_main_window,
            capture_front,
            capture::list_windows,
            capture::capture_window,
            capture::ensure_screen_capture_access,
            capture::open_screen_capture_settings,
            agents::agent_status,
            agents::configure_claude_code,
            agents::configure_claude_desktop,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // A click on the Dock icon brings a hidden main window back.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = event {
                let _ = pill::show_main_window(app.clone());
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (app, event);
        });
}
