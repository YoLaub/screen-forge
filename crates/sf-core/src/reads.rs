//! The last time an agent read the canvas.
//!
//! `screenforge-mcp` records it after each successful tool call and the app shows it
//! (title bar, Connect AI). Only the latest read is kept, in one small file replaced
//! atomically, so it never grows and a reader never sees half a write.

use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::project_dir;
use crate::store::StoreError;

pub const LAST_READ_FILE_NAME: &str = "last_read.json";

/// One read of the canvas by an agent, as shown in the app.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentRead {
    /// Unix time in milliseconds.
    pub at_ms: u64,
    /// MCP tool that was called.
    pub tool: String,
    /// The agent, as its MCP client names itself ("claude-code"...), when it says.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub client: Option<String>,
    /// How many nodes the answer showed the agent.
    pub nodes: usize,
    /// How many of those have instructions for the agent.
    pub with_instructions: usize,
}

/// Current time as Unix milliseconds.
pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_millis() as u64)
}

/// Records `read` as the project's latest. Never creates the project folder: a read of
/// a project that has no canvas yet is not recorded.
pub fn write_last_read(root: &Path, read: &AgentRead) -> Result<(), StoreError> {
    let dir = project_dir(root);
    if !dir.is_dir() {
        return Err(StoreError::ProjectNotFound(dir));
    }
    let path = dir.join(LAST_READ_FILE_NAME);
    // One temp file per process: Claude Code and Claude Desktop can both be reading.
    let tmp = dir.join(format!("{LAST_READ_FILE_NAME}.{}.tmp", std::process::id()));
    let json = serde_json::to_vec(read).expect("an AgentRead always serializes");
    fs::write(&tmp, json)?;
    if let Err(e) = fs::rename(&tmp, &path) {
        let _ = fs::remove_file(&tmp);
        return Err(e.into());
    }
    Ok(())
}

/// The latest recorded read, or None when there is none or the file is unreadable.
pub fn read_last_read(root: &Path) -> Option<AgentRead> {
    let bytes = fs::read(project_dir(root).join(LAST_READ_FILE_NAME)).ok()?;
    serde_json::from_slice(&bytes).ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::StoreError;
    use std::fs;
    use tempfile::TempDir;

    fn project() -> TempDir {
        let dir = TempDir::new().unwrap();
        fs::create_dir(crate::project_dir(dir.path())).unwrap();
        dir
    }

    fn read(tool: &str, at_ms: u64) -> AgentRead {
        AgentRead {
            at_ms,
            tool: tool.into(),
            client: Some("claude-code".into()),
            nodes: 8,
            with_instructions: 4,
        }
    }

    #[test]
    fn nothing_is_recorded_before_the_first_read() {
        assert_eq!(read_last_read(project().path()), None);
    }

    #[test]
    fn round_trips_the_last_read() {
        let dir = project();
        write_last_read(dir.path(), &read("get_canvas_snapshot", 1_700_000_000_000)).unwrap();
        assert_eq!(
            read_last_read(dir.path()),
            Some(read("get_canvas_snapshot", 1_700_000_000_000))
        );
    }

    #[test]
    fn keeps_only_the_latest_read() {
        let dir = project();
        write_last_read(dir.path(), &read("get_canvas_snapshot", 1)).unwrap();
        write_last_read(dir.path(), &read("get_node_detail", 2)).unwrap();
        assert_eq!(read_last_read(dir.path()), Some(read("get_node_detail", 2)));
    }

    #[test]
    fn a_missing_client_is_fine_and_not_written() {
        let dir = project();
        let anonymous = AgentRead {
            client: None,
            ..read("get_node_detail", 5)
        };
        write_last_read(dir.path(), &anonymous).unwrap();
        let text = fs::read_to_string(crate::project_dir(dir.path()).join(LAST_READ_FILE_NAME)).unwrap();
        assert!(!text.contains("client"), "{text}");
        assert_eq!(read_last_read(dir.path()), Some(anonymous));
    }

    #[test]
    fn a_corrupt_or_incomplete_file_reads_as_nothing() {
        let dir = project();
        let path = crate::project_dir(dir.path()).join(LAST_READ_FILE_NAME);
        fs::write(&path, "{ not json").unwrap();
        assert_eq!(read_last_read(dir.path()), None);
        fs::write(&path, r#"{"tool":"get_canvas_snapshot"}"#).unwrap();
        assert_eq!(read_last_read(dir.path()), None);
    }

    #[test]
    fn never_creates_the_project_folder() {
        let dir = TempDir::new().unwrap();
        let err = write_last_read(dir.path(), &read("get_canvas_snapshot", 1)).unwrap_err();
        assert!(matches!(err, StoreError::ProjectNotFound(_)), "{err:?}");
        assert!(!crate::project_dir(dir.path()).exists());
    }

    #[test]
    fn leaves_no_temporary_file_behind() {
        let dir = project();
        write_last_read(dir.path(), &read("get_canvas_snapshot", 1)).unwrap();
        let names: Vec<_> = fs::read_dir(crate::project_dir(dir.path()))
            .unwrap()
            .map(|e| e.unwrap().file_name().into_string().unwrap())
            .collect();
        assert_eq!(names, vec![LAST_READ_FILE_NAME.to_string()]);
    }

    #[test]
    fn the_clock_is_unix_milliseconds() {
        // Any date after 2023 in ms is above this; seconds would be far below it.
        assert!(now_ms() > 1_700_000_000_000);
    }
}
