import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  EnvAnthropicCredentialLoader,
  MissingAnthropicKeyError,
  type AnthropicCredentials,
} from "../src/config/anthropic-credentials.js";

const ENV_KEY = "ANTHROPIC_API_KEY";

describe("US-014 ANTHROPIC_API_KEY loader (AC #18)", () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env[ENV_KEY];
    delete process.env[ENV_KEY];
  });

  afterEach(() => {
    if (saved === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = saved;
  });

  it("loads ANTHROPIC_API_KEY when present", () => {
    process.env[ENV_KEY] = "sk-ant-fake-key-12345";
    const cred = new EnvAnthropicCredentialLoader().load();
    expect(cred.apiKey).toBe("sk-ant-fake-key-12345");
  });

  it("trims surrounding whitespace from value", () => {
    process.env[ENV_KEY] = "  sk-ant-trimmed  ";
    const cred = new EnvAnthropicCredentialLoader().load();
    expect(cred.apiKey).toBe("sk-ant-trimmed");
  });

  it("throws MissingAnthropicKeyError when missing", () => {
    expect(() => new EnvAnthropicCredentialLoader().load()).toThrow(
      MissingAnthropicKeyError,
    );
  });

  it("throws MissingAnthropicKeyError on empty string", () => {
    process.env[ENV_KEY] = "";
    expect(() => new EnvAnthropicCredentialLoader().load()).toThrow(
      MissingAnthropicKeyError,
    );
  });

  it("error message does NOT echo the value", () => {
    process.env[ENV_KEY] = "";
    try {
      new EnvAnthropicCredentialLoader().load();
      expect.fail("should have thrown");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      expect(msg).toContain("ANTHROPIC_API_KEY");
      expect(msg).not.toContain("sk-ant-");
    }
  });

  it("apiKey field is non-enumerable (not leaked by JSON.stringify or console.log)", () => {
    process.env[ENV_KEY] = "sk-ant-secret-do-not-leak";
    const cred = new EnvAnthropicCredentialLoader().load();
    const serialized = JSON.stringify(cred);
    expect(serialized).not.toContain("sk-ant-secret-do-not-leak");
    const keys = Object.keys(cred);
    expect(keys).not.toContain("apiKey");
  });

  it("apiKey is still readable via direct access", () => {
    process.env[ENV_KEY] = "sk-ant-direct-access";
    const cred: AnthropicCredentials =
      new EnvAnthropicCredentialLoader().load();
    expect(cred.apiKey).toBe("sk-ant-direct-access");
  });
});
