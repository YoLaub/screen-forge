//! Tauri commands for opening and saving a project. Storage logic lives in sf-core.

use std::path::PathBuf;

use base64::Engine;
use serde::Deserialize;
use sf_core::app_state;
use sf_core::node::Node;
use sf_core::project::{self, NodeExport};
use tauri::Manager;

/// A node as sent by the front: the PNG arrives base64-encoded over IPC.
#[derive(Debug, Deserialize)]
pub struct NodeExportDto {
    pub node: Node,
    pub svg: Option<String>,
    pub png_base64: Option<String>,
}

fn decode_png(b64: Option<String>, what: &str) -> Result<Option<Vec<u8>>, String> {
    b64.map(|b64| base64::engine::general_purpose::STANDARD.decode(b64))
        .transpose()
        .map_err(|e| format!("invalid PNG for {what}: {e}"))
}

fn to_export(dto: NodeExportDto) -> Result<NodeExport, String> {
    let png = decode_png(dto.png_base64, &format!("node {}", dto.node.id))?;
    Ok(NodeExport {
        node: dto.node,
        svg: dto.svg,
        png,
    })
}

#[tauri::command]
pub fn save_canvas(
    root: PathBuf,
    canvas_json: String,
    canvas_png_base64: Option<String>,
    nodes: Vec<NodeExportDto>,
) -> Result<(), String> {
    let exports = nodes
        .into_iter()
        .map(to_export)
        .collect::<Result<Vec<_>, _>>()?;
    let canvas_png = decode_png(canvas_png_base64, "the canvas")?;
    project::save_project(&root, &canvas_json, &exports).map_err(|e| e.to_string())?;
    project::write_canvas_png(&root, canvas_png.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_canvas(root: PathBuf) -> Result<Option<String>, String> {
    project::load_canvas(&root).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_last_project(app: tauri::AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_config_dir().ok()?;
    app_state::read_last_project(&dir)
}

#[tauri::command]
pub fn set_last_project(app: tauri::AppHandle, root: PathBuf) -> Result<(), String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    app_state::write_last_project(&dir, &root).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn dto(png_base64: Option<&str>) -> NodeExportDto {
        serde_json::from_value(json!({
            "node": {
                "id": "cap_1", "type": "capture", "name": "Capture 1",
                "dimensions": { "width": 1, "height": 1 }
            },
            "svg": null,
            "png_base64": png_base64
        }))
        .unwrap()
    }

    #[test]
    fn decodes_png_from_base64() {
        let export = to_export(dto(Some("AQID"))).unwrap();
        assert_eq!(export.png, Some(vec![1, 2, 3]));
        assert_eq!(export.node.id, "cap_1");
    }

    #[test]
    fn decode_png_names_what_failed() {
        assert_eq!(decode_png(None, "the canvas"), Ok(None));
        assert_eq!(
            decode_png(Some("AQID".into()), "the canvas"),
            Ok(Some(vec![1, 2, 3]))
        );
        let err = decode_png(Some("not base64!".into()), "the canvas").unwrap_err();
        assert!(err.starts_with("invalid PNG for the canvas"), "{err}");
    }

    #[test]
    fn rejects_invalid_base64() {
        assert!(to_export(dto(Some("not base64!"))).is_err());
    }

    #[test]
    fn no_png_stays_none() {
        assert_eq!(to_export(dto(None)).unwrap().png, None);
    }
}
