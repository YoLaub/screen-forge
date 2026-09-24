//! One-click registration of `screenforge-mcp` in Claude Code and Claude Desktop.
//! Config parsing and merging are pure and tested; the commands only do I/O.

use std::fs;
use std::path::PathBuf;
use std::process::Command;

use serde::Serialize;
use serde_json::{json, Map, Value};

/// Name of the server entry in every client config.
pub const SERVER_NAME: &str = "screenforge";

/// Claude Desktop config with the ScreenForge server set to `command`, keeping
/// every other setting and server. Refuses a file it cannot parse rather than
/// overwriting it.
fn merge_desktop_config(existing: Option<&str>, command: &str) -> Result<String, String> {
    let mut config = match existing.map(str::trim).filter(|s| !s.is_empty()) {
        None => Map::new(),
        Some(text) => match serde_json::from_str::<Value>(text) {
            Ok(Value::Object(map)) => map,
            Ok(_) => return Err("The Claude Desktop config is not a JSON object.".into()),
            Err(e) => return Err(format!("The Claude Desktop config is not valid JSON: {e}")),
        },
    };
    let servers = config
        .entry("mcpServers")
        .or_insert_with(|| Value::Object(Map::new()))
        .as_object_mut()
        .ok_or("`mcpServers` in the Claude Desktop config is not an object.")?;
    servers.insert(
        SERVER_NAME.into(),
        json!({ "command": command, "args": [] }),
    );
    Ok(serde_json::to_string_pretty(&Value::Object(config)).expect("JSON always serializes"))
}

/// Command of the ScreenForge server in a Claude Desktop config or in
/// `~/.claude.json` (user-scope servers), if registered.
fn registered_command(config: &str) -> Option<String> {
    let config: Value = serde_json::from_str(config).ok()?;
    config["mcpServers"][SERVER_NAME]["command"]
        .as_str()
        .map(str::to_string)
}

fn home() -> Result<PathBuf, String> {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| "HOME is not set.".to_string())
}

/// `screenforge-mcp` ships next to the app binary: `Contents/MacOS/` in the
/// bundle, `target/debug/` in development.
fn mcp_binary() -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let bin = exe.with_file_name("screenforge-mcp");
    if bin.is_file() {
        Ok(bin)
    } else {
        Err(format!(
            "The MCP server is missing at {} (in development: cargo build -p sf-mcp).",
            bin.display()
        ))
    }
}

/// The `claude` CLI. Apps started from the Dock do not get the terminal's PATH,
/// so it is looked up through a login shell.
fn claude_cli() -> Option<PathBuf> {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
    let out = Command::new(shell)
        .args(["-lc", "command -v claude"])
        .output()
        .ok()?;
    let path = PathBuf::from(String::from_utf8_lossy(&out.stdout).trim());
    (out.status.success() && path.is_file()).then_some(path)
}

fn claude_code_config() -> Result<PathBuf, String> {
    Ok(home()?.join(".claude.json"))
}

fn claude_desktop_dir() -> Result<PathBuf, String> {
    Ok(home()?.join("Library/Application Support/Claude"))
}

#[derive(Debug, Serialize)]
pub struct ClientStatus {
    /// The client is installed (CLI found, or app folder present).
    pub available: bool,
    /// Command currently registered for ScreenForge, if any.
    pub registered: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AgentStatus {
    /// Path of the MCP server to register, or why it is missing.
    pub mcp_binary: Result<String, String>,
    pub claude_code: ClientStatus,
    pub claude_desktop: ClientStatus,
}

#[tauri::command]
pub async fn agent_status() -> AgentStatus {
    tauri::async_runtime::spawn_blocking(|| {
        let read = |path: Result<PathBuf, String>| {
            path.ok()
                .and_then(|p| fs::read_to_string(p).ok())
                .and_then(|text| registered_command(&text))
        };
        AgentStatus {
            mcp_binary: mcp_binary().map(|p| p.display().to_string()),
            claude_code: ClientStatus {
                available: claude_cli().is_some(),
                registered: read(claude_code_config()),
            },
            claude_desktop: ClientStatus {
                available: claude_desktop_dir().is_ok_and(|d| d.is_dir()),
                registered: read(claude_desktop_dir().map(|d| d.join(DESKTOP_CONFIG))),
            },
        }
    })
    .await
    .expect("status task does not panic")
}

/// Registers the server in Claude Code for every project (user scope).
#[tauri::command]
pub async fn configure_claude_code() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(|| {
        let bin = mcp_binary()?;
        let claude = claude_cli().ok_or("The `claude` command was not found.")?;
        // `add` refuses an existing name: remove any previous entry first.
        let _ = Command::new(&claude)
            .args(["mcp", "remove", "--scope", "user", SERVER_NAME])
            .output();
        let out = Command::new(&claude)
            .args(["mcp", "add", "--scope", "user", SERVER_NAME, "--"])
            .arg(&bin)
            .output()
            .map_err(|e| e.to_string())?;
        if out.status.success() {
            Ok(())
        } else {
            Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

const DESKTOP_CONFIG: &str = "claude_desktop_config.json";

/// Adds the server to Claude Desktop's config, after backing the file up.
#[tauri::command]
pub async fn configure_claude_desktop() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(|| {
        let bin = mcp_binary()?;
        let dir = claude_desktop_dir()?;
        if !dir.is_dir() {
            return Err("Claude Desktop does not seem to be installed.".into());
        }
        let path = dir.join(DESKTOP_CONFIG);
        let existing = match fs::read_to_string(&path) {
            Ok(text) => Some(text),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
            Err(e) => return Err(e.to_string()),
        };
        let merged = merge_desktop_config(existing.as_deref(), &bin.to_string_lossy())?;
        if existing.is_some() {
            fs::copy(
                &path,
                dir.join(format!("{DESKTOP_CONFIG}.screenforge-backup")),
            )
            .map_err(|e| e.to_string())?;
        }
        let tmp = dir.join(format!("{DESKTOP_CONFIG}.tmp"));
        fs::write(&tmp, merged).map_err(|e| e.to_string())?;
        fs::rename(&tmp, &path).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    const BIN: &str = "/Applications/ScreenForge.app/Contents/MacOS/screenforge-mcp";

    fn parse(s: &str) -> Value {
        serde_json::from_str(s).unwrap()
    }

    #[test]
    fn creates_the_config_when_there_is_none() {
        let merged = parse(&merge_desktop_config(None, BIN).unwrap());
        assert_eq!(
            merged,
            json!({ "mcpServers": { "screenforge": { "command": BIN, "args": [] } } })
        );
    }

    #[test]
    fn keeps_other_settings_and_servers() {
        let existing = r#"{
            "preferences": { "theme": "dark" },
            "coworkUserFilesPath": "/x",
            "mcpServers": { "github": { "command": "gh-mcp", "env": { "TOKEN": "secret" } } }
        }"#;
        let merged = parse(&merge_desktop_config(Some(existing), BIN).unwrap());
        assert_eq!(merged["preferences"], json!({ "theme": "dark" }));
        assert_eq!(merged["coworkUserFilesPath"], "/x");
        assert_eq!(merged["mcpServers"]["github"]["env"]["TOKEN"], "secret");
        assert_eq!(merged["mcpServers"]["screenforge"]["command"], BIN);
    }

    #[test]
    fn replaces_a_stale_screenforge_entry() {
        let existing = r#"{ "mcpServers": { "screenforge": { "command": "/old/path" } } }"#;
        let merged = parse(&merge_desktop_config(Some(existing), BIN).unwrap());
        assert_eq!(merged["mcpServers"]["screenforge"]["command"], BIN);
    }

    #[test]
    fn refuses_to_touch_a_file_it_cannot_parse() {
        assert!(merge_desktop_config(Some("{ not json"), BIN).is_err());
        assert!(merge_desktop_config(Some(r#"{ "mcpServers": [] }"#), BIN).is_err());
        assert!(merge_desktop_config(Some("[]"), BIN).is_err());
    }

    #[test]
    fn an_empty_file_counts_as_no_config() {
        assert!(merge_desktop_config(Some("  \n"), BIN).is_ok());
    }

    #[test]
    fn reads_the_registered_command() {
        assert_eq!(
            registered_command(r#"{ "mcpServers": { "screenforge": { "command": "/a/b" } } }"#),
            Some("/a/b".into())
        );
        assert_eq!(registered_command(r#"{ "mcpServers": {} }"#), None);
        assert_eq!(registered_command("{ not json"), None);
    }
}
