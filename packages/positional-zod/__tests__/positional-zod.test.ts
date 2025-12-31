import { describe, it, expect } from "vitest";
import { z } from "zod";
import { PositionalZod } from "../src/positional-zod.js";
import type { ProviderResponse, ProviderOptions } from "../src/types.js";
import { BaseProvider } from "../src/providers/base.js";

// Mock provider for testing
class MockProvider extends BaseProvider {
  readonly name = "mock";
  public mockResponse: string = "";
  public mockError: Error | null = null;
  public lastSystemPrompt: string = "";
  public lastUserPrompt: string = "";
  public lastOptions: ProviderOptions = {};

  async complete(
    systemPrompt: string,
    userPrompt: string,
    options: ProviderOptions
  ): Promise<ProviderResponse> {
    this.lastSystemPrompt = systemPrompt;
    this.lastUserPrompt = userPrompt;
    this.lastOptions = options;

    if (this.mockError) {
      throw this.mockError;
    }

    return {
      content: this.mockResponse,
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
    };
  }
}

// Helper to create PositionalZod with mock provider
function createMockPZ(): { pz: PositionalZod; mockProvider: MockProvider } {
  const mockProvider = new MockProvider();

  // Create PositionalZod with a real config
  const pz = new PositionalZod({
    providers: {
      openai: { apiKey: "test-key" },
    },
    defaultProvider: "openai",
  });

  // Replace the provider with our mock
  (pz as unknown as { providers: Map<string, BaseProvider> }).providers.set(
    "openai",
    mockProvider
  );

  return { pz, mockProvider };
}

describe("PositionalZod", () => {
  describe("constructor", () => {
    it("creates instance with valid config", () => {
      const pz = new PositionalZod({
        providers: { openai: { apiKey: "test" } },
        defaultProvider: "openai",
      });

      expect(pz).toBeInstanceOf(PositionalZod);
    });

    it("throws if default provider is not configured", () => {
      expect(
        () =>
          new PositionalZod({
            providers: { openai: { apiKey: "test" } },
            defaultProvider: "anthropic",
          })
      ).toThrow("not configured");
    });

    it("accepts custom delimiters", () => {
      const pz = new PositionalZod({
        providers: { openai: { apiKey: "test" } },
        defaultProvider: "openai",
        delimiter: "\t",
        subDelimiter: ",",
        escapeChar: "\\",
      });

      expect(pz).toBeInstanceOf(PositionalZod);
    });
  });

  describe("complete", () => {
    it("parses simple object response", async () => {
      const { pz, mockProvider } = createMockPZ();
      mockProvider.mockResponse = "42|Alice";

      const schema = z.object({
        id: z.number(),
        name: z.string(),
      });

      const result = await pz.complete({
        prompt: "Extract user",
        schema,
        mode: "object",
      });

      expect(result.data).toEqual({ id: 42, name: "Alice" });
      expect(result.provider).toBe("openai");
      expect(result.rawResponse).toBe("42|Alice");
      expect(result.usage).toBeDefined();
    });

    it("parses array response", async () => {
      const { pz, mockProvider } = createMockPZ();
      mockProvider.mockResponse = "1|Alice\n2|Bob\n3|Charlie";

      const schema = z.object({
        id: z.number(),
        name: z.string(),
      });

      const result = await pz.complete({
        prompt: "Extract users",
        schema,
        mode: "array",
      });

      expect(result.data).toEqual([
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
        { id: 3, name: "Charlie" },
      ]);
      expect(result.rowCount).toBe(3);
    });

    it("includes input data in prompt", async () => {
      const { pz, mockProvider } = createMockPZ();
      mockProvider.mockResponse = "42|Alice";

      const schema = z.object({
        id: z.number(),
        name: z.string(),
      });

      await pz.complete({
        prompt: "Extract user",
        schema,
        mode: "object",
        inputData: { source: "test data" },
      });

      expect(mockProvider.lastUserPrompt).toContain("INPUT DATA:");
      expect(mockProvider.lastUserPrompt).toContain("test data");
    });

    it("passes temperature and maxTokens to provider", async () => {
      const { pz, mockProvider } = createMockPZ();
      mockProvider.mockResponse = "42|Alice";

      const schema = z.object({
        id: z.number(),
        name: z.string(),
      });

      await pz.complete({
        prompt: "Extract user",
        schema,
        mode: "object",
        temperature: 0.5,
        maxTokens: 1000,
      });

      expect(mockProvider.lastOptions.temperature).toBe(0.5);
      expect(mockProvider.lastOptions.maxTokens).toBe(1000);
    });

    it("includes custom system prompt", async () => {
      const { pz, mockProvider } = createMockPZ();
      mockProvider.mockResponse = "42|Alice";

      const schema = z.object({
        id: z.number(),
        name: z.string(),
      });

      await pz.complete({
        prompt: "Extract user",
        schema,
        mode: "object",
        systemPrompt: "You are a data extraction expert.",
      });

      expect(mockProvider.lastSystemPrompt).toContain(
        "You are a data extraction expert."
      );
    });
  });

  describe("nested objects", () => {
    it("handles nested object schemas", async () => {
      const { pz, mockProvider } = createMockPZ();
      mockProvider.mockResponse = "ORD-001|Alice|alice@example.com|99.99";

      const schema = z.object({
        orderId: z.string(),
        customer: z.object({
          name: z.string(),
          email: z.string(),
        }),
        total: z.number(),
      });

      const result = await pz.complete({
        prompt: "Extract order",
        schema,
        mode: "object",
      });

      expect(result.data).toEqual({
        orderId: "ORD-001",
        customer: {
          name: "Alice",
          email: "alice@example.com",
        },
        total: 99.99,
      });
    });
  });

  describe("arrays and enums", () => {
    it("handles array fields", async () => {
      const { pz, mockProvider } = createMockPZ();
      mockProvider.mockResponse = "My Article|tech;tutorial;beginner";

      const schema = z.object({
        title: z.string(),
        tags: z.array(z.string()),
      });

      const result = await pz.complete({
        prompt: "Extract article",
        schema,
        mode: "object",
      });

      expect(result.data).toEqual({
        title: "My Article",
        tags: ["tech", "tutorial", "beginner"],
      });
    });

    it("handles enum fields", async () => {
      const { pz, mockProvider } = createMockPZ();
      mockProvider.mockResponse = "Fix bug|in_progress|high";

      const schema = z.object({
        title: z.string(),
        status: z.enum(["pending", "in_progress", "done"]),
        priority: z.enum(["low", "medium", "high"]),
      });

      const result = await pz.complete({
        prompt: "Extract task",
        schema,
        mode: "object",
      });

      expect(result.data).toEqual({
        title: "Fix bug",
        status: "in_progress",
        priority: "high",
      });
    });
  });

  describe("optional fields", () => {
    it("handles empty optional fields", async () => {
      const { pz, mockProvider } = createMockPZ();
      mockProvider.mockResponse = "Alice|alice@example.com||Prefers email";

      const schema = z.object({
        name: z.string(),
        email: z.string(),
        phone: z.string().optional(),
        notes: z.string().optional(),
      });

      const result = await pz.complete({
        prompt: "Extract contact",
        schema,
        mode: "object",
      });

      expect(result.data).toEqual({
        name: "Alice",
        email: "alice@example.com",
        phone: undefined,
        notes: "Prefers email",
      });
    });
  });

  describe("getSchemaPositions", () => {
    it("returns position map for schema", () => {
      const pz = new PositionalZod({
        providers: { openai: { apiKey: "test" } },
        defaultProvider: "openai",
      });

      const schema = z.object({
        id: z.number(),
        name: z.string(),
        active: z.boolean(),
      });

      const positions = pz.getSchemaPositions(schema);

      expect(positions["id"]).toMatchObject({ position: 0, type: "number" });
      expect(positions["name"]).toMatchObject({ position: 1, type: "string" });
      expect(positions["active"]).toMatchObject({ position: 2, type: "boolean" });
    });
  });

  describe("error handling", () => {
    it("throws ParseError for invalid response", async () => {
      const { pz, mockProvider } = createMockPZ();
      mockProvider.mockResponse = "only-one-column";

      const schema = z.object({
        id: z.number(),
        name: z.string(),
      });

      await expect(
        pz.complete({
          prompt: "Extract user",
          schema,
          mode: "object",
        })
      ).rejects.toThrow("Expected 2 columns but got 1");
    });

    it("throws ValidationError for invalid data", async () => {
      const { pz, mockProvider } = createMockPZ();
      mockProvider.mockResponse = "not-a-number|Alice";

      const schema = z.object({
        id: z.number(),
        name: z.string(),
      });

      await expect(
        pz.complete({
          prompt: "Extract user",
          schema,
          mode: "object",
        })
      ).rejects.toThrow();
    });
  });
});

describe("Integration", () => {
  it("full flow with complex schema", async () => {
    const { pz, mockProvider } = createMockPZ();
    mockProvider.mockResponse =
      "Apple|organization|0.95\nTim Cook|person|0.92\nCupertino|location|0.88";

    const EntitySchema = z.object({
      name: z.string(),
      type: z.enum(["person", "organization", "location"]),
      confidence: z.number(),
    });

    const result = await pz.complete({
      prompt: "Extract entities",
      inputData: "Apple CEO Tim Cook spoke at the Cupertino headquarters.",
      schema: EntitySchema,
      mode: "array",
    });

    expect(result.data).toEqual([
      { name: "Apple", type: "organization", confidence: 0.95 },
      { name: "Tim Cook", type: "person", confidence: 0.92 },
      { name: "Cupertino", type: "location", confidence: 0.88 },
    ]);
    expect(result.rowCount).toBe(3);
    expect(result.provider).toBe("openai");
  });
});
