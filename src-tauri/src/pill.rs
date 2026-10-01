//! The edge pill: a small always-on-top window docked to the right edge of the screen,
//! visible on every desktop, from which a capture can be made without opening the app.

use serde::Deserialize;

pub const PILL_LABEL: &str = "pill";
/// Gap kept between the pill and the top and bottom of the screen.
const MARGIN: f64 = 24.0;

#[derive(Clone, Copy, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PillState {
    Collapsed,
    Expanded,
    Captured,
    Picking,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

/// Width and height of the window for a state, in logical pixels.
pub fn size(state: PillState) -> (f64, f64) {
    match state {
        PillState::Collapsed => (14.0, 72.0),
        PillState::Expanded => (280.0, 310.0),
        PillState::Captured => (280.0, 330.0),
        PillState::Picking => (280.0, 360.0),
    }
}

/// Where the window goes on `screen`: flush with the right edge, `top` below the top of
/// the screen, kept inside the screen whatever the state's height.
pub fn frame(state: PillState, screen: Rect, top: f64) -> Rect {
    let (w, h) = size(state);
    let lowest = (screen.h - h - MARGIN).max(MARGIN);
    Rect {
        x: screen.x + screen.w - w,
        y: screen.y + top.clamp(MARGIN, lowest),
        w,
        h,
    }
}

use std::sync::Mutex;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, WebviewUrl};
#[cfg(not(target_os = "macos"))]
use tauri::WebviewWindowBuilder;

/// Distance from the top of the screen, kept across state changes.
pub struct PillTop(Mutex<f64>);

impl Default for PillTop {
    fn default() -> Self {
        Self(Mutex::new(170.0))
    }
}

/// The logical area of the screen the pill lives on: the one under the main window,
/// else the primary one.
fn screen_area(app: &AppHandle) -> Option<Rect> {
    let monitor = app
        .get_webview_window("main")
        .and_then(|w| w.current_monitor().ok().flatten())
        .or_else(|| app.primary_monitor().ok().flatten())?;
    let scale = monitor.scale_factor();
    let (pos, size) = (monitor.position(), monitor.size());
    Some(Rect {
        x: pos.x as f64 / scale,
        y: pos.y as f64 / scale,
        w: size.width as f64 / scale,
        h: size.height as f64 / scale,
    })
}

fn place(app: &AppHandle, state: PillState) -> Result<(), String> {
    let window = app.get_webview_window(PILL_LABEL).ok_or("The pill window is not open.")?;
    let area = screen_area(app).ok_or("No screen found.")?;
    let top = *app.state::<PillTop>().0.lock().map_err(|e| e.to_string())?;
    let f = frame(state, area, top);
    window.set_size(LogicalSize::new(f.w, f.h)).map_err(|e| e.to_string())?;
    window.set_position(LogicalPosition::new(f.x, f.y)).map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
tauri_nspanel::tauri_panel! {
    panel!(PillPanel {
        config: {
            can_become_key_window: true,
            is_floating_panel: true
        }
    })
}

/// Opens the pill, collapsed against the right edge, on every desktop.
///
/// On macOS it is a real `NSPanel`: only panels that do not activate the app are kept
/// by the system when the desktop changes or an app is full screen.
#[cfg(target_os = "macos")]
pub fn create(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_nspanel::{CollectionBehavior, PanelBuilder, PanelLevel, StyleMask};
    let (w, h) = size(PillState::Collapsed);
    let panel = PanelBuilder::<_, PillPanel>::new(app, PILL_LABEL)
        .url(WebviewUrl::App("index.html?window=pill".into()))
        .title("ScreenForge pill")
        .size(LogicalSize::new(w, h).into())
        .with_window(|window| window.decorations(false).resizable(false).shadow(false))
        .add_style_mask(StyleMask::empty().nonactivating_panel())
        .level(PanelLevel::Status)
        .collection_behavior(
            CollectionBehavior::new()
                .can_join_all_spaces()
                .full_screen_auxiliary()
                .stationary()
                .ignores_cycle(),
        )
        .has_shadow(false)
        .transparent(true)
        .hides_on_deactivate(false)
        .build()?;
    panel.show();
    place(app, PillState::Collapsed)?;
    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn create(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    WebviewWindowBuilder::new(app, PILL_LABEL, WebviewUrl::App("index.html?window=pill".into()))
        .title("ScreenForge pill")
        .inner_size(size(PillState::Collapsed).0, size(PillState::Collapsed).1)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .resizable(false)
        .always_on_top(true)
        .visible_on_all_workspaces(true)
        .skip_taskbar(true)
        .build()?;
    place(app, PillState::Collapsed)?;
    Ok(())
}

#[tauri::command]
pub fn pill_set_state(app: AppHandle, state: PillState) -> Result<(), String> {
    place(&app, state)
}

/// Moves the pill to `top` logical pixels below the top of its screen.
#[tauri::command]
pub fn pill_set_top(app: AppHandle, state: PillState, top: f64) -> Result<(), String> {
    *app.state::<PillTop>().0.lock().map_err(|e| e.to_string())? = top;
    place(&app, state)
}

/// Brings the main window forward, from the pill or from the Dock icon.
#[tauri::command]
pub fn show_main_window(app: AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("The main window is gone.")?;
    window.show().map_err(|e| e.to_string())?;
    window.unminimize().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    const SCREEN: Rect = Rect { x: 0.0, y: 0.0, w: 1440.0, h: 900.0 };

    #[test]
    fn docks_flush_with_the_right_edge_in_every_state() {
        for state in [PillState::Collapsed, PillState::Expanded, PillState::Captured] {
            let f = frame(state, SCREEN, 170.0);
            assert_eq!(f.x + f.w, 1440.0, "{state:?}");
        }
    }

    #[test]
    fn keeps_the_top_while_the_state_changes() {
        assert_eq!(frame(PillState::Collapsed, SCREEN, 170.0).y, 170.0);
        assert_eq!(frame(PillState::Captured, SCREEN, 170.0).y, 170.0);
    }

    #[test]
    fn is_pushed_up_when_the_card_would_leave_the_screen() {
        let f = frame(PillState::Captured, SCREEN, 800.0);
        assert_eq!(f.y + f.h, 900.0 - 24.0);
    }

    #[test]
    fn cannot_be_dragged_above_the_screen() {
        assert_eq!(frame(PillState::Collapsed, SCREEN, -50.0).y, 24.0);
    }

    #[test]
    fn follows_a_screen_that_does_not_start_at_the_origin() {
        let second = Rect { x: 1440.0, y: -200.0, w: 1920.0, h: 1080.0 };
        let f = frame(PillState::Expanded, second, 100.0);
        assert_eq!((f.x + f.w, f.y), (3360.0, -100.0));
    }

    #[test]
    fn a_screen_shorter_than_the_card_still_gets_a_position() {
        let tiny = Rect { x: 0.0, y: 0.0, w: 800.0, h: 300.0 };
        assert_eq!(frame(PillState::Captured, tiny, 100.0).y, 24.0);
    }
}
