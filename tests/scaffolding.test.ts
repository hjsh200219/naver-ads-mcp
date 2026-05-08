import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");

describe("US-001 scaffolding", () => {
  it("package.json declares required deps", () => {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    expect(pkg.dependencies["@modelcontextprotocol/sdk"]).toBeDefined();
    expect(pkg.dependencies.dotenv).toBeDefined();
    expect(pkg.dependencies.exceljs).toBeDefined();
    expect(pkg.dependencies.zod).toBeDefined();
    expect(pkg.devDependencies.typescript).toBeDefined();
    expect(pkg.devDependencies.vitest).toBeDefined();
    expect(pkg.devDependencies.tsx).toBeDefined();
  });

  it(".gitignore excludes .env and node_modules", () => {
    const g = readFileSync(path.join(root, ".gitignore"), "utf8");
    expect(g).toContain(".env");
    expect(g).toContain("node_modules/");
    expect(g).toContain("dist/");
  });

  it("tsconfig is strict + ES2022 NodeNext", () => {
    const tsc = JSON.parse(readFileSync(path.join(root, "tsconfig.json"), "utf8"));
    expect(tsc.compilerOptions.strict).toBe(true);
    expect(tsc.compilerOptions.target).toBe("ES2022");
    expect(tsc.compilerOptions.module).toBe("NodeNext");
  });

  it("git repo is initialized", () => {
    expect(existsSync(path.join(root, ".git"))).toBe(true);
  });

  it(".env.example exists with 3 keys (no deprecated ID/PW)", () => {
    const e = readFileSync(path.join(root, ".env.example"), "utf8");
    expect(e).toContain("NAVER_ADS_CUSTOMER_ID");
    expect(e).toContain("NAVER_ADS_ACCESS_LICENSE");
    expect(e).toContain("NAVER_ADS_SECRET_KEY");
    expect(e).not.toContain("NAVER_ADS_PW=");
  });
});
