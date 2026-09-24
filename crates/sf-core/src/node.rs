//! Node model: the metadata of one canvas node, stored as `nodes/<id>/node.json`.
//!
//! Field names follow spec §7. The SVG and PNG renders live next to `node.json`
//! as separate files, so they are not part of this struct.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Node {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: NodeKind,
    pub name: String,
    pub dimensions: Dimensions,
    /// Top-left corner in canvas coordinates. Absent in files saved before layout existed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub position: Option<Position>,
    /// Id of the frame that contains this node, if any.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent: Option<String>,
    /// Content of a text element, readable by the agent without OCR.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(default)]
    pub colors_detected: Vec<String>,
    #[serde(default)]
    pub connections: Vec<Connection>,
    #[serde(default)]
    pub user_instructions: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NodeKind {
    Capture,
    VectorDrawing,
    /// A named screen: the nodes placed inside it are its children.
    Frame,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Dimensions {
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

/// An outgoing link from the owning node to `target_node`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Connection {
    pub target_node: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub trigger: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payload_type: Option<String>,
}

/// Node ids become folder names, so they are restricted to `[A-Za-z0-9_-]{1,128}`.
pub fn is_valid_node_id(id: &str) -> bool {
    (1..=128).contains(&id.len())
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn sample() -> Node {
        Node {
            id: "btn_custom_submit".into(),
            kind: NodeKind::VectorDrawing,
            name: "Submit button with loader".into(),
            dimensions: Dimensions {
                width: 240.0,
                height: 48.0,
            },
            position: None,
            parent: None,
            text: None,
            colors_detected: vec!["#3B82F6".into(), "#FFFFFF".into()],
            connections: vec![Connection {
                target_node: "modal_success".into(),
                trigger: Some("onSuccess".into()),
                payload_type: Some("ApiResponse<User>".into()),
            }],
            user_instructions: "Blue gradient, spinner on click.".into(),
        }
    }

    #[test]
    fn serializes_with_spec_field_names() {
        let value = serde_json::to_value(sample()).unwrap();
        assert_eq!(
            value,
            json!({
                "id": "btn_custom_submit",
                "type": "vector_drawing",
                "name": "Submit button with loader",
                "dimensions": { "width": 240.0, "height": 48.0 },
                "colors_detected": ["#3B82F6", "#FFFFFF"],
                "connections": [{
                    "target_node": "modal_success",
                    "trigger": "onSuccess",
                    "payload_type": "ApiResponse<User>"
                }],
                "user_instructions": "Blue gradient, spinner on click."
            })
        );
    }

    #[test]
    fn round_trips_through_json() {
        let json = serde_json::to_string(&sample()).unwrap();
        assert_eq!(serde_json::from_str::<Node>(&json).unwrap(), sample());
    }

    #[test]
    fn optional_fields_default_when_absent() {
        let node: Node = serde_json::from_value(json!({
            "id": "cap_1",
            "type": "capture",
            "name": "Login error",
            "dimensions": { "width": 10, "height": 20 },
            "connections": [{ "target_node": "cap_2" }]
        }))
        .unwrap();
        assert!(node.colors_detected.is_empty());
        assert_eq!(node.user_instructions, "");
        assert_eq!(node.connections[0].trigger, None);
        assert_eq!(node.connections[0].payload_type, None);
    }

    #[test]
    fn frames_carry_position_and_children_point_to_them() {
        let frame = Node {
            id: "frm_login".into(),
            kind: NodeKind::Frame,
            name: "Login screen".into(),
            dimensions: Dimensions {
                width: 800.0,
                height: 500.0,
            },
            position: Some(Position { x: -40.0, y: 10.5 }),
            parent: None,
            text: None,
            colors_detected: vec![],
            connections: vec![],
            user_instructions: String::new(),
        };
        let value = serde_json::to_value(&frame).unwrap();
        assert_eq!(value["type"], "frame");
        assert_eq!(value["position"], json!({ "x": -40.0, "y": 10.5 }));
        assert!(
            value.get("parent").is_none(),
            "no parent key when top-level"
        );

        let mut child = sample();
        child.parent = Some("frm_login".into());
        assert_eq!(serde_json::to_value(&child).unwrap()["parent"], "frm_login");
    }

    #[test]
    fn node_files_saved_before_layout_existed_still_load() {
        let node: Node = serde_json::from_value(json!({
            "id": "cap_1", "type": "capture", "name": "Old",
            "dimensions": { "width": 1, "height": 1 }
        }))
        .unwrap();
        assert_eq!(node.position, None);
        assert_eq!(node.parent, None);
    }

    #[test]
    fn text_nodes_carry_their_text_and_others_omit_it() {
        let mut label = sample();
        label.text = Some("Connexion".into());
        assert_eq!(serde_json::to_value(&label).unwrap()["text"], "Connexion");
        assert!(
            serde_json::to_value(sample())
                .unwrap()
                .get("text")
                .is_none()
        );
        let old: Node = serde_json::from_value(json!({
            "id": "vec_1", "type": "vector_drawing", "name": "Old",
            "dimensions": { "width": 1, "height": 1 }
        }))
        .unwrap();
        assert_eq!(old.text, None);
    }

    #[test]
    fn accepts_safe_ids() {
        assert!(is_valid_node_id("btn_custom-submit_2"));
    }

    #[test]
    fn rejects_ids_that_could_escape_the_nodes_folder() {
        for id in [
            "",
            "..",
            "../etc",
            "a/b",
            "a\\b",
            "a.b",
            "é",
            &"x".repeat(129),
        ] {
            assert!(!is_valid_node_id(id), "{id:?} should be rejected");
        }
    }
}
