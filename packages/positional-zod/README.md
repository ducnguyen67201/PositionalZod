# positional-zod

Schema-driven positional format for LLM structured outputs. **Save ~56% on completion tokens** compared to JSON.

## Why?

LLMs output JSON with lots of redundant tokens (quotes, brackets, keys). `positional-zod` uses a compact positional format:

```
// JSON output (262 tokens)
[{"sku":"WATCH-001","name":"Apple Watch","brand":"Apple","price":799,"rating":4.9},...]

// Positional output (114 tokens) - 56% smaller!
WATCH-001|Apple Watch|Apple|799|4.9
```

## Installation

```bash
npm install positional-zod zod
# Plus your preferred LLM SDK
npm install openai        # for OpenAI
npm install @anthropic-ai/sdk  # for Anthropic
npm install @google/generative-ai  # for Google
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

// 2. Define schema
const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  score: z.number(),
});

// 3. Extract data
const result = await pz.complete({
  prompt: "Extract the top 3 users from this leaderboard",
  inputData: leaderboardText,
  schema: UserSchema,
  mode: "array",
});

console.log(result.data);
// [
//   { id: 1, name: "Alice", score: 95.5 },
//   { id: 2, name: "Bob", score: 87.0 },
//   { id: 3, name: "Charlie", score: 92.3 }
// ]
```

## Token Savings

Real-world benchmark extracting 5 products from a catalog:

| Method | Prompt Tokens | Completion Tokens | Total | Savings |
|--------|---------------|-------------------|-------|---------|
| JSON → JSON | 1053 | 262 | 1315 | baseline |
| JSON → PositionalZod | 1185 | 114 | 1299 | **-56% completion** |
| TOON → PositionalZod | 939 | 117 | 1056 | **-20% total** |

## Features

- **Multi-provider**: OpenAI, Anthropic, Google Gemini
- **Zod v3 & v4**: Full compatibility
- **Type-safe**: Full TypeScript support
- **Nested objects**: Automatically flattened
- **Arrays**: Inline with sub-delimiters
- **Optional fields**: Handled gracefully
- **Validation**: Zod validation on parsed output

## API

### `PositionalZod(config)`

```typescript
const pz = new PositionalZod({
  providers: {
    openai: { apiKey: "...", model: "gpt-4o-mini" },
    anthropic: { apiKey: "...", model: "claude-sonnet-4-20250514" },
    google: { apiKey: "...", model: "gemini-2.0-flash" },
  },
  defaultProvider: "openai",
  fallbackProviders: ["anthropic", "google"], // optional
  delimiter: "|",      // default
  subDelimiter: ";",   // for arrays
  debug: false,
});
```

### `pz.complete(options)`

```typescript
const result = await pz.complete({
  prompt: "Extract users",
  schema: UserSchema,
  mode: "array",           // "object" | "array"
  inputData: data,         // optional
  inputFormat: "json",     // "json" | "text" | "auto"
  provider: "openai",      // override default
  temperature: 0,
  maxTokens: 1000,
  maxRows: 10,             // limit array results
  systemPrompt: "...",     // additional instructions
});

// Result
{
  data: [...],             // parsed & validated
  rawResponse: "...",      // raw LLM output
  provider: "openai",
  rowCount: 3,             // for array mode
  usage: {
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
  },
  warnings: [],            // any parse warnings
}
```

## Supported Schema Types

```typescript
z.string()
z.number()
z.boolean()
z.date()
z.enum(["a", "b", "c"])
z.literal("value")
z.array(z.string())        // uses sub-delimiter
z.array(z.object({...}))   // inline JSON
z.object({...})            // flattened with dots
z.optional()
z.nullable()
```

## Combine with TOON for Maximum Savings

Use [TOON](https://github.com/toon-format/toon) for input encoding + PositionalZod for output:

```typescript
import { encode } from "@toon-format/toon";

const result = await pz.complete({
  prompt: "Extract products",
  inputData: encode(catalogData),  // TOON-encoded input
  schema: ProductSchema,
  mode: "array",
});
```

This gives you **~20% total token savings** (input + output combined).

## License

MIT
