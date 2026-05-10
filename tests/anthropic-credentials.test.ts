import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  EnvAnthropicCredentialLoader,
  MissingAnthropicKeyError,
  type AnthropicCredentials,
} from "../src/config/anthropic-credentials.js";

const ENV_KEY = "ANTHROPIC_API_KEY";
const ALT_KEY = "CLAUDE_API_KEY";

describe("US-014 ANTHROPIC_API_KEY loader (AC #18)", () => {
  let savedAnthropic: string | undefined;
  let savedClaude: string | undefined;

  beforeEach(() => {
    savedAnthropic = process.env[ENV_KEY];
    savedClaude = process.env[ALT_KEY];
    delete process.env[ENV_KEY];
    delete process.env[ALT_KEY];
  });

  afterEach(() => {
    if (savedAnthropic === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = savedAnthropic;
    if (savedClaude === undefined) delete process.env[ALT_KEY];
    else process.env[ALT_KEY] = savedClaude;
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

  it("accepts CLAUDE_API_KEY as alias when ANTHROPIC_API_KEY is missing", () => {
    process.env[ALT_KEY] = "sk-ant-via-claude-alias";
    const cred = new EnvAnthropicCredentialLoader().load();
    expect(cred.apiKey).toBe("sk-ant-via-claude-alias");
  });

  it("ANTHROPIC_API_KEY takes precedence when both are present", () => {
    process.env[ENV_KEY] = "sk-ant-primary";
    process.env[ALT_KEY] = "sk-ant-alias";
    const cred = new EnvAnthropicCredentialLoader().load();
    expect(cred.apiKey).toBe("sk-ant-primary");
  });

  it("strips surrounding double quotes from value", () => {
    process.env[ENV_KEY] = '"sk-ant-with-quotes"';
    const cred = new EnvAnthropicCredentialLoader().load();
    expect(cred.apiKey).toBe("sk-ant-with-quotes");
  });

  it("strips surrounding single quotes from value", () => {
    process.env[ENV_KEY] = "'sk-ant-with-single-quotes'";
    const cred = new EnvAnthropicCredentialLoader().load();
    expect(cred.apiKey).toBe("sk-ant-with-single-quotes");
  });

  it("strips quotes from CLAUDE_API_KEY alias too", () => {
    process.env[ALT_KEY] = '"sk-ant-alias-quoted"';
    const cred = new EnvAnthropicCredentialLoader().load();
    expect(cred.apiKey).toBe("sk-ant-alias-quoted");
  });
});
