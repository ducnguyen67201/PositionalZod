import { describe, it, expect } from "vitest";
import { z } from "zod";
import { analyzeSchema, getSchemaPositionMap } from "../src/schema-analyzer.js";
import { SchemaError } from "../src/errors.js";

describe("analyzeSchema", () => {
  describe("simple flat objects", () => {
    it("analyzes flat object with primitives", () => {
      const schema = z.object({
        id: z.number(),
        name: z.string(),
        active: z.boolean(),
      });

      const positions = analyzeSchema(schema);

      expect(positions).toHaveLength(3);
      expect(positions[0]).toEqual({
        path: "id",
        position: 0,
        type: "number",
        optional: false,
        nullable: false,
      });
      expect(positions[1]).toEqual({
        path: "name",
        position: 1,
        type: "string",
        optional: false,
        nullable: false,
      });
      expect(positions[2]).toEqual({
        path: "active",
        position: 2,
        type: "boolean",
        optional: false,
        nullable: false,
      });
    });

    it("analyzes object with date", () => {
      const schema = z.object({
        createdAt: z.date(),
      });

      const positions = analyzeSchema(schema);

      expect(positions).toHaveLength(1);
      expect(positions[0]).toMatchObject({
        path: "createdAt",
        type: "date",
      });
    });
  });

  describe("nested objects", () => {
    it("flattens nested objects with dot notation", () => {
      const schema = z.object({
        id: z.number(),
        user: z.object({
          name: z.string(),
          email: z.string(),
        }),
      });

      const positions = analyzeSchema(schema);

      expect(positions).toHaveLength(3);
      expect(positions[0]).toMatchObject({ path: "id", position: 0 });
      expect(positions[1]).toMatchObject({ path: "user.name", position: 1 });
      expect(positions[2]).toMatchObject({ path: "user.email", position: 2 });
    });

    it("handles deeply nested objects", () => {
      const schema = z.object({
        a: z.object({
          b: z.object({
            c: z.string(),
          }),
        }),
      });

      const positions = analyzeSchema(schema);

      expect(positions).toHaveLength(1);
      expect(positions[0]).toMatchObject({ path: "a.b.c", position: 0 });
    });
  });

  describe("arrays", () => {
    it("analyzes array of primitives", () => {
      const schema = z.object({
        tags: z.array(z.string()),
      });

      const positions = analyzeSchema(schema);

      expect(positions).toHaveLength(1);
      expect(positions[0]).toMatchObject({
        path: "tags",
        type: "array",
        arrayItemType: "string",
      });
    });

    it("analyzes array of numbers", () => {
      const schema = z.object({
        scores: z.array(z.number()),
      });

      const positions = analyzeSchema(schema);

      expect(positions[0]).toMatchObject({
        path: "scores",
        type: "array",
        arrayItemType: "number",
      });
    });

    it("analyzes array of objects as json", () => {
      const schema = z.object({
        items: z.array(
          z.object({
            name: z.string(),
            qty: z.number(),
          })
        ),
      });

      const positions = analyzeSchema(schema);

      expect(positions).toHaveLength(1);
      expect(positions[0]).toMatchObject({
        path: "items",
        type: "json",
      });
    });
  });

  describe("optional and nullable", () => {
    it("marks optional fields", () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
      });

      const positions = analyzeSchema(schema);

      expect(positions[0]).toMatchObject({ path: "required", optional: false });
      expect(positions[1]).toMatchObject({ path: "optional", optional: true });
    });

    it("marks nullable fields", () => {
      const schema = z.object({
        value: z.string().nullable(),
      });

      const positions = analyzeSchema(schema);

      expect(positions[0]).toMatchObject({ path: "value", nullable: true });
    });

    it("handles optional and nullable combined", () => {
      const schema = z.object({
        value: z.string().optional().nullable(),
      });

      const positions = analyzeSchema(schema);

      expect(positions[0]).toMatchObject({
        path: "value",
        optional: true,
        nullable: true,
      });
    });
  });

  describe("enums and literals", () => {
    it("analyzes enum fields", () => {
      const schema = z.object({
        status: z.enum(["pending", "active", "done"]),
      });

      const positions = analyzeSchema(schema);

      expect(positions[0]).toMatchObject({
        path: "status",
        type: "enum",
        enumValues: ["pending", "active", "done"],
      });
    });

    it("analyzes literal fields", () => {
      const schema = z.object({
        type: z.literal("user"),
      });

      const positions = analyzeSchema(schema);

      expect(positions[0]).toMatchObject({
        path: "type",
        type: "literal",
        literalValue: "user",
      });
    });
  });

  describe("wrapper types", () => {
    it("unwraps default", () => {
      const schema = z.object({
        count: z.number().default(0),
      });

      const positions = analyzeSchema(schema);

      expect(positions[0]).toMatchObject({
        path: "count",
        type: "number",
      });
    });

    it("unwraps catch", () => {
      const schema = z.object({
        value: z.string().catch("default"),
      });

      const positions = analyzeSchema(schema);

      expect(positions[0]).toMatchObject({
        path: "value",
        type: "string",
      });
    });
  });

  describe("unsupported types", () => {
    it("throws SchemaError for z.record()", () => {
      const schema = z.object({
        data: z.record(z.string()),
      });

      expect(() => analyzeSchema(schema)).toThrow(SchemaError);
      expect(() => analyzeSchema(schema)).toThrow(/ZodRecord/);
    });

    it("throws SchemaError for z.map()", () => {
      const schema = z.object({
        data: z.map(z.string(), z.number()),
      });

      expect(() => analyzeSchema(schema)).toThrow(SchemaError);
      expect(() => analyzeSchema(schema)).toThrow(/ZodMap/);
    });

    it("throws SchemaError for z.set()", () => {
      const schema = z.object({
        items: z.set(z.string()),
      });

      expect(() => analyzeSchema(schema)).toThrow(SchemaError);
      expect(() => analyzeSchema(schema)).toThrow(/ZodSet/);
    });

    it("throws SchemaError for z.function()", () => {
      const schema = z.object({
        fn: z.function(),
      });

      expect(() => analyzeSchema(schema)).toThrow(SchemaError);
      expect(() => analyzeSchema(schema)).toThrow(/ZodFunction/);
    });
  });

  describe("complex schemas", () => {
    it("analyzes complex real-world schema", () => {
      const schema = z.object({
        orderId: z.string(),
        customer: z.object({
          name: z.string(),
          email: z.string(),
        }),
        items: z.array(
          z.object({
            sku: z.string(),
            qty: z.number(),
          })
        ),
        total: z.number(),
        status: z.enum(["pending", "shipped", "delivered"]),
        notes: z.string().optional(),
      });

      const positions = analyzeSchema(schema);

      expect(positions).toHaveLength(7);
      expect(positions.map((p) => p.path)).toEqual([
        "orderId",
        "customer.name",
        "customer.email",
        "items",
        "total",
        "status",
        "notes",
      ]);
    });
  });
});

describe("getSchemaPositionMap", () => {
  it("returns a map of paths to position info", () => {
    const schema = z.object({
      id: z.number(),
      name: z.string(),
    });

    const map = getSchemaPositionMap(schema);

    expect(map["id"]).toMatchObject({ path: "id", position: 0 });
    expect(map["name"]).toMatchObject({ path: "name", position: 1 });
  });
});
