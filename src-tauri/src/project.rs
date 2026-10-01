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

/// The latest read of the canvas by an agent, as recorded by `screenforge-mcp`.
#[tauri::command]
pub fn last_agent_read(root: PathBuf) -> Option<sf_core::reads::AgentRead> {
    sf_core::reads::read_last_read(&root)
}

#[tauri::command]
pub fn get_last_project(app: tauri::AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_config_dir().ok()?;
    app_state::read_last_project(&dir)
}

/// A recent project as the home screen shows it.
#[derive(Debug, PartialEq, serde::Serialize)]
pub struct RecentProjectDto {
    pub path: PathBuf,
    /// The folder's own name.
    pub name: String,
    /// The path with the home folder written `~`.
    pub display: String,
    pub opened_ms: u64,
}

fn recent_dtos(config_dir: &std::path::Path, home: Option<&std::path::Path>) -> Vec<RecentProjectDto> {
    app_state::read_recent_projects(config_dir)
        .into_iter()
        .map(|r| RecentProjectDto {
            name: app_state::project_name(&r.path),
            display: app_state::display_path(&r.path, home),
            opened_ms: r.opened_ms,
            path: r.path,
        })
        .collect()
}

/// Opening `root` makes it the project the MCP server falls back to, and the first recent one.
fn remember_project(config_dir: &std::path::Path, root: &std::path::Path) -> std::io::Result<()> {
    app_state::record_opened_project(config_dir, root, sf_core::reads::now_ms())
}

#[tauri::command]
pub fn set_last_project(app: tauri::AppHandle, root: PathBuf) -> Result<(), String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    remember_project(&dir, &root).map_err(|e| e.to_string())
}

/// Projects opened recently, newest first, for the home screen.
#[tauri::command]
pub fn recent_projects(app: tauri::AppHandle) -> Vec<RecentProjectDto> {
    let Ok(dir) = app.path().app_config_dir() else {
        return vec![];
    };
    let home = std::env::var_os("HOME").map(PathBuf::from);
    recent_dtos(&dir, home.as_deref())
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
    fn reports_the_last_agent_read_in_the_shape_the_front_reads() {
        let dir = std::env::temp_dir().join(format!("sf-read-{}", std::process::id()));
        std::fs::create_dir_all(sf_core::project_dir(&dir)).unwrap();
        assert_eq!(last_agent_read(dir.clone()), None);
        let read = sf_core::reads::AgentRead {
            at_ms: 1_700_000_000_000,
            tool: "get_canvas_snapshot".into(),
            client: Some("claude-code".into()),
            nodes: 8,
            with_instructions: 4,
        };
        sf_core::reads::write_last_read(&dir, &read).unwrap();
        let value = serde_json::to_value(last_agent_read(dir.clone()).unwrap()).unwrap();
        assert_eq!(
            value,
            json!({ "at_ms": 1_700_000_000_000u64, "tool": "get_canvas_snapshot", "client": "claude-code", "nodes": 8, "with_instructions": 4 })
        );
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn opening_a_project_lists_it_for_the_home_screen_in_the_shape_the_front_reads() {
        let base = std::env::temp_dir().join(format!("sf-recent-{}", std::process::id()));
        let config = base.join("config");
        let home = base.join("home");
        let project = home.join("dev").join("acme-dashboard");
        std::fs::create_dir_all(&project).unwrap();
        assert_eq!(recent_dtos(&config, Some(&home)), vec![]);
        remember_project(&config, &project).unwrap();
        let list = recent_dtos(&config, Some(&home));
        assert_eq!(list.len(), 1);
        let value = serde_json::to_value(&list[0]).unwrap();
        assert_eq!(value["name"], "acme-dashboard");
        assert_eq!(value["display"], "~/dev/acme-dashboard");
        assert_eq!(value["path"], project.to_string_lossy().as_ref());
        assert!(value["opened_ms"].as_u64().unwrap() > 1_700_000_000_000);
        // The file the MCP server reads is kept in step.
        assert_eq!(app_state::read_last_project(&config), Some(project));
        std::fs::remove_dir_all(&base).unwrap();
    }

    #[test]
    fn no_png_stays_none() {
        assert_eq!(to_export(dto(None)).unwrap().png, None);
    }
}
