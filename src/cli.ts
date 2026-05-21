#!/usr/bin/env node
import "dotenv/config";
import { ensureDefaultTimezone } from "./runtime/timezone.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./mcp/server.js";
import { loadAccountStore } from "./runtime/account-bootstrap.js";

ensureDefaultTimezone();

async function main() {
  // Resolve the account store eagerly so config errors fail fast at startup.
  // Falls back to legacy single-account env vars if accounts.json is missing.
  const accountStore = loadAccountStore();
  const { server } = createServer({ accountStore });
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
