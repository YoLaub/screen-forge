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
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Dimensions {
    pub width: f64,
    pub height: f64,
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
