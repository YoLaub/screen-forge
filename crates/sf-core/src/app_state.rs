//! State the app shares with `screenforge-mcp`: which project is open in ScreenForge.

use std::fs;
use std::path::{Path, PathBuf};

use crate::project_dir;

/// Bundle identifier of the app; its config folder is named after it.
pub const APP_IDENTIFIER: &str = "dev.screenforge.desktop";
const LAST_PROJECT_FILE: &str = "last_project";

/// The app's config folder, as Tauri resolves it on macOS
/// (`~/Library/Application Support/<identifier>`).
pub fn app_config_dir() -> Option<PathBuf> {
    let home = std::env::var_os("HOME")?;
    Some(
        PathBuf::from(home)
            .join("Library/Application Support")
            .join(APP_IDENTIFIER),
    )
}

/// The project last opened in ScreenForge, if its folder still exists.
pub fn read_last_project(config_dir: &Path) -> Option<PathBuf> {
    let path = PathBuf::from(fs::read_to_string(config_dir.join(LAST_PROJECT_FILE)).ok()?);
    path.is_dir().then_some(path)
}

pub fn write_last_project(config_dir: &Path, root: &Path) -> std::io::Result<()> {
    fs::create_dir_all(config_dir)?;
    fs::write(
        config_dir.join(LAST_PROJECT_FILE),
        root.to_string_lossy().as_bytes(),
    )
}

/// The project an MCP server serves: its working directory when that is a
/// ScreenForge project (Claude Code starts servers in the project folder),
/// otherwise the project open in ScreenForge (Claude Desktop has no project
/// folder), otherwise the working directory.
pub fn resolve_project(cwd: &Path, last_project: Option<PathBuf>) -> PathBuf {
    if project_dir(cwd).is_dir() {
        return cwd.to_path_buf();
    }
    last_project.unwrap_or_else(|| cwd.to_path_buf())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn last_project_round_trips_and_creates_the_config_dir() {
        let tmp = TempDir::new().unwrap();
        let config = tmp.path().join("config");
        assert_eq!(read_last_project(&config), None);
        let project = tmp.path().join("my app");
        fs::create_dir(&project).unwrap();
        write_last_project(&config, &project).unwrap();
        assert_eq!(read_last_project(&config), Some(project));
    }

    #[test]
    fn last_project_that_no_longer_exists_is_ignored() {
        let tmp = TempDir::new().unwrap();
        let project = tmp.path().join("gone");
        fs::create_dir(&project).unwrap();
        write_last_project(tmp.path(), &project).unwrap();
        fs::remove_dir(&project).unwrap();
        assert_eq!(read_last_project(tmp.path()), None);
    }

    #[test]
    fn working_directory_wins_when_it_is_a_project() {
        let tmp = TempDir::new().unwrap();
        fs::create_dir(project_dir(tmp.path())).unwrap();
        let open = tmp.path().join("other");
        assert_eq!(resolve_project(tmp.path(), Some(open)), tmp.path());
    }

    #[test]
    fn falls_back_to_the_project_open_in_screenforge() {
        let tmp = TempDir::new().unwrap();
        let open = tmp.path().join("open");
        assert_eq!(resolve_project(Path::new("/"), Some(open.clone())), open);
    }

    #[test]
    fn keeps_the_working_directory_when_nothing_is_open() {
        assert_eq!(
            resolve_project(Path::new("/work"), None),
            Path::new("/work")
        );
    }

    #[test]
    fn config_dir_is_named_after_the_bundle_identifier() {
        let dir = app_config_dir().unwrap();
        assert!(dir.ends_with("Library/Application Support/dev.screenforge.desktop"));
    }
}
