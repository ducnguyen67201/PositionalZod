/**
 * Provider factory and exports.
 */

export { BaseProvider } from "./base.js";
export { OpenAIProvider, createOpenAIProvider } from "./openai.js";
export type { OpenAIConfig } from "./openai.js";
export { AnthropicProvider, createAnthropicProvider } from "./anthropic.js";
export type { AnthropicConfig } from "./anthropic.js";
export { GoogleProvider, createGoogleProvider } from "./google.js";
export type { GoogleConfig } from "./google.js";

import type { Provider, ProviderConfig } from "../types.js";
import { BaseProvider } from "./base.js";
import { OpenAIProvider } from "./openai.js";
import { AnthropicProvider } from "./anthropic.js";
import { GoogleProvider } from "./google.js";

/**
 * Create a provider instance based on the provider type and config.
 */
export function createProvider(
  type: Provider,
  config: ProviderConfig
): BaseProvider {
  switch (type) {
    case "openai": {
      const openaiConfig = config.openai;
      if (!openaiConfig) {
        throw new Error("OpenAI configuration is required");
      }
      return new OpenAIProvider(openaiConfig);
    }

    case "anthropic": {
      const anthropicConfig = config.anthropic;
      if (!anthropicConfig) {
        throw new Error("Anthropic configuration is required");
      }
      return new AnthropicProvider(anthropicConfig);
    }

    case "google": {
      const googleConfig = config.google;
      if (!googleConfig) {
        throw new Error("Google configuration is required");
      }
      return new GoogleProvider(googleConfig);
    }

    default:
      throw new Error(`Unknown provider: ${type}`);
  }
}
