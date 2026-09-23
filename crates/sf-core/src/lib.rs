//! ScreenForge project-folder format and node model.
//!
//! The app writes a project's canvas under `<project root>/.screenforge/`; the MCP
//! server only ever reads it. This crate is the single owner of that layout.

pub mod node;
pub mod project;
pub mod store;

use std::path::{Path, PathBuf};

/// Name of the folder that holds a project's canvas data.
pub const PROJECT_DIR_NAME: &str = ".screenforge";

/// Returns the canvas-data folder of the project rooted at `root`.
pub fn project_dir(root: &Path) -> PathBuf {
    root.join(PROJECT_DIR_NAME)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn project_dir_is_dot_screenforge_under_root() {
        let root = Path::new("/work/my-app");
        assert_eq!(
            project_dir(root),
            PathBuf::from("/work/my-app/.screenforge")
        );
    }
}
