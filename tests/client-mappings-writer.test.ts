import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  existsSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  upsertClientMapping,
  ClientMappingsWriteError,
} from "../src/runtime/client-mappings-writer.js";
import { ClientMappingsFileSchema } from "../src/config/client-mappings.js";

const baseMapping = {
  client_id: "hellomax",
  display_name: "helloMAX",
  customer_id: "1234567",
  recipients: ["client@example.com"],
  cc: ["ae@zbros.co.kr"],
  automation_enabled: true,
};

describe("client-mappings-writer.upsertClientMapping", () => {
  let tmp: string;
  let target: string;

  beforeEach(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "cm-writer-"));
    target = path.join(tmp, "client-mappings.json");
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("creates the file with a single mapping when none exists", async () => {
    const out = await upsertClientMapping(baseMapping, { filePath: target });
    expect(out.added).toBe(true);
    expect(out.updated).toBe(false);
    expect(existsSync(target)).toBe(true);
    const parsed = ClientMappingsFileSchema.parse(
      JSON.parse(readFileSync(target, "utf8")) as unknown,
    );
    expect(parsed.mappings).toHaveLength(1);
    expect(parsed.mappings[0].client_id).toBe("hellomax");
  });

  it("appends a second mapping without duplicates", async () => {
    await upsertClientMapping(baseMapping, { filePath: target });
    const second = { ...baseMapping, client_id: "client-b", display_name: "B" };
    const out = await upsertClientMapping(second, { filePath: target });
    expect(out.added).toBe(true);
    const parsed = ClientMappingsFileSchema.parse(
      JSON.parse(readFileSync(target, "utf8")) as unknown,
    );
    expect(parsed.mappings).toHaveLength(2);
    expect(parsed.mappings.map((m) => m.client_id).sort()).toEqual([
      "client-b",
      "hellomax",
    ]);
  });

  it("rejects duplicate client_id without overwrite=true", async () => {
    await upsertClientMapping(baseMapping, { filePath: target });
    await expect(
      upsertClientMapping(baseMapping, { filePath: target }),
    ).rejects.toBeInstanceOf(ClientMappingsWriteError);
  });

  it("replaces existing mapping when overwrite=true", async () => {
    await upsertClientMapping(baseMapping, { filePath: target });
    const replacement = {
      ...baseMapping,
      display_name: "helloMAX Updated",
      recipients: ["new@example.com"],
    };
    const out = await upsertClientMapping(replacement, {
      filePath: target,
      overwrite: true,
    });
    expect(out.updated).toBe(true);
    expect(out.added).toBe(false);
    const parsed = ClientMappingsFileSchema.parse(
      JSON.parse(readFileSync(target, "utf8")) as unknown,
    );
    expect(parsed.mappings).toHaveLength(1);
    expect(parsed.mappings[0].display_name).toBe("helloMAX Updated");
    expect(parsed.mappings[0].recipients).toEqual(["new@example.com"]);
  });

  it("throws on schema-invalid input (non-kebab client_id)", async () => {
    await expect(
      upsertClientMapping(
        { ...baseMapping, client_id: "Hello_Max" },
        { filePath: target },
      ),
    ).rejects.toThrow();
    expect(existsSync(target)).toBe(false);
  });

  it("throws on schema-invalid input (missing recipients)", async () => {
    const bad = { ...baseMapping } as Record<string, unknown>;
    delete bad.recipients;
    await expect(
      upsertClientMapping(bad, { filePath: target }),
    ).rejects.toThrow();
  });

  it("preserves existing valid mappings when file already has entries", async () => {
    const existing = {
      mappings: [
        {
          client_id: "client-1",
          display_name: "TBD",
          customer_id: "TBD",
          recipients: [],
          cc: [],
          automation_enabled: true,
        },
      ],
    };
    writeFileSync(target, JSON.stringify(existing, null, 2), "utf8");
    await upsertClientMapping(baseMapping, { filePath: target });
    const parsed = ClientMappingsFileSchema.parse(
      JSON.parse(readFileSync(target, "utf8")) as unknown,
    );
    expect(parsed.mappings).toHaveLength(2);
    expect(parsed.mappings.map((m) => m.client_id).sort()).toEqual([
      "client-1",
      "hellomax",
    ]);
  });

  it("writes file with trailing newline (POSIX convention)", async () => {
    await upsertClientMapping(baseMapping, { filePath: target });
    const body = readFileSync(target, "utf8");
    expect(body.endsWith("\n")).toBe(true);
  });

  it("serializes concurrent upserts so all entries survive", async () => {
    const seeds = ["client-a", "client-b", "client-c", "client-d"].map(
      (id) => ({ ...baseMapping, client_id: id }),
    );
    await Promise.all(
      seeds.map((m) => upsertClientMapping(m, { filePath: target })),
    );
    const parsed = ClientMappingsFileSchema.parse(
      JSON.parse(readFileSync(target, "utf8")) as unknown,
    );
    expect(parsed.mappings).toHaveLength(4);
    const ids = parsed.mappings.map((m) => m.client_id).sort();
    expect(ids).toEqual(["client-a", "client-b", "client-c", "client-d"]);
  });
});
