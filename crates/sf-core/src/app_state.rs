//! State the app shares with `screenforge-mcp`: which project is open in ScreenForge,
//! and the projects opened recently (only the app reads the list).

use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::{Deserialize, Serialize};

use crate::project_dir;

/// Bundle identifier of the app; its config folder is named after it.
pub const APP_IDENTIFIER: &str = "dev.screenforge.desktop";
const LAST_PROJECT_FILE: &str = "last_project";
const RECENT_FILE: &str = "recent_projects.json";
/// How many recent projects are kept.
pub const MAX_RECENT: usize = 10;

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

/// A project opened in ScreenForge, for the home screen's Recent list.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RecentProject {
    pub path: PathBuf,
    /// When it was last opened, in Unix milliseconds.
    pub opened_ms: u64,
}

fn read_recent_file(config_dir: &Path) -> Option<Vec<RecentProject>> {
    serde_json::from_slice(&fs::read(config_dir.join(RECENT_FILE)).ok()?).ok()
}

/// What older versions kept: only the last project, dated by its file.
fn migrated_last_project(config_dir: &Path) -> Vec<RecentProject> {
    let file = config_dir.join(LAST_PROJECT_FILE);
    let opened_ms = fs::metadata(&file)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map_or(0, |d| d.as_millis() as u64);
    read_last_project(config_dir)
        .map(|path| vec![RecentProject { path, opened_ms }])
        .unwrap_or_default()
}

/// Recently opened projects, newest first. Folders that no longer exist are left out.
/// Without a list yet (first run of this version) the single last project of older
/// versions stands in for it.
pub fn read_recent_projects(config_dir: &Path) -> Vec<RecentProject> {
    let mut list = read_recent_file(config_dir).unwrap_or_else(|| migrated_last_project(config_dir));
    list.retain(|r| r.path.is_dir());
    list
}

/// Notes that `root` was opened at `at_ms`: it becomes the first recent project and the
/// "last project" the MCP server falls back to. Missing folders are forgotten here.
pub fn record_opened_project(config_dir: &Path, root: &Path, at_ms: u64) -> std::io::Result<()> {
    let mut list = read_recent_projects(config_dir);
    list.retain(|r| r.path != root);
    list.insert(0, RecentProject { path: root.to_path_buf(), opened_ms: at_ms });
    list.truncate(MAX_RECENT);
    write_last_project(config_dir, root)?;
    let target = config_dir.join(RECENT_FILE);
    let tmp = config_dir.join(format!("{RECENT_FILE}.{}.tmp", std::process::id()));
    fs::write(&tmp, serde_json::to_vec(&list).expect("a recent list always serializes"))?;
    fs::rename(&tmp, target).inspect_err(|_| {
        let _ = fs::remove_file(&tmp);
    })
}

/// `path` for display: the home folder written `~`.
pub fn display_path(path: &Path, home: Option<&Path>) -> String {
    if let Some(rest) = home.and_then(|h| path.strip_prefix(h).ok()) {
        return if rest.as_os_str().is_empty() {
            "~".to_string()
        } else {
            format!("~/{}", rest.display())
        };
    }
    path.display().to_string()
}

/// The folder's own name, which names the project.
pub fn project_name(path: &Path) -> String {
    path.file_name()
        .map_or_else(|| path.display().to_string(), |n| n.to_string_lossy().into_owned())
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

    // --- recent projects ---

    fn folder(tmp: &TempDir, name: &str) -> PathBuf {
        let path = tmp.path().join(name);
        fs::create_dir_all(&path).unwrap();
        path
    }

    fn paths(list: &[RecentProject]) -> Vec<&Path> {
        list.iter().map(|r| r.path.as_path()).collect()
    }

    #[test]
    fn a_fresh_install_has_no_recent_projects() {
        let tmp = TempDir::new().unwrap();
        assert_eq!(read_recent_projects(&tmp.path().join("config")), vec![]);
    }

    #[test]
    fn opening_a_project_puts_it_first_and_remembers_when() {
        let tmp = TempDir::new().unwrap();
        let (a, b) = (folder(&tmp, "a"), folder(&tmp, "b"));
        record_opened_project(tmp.path(), &a, 1_000).unwrap();
        record_opened_project(tmp.path(), &b, 2_000).unwrap();
        assert_eq!(
            read_recent_projects(tmp.path()),
            vec![
                RecentProject { path: b, opened_ms: 2_000 },
                RecentProject { path: a, opened_ms: 1_000 },
            ]
        );
    }

    #[test]
    fn reopening_moves_a_project_to_the_front_without_duplicating_it() {
        let tmp = TempDir::new().unwrap();
        let (a, b) = (folder(&tmp, "a"), folder(&tmp, "b"));
        record_opened_project(tmp.path(), &a, 1).unwrap();
        record_opened_project(tmp.path(), &b, 2).unwrap();
        record_opened_project(tmp.path(), &a, 3).unwrap();
        let list = read_recent_projects(tmp.path());
        assert_eq!(paths(&list), vec![a.as_path(), b.as_path()]);
        assert_eq!(list[0].opened_ms, 3);
    }

    #[test]
    fn the_same_folder_spelled_with_a_trailing_slash_is_the_same_project() {
        let tmp = TempDir::new().unwrap();
        let a = folder(&tmp, "a");
        record_opened_project(tmp.path(), &a, 1).unwrap();
        record_opened_project(tmp.path(), &PathBuf::from(format!("{}/", a.display())), 2).unwrap();
        assert_eq!(read_recent_projects(tmp.path()).len(), 1);
    }

    #[test]
    fn keeps_only_the_latest_ones() {
        let tmp = TempDir::new().unwrap();
        for n in 0..MAX_RECENT + 3 {
            record_opened_project(tmp.path(), &folder(&tmp, &format!("p{n}")), n as u64).unwrap();
        }
        let list = read_recent_projects(tmp.path());
        assert_eq!(list.len(), MAX_RECENT);
        assert_eq!(list[0].opened_ms, (MAX_RECENT + 2) as u64);
        assert_eq!(list.last().unwrap().opened_ms, 3);
    }

    #[test]
    fn folders_that_no_longer_exist_are_left_out_and_forgotten_on_the_next_open() {
        let tmp = TempDir::new().unwrap();
        let (a, b, c) = (folder(&tmp, "a"), folder(&tmp, "b"), folder(&tmp, "c"));
        record_opened_project(tmp.path(), &a, 1).unwrap();
        record_opened_project(tmp.path(), &b, 2).unwrap();
        fs::remove_dir(&a).unwrap();
        assert_eq!(paths(&read_recent_projects(tmp.path())), vec![b.as_path()]);
        record_opened_project(tmp.path(), &c, 3).unwrap();
        fs::create_dir(&a).unwrap(); // it comes back, but was forgotten
        assert_eq!(paths(&read_recent_projects(tmp.path())), vec![c.as_path(), b.as_path()]);
    }

    #[test]
    fn the_single_last_project_of_an_older_version_becomes_the_first_recent_one() {
        let tmp = TempDir::new().unwrap();
        let a = folder(&tmp, "a");
        write_last_project(tmp.path(), &a).unwrap(); // what the app used to write, and nothing else
        let list = read_recent_projects(tmp.path());
        assert_eq!(paths(&list), vec![a.as_path()]);
        assert!(list[0].opened_ms > 1_700_000_000_000, "the file's own date is used: {}", list[0].opened_ms);
    }

    #[test]
    fn the_migrated_project_joins_the_list_when_the_next_one_is_opened() {
        let tmp = TempDir::new().unwrap();
        let (a, b) = (folder(&tmp, "a"), folder(&tmp, "b"));
        write_last_project(tmp.path(), &a).unwrap();
        record_opened_project(tmp.path(), &b, 5).unwrap();
        assert_eq!(paths(&read_recent_projects(tmp.path())), vec![b.as_path(), a.as_path()]);
    }

    #[test]
    fn a_corrupt_list_falls_back_to_the_last_project() {
        let tmp = TempDir::new().unwrap();
        let a = folder(&tmp, "a");
        write_last_project(tmp.path(), &a).unwrap();
        fs::write(tmp.path().join(RECENT_FILE), "{ not json").unwrap();
        assert_eq!(paths(&read_recent_projects(tmp.path())), vec![a.as_path()]);
    }

    #[test]
    fn opening_a_project_keeps_the_last_project_file_the_mcp_server_reads() {
        let tmp = TempDir::new().unwrap();
        let a = folder(&tmp, "a");
        record_opened_project(tmp.path(), &a, 1).unwrap();
        assert_eq!(read_last_project(tmp.path()), Some(a));
    }

    #[test]
    fn leaves_no_temporary_file_behind() {
        let tmp = TempDir::new().unwrap();
        record_opened_project(tmp.path(), &folder(&tmp, "a"), 1).unwrap();
        let mut names: Vec<_> = fs::read_dir(tmp.path())
            .unwrap()
            .map(|e| e.unwrap().file_name().into_string().unwrap())
            .filter(|n| n.ends_with(".tmp"))
            .collect();
        names.sort();
        assert_eq!(names, Vec::<String>::new());
    }

    #[test]
    fn display_path_abbreviates_the_home_folder() {
        let home = Path::new("/Users/me");
        assert_eq!(display_path(Path::new("/Users/me/dev/acme"), Some(home)), "~/dev/acme");
        assert_eq!(display_path(Path::new("/Users/me"), Some(home)), "~");
        assert_eq!(display_path(Path::new("/Volumes/work/acme"), Some(home)), "/Volumes/work/acme");
        assert_eq!(display_path(Path::new("/Users/me2/acme"), Some(home)), "/Users/me2/acme");
        assert_eq!(display_path(Path::new("/Users/me/dev"), None), "/Users/me/dev");
    }

    #[test]
    fn project_name_is_the_last_folder() {
        assert_eq!(project_name(Path::new("/Users/me/dev/acme-dashboard")), "acme-dashboard");
        assert_eq!(project_name(Path::new("/")), "/");
    }
}
