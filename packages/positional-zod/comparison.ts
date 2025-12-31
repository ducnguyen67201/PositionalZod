import { config } from "dotenv";
import { resolve } from "path";

// Load .env from monorepo root
config({ path: resolve(import.meta.dirname, "../../.env") });

import { PositionalZod } from "./src/index.js";
import { z } from "zod";
import OpenAI from "openai";
import { encode } from "@toon-format/toon";

// =============================================================================
// REAL-WORLD TEST DATA: E-commerce Product Catalog
// =============================================================================

const productCatalog = {
  products: [
    {
      sku: "LAPTOP-001",
      name: "MacBook Pro 16-inch M3 Max",
      category: "Electronics",
      price: 3499.99,
      stock: 45,
      rating: 4.8,
      reviews: 1247,
      brand: "Apple",
      tags: ["laptop", "professional", "creative"],
    },
    {
      sku: "LAPTOP-002",
      name: "ThinkPad X1 Carbon Gen 11",
      category: "Electronics",
      price: 1849.0,
      stock: 128,
      rating: 4.6,
      reviews: 892,
      brand: "Lenovo",
      tags: ["laptop", "business", "ultralight"],
    },
    {
      sku: "PHONE-001",
      name: "iPhone 15 Pro Max 256GB",
      category: "Electronics",
      price: 1199.0,
      stock: 312,
      rating: 4.7,
      reviews: 3421,
      brand: "Apple",
      tags: ["smartphone", "flagship", "camera"],
    },
    {
      sku: "PHONE-002",
      name: "Samsung Galaxy S24 Ultra",
      category: "Electronics",
      price: 1299.99,
      stock: 189,
      rating: 4.5,
      reviews: 2156,
      brand: "Samsung",
      tags: ["smartphone", "android", "stylus"],
    },
    {
      sku: "AUDIO-001",
      name: "Sony WH-1000XM5 Headphones",
      category: "Audio",
      price: 349.99,
      stock: 567,
      rating: 4.8,
      reviews: 4532,
      brand: "Sony",
      tags: ["headphones", "noise-canceling", "wireless"],
    },
    {
      sku: "AUDIO-002",
      name: "AirPods Pro 2nd Generation",
      category: "Audio",
      price: 249.0,
      stock: 834,
      rating: 4.7,
      reviews: 8921,
      brand: "Apple",
      tags: ["earbuds", "wireless", "anc"],
    },
    {
      sku: "WATCH-001",
      name: "Apple Watch Ultra 2",
      category: "Wearables",
      price: 799.0,
      stock: 156,
      rating: 4.9,
      reviews: 1876,
      brand: "Apple",
      tags: ["smartwatch", "fitness", "outdoor"],
    },
    {
      sku: "WATCH-002",
      name: "Garmin Fenix 8 Solar",
      category: "Wearables",
      price: 999.99,
      stock: 78,
      rating: 4.8,
      reviews: 654,
      brand: "Garmin",
      tags: ["smartwatch", "gps", "adventure"],
    },
    {
      sku: "TABLET-001",
      name: "iPad Pro 12.9-inch M2",
      category: "Electronics",
      price: 1099.0,
      stock: 234,
      rating: 4.8,
      reviews: 2341,
      brand: "Apple",
      tags: ["tablet", "creative", "professional"],
    },
    {
      sku: "CAMERA-001",
      name: "Sony A7 IV Mirrorless Camera",
      category: "Photography",
      price: 2498.0,
      stock: 45,
      rating: 4.9,
      reviews: 1123,
      brand: "Sony",
      tags: ["camera", "mirrorless", "fullframe"],
    },
  ],
};

// Schema for extraction
const ProductSchema = z.object({
  sku: z.string(),
  name: z.string(),
  brand: z.string(),
  price: z.number(),
  rating: z.number(),
});

type Product = z.infer<typeof ProductSchema>;

interface TestResult {
  method: string;
  data: Product[];
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  rawResponse: string;
  inputFormat: string;
  outputFormat: string;
}

// =============================================================================
// TEST METHODS
// =============================================================================

// Method 1: Regular JSON input -> JSON output
async function testRegularJSON(openai: OpenAI): Promise<TestResult> {
  const jsonInput = JSON.stringify(productCatalog, null, 2);

  const systemPrompt = `You are a data extraction assistant. Extract product data and return as valid JSON.

Output format: Array of objects with EXACTLY these fields:
- sku: string
- name: string
- brand: string
- price: number
- rating: number

Return ONLY the JSON array. No markdown, no explanation.`;

  const userPrompt = `Extract the top 5 highest-rated products from this catalog:

${jsonInput}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0,
  });

  const content = response.choices[0].message.content || "";
  let data: Product[];
  try {
    data = JSON.parse(content) as Product[];
  } catch {
    // Try to extract JSON from markdown code blocks
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    data = match ? JSON.parse(match[1]) : [];
  }

  return {
    method: "JSON → JSON",
    data,
    promptTokens: response.usage?.prompt_tokens || 0,
    completionTokens: response.usage?.completion_tokens || 0,
    totalTokens: response.usage?.total_tokens || 0,
    rawResponse: content,
    inputFormat: "JSON",
    outputFormat: "JSON",
  };
}

// Method 2: TOON input -> JSON output
async function testTOONInput(openai: OpenAI): Promise<TestResult> {
  const toonInput = encode(productCatalog);

  const systemPrompt = `You are a data extraction assistant. The input is in TOON format (Token-Oriented Object Notation).

Extract product data and return as valid JSON.

Output format: Array of objects with EXACTLY these fields:
- sku: string
- name: string
- brand: string
- price: number
- rating: number

Return ONLY the JSON array. No markdown, no explanation.`;

  const userPrompt = `Extract the top 5 highest-rated products from this catalog:

\`\`\`toon
${toonInput}
\`\`\``;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0,
  });

  const content = response.choices[0].message.content || "";
  let data: Product[];
  try {
    data = JSON.parse(content) as Product[];
  } catch {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    data = match ? JSON.parse(match[1]) : [];
  }

  return {
    method: "TOON → JSON",
    data,
    promptTokens: response.usage?.prompt_tokens || 0,
    completionTokens: response.usage?.completion_tokens || 0,
    totalTokens: response.usage?.total_tokens || 0,
    rawResponse: content,
    inputFormat: "TOON",
    outputFormat: "JSON",
  };
}

// Method 3: OpenAI Structured Output (JSON Schema)
async function testStructuredOutput(openai: OpenAI): Promise<TestResult> {
  const jsonInput = JSON.stringify(productCatalog, null, 2);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are a data extraction assistant.",
      },
      {
        role: "user",
        content: `Extract the top 5 highest-rated products from this catalog:\n\n${jsonInput}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "products",
        strict: true,
        schema: {
          type: "object",
          properties: {
            products: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  sku: { type: "string" },
                  name: { type: "string" },
                  brand: { type: "string" },
                  price: { type: "number" },
                  rating: { type: "number" },
                },
                required: ["sku", "name", "brand", "price", "rating"],
                additionalProperties: false,
              },
            },
          },
          required: ["products"],
          additionalProperties: false,
        },
      },
    },
    temperature: 0,
  });

  const content = response.choices[0].message.content || "";
  const parsed = JSON.parse(content) as { products: Product[] };

  return {
    method: "JSON → Structured Output",
    data: parsed.products,
    promptTokens: response.usage?.prompt_tokens || 0,
    completionTokens: response.usage?.completion_tokens || 0,
    totalTokens: response.usage?.total_tokens || 0,
    rawResponse: content,
    inputFormat: "JSON",
    outputFormat: "JSON Schema",
  };
}

// Method 4: JSON input -> PositionalZod output
async function testPositionalZod(): Promise<TestResult> {
  const apiKey = process.env["OPENAI_API_KEY"]!;
  const jsonInput = JSON.stringify(productCatalog, null, 2);

  const pz = new PositionalZod({
    providers: {
      openai: { apiKey, model: "gpt-4o-mini" },
    },
    defaultProvider: "openai",
  });

  const result = await pz.complete({
    prompt: "Extract the top 5 highest-rated products from this catalog",
    inputData: jsonInput,
    schema: ProductSchema,
    mode: "array",
    temperature: 0,
  });

  return {
    method: "JSON → PositionalZod",
    data: result.data as Product[],
    promptTokens: result.usage?.promptTokens || 0,
    completionTokens: result.usage?.completionTokens || 0,
    totalTokens: result.usage?.totalTokens || 0,
    rawResponse: result.rawResponse,
    inputFormat: "JSON",
    outputFormat: "Positional",
  };
}

// Method 5: TOON input -> PositionalZod output (best of both worlds)
async function testTOONPlusPositional(): Promise<TestResult> {
  const apiKey = process.env["OPENAI_API_KEY"]!;
  const toonInput = encode(productCatalog);

  const pz = new PositionalZod({
    providers: {
      openai: { apiKey, model: "gpt-4o-mini" },
    },
    defaultProvider: "openai",
  });

  const result = await pz.complete({
    prompt: "Extract the top 5 highest-rated products from this catalog (data is in TOON format)",
    inputData: `\`\`\`toon\n${toonInput}\n\`\`\``,
    schema: ProductSchema,
    mode: "array",
    temperature: 0,
  });

  return {
    method: "TOON → PositionalZod",
    data: result.data as Product[],
    promptTokens: result.usage?.promptTokens || 0,
    completionTokens: result.usage?.completionTokens || 0,
    totalTokens: result.usage?.totalTokens || 0,
    rawResponse: result.rawResponse,
    inputFormat: "TOON",
    outputFormat: "Positional",
  };
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    console.error("Error: OPENAI_API_KEY environment variable is required");
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey });

  console.log("=".repeat(80));
  console.log("FORMAT COMPARISON: JSON vs TOON vs PositionalZod");
  console.log("=".repeat(80));

  // Show input data sizes
  const jsonSize = JSON.stringify(productCatalog, null, 2);
  const toonSize = encode(productCatalog);

  console.log("\n📊 INPUT DATA: E-commerce Product Catalog (10 products)");
  console.log("-".repeat(80));
  console.log(`JSON format:  ${jsonSize.length} characters`);
  console.log(`TOON format:  ${toonSize.length} characters`);
  console.log(`Compression:  ${((1 - toonSize.length / jsonSize.length) * 100).toFixed(1)}% smaller with TOON`);

  console.log("\n📋 TASK: Extract top 5 highest-rated products");
  console.log("   Output schema: { sku, name, brand, price, rating }");

  console.log("\n" + "=".repeat(80));
  console.log("RUNNING TESTS...");
  console.log("=".repeat(80));

  const results: TestResult[] = [];

  const tests = [
    { name: "JSON → JSON", fn: () => testRegularJSON(openai) },
    { name: "TOON → JSON", fn: () => testTOONInput(openai) },
    { name: "JSON → Structured Output", fn: () => testStructuredOutput(openai) },
    { name: "JSON → PositionalZod", fn: () => testPositionalZod() },
    { name: "TOON → PositionalZod", fn: () => testTOONPlusPositional() },
  ];

  for (const test of tests) {
    process.stdout.write(`\n⏳ Testing ${test.name}...`);
    try {
      const result = await test.fn();
      results.push(result);
      console.log(" ✅");
    } catch (e) {
      console.log(` ❌ Failed: ${e}`);
    }
  }

  // Display raw responses
  console.log("\n" + "=".repeat(80));
  console.log("RAW RESPONSES");
  console.log("=".repeat(80));

  for (const result of results) {
    console.log(`\n### ${result.method} ###`);
    console.log(`Input: ${result.inputFormat} | Output: ${result.outputFormat}`);
    console.log("-".repeat(60));
    console.log(result.rawResponse.substring(0, 500) + (result.rawResponse.length > 500 ? "..." : ""));
  }

  // Token comparison table
  console.log("\n" + "=".repeat(80));
  console.log("TOKEN USAGE COMPARISON");
  console.log("=".repeat(80));

  const baseline = results[0];

  console.log("\n┌────────────────────────────┬─────────┬────────────┬─────────┬───────────┬───────────┐");
  console.log("│ Method                     │ Prompt  │ Completion │  Total  │ vs JSON→  │ vs JSON→  │");
  console.log("│                            │ Tokens  │   Tokens   │ Tokens  │ JSON (In) │ JSON (Out)│");
  console.log("├────────────────────────────┼─────────┼────────────┼─────────┼───────────┼───────────┤");

  for (const result of results) {
    const totalSavings = ((baseline.totalTokens - result.totalTokens) / baseline.totalTokens) * 100;
    const promptSavings = ((baseline.promptTokens - result.promptTokens) / baseline.promptTokens) * 100;
    const completionSavings = ((baseline.completionTokens - result.completionTokens) / baseline.completionTokens) * 100;

    const promptSavingsStr = result === baseline ? "-" : `${promptSavings >= 0 ? "-" : "+"}${Math.abs(promptSavings).toFixed(0)}%`;
    const completionSavingsStr = result === baseline ? "-" : `${completionSavings >= 0 ? "-" : "+"}${Math.abs(completionSavings).toFixed(0)}%`;

    console.log(
      `│ ${result.method.padEnd(26)} │ ${String(result.promptTokens).padStart(7)} │ ${String(result.completionTokens).padStart(10)} │ ${String(result.totalTokens).padStart(7)} │ ${promptSavingsStr.padStart(9)} │ ${completionSavingsStr.padStart(9)} │`
    );
  }

  console.log("└────────────────────────────┴─────────┴────────────┴─────────┴───────────┴───────────┘");

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));

  const jsonJson = results.find((r) => r.method === "JSON → JSON");
  const toonJson = results.find((r) => r.method === "TOON → JSON");
  const jsonPositional = results.find((r) => r.method === "JSON → PositionalZod");
  const toonPositional = results.find((r) => r.method === "TOON → PositionalZod");

  if (jsonJson && toonJson) {
    const inputSavings = ((jsonJson.promptTokens - toonJson.promptTokens) / jsonJson.promptTokens) * 100;
    console.log(`\n📥 INPUT OPTIMIZATION (TOON):`);
    console.log(`   TOON saves ${inputSavings.toFixed(1)}% on prompt tokens vs JSON input`);
  }

  if (jsonJson && jsonPositional) {
    const outputSavings = ((jsonJson.completionTokens - jsonPositional.completionTokens) / jsonJson.completionTokens) * 100;
    console.log(`\n📤 OUTPUT OPTIMIZATION (PositionalZod):`);
    console.log(`   PositionalZod saves ${outputSavings.toFixed(1)}% on completion tokens vs JSON output`);
  }

  if (jsonJson && toonPositional) {
    const totalSavings = ((jsonJson.totalTokens - toonPositional.totalTokens) / jsonJson.totalTokens) * 100;
    const promptSavings = ((jsonJson.promptTokens - toonPositional.promptTokens) / jsonJson.promptTokens) * 100;
    const completionSavings = ((jsonJson.completionTokens - toonPositional.completionTokens) / jsonJson.completionTokens) * 100;

    console.log(`\n🚀 COMBINED (TOON + PositionalZod):`);
    console.log(`   Prompt tokens:     ${promptSavings.toFixed(1)}% savings`);
    console.log(`   Completion tokens: ${completionSavings.toFixed(1)}% savings`);
    console.log(`   Total tokens:      ${totalSavings.toFixed(1)}% savings`);
    console.log(`\n   💡 Using TOON input + PositionalZod output = MAXIMUM token efficiency!`);
  }

  // Verify data accuracy
  console.log("\n" + "=".repeat(80));
  console.log("DATA ACCURACY CHECK");
  console.log("=".repeat(80));

  const expectedTop5 = ["Sony A7 IV Mirrorless Camera", "Apple Watch Ultra 2", "MacBook Pro 16-inch M3 Max", "Sony WH-1000XM5 Headphones", "Garmin Fenix 8 Solar"];

  for (const result of results) {
    const names = result.data.map((p) => p.name);
    const correctCount = names.filter((n) => expectedTop5.some((e) => n.includes(e.split(" ")[0]))).length;
    const accuracy = (correctCount / 5) * 100;
    console.log(`${result.method.padEnd(28)} ${accuracy >= 80 ? "✅" : "⚠️"} ${correctCount}/5 correct (${accuracy}%)`);
  }
}

main().catch(console.error);
