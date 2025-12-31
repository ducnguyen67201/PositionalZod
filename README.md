# positional-zod

**Schema-driven positional format for LLM structured outputs**

A multi-provider LLM wrapper that uses a minimal positional format derived from [Zod](https://zod.dev) schemas for maximum token efficiency and reliable parsing.

## Why positional-zod?

| Problem | Solution |
|---------|----------|
| JSON wastes tokens on repeated keys | Positional format: **~60% fewer tokens** |
| TOON still has syntax overhead | Pure values + delimiter, no formatting |
| LLMs struggle with complex formats | Dead simple: just output values in order |
| Parsing failures | Schema-driven parsing with type coercion |

## Token Comparison

```
JSON:        45 tokens  ████████████████████████████████████████████░
TOON:        28 tokens  ████████████████████████████░░░░░░░░░░░░░░░░░
Positional:  18 tokens  ██████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░
                        └─────────────────────────────────────────────┘
                        60% savings vs JSON!
```

## Installation

```bash
npm install positional-zod zod

# Install provider SDKs as needed (peer dependencies)
npm install openai                    # For OpenAI
npm install @anthropic-ai/sdk         # For Anthropic
npm install @google/generative-ai     # For Google Gemini
```

## Quick Start

```typescript
import { PositionalZod } from "positional-zod";
import { z } from "zod";

// 1. Create instance
const pz = new PositionalZod({
  providers: {
    openai: { apiKey: process.env.OPENAI_API_KEY },
  },
  defaultProvider: "openai",
});

// 2. Define schema (this drives the positional format)
const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  score: z.number(),
});

// 3. Execute - LLM outputs positional data
const result = await pz.complete({
  prompt: "Extract the top 3 users from this leaderboard",
  inputData: leaderboardText,
  schema: UserSchema,
  mode: "array",
});

// LLM outputs:
// 1|Alice|95.5
// 2|Bob|87.0
// 3|Charlie|92.3

// Parsed & validated result:
console.log(result.data);
// [
//   { id: 1, name: "Alice", score: 95.5 },
//   { id: 2, name: "Bob", score: 87.0 },
//   { id: 3, name: "Charlie", score: 92.3 }
// ]
```

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Format Specification](#format-specification)
  - [Single Object](#single-object)
  - [Array of Objects](#array-of-objects)
  - [Nested Objects](#nested-objects)
  - [Arrays Within Objects](#arrays-within-objects)
  - [Optional Fields](#optional-fields)
  - [Enums](#enums)
- [API Reference](#api-reference)
  - [PositionalZod Class](#positionalzod-class)
  - [Configuration](#configuration)
  - [Completion Options](#completion-options)
  - [Completion Result](#completion-result)
- [Schema Support](#schema-support)
- [Providers](#providers)
- [Error Handling](#error-handling)
- [Advanced Usage](#advanced-usage)
- [Architecture](#architecture)
- [Trade-offs](#trade-offs)

---

## Format Specification

### Core Principle

The Zod schema defines field order. LLM outputs **only values** separated by a delimiter.

```typescript
// Schema defines: id (position 0), name (position 1), score (position 2)
const Schema = z.object({
  id: z.number(),
  name: z.string(),
  score: z.number(),
});

// LLM outputs values in that order:
// 1|Alice|95.5
//   ↑      ↑     ↑
// pos 0  pos 1  pos 2
```

### Single Object

**Schema:**
```typescript
const ProductSchema = z.object({
  sku: z.string(),
  name: z.string(),
  price: z.number(),
  inStock: z.boolean(),
});
```

**LLM Output:**
```
SKU-123|Widget Pro|29.99|true
```

**Parsed Result:**
```json
{
  "sku": "SKU-123",
  "name": "Widget Pro",
  "price": 29.99,
  "inStock": true
}
```

### Array of Objects

**Schema:**
```typescript
const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
});
```

**LLM Output (one row per object):**
```
1|Alice|alice@example.com
2|Bob|bob@example.com
3|Charlie|charlie@example.com
```

**Parsed Result:**
```json
[
  { "id": 1, "name": "Alice", "email": "alice@example.com" },
  { "id": 2, "name": "Bob", "email": "bob@example.com" },
  { "id": 3, "name": "Charlie", "email": "charlie@example.com" }
]
```

### Nested Objects

Nested objects are **flattened** using dot notation in the schema instruction, but output remains positional.

**Schema:**
```typescript
const OrderSchema = z.object({
  orderId: z.string(),
  customer: z.object({
    name: z.string(),
    email: z.string(),
  }),
  total: z.number(),
});
```

**Flattened positions:**
```
Position 0: orderId
Position 1: customer.name
Position 2: customer.email
Position 3: total
```

**LLM Output:**
```
ORD-001|Alice Smith|alice@example.com|149.99
```

**Parsed Result:**
```json
{
  "orderId": "ORD-001",
  "customer": {
    "name": "Alice Smith",
    "email": "alice@example.com"
  },
  "total": 149.99
}
```

### Arrays Within Objects

Arrays within objects use a **sub-delimiter** (default: `;`).

**Schema:**
```typescript
const ArticleSchema = z.object({
  title: z.string(),
  tags: z.array(z.string()),
  views: z.number(),
});
```

**LLM Output:**
```
My Article|tech;tutorial;beginner|1500
```

**Parsed Result:**
```json
{
  "title": "My Article",
  "tags": ["tech", "tutorial", "beginner"],
  "views": 1500
}
```

### Arrays of Objects Within Objects

For complex nested arrays, use JSON within the positional format.

**Schema:**
```typescript
const InvoiceSchema = z.object({
  invoiceId: z.string(),
  items: z.array(z.object({
    name: z.string(),
    qty: z.number(),
    price: z.number(),
  })),
  total: z.number(),
});
```

**LLM Output (items as inline JSON):**
```
INV-001|[{"name":"Widget","qty":2,"price":10},{"name":"Gadget","qty":1,"price":25}]|45.00
```

**Parsed Result:**
```json
{
  "invoiceId": "INV-001",
  "items": [
    { "name": "Widget", "qty": 2, "price": 10 },
    { "name": "Gadget", "qty": 1, "price": 25 }
  ],
  "total": 45.00
}
```

### Optional Fields

Optional fields use empty value (nothing between delimiters).

**Schema:**
```typescript
const ContactSchema = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string().optional(),
  notes: z.string().optional(),
});
```

**LLM Output (phone missing, notes present):**
```
Alice|alice@example.com||Prefers email contact
```

**Parsed Result:**
```json
{
  "name": "Alice",
  "email": "alice@example.com",
  "phone": undefined,
  "notes": "Prefers email contact"
}
```

### Enums

Enums output the exact enum value.

**Schema:**
```typescript
const TaskSchema = z.object({
  title: z.string(),
  status: z.enum(["pending", "in_progress", "done"]),
  priority: z.enum(["low", "medium", "high"]),
});
```

**LLM Output:**
```
Fix login bug|in_progress|high
Update docs|done|low
```

### Special Characters & Escaping

Values containing the delimiter use **backslash escaping**.

**Schema:**
```typescript
const Schema = z.object({
  name: z.string(),
  description: z.string(),
});
```

**LLM Output (description contains `|`):**
```
Product|This is a red\|blue variant
```

**Parsed Result:**
```json
{
  "name": "Product",
  "description": "This is a red|blue variant"
}
```

---

## API Reference

### PositionalZod Class

```typescript
import { PositionalZod } from "positional-zod";

const pz = new PositionalZod(config: PositionalZodConfig);
```

#### Methods

##### `complete<T>(options: CompletionOptions<T>): Promise<CompletionResult<T>>`

Execute a completion with automatic provider fallback.

```typescript
// Single object
const result = await pz.complete({
  prompt: "Extract the product info",
  schema: ProductSchema,
  mode: "object",
});

// Array of objects
const result = await pz.complete({
  prompt: "List all users",
  schema: UserSchema,
  mode: "array",
});
```

##### `completeWithProvider<T>(provider, options): Promise<CompletionResult<T>>`

Execute with a specific provider (no fallback).

```typescript
const result = await pz.completeWithProvider("anthropic", {
  prompt: "Analyze data",
  schema: AnalysisSchema,
  mode: "object",
});
```

##### `getSchemaPositions<T>(schema: z.ZodObject<T>): PositionMap`

Get the positional mapping for a schema (useful for debugging).

```typescript
const positions = pz.getSchemaPositions(UserSchema);
// {
//   "id": { position: 0, type: "number" },
//   "name": { position: 1, type: "string" },
//   "email": { position: 2, type: "string" }
// }
```

---

### Configuration

#### `PositionalZodConfig`

```typescript
interface PositionalZodConfig {
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
```

#### `ProviderConfig`

```typescript
interface ProviderConfig {
  openai?: {
    apiKey: string;
    model?: string;        // default: "gpt-4o"
    organization?: string;
  };

  anthropic?: {
    apiKey: string;
    model?: string;        // default: "claude-sonnet-4-5-20250929"
  };

  google?: {
    apiKey: string;
    model?: string;        // default: "gemini-2.0-flash"
  };
}
```

#### `Provider`

```typescript
type Provider = "openai" | "anthropic" | "google";
```

---

### Completion Options

#### `CompletionOptions<T>`

```typescript
interface CompletionOptions<T> {
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
  mode: "object" | "array";

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
  inputFormat?: "json" | "text" | "auto";

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
```

---

### Completion Result

#### `CompletionResult<T>`

```typescript
interface CompletionResult<T> {
  /**
   * Parsed and validated data.
   * Type matches schema.
   */
  data: T;                    // object mode
  // OR
  data: T[];                  // array mode

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
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

---

## Schema Support

### Supported Zod Types

| Zod Type | Positional Representation | Example Output |
|----------|---------------------------|----------------|
| `z.string()` | Raw string | `hello world` |
| `z.number()` | Numeric string | `42` or `3.14` |
| `z.boolean()` | `true` / `false` | `true` |
| `z.enum([...])` | Enum value | `pending` |
| `z.literal(...)` | Literal value | `active` |
| `z.array(z.string())` | Sub-delimited | `a;b;c` |
| `z.array(z.number())` | Sub-delimited | `1;2;3` |
| `z.array(z.object())` | Inline JSON | `[{...},{...}]` |
| `z.object({...})` | Flattened positions | `val1\|val2\|val3` |
| `z.optional(...)` | Empty if missing | `val1\|\|val3` |
| `z.nullable(...)` | `null` or value | `null` |
| `z.date()` | ISO string | `2024-01-15` |
| `z.union([...])` | Best match | varies |

### Unsupported Types

| Zod Type | Reason | Workaround |
|----------|--------|------------|
| `z.record()` | Dynamic keys | Use `z.object()` with known keys |
| `z.map()` | Complex structure | Use array of key-value objects |
| `z.set()` | No order guarantee | Use `z.array()` |
| `z.function()` | Not serializable | N/A |
| `z.lazy()` | Recursive | Flatten to fixed depth |

---

## Providers

### OpenAI

```typescript
const pz = new PositionalZod({
  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: "gpt-4o",  // default
    },
  },
  defaultProvider: "openai",
});
```

**Recommended models:** `gpt-4o`, `gpt-4o-mini`

### Anthropic

```typescript
const pz = new PositionalZod({
  providers: {
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: "claude-sonnet-4-5-20250929",  // default
    },
  },
  defaultProvider: "anthropic",
});
```

**Recommended models:** `claude-sonnet-4-5-20250929`, `claude-3-5-haiku-20241022`

### Google Gemini

```typescript
const pz = new PositionalZod({
  providers: {
    google: {
      apiKey: process.env.GOOGLE_API_KEY,
      model: "gemini-2.0-flash",  // default
    },
  },
  defaultProvider: "google",
});
```

**Recommended models:** `gemini-2.0-flash`, `gemini-1.5-pro`

### Provider Fallback

```typescript
const pz = new PositionalZod({
  providers: {
    openai: { apiKey: "..." },
    anthropic: { apiKey: "..." },
    google: { apiKey: "..." },
  },
  defaultProvider: "openai",
  fallbackProviders: ["anthropic", "google"],
});

// Tries: OpenAI → Anthropic → Google
const result = await pz.complete({ ... });
```

---

## Error Handling

### Error Classes

```typescript
import {
  PositionalZodError,
  ProviderError,
  ParseError,
  ValidationError,
  SchemaError,
} from "positional-zod/errors";
```

#### `PositionalZodError`

Base error class.

#### `ProviderError`

Provider API failures (auth, rate limit, timeout).

```typescript
class ProviderError extends PositionalZodError {
  provider: Provider;
  statusCode?: number;
}
```

#### `ParseError`

Positional parsing failures.

```typescript
class ParseError extends PositionalZodError {
  rawResponse: string;
  rowIndex?: number;        // Which row failed (array mode)
  expectedColumns: number;  // Expected field count
  actualColumns: number;    // Actual field count
}
```

#### `ValidationError`

Zod validation failures after parsing.

```typescript
class ValidationError extends PositionalZodError {
  zodError: z.ZodError;
  parsedData: unknown;     // What was parsed before validation failed
  rowIndex?: number;       // Which row failed (array mode)
}
```

#### `SchemaError`

Unsupported schema structure.

```typescript
class SchemaError extends PositionalZodError {
  schemaPath: string;      // Which part of schema is unsupported
}
```

### Error Handling Example

```typescript
try {
  const result = await pz.complete({
    prompt: "Extract users",
    schema: UserSchema,
    mode: "array",
  });

  console.log(result.data);

} catch (error) {
  if (error instanceof ValidationError) {
    console.error(`Row ${error.rowIndex} validation failed:`);
    console.error(error.zodError.issues);

  } else if (error instanceof ParseError) {
    console.error(`Parse failed at row ${error.rowIndex}`);
    console.error(`Expected ${error.expectedColumns} columns, got ${error.actualColumns}`);
    console.error("Raw:", error.rawResponse);

  } else if (error instanceof ProviderError) {
    console.error(`Provider ${error.provider} failed:`, error.message);

  } else if (error instanceof SchemaError) {
    console.error(`Unsupported schema at: ${error.schemaPath}`);

  } else {
    throw error;
  }
}
```

---

## Advanced Usage

### Custom Delimiters

```typescript
const pz = new PositionalZod({
  providers: { ... },
  defaultProvider: "openai",
  delimiter: "\t",      // Tab-separated
  subDelimiter: ",",    // Comma for arrays
});
```

### Including Input Data

```typescript
// Input data is formatted and included in the prompt
const result = await pz.complete({
  prompt: "Summarize these sales by region",
  inputData: {
    sales: [
      { region: "North", amount: 50000 },
      { region: "South", amount: 35000 },
    ],
  },
  inputFormat: "json",  // or "text" for plain text
  schema: SummarySchema,
  mode: "array",
});
```

### Limiting Output Rows

```typescript
const result = await pz.complete({
  prompt: "List the top products",
  schema: ProductSchema,
  mode: "array",
  maxRows: 10,  // Instructs LLM to output max 10 rows
});
```

### Custom System Prompt

```typescript
const result = await pz.complete({
  prompt: "Extract entities from this legal document",
  schema: EntitySchema,
  mode: "array",
  systemPrompt: `You are a legal document analyzer.
Extract entities precisely as they appear in the document.
Do not infer or add information not present.`,
});
```

### Low Temperature for Consistency

```typescript
const result = await pz.complete({
  prompt: "Parse this structured data",
  schema: DataSchema,
  mode: "array",
  temperature: 0.0,  // Most deterministic (recommended for parsing)
});
```

### Debug Mode

```typescript
const pz = new PositionalZod({
  providers: { ... },
  defaultProvider: "openai",
  debug: true,
});

// Logs:
// [positional-zod] Schema positions: { id: 0, name: 1, ... }
// [positional-zod] Generated prompt: ...
// [positional-zod] Raw response: 1|Alice|95.5\n2|Bob|87.0
// [positional-zod] Parsed row 0: { id: 1, name: "Alice", ... }
// [positional-zod] Parsed row 1: { id: 2, name: "Bob", ... }
// [positional-zod] Validation passed: 2 rows
```

---

## Architecture

### Package Structure

```
packages/positional-zod/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts                    # Main exports
│   ├── types.ts                    # TypeScript interfaces
│   ├── positional-zod.ts           # Main class
│   ├── schema-analyzer.ts          # Zod schema → position mapping
│   ├── prompt-builder.ts           # Generate LLM instructions
│   ├── parser.ts                   # Parse positional output
│   ├── errors.ts                   # Error classes
│   ├── providers/
│   │   ├── index.ts
│   │   ├── base-provider.ts
│   │   ├── openai-provider.ts
│   │   ├── anthropic-provider.ts
│   │   └── google-provider.ts
│   └── utils/
│       ├── escape.ts               # Delimiter escaping
│       └── type-coercion.ts        # String → typed value
└── tests/
    ├── positional-zod.spec.ts
    ├── schema-analyzer.spec.ts
    ├── parser.spec.ts
    ├── prompt-builder.spec.ts
    └── providers/*.spec.ts
```

### Core Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        positional-zod Flow                               │
│                                                                          │
│  ┌──────────┐    ┌───────────────┐    ┌──────────┐    ┌──────────────┐  │
│  │   Zod    │───▶│    Analyze    │───▶│  Build   │───▶│     LLM      │  │
│  │  Schema  │    │   Positions   │    │  Prompt  │    │     Call     │  │
│  └──────────┘    └───────────────┘    └──────────┘    └──────────────┘  │
│                                                              │           │
│                                                              ▼           │
│  ┌──────────┐    ┌───────────────┐    ┌──────────┐    ┌──────────────┐  │
│  │  Typed   │◀───│     Zod       │◀───│  Parse   │◀───│  Positional  │  │
│  │  Result  │    │   Validate    │    │   Rows   │    │    Output    │  │
│  └──────────┘    └───────────────┘    └──────────┘    └──────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Schema Analysis

```typescript
// Input schema
const Schema = z.object({
  id: z.number(),
  user: z.object({
    name: z.string(),
    email: z.string(),
  }),
  tags: z.array(z.string()),
  active: z.boolean(),
});

// Analyzed positions (flattened)
{
  positions: [
    { path: "id", type: "number", position: 0 },
    { path: "user.name", type: "string", position: 1 },
    { path: "user.email", type: "string", position: 2 },
    { path: "tags", type: "array<string>", position: 3 },
    { path: "active", type: "boolean", position: 4 },
  ],
  delimiter: "|",
  subDelimiter: ";",
}
```

### Prompt Generation

The system prompt teaches the LLM the positional format:

```
OUTPUT FORMAT:
You must respond in positional format with | as delimiter.

Schema positions:
0: id (number)
1: user.name (string)
2: user.email (string)
3: tags (array, use ; between items)
4: active (boolean: true/false)

Example output:
42|John Doe|john@example.com|admin;user|true

RULES:
- One row per object
- Fields in exact order shown above
- Empty value for optional missing fields: val1||val3
- Escape | in values with \|
- Arrays use ; delimiter: item1;item2;item3
- No headers, no extra text, just data rows
```

### Parsing Algorithm

```typescript
function parsePositionalRow(
  row: string,
  positions: PositionInfo[],
  config: ParserConfig
): Record<string, unknown> {
  // 1. Split by delimiter (handling escapes)
  const values = splitWithEscape(row, config.delimiter, config.escapeChar);

  // 2. Validate column count
  if (values.length !== positions.length) {
    throw new ParseError(...);
  }

  // 3. Map to object with type coercion
  const result: Record<string, unknown> = {};

  for (const pos of positions) {
    const rawValue = values[pos.position];
    const typedValue = coerceType(rawValue, pos.type, config);
    setNestedValue(result, pos.path, typedValue);
  }

  return result;
}

function coerceType(value: string, type: string, config: ParserConfig): unknown {
  if (value === "") return undefined;

  switch (type) {
    case "number": return Number(value);
    case "boolean": return value === "true";
    case "array<string>": return value.split(config.subDelimiter);
    case "array<number>": return value.split(config.subDelimiter).map(Number);
    case "json": return JSON.parse(value);
    default: return value;  // string
  }
}
```

---

## Trade-offs

| Aspect | Trade-off | Mitigation |
|--------|-----------|------------|
| **No guaranteed format** | LLM might not follow positional format | Clear instructions + fallback parsing |
| **Order-dependent** | Schema field order matters | Explicit position documentation |
| **Complex nested arrays** | Fall back to inline JSON | Hybrid approach handles gracefully |
| **Escaping overhead** | Values with delimiters need escaping | Rare in practice; efficient escape handling |
| **Provider SDKs** | Must install separately | Peer deps keep package lean |

### When to Use positional-zod

**Ideal for:**
- Extracting structured data from text (entities, facts, lists)
- Parsing tables, CSVs, logs into typed objects
- High-volume LLM calls where token cost matters
- Multi-provider resilience requirements
- Type-safe LLM responses with Zod

**Not ideal for:**
- Complex deeply-nested JSON structures
- Dynamic schemas (use JSON mode)
- When you need guaranteed output format (use OpenAI `response_format`)
- Real-time applications where <5ms parsing overhead matters

---

## Dependencies

```json
{
  "dependencies": {
    "zod": "^3.23.0"
  },
  "peerDependencies": {
    "openai": "^4.0.0",
    "@anthropic-ai/sdk": "^0.30.0",
    "@google/generative-ai": "^0.21.0"
  },
  "peerDependenciesMeta": {
    "openai": { "optional": true },
    "@anthropic-ai/sdk": { "optional": true },
    "@google/generative-ai": { "optional": true }
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

---

## Examples

### Extract Entities from Text

```typescript
const EntitySchema = z.object({
  name: z.string(),
  type: z.enum(["person", "organization", "location"]),
  confidence: z.number(),
});

const result = await pz.complete({
  prompt: "Extract all named entities from this news article",
  inputData: articleText,
  schema: EntitySchema,
  mode: "array",
});

// Output:
// Apple|organization|0.95
// Tim Cook|person|0.92
// Cupertino|location|0.88

// result.data:
// [
//   { name: "Apple", type: "organization", confidence: 0.95 },
//   { name: "Tim Cook", type: "person", confidence: 0.92 },
//   { name: "Cupertino", type: "location", confidence: 0.88 }
// ]
```

### Parse Log Entries

```typescript
const LogSchema = z.object({
  timestamp: z.string(),
  level: z.enum(["debug", "info", "warn", "error"]),
  service: z.string(),
  message: z.string(),
});

const result = await pz.complete({
  prompt: "Parse these log entries into structured format",
  inputData: rawLogText,
  schema: LogSchema,
  mode: "array",
});
```

### Analyze Sentiment

```typescript
const SentimentSchema = z.object({
  text: z.string(),
  sentiment: z.enum(["positive", "negative", "neutral"]),
  score: z.number(),
  keywords: z.array(z.string()),
});

const result = await pz.complete({
  prompt: "Analyze sentiment for each customer review",
  inputData: reviews,
  schema: SentimentSchema,
  mode: "array",
});
```

### Extract Product Info

```typescript
const ProductSchema = z.object({
  name: z.string(),
  price: z.number(),
  currency: z.string(),
  inStock: z.boolean(),
  features: z.array(z.string()),
});

const result = await pz.complete({
  prompt: "Extract product information from this webpage",
  inputData: pageHtml,
  schema: ProductSchema,
  mode: "object",
});
```

---

## License

MIT

---

## Contributing

Contributions welcome! Please read our contributing guidelines.

## Related Projects

- [Zod](https://zod.dev) - TypeScript-first schema validation
- [OpenAI SDK](https://github.com/openai/openai-node)
- [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript)
- [Google Generative AI](https://github.com/google/generative-ai-js)
