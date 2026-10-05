// Gate purity: the main plugin names no sub-plugin's feature state. The refresh
// gates derive feature-owned runs from hgsd-refresh-whitelist declarations
// (ListItem fragments, Strip members, Lists members, ViewPlacement bodies), so a
// sub-plugin namespace appearing in a core gate means someone hand-copied a run
// back in — the freeze-regression route this derivation replaced. Also guards
// the shipped declarations exist (the derivation's fuel), and that the main
// plugin's tag tiddlers name no sub-plugin title (ordering is member-carried;
// tag-tiddler list fields carry core members only).
"use strict";
const fs = require("fs");
const path = require("path");

const MAIN = path.join(__dirname, "..", "plugins", "hypergsd");

let fails = 0;
const t = (name, ok, detail) => {
  if (!ok) fails++;
  console.log((ok ? "PASS " : "FAIL ") + name + (ok ? "" : " — " + detail));
};

// Feature state namespaces owned by sub-plugins (the hand-copied set this
// derivation replaced) and the feature-named type tag: heritable families
// ship their own $:/tags/hypergsd/Inheritance rule and harvest the caller
// themselves, so the core naming GSD/Contexts anywhere means a hand-named
// type crept back in.
const BANNED = [
  "contextualise",           // hypergsd-contexts: reveal/picker state + temps
  "add-context-",
  "pick-contextualise",
  "pick-contact-filter",     // hypergsd-contacts: the strip picker's popup
  "contact-filter/",
  "context-group",
  "GSD/Contexts"             // hypergsd-contexts: the contexts family tag — Inheritance rules harvest their own family
];

const offenders = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!entry.name.endsWith(".tid") && !entry.name.endsWith(".js")) continue;
    const text = fs.readFileSync(full, "utf8");
    for (const needle of BANNED) {
      if (text.indexOf(needle) !== -1) offenders.push(path.relative(MAIN, full) + " contains " + JSON.stringify(needle));
    }
  }
})(MAIN);
t("main plugin free of sub-plugin feature namespaces", offenders.length === 0, offenders.join("; "));

// Tag tiddlers: the main plugin's tag tiddlers name no sub-plugin title.
// Ordering arrives from the members (list-before/list-after pins against core
// anchors — see the member-pins-* tests), and a tag tiddler's list field, where
// one ships, carries core members only — so an absent sub-plugin degrades by
// tag-index absence, never by a dangling core-side pin.
const TAG_DIR = path.join(MAIN, "ui", "tags");
const tagOffenders = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!entry.name.endsWith(".tid")) continue;
    const text = fs.readFileSync(full, "utf8");
    if (text.indexOf("$:/plugins/yan/hypergsd-") !== -1) tagOffenders.push(path.relative(MAIN, full));
  }
})(TAG_DIR);
t("main plugin tag tiddlers name no sub-plugin title", tagOffenders.length === 0, tagOffenders.join("; "));

// The shipped declarations the derivations compose (absent one = a frozen
// control somewhere, with no core run to catch it).
const DECLARANTS = [
  ["hypergsd-contexts/ui/list-items/context.tid", "prefix[$:/state/hypergsd/contextualise]"],
  ["hypergsd-ticklers/ui/list-items/tickler.tid", "prefix[$:/state/popup/pick-]"],
  ["hypergsd-priorities/ui/list-items/priority.tid", "hgsd-refresh-whitelist"],
  ["hypergsd-contacts/ui/components/contact-select.tid", "prefix[$:/state/popup/pick-contact-filter]"]
];
for (const [rel, needle] of DECLARANTS) {
  const text = fs.readFileSync(path.join(__dirname, "..", "plugins", rel), "utf8");
  t("declaration present: " + path.basename(rel), text.indexOf(needle) !== -1, "missing " + JSON.stringify(needle));
}

console.log(fails === 0 ? "ALL GATE-PURITY CASES PASS" : fails + " FAILURE(S) IN GATE-PURITY");
process.exit(fails === 0 ? 0 : 1);
