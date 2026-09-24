//! Window capture (macOS in v1), behind a small OS boundary: `xcap` calls stay in
//! `list_windows` / `capture_window`; filtering and encoding are pure and tested.

use base64::Engine;
use serde::Serialize;
use xcap::image::RgbaImage;

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct WindowInfo {
    pub id: u32,
    pub app_name: String,
    pub title: String,
    pub width: u32,
    pub height: u32,
}

/// A window as reported by the OS, before filtering.
#[derive(Debug, Clone)]
struct RawWindow {
    info: WindowInfo,
    pid: u32,
    minimized: bool,
    /// macOS window level (kCGWindowLayer): 0 for normal app windows.
    layer: i32,
}

const MIN_SIZE: u32 = 50;

fn is_pickable(w: &RawWindow, own_pid: u32) -> bool {
    w.pid != own_pid
        && !w.minimized
        && !w.info.app_name.is_empty()
        && w.layer == 0
        && w.info.width >= MIN_SIZE
        && w.info.height >= MIN_SIZE
}

/// Windows worth offering in the picker, sorted by app then title.
fn pickable_windows(raw: Vec<RawWindow>, own_pid: u32) -> Vec<WindowInfo> {
    let mut windows: Vec<WindowInfo> = raw
        .into_iter()
        .filter(|w| is_pickable(w, own_pid))
        .map(|w| w.info)
        .collect();
    windows.sort_by_key(|w| (w.app_name.to_lowercase(), w.title.to_lowercase()));
    windows
}

/// The window the user is looking at: the largest window of the app in front.
/// `raw` is in OS order, front to back. Apps such as full-screen Chrome stack
/// transparent overlay windows in front of their real window.
fn frontmost_window(raw: Vec<RawWindow>, own_pid: u32) -> Option<WindowInfo> {
    let pickable: Vec<RawWindow> = raw
        .into_iter()
        .filter(|w| is_pickable(w, own_pid))
        .collect();
    let front_pid = pickable.first()?.pid;
    pickable
        .into_iter()
        .filter(|w| w.pid == front_pid)
        // Reversed so that, between equal sizes, the window nearest the front wins.
        .rev()
        .max_by_key(|w| u64::from(w.info.width) * u64::from(w.info.height))
        .map(|w| w.info)
}

/// A fully transparent capture: an invisible overlay rather than a real window.
fn is_blank(image: &RgbaImage) -> bool {
    image.pixels().all(|p| p[3] == 0)
}

fn encode_png(image: &RgbaImage) -> Result<Vec<u8>, String> {
    let mut png = std::io::Cursor::new(Vec::new());
    image
        .write_to(&mut png, xcap::image::ImageFormat::Png)
        .map_err(|e| format!("PNG encoding failed: {e}"))?;
    Ok(png.into_inner())
}

/// Level of every on-screen window, by window id (kCGWindowNumber → kCGWindowLayer).
#[cfg(target_os = "macos")]
fn window_levels() -> std::collections::HashMap<u32, i32> {
    use objc2_core_foundation::{CFDictionary, CFNumber, CFNumberType, CFString};
    use objc2_core_graphics::{CGWindowListCopyWindowInfo, CGWindowListOption};

    // SAFETY: CoreFoundation reads on the array returned by CGWindowListCopyWindowInfo,
    // which stays alive for the whole loop; missing keys are checked for null.
    unsafe fn number(dict: &CFDictionary, key: &str) -> Option<i32> {
        let key = CFString::from_str(key);
        let value = unsafe { dict.value((key.as_ref() as *const CFString).cast()) };
        if value.is_null() {
            return None;
        }
        let mut out: i32 = 0;
        let ok = unsafe {
            (*(value as *const CFNumber)).value(
                CFNumberType::IntType,
                &mut out as *mut i32 as *mut std::ffi::c_void,
            )
        };
        ok.then_some(out)
    }

    let mut levels = std::collections::HashMap::new();
    let options =
        CGWindowListOption::OptionOnScreenOnly | CGWindowListOption::ExcludeDesktopElements;
    let Some(array) = CGWindowListCopyWindowInfo(options, 0) else {
        return levels;
    };
    for i in 0..array.count() {
        let dict = unsafe { array.value_at_index(i) } as *const CFDictionary;
        if dict.is_null() {
            continue;
        }
        let dict = unsafe { &*dict };
        if let (Some(id), Some(layer)) = unsafe {
            (
                number(dict, "kCGWindowNumber"),
                number(dict, "kCGWindowLayer"),
            )
        } {
            levels.insert(id as u32, layer);
        }
    }
    levels
}

#[cfg(not(target_os = "macos"))]
fn window_levels() -> std::collections::HashMap<u32, i32> {
    std::collections::HashMap::new()
}

/// Reads one window. A window missing from `levels` counts as not normal.
fn read_window(
    w: &xcap::Window,
    levels: &std::collections::HashMap<u32, i32>,
) -> xcap::XCapResult<RawWindow> {
    let id = w.id()?;
    let default_level = if cfg!(target_os = "macos") {
        i32::MAX
    } else {
        0
    };
    Ok(RawWindow {
        layer: levels.get(&id).copied().unwrap_or(default_level),
        info: WindowInfo {
            id,
            app_name: w.app_name()?,
            title: w.title()?,
            width: w.width()?,
            height: w.height()?,
        },
        pid: w.pid()?,
        minimized: w.is_minimized()?,
    })
}

#[tauri::command]
pub async fn list_windows() -> Result<Vec<WindowInfo>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let windows = xcap::Window::all().map_err(|e| e.to_string())?;
        // A window that vanished while being listed is skipped, not an error.
        let levels = window_levels();
        let raw = windows
            .iter()
            .filter_map(|w| read_window(w, &levels).ok())
            .collect();
        Ok(pickable_windows(raw, std::process::id()))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(target_os = "macos")]
#[link(name = "CoreGraphics", kind = "framework")]
unsafe extern "C" {
    fn CGPreflightScreenCaptureAccess() -> bool;
    fn CGRequestScreenCaptureAccess() -> bool;
}

/// Whether the Screen Recording permission is granted. Without it, macOS only
/// lists system windows. On first denial, asks macOS to show its prompt once.
#[tauri::command]
pub fn ensure_screen_capture_access() -> bool {
    #[cfg(target_os = "macos")]
    // SAFETY: plain CoreGraphics calls without arguments (macOS 10.15+).
    unsafe {
        CGPreflightScreenCaptureAccess() || CGRequestScreenCaptureAccess()
    }
    #[cfg(not(target_os = "macos"))]
    true
}

#[tauri::command]
pub fn open_screen_capture_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture")
        .status()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Captures window `id` as a base64 PNG. macOS only lists windows of the current
/// desktop (Space), so the window must be on it.
fn capture_png(id: u32) -> Result<String, String> {
    let windows = xcap::Window::all().map_err(|e| e.to_string())?;
    let window = windows
        .iter()
        .find(|w| w.id().ok() == Some(id))
        .ok_or("This window is not on the current desktop any more.")?;
    let image = window.capture_image().map_err(|e| {
        format!("Capture failed ({e}). Check that ScreenForge has the Screen Recording permission.")
    })?;
    if is_blank(&image) {
        return Err("The captured window is empty (fully transparent).".into());
    }
    Ok(base64::engine::general_purpose::STANDARD.encode(encode_png(&image)?))
}

#[tauri::command]
pub async fn capture_window(id: u32) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || capture_png(id))
        .await
        .map_err(|e| e.to_string())?
}

/// A capture made by the global shortcut, sent to the front as an event.
#[derive(Debug, Clone, Serialize)]
pub struct ShortcutCapture {
    pub window: WindowInfo,
    pub png_base64: String,
}

/// Captures the window in front on the current desktop, without switching desktop.
pub fn capture_frontmost() -> Result<ShortcutCapture, String> {
    let windows = xcap::Window::all().map_err(|e| e.to_string())?;
    let levels = window_levels();
    let raw = windows
        .iter()
        .filter_map(|w| read_window(w, &levels).ok())
        .collect();
    let window = frontmost_window(raw, std::process::id()).ok_or(
        "No window to capture on this desktop. Check that ScreenForge has the Screen Recording permission.",
    )?;
    let png_base64 = capture_png(window.id)?;
    Ok(ShortcutCapture { window, png_base64 })
}

#[cfg(test)]
mod tests {
    use super::*;
    use xcap::image::{ImageFormat, Rgba};

    fn raw(id: u32, app: &str, title: &str, pid: u32) -> RawWindow {
        RawWindow {
            info: WindowInfo {
                id,
                app_name: app.into(),
                title: title.into(),
                width: 800,
                height: 600,
            },
            pid,
            minimized: false,
            layer: 0,
        }
    }

    fn at_layer(mut w: RawWindow, layer: i32) -> RawWindow {
        w.layer = layer;
        w
    }

    fn ids(windows: &[WindowInfo]) -> Vec<u32> {
        windows.iter().map(|w| w.id).collect()
    }

    #[test]
    fn sorts_by_app_then_title_ignoring_case() {
        let windows = pickable_windows(
            vec![
                raw(1, "Safari", "b", 10),
                raw(2, "code", "main.rs", 11),
                raw(3, "Safari", "A", 10),
            ],
            99,
        );
        assert_eq!(ids(&windows), [2, 3, 1]);
    }

    #[test]
    fn drops_own_minimized_tiny_and_unnamed_windows() {
        let mut minimized = raw(4, "Mail", "Inbox", 12);
        minimized.minimized = true;
        let mut tiny = raw(5, "Slack", "badge", 13);
        tiny.info.width = 20;
        let windows = pickable_windows(
            vec![
                raw(1, "ScreenForge", "ScreenForge", 99),
                raw(3, "", "", 15),
                minimized,
                tiny,
                raw(6, "Simulator", "iPhone 17", 16),
            ],
            99,
        );
        assert_eq!(ids(&windows), [6]);
    }

    #[test]
    fn drops_windows_above_the_normal_level_whatever_their_name() {
        // Menu bar, Dock, widgets and the transparent screenshot overlay are not
        // at level 0; their names are localized ("Centre de notifications").
        let windows = pickable_windows(
            vec![
                at_layer(raw(1, "Window Server", "Menubar", 14), 24),
                at_layer(raw(2, "Centre de notifications", "Mois", 15), 23),
                at_layer(raw(3, "Capture d’écran", "", 16), 1000),
                raw(4, "Safari", "Login", 10),
            ],
            99,
        );
        assert_eq!(ids(&windows), [4]);
    }

    #[test]
    fn keeps_windows_without_a_title() {
        // Without the Screen Recording permission, macOS hides every title.
        assert_eq!(
            ids(&pickable_windows(vec![raw(1, "Safari", "", 10)], 99)),
            [1]
        );
    }

    #[test]
    fn frontmost_is_the_first_pickable_window_in_os_order() {
        // The OS lists windows front to back.
        let front = frontmost_window(
            vec![
                at_layer(raw(1, "Capture d’écran", "", 16), 1000),
                raw(2, "ScreenForge", "ScreenForge", 99),
                raw(3, "Safari", "Login", 10),
                raw(4, "Code", "main.rs", 11),
            ],
            99,
        );
        assert_eq!(front.map(|w| w.id), Some(3));
    }

    #[test]
    fn frontmost_is_the_largest_window_of_the_app_in_front() {
        // Full-screen Chrome, as listed by macOS: transparent tab-strip overlays
        // stacked in front of the real window.
        let sized = |id, w, h, pid| {
            let mut win = raw(id, "Google Chrome", "", pid);
            win.info.width = w;
            win.info.height = h;
            win
        };
        let front = frontmost_window(
            vec![
                sized(15482, 1470, 81, 10),
                sized(15484, 1470, 158, 10),
                sized(15479, 1470, 801, 10),
                raw(20, "Terminal", "zsh", 11),
            ],
            99,
        );
        assert_eq!(front.map(|w| w.id), Some(15479));
    }

    #[test]
    fn no_frontmost_when_only_system_windows_are_visible() {
        // What macOS shows without the Screen Recording permission.
        assert_eq!(
            frontmost_window(
                vec![at_layer(raw(1, "Window Server", "Menubar", 14), 24)],
                99
            ),
            None
        );
    }

    /// Needs a logged-in macOS session: `cargo test -p screenforge -- --ignored`.
    #[cfg(target_os = "macos")]
    #[test]
    #[ignore]
    fn window_levels_sees_normal_and_raised_windows() {
        let levels = window_levels();
        assert!(
            levels.values().any(|&l| l == 0),
            "no normal window: {levels:?}"
        );
        assert!(
            levels.values().any(|&l| l > 0),
            "no menu bar or Dock: {levels:?}"
        );
    }

    #[test]
    fn a_fully_transparent_image_is_blank() {
        assert!(is_blank(&RgbaImage::from_pixel(4, 4, Rgba([0, 0, 0, 0]))));
        let mut one_pixel = RgbaImage::from_pixel(4, 4, Rgba([0, 0, 0, 0]));
        one_pixel.put_pixel(2, 2, Rgba([255, 0, 0, 255]));
        assert!(!is_blank(&one_pixel));
    }

    #[test]
    fn encodes_a_png_that_decodes_to_the_same_pixels() {
        let image = RgbaImage::from_pixel(3, 2, Rgba([255, 0, 0, 255]));
        let png = encode_png(&image).unwrap();
        let decoded = xcap::image::load_from_memory_with_format(&png, ImageFormat::Png)
            .unwrap()
            .to_rgba8();
        assert_eq!(decoded, image);
    }
}
