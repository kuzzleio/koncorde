"use strict";
/* eslint-disable no-console */

// Usage: node scripts/re2-parity.js <path to the re2 package> [patterns]
//
// Differential test of lib/util/RE2.js (re2js) against the `re2` package it
// replaces. For seeded random patterns and flags it compares:
//   - whether the pattern compiles, and the SyntaxError message when not;
//   - the result of a sequence of test() calls on the same object (so the
//     lastIndex state of the "g" and "y" flags is compared too).
// CI runs it against re2 1.22.3, the version Koncorde depended on.
//
// Behaviour (compiles or not, test() results) must match exactly; the wording
// of a syntax error is reported separately, as a few rare RE2 messages are not
// reproduced. Two differences are deliberate, both because RE2 (C++) walks
// UTF-8 bytes where re2js walks characters (see lib/util/RE2.js):
//   - `\C` (one byte) is left out of the generated patterns;
//   - `\B` can match between the bytes of a multi-byte character in RE2 —
//     "Aé1" has a non-boundary inside the "é" — and cannot in re2js. Such
//     mismatches are counted apart, and only on non-ASCII input.

const path = require("path");

const [re2Path, n = "20000"] = process.argv.slice(2);
const Reference = require(path.resolve(re2Path));
const { RE2: Candidate } = require("../lib/util/RE2");

let seed = 42;
const rnd = () =>
  (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = (list) => list[Math.floor(rnd() * list.length)];

const TOKENS = [
  // literals, including non-ASCII, astral and characters RE2 cares about
  "a",
  "b",
  "c",
  "A",
  "é",
  "É",
  "ß",
  "😀",
  "/",
  " ",
  "-",
  "_",
  "\n",
  "k",
  "K",
  // classes and escapes
  ".",
  "\\d",
  "\\D",
  "\\w",
  "\\W",
  "\\s",
  "\\S",
  "\\b",
  "\\B",
  "[a-c]",
  "[^a]",
  "[A-Z]",
  "[é-ù]",
  "[\\d_]",
  "[[:alpha:]]",
  "\\p{L}",
  "\\p{Lu}",
  "\\P{Ll}",
  "\\p{Letter}",
  "\\p{Script=Greek}",
  "\\p{sc=Latin}",
  "\\pL",
  "\\u00e9",
  "\\u{1F600}",
  "\\x41",
  "\\x{263a}",
  "\\cA",
  "\\cz",
  "\\t",
  "\\n",
  "\\\\",
  "\\/",
  "\\.",
  "\\Q",
  "\\E",
  "\\A",
  "\\z",
  // anchors, groups, alternation
  "^",
  "$",
  "(",
  ")",
  "(?:",
  "(?<n>",
  "(?P<m>",
  "(?i)",
  "(?s)",
  "(?m)",
  "|",
  // quantifiers
  "*",
  "+",
  "?",
  "{2}",
  "{1,3}",
  "{2,}",
  "*?",
  "+?",
  "??",
  "{,2}",
  // what RE2 rejects
  "\\1",
  "(?=",
  "(?!",
  "(?<=",
  "[",
  "]",
  "{2,1}",
  "\\8",
  "(?<>",
  "**",
];
const FLAGS = [
  "",
  "",
  "",
  "i",
  "m",
  "s",
  "g",
  "y",
  "u",
  "gi",
  "im",
  "ms",
  "gy",
  "ii",
  "x",
  "d",
  "gims",
];
const ALPHABET = [
  "a",
  "b",
  "c",
  "A",
  "B",
  "é",
  "É",
  "ß",
  "ss",
  "😀",
  "/",
  " ",
  "\n",
  "1",
  "7",
  "_",
  "-",
  "k",
  "K",
  "K",
  "α",
  "Ω",
];

function pattern() {
  let p = "";
  const len = 1 + Math.floor(rnd() * 6);
  for (let i = 0; i < len; i++) {
    p += pick(TOKENS);
  }
  return p;
}

function input() {
  let s = "";
  const len = Math.floor(rnd() * 8);
  for (let i = 0; i < len; i++) {
    s += pick(ALPHABET);
  }
  return s;
}

function run(Engine, p, f, inputs) {
  let re;
  try {
    re = new Engine(p, f);
  } catch (e) {
    return { rejected: e.constructor.name, message: e.message };
  }
  // `re2` returns null instead of false when lastIndex > input.length
  return { tests: inputs.map((s) => Boolean(re.test(s))) };
}

const PATTERNS = Number(n);
let compiled = 0;
let rejected = 0;
let mismatches = 0;
let messageDiffs = 0;
let knownBDiffs = 0;

for (let i = 0; i < PATTERNS; i++) {
  const p = pattern();
  const f = pick(FLAGS);
  const inputs = Array.from({ length: 12 }, input);
  const r = run(Reference, p, f, inputs);
  const c = run(Candidate, p, f, inputs);
  const ref = JSON.stringify({ rejected: r.rejected, tests: r.tests });
  const got = JSON.stringify({ rejected: c.rejected, tests: c.tests });

  if (r.rejected) {
    rejected++;
  } else {
    compiled++;
  }

  if (ref === got && r.message !== c.message) {
    messageDiffs++;
    if (messageDiffs <= 5) {
      console.log(
        `message differs for /${p}/${f}\n  re2:   ${r.message}\n  re2js: ${c.message}`,
      );
    }
  }

  if (ref !== got && /\\B/.test(p) && inputs.some((x) => /[^ -~\n]/.test(x))) {
    knownBDiffs++;
    continue;
  }

  if (ref !== got) {
    mismatches++;
    if (mismatches <= 10) {
      console.log(
        `MISMATCH /${p}/${f} on ${JSON.stringify(inputs)}\n  re2:    ${ref}\n  re2js:  ${got}`,
      );
    }
  }
}

console.log(
  `${mismatches === 0 ? "PARITY OK" : "PARITY FAILED"}: ${PATTERNS} patterns (${compiled} compiled, ${rejected} rejected), ${compiled * 12} test() calls, ${mismatches} behaviour mismatch(es) (+${knownBDiffs} known \\B byte-position ones); syntax error wording identical for ${rejected - messageDiffs}/${rejected}; node ${process.version}`,
);
process.exit(mismatches === 0 ? 0 : 1);
