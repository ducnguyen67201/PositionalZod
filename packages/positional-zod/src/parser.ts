/**
 * Parser for converting positional format output to typed objects.
 */

import type { z } from "zod";
import type {
  PositionInfo,
  ParserConfig,
  ParseResult,
  OutputMode,
} from "./types.js";
import { ParseError, ValidationError } from "./errors.js";
import { splitWithEscape } from "./utils/escape.js";
import { coerceValue, coerceArrayItems } from "./utils/coercion.js";

/**
 * Parse positional format output into typed objects.
 *
 * @param rawOutput - The raw LLM output in positional format
 * @param positions - Position info for each field
 * @param schema - The Zod schema for validation
 * @param config - Parser configuration
 * @param mode - Output mode (object or array)
 * @returns Parsed and validated result
 */
export function parsePositionalOutput<T extends z.ZodRawShape>(
  rawOutput: string,
  positions: PositionInfo[],
  schema: z.ZodObject<T>,
  config: ParserConfig,
  mode: OutputMode
): ParseResult<z.infer<z.ZodObject<T>> | z.infer<z.ZodObject<T>>[]> {
  const warnings: string[] = [];

  // Clean and split into rows
  const rows = cleanAndSplitRows(rawOutput);

  if (rows.length === 0) {
    throw new ParseError("No data rows found in output", {
      rawResponse: rawOutput,
      expectedColumns: positions.length,
      actualColumns: 0,
    });
  }

  // Parse each row
  const parsedRows: Record<string, unknown>[] = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]!;

    try {
      const parsed = parseRow(row, positions, config, rowIndex);
      parsedRows.push(parsed);
    } catch (error) {
      if (error instanceof ParseError) {
        throw error;
      }
      throw new ParseError(`Failed to parse row ${rowIndex}: ${String(error)}`, {
        rawResponse: row,
        rowIndex,
        expectedColumns: positions.length,
        actualColumns: 0,
      });
    }
  }

  // Validate with Zod
  if (mode === "object") {
    if (parsedRows.length > 1) {
      warnings.push(
        `Expected single object but got ${parsedRows.length} rows. Using first row.`
      );
    }

    const data = parsedRows[0]!;
    const validated = validateWithZod(schema, data, rawOutput, 0);

    return {
      data: validated as z.infer<z.ZodObject<T>>,
      warnings: warnings.length > 0 ? warnings : undefined,
    } as ParseResult<z.infer<z.ZodObject<T>>>;
  } else {
    // Array mode
    const validatedRows: z.infer<z.ZodObject<T>>[] = [];

    for (let i = 0; i < parsedRows.length; i++) {
      const validated = validateWithZod(schema, parsedRows[i]!, rawOutput, i);
      validatedRows.push(validated as z.infer<z.ZodObject<T>>);
    }

    return {
      data: validatedRows,
      warnings: warnings.length > 0 ? warnings : undefined,
    } as ParseResult<z.infer<z.ZodObject<T>>[]>;
  }
}

/**
 * Clean raw output and split into rows.
 */
function cleanAndSplitRows(rawOutput: string): string[] {
  return rawOutput
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Parse a single row into an object.
 */
function parseRow(
  row: string,
  positions: PositionInfo[],
  config: ParserConfig,
  rowIndex: number
): Record<string, unknown> {
  const { delimiter, escapeChar, subDelimiter } = config;

  // Split the row by delimiter, respecting escapes
  const values = splitWithEscape(row, delimiter, escapeChar);

  // Validate column count
  if (values.length !== positions.length) {
    throw new ParseError(
      `Row ${rowIndex}: Expected ${positions.length} columns but got ${values.length}`,
      {
        rawResponse: row,
        rowIndex,
        expectedColumns: positions.length,
        actualColumns: values.length,
      }
    );
  }

  // Build the object
  const result: Record<string, unknown> = {};

  for (const position of positions) {
    const rawValue = values[position.position]!;

    // Coerce the value to the appropriate type
    let value = coerceValue(rawValue, position.type, { subDelimiter });

    // Handle array item coercion
    if (position.type === "array" && Array.isArray(value) && position.arrayItemType) {
      value = coerceArrayItems(
        value as string[],
        position.arrayItemType,
        { subDelimiter }
      );
    }

    // Handle null for nullable fields
    if (position.nullable && rawValue.toLowerCase() === "null") {
      value = null;
    }

    // Set the value at the correct path (handling nested objects)
    setNestedValue(result, position.path, value);
  }

  return result;
}

/**
 * Set a value at a nested path using dot notation.
 *
 * @example
 * setNestedValue({}, "user.name", "Alice")
 * // { user: { name: "Alice" } }
 */
function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const parts = path.split(".");
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (!(part in current) || typeof current[part] !== "object" || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1]!;
  current[lastPart] = value;
}

/**
 * Validate parsed data with Zod schema.
 */
function validateWithZod<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  data: Record<string, unknown>,
  _rawResponse: string,
  rowIndex: number
): z.infer<z.ZodObject<T>> {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new ValidationError(
      `Validation failed for row ${rowIndex}: ${result.error.message}`,
      {
        zodError: result.error,
        parsedData: data,
        rowIndex,
      }
    );
  }

  return result.data;
}

/**
 * Parse a single row without validation (useful for testing).
 */
export function parseRowRaw(
  row: string,
  positions: PositionInfo[],
  config: ParserConfig
): Record<string, unknown> {
  return parseRow(row, positions, config, 0);
}
