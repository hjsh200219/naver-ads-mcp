// L1 runtime helper: reads `src/config/client-mappings.json` from disk and
// validates against the L4 zod schema. L4 stays node:fs free.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ClientMappingsFileSchema,
  type ClientMappingsFile,
} from "../config/client-mappings.js";

const DEFAULT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "config",
  "client-mappings.json",
);

export function defaultClientMappingsPath(): string {
  return DEFAULT_PATH;
}

export function loadClientMappings(filePath?: string): ClientMappingsFile {
  const target = filePath ?? DEFAULT_PATH;
  const raw = readFileSync(target, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  return ClientMappingsFileSchema.parse(parsed);
}
