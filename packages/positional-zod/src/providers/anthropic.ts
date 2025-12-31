/**
 * Anthropic provider implementation.
 */

import { BaseProvider } from "./base.js";
import { ProviderError } from "../errors.js";
import type { ProviderOptions, ProviderResponse } from "../types.js";

export interface AnthropicConfig {
  apiKey: string;
  model?: string;
}

const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

export class AnthropicProvider extends BaseProvider {
  readonly name = "anthropic";
  private config: AnthropicConfig;
  private client: unknown;

  constructor(config: AnthropicConfig) {
    super();
    this.config = config;
  }

  private async getClient(): Promise<unknown> {
    if (this.client) {
      return this.client;
    }

    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      this.client = new Anthropic({
        apiKey: this.config.apiKey,
      });
      return this.client;
    } catch (error) {
      throw new ProviderError(
        "Failed to import Anthropic SDK. Make sure '@anthropic-ai/sdk' is installed.",
        "anthropic",
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async complete(
    systemPrompt: string,
    userPrompt: string,
    options: ProviderOptions
  ): Promise<ProviderResponse> {
    const client = await this.getClient();

    try {
      // Type assertion for the Anthropic client
      const anthropic = client as {
        messages: {
          create: (params: unknown) => Promise<{
            content: Array<{ type: string; text?: string }>;
            usage: {
              input_tokens: number;
              output_tokens: number;
            };
          }>;
        };
      };

      const response = await anthropic.messages.create({
        model: this.config.model ?? DEFAULT_MODEL,
        max_tokens: options.maxTokens ?? 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        temperature: options.temperature ?? 0,
      });

      // Extract text content
      const textContent = response.content.find((c) => c.type === "text");
      const content = textContent?.text ?? "";

      return {
        content,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens:
            response.usage.input_tokens + response.usage.output_tokens,
        },
      };
    } catch (error) {
      const err = error as { status?: number; message?: string };
      throw new ProviderError(
        `Anthropic API error: ${err.message ?? "Unknown error"}`,
        "anthropic",
        {
          statusCode: err.status,
          cause: error instanceof Error ? error : undefined,
        }
      );
    }
  }
}

/**
 * Create an Anthropic provider instance.
 */
export function createAnthropicProvider(
  config: AnthropicConfig
): AnthropicProvider {
  return new AnthropicProvider(config);
}
