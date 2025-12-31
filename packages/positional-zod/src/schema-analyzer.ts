/**
 * Schema analyzer for converting Zod schemas to position mappings.
 * Supports both Zod v3 and v4.
 */

import type { z } from "zod";
import type { FieldType, PositionInfo } from "./types.js";
import { SchemaError } from "./errors.js";

// ============================================================================
// Zod v3/v4 Compatibility Helpers
// ============================================================================

/**
 * Get the internal definition from a Zod schema.
 * Works with both Zod v3 (_def) and v4 (_zod.def).
 */
function getDef(schema: z.ZodTypeAny): Record<string, unknown> {
  const schemaAny = schema as unknown as Record<string, unknown>;

  // Try v4 first: schema._zod.def
  const zodProp = schemaAny["_zod"] as Record<string, unknown> | undefined;
  if (zodProp?.["def"]) {
    return zodProp["def"] as Record<string, unknown>;
  }

  // Fall back to v3: schema._def
  if (schemaAny["_def"]) {
    return schemaAny["_def"] as Record<string, unknown>;
  }

  return {};
}

/**
 * Map of Zod v4 lowercase type names to Zod v3-style type names.
 */
const v4TypeMap: Record<string, string> = {
  string: "ZodString",
  number: "ZodNumber",
  boolean: "ZodBoolean",
  date: "ZodDate",
  object: "ZodObject",
  array: "ZodArray",
  enum: "ZodEnum",
  nativeEnum: "ZodNativeEnum",
  literal: "ZodLiteral",
  optional: "ZodOptional",
  nullable: "ZodNullable",
  default: "ZodDefault",
  catch: "ZodCatch",
  branded: "ZodBranded",
  pipeline: "ZodPipeline",
  readonly: "ZodReadonly",
  union: "ZodUnion",
  discriminatedUnion: "ZodDiscriminatedUnion",
  effects: "ZodEffects",
  any: "ZodAny",
  unknown: "ZodUnknown",
  record: "ZodRecord",
  map: "ZodMap",
  set: "ZodSet",
  function: "ZodFunction",
  lazy: "ZodLazy",
  promise: "ZodPromise",
};

/**
 * Get the type name from a Zod schema.
 * Works with both Zod v3 and v4.
 *
 * Zod v3: Uses `_def.typeName` (e.g., "ZodString")
 * Zod v4: Uses `_zod.def.type` (e.g., "string") - we convert to v3 format
 */
function getTypeName(schema: z.ZodTypeAny): string {
  const def = getDef(schema);

  // v3: typeName is directly available
  if (def["typeName"]) {
    return def["typeName"] as string;
  }

  // v4: type is lowercase, convert to ZodXxx format
  const v4Type = def["type"] as string;
  if (v4Type && v4TypeMap[v4Type]) {
    return v4TypeMap[v4Type];
  }

  // Fallback for unknown types
  return v4Type ? `Zod${v4Type.charAt(0).toUpperCase()}${v4Type.slice(1)}` : "Unknown";
}

/**
 * Get the inner type from a wrapper schema (optional, nullable, array, etc.).
 *
 * Zod v3: Uses `innerType` or `type`
 * Zod v4: Uses `innerType` for wrappers, `element` for arrays
 */
function getInnerType(schema: z.ZodTypeAny): z.ZodTypeAny | null {
  const def = getDef(schema);

  // Try various property names used across versions
  // Note: Check innerType first, then element (v4 arrays), then type (v3 arrays)
  // But don't return `type` if it's a string (v4 uses type: "array" as a string)
  const innerType = def["innerType"];
  if (innerType && typeof innerType === "object") {
    return innerType as z.ZodTypeAny;
  }

  // v4 arrays use "element"
  const element = def["element"];
  if (element && typeof element === "object") {
    return element as z.ZodTypeAny;
  }

  // v3 arrays use "type"
  const type = def["type"];
  if (type && typeof type === "object") {
    return type as z.ZodTypeAny;
  }

  // v3 ZodEffects uses "schema"
  const schemaInner = def["schema"];
  if (schemaInner && typeof schemaInner === "object") {
    return schemaInner as z.ZodTypeAny;
  }

  return null;
}

/**
 * Get the shape of an object schema.
 */
function getShape(
  schema: z.ZodTypeAny
): Record<string, z.ZodTypeAny> | null {
  const def = getDef(schema);

  // v3 and v4 both use "shape" but it might be a function in some versions
  const shape = def["shape"];

  if (typeof shape === "function") {
    return shape() as Record<string, z.ZodTypeAny>;
  }

  if (shape && typeof shape === "object") {
    return shape as Record<string, z.ZodTypeAny>;
  }

  return null;
}

/**
 * Get enum values from an enum schema.
 *
 * Zod v3: def.values (array of strings)
 * Zod v4: def.entries (plain object { a: 'a', b: 'b' })
 */
function getEnumValues(schema: z.ZodTypeAny): string[] {
  const def = getDef(schema);

  // v3: def.values (array)
  if (Array.isArray(def["values"])) {
    return def["values"] as string[];
  }

  // v4: def.entries (plain object like { a: 'a', b: 'b' })
  const entries = def["entries"];
  if (entries && typeof entries === "object" && !Array.isArray(entries)) {
    // Could be a Map (unlikely in v4) or a plain object
    if (entries instanceof Map) {
      return Array.from(entries.keys()) as string[];
    }
    // Plain object - return the keys (which equal the values for string enums)
    return Object.keys(entries as Record<string, unknown>);
  }

  // v4 alternative: def.values could be a Set
  const values = def["values"];
  if (values instanceof Set) {
    return Array.from(values) as string[];
  }

  return [];
}

/**
 * Get literal value(s) from a literal schema.
 *
 * Zod v3: def.value (single value)
 * Zod v4: def.values (array)
 */
function getLiteralValue(schema: z.ZodTypeAny): unknown {
  const def = getDef(schema);

  // v4: def.values (array)
  const values = def["values"];
  if (Array.isArray(values)) {
    return values.length === 1 ? values[0] : values;
  }

  // v4 alternative: could be a Set
  if (values instanceof Set) {
    const arr = Array.from(values);
    return arr.length === 1 ? arr[0] : arr;
  }

  // v3: def.value (single value)
  return def["value"];
}

// ============================================================================
// Schema Analysis
// ============================================================================

/**
 * Analyze a Zod object schema and return position information for each field.
 *
 * @param schema - The Zod object schema to analyze
 * @returns Array of position info for each field, in order
 * @throws SchemaError if the schema contains unsupported types
 */
export function analyzeSchema<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>
): PositionInfo[] {
  const positions: PositionInfo[] = [];
  let currentPosition = 0;

  function analyze(
    fieldSchema: z.ZodTypeAny,
    path: string,
    optional: boolean,
    nullable: boolean
  ): void {
    const typeName = getTypeName(fieldSchema);

    switch (typeName) {
      case "ZodString":
        positions.push({
          path,
          position: currentPosition++,
          type: "string",
          optional,
          nullable,
        });
        break;

      case "ZodNumber":
        positions.push({
          path,
          position: currentPosition++,
          type: "number",
          optional,
          nullable,
        });
        break;

      case "ZodBoolean":
        positions.push({
          path,
          position: currentPosition++,
          type: "boolean",
          optional,
          nullable,
        });
        break;

      case "ZodDate":
        positions.push({
          path,
          position: currentPosition++,
          type: "date",
          optional,
          nullable,
        });
        break;

      case "ZodEnum":
      case "ZodNativeEnum":
        positions.push({
          path,
          position: currentPosition++,
          type: "enum",
          optional,
          nullable,
          enumValues: getEnumValues(fieldSchema),
        });
        break;

      case "ZodLiteral":
        positions.push({
          path,
          position: currentPosition++,
          type: "literal",
          optional,
          nullable,
          literalValue: getLiteralValue(fieldSchema),
        });
        break;

      case "ZodOptional":
      case "ZodNullable": {
        const inner = getInnerType(fieldSchema);
        if (inner) {
          analyze(
            inner,
            path,
            optional || typeName === "ZodOptional",
            nullable || typeName === "ZodNullable"
          );
        }
        break;
      }

      case "ZodDefault":
      case "ZodCatch":
      case "ZodBranded":
      case "ZodPipeline":
      case "ZodReadonly": {
        // Unwrap these wrapper types
        const inner = getInnerType(fieldSchema);
        if (inner) {
          analyze(inner, path, optional, nullable);
        }
        break;
      }

      case "ZodArray": {
        const inner = getInnerType(fieldSchema);
        if (inner) {
          const innerTypeName = getTypeName(inner);
          const isObjectArray = innerTypeName === "ZodObject";

          positions.push({
            path,
            position: currentPosition++,
            type: isObjectArray ? "json" : "array",
            optional,
            nullable,
            arrayItemType: isObjectArray ? undefined : getFieldType(inner),
          });
        }
        break;
      }

      case "ZodObject": {
        // Flatten nested objects with dot notation
        const shape = getShape(fieldSchema);
        if (shape) {
          for (const [key, value] of Object.entries(shape)) {
            const nestedPath = path ? `${path}.${key}` : key;
            analyze(value, nestedPath, optional, nullable);
          }
        }
        break;
      }

      case "ZodUnion":
      case "ZodDiscriminatedUnion": {
        // For unions, try to determine the best type
        // Default to string and let Zod validation handle it
        positions.push({
          path,
          position: currentPosition++,
          type: "string",
          optional,
          nullable,
        });
        break;
      }

      case "ZodEffects": {
        // ZodEffects wraps transforms, refinements, etc.
        const inner = getInnerType(fieldSchema);
        if (inner) {
          analyze(inner, path, optional, nullable);
        } else {
          // If no inner type, treat as string
          positions.push({
            path,
            position: currentPosition++,
            type: "string",
            optional,
            nullable,
          });
        }
        break;
      }

      case "ZodAny":
      case "ZodUnknown":
        positions.push({
          path,
          position: currentPosition++,
          type: "string",
          optional,
          nullable,
        });
        break;

      case "ZodRecord":
      case "ZodMap":
      case "ZodSet":
      case "ZodFunction":
      case "ZodLazy":
      case "ZodPromise":
        throw new SchemaError(
          `Unsupported schema type "${typeName}" at path "${path}". ` +
            `Use a supported type or flatten your schema.`,
          { schemaPath: path, typeName }
        );

      default:
        // Unknown type, default to string
        positions.push({
          path,
          position: currentPosition++,
          type: "string",
          optional,
          nullable,
        });
    }
  }

  // Get the shape of the root object
  const shape = getShape(schema);
  if (!shape) {
    throw new SchemaError("Schema must be a ZodObject with a shape", {
      schemaPath: "",
      typeName: getTypeName(schema),
    });
  }

  // Analyze each field in order
  for (const [key, value] of Object.entries(shape)) {
    analyze(value, key, false, false);
  }

  return positions;
}

/**
 * Get the field type for a simple schema (used for array item types).
 */
function getFieldType(schema: z.ZodTypeAny): FieldType {
  const typeName = getTypeName(schema);

  switch (typeName) {
    case "ZodString":
      return "string";
    case "ZodNumber":
      return "number";
    case "ZodBoolean":
      return "boolean";
    case "ZodDate":
      return "date";
    case "ZodEnum":
    case "ZodNativeEnum":
      return "enum";
    case "ZodLiteral":
      return "literal";
    case "ZodObject":
      return "json";
    default:
      return "string";
  }
}

/**
 * Get a map of field paths to their position info (useful for debugging).
 */
export function getSchemaPositionMap<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>
): Record<string, PositionInfo> {
  const positions = analyzeSchema(schema);
  return Object.fromEntries(positions.map((p) => [p.path, p]));
}
