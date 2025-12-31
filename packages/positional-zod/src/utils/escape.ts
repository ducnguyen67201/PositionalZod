/**
 * Escape utilities for handling delimiters in positional format.
 */

/**
 * Split a string by delimiter, respecting escape characters.
 *
 * @example
 * splitWithEscape("a|b|c", "|", "\\") // ["a", "b", "c"]
 * splitWithEscape("a\\|b|c", "|", "\\") // ["a|b", "c"]
 * splitWithEscape("a\\\\|b", "|", "\\") // ["a\\", "b"]
 */
export function splitWithEscape(
  str: string,
  delimiter: string,
  escapeChar: string
): string[] {
  const result: string[] = [];
  let current = "";
  let i = 0;

  while (i < str.length) {
    // Check for escape character
    if (str[i] === escapeChar && i + 1 < str.length) {
      const nextChar = str[i + 1];
      // Escaped delimiter or escaped escape char
      if (nextChar === delimiter || nextChar === escapeChar) {
        current += nextChar;
        i += 2;
        continue;
      }
    }

    // Check for delimiter
    if (str.substring(i, i + delimiter.length) === delimiter) {
      result.push(current);
      current = "";
      i += delimiter.length;
      continue;
    }

    // Regular character
    current += str[i];
    i++;
  }

  // Don't forget the last segment
  result.push(current);

  return result;
}

/**
 * Unescape a value by removing escape characters.
 *
 * @example
 * unescape("a\\|b", "|", "\\") // "a|b"
 * unescape("a\\\\b", "|", "\\") // "a\\b"
 */
export function unescape(
  str: string,
  delimiter: string,
  escapeChar: string
): string {
  let result = "";
  let i = 0;

  while (i < str.length) {
    if (str[i] === escapeChar && i + 1 < str.length) {
      const nextChar = str[i + 1];
      if (nextChar === delimiter || nextChar === escapeChar) {
        result += nextChar;
        i += 2;
        continue;
      }
    }
    result += str[i];
    i++;
  }

  return result;
}

/**
 * Escape a value by adding escape characters before delimiters.
 *
 * @example
 * escape("a|b", "|", "\\") // "a\\|b"
 * escape("a\\b", "|", "\\") // "a\\\\b"
 */
export function escape(
  str: string,
  delimiter: string,
  escapeChar: string
): string {
  let result = "";

  for (const char of str) {
    if (char === delimiter || char === escapeChar) {
      result += escapeChar + char;
    } else {
      result += char;
    }
  }

  return result;
}
