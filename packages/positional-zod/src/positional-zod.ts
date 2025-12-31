/**
 * Main PositionalZod class for schema-driven positional format LLM completions.
 */

import type { z } from "zod";
import type {
  PositionalZodConfig,
  ResolvedConfig,
  CompletionOptions,
  CompletionResult,
  Provider,
  PositionInfo,
} from "./types.js";
import { ProviderError } from "./errors.js";
import { analyzeSchema, getSchemaPositionMap } from "./schema-analyzer.js";
import { buildSystemPrompt, buildUserPrompt } from "./prompt-builder.js";
import { parsePositionalOutput } from "./parser.js";
import { BaseProvider, createProvider } from "./providers/index.js";

/**
 * PositionalZod - Schema-driven positional format for LLM structured outputs.
 *
 * @example
 * ```typescript
 * const pz = new PositionalZod({
 *   providers: { openai: { apiKey: process.env.OPENAI_API_KEY } },
 *   defaultProvider: "openai",
 * });
 *
 * const result = await pz.complete({
 *   prompt: "Extract users from this data",
 *   schema: z.object({ id: z.number(), name: z.string() }),
 *   mode: "array",
 * });
 * ```
 */
export class PositionalZod {
  private config: ResolvedConfig;
  private providers: Map<Provider, BaseProvider> = new Map();

  constructor(config: PositionalZodConfig) {
    this.config = {
      delimiter: config.delimiter ?? "|",
      subDelimiter: config.subDelimiter ?? ";",
      escapeChar: config.escapeChar ?? "\\",
      fallbackProviders: config.fallbackProviders ?? [],
      debug: config.debug ?? false,
      providers: config.providers,
      defaultProvider: config.defaultProvider,
    };

    // Validate that default provider has config
    if (!config.providers[config.defaultProvider]) {
      throw new Error(
        `Default provider "${config.defaultProvider}" is not configured in providers`
      );
    }
  }

  /**
   * Execute a completion with automatic provider fallback.
   *
   * @param options - Completion options
   * @returns Parsed and validated result
   */
  async complete<T extends z.ZodRawShape>(
    options: CompletionOptions<T>
  ): Promise<CompletionResult<z.infer<z.ZodObject<T>> | z.infer<z.ZodObject<T>>[]>> {
    const provider = options.provider ?? this.config.defaultProvider;
    const providerOrder = [
      provider,
      ...this.config.fallbackProviders.filter((p) => p !== provider),
    ];

    let lastError: Error | undefined;

    for (const p of providerOrder) {
      // Skip if provider not configured
      if (!this.config.providers[p]) {
        this.log(`Skipping provider ${p}: not configured`);
        continue;
      }

      try {
        return await this.completeWithProvider(p, options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.log(`Provider ${p} failed: ${lastError.message}`);

        // Don't fallback for non-provider errors (parse errors, validation errors)
        if (!(error instanceof ProviderError)) {
          throw error;
        }
      }
    }

    throw lastError ?? new Error("All providers failed");
  }

  /**
   * Execute a completion with a specific provider (no fallback).
   *
   * @param provider - The provider to use
   * @param options - Completion options
   * @returns Parsed and validated result
   */
  async completeWithProvider<T extends z.ZodRawShape>(
    provider: Provider,
    options: CompletionOptions<T>
  ): Promise<CompletionResult<z.infer<z.ZodObject<T>> | z.infer<z.ZodObject<T>>[]>> {
    const providerInstance = this.getProvider(provider);

    // 1. Analyze schema to get positions
    const positions = analyzeSchema(options.schema);
    this.log("Schema positions:", positions);

    // 2. Build prompts
    const systemPrompt = buildSystemPrompt(positions, {
      delimiter: this.config.delimiter,
      subDelimiter: this.config.subDelimiter,
      mode: options.mode,
      maxRows: options.maxRows,
      customSystemPrompt: options.systemPrompt,
    });

    const userPrompt = buildUserPrompt(
      options.prompt,
      options.inputData,
      options.inputFormat
    );

    this.log("System prompt:", systemPrompt);
    this.log("User prompt:", userPrompt);

    // 3. Call provider
    const response = await providerInstance.complete(systemPrompt, userPrompt, {
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    });

    this.log("Raw response:", response.content);

    // 4. Parse response
    const parseResult = parsePositionalOutput(
      response.content,
      positions,
      options.schema,
      {
        delimiter: this.config.delimiter,
        subDelimiter: this.config.subDelimiter,
        escapeChar: this.config.escapeChar,
      },
      options.mode
    );

    this.log("Parsed result:", parseResult.data);

    // 5. Build and return result
    const result: CompletionResult<z.infer<z.ZodObject<T>> | z.infer<z.ZodObject<T>>[]> = {
      data: parseResult.data,
      provider,
      rawResponse: response.content,
      usage: response.usage,
    };

    if (parseResult.warnings && parseResult.warnings.length > 0) {
      result.warnings = parseResult.warnings;
    }

    if (options.mode === "array" && Array.isArray(parseResult.data)) {
      result.rowCount = parseResult.data.length;
    }

    return result;
  }

  /**
   * Get the positional mapping for a schema (useful for debugging).
   *
   * @param schema - The Zod schema to analyze
   * @returns Map of field paths to position info
   */
  getSchemaPositions<T extends z.ZodRawShape>(
    schema: z.ZodObject<T>
  ): Record<string, PositionInfo> {
    return getSchemaPositionMap(schema);
  }

  /**
   * Get or create a provider instance.
   */
  private getProvider(type: Provider): BaseProvider {
    let provider = this.providers.get(type);

    if (!provider) {
      provider = createProvider(type, this.config.providers);
      this.providers.set(type, provider);
    }

    return provider;
  }

  /**
   * Log a debug message if debug mode is enabled.
   */
  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log("[positional-zod]", ...args);
    }
  }
}
