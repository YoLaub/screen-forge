//! screenforge-mcp: MCP server over a project's `.screenforge/` folder. It never changes the canvas;
//! its only write is the note of the last read (`sf_core::reads`).

pub mod server;
pub mod tools;
