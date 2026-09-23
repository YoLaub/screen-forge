//! `screenforge-mcp`: MCP server over stdio for the project in the current directory.
//! MCP clients such as Claude Code start it from the project root.

use rmcp::ServiceExt;
use rmcp::transport::stdio;
use sf_mcp::server::ScreenForgeServer;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let root = std::env::current_dir()?;
    let service = ScreenForgeServer::new(root).serve(stdio()).await?;
    service.waiting().await?;
    Ok(())
}
