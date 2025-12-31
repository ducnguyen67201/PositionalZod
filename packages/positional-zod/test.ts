import { config } from "dotenv";
import { resolve } from "path";

// Load .env from monorepo root
config({ path: resolve(import.meta.dirname, "../../.env") });

import { PositionalZod } from "./src/index.js";
import { z } from "zod";

// Sample leaderboard data
const leaderboardText = `
Gaming Tournament Leaderboard - December 2024
=============================================
1st Place: Alice "ProGamer" Smith - 95.5 points
2nd Place: Bob "TheChamp" Johnson - 87.0 points
3rd Place: Charlie "NightOwl" Williams - 92.3 points
4th Place: Diana "SpeedRunner" Brown - 84.7 points
5th Place: Eve "Strategist" Davis - 81.2 points
`;

async function main() {
  // Check for API key
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    console.error("Error: OPENAI_API_KEY environment variable is required");
    console.log("Run with: OPENAI_API_KEY=sk-... npx tsx test.ts");
    process.exit(1);
  }

  // 1. Create instance
  const pz = new PositionalZod({
    providers: {
      openai: { apiKey },
    },
    defaultProvider: "openai",
    debug: true, // Enable debug logging to see prompts
  });

  // 2. Define schema (this drives the positional format)
  const UserSchema = z.object({
    id: z.number(),
    name: z.string(),
    score: z.number(),
  });

  console.log("=== Testing PositionalZod ===\n");
  console.log("Input data:");
  console.log(leaderboardText);
  console.log("\nSchema: { id: number, name: string, score: number }");
  console.log("\nCalling LLM...\n");

  try {
    // 3. Execute - LLM outputs positional data
    const result = await pz.complete({
      prompt: "Extract the top 3 users from this leaderboard",
      inputData: leaderboardText,
      schema: UserSchema,
      mode: "array",
    });

    // LLM outputs something like:
    // 1|Alice|95.5
    // 2|Bob|87.0
    // 3|Charlie|92.3

    console.log("=== Results ===\n");
    console.log("Raw response from LLM:");
    console.log(result.rawResponse);
    console.log("\nParsed & validated data:");
    console.log(JSON.stringify(result.data, null, 2));
    console.log("\nRow count:", result.rowCount);
    console.log("Provider:", result.provider);

    // Token usage breakdown
    if (result.usage) {
      console.log("\n=== Token Usage ===");
      console.log("Prompt tokens:     ", result.usage.promptTokens);
      console.log("Completion tokens: ", result.usage.completionTokens);
      console.log("Total tokens:      ", result.usage.totalTokens);
    }

    if (result.warnings?.length) {
      console.log("\nWarnings:", result.warnings);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
