"use strict";

/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2026 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const { RE2JS } = require("re2js");

/**
 * The subset of the `re2` package's RE2 class that Koncorde uses — construct,
 * test(), toString() — implemented on re2js, a pure JavaScript port of RE2:
 * same linear-time guarantee, no native addon to download or compile.
 *
 * It reproduces what `re2` (1.22) did on top of the RE2 engine itself, so
 * that filters behave exactly as before (test/re2.parity.js checks it):
 *   - JS regexp syntax translated to RE2 syntax (translate() below);
 *   - flags: i, m, s honoured, g and y make test() stateful through
 *     lastIndex, any other character ignored;
 *   - syntax errors thrown as SyntaxError with RE2's own messages, which
 *     Koncorde forwards to its callers (the common ones; a few rare messages
 *     are worded differently, the accepted/rejected verdict never is).
 *
 * One deliberate difference: `\C` (one byte, in RE2) is read as one
 * character, the same on ASCII input. re2js has no byte-level matching.
 */

// Long Unicode general category names, as `re2` rewrites them for RE2
const UNICODE_CLASSES = {
  Close_Punctuation: "Pe",
  Connector_Punctuation: "Pc",
  Control: "Cc",
  Currency_Symbol: "Sc",
  Cased_Letter: "LC",
  Dash_Punctuation: "Pd",
  Decimal_Number: "Nd",
  Enclosing_Mark: "Me",
  Final_Punctuation: "Pf",
  Format: "Cf",
  Initial_Punctuation: "Pi",
  Letter: "L",
  Letter_Number: "Nl",
  Line_Separator: "Zl",
  Lowercase_Letter: "Ll",
  Mark: "M",
  Math_Symbol: "Sm",
  Modifier_Letter: "Lm",
  Modifier_Symbol: "Sk",
  Nonspacing_Mark: "Mn",
  Number: "N",
  Open_Punctuation: "Ps",
  Other: "C",
  Other_Letter: "Lo",
  Other_Number: "No",
  Other_Punctuation: "Po",
  Other_Symbol: "So",
  Paragraph_Separator: "Zp",
  Private_Use: "Co",
  Punctuation: "P",
  Separator: "Z",
  Space_Separator: "Zs",
  Spacing_Mark: "Mc",
  Surrogate: "Cs",
  Symbol: "S",
  Titlecase_Letter: "Lt",
  Unassigned: "Cn",
  Uppercase_Letter: "Lu",
};

// re2js reports Go's regexp/syntax error codes; `re2` reported RE2's (C++)
const ERROR_TEXTS = {
  "invalid named capture": "invalid named capture group",
  "invalid nested repetition operator": "bad repetition operator",
  "invalid or unsupported Perl syntax": "invalid perl operator",
  "invalid repeat count": "invalid repetition size",
  "missing argument to repetition operator":
    "no argument for repetition operator",
  "missing closing )": "missing )",
  "missing closing ]": "missing ]",
  "trailing backslash at end of expression": "trailing \\",
};

const isHex = (ch) => /^[0-9A-Fa-f]$/.test(ch);
const isUpper = (ch) => ch >= "A" && ch <= "Z";

/**
 * Port of `re2`'s translateRegExp (lib/new.cc): JS-only escapes to their RE2
 * spelling, `(?<name>` to `(?P<name>`, and the multiline flag as `(?m)`.
 *
 * @param {string} source
 * @param {boolean} multiline
 * @returns {string}
 */
function translate(source, multiline) {
  if (source.length === 0) {
    return "(?:)";
  }

  const chars = Array.from(source); // code points, as RE2 walks UTF-8
  let result = multiline ? "(?m)" : "";

  for (let i = 0; i < chars.length; ) {
    const ch = chars[i];

    if (ch === "\\" && i + 1 < chars.length) {
      const next = chars[i + 1];

      if (next === "c" && i + 2 < chars.length && isUpper(chars[i + 2])) {
        const code = chars[i + 2].charCodeAt(0) - 64;
        result += "\\x" + code.toString(16).toUpperCase().padStart(2, "0");
        i += 3;
        continue;
      }

      if (next === "u" && i + 2 < chars.length) {
        if (isHex(chars[i + 2])) {
          let digits = chars[i + 2];
          i += 3;

          for (let j = 0; j < 3 && i < chars.length && isHex(chars[i]); j++) {
            digits += chars[i++];
          }

          result += "\\x{" + digits + "}";
          continue;
        }

        if (chars[i + 2] === "{") {
          result += "\\x";
          i += 2;
          continue;
        }
      }

      if ((next === "p" || next === "P") && chars[i + 2] === "{") {
        const end = chars.indexOf("}", i + 3);

        if (end !== -1) {
          let name = chars.slice(i + 3, end).join("");

          if (UNICODE_CLASSES[name]) {
            name = UNICODE_CLASSES[name];
          } else if (name.length > 7 && name.startsWith("Script=")) {
            name = name.slice(7);
          } else if (name.length > 3 && name.startsWith("sc=")) {
            name = name.slice(3);
          }

          result += "\\" + next + (name.length === 1 ? name : `{${name}}`);
          i = end + 1;
          continue;
        }
      }

      if (next === "C") {
        result += "(?s:.)";
        i += 2;
        continue;
      }

      // any other escape, "\\" included, is kept as is
      result += "\\" + next;
      i += 2;
      continue;
    }

    if (ch === "/") {
      result += "\\/";
      i += 1;
      continue;
    }

    // a named group, not a lookbehind (which RE2 then rejects)
    if (
      ch === "(" &&
      chars[i + 1] === "?" &&
      chars[i + 2] === "<" &&
      chars[i + 3] !== "=" &&
      chars[i + 3] !== "!"
    ) {
      result += "(?P<";
      i += 3;
      continue;
    }

    result += ch;
    i += 1;
  }

  return result;
}

class RE2 {
  /**
   * @param {string} pattern
   * @param {string} [flags]
   * @throws {SyntaxError} if RE2 cannot parse the pattern
   */
  constructor(pattern, flags = "") {
    this.source = String(pattern);

    const set = new Set(String(flags));
    this.global = set.has("g");
    this.ignoreCase = set.has("i");
    this.multiline = set.has("m");
    this.dotAll = set.has("s");
    this.sticky = set.has("y");
    this.flags = ["g", "i", "m", "s"]
      .filter((f) => set.has(f))
      .concat("u", this.sticky ? ["y"] : [])
      .join("");
    this.lastIndex = 0;

    try {
      this.regexp = RE2JS.compile(
        translate(this.source, this.multiline),
        (this.ignoreCase ? RE2JS.CASE_INSENSITIVE : 0) |
          (this.dotAll ? RE2JS.DOTALL : 0),
      );
    } catch (error) {
      throw toSyntaxError(error, this);
    }
  }

  /**
   * RegExp.prototype.test semantics, lastIndex included for "g" and "y"
   *
   * @param {string} input
   * @returns {boolean}
   */
  test(input) {
    const str = String(input);

    if (!this.global && !this.sticky) {
      return this.regexp.test(str);
    }

    if (this.lastIndex > str.length) {
      this.lastIndex = 0;
      return false;
    }

    const matcher = this.regexp.matcher(str);

    if (
      matcher.find(this.lastIndex) &&
      (!this.sticky || matcher.start() === this.lastIndex)
    ) {
      this.lastIndex = matcher.end();
      return true;
    }

    this.lastIndex = 0;
    return false;
  }

  toString() {
    return `/${this.source}/${this.flags}`;
  }
}

/**
 * @param {Error} error - re2js' RE2JSSyntaxException, or anything else
 * @param {RE2} re
 * @returns {Error}
 */
function toSyntaxError(error, re) {
  if (typeof error.error !== "string") {
    return error;
  }

  if (error.error === "duplicate capture group name") {
    return new SyntaxError(error.error);
  }

  let input = error.input;
  let text = ERROR_TEXTS[error.error] || error.error;

  if (input) {
    // re2js quotes the pattern with the prefixes its flags add; RE2 does not
    if (re.dotAll && input.startsWith("(?s)")) {
      input = input.slice(4);
    }

    if (re.ignoreCase && input.startsWith("(?i)")) {
      input = input.slice(4);
    }

    // re2js reads a lookbehind as a named group, RE2 as a Perl operator
    if (
      error.error === "invalid named capture" &&
      (input.startsWith("(?<=") || input.startsWith("(?<!"))
    ) {
      text = "invalid perl operator";
      input = input.slice(0, 4);
    }
  }

  return new SyntaxError(input ? `${text}: ${input}` : text);
}

module.exports = { RE2, translate };
