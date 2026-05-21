#!/usr/bin/env node
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDefaultTimezone } from "./runtime/timezone.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./mcp/server.js";
import { loadAccountStore } from "./runtime/account-bootstrap.js";

ensureDefaultTimezone();

// Resolve project root from this file's location so directory defaults work
// regardless of where the host (Claude Desktop, etc.) spawned us. The host
// can set cwd to "/" which would make process.cwd() unsafe for mkdir.
// src/cli.ts → project root is parent of `src/`.
// dist/cli.js → project root is parent of `dist/`.
function resolveProjectRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..");
}

const PROJECT_ROOT = resolveProjectRoot();
const REPORTS_BASE_DIR =
  process.env.NAVER_ADS_REPORTS_DIR ?? path.join(PROJECT_ROOT, "reports");

async function main() {
  // Resolve the account store eagerly so config errors fail fast at startup.
  // Falls back to legacy single-account env vars if accounts.json is missing.
  const accountStore = loadAccountStore();
  const { server } = createServer({
    accountStore,
    reportsBaseDir: REPORTS_BASE_DIR,
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `naver-ads-mcp: MCP server connected via stdio ` +
      `(${accountStore.list().length} account(s), default=${accountStore.default() ?? "—"}, reports=${REPORTS_BASE_DIR})`,
  );
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
