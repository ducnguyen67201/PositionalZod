/**
 * Prompt builder for generating LLM instructions for positional format.
 */

import type { PositionInfo, PromptConfig, InputFormat } from "./types.js";

/**
 * Format a field type for display in the prompt.
 */
function formatFieldType(position: PositionInfo, subDelimiter: string): string {
  switch (position.type) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean (true or false)";
    case "date":
      return "date (ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)";
    case "enum":
      if (position.enumValues?.length) {
        return `one of: ${position.enumValues.join(", ")}`;
      }
      return "enum value";
    case "literal":
      return `exactly: ${JSON.stringify(position.literalValue)}`;
    case "array":
      return `array (use "${subDelimiter}" between items)`;
    case "json":
      return "JSON array of objects";
    default:
      return "string";
  }
}

/**
 * Generate an example value for a field type.
 */
function generateExampleValue(
  position: PositionInfo,
  subDelimiter: string
): string {
  switch (position.type) {
    case "string":
      return "example_text";
    case "number":
      return "42";
    case "boolean":
      return "true";
    case "date":
      return "2024-01-15";
    case "enum":
      return position.enumValues?.[0] ?? "value";
    case "literal":
      return String(position.literalValue);
    case "array":
      if (position.arrayItemType === "number") {
        return `1${subDelimiter}2${subDelimiter}3`;
      }
      return `item1${subDelimiter}item2${subDelimiter}item3`;
    case "json":
      return '[{"key":"value"}]';
    default:
      return "value";
  }
}

/**
 * Build the system prompt for positional format output.
 *
 * @param positions - Position info for each field
 * @param config - Prompt configuration
 * @returns The system prompt string
 */
export function buildSystemPrompt(
  positions: PositionInfo[],
  config: PromptConfig
): string {
  const { delimiter, subDelimiter, mode, maxRows, customSystemPrompt } = config;

  // Build schema description
  const schemaLines = positions.map((pos) => {
    const typeDesc = formatFieldType(pos, subDelimiter);
    const optionalTag = pos.optional ? " (optional)" : "";
    const nullableTag = pos.nullable ? " (nullable)" : "";
    return `${pos.position}: ${pos.path} - ${typeDesc}${optionalTag}${nullableTag}`;
  });

  // Build example output
  const exampleValues = positions.map((pos) =>
    generateExampleValue(pos, subDelimiter)
  );
  const exampleRow = exampleValues.join(delimiter);

  // Build the prompt
  const parts: string[] = [];

  // Add custom system prompt first if provided
  if (customSystemPrompt) {
    parts.push(customSystemPrompt);
    parts.push("");
  }

  parts.push("OUTPUT FORMAT:");
  parts.push(
    `Respond ONLY in positional format with "${delimiter}" as the delimiter between fields.`
  );
  parts.push("");

  parts.push("SCHEMA (output values in this exact order):");
  parts.push(...schemaLines);
  parts.push("");

  parts.push("EXAMPLE OUTPUT:");
  parts.push(exampleRow);
  if (mode === "array") {
    // Show a second example row for array mode
    parts.push(exampleRow.replace(/example_text/g, "other_text"));
  }
  parts.push("");

  parts.push("RULES:");
  if (mode === "array") {
    parts.push("- Output ONE ROW PER OBJECT (multiple rows expected)");
    if (maxRows) {
      parts.push(`- Output at most ${maxRows} rows`);
    }
  } else {
    parts.push("- Output EXACTLY ONE ROW (single object)");
  }
  parts.push("- Fields MUST be in the exact order shown above");
  parts.push(
    `- For optional/missing fields, leave empty between delimiters: val1${delimiter}${delimiter}val3`
  );
  parts.push(`- If a value contains "${delimiter}", escape it as "\\${delimiter}"`);
  parts.push(
    `- For array fields, separate items with "${subDelimiter}": item1${subDelimiter}item2${subDelimiter}item3`
  );
  parts.push("- For array-of-objects fields, use inline JSON: [{...},{...}]");
  parts.push("- Output ONLY the data rows - no headers, no explanations, no markdown");

  return parts.join("\n");
}

/**
 * Build the user prompt with optional input data.
 *
 * @param prompt - The user's instruction/question
 * @param inputData - Optional input data to include
 * @param inputFormat - Format for the input data
 * @returns The user prompt string
 */
export function buildUserPrompt(
  prompt: string,
  inputData?: unknown,
  inputFormat: InputFormat = "auto"
): string {
  if (inputData === undefined || inputData === null) {
    return prompt;
  }

  const formattedData = formatInputData(inputData, inputFormat);

  return `${prompt}\n\nINPUT DATA:\n${formattedData}`;
}

/**
 * Format input data for inclusion in the prompt.
 */
function formatInputData(data: unknown, format: InputFormat): string {
  if (format === "text" || (format === "auto" && typeof data === "string")) {
    return String(data);
  }

  // JSON format
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

/**
 * Build combined prompts for a completion request.
 */
export function buildPrompts(
  positions: PositionInfo[],
  userPrompt: string,
  config: PromptConfig & {
    inputData?: unknown;
    inputFormat?: InputFormat;
  }
): { systemPrompt: string; userPrompt: string } {
  return {
    systemPrompt: buildSystemPrompt(positions, config),
    userPrompt: buildUserPrompt(userPrompt, config.inputData, config.inputFormat),
  };
}
