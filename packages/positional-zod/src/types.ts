import type { z } from "zod";

// ============================================================================
// Provider Types
// ============================================================================

/**
 * Supported LLM providers.
 */
export type Provider = "openai" | "anthropic" | "google";

/**
 * Configuration for each provider.
 */
export interface ProviderConfig {
  openai?: {
    apiKey: string;
    model?: string;
    organization?: string;
  };
  anthropic?: {
    apiKey: string;
    model?: string;
  };
  google?: {
    apiKey: string;
    model?: string;
  };
}

// ============================================================================
// Main Configuration
// ============================================================================

/**
 * Configuration for PositionalZod instance.
 */
export interface PositionalZodConfig {
  /**
   * Provider configurations.
   */
  providers: ProviderConfig;

  /**
   * Primary provider to use.
   */
  defaultProvider: Provider;

  /**
   * Fallback providers in order.
   * @default []
   */
  fallbackProviders?: Provider[];

  /**
   * Primary delimiter between fields.
   * @default "|"
   */
  delimiter?: string;

  /**
   * Sub-delimiter for arrays within fields.
   * @default ";"
   */
  subDelimiter?: string;

  /**
   * Escape character for delimiters in values.
   * @default "\\"
   */
  escapeChar?: string;

  /**
   * Enable debug logging.
   * @default false
   */
  debug?: boolean;
}

/**
 * Internal resolved configuration with all defaults applied.
 */
export interface ResolvedConfig {
  providers: ProviderConfig;
  defaultProvider: Provider;
  fallbackProviders: Provider[];
  delimiter: string;
  subDelimiter: string;
  escapeChar: string;
  debug: boolean;
}

// ============================================================================
// Completion Types
// ============================================================================

/**
 * Input format for data included in prompts.
 */
export type InputFormat = "json" | "text" | "auto";

/**
 * Output mode for completions.
 */
export type OutputMode = "object" | "array";

/**
 * Options for completion requests.
 */
export interface CompletionOptions<T extends z.ZodRawShape> {
  /**
   * The prompt/instruction for the LLM.
   */
  prompt: string;

  /**
   * Zod schema defining the output structure.
   * Field order in schema = positional order in output.
   */
  schema: z.ZodObject<T>;

  /**
   * Output mode.
   * - "object": Expect single object (one row)
   * - "array": Expect array of objects (multiple rows)
   */
  mode: OutputMode;

  /**
   * Input data to include in prompt.
   * Will be formatted for readability (JSON or text).
   * @optional
   */
  inputData?: unknown;

  /**
   * Format for input data in prompt.
   * @default "auto"
   */
  inputFormat?: InputFormat;

  /**
   * Override provider for this request.
   * @optional
   */
  provider?: Provider;

  /**
   * Temperature (0-2).
   * @default 0.0
   */
  temperature?: number;

  /**
   * Maximum tokens to generate.
   * @default 4096
   */
  maxTokens?: number;

  /**
   * Custom system prompt (positional instructions added automatically).
   * @optional
   */
  systemPrompt?: string;

  /**
   * Maximum rows to expect (for array mode).
   * Helps LLM know when to stop.
   * @optional
   */
  maxRows?: number;
}

/**
 * Token usage information.
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Result of a completion request.
 */
export interface CompletionResult<T> {
  /**
   * Parsed and validated data.
   * Type matches schema.
   */
  data: T;

  /**
   * Provider used for completion.
   */
  provider: Provider;

  /**
   * Raw LLM response (before parsing).
   */
  rawResponse: string;

  /**
   * Number of rows parsed (array mode).
   */
  rowCount?: number;

  /**
   * Parsing warnings (non-fatal issues).
   */
  warnings?: string[];

  /**
   * Token usage.
   */
  usage?: TokenUsage;
}

// ============================================================================
// Schema Analysis Types
// ============================================================================

/**
 * Field types supported by positional format.
 */
export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "enum"
  | "literal"
  | "array"
  | "json";

/**
 * Information about a schema field's position in the output.
 */
export interface PositionInfo {
  /**
   * Dot-notation path to the field (e.g., "user.name").
   */
  path: string;

  /**
   * Zero-based position in the output row.
   */
  position: number;

  /**
   * Type of the field for parsing.
   */
  type: FieldType;

  /**
   * Whether the field is optional.
   */
  optional: boolean;

  /**
   * Whether the field is nullable.
   */
  nullable: boolean;

  /**
   * For enum types, the allowed values.
   */
  enumValues?: string[];

  /**
   * For literal types, the allowed value(s).
   */
  literalValue?: unknown;

  /**
   * For array types, the type of array items.
   */
  arrayItemType?: FieldType;
}

// ============================================================================
// Parser Types
// ============================================================================

/**
 * Configuration for the positional parser.
 */
export interface ParserConfig {
  delimiter: string;
  subDelimiter: string;
  escapeChar: string;
}

/**
 * Result of parsing positional output.
 */
export interface ParseResult<T> {
  data: T;
  warnings: string[];
}

// ============================================================================
// Provider Types (Internal)
// ============================================================================

/**
 * Options passed to provider complete method.
 */
export interface ProviderOptions {
  temperature?: number;
  maxTokens?: number;
}

/**
 * Response from a provider.
 */
export interface ProviderResponse {
  content: string;
  usage?: TokenUsage;
}

// ============================================================================
// Prompt Builder Types
// ============================================================================

/**
 * Configuration for prompt building.
 */
export interface PromptConfig {
  delimiter: string;
  subDelimiter: string;
  mode: OutputMode;
  maxRows?: number;
  customSystemPrompt?: string;
}
