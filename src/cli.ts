#!/usr/bin/env node
import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./mcp/server.js";

async function main() {
  const { server } = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("naver-ads-mcp: MCP server connected via stdio");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
