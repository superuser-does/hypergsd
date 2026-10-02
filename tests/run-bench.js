#!/usr/bin/env node
// Run the benchmark files (one node process per *-bench.js) under TZ=UTC.
"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

process.chdir(__dirname);
const env = Object.assign({}, process.env, { TZ: "UTC" });

const files = fs.readdirSync(".").filter(f => f.endsWith("-bench.js") && f !== path.basename(__filename)).sort();
if (files.length === 0) { console.error("no bench files found"); process.exit(1); }

let failed = 0;
for (const f of files) {
  console.log("== " + f);
  const r = spawnSync(process.execPath, [f], { encoding: "utf8", env, stdio: ["ignore", "inherit", "inherit"] });
  if (r.status !== 0) { failed++; console.log("   FAILED (exit " + r.status + ")"); }
}
console.log(failed === 0 ? "ALL " + files.length + " BENCH FILE(S) PASS" : failed + " OF " + files.length + " BENCH FILES FAILED");
process.exit(failed === 0 ? 0 : 1);