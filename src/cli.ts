#!/usr/bin/env node
import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./mcp/server.js";
import { loadAccountStore } from "./runtime/account-bootstrap.js";
import { AnthropicClient } from "./api/anthropic.js";

async function main() {
  // Resolve the account store eagerly so config errors fail fast at startup.
  // Falls back to legacy single-account env vars if accounts.json is missing.
  const accountStore = loadAccountStore();
  // Lazy Anthropic client: built on first use of prepare_weekly_dashboard.
  // This lets the server boot even if ANTHROPIC_API_KEY is unset (users who
  // only need validate_credentials/fetch_raw_data/generate_report).
  const anthropicFactory = () => new AnthropicClient();
  const { server } = createServer({ accountStore, anthropicFactory });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `naver-ads-mcp: MCP server connected via stdio ` +
      `(${accountStore.list().length} account(s), default=${accountStore.default() ?? "—"})`,
  );
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
