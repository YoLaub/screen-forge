//! Saving an exported image in the format and quality the user chose.

use std::path::PathBuf;

use base64::Engine;
use image::{ImageEncoder, RgbaImage};
use serde::Deserialize;

#[derive(Clone, Copy, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Format {
    Png,
    Jpg,
    Webp,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Quality {
    Low,
    Medium,
    High,
}

impl Quality {
    /// Encoder quality, 1 to 100.
    fn value(self) -> u8 {
        match self {
            Quality::Low => 50,
            Quality::Medium => 75,
            Quality::High => 92,
        }
    }
}

/// `png` re-encoded as `format`. PNG is kept as it is, and `quality` is ignored for it.
pub fn encode(png: &[u8], format: Format, quality: Quality) -> Result<Vec<u8>, String> {
    if format == Format::Png {
        return Ok(png.to_vec());
    }
    let decoded = image::load_from_memory_with_format(png, image::ImageFormat::Png)
        .map_err(|e| format!("the export is not a valid PNG: {e}"))?
        .to_rgba8();
    match format {
        Format::Png => unreachable!("handled above"),
        Format::Jpg => encode_jpg(&decoded, quality),
        Format::Webp => Ok(webp::Encoder::from_rgba(decoded.as_raw(), decoded.width(), decoded.height())
            .encode(f32::from(quality.value()))
            .to_vec()),
    }
}

/// JPG has no transparency: the image is laid over white, like a sheet of paper.
fn encode_jpg(image: &RgbaImage, quality: Quality) -> Result<Vec<u8>, String> {
    let mut rgb = Vec::with_capacity(image.pixels().len() * 3);
    for p in image.pixels() {
        let alpha = u32::from(p[3]);
        for channel in &p.0[..3] {
            // Blend with white: c * a + 255 * (1 - a).
            rgb.push(((u32::from(*channel) * alpha + 255 * (255 - alpha)) / 255) as u8);
        }
    }
    let mut out = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, quality.value())
        .write_image(&rgb, image.width(), image.height(), image::ExtendedColorType::Rgb8)
        .map_err(|e| format!("JPG encoding failed: {e}"))?;
    Ok(out)
}

/// Writes the export (a base64 PNG from the canvas) to `path` in the chosen format.
#[tauri::command]
pub fn export_image(path: PathBuf, png_base64: String, format: Format, quality: Quality) -> Result<(), String> {
    let png = base64::engine::general_purpose::STANDARD
        .decode(png_base64)
        .map_err(|e| format!("invalid image for the export: {e}"))?;
    let bytes = encode(&png, format, quality)?;
    std::fs::write(&path, bytes).map_err(|e| format!("could not write {}: {e}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn png_of(image: &RgbaImage) -> Vec<u8> {
        let mut out = std::io::Cursor::new(Vec::new());
        image.write_to(&mut out, image::ImageFormat::Png).unwrap();
        out.into_inner()
    }

    /// Noise that compresses badly, so that quality shows in the file size.
    fn noisy() -> RgbaImage {
        RgbaImage::from_fn(96, 96, |x, y| {
            let v = x.wrapping_mul(2654435761).wrapping_add(y.wrapping_mul(40503)).wrapping_mul(2246822519) >> 7;
            image::Rgba([v as u8, (v >> 3) as u8, (v >> 5) as u8, 255])
        })
    }

    #[test]
    fn png_is_kept_byte_for_byte() {
        let png = png_of(&noisy());
        assert_eq!(encode(&png, Format::Png, Quality::Low).unwrap(), png);
    }

    #[test]
    fn jpg_starts_with_the_jpeg_marker() {
        let out = encode(&png_of(&noisy()), Format::Jpg, Quality::High).unwrap();
        assert_eq!(&out[..2], &[0xFF, 0xD8]);
    }

    #[test]
    fn webp_is_a_riff_webp_file() {
        let out = encode(&png_of(&noisy()), Format::Webp, Quality::High).unwrap();
        assert_eq!(&out[..4], b"RIFF");
        assert_eq!(&out[8..12], b"WEBP");
    }

    #[test]
    fn lower_quality_gives_smaller_files() {
        let png = png_of(&noisy());
        for format in [Format::Jpg, Format::Webp] {
            let low = encode(&png, format, Quality::Low).unwrap().len();
            let medium = encode(&png, format, Quality::Medium).unwrap().len();
            let high = encode(&png, format, Quality::High).unwrap().len();
            assert!(low < medium && medium < high, "{format:?}: {low} {medium} {high}");
        }
    }

    #[test]
    fn jpg_lays_transparent_pixels_over_white() {
        let clear = RgbaImage::from_pixel(16, 16, image::Rgba([0, 0, 0, 0]));
        let out = encode(&png_of(&clear), Format::Jpg, Quality::High).unwrap();
        let back = image::load_from_memory_with_format(&out, image::ImageFormat::Jpeg).unwrap().to_rgb8();
        assert!(back.get_pixel(8, 8).0.iter().all(|&c| c >= 250), "{:?}", back.get_pixel(8, 8));
    }

    #[test]
    fn webp_keeps_the_size() {
        let out = encode(&png_of(&noisy()), Format::Webp, Quality::Medium).unwrap();
        let back = webp::Decoder::new(&out).decode().unwrap();
        assert_eq!((back.width(), back.height()), (96, 96));
    }

    #[test]
    fn rejects_bytes_that_are_not_a_png() {
        assert!(encode(&[1, 2, 3], Format::Jpg, Quality::High).is_err());
    }

    #[test]
    fn invalid_base64_writes_nothing() {
        let path = std::env::temp_dir().join(format!("sf-export-bad-{}.jpg", std::process::id()));
        assert!(export_image(path.clone(), "not base64!".into(), Format::Jpg, Quality::High).is_err());
        assert!(!path.exists());
    }

    #[test]
    fn writes_the_file_the_user_chose() {
        let dir = std::env::temp_dir().join(format!("sf-export-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("shot.jpg");
        let b64 = base64::engine::general_purpose::STANDARD.encode(png_of(&noisy()));
        export_image(path.clone(), b64, Format::Jpg, Quality::Medium).unwrap();
        assert_eq!(&std::fs::read(&path).unwrap()[..2], &[0xFF, 0xD8]);
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
