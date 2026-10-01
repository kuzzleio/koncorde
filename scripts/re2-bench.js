"use strict";
/* eslint-disable no-console */

// Usage: node scripts/re2-bench.js <path to the re2 package>
// Micro-benchmark of lib/util/RE2.js (re2js) against the native `re2`
// package, on patterns typical of realtime filters.

const path = require("path");
const Native = require(path.resolve(process.argv[2]));
const { RE2: Js } = require("../lib/util/RE2");
const CASES = [
  ["prefix", "^user_", "", "user_123456"],
  ["suffix/i", "@example\\.com$", "i", "John.Doe@EXAMPLE.com"],
  [
    "email",
    "^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$",
    "i",
    "someone.name+tag@sub.domain.org",
  ],
  [
    "alternation",
    "(error|warn|fatal)",
    "",
    "2026-09-27T10:00:00Z [info] all good, nothing to report here",
  ],
  ["unicode", "\\p{L}+ville$", "u", "Villeneuve-lès-Maguelone Montpelliéville"],
  ["long text", "needle", "", "hay ".repeat(250) + "needle"],
  ["ReDoS-shaped", "(a+)+b", "", "a".repeat(30)],
];
const time = (fn, n) => {
  const t = process.hrtime.bigint();
  for (let i = 0; i < n; i++) {
    fn();
  }
  return Number(process.hrtime.bigint() - t) / n;
};
console.log(
  "case            test() native   test() re2js   ratio | compile native  compile re2js",
);
for (const [name, p, f, s] of CASES) {
  const a = new Native(p, f),
    b = new Js(p, f);
  if (a.test(s) !== b.test(s)) {
    throw new Error("result differs on " + name);
  }
  const n = 200000;
  time(() => a.test(s), 20000);
  time(() => b.test(s), 20000);
  const ta = time(() => a.test(s), n),
    tb = time(() => b.test(s), n);
  const ca = time(() => new Native(p, f), 20000),
    cb = time(() => new Js(p, f), 20000);
  console.log(
    `${name.padEnd(15)} ${ta.toFixed(0).padStart(9)} ns ${tb.toFixed(0).padStart(11)} ns ${(tb / ta).toFixed(1).padStart(6)}x | ${(ca / 1000).toFixed(1).padStart(10)} µs ${(cb / 1000).toFixed(1).padStart(10)} µs`,
  );
}
