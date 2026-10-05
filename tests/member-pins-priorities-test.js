// Member pins for the Priorities sub-plugin: its tag-list members carry
// list-before/list-after against core anchors, so the core tag tiddlers ship
// core-only list fields. A pin must name a core title (or the empty end form) —
// never another sub-plugin's member, whose absence would leave it inert but
// whose coupling would re-create the cross-plugin naming this scheme removed.
"use strict";
const fs = require("fs");
const path = require("path");

const PLUGIN = path.join(__dirname, "..", "plugins", "hypergsd-priorities");
const CORE = "$:/plugins/yan/hypergsd/";

let fails = 0;
const t = (name, ok, detail) => {
  if (!ok) fails++;
  console.log((ok ? "PASS " : "FAIL ") + name + (ok ? "" : " — " + detail));
};

// header fields of a .tid: the key: value lines before the first blank line
const fieldsOf = (rel) => {
  const text = fs.readFileSync(path.join(PLUGIN, rel), "utf8");
  const map = {};
  for (const line of text.split(/\r?\n/)) {
    if (line === "") break;
    const m = line.match(/^([a-z][a-z0-9\-]*):(.*)$/);
    if (m) map[m[1]] = m[2].replace(/^ /, "");
  }
  return map;
};

// the shipped pins (field, anchor core title) per member
const PINS = [
  ["ui/group-by/priority.tid", "list-before", "ui/group-by/status"],
  ["ui/list-items/priority.tid", "list-after", "ui/list-items/status"]
];
for (const [rel, field, anchor] of PINS) {
  t("pin present: " + rel + " (" + field + " " + anchor + ")", fieldsOf(rel)[field] === CORE + anchor, JSON.stringify(fieldsOf(rel)[field]));
}

// no member of this plugin pins against another sub-plugin's title
const siblings = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!entry.name.endsWith(".tid")) continue;
    for (const [field, value] of Object.entries(fieldsOf(path.relative(PLUGIN, full)))) {
      const ownPrefix = "$:/plugins/yan/" + path.basename(PLUGIN) + "/";
      if ((field === "list-before" || field === "list-after") && value.indexOf("$:/plugins/yan/hypergsd-") === 0 && value.indexOf(ownPrefix) !== 0) {
        siblings.push(path.relative(PLUGIN, full) + " " + field + " -> " + value);
      }
    }
  }
})(PLUGIN);
t("no pin names a foreign plugin title", siblings.length === 0, siblings.join("; "));

console.log(fails ? fails + " FAILURE(S) IN MEMBER-PINS-PRIORITIES" : "ALL MEMBER-PINS-PRIORITIES CASES PASS");
process.exit(fails ? 1 : 0);
