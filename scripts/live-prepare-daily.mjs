#!/usr/bin/env node
// Live smoke for prepare_daily_dashboard. Overrides client mappings inline so
// the hellomax account (customer_id=3371736) gets exercised end-to-end without
// modifying src/config/client-mappings.json.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { NaverAdsClient } from "../dist/api/client.js";
import { freezeCredential } from "../dist/config/credentials.js";
import { createServer } from "../dist/mcp/server.js";
import { MapAccountStore } from "../dist/config/account-store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function pickDate() {
  return process.argv[2] && /^\d{4}-\d{2}-\d{2}$/.test(process.argv[2])
    ? process.argv[2]
    : "2026-05-12";
}

function loadAccount() {
  const raw = JSON.parse(readFileSync(resolve(ROOT, "accounts.json"), "utf-8"));
  const name = raw.default;
  const entry = raw.accounts[name];
  if (!entry) throw new Error(`account not found: ${name}`);
  return {
    name,
    customerId: String(entry.customerId),
    cred: freezeCredential(
      String(entry.customerId),
      entry.accessLicense,
      entry.secretKey,
    ),
  };
}

async function main() {
  const date = pickDate();
  const { name, customerId, cred } = loadAccount();
  console.error(`# live prepare_daily_dashboard account=${name} customerId=${customerId} date=${date}`);

  const client = new NaverAdsClient({
    baseUrl: "https://api.searchad.naver.com",
    credentials: cred,
  });

  const accountStore = new MapAccountStore({
    defaultName: name,
    accounts: new Map([[name, cred]]),
  });

  // Inline-override client mappings so the live provider can resolve hellomax.
  const clientMappings = {
    mappings: [
      {
        client_id: "hellomax",
        display_name: "helloMAX",
        customer_id: customerId,
        recipients: [],
        cc: [],
        automation_enabled: true,
      },
    ],
  };

  const { tools } = createServer({
    client,
    accountStore,
    clientMappings,
  });

  const result = await tools.prepare_daily_dashboard({ date });
  console.error("\n## result:");
  console.error(JSON.stringify(result, null, 2));

  if (result.summary[0]?.client !== "hellomax") {
    console.error("FAIL: hellomax mapping not processed");
    process.exit(1);
  }
  if (result.data_warnings.some((w) => w.includes("매핑 없음"))) {
    console.error("FAIL: mapping was treated as missing");
    process.exit(1);
  }
  console.error("\nOK: live prepare_daily_dashboard executed");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
