//! Pure tool logic: reads a project's `.screenforge/` folder and builds tool payloads.
//! The rmcp layer in `server.rs` only wraps these functions.

use std::fs;
use std::io::ErrorKind;
use std::path::Path;

use serde_json::{Map, Value, json};
use sf_core::node::NodeKind;
use sf_core::store::{self, PNG_FILE_NAME, SVG_FILE_NAME, StoreError};

/// Messages shown to the agent. Kept as constants so tests compare them exactly.
pub const MSG_NO_PROJECT: &str = "No ScreenForge project in this folder. Open the folder in ScreenForge and save the canvas first.";
pub const MSG_INVALID_ID: &str = "Invalid node id. Ids only contain letters, digits, '_' and '-'.";
pub const MSG_READ_FAILED: &str = "Could not read the ScreenForge project files.";

#[derive(Debug, PartialEq)]
pub struct ToolError(pub String);

impl From<StoreError> for ToolError {
    fn from(e: StoreError) -> Self {
        match e {
            StoreError::ProjectNotFound(_) => ToolError(MSG_NO_PROJECT.into()),
            StoreError::NodeNotFound(id) => ToolError(format!("Node not found: {id}")),
            StoreError::InvalidNodeId(_) => ToolError(MSG_INVALID_ID.into()),
            other @ (StoreError::Malformed { .. } | StoreError::Io(_)) => {
                // stdout carries the protocol, so diagnostics go to stderr.
                eprintln!("screenforge-mcp: {other}");
                ToolError(MSG_READ_FAILED.into())
            }
        }
    }
}

/// A tool payload: JSON plus an optional PNG, sent as a separate image block.
#[derive(Debug)]
pub struct ToolOutput {
    pub json: Value,
    pub png: Option<Vec<u8>>,
}

/// Every node of the canvas, without renders.
pub fn canvas_snapshot(root: &Path) -> Result<ToolOutput, ToolError> {
    let nodes = store::list_nodes(root)?;
    let mut screens = Vec::new();
    for frame in nodes.iter().filter(|n| n.kind == NodeKind::Frame) {
        let children: Vec<String> = store::node_children(root, &frame.id)?
            .into_iter()
            .map(|n| n.id)
            .collect();
        screens.push(json!({ "id": frame.id, "name": frame.name, "children": children }));
    }
    let png = sf_core::project::load_canvas_png(root)?;
    Ok(ToolOutput {
        json: json!({ "screens": screens, "nodes": nodes }),
        png,
    })
}

/// One node with its SVG (inline) and PNG (separate), in the spec §7 shape.
pub fn node_detail(root: &Path, id: &str) -> Result<ToolOutput, ToolError> {
    let node = store::read_node(root, id)?;
    let dir = store::node_dir(root, id)?;
    let svg = read_optional(&dir.join(SVG_FILE_NAME))?
        .map(|bytes| String::from_utf8_lossy(&bytes).into_owned());
    let png = read_optional(&dir.join(PNG_FILE_NAME))?;

    let mut json = serde_json::to_value(&node).expect("a Node always serializes");
    let fields = json
        .as_object_mut()
        .expect("a Node serializes to an object");
    let colors = fields
        .remove("colors_detected")
        .unwrap_or(Value::Array(vec![]));
    fields.insert(
        "visual_context".into(),
        json!({ "svg": svg, "colors_detected": colors }),
    );
    if node.kind == NodeKind::Frame {
        let children: Vec<Value> = store::node_children(root, id)?
            .into_iter()
            .map(|n| json!({ "id": n.id, "name": n.name, "type": n.kind }))
            .collect();
        fields.insert("children".into(), Value::Array(children));
    }
    Ok(ToolOutput { json, png })
}

fn read_optional(path: &Path) -> Result<Option<Vec<u8>>, ToolError> {
    match fs::read(path) {
        Ok(bytes) => Ok(Some(bytes)),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
        Err(e) => Err(StoreError::Io(e).into()),
    }
}

/// Upstream (nodes linking here) and downstream (links from here) of one node.
pub fn node_dependencies(root: &Path, id: &str) -> Result<Value, ToolError> {
    let deps = store::node_dependencies(root, id)?;
    let upstream: Vec<Value> = deps
        .upstream
        .into_iter()
        .map(|c| {
            let mut link = Map::new();
            link.insert("source_node".into(), c.source_node.into());
            if let Some(t) = c.trigger {
                link.insert("trigger".into(), t.into());
            }
            if let Some(p) = c.payload_type {
                link.insert("payload_type".into(), p.into());
            }
            Value::Object(link)
        })
        .collect();
    Ok(json!({
        "node_id": id,
        "upstream": upstream,
        "downstream": deps.downstream,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use sf_core::node::{Connection, Dimensions, Node, NodeKind};
    use sf_core::store::{PNG_FILE_NAME, SVG_FILE_NAME, node_dir, write_node};
    use std::fs;
    use tempfile::TempDir;

    fn node(id: &str, links: &[(&str, &str)]) -> Node {
        Node {
            id: id.into(),
            kind: NodeKind::Capture,
            name: format!("Node {id}"),
            dimensions: Dimensions {
                width: 240.0,
                height: 48.0,
            },
            position: None,
            parent: None,
            text: None,
            style: None,
            colors_detected: vec!["#3B82F6".into()],
            connections: links
                .iter()
                .map(|(target, trigger)| Connection {
                    target_node: (*target).into(),
                    trigger: Some((*trigger).into()),
                    payload_type: None,
                })
                .collect(),
            user_instructions: format!("Instructions for {id}"),
        }
    }

    fn project_with(nodes: &[Node]) -> TempDir {
        let dir = TempDir::new().unwrap();
        fs::create_dir(sf_core::project_dir(dir.path())).unwrap();
        for n in nodes {
            write_node(dir.path(), n).unwrap();
        }
        dir
    }

    #[test]
    fn snapshot_lists_all_nodes_sorted() {
        let p = project_with(&[node("b", &[("a", "onClick")]), node("a", &[])]);
        let snap = canvas_snapshot(p.path()).unwrap().json;
        let ids: Vec<_> = snap["nodes"]
            .as_array()
            .unwrap()
            .iter()
            .map(|n| n["id"].as_str().unwrap())
            .collect();
        assert_eq!(ids, ["a", "b"]);
        assert_eq!(snap["nodes"][1]["connections"][0]["target_node"], "a");
    }

    #[test]
    fn snapshot_of_empty_project_has_no_nodes() {
        let p = project_with(&[]);
        let snap = canvas_snapshot(p.path()).unwrap();
        assert_eq!(snap.json, json!({ "screens": [], "nodes": [] }));
        assert_eq!(snap.png, None);
    }

    fn placed(id: &str, kind: NodeKind, parent: Option<&str>, x: f64, y: f64) -> Node {
        let mut n = node(id, &[]);
        n.kind = kind;
        n.name = format!("Name of {id}");
        n.parent = parent.map(str::to_string);
        n.position = Some(sf_core::node::Position { x, y });
        n
    }

    #[test]
    fn snapshot_lists_screens_with_children_in_reading_order() {
        let p = project_with(&[
            placed("login", NodeKind::Frame, None, 0.0, 0.0),
            placed(
                "submit",
                NodeKind::VectorDrawing,
                Some("login"),
                20.0,
                400.0,
            ),
            placed("title", NodeKind::VectorDrawing, Some("login"), 20.0, 30.0),
            placed("stray", NodeKind::Capture, None, 900.0, 0.0),
        ]);
        assert_eq!(
            canvas_snapshot(p.path()).unwrap().json["screens"],
            json!([{ "id": "login", "name": "Name of login", "children": ["title", "submit"] }])
        );
    }

    #[test]
    fn snapshot_carries_the_canvas_render() {
        let p = project_with(&[node("a", &[])]);
        sf_core::project::write_canvas_png(p.path(), Some(&[7, 7])).unwrap();
        assert_eq!(canvas_snapshot(p.path()).unwrap().png, Some(vec![7, 7]));
    }

    #[test]
    fn detail_of_a_frame_lists_its_children() {
        let p = project_with(&[
            placed("login", NodeKind::Frame, None, 0.0, 0.0),
            placed("title", NodeKind::VectorDrawing, Some("login"), 20.0, 30.0),
        ]);
        assert_eq!(
            node_detail(p.path(), "login").unwrap().json["children"],
            json!([{ "id": "title", "name": "Name of title", "type": "vector_drawing" }])
        );
        assert!(
            node_detail(p.path(), "title")
                .unwrap()
                .json
                .get("children")
                .is_none()
        );
    }

    #[test]
    fn detail_follows_spec_shape_with_inline_svg() {
        let p = project_with(&[node("btn", &[("modal", "onSuccess")])]);
        let dir = node_dir(p.path(), "btn").unwrap();
        fs::write(dir.join(SVG_FILE_NAME), "<svg><rect/></svg>").unwrap();

        let detail = node_detail(p.path(), "btn").unwrap();
        assert_eq!(
            detail.json,
            json!({
                "id": "btn",
                "type": "capture",
                "name": "Node btn",
                "dimensions": { "width": 240.0, "height": 48.0 },
                "visual_context": {
                    "svg": "<svg><rect/></svg>",
                    "colors_detected": ["#3B82F6"]
                },
                "connections": [{ "target_node": "modal", "trigger": "onSuccess" }],
                "user_instructions": "Instructions for btn"
            })
        );
        assert_eq!(detail.png, None);
    }

    #[test]
    fn detail_returns_png_bytes_and_null_svg_when_absent() {
        let p = project_with(&[node("cap", &[])]);
        let png = vec![0x89, b'P', b'N', b'G'];
        fs::write(node_dir(p.path(), "cap").unwrap().join(PNG_FILE_NAME), &png).unwrap();

        let detail = node_detail(p.path(), "cap").unwrap();
        assert_eq!(detail.png, Some(png));
        assert_eq!(detail.json["visual_context"]["svg"], Value::Null);
    }

    #[test]
    fn dependencies_report_both_directions() {
        let p = project_with(&[
            node("form", &[("validator", "onSubmit")]),
            node("validator", &[("success", "onValid")]),
            node("success", &[]),
        ]);
        assert_eq!(
            node_dependencies(p.path(), "validator").unwrap(),
            json!({
                "node_id": "validator",
                "upstream": [{ "source_node": "form", "trigger": "onSubmit" }],
                "downstream": [{ "target_node": "success", "trigger": "onValid" }]
            })
        );
    }

    #[test]
    fn missing_project_gives_a_clear_message() {
        let empty = TempDir::new().unwrap();
        assert_eq!(
            canvas_snapshot(empty.path()).unwrap_err(),
            ToolError(MSG_NO_PROJECT.into())
        );
    }

    #[test]
    fn missing_node_names_the_id() {
        let p = project_with(&[]);
        assert_eq!(
            node_detail(p.path(), "ghost").unwrap_err(),
            ToolError("Node not found: ghost".into())
        );
        assert_eq!(
            node_dependencies(p.path(), "ghost").unwrap_err(),
            ToolError("Node not found: ghost".into())
        );
    }

    #[test]
    fn unsafe_id_is_rejected_without_touching_the_disk() {
        let p = project_with(&[]);
        assert_eq!(
            node_detail(p.path(), "../../etc").unwrap_err(),
            ToolError(MSG_INVALID_ID.into())
        );
    }

    #[test]
    fn malformed_file_gives_generic_message() {
        let p = project_with(&[]);
        let dir = node_dir(p.path(), "bad").unwrap();
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join(sf_core::store::NODE_FILE_NAME), "{").unwrap();
        assert_eq!(
            node_detail(p.path(), "bad").unwrap_err(),
            ToolError(MSG_READ_FAILED.into())
        );
    }
}
