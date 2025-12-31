/**
 * OpenAI provider implementation.
 */

import { BaseProvider } from "./base.js";
import { ProviderError } from "../errors.js";
import type { ProviderOptions, ProviderResponse } from "../types.js";

export interface OpenAIConfig {
  apiKey: string;
  model?: string;
  organization?: string;
}

const DEFAULT_MODEL = "gpt-4o";

export class OpenAIProvider extends BaseProvider {
  readonly name = "openai";
  private config: OpenAIConfig;
  private client: unknown;

  constructor(config: OpenAIConfig) {
    super();
    this.config = config;
  }

  private async getClient(): Promise<unknown> {
    if (this.client) {
      return this.client;
    }

    try {
      const { default: OpenAI } = await import("openai");
      this.client = new OpenAI({
        apiKey: this.config.apiKey,
        organization: this.config.organization,
      });
      return this.client;
    } catch (error) {
      throw new ProviderError(
        "Failed to import OpenAI SDK. Make sure 'openai' is installed.",
        "openai",
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
      // Type assertion for the OpenAI client
      const openai = client as {
        chat: {
          completions: {
            create: (params: unknown) => Promise<{
              choices: Array<{ message: { content: string | null } }>;
              usage?: {
                prompt_tokens: number;
                completion_tokens: number;
                total_tokens: number;
              };
            }>;
          };
        };
      };

      const response = await openai.chat.completions.create({
        model: this.config.model ?? DEFAULT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: options.temperature ?? 0,
        max_tokens: options.maxTokens ?? 4096,
      });

      const content = response.choices[0]?.message?.content ?? "";

      return {
        content,
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
      };
    } catch (error) {
      const err = error as { status?: number; message?: string };
      throw new ProviderError(
        `OpenAI API error: ${err.message ?? "Unknown error"}`,
        "openai",
        {
          statusCode: err.status,
          cause: error instanceof Error ? error : undefined,
        }
      );
    }
  }
}

/**
 * Create an OpenAI provider instance.
 */
export function createOpenAIProvider(config: OpenAIConfig): OpenAIProvider {
  return new OpenAIProvider(config);
}
