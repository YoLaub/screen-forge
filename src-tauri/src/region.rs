//! Region capture: cutting a rectangle or a hand-drawn outline out of a screen shot.

use image::{Rgba, RgbaImage};
use serde::Deserialize;

/// Smallest side, in pixels, of a region worth keeping.
const MIN_SIDE: u32 = 4;

#[derive(Clone, Copy, Debug, Deserialize, PartialEq)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

/// What the user drew, in logical pixels from the top left of the screen.
#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Shape {
    Rect { x: f64, y: f64, w: f64, h: f64 },
    Path { points: Vec<Point> },
}

/// Pixel box `[left, top, right, bottom)` of the drawn points, kept inside the image.
fn pixel_box(points: &[(f64, f64)], scale: f64, image: &RgbaImage) -> Result<(u32, u32, u32, u32), String> {
    let (mut x0, mut y0, mut x1, mut y1) = (f64::MAX, f64::MAX, f64::MIN, f64::MIN);
    for &(x, y) in points {
        x0 = x0.min(x);
        y0 = y0.min(y);
        x1 = x1.max(x);
        y1 = y1.max(y);
    }
    let clamp = |v: f64, max: u32| (v * scale).round().clamp(0.0, f64::from(max)) as u32;
    let (left, top) = (clamp(x0, image.width()), clamp(y0, image.height()));
    let (right, bottom) = (clamp(x1, image.width()), clamp(y1, image.height()));
    if right.saturating_sub(left) < MIN_SIDE || bottom.saturating_sub(top) < MIN_SIDE {
        return Err("The selected area is too small.".into());
    }
    Ok((left, top, right, bottom))
}

/// Even-odd rule: whether `(px, py)` is inside the polygon.
fn inside(polygon: &[(f64, f64)], px: f64, py: f64) -> bool {
    let mut in_poly = false;
    let mut j = polygon.len() - 1;
    for i in 0..polygon.len() {
        let (xi, yi) = polygon[i];
        let (xj, yj) = polygon[j];
        if (yi > py) != (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi {
            in_poly = !in_poly;
        }
        j = i;
    }
    in_poly
}

/// The part of `image` the user drew around. `scale` is pixels per logical pixel (2 on a
/// Retina screen). A rectangle keeps everything inside it; an outline keeps the box that
/// surrounds it but leaves what lies outside the outline transparent.
pub fn extract(image: &RgbaImage, shape: &Shape, scale: f64) -> Result<RgbaImage, String> {
    match shape {
        Shape::Rect { x, y, w, h } => {
            let (l, t, r, b) = pixel_box(&[(*x, *y), (x + w, y + h)], scale, image)?;
            Ok(image::imageops::crop_imm(image, l, t, r - l, b - t).to_image())
        }
        Shape::Path { points } => {
            if points.len() < 3 {
                return Err("Draw a closed outline around the area to capture.".into());
            }
            let scaled: Vec<(f64, f64)> = points.iter().map(|p| (p.x * scale, p.y * scale)).collect();
            let logical: Vec<(f64, f64)> = points.iter().map(|p| (p.x, p.y)).collect();
            let (l, t, r, b) = pixel_box(&logical, scale, image)?;
            let mut out = image::imageops::crop_imm(image, l, t, r - l, b - t).to_image();
            for (px, py, pixel) in out.enumerate_pixels_mut() {
                if !inside(&scaled, f64::from(l + px) + 0.5, f64::from(t + py) + 0.5) {
                    *pixel = Rgba([0, 0, 0, 0]);
                }
            }
            Ok(out)
        }
    }
}

use std::sync::Mutex;

use base64::Engine;
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, WebviewUrl};

use crate::capture::{ShortcutCapture, WindowInfo};

const OVERLAY_LABEL: &str = "region";

/// The frozen screen shot the user is drawing on.
struct Session {
    image: RgbaImage,
    /// Pixels per logical pixel.
    scale: f64,
}

#[derive(Default)]
pub struct RegionSession(Mutex<Option<Session>>);

#[cfg(target_os = "macos")]
tauri_nspanel::tauri_panel! {
    panel!(RegionPanel {
        config: {
            can_become_key_window: true,
            is_floating_panel: true
        }
    })
}

/// Logical frame `(x, y, w, h)` of the screen under the cursor, else the main one.
fn screen_under_cursor(app: &AppHandle) -> Result<(f64, f64, f64, f64), String> {
    let at = app.cursor_position().map_err(|e| e.to_string())?;
    let monitor = app
        .monitor_from_point(at.x, at.y)
        .map_err(|e| e.to_string())?
        .or(app.primary_monitor().map_err(|e| e.to_string())?)
        .ok_or("No screen found.")?;
    let scale = monitor.scale_factor();
    let (pos, size) = (monitor.position(), monitor.size());
    Ok((
        f64::from(pos.x) / scale,
        f64::from(pos.y) / scale,
        f64::from(size.width) / scale,
        f64::from(size.height) / scale,
    ))
}

/// Shot of the xcap monitor whose top left is closest to `(x, y)` (logical).
fn shoot(x: f64, y: f64) -> Result<RgbaImage, String> {
    let monitors = xcap::Monitor::all().map_err(|e| e.to_string())?;
    let monitor = monitors
        .iter()
        .min_by_key(|m| {
            let (mx, my) = (m.x().unwrap_or(i32::MAX / 2), m.y().unwrap_or(i32::MAX / 2));
            ((f64::from(mx) - x).abs() + (f64::from(my) - y).abs()) as i64
        })
        .ok_or("No screen found.")?;
    monitor.capture_image().map_err(|e| {
        format!("Capture failed ({e}). Check that ScreenForge has the Screen Recording permission.")
    })
}

fn show_pill(app: &AppHandle) {
    if let Some(pill) = app.get_webview_window(crate::pill::PILL_LABEL) {
        let _ = pill.show();
    }
}

/// Closes the overlay. A panel is turned back into a plain window first (the way the panel
/// crate documents it): destroying it as it is makes AppKit abort the app.
fn close_overlay(app: &AppHandle) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        #[cfg(target_os = "macos")]
        {
            use tauri_nspanel::ManagerExt;
            if let Some(window) = handle.get_webview_panel(OVERLAY_LABEL).ok().and_then(|p| p.to_window()) {
                let _ = window.destroy();
            }
        }
        #[cfg(not(target_os = "macos"))]
        if let Some(overlay) = handle.get_webview_window(OVERLAY_LABEL) {
            let _ = overlay.destroy();
        }
        show_pill(&handle);
    });
}

/// Freezes the screen under the cursor and covers it with the drawing overlay.
#[tauri::command]
pub async fn region_begin(app: AppHandle) -> Result<(), String> {
    if !crate::capture::ensure_screen_capture_access() {
        return Err("Screen Recording permission needed. Allow ScreenForge in System Settings, then try again.".into());
    }
    let (x, y, w, h) = screen_under_cursor(&app)?;
    // The pill must not be in the shot.
    if let Some(pill) = app.get_webview_window(crate::pill::PILL_LABEL) {
        let _ = pill.hide();
    }
    tokio_sleep(150).await;
    let image = tauri::async_runtime::spawn_blocking(move || shoot(x, y))
        .await
        .map_err(|e| e.to_string())?
        .inspect_err(|_| show_pill(&app))?;
    let scale = f64::from(image.width()) / w;
    *app.state::<RegionSession>().0.lock().map_err(|e| e.to_string())? = Some(Session { image, scale });
    // AppKit windows must be built on the main thread; this command runs on a worker one.
    on_main_thread(&app, move |app| open_overlay(app, x, y, w, h)).inspect_err(|_| show_pill(&app))
}

/// Runs `f` on the main thread and waits for its result.
fn on_main_thread<T: Send + 'static>(
    app: &AppHandle,
    f: impl FnOnce(&AppHandle) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    let handle = app.clone();
    app.run_on_main_thread(move || {
        let _ = tx.send(f(&handle));
    })
    .map_err(|e| e.to_string())?;
    rx.recv().map_err(|e| e.to_string())?
}

async fn tokio_sleep(ms: u64) {
    let _ = tauri::async_runtime::spawn_blocking(move || std::thread::sleep(std::time::Duration::from_millis(ms))).await;
}

#[cfg(target_os = "macos")]
fn open_overlay(app: &AppHandle, x: f64, y: f64, w: f64, h: f64) -> Result<(), String> {
    use tauri_nspanel::{CollectionBehavior, PanelBuilder, PanelLevel, StyleMask};
    let panel = PanelBuilder::<_, RegionPanel>::new(app, OVERLAY_LABEL)
        .url(WebviewUrl::App("index.html?window=region".into()))
        .title("ScreenForge region")
        .position(LogicalPosition::new(x, y).into())
        .size(LogicalSize::new(w, h).into())
        .with_window(|window| window.decorations(false).resizable(false).shadow(false))
        .add_style_mask(StyleMask::empty().nonactivating_panel())
        .level(PanelLevel::ScreenSaver)
        .collection_behavior(
            CollectionBehavior::new()
                .can_join_all_spaces()
                .full_screen_auxiliary()
                .stationary()
                .ignores_cycle(),
        )
        .has_shadow(false)
        .hides_on_deactivate(false)
        .build()
        .map_err(|e| e.to_string())?;
    panel.show_and_make_key();
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn open_overlay(app: &AppHandle, x: f64, y: f64, w: f64, h: f64) -> Result<(), String> {
    tauri::WebviewWindowBuilder::new(app, OVERLAY_LABEL, WebviewUrl::App("index.html?window=region".into()))
        .position(x, y)
        .inner_size(w, h)
        .decorations(false)
        .resizable(false)
        .always_on_top(true)
        .build()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// The frozen shot, as a base64 JPEG for the overlay to draw on (it is only shown, never saved).
#[tauri::command]
pub fn region_frame(app: AppHandle) -> Result<String, String> {
    use image::ImageEncoder;
    let session = app.state::<RegionSession>();
    let guard = session.0.lock().map_err(|e| e.to_string())?;
    let shot = &guard.as_ref().ok_or("No region capture is in progress.")?.image;
    let rgb: Vec<u8> = shot.pixels().flat_map(|p| [p[0], p[1], p[2]]).collect();
    let mut jpeg = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg, 88)
        .write_image(&rgb, shot.width(), shot.height(), image::ExtendedColorType::Rgb8)
        .map_err(|e| e.to_string())?;
    Ok(base64::engine::general_purpose::STANDARD.encode(jpeg))
}

/// Cuts the drawn area out of the frozen shot and hands it to the canvas like any capture.
#[tauri::command]
pub fn region_finish(app: AppHandle, shape: Shape) -> Result<(), String> {
    let cut = {
        let session = app.state::<RegionSession>();
        let mut guard = session.0.lock().map_err(|e| e.to_string())?;
        let taken = guard.as_ref().ok_or("No region capture is in progress.")?;
        let cut = extract(&taken.image, &shape, taken.scale);
        if cut.is_ok() {
            *guard = None;
        }
        cut
    };
    // A refused area (too small) keeps the overlay open so that the user can draw again.
    let cut = cut?;
    let mut png = std::io::Cursor::new(Vec::new());
    cut.write_to(&mut png, image::ImageFormat::Png).map_err(|e| e.to_string())?;
    let capture = ShortcutCapture {
        window: WindowInfo {
            id: 0,
            app_name: "Screen region".into(),
            title: String::new(),
            width: cut.width(),
            height: cut.height(),
        },
        png_base64: base64::engine::general_purpose::STANDARD.encode(png.into_inner()),
    };
    close_overlay(&app);
    app.emit("shortcut-capture", capture).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn region_cancel(app: AppHandle) {
    if let Ok(mut guard) = app.state::<RegionSession>().0.lock() {
        *guard = None;
    }
    close_overlay(&app);
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 100 x 100 image whose red channel is the column and green channel the row.
    fn grid() -> RgbaImage {
        RgbaImage::from_fn(100, 100, |x, y| Rgba([x as u8, y as u8, 7, 255]))
    }

    fn pt(x: f64, y: f64) -> Point {
        Point { x, y }
    }

    #[test]
    fn a_rectangle_keeps_what_is_inside_it() {
        let out = extract(&grid(), &Shape::Rect { x: 10.0, y: 20.0, w: 30.0, h: 40.0 }, 1.0).unwrap();
        assert_eq!(out.dimensions(), (30, 40));
        assert_eq!(out.get_pixel(0, 0).0, [10, 20, 7, 255]);
        assert_eq!(out.get_pixel(29, 39).0, [39, 59, 7, 255]);
    }

    #[test]
    fn a_retina_screen_has_twice_the_pixels_per_logical_pixel() {
        let out = extract(&grid(), &Shape::Rect { x: 10.0, y: 10.0, w: 20.0, h: 10.0 }, 2.0).unwrap();
        assert_eq!(out.dimensions(), (40, 20));
        assert_eq!(out.get_pixel(0, 0).0, [20, 20, 7, 255]);
    }

    #[test]
    fn a_rectangle_dragged_backwards_is_the_same_rectangle() {
        let forward = extract(&grid(), &Shape::Rect { x: 10.0, y: 10.0, w: 30.0, h: 20.0 }, 1.0).unwrap();
        let backward = extract(&grid(), &Shape::Rect { x: 40.0, y: 30.0, w: -30.0, h: -20.0 }, 1.0).unwrap();
        assert_eq!(forward, backward);
    }

    #[test]
    fn a_rectangle_leaving_the_screen_is_cut_at_its_edge() {
        let out = extract(&grid(), &Shape::Rect { x: 80.0, y: 80.0, w: 50.0, h: 50.0 }, 1.0).unwrap();
        assert_eq!(out.dimensions(), (20, 20));
    }

    #[test]
    fn a_tiny_area_is_refused() {
        let err = extract(&grid(), &Shape::Rect { x: 10.0, y: 10.0, w: 2.0, h: 50.0 }, 1.0).unwrap_err();
        assert_eq!(err, "The selected area is too small.");
    }

    #[test]
    fn an_outline_is_transparent_outside_the_drawing_and_opaque_inside() {
        // A triangle: top left, top right, bottom left of a 40 x 40 box.
        let shape = Shape::Path { points: vec![pt(10.0, 10.0), pt(50.0, 10.0), pt(10.0, 50.0)] };
        let out = extract(&grid(), &shape, 1.0).unwrap();
        assert_eq!(out.dimensions(), (40, 40));
        assert_eq!(out.get_pixel(5, 5).0, [15, 15, 7, 255], "inside");
        assert_eq!(out.get_pixel(35, 35).0[3], 0, "the box corner beyond the long side");
    }

    #[test]
    fn an_outline_works_at_retina_scale() {
        let shape = Shape::Path { points: vec![pt(10.0, 10.0), pt(30.0, 10.0), pt(10.0, 30.0)] };
        let out = extract(&grid(), &shape, 2.0).unwrap();
        assert_eq!(out.dimensions(), (40, 40));
        assert_eq!(out.get_pixel(35, 35).0[3], 0);
        assert_eq!(out.get_pixel(3, 3).0[3], 255);
    }

    #[test]
    fn two_points_do_not_make_an_outline() {
        let shape = Shape::Path { points: vec![pt(1.0, 1.0), pt(50.0, 50.0)] };
        assert!(extract(&grid(), &shape, 1.0).is_err());
    }

    #[test]
    fn a_thin_line_of_points_is_too_small() {
        let shape = Shape::Path { points: vec![pt(10.0, 10.0), pt(60.0, 11.0), pt(10.0, 12.0)] };
        assert!(extract(&grid(), &shape, 1.0).is_err());
    }
}
