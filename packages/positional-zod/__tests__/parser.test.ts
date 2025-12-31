import { describe, it, expect } from "vitest";
import { z } from "zod";
import { parsePositionalOutput, parseRowRaw } from "../src/parser.js";
import { ParseError, ValidationError } from "../src/errors.js";
import type { PositionInfo, ParserConfig } from "../src/types.js";

const defaultConfig: ParserConfig = {
  delimiter: "|",
  subDelimiter: ";",
  escapeChar: "\\",
};

describe("parsePositionalOutput", () => {
  describe("object mode", () => {
    it("parses single row to object", () => {
      const schema = z.object({
        id: z.number(),
        name: z.string(),
      });

      const positions: PositionInfo[] = [
        { path: "id", position: 0, type: "number", optional: false, nullable: false },
        { path: "name", position: 1, type: "string", optional: false, nullable: false },
      ];

      const result = parsePositionalOutput(
        "42|Alice",
        positions,
        schema,
        defaultConfig,
        "object"
      );

      expect(result.data).toEqual({ id: 42, name: "Alice" });
    });

    it("warns when multiple rows in object mode", () => {
      const schema = z.object({ name: z.string() });
      const positions: PositionInfo[] = [
        { path: "name", position: 0, type: "string", optional: false, nullable: false },
      ];

      const result = parsePositionalOutput(
        "Alice\nBob",
        positions,
        schema,
        defaultConfig,
        "object"
      );

      expect(result.data).toEqual({ name: "Alice" });
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.[0]).toContain("Expected single object but got 2 rows");
    });
  });

  describe("array mode", () => {
    it("parses multiple rows to array", () => {
      const schema = z.object({
        id: z.number(),
        name: z.string(),
      });

      const positions: PositionInfo[] = [
        { path: "id", position: 0, type: "number", optional: false, nullable: false },
        { path: "name", position: 1, type: "string", optional: false, nullable: false },
      ];

      const result = parsePositionalOutput(
        "1|Alice\n2|Bob\n3|Charlie",
        positions,
        schema,
        defaultConfig,
        "array"
      );

      expect(result.data).toEqual([
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
        { id: 3, name: "Charlie" },
      ]);
    });
  });

  describe("type coercion", () => {
    it("coerces numbers", () => {
      const schema = z.object({ value: z.number() });
      const positions: PositionInfo[] = [
        { path: "value", position: 0, type: "number", optional: false, nullable: false },
      ];

      const result = parsePositionalOutput(
        "3.14",
        positions,
        schema,
        defaultConfig,
        "object"
      );

      expect(result.data).toEqual({ value: 3.14 });
    });

    it("coerces booleans", () => {
      const schema = z.object({ active: z.boolean() });
      const positions: PositionInfo[] = [
        { path: "active", position: 0, type: "boolean", optional: false, nullable: false },
      ];

      expect(
        parsePositionalOutput("true", positions, schema, defaultConfig, "object").data
      ).toEqual({ active: true });

      expect(
        parsePositionalOutput("false", positions, schema, defaultConfig, "object").data
      ).toEqual({ active: false });
    });

    it("coerces dates", () => {
      const schema = z.object({ date: z.date() });
      const positions: PositionInfo[] = [
        { path: "date", position: 0, type: "date", optional: false, nullable: false },
      ];

      const result = parsePositionalOutput(
        "2024-01-15T00:00:00Z",
        positions,
        schema,
        defaultConfig,
        "object"
      );

      const data = result.data as { date: Date };
      expect(data.date).toBeInstanceOf(Date);
      expect(data.date.getUTCFullYear()).toBe(2024);
    });

    it("coerces arrays", () => {
      const schema = z.object({ tags: z.array(z.string()) });
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

      const result = parsePositionalOutput(
        "a;b;c",
        positions,
        schema,
        defaultConfig,
        "object"
      );

      expect(result.data).toEqual({ tags: ["a", "b", "c"] });
    });

    it("coerces number arrays", () => {
      const schema = z.object({ scores: z.array(z.number()) });
      const positions: PositionInfo[] = [
        {
          path: "scores",
          position: 0,
          type: "array",
          optional: false,
          nullable: false,
          arrayItemType: "number",
        },
      ];

      const result = parsePositionalOutput(
        "1;2;3",
        positions,
        schema,
        defaultConfig,
        "object"
      );

      expect(result.data).toEqual({ scores: [1, 2, 3] });
    });

    it("coerces JSON", () => {
      const schema = z.object({
        items: z.array(z.object({ name: z.string(), qty: z.number() })),
      });
      const positions: PositionInfo[] = [
        { path: "items", position: 0, type: "json", optional: false, nullable: false },
      ];

      const result = parsePositionalOutput(
        '[{"name":"Widget","qty":2}]',
        positions,
        schema,
        defaultConfig,
        "object"
      );

      expect(result.data).toEqual({
        items: [{ name: "Widget", qty: 2 }],
      });
    });
  });

  describe("nested objects", () => {
    it("reconstructs nested objects from dot notation", () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          email: z.string(),
        }),
      });

      const positions: PositionInfo[] = [
        { path: "user.name", position: 0, type: "string", optional: false, nullable: false },
        { path: "user.email", position: 1, type: "string", optional: false, nullable: false },
      ];

      const result = parsePositionalOutput(
        "Alice|alice@example.com",
        positions,
        schema,
        defaultConfig,
        "object"
      );

      expect(result.data).toEqual({
        user: { name: "Alice", email: "alice@example.com" },
      });
    });

    it("handles deeply nested paths", () => {
      const schema = z.object({
        a: z.object({
          b: z.object({
            c: z.string(),
          }),
        }),
      });

      const positions: PositionInfo[] = [
        { path: "a.b.c", position: 0, type: "string", optional: false, nullable: false },
      ];

      const result = parsePositionalOutput(
        "value",
        positions,
        schema,
        defaultConfig,
        "object"
      );

      expect(result.data).toEqual({ a: { b: { c: "value" } } });
    });
  });

  describe("optional and nullable", () => {
    it("handles empty values as undefined", () => {
      const schema = z.object({
        name: z.string(),
        phone: z.string().optional(),
      });

      const positions: PositionInfo[] = [
        { path: "name", position: 0, type: "string", optional: false, nullable: false },
        { path: "phone", position: 1, type: "string", optional: true, nullable: false },
      ];

      const result = parsePositionalOutput(
        "Alice|",
        positions,
        schema,
        defaultConfig,
        "object"
      );

      expect(result.data).toEqual({ name: "Alice", phone: undefined });
    });

    it("handles null for nullable fields", () => {
      const schema = z.object({
        value: z.string().nullable(),
      });

      const positions: PositionInfo[] = [
        { path: "value", position: 0, type: "string", optional: false, nullable: true },
      ];

      const result = parsePositionalOutput(
        "null",
        positions,
        schema,
        defaultConfig,
        "object"
      );

      expect(result.data).toEqual({ value: null });
    });
  });

  describe("escaped delimiters", () => {
    it("handles escaped delimiters in values", () => {
      const schema = z.object({
        name: z.string(),
        desc: z.string(),
      });

      const positions: PositionInfo[] = [
        { path: "name", position: 0, type: "string", optional: false, nullable: false },
        { path: "desc", position: 1, type: "string", optional: false, nullable: false },
      ];

      const result = parsePositionalOutput(
        "Product|red\\|blue variant",
        positions,
        schema,
        defaultConfig,
        "object"
      );

      expect(result.data).toEqual({
        name: "Product",
        desc: "red|blue variant",
      });
    });
  });

  describe("error handling", () => {
    it("throws ParseError for empty output", () => {
      const schema = z.object({ name: z.string() });
      const positions: PositionInfo[] = [
        { path: "name", position: 0, type: "string", optional: false, nullable: false },
      ];

      expect(() =>
        parsePositionalOutput("", positions, schema, defaultConfig, "object")
      ).toThrow(ParseError);
    });

    it("throws ParseError for column count mismatch", () => {
      const schema = z.object({
        id: z.number(),
        name: z.string(),
      });

      const positions: PositionInfo[] = [
        { path: "id", position: 0, type: "number", optional: false, nullable: false },
        { path: "name", position: 1, type: "string", optional: false, nullable: false },
      ];

      expect(() =>
        parsePositionalOutput("42", positions, schema, defaultConfig, "object")
      ).toThrow(ParseError);

      try {
        parsePositionalOutput("42", positions, schema, defaultConfig, "object");
      } catch (e) {
        expect(e).toBeInstanceOf(ParseError);
        expect((e as ParseError).expectedColumns).toBe(2);
        expect((e as ParseError).actualColumns).toBe(1);
      }
    });

    it("throws ValidationError for invalid data", () => {
      const schema = z.object({
        id: z.number().min(1),
      });

      const positions: PositionInfo[] = [
        { path: "id", position: 0, type: "number", optional: false, nullable: false },
      ];

      expect(() =>
        parsePositionalOutput("0", positions, schema, defaultConfig, "object")
      ).toThrow(ValidationError);
    });
  });

  describe("whitespace handling", () => {
    it("trims whitespace from rows", () => {
      const schema = z.object({ name: z.string() });
      const positions: PositionInfo[] = [
        { path: "name", position: 0, type: "string", optional: false, nullable: false },
      ];

      const result = parsePositionalOutput(
        "  Alice  \n  Bob  ",
        positions,
        schema,
        defaultConfig,
        "array"
      );

      expect(result.data).toEqual([{ name: "Alice" }, { name: "Bob" }]);
    });

    it("ignores empty lines", () => {
      const schema = z.object({ name: z.string() });
      const positions: PositionInfo[] = [
        { path: "name", position: 0, type: "string", optional: false, nullable: false },
      ];

      const result = parsePositionalOutput(
        "Alice\n\nBob\n\n",
        positions,
        schema,
        defaultConfig,
        "array"
      );

      expect(result.data).toHaveLength(2);
    });
  });
});

describe("parseRowRaw", () => {
  it("parses a single row without validation", () => {
    const positions: PositionInfo[] = [
      { path: "id", position: 0, type: "number", optional: false, nullable: false },
      { path: "name", position: 1, type: "string", optional: false, nullable: false },
    ];

    const result = parseRowRaw("42|Alice", positions, defaultConfig);

    expect(result).toEqual({ id: 42, name: "Alice" });
  });
});
