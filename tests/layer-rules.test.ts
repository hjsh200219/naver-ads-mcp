import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");

describe("Layer rules: L4 config has zero node:fs imports", () => {
  // L4 (config) must stay pure: env reading + in-memory data only.
  // File I/O lives in L1 (src/runtime/, src/cli.ts).
  const L4_FILES = [
    "src/config/credentials.ts",
    "src/config/account-store.ts",
    "src/config/client-mappings.ts", // v1.6
  ];

  for (const rel of L4_FILES) {
    it(`${rel} does not import node:fs`, () => {
      const content = readFileSync(path.join(root, rel), "utf8");
      expect(content).not.toMatch(/from\s+["']node:fs["']/);
      expect(content).not.toMatch(/from\s+["']fs["']/);
      expect(content).not.toMatch(/require\(["']fs["']\)/);
      expect(content).not.toMatch(/require\(["']node:fs["']\)/);
    });
  }
});
