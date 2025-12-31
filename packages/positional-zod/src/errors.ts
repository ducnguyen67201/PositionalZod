import type { ZodError } from "zod";
import type { Provider } from "./types.js";

/**
 * Base error class for all positional-zod errors.
 */
export class PositionalZodError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PositionalZodError";
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when a provider API call fails.
 * Includes authentication errors, rate limits, timeouts, etc.
 */
export class ProviderError extends PositionalZodError {
  /**
   * The provider that failed.
   */
  readonly provider: Provider;

  /**
   * HTTP status code if available.
   */
  readonly statusCode?: number;

  /**
   * Original error from the provider SDK.
   * Inherited from Error.cause
   */
  override readonly cause?: Error;

  constructor(
    message: string,
    provider: Provider,
    options?: { statusCode?: number; cause?: Error }
  ) {
    super(message);
    this.name = "ProviderError";
    this.provider = provider;
    this.statusCode = options?.statusCode;
    this.cause = options?.cause;
  }
}

/**
 * Error thrown when parsing positional output fails.
 * Includes column count mismatches, malformed rows, etc.
 */
export class ParseError extends PositionalZodError {
  /**
   * The raw response that failed to parse.
   */
  readonly rawResponse: string;

  /**
   * Which row failed (0-indexed), if applicable.
   */
  readonly rowIndex?: number;

  /**
   * Expected number of columns.
   */
  readonly expectedColumns: number;

  /**
   * Actual number of columns found.
   */
  readonly actualColumns: number;

  constructor(
    message: string,
    options: {
      rawResponse: string;
      rowIndex?: number;
      expectedColumns: number;
      actualColumns: number;
    }
  ) {
    super(message);
    this.name = "ParseError";
    this.rawResponse = options.rawResponse;
    this.rowIndex = options.rowIndex;
    this.expectedColumns = options.expectedColumns;
    this.actualColumns = options.actualColumns;
  }
}

/**
 * Error thrown when Zod validation fails after parsing.
 */
export class ValidationError extends PositionalZodError {
  /**
   * The Zod error containing validation issues.
   */
  readonly zodError: ZodError;

  /**
   * The data that was parsed before validation failed.
   */
  readonly parsedData: unknown;

  /**
   * Which row failed (0-indexed), if applicable.
   */
  readonly rowIndex?: number;

  constructor(
    message: string,
    options: {
      zodError: ZodError;
      parsedData: unknown;
      rowIndex?: number;
    }
  ) {
    super(message);
    this.name = "ValidationError";
    this.zodError = options.zodError;
    this.parsedData = options.parsedData;
    this.rowIndex = options.rowIndex;
  }
}

/**
 * Error thrown when a schema structure is not supported.
 */
export class SchemaError extends PositionalZodError {
  /**
   * The path in the schema that is unsupported.
   */
  readonly schemaPath: string;

  /**
   * The unsupported type name.
   */
  readonly typeName?: string;

  constructor(
    message: string,
    options: {
      schemaPath: string;
      typeName?: string;
    }
  ) {
    super(message);
    this.name = "SchemaError";
    this.schemaPath = options.schemaPath;
    this.typeName = options.typeName;
  }
}
