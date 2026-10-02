// Wiki-based tests: data-driven render/action/refresh comparisons, after the
// upstream pattern (tw5source editions/test + run-wiki-based-tests.js).
//
// Each tests/wiki-tests/*.tid is a text/vnd.tiddlywiki-multiple file: fixture
// tiddlers first, then sections titled Output (the wikitext under test),
// ExpectedResult (the HTML the wrapper must serialise to) and optionally
// Actions (an action string invoked on the rendered tree, followed by a
// refresh pass). Sections are separated by a line containing just "+".
// Note {{Output}} rebinds currentTiddler to "Output" inside the transclusion —
// scope the item under test inside Output with <$tiddler tiddler="...">.
//
// The runner boots the fixture wiki (repo plugins), resets non-shadow tiddlers
// between cases, wraps Output in the standard Global import chain, renders to
// fakeDOM, optionally runs Actions + refresh, then compares innerHTML.
//
//   node wiki-tests.js              all cases
//   node wiki-tests.js next-action  cases whose filename matches
//   node wiki-tests.js --show X     print the rendered HTML instead of comparing
"use strict";

const fs = require("fs");
const path = require("path");
const harness = require("./lib/harness");

const { $tw, wiki, doc } = harness.boot();
const render = harness.makeRender(wiki, doc, $tw);

const show = process.argv[2] === "--show" || process.argv[2] === "--show-after";
const showAfter = process.argv[2] === "--show-after";
const filter = (show ? process.argv[3] : process.argv[2]) || "";

const files = fs.readdirSync(path.join(__dirname, "wiki-tests"))
  .filter(f => f.endsWith(".tid") && (!filter || f.indexOf(filter) !== -1)).sort();
if (files.length === 0) { console.error("no wiki-test cases match '" + filter + "'"); process.exit(1); }

// upstream's multiple-tiddler split: blocks separated by a lone "+" line. The
// file's own header (up to the first blank line) is case metadata — strip it the
// way disk loading would, so the first fixture is never swallowed into it.
function readBlocks(title, raw) {
  const headerEnd = raw.indexOf("\n\n");
  const meta = Object.create(null);
  if (headerEnd !== -1) $tw.utils.parseFields(raw.slice(0, headerEnd), meta);
  const body = headerEnd === -1 ? raw : raw.slice(headerEnd + 2);
  const blocks = body.split(/\r?\n\+\r?\n/mg).map(block => {
    const split = block.split(/\r?\n\r?\n/mg);
    const fields = Object.create(null);
    $tw.utils.parseFields(split[0], fields);
    if (typeof fields.tags === "string") fields.tags = $tw.utils.parseStringArray(fields.tags);   // the disk-load path parses tags; parseFields leaves a string
    if (split.length >= 2) fields.text = split.slice(1).join("\n\n");
    return fields;
  });
  blocks.description = meta.description;
  return blocks;
}

let fail = 0;
files.forEach(file => {
  const blocks = readBlocks(file, fs.readFileSync(path.join(__dirname, "wiki-tests", file), "utf8"));
  harness.resetFixtures(wiki);
  blocks.forEach(fields => wiki.addTiddler(new $tw.Tiddler(fields)));

  const caseName = blocks.description || file;
  const { w, c } = render(null, { text: "{{Output}}" });

  wiki.clearTiddlerEventQueue();
  if (wiki.tiddlerExists("Actions")) {
    w.invokeActionString(wiki.getTiddlerText("Actions"), w, { type: "test-invoke" });
    w.refresh(wiki.changedTiddlers, c);
  }

  const got = c.innerHTML;
  if (show) {
    console.error("===== " + file + (showAfter ? " (after actions + refresh)" : "") + " =====");   // stderr: stdout carries only the html
    console.log(got);
    return;
  }
  // serialised fakeDOM html carries insignificant newlines (svg text nodes); the
  // multiple-tiddler format cannot round-trip them, so compare on normalised whitespace
  const norm = s => String(s).replace(/\s+/g, " ").trim();
  const want = norm(wiki.getTiddlerText("ExpectedResult"));
  if (norm(got) === want) {
    console.log("PASS " + caseName);
  } else {
    fail++;
    console.log("FAIL " + caseName);
    const g = norm(got);
    let i = 0; while (i < Math.min(g.length, want.length) && g[i] === want[i]) i++;
    console.log("  first difference at character " + (i + 1) + ":");
    console.log("    got : ..." + g.slice(Math.max(0, i - 60), i + 60) + "...");
    console.log("    want: ..." + want.slice(Math.max(0, i - 60), i + 60) + "...");
    console.log("  (run: node wiki-tests.js --show " + file.replace(/\.tid$/, "") + ")");
  }
});

if (!show) {
  console.log(fail === 0 ? "ALL " + files.length + " WIKI-TEST CASE(S) PASS" : fail + " WIKI-TEST FAILURE(S)");
  process.exit(fail === 0 ? 0 : 1);
}