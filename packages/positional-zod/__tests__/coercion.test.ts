import { describe, it, expect } from "vitest";
import { coerceValue, coerceArrayItems } from "../src/utils/coercion.js";

const config = { subDelimiter: ";" };

describe("coerceValue", () => {
  describe("empty string", () => {
    it("returns undefined for empty string", () => {
      expect(coerceValue("", "string", config)).toBeUndefined();
      expect(coerceValue("", "number", config)).toBeUndefined();
      expect(coerceValue("", "boolean", config)).toBeUndefined();
    });
  });

  describe("string type", () => {
    it("returns string as-is", () => {
      expect(coerceValue("hello", "string", config)).toBe("hello");
      expect(coerceValue("hello world", "string", config)).toBe("hello world");
    });
  });

  describe("number type", () => {
    it("coerces integer strings", () => {
      expect(coerceValue("42", "number", config)).toBe(42);
      expect(coerceValue("-42", "number", config)).toBe(-42);
      expect(coerceValue("0", "number", config)).toBe(0);
    });

    it("coerces float strings", () => {
      expect(coerceValue("3.14", "number", config)).toBe(3.14);
      expect(coerceValue("-3.14", "number", config)).toBe(-3.14);
      expect(coerceValue("0.5", "number", config)).toBe(0.5);
    });

    it("coerces scientific notation", () => {
      expect(coerceValue("1e10", "number", config)).toBe(1e10);
      expect(coerceValue("1.5e-3", "number", config)).toBe(0.0015);
    });

    it("handles special values", () => {
      expect(coerceValue("NaN", "number", config)).toBeNaN();
      expect(coerceValue("Infinity", "number", config)).toBe(Infinity);
      expect(coerceValue("-Infinity", "number", config)).toBe(-Infinity);
    });

    it("trims whitespace", () => {
      expect(coerceValue("  42  ", "number", config)).toBe(42);
    });

    it("returns NaN for invalid numbers", () => {
      expect(coerceValue("abc", "number", config)).toBeNaN();
    });
  });

  describe("boolean type", () => {
    it("coerces true values", () => {
      expect(coerceValue("true", "boolean", config)).toBe(true);
      expect(coerceValue("True", "boolean", config)).toBe(true);
      expect(coerceValue("TRUE", "boolean", config)).toBe(true);
      expect(coerceValue("1", "boolean", config)).toBe(true);
      expect(coerceValue("yes", "boolean", config)).toBe(true);
    });

    it("coerces false values", () => {
      expect(coerceValue("false", "boolean", config)).toBe(false);
      expect(coerceValue("False", "boolean", config)).toBe(false);
      expect(coerceValue("FALSE", "boolean", config)).toBe(false);
      expect(coerceValue("0", "boolean", config)).toBe(false);
      expect(coerceValue("no", "boolean", config)).toBe(false);
    });

    it("trims whitespace", () => {
      expect(coerceValue("  true  ", "boolean", config)).toBe(true);
      expect(coerceValue("  false  ", "boolean", config)).toBe(false);
    });
  });

  describe("date type", () => {
    it("coerces ISO date strings", () => {
      // Use full ISO datetime to avoid timezone issues
      const date = coerceValue("2024-01-15T00:00:00Z", "date", config) as Date;
      expect(date).toBeInstanceOf(Date);
      expect(date.getUTCFullYear()).toBe(2024);
      expect(date.getUTCMonth()).toBe(0); // January is 0
      expect(date.getUTCDate()).toBe(15);
    });

    it("coerces ISO datetime strings", () => {
      const date = coerceValue(
        "2024-01-15T10:30:00Z",
        "date",
        config
      ) as Date;
      expect(date).toBeInstanceOf(Date);
      expect(date.getUTCHours()).toBe(10);
      expect(date.getUTCMinutes()).toBe(30);
    });

    it("returns Invalid Date for invalid strings", () => {
      const date = coerceValue("not-a-date", "date", config) as Date;
      expect(date).toBeInstanceOf(Date);
      expect(isNaN(date.getTime())).toBe(true);
    });
  });

  describe("array type", () => {
    it("splits by sub-delimiter", () => {
      expect(coerceValue("a;b;c", "array", config)).toEqual(["a", "b", "c"]);
    });

    it("trims whitespace from items", () => {
      expect(coerceValue("a ; b ; c", "array", config)).toEqual([
        "a",
        "b",
        "c",
      ]);
    });

    it("handles single item", () => {
      expect(coerceValue("a", "array", config)).toEqual(["a"]);
    });

    it("handles empty items", () => {
      expect(coerceValue("a;;c", "array", config)).toEqual(["a", "", "c"]);
    });

    it("works with different sub-delimiters", () => {
      expect(coerceValue("a,b,c", "array", { subDelimiter: "," })).toEqual([
        "a",
        "b",
        "c",
      ]);
    });
  });

  describe("json type", () => {
    it("parses JSON objects", () => {
      expect(coerceValue('{"a":1,"b":2}', "json", config)).toEqual({
        a: 1,
        b: 2,
      });
    });

    it("parses JSON arrays", () => {
      expect(coerceValue("[1,2,3]", "json", config)).toEqual([1, 2, 3]);
    });

    it("parses complex JSON", () => {
      const json = '[{"name":"Widget","qty":2},{"name":"Gadget","qty":1}]';
      expect(coerceValue(json, "json", config)).toEqual([
        { name: "Widget", qty: 2 },
        { name: "Gadget", qty: 1 },
      ]);
    });

    it("returns original string for invalid JSON", () => {
      expect(coerceValue("not json", "json", config)).toBe("not json");
    });

    it("trims whitespace before parsing", () => {
      expect(coerceValue('  {"a":1}  ', "json", config)).toEqual({ a: 1 });
    });
  });

  describe("enum type", () => {
    it("returns string as-is for enum", () => {
      expect(coerceValue("pending", "enum", config)).toBe("pending");
      expect(coerceValue("active", "enum", config)).toBe("active");
    });
  });

  describe("literal type", () => {
    it("returns string as-is for literal", () => {
      expect(coerceValue("fixed_value", "literal", config)).toBe("fixed_value");
    });
  });
});

describe("coerceArrayItems", () => {
  it("coerces array of strings", () => {
    expect(coerceArrayItems(["a", "b", "c"], "string", config)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("coerces array of numbers", () => {
    expect(coerceArrayItems(["1", "2", "3"], "number", config)).toEqual([
      1, 2, 3,
    ]);
  });

  it("coerces array of booleans", () => {
    expect(
      coerceArrayItems(["true", "false", "true"], "boolean", config)
    ).toEqual([true, false, true]);
  });

  it("handles empty items as undefined", () => {
    expect(coerceArrayItems(["a", "", "c"], "string", config)).toEqual([
      "a",
      undefined,
      "c",
    ]);
  });
});
