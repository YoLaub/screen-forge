//! Whole-project save and load, used by the app on every autosave.
//!
//! A save mirrors the canvas: nodes that are no longer on the canvas lose their
//! folder, so `screenforge-mcp` never serves a deleted node.

use std::fs;
use std::io::ErrorKind;
use std::path::Path;

use crate::node::{Node, is_valid_node_id};
use crate::project_dir;
use crate::store::{
    PNG_FILE_NAME, SVG_FILE_NAME, StoreError, node_dir, nodes_dir, remove_file_if_exists,
    write_atomic, write_node,
};

pub const CANVAS_FILE_NAME: &str = "canvas.json";
/// Render of the whole canvas, for agents that need the overall layout.
pub const CANVAS_PNG_FILE_NAME: &str = "canvas.png";

/// One node as exported by the canvas: metadata plus its renders.
#[derive(Debug, Clone, PartialEq)]
pub struct NodeExport {
    pub node: Node,
    pub svg: Option<String>,
    pub png: Option<Vec<u8>>,
}

/// Writes `canvas.json` and every node folder, then removes folders of nodes
/// that are not in `nodes`. Ids are all checked before anything is written.
pub fn save_project(
    root: &Path,
    canvas_json: &str,
    nodes: &[NodeExport],
) -> Result<(), StoreError> {
    if let Some(bad) = nodes.iter().find(|n| !is_valid_node_id(&n.node.id)) {
        return Err(StoreError::InvalidNodeId(bad.node.id.clone()));
    }
    fs::create_dir_all(project_dir(root))?;
    write_atomic(
        &project_dir(root).join(CANVAS_FILE_NAME),
        canvas_json.as_bytes(),
    )?;

    for export in nodes {
        write_node(root, &export.node)?;
        let dir = node_dir(root, &export.node.id)?;
        match &export.svg {
            Some(svg) => write_atomic(&dir.join(SVG_FILE_NAME), svg.as_bytes())?,
            None => remove_file_if_exists(&dir.join(SVG_FILE_NAME))?,
        }
        match &export.png {
            Some(png) => write_atomic(&dir.join(PNG_FILE_NAME), png)?,
            None => remove_file_if_exists(&dir.join(PNG_FILE_NAME))?,
        }
    }

    let entries = match fs::read_dir(nodes_dir(root)) {
        Ok(entries) => entries,
        Err(e) if e.kind() == ErrorKind::NotFound => return Ok(()),
        Err(e) => return Err(e.into()),
    };
    for entry in entries {
        let entry = entry?;
        let name = entry.file_name();
        let on_canvas = nodes.iter().any(|n| name == n.node.id.as_str());
        if !on_canvas && entry.file_type()?.is_dir() {
            fs::remove_dir_all(entry.path())?;
        }
    }
    Ok(())
}

/// Writes the whole-canvas render, or removes it when the canvas is empty (`None`).
pub fn write_canvas_png(root: &Path, png: Option<&[u8]>) -> Result<(), StoreError> {
    let path = project_dir(root).join(CANVAS_PNG_FILE_NAME);
    match png {
        Some(png) => {
            fs::create_dir_all(project_dir(root))?;
            write_atomic(&path, png)
        }
        None => remove_file_if_exists(&path),
    }
}

/// The whole-canvas render, or `None` when there is none yet.
pub fn load_canvas_png(root: &Path) -> Result<Option<Vec<u8>>, StoreError> {
    match fs::read(project_dir(root).join(CANVAS_PNG_FILE_NAME)) {
        Ok(png) => Ok(Some(png)),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.into()),
    }
}

/// The saved canvas state, or `None` for a folder that has never been saved.
pub fn load_canvas(root: &Path) -> Result<Option<String>, StoreError> {
    match fs::read_to_string(project_dir(root).join(CANVAS_FILE_NAME)) {
        Ok(json) => Ok(Some(json)),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::node::{Dimensions, NodeKind};
    use crate::project_dir;
    use crate::store::{list_nodes, node_dir, read_node};
    use tempfile::TempDir;

    fn export(id: &str, svg: Option<&str>, png: Option<&[u8]>) -> NodeExport {
        NodeExport {
            node: Node {
                id: id.into(),
                kind: NodeKind::VectorDrawing,
                name: format!("Rectangle {id}"),
                dimensions: Dimensions {
                    width: 10.0,
                    height: 10.0,
                },
                position: None,
                parent: None,
                colors_detected: vec![],
                connections: vec![],
                user_instructions: String::new(),
            },
            svg: svg.map(str::to_string),
            png: png.map(<[u8]>::to_vec),
        }
    }

    fn ids(root: &Path) -> Vec<String> {
        list_nodes(root)
            .unwrap()
            .into_iter()
            .map(|n| n.id)
            .collect()
    }

    #[test]
    fn load_of_never_saved_folder_is_none() {
        let dir = TempDir::new().unwrap();
        assert_eq!(load_canvas(dir.path()).unwrap(), None);
    }

    #[test]
    fn saved_canvas_loads_back() {
        let dir = TempDir::new().unwrap();
        save_project(dir.path(), r#"{"objects":[]}"#, &[]).unwrap();
        assert_eq!(
            load_canvas(dir.path()).unwrap().as_deref(),
            Some(r#"{"objects":[]}"#)
        );
    }

    #[test]
    fn save_writes_node_metadata_and_renders() {
        let dir = TempDir::new().unwrap();
        let n = export("rect_1", Some("<svg/>"), Some(&[1, 2, 3]));
        save_project(dir.path(), "{}", std::slice::from_ref(&n)).unwrap();

        assert_eq!(read_node(dir.path(), "rect_1").unwrap(), n.node);
        let folder = node_dir(dir.path(), "rect_1").unwrap();
        assert_eq!(
            fs::read_to_string(folder.join(SVG_FILE_NAME)).unwrap(),
            "<svg/>"
        );
        assert_eq!(fs::read(folder.join(PNG_FILE_NAME)).unwrap(), [1, 2, 3]);
    }

    #[test]
    fn save_removes_nodes_deleted_from_the_canvas() {
        let dir = TempDir::new().unwrap();
        save_project(
            dir.path(),
            "{}",
            &[export("a", None, None), export("b", None, None)],
        )
        .unwrap();
        save_project(dir.path(), "{}", &[export("b", None, None)]).unwrap();
        assert_eq!(ids(dir.path()), ["b"]);
        assert!(!node_dir(dir.path(), "a").unwrap().exists());
    }

    #[test]
    fn save_removes_renders_that_are_no_longer_exported() {
        let dir = TempDir::new().unwrap();
        save_project(dir.path(), "{}", &[export("a", Some("<svg/>"), Some(&[1]))]).unwrap();
        save_project(dir.path(), "{}", &[export("a", None, None)]).unwrap();
        let folder = node_dir(dir.path(), "a").unwrap();
        assert!(!folder.join(SVG_FILE_NAME).exists());
        assert!(!folder.join(PNG_FILE_NAME).exists());
    }

    #[test]
    fn save_with_an_unsafe_id_writes_nothing() {
        let dir = TempDir::new().unwrap();
        let result = save_project(
            dir.path(),
            "{}",
            &[export("ok", None, None), export("../evil", None, None)],
        );
        assert!(matches!(result, Err(StoreError::InvalidNodeId(_))));
        assert!(!project_dir(dir.path()).exists());
    }

    #[test]
    fn canvas_png_is_written_read_and_removed() {
        let dir = TempDir::new().unwrap();
        assert_eq!(load_canvas_png(dir.path()).unwrap(), None);
        write_canvas_png(dir.path(), Some(&[1, 2, 3])).unwrap();
        assert_eq!(load_canvas_png(dir.path()).unwrap(), Some(vec![1, 2, 3]));
        write_canvas_png(dir.path(), None).unwrap();
        assert_eq!(load_canvas_png(dir.path()).unwrap(), None);
    }

    #[test]
    fn save_leaves_unrelated_files_in_the_project_folder() {
        let dir = TempDir::new().unwrap();
        fs::create_dir_all(project_dir(dir.path())).unwrap();
        fs::write(project_dir(dir.path()).join("notes.txt"), "keep").unwrap();
        save_project(dir.path(), "{}", &[]).unwrap();
        assert!(project_dir(dir.path()).join("notes.txt").exists());
    }
}
