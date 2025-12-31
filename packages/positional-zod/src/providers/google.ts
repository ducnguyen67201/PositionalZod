/**
 * Google Gemini provider implementation.
 */

import { BaseProvider } from "./base.js";
import { ProviderError } from "../errors.js";
import type { ProviderOptions, ProviderResponse } from "../types.js";

export interface GoogleConfig {
  apiKey: string;
  model?: string;
}

const DEFAULT_MODEL = "gemini-2.0-flash";

export class GoogleProvider extends BaseProvider {
  readonly name = "google";
  private config: GoogleConfig;
  private client: unknown;

  constructor(config: GoogleConfig) {
    super();
    this.config = config;
  }

  private async getClient(): Promise<unknown> {
    if (this.client) {
      return this.client;
    }

    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      this.client = new GoogleGenerativeAI(this.config.apiKey);
      return this.client;
    } catch (error) {
      throw new ProviderError(
        "Failed to import Google Generative AI SDK. Make sure '@google/generative-ai' is installed.",
        "google",
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
      // Type assertion for the Google client
      const genAI = client as {
        getGenerativeModel: (config: {
          model: string;
          systemInstruction?: string;
          generationConfig?: {
            temperature?: number;
            maxOutputTokens?: number;
          };
        }) => {
          generateContent: (prompt: string) => Promise<{
            response: {
              text: () => string;
              usageMetadata?: {
                promptTokenCount: number;
                candidatesTokenCount: number;
                totalTokenCount: number;
              };
            };
          }>;
        };
      };

      const model = genAI.getGenerativeModel({
        model: this.config.model ?? DEFAULT_MODEL,
        systemInstruction: systemPrompt,
        generationConfig: {
          temperature: options.temperature ?? 0,
          maxOutputTokens: options.maxTokens ?? 4096,
        },
      });

      const result = await model.generateContent(userPrompt);
      const response = result.response;
      const content = response.text();

      return {
        content,
        usage: response.usageMetadata
          ? {
              promptTokens: response.usageMetadata.promptTokenCount,
              completionTokens: response.usageMetadata.candidatesTokenCount,
              totalTokens: response.usageMetadata.totalTokenCount,
            }
          : undefined,
      };
    } catch (error) {
      const err = error as { status?: number; message?: string };
      throw new ProviderError(
        `Google API error: ${err.message ?? "Unknown error"}`,
        "google",
        {
          statusCode: err.status,
          cause: error instanceof Error ? error : undefined,
        }
      );
    }
  }
}

/**
 * Create a Google provider instance.
 */
export function createGoogleProvider(config: GoogleConfig): GoogleProvider {
  return new GoogleProvider(config);
}
