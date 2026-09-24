//! rmcp wiring: exposes the functions of `tools.rs` as MCP tools. No logic lives here.

use std::path::PathBuf;

use base64::Engine;
use rmcp::handler::server::{router::tool::ToolRouter, wrapper::Parameters};
use rmcp::model::{CallToolResult, ContentBlock, Implementation, ServerCapabilities, ServerConfig};
use rmcp::{ServerHandler, tool, tool_handler, tool_router};
use schemars::JsonSchema;
use serde::Deserialize;
use serde_json::Value;

use crate::tools::{self, ToolError, ToolOutput};

#[derive(Debug, Deserialize, JsonSchema)]
pub struct NodeIdParams {
    /// Id of the node, as listed by get_canvas_snapshot.
    pub node_id: String,
}

#[derive(Debug, Clone)]
pub struct ScreenForgeServer {
    root: PathBuf,
    tool_router: ToolRouter<Self>,
}

#[tool_router]
impl ScreenForgeServer {
    /// Serves the project rooted at `root` (the folder that contains `.screenforge/`).
    pub fn new(root: PathBuf) -> Self {
        Self {
            root,
            tool_router: Self::tool_router(),
        }
    }

    #[tool(
        description = "Overview of the ScreenForge canvas: an image of the whole canvas, the screens (frames) with their elements in reading order, and every node with its name, position, size, parent frame, text content, style (colors, stroke, radius, gradient, font), annotations and connections. Start here."
    )]
    async fn get_canvas_snapshot(&self) -> CallToolResult {
        output_result(tools::canvas_snapshot(&self.root))
    }

    #[tool(
        description = "Get one canvas node in detail: metadata, position, user instructions, connections, inline SVG and colors, plus its PNG render as an image. For a frame (a screen), the image is the whole screen and `children` lists its elements in reading order."
    )]
    async fn get_node_detail(&self, Parameters(p): Parameters<NodeIdParams>) -> CallToolResult {
        output_result(tools::node_detail(&self.root, &p.node_id))
    }

    #[tool(
        description = "Get the nodes connected to a node: upstream (nodes that link to it) and downstream (nodes it links to), with triggers and payload types."
    )]
    async fn get_node_dependencies(
        &self,
        Parameters(p): Parameters<NodeIdParams>,
    ) -> CallToolResult {
        json_result(tools::node_dependencies(&self.root, &p.node_id))
    }
}

fn output_result(result: Result<ToolOutput, ToolError>) -> CallToolResult {
    match result {
        Ok(output) => {
            let mut blocks = vec![ContentBlock::text(output.json.to_string())];
            if let Some(png) = output.png {
                let data = base64::engine::general_purpose::STANDARD.encode(png);
                blocks.push(ContentBlock::image(data, "image/png"));
            }
            CallToolResult::success(blocks)
        }
        Err(e) => error_result(e),
    }
}

fn json_result(result: Result<Value, ToolError>) -> CallToolResult {
    match result {
        Ok(json) => CallToolResult::success(vec![ContentBlock::text(json.to_string())]),
        Err(e) => error_result(e),
    }
}

fn error_result(ToolError(message): ToolError) -> CallToolResult {
    CallToolResult::error(vec![ContentBlock::text(message)])
}

#[tool_handler(router = self.tool_router)]
impl ServerHandler for ScreenForgeServer {
    fn get_info(&self) -> ServerConfig {
        ServerConfig::new(ServerCapabilities::builder().enable_tools().build())
            .with_server_info(Implementation::new("screenforge-mcp", env!("CARGO_PKG_VERSION")))
            .with_instructions(
                "Read-only access to the ScreenForge canvas of the current project: UI captures and drawings annotated by the user.",
            )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rmcp::ServiceExt;
    use rmcp::model::CallToolRequestParams;
    use serde_json::json;
    use sf_core::node::{Dimensions, Node, NodeKind};
    use sf_core::store::{PNG_FILE_NAME, node_dir, write_node};
    use std::fs;
    use tempfile::TempDir;

    async fn call(root: &std::path::Path, tool: &'static str, args: Value) -> CallToolResult {
        let (server_io, client_io) = tokio::io::duplex(1 << 20);
        let server = ScreenForgeServer::new(root.to_path_buf());
        tokio::spawn(async move { server.serve(server_io).await.unwrap().waiting().await });
        let client = ().serve(client_io).await.unwrap();
        let mut params = CallToolRequestParams::new(tool);
        if let Value::Object(map) = args {
            params = params.with_arguments(map);
        }
        // A crashed handler never answers: fail instead of hanging the suite.
        let result =
            tokio::time::timeout(std::time::Duration::from_secs(10), client.call_tool(params))
                .await
                .expect("server did not answer within 10s")
                .unwrap();
        client.cancel().await.unwrap();
        result
    }

    fn text_json(result: &CallToolResult) -> Value {
        let text = result.content[0].as_text().expect("first block is text");
        serde_json::from_str(&text.text).unwrap()
    }

    fn project() -> TempDir {
        let dir = TempDir::new().unwrap();
        write_node(
            dir.path(),
            &Node {
                id: "login_error".into(),
                kind: NodeKind::Capture,
                name: "Login error".into(),
                dimensions: Dimensions {
                    width: 320.0,
                    height: 80.0,
                },
                position: None,
                parent: None,
                text: None,
                style: None,
                colors_detected: vec![],
                connections: vec![],
                user_instructions: "Border should be red".into(),
            },
        )
        .unwrap();
        dir
    }

    #[tokio::test]
    async fn lists_the_three_tools() {
        let (server_io, client_io) = tokio::io::duplex(1 << 16);
        let server = ScreenForgeServer::new(PathBuf::from("/nowhere"));
        tokio::spawn(async move { server.serve(server_io).await.unwrap().waiting().await });
        let client = ().serve(client_io).await.unwrap();
        let mut names: Vec<_> = client
            .list_all_tools()
            .await
            .unwrap()
            .into_iter()
            .map(|t| t.name.to_string())
            .collect();
        names.sort();
        assert_eq!(
            names,
            [
                "get_canvas_snapshot",
                "get_node_dependencies",
                "get_node_detail"
            ]
        );
        client.cancel().await.unwrap();
    }

    #[tokio::test]
    async fn snapshot_returns_nodes_as_json_text() {
        let p = project();
        let result = call(p.path(), "get_canvas_snapshot", json!({})).await;
        assert_ne!(result.is_error, Some(true));
        assert_eq!(text_json(&result)["nodes"][0]["id"], "login_error");
    }

    #[tokio::test]
    async fn detail_returns_json_then_png_image_block() {
        let p = project();
        let png = vec![0x89, b'P', b'N', b'G'];
        fs::write(
            node_dir(p.path(), "login_error")
                .unwrap()
                .join(PNG_FILE_NAME),
            &png,
        )
        .unwrap();

        let result = call(
            p.path(),
            "get_node_detail",
            json!({ "node_id": "login_error" }),
        )
        .await;
        assert_eq!(
            text_json(&result)["user_instructions"],
            "Border should be red"
        );
        let image = result.content[1]
            .as_image()
            .expect("second block is an image");
        assert_eq!(image.mime_type, "image/png");
        assert_eq!(
            image.data,
            base64::engine::general_purpose::STANDARD.encode(&png)
        );
    }

    #[tokio::test]
    async fn snapshot_sends_the_canvas_render_as_an_image() {
        let p = project();
        sf_core::project::write_canvas_png(p.path(), Some(&[0x89, b'P'])).unwrap();
        let result = call(p.path(), "get_canvas_snapshot", json!({})).await;
        let image = result.content[1]
            .as_image()
            .expect("second block is an image");
        assert_eq!(image.mime_type, "image/png");
    }

    #[tokio::test]
    async fn detail_without_png_has_a_single_block() {
        let p = project();
        let result = call(
            p.path(),
            "get_node_detail",
            json!({ "node_id": "login_error" }),
        )
        .await;
        assert_eq!(result.content.len(), 1);
    }

    #[tokio::test]
    async fn dependencies_return_json_text() {
        let p = project();
        let result = call(
            p.path(),
            "get_node_dependencies",
            json!({ "node_id": "login_error" }),
        )
        .await;
        assert_eq!(text_json(&result)["node_id"], "login_error");
    }

    #[tokio::test]
    async fn tool_errors_are_flagged_with_the_message() {
        let p = project();
        let result = call(p.path(), "get_node_detail", json!({ "node_id": "ghost" })).await;
        assert_eq!(result.is_error, Some(true));
        assert_eq!(
            result.content[0].as_text().unwrap().text,
            "Node not found: ghost"
        );
    }
}
