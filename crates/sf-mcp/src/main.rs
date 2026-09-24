//! `screenforge-mcp`: read-only MCP server over stdio.
//! Serves the working directory's project, or else the project open in ScreenForge.

use rmcp::ServiceExt;
use rmcp::transport::stdio;
use sf_core::app_state;
use sf_mcp::server::ScreenForgeServer;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Claude Code starts the server in the project folder; Claude Desktop does
    // not, so the server then serves the project open in ScreenForge.
    let last_project =
        app_state::app_config_dir().and_then(|dir| app_state::read_last_project(&dir));
    let root = app_state::resolve_project(&std::env::current_dir()?, last_project);
    let service = ScreenForgeServer::new(root).serve(stdio()).await?;
    service.waiting().await?;
    Ok(())
}
