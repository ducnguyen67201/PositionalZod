import { describe, it, expect } from "vitest";
import { splitWithEscape, unescape, escape } from "../src/utils/escape.js";

describe("splitWithEscape", () => {
  const delimiter = "|";
  const escapeChar = "\\";

  it("splits simple string by delimiter", () => {
    expect(splitWithEscape("a|b|c", delimiter, escapeChar)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("handles escaped delimiter", () => {
    expect(splitWithEscape("a\\|b|c", delimiter, escapeChar)).toEqual([
      "a|b",
      "c",
    ]);
  });

  it("handles escaped escape character", () => {
    expect(splitWithEscape("a\\\\|b", delimiter, escapeChar)).toEqual([
      "a\\",
      "b",
    ]);
  });

  it("handles multiple escaped delimiters", () => {
    expect(splitWithEscape("a\\|b\\|c|d", delimiter, escapeChar)).toEqual([
      "a|b|c",
      "d",
    ]);
  });

  it("handles empty values between delimiters", () => {
    expect(splitWithEscape("a||c", delimiter, escapeChar)).toEqual([
      "a",
      "",
      "c",
    ]);
  });

  it("handles empty string", () => {
    expect(splitWithEscape("", delimiter, escapeChar)).toEqual([""]);
  });

  it("handles string with only delimiters", () => {
    expect(splitWithEscape("||", delimiter, escapeChar)).toEqual([
      "",
      "",
      "",
    ]);
  });

  it("handles string with no delimiters", () => {
    expect(splitWithEscape("abc", delimiter, escapeChar)).toEqual(["abc"]);
  });

  it("handles escape at end of string (not followed by delimiter)", () => {
    expect(splitWithEscape("a\\", delimiter, escapeChar)).toEqual(["a\\"]);
  });

  it("handles mixed escaped and unescaped", () => {
    expect(splitWithEscape("a|b\\|c|d\\\\|e", delimiter, escapeChar)).toEqual([
      "a",
      "b|c",
      "d\\",
      "e",
    ]);
  });

  it("works with different delimiters", () => {
    expect(splitWithEscape("a;b;c", ";", "\\")).toEqual(["a", "b", "c"]);
    expect(splitWithEscape("a\\;b;c", ";", "\\")).toEqual(["a;b", "c"]);
  });

  it("works with multi-character delimiter", () => {
    expect(splitWithEscape("a||b||c", "||", "\\")).toEqual(["a", "b", "c"]);
  });
});

describe("unescape", () => {
  const delimiter = "|";
  const escapeChar = "\\";

  it("unescapes escaped delimiter", () => {
    expect(unescape("a\\|b", delimiter, escapeChar)).toBe("a|b");
  });

  it("unescapes escaped escape character", () => {
    expect(unescape("a\\\\b", delimiter, escapeChar)).toBe("a\\b");
  });

  it("leaves unescaped characters alone", () => {
    expect(unescape("abc", delimiter, escapeChar)).toBe("abc");
  });

  it("handles empty string", () => {
    expect(unescape("", delimiter, escapeChar)).toBe("");
  });

  it("handles multiple escapes", () => {
    expect(unescape("a\\|b\\\\c\\|d", delimiter, escapeChar)).toBe("a|b\\c|d");
  });
});

describe("escape", () => {
  const delimiter = "|";
  const escapeChar = "\\";

  it("escapes delimiter", () => {
    expect(escape("a|b", delimiter, escapeChar)).toBe("a\\|b");
  });

  it("escapes escape character", () => {
    expect(escape("a\\b", delimiter, escapeChar)).toBe("a\\\\b");
  });

  it("leaves normal characters alone", () => {
    expect(escape("abc", delimiter, escapeChar)).toBe("abc");
  });

  it("handles empty string", () => {
    expect(escape("", delimiter, escapeChar)).toBe("");
  });

  it("escapes multiple special characters", () => {
    expect(escape("a|b\\c|d", delimiter, escapeChar)).toBe("a\\|b\\\\c\\|d");
  });
});

describe("escape/unescape roundtrip", () => {
  const delimiter = "|";
  const escapeChar = "\\";

  it("roundtrips simple string", () => {
    const original = "hello world";
    expect(unescape(escape(original, delimiter, escapeChar), delimiter, escapeChar)).toBe(original);
  });

  it("roundtrips string with delimiter", () => {
    const original = "hello|world";
    expect(unescape(escape(original, delimiter, escapeChar), delimiter, escapeChar)).toBe(original);
  });

  it("roundtrips string with escape char", () => {
    const original = "hello\\world";
    expect(unescape(escape(original, delimiter, escapeChar), delimiter, escapeChar)).toBe(original);
  });

  it("roundtrips complex string", () => {
    const original = "a|b\\c|d\\|e";
    expect(unescape(escape(original, delimiter, escapeChar), delimiter, escapeChar)).toBe(original);
  });
});
