// L3 API: Anthropic Claude wrapper. Thin around @anthropic-ai/sdk so analyzer
// code only sees a `generate({system, user})` method.

import Anthropic from "@anthropic-ai/sdk";
import type { IAnthropicCredentialLoader } from "../config/anthropic-credentials.js";
import { EnvAnthropicCredentialLoader } from "../config/anthropic-credentials.js";

export interface AnthropicGenerateArgs {
  system: string;
  user: string;
  /** Optional cache control for the system prompt. */
  cacheSystem?: boolean;
  model?: string;
  maxTokens?: number;
}

export interface AnthropicGenerateResult {
  content: string;
  cache_hit: boolean;
}

export interface IAnthropic {
  generate(args: AnthropicGenerateArgs): Promise<AnthropicGenerateResult>;
}

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_MAX_TOKENS = 4_096;

export class AnthropicClient implements IAnthropic {
  private client: Anthropic;

  constructor(opts: { credentialLoader?: IAnthropicCredentialLoader } = {}) {
    const loader = opts.credentialLoader ?? new EnvAnthropicCredentialLoader();
    const cred = loader.load();
    this.client = new Anthropic({ apiKey: cred.apiKey });
  }

  async generate(
    args: AnthropicGenerateArgs,
  ): Promise<AnthropicGenerateResult> {
    const systemBlock = args.cacheSystem
      ? [
          {
            type: "text" as const,
            text: args.system,
            cache_control: { type: "ephemeral" as const },
          },
        ]
      : args.system;
    const resp = await this.client.messages.create({
      model: args.model ?? DEFAULT_MODEL,
      max_tokens: args.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: systemBlock as unknown as string,
      messages: [{ role: "user", content: args.user }],
    });
    const textBlock = resp.content.find((c) => c.type === "text");
    const content =
      textBlock && textBlock.type === "text" ? textBlock.text : "";
    const usage = resp.usage as unknown as {
      cache_read_input_tokens?: number;
    };
    const cache_hit = (usage.cache_read_input_tokens ?? 0) > 0;
    return { content, cache_hit };
  }
}
