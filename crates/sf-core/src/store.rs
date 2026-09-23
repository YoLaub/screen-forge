//! Reads and writes nodes under `<project root>/.screenforge/nodes/<id>/node.json`.
//!
//! The app writes while `screenforge-mcp` may be reading, so every write goes to a
//! temporary file first and is then renamed into place: a reader sees either the
//! old file or the new one, never a half-written one.

use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use crate::node::{Connection, Node, is_valid_node_id};
use crate::project_dir;

pub const NODES_DIR_NAME: &str = "nodes";
pub const NODE_FILE_NAME: &str = "node.json";
/// Vector render of a node, written by the app next to `node.json`.
pub const SVG_FILE_NAME: &str = "export.svg";
/// Bitmap render of a node, written by the app next to `node.json`.
pub const PNG_FILE_NAME: &str = "image.png";

#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error("no ScreenForge project at {0}")]
    ProjectNotFound(PathBuf),
    #[error("node not found: {0}")]
    NodeNotFound(String),
    #[error("invalid node id: {0:?}")]
    InvalidNodeId(String),
    #[error("malformed node file {path}: {source}")]
    Malformed {
        path: PathBuf,
        source: serde_json::Error,
    },
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

/// A link pointing at a node, seen from that node.
#[derive(Debug, Clone, PartialEq)]
pub struct IncomingConnection {
    pub source_node: String,
    pub trigger: Option<String>,
    pub payload_type: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Dependencies {
    /// Nodes that link to this node, sorted by source id.
    pub upstream: Vec<IncomingConnection>,
    /// Links from this node, in stored order.
    pub downstream: Vec<Connection>,
}

/// Folder holding the files of node `id`. Fails on ids that are not safe folder names.
pub fn node_dir(root: &Path, id: &str) -> Result<PathBuf, StoreError> {
    if !is_valid_node_id(id) {
        return Err(StoreError::InvalidNodeId(id.to_string()));
    }
    Ok(nodes_dir(root).join(id))
}

pub(crate) fn nodes_dir(root: &Path) -> PathBuf {
    project_dir(root).join(NODES_DIR_NAME)
}

fn ensure_project(root: &Path) -> Result<(), StoreError> {
    let dir = project_dir(root);
    if dir.is_dir() {
        Ok(())
    } else {
        Err(StoreError::ProjectNotFound(dir))
    }
}

fn parse_node_file(path: &Path) -> Result<Node, StoreError> {
    let bytes = fs::read(path)?;
    serde_json::from_slice(&bytes).map_err(|source| StoreError::Malformed {
        path: path.to_path_buf(),
        source,
    })
}

pub fn write_node(root: &Path, node: &Node) -> Result<(), StoreError> {
    let dir = node_dir(root, &node.id)?;
    fs::create_dir_all(&dir)?;
    let json = serde_json::to_vec_pretty(node).expect("a Node always serializes");
    write_atomic(&dir.join(NODE_FILE_NAME), &json)
}

/// Writes `bytes` to a sibling temp file, then renames it over `path`.
pub(crate) fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), StoreError> {
    let mut tmp = path.as_os_str().to_owned();
    tmp.push(".tmp");
    fs::write(&tmp, bytes)?;
    fs::rename(&tmp, path)?;
    Ok(())
}

pub(crate) fn remove_file_if_exists(path: &Path) -> Result<(), StoreError> {
    match fs::remove_file(path) {
        Err(e) if e.kind() != ErrorKind::NotFound => Err(e.into()),
        _ => Ok(()),
    }
}

pub fn read_node(root: &Path, id: &str) -> Result<Node, StoreError> {
    let path = node_dir(root, id)?.join(NODE_FILE_NAME);
    ensure_project(root)?;
    match parse_node_file(&path) {
        Err(StoreError::Io(e)) if e.kind() == ErrorKind::NotFound => {
            Err(StoreError::NodeNotFound(id.to_string()))
        }
        other => other,
    }
}

/// All nodes of the project, sorted by id.
pub fn list_nodes(root: &Path) -> Result<Vec<Node>, StoreError> {
    ensure_project(root)?;
    let entries = match fs::read_dir(nodes_dir(root)) {
        Ok(entries) => entries,
        Err(e) if e.kind() == ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(e.into()),
    };
    let mut nodes = Vec::new();
    for entry in entries {
        let path = entry?.path().join(NODE_FILE_NAME);
        if path.is_file() {
            nodes.push(parse_node_file(&path)?);
        }
    }
    nodes.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(nodes)
}

pub fn node_dependencies(root: &Path, id: &str) -> Result<Dependencies, StoreError> {
    let node = read_node(root, id)?;
    let upstream = list_nodes(root)?
        .into_iter()
        .flat_map(|source| {
            source
                .connections
                .into_iter()
                .filter(|c| c.target_node == id)
                .map(move |c| IncomingConnection {
                    source_node: source.id.clone(),
                    trigger: c.trigger,
                    payload_type: c.payload_type,
                })
        })
        .collect();
    Ok(Dependencies {
        upstream,
        downstream: node.connections,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::node::{Dimensions, NodeKind};
    use tempfile::TempDir;

    fn node(id: &str, links: &[&str]) -> Node {
        Node {
            id: id.into(),
            kind: NodeKind::Capture,
            name: format!("Node {id}"),
            dimensions: Dimensions {
                width: 100.0,
                height: 50.0,
            },
            colors_detected: vec![],
            connections: links
                .iter()
                .map(|t| Connection {
                    target_node: (*t).into(),
                    trigger: Some("onClick".into()),
                    payload_type: None,
                })
                .collect(),
            user_instructions: String::new(),
        }
    }

    fn project() -> TempDir {
        let dir = TempDir::new().unwrap();
        fs::create_dir(project_dir(dir.path())).unwrap();
        dir
    }

    #[test]
    fn node_dir_is_under_nodes_folder() {
        let root = Path::new("/work/app");
        assert_eq!(
            node_dir(root, "cap_1").unwrap(),
            PathBuf::from("/work/app/.screenforge/nodes/cap_1")
        );
    }

    #[test]
    fn node_dir_rejects_unsafe_id() {
        assert!(matches!(
            node_dir(Path::new("/work/app"), "../secrets"),
            Err(StoreError::InvalidNodeId(_))
        ));
    }

    #[test]
    fn written_node_reads_back_identical() {
        let p = project();
        let n = node("cap_1", &["cap_2"]);
        write_node(p.path(), &n).unwrap();
        assert_eq!(read_node(p.path(), "cap_1").unwrap(), n);
    }

    #[test]
    fn write_creates_missing_folders() {
        let p = TempDir::new().unwrap();
        write_node(p.path(), &node("cap_1", &[])).unwrap();
        assert!(
            node_dir(p.path(), "cap_1")
                .unwrap()
                .join(NODE_FILE_NAME)
                .is_file()
        );
    }

    #[test]
    fn rewrite_replaces_content_and_leaves_no_temp_file() {
        let p = project();
        write_node(p.path(), &node("cap_1", &[])).unwrap();
        let mut updated = node("cap_1", &[]);
        updated.user_instructions = "Fix the red border".into();
        write_node(p.path(), &updated).unwrap();

        assert_eq!(read_node(p.path(), "cap_1").unwrap(), updated);
        let entries: Vec<_> = fs::read_dir(node_dir(p.path(), "cap_1").unwrap())
            .unwrap()
            .map(|e| e.unwrap().file_name())
            .collect();
        assert_eq!(entries, vec![NODE_FILE_NAME]);
    }

    #[test]
    fn write_rejects_unsafe_id() {
        let p = project();
        assert!(matches!(
            write_node(p.path(), &node("../x", &[])),
            Err(StoreError::InvalidNodeId(_))
        ));
    }

    #[test]
    fn read_distinguishes_missing_project_from_missing_node() {
        let empty = TempDir::new().unwrap();
        assert!(matches!(
            read_node(empty.path(), "cap_1"),
            Err(StoreError::ProjectNotFound(_))
        ));
        let p = project();
        assert!(matches!(
            read_node(p.path(), "cap_1"),
            Err(StoreError::NodeNotFound(id)) if id == "cap_1"
        ));
    }

    #[test]
    fn read_reports_malformed_file() {
        let p = project();
        let dir = node_dir(p.path(), "cap_1").unwrap();
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join(NODE_FILE_NAME), "{ not json").unwrap();
        assert!(matches!(
            read_node(p.path(), "cap_1"),
            Err(StoreError::Malformed { .. })
        ));
    }

    #[test]
    fn list_fails_without_project_and_is_empty_without_nodes() {
        let empty = TempDir::new().unwrap();
        assert!(matches!(
            list_nodes(empty.path()),
            Err(StoreError::ProjectNotFound(_))
        ));
        assert_eq!(list_nodes(project().path()).unwrap(), vec![]);
    }

    #[test]
    fn list_returns_nodes_sorted_by_id() {
        let p = project();
        for id in ["b", "c", "a"] {
            write_node(p.path(), &node(id, &[])).unwrap();
        }
        let ids: Vec<_> = list_nodes(p.path())
            .unwrap()
            .into_iter()
            .map(|n| n.id)
            .collect();
        assert_eq!(ids, ["a", "b", "c"]);
    }

    #[test]
    fn list_skips_node_folders_without_node_file() {
        // A folder can exist before its node.json is renamed into place.
        let p = project();
        write_node(p.path(), &node("a", &[])).unwrap();
        fs::create_dir_all(node_dir(p.path(), "pending").unwrap()).unwrap();
        let ids: Vec<_> = list_nodes(p.path())
            .unwrap()
            .into_iter()
            .map(|n| n.id)
            .collect();
        assert_eq!(ids, ["a"]);
    }

    #[test]
    fn dependencies_list_incoming_and_outgoing_links() {
        let p = project();
        write_node(p.path(), &node("form", &["validator"])).unwrap();
        write_node(p.path(), &node("login", &["validator"])).unwrap();
        write_node(p.path(), &node("validator", &["success"])).unwrap();
        write_node(p.path(), &node("success", &[])).unwrap();

        let deps = node_dependencies(p.path(), "validator").unwrap();
        let sources: Vec<_> = deps
            .upstream
            .iter()
            .map(|c| c.source_node.as_str())
            .collect();
        assert_eq!(sources, ["form", "login"]);
        assert_eq!(deps.upstream[0].trigger.as_deref(), Some("onClick"));
        let targets: Vec<_> = deps
            .downstream
            .iter()
            .map(|c| c.target_node.as_str())
            .collect();
        assert_eq!(targets, ["success"]);
    }

    #[test]
    fn dependencies_of_missing_node_is_not_found() {
        let p = project();
        assert!(matches!(
            node_dependencies(p.path(), "ghost"),
            Err(StoreError::NodeNotFound(_))
        ));
    }
}
