#!/usr/bin/env node
// Run the whole HyperGSD battery (one node process per file) and aggregate verdicts.
// Usage: node tests/run-all.js [substring]   — e.g. node tests/run-all.js tickler
"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

process.chdir(__dirname);

// Date-sensitive harnesses compare stored UTC date strings with the local calendar
// date; UTC removes the local-midnight lag (see the develop-with-playwright skill).
const env = Object.assign({}, process.env, { TZ: "UTC" });

const wanted = process.argv[2] || "";
const files = fs.readdirSync(".").filter(f => (/(-test|wiki-tests)\.js$/.test(f)))
  .filter(f => !wanted || f.indexOf(wanted) !== -1).sort();
if (files.length === 0) { console.error("no test files match '" + wanted + "'"); process.exit(1); }

let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, [f], { encoding: "utf8", env });
  const lines = (r.stdout + r.stderr).split(/\r?\n/).filter(Boolean);
  const summary = lines[lines.length - 1] || "(no output)";
  if (r.status === 0) {
    console.log("  ok    " + f.padEnd(32) + " " + summary);
  } else {
    failed++;
    const fails = lines.filter(l => /^FAIL |FAILURE|Error:/.test(l));
    console.log("  FAIL  " + f.padEnd(32) + " " + fails.length + " assertion(s)");
    lines.filter(l => /^FAIL |FAILURE|Error:/.test(l)).slice(0, 5).forEach(l => console.log("        " + l));
    if (fails.length === 0) console.log("        " + summary);   // crash without assertion output
  }
}

console.log("");
console.log(failed === 0 ? "ALL " + files.length + " FILE(S) PASS" : failed + " OF " + files.length + " FILE(S) FAILED");
process.exit(failed === 0 ? 0 : 1);