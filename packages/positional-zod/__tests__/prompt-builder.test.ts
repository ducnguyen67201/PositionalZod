import { describe, it, expect } from "vitest";
import {
  buildSystemPrompt,
  buildUserPrompt,
  buildPrompts,
} from "../src/prompt-builder.js";
import type { PositionInfo, PromptConfig } from "../src/types.js";

describe("buildSystemPrompt", () => {
  const baseConfig: PromptConfig = {
    delimiter: "|",
    subDelimiter: ";",
    mode: "object",
  };

  const simplePositions: PositionInfo[] = [
    { path: "id", position: 0, type: "number", optional: false, nullable: false },
    { path: "name", position: 1, type: "string", optional: false, nullable: false },
    { path: "active", position: 2, type: "boolean", optional: false, nullable: false },
  ];

  it("includes all position info in schema", () => {
    const prompt = buildSystemPrompt(simplePositions, baseConfig);

    expect(prompt).toContain("0: id - number");
    expect(prompt).toContain("1: name - string");
    expect(prompt).toContain("2: active - boolean");
  });

  it("includes delimiter info", () => {
    const prompt = buildSystemPrompt(simplePositions, baseConfig);

    expect(prompt).toContain('"|"');
    expect(prompt).toContain("delimiter");
  });

  it("includes example output", () => {
    const prompt = buildSystemPrompt(simplePositions, baseConfig);

    expect(prompt).toContain("EXAMPLE OUTPUT:");
    expect(prompt).toContain("42|example_text|true");
  });

  it("marks optional fields", () => {
    const positions: PositionInfo[] = [
      { path: "name", position: 0, type: "string", optional: true, nullable: false },
    ];

    const prompt = buildSystemPrompt(positions, baseConfig);

    expect(prompt).toContain("(optional)");
  });

  it("marks nullable fields", () => {
    const positions: PositionInfo[] = [
      { path: "value", position: 0, type: "string", optional: false, nullable: true },
    ];

    const prompt = buildSystemPrompt(positions, baseConfig);

    expect(prompt).toContain("(nullable)");
  });

  describe("mode differences", () => {
    it("includes single row instruction for object mode", () => {
      const prompt = buildSystemPrompt(simplePositions, {
        ...baseConfig,
        mode: "object",
      });

      expect(prompt).toContain("EXACTLY ONE ROW");
    });

    it("includes multiple rows instruction for array mode", () => {
      const prompt = buildSystemPrompt(simplePositions, {
        ...baseConfig,
        mode: "array",
      });

      expect(prompt).toContain("ONE ROW PER OBJECT");
      expect(prompt).toContain("multiple rows");
    });

    it("includes maxRows when specified in array mode", () => {
      const prompt = buildSystemPrompt(simplePositions, {
        ...baseConfig,
        mode: "array",
        maxRows: 10,
      });

      expect(prompt).toContain("at most 10 rows");
    });
  });

  describe("field types", () => {
    it("formats enum with values", () => {
      const positions: PositionInfo[] = [
        {
          path: "status",
          position: 0,
          type: "enum",
          optional: false,
          nullable: false,
          enumValues: ["pending", "active", "done"],
        },
      ];

      const prompt = buildSystemPrompt(positions, baseConfig);

      expect(prompt).toContain("one of: pending, active, done");
    });

    it("formats literal with value", () => {
      const positions: PositionInfo[] = [
        {
          path: "type",
          position: 0,
          type: "literal",
          optional: false,
          nullable: false,
          literalValue: "user",
        },
      ];

      const prompt = buildSystemPrompt(positions, baseConfig);

      expect(prompt).toContain('exactly: "user"');
    });

    it("formats array with sub-delimiter", () => {
      const positions: PositionInfo[] = [
        {
          path: "tags",
          position: 0,
          type: "array",
          optional: false,
          nullable: false,
          arrayItemType: "string",
        },
      ];

      const prompt = buildSystemPrompt(positions, baseConfig);

      expect(prompt).toContain('array (use ";" between items)');
    });

    it("formats date with ISO format hint", () => {
      const positions: PositionInfo[] = [
        { path: "createdAt", position: 0, type: "date", optional: false, nullable: false },
      ];

      const prompt = buildSystemPrompt(positions, baseConfig);

      expect(prompt).toContain("ISO format");
      expect(prompt).toContain("YYYY-MM-DD");
    });

    it("formats json type", () => {
      const positions: PositionInfo[] = [
        { path: "items", position: 0, type: "json", optional: false, nullable: false },
      ];

      const prompt = buildSystemPrompt(positions, baseConfig);

      expect(prompt).toContain("JSON array of objects");
    });
  });

  describe("custom system prompt", () => {
    it("includes custom system prompt at the beginning", () => {
      const prompt = buildSystemPrompt(simplePositions, {
        ...baseConfig,
        customSystemPrompt: "You are a data extraction expert.",
      });

      expect(prompt).toMatch(/^You are a data extraction expert\./);
    });
  });

  describe("escaping rules", () => {
    it("includes escaping instructions", () => {
      const prompt = buildSystemPrompt(simplePositions, baseConfig);

      expect(prompt).toContain('escape it as "\\|"');
    });

    it("includes empty field instructions", () => {
      const prompt = buildSystemPrompt(simplePositions, baseConfig);

      expect(prompt).toContain("val1||val3");
    });
  });
});

describe("buildUserPrompt", () => {
  it("returns prompt as-is without input data", () => {
    const result = buildUserPrompt("Extract users from this data");

    expect(result).toBe("Extract users from this data");
  });

  it("includes input data when provided", () => {
    const result = buildUserPrompt("Extract users", { users: ["Alice", "Bob"] });

    expect(result).toContain("Extract users");
    expect(result).toContain("INPUT DATA:");
    expect(result).toContain("Alice");
    expect(result).toContain("Bob");
  });

  it("formats object data as JSON", () => {
    const result = buildUserPrompt("Process this", { key: "value" }, "json");

    expect(result).toContain('"key": "value"');
  });

  it("formats string data as text", () => {
    const result = buildUserPrompt("Process this", "raw text data", "text");

    expect(result).toContain("raw text data");
  });

  it("auto-detects string input as text", () => {
    const result = buildUserPrompt("Process this", "plain string", "auto");

    expect(result).toContain("plain string");
    expect(result).not.toContain('"plain string"');
  });

  it("auto-detects object input as JSON", () => {
    const result = buildUserPrompt("Process this", { a: 1 }, "auto");

    expect(result).toContain('"a": 1');
  });

  it("handles null/undefined input data", () => {
    expect(buildUserPrompt("Test", null)).toBe("Test");
    expect(buildUserPrompt("Test", undefined)).toBe("Test");
  });
});

describe("buildPrompts", () => {
  it("builds both system and user prompts", () => {
    const positions: PositionInfo[] = [
      { path: "name", position: 0, type: "string", optional: false, nullable: false },
    ];

    const result = buildPrompts(positions, "Extract data", {
      delimiter: "|",
      subDelimiter: ";",
      mode: "object",
      inputData: { test: true },
    });

    expect(result.systemPrompt).toContain("OUTPUT FORMAT:");
    expect(result.userPrompt).toContain("Extract data");
    expect(result.userPrompt).toContain("INPUT DATA:");
  });
});
