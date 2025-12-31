/**
 * Type coercion utilities for converting string values to typed values.
 */

import type { FieldType } from "../types.js";

/**
 * Configuration for type coercion.
 */
export interface CoercionConfig {
  subDelimiter: string;
}

/**
 * Coerce a string value to the appropriate type.
 *
 * @param value - The string value to coerce
 * @param type - The target type
 * @param config - Coercion configuration
 * @returns The coerced value, or undefined for empty strings
 */
export function coerceValue(
  value: string,
  type: FieldType,
  config: CoercionConfig
): unknown {
  // Empty string means undefined/missing value
  if (value === "") {
    return undefined;
  }

  switch (type) {
    case "string":
      return value;

    case "number":
      return coerceNumber(value);

    case "boolean":
      return coerceBoolean(value);

    case "date":
      return coerceDate(value);

    case "array":
      return coerceArray(value, config.subDelimiter);

    case "json":
      return coerceJson(value);

    case "enum":
    case "literal":
      // Enums and literals are just strings that get validated by Zod
      return value;

    default:
      return value;
  }
}

/**
 * Coerce a string to a number.
 */
function coerceNumber(value: string): number {
  const trimmed = value.trim();

  // Handle special cases
  if (trimmed.toLowerCase() === "nan") {
    return NaN;
  }
  if (trimmed.toLowerCase() === "infinity" || trimmed === "+Infinity") {
    return Infinity;
  }
  if (trimmed === "-Infinity") {
    return -Infinity;
  }

  const num = Number(trimmed);
  return num;
}

/**
 * Coerce a string to a boolean.
 */
function coerceBoolean(value: string): boolean {
  const trimmed = value.trim().toLowerCase();

  // True values
  if (trimmed === "true" || trimmed === "1" || trimmed === "yes") {
    return true;
  }

  // False values
  if (trimmed === "false" || trimmed === "0" || trimmed === "no") {
    return false;
  }

  // Default to checking truthiness for other values
  return Boolean(trimmed);
}

/**
 * Coerce a string to a Date.
 */
function coerceDate(value: string): Date {
  const trimmed = value.trim();

  // Try parsing as ISO date
  const date = new Date(trimmed);

  return date;
}

/**
 * Coerce a string to an array using sub-delimiter.
 */
function coerceArray(value: string, subDelimiter: string): string[] {
  // Split by sub-delimiter
  const items = value.split(subDelimiter);

  // Trim whitespace from each item
  return items.map((item) => item.trim());
}

/**
 * Coerce a string to a JSON value.
 */
function coerceJson(value: string): unknown {
  const trimmed = value.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // If JSON parsing fails, return the original string
    // Let Zod validation handle the error
    return trimmed;
  }
}

/**
 * Coerce array items to a specific type.
 */
export function coerceArrayItems(
  items: string[],
  itemType: FieldType,
  config: CoercionConfig
): unknown[] {
  return items.map((item) => coerceValue(item, itemType, config));
}
