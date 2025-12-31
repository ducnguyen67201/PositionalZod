/**
 * positional-zod
 *
 * Schema-driven positional format for LLM structured outputs.
 * A multi-provider LLM wrapper that uses a minimal positional format
 * derived from Zod schemas for maximum token efficiency and reliable parsing.
 *
 * @example
 * ```typescript
 * import { PositionalZod } from "positional-zod";
 * import { z } from "zod";
 *
 * const pz = new PositionalZod({
 *   providers: { openai: { apiKey: process.env.OPENAI_API_KEY } },
 *   defaultProvider: "openai",
 * });
 *
 * const result = await pz.complete({
 *   prompt: "Extract the top 3 users",
 *   schema: z.object({ id: z.number(), name: z.string() }),
 *   mode: "array",
 * });
 *
 * console.log(result.data);
 * // [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }, ...]
 * ```
 *
 * @packageDocumentation
 */

// Main class
export { PositionalZod } from "./positional-zod.js";

// Types
export type {
  // Configuration
  PositionalZodConfig,
  ProviderConfig,
  Provider,
  ResolvedConfig,

  // Completion
  CompletionOptions,
  CompletionResult,
  InputFormat,
  OutputMode,

  // Schema analysis
  PositionInfo,
  FieldType,

  // Parser
  ParserConfig,
  ParseResult,

  // Provider
  ProviderOptions,
  ProviderResponse,
  TokenUsage,

  // Prompt
  PromptConfig,
} from "./types.js";

// Errors
export {
  PositionalZodError,
  ProviderError,
  ParseError,
  ValidationError,
  SchemaError,
} from "./errors.js";

// Utilities (for advanced usage)
export { analyzeSchema, getSchemaPositionMap } from "./schema-analyzer.js";
export { buildSystemPrompt, buildUserPrompt, buildPrompts } from "./prompt-builder.js";
export { parsePositionalOutput, parseRowRaw } from "./parser.js";
export { splitWithEscape, escape, unescape } from "./utils/escape.js";
export { coerceValue, coerceArrayItems } from "./utils/coercion.js";

// Providers (for advanced usage)
export {
  BaseProvider,
  OpenAIProvider,
  AnthropicProvider,
  GoogleProvider,
  createProvider,
  createOpenAIProvider,
  createAnthropicProvider,
  createGoogleProvider,
} from "./providers/index.js";

export type {
  OpenAIConfig,
  AnthropicConfig,
  GoogleConfig,
} from "./providers/index.js";
