/**
 * Base provider interface and abstract class for LLM providers.
 */

import type { ProviderOptions, ProviderResponse } from "../types.js";

/**
 * Abstract base class for LLM providers.
 */
export abstract class BaseProvider {
  /**
   * The provider name.
   */
  abstract readonly name: string;

  /**
   * Complete a prompt with the LLM.
   *
   * @param systemPrompt - The system prompt with positional format instructions
   * @param userPrompt - The user prompt with the task
   * @param options - Provider options (temperature, maxTokens)
   * @returns The LLM response
   */
  abstract complete(
    systemPrompt: string,
    userPrompt: string,
    options: ProviderOptions
  ): Promise<ProviderResponse>;
}
