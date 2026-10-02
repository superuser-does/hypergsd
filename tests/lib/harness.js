// Shared harness for the HyperGSD battery: boot, render, walk, reset, assert.
// New tests should require this instead of re-deriving the patterns inline
// (see the tiddlywiki-develop-with-playwright skill for the conventions).
//
//   const { boot, render, textOf, resetFixtures, t, finish } = require("./lib/harness");
//   const { wiki } = boot();                       // tests/fixture-wiki by default
//   const { w, c } = render("$:/plugins/yan/hypergsd/ui/...");   // Global chain + fakeDOM
//   resetFixtures();                               // delete every non-shadow tiddler
//   t("name", got, want);                          // array-safe deep compare
//   finish("AREA");                                // summary line + exit code
//
// boot("fixture-absent") boots the sub-plugins-absent fixture instead.

"use strict";

const path = require("path");
const REPO = path.join(__dirname, "..", "..");

function boot(fixture) {
  const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
  $tw.boot.suppressBoot = true;
  $tw.boot.argv = [path.join(__dirname, "..", fixture || "fixture-wiki")];
  $tw.boot.startup();
  global.$tw = $tw;                                  // some engine paths read the global
  const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
  return { $tw, wiki: $tw.wiki, doc: fd.fakeDocument };
}

// The live global import chain (PageMacros + Macro + Global + Global/View) so
// <<lingo>>, shared procedures and widgets resolve exactly as in the browser.
const G = '<$importvariables filter="[[$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[$:/tags/Global/View]!is[draft]]">';

// Render a plugin tiddler by title, or raw wikitext (opts.text), inside the
// Global chain. opts.variables ride the widget (currentTiddler by default "GSD/Test").
function makeRender(wiki, doc, $tw) {
  return function render(title, opts) {
    opts = opts || {};
    const body = opts.text !== undefined
      ? opts.text
      : '<$transclude $tiddler="' + title + '"' + (opts.mode ? ' $mode="' + opts.mode + '"' : "") + "/>";
    const parser = wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + body + "\n\n</$importvariables>");
    const w = wiki.makeWidget(parser, {
      document: doc, parentWidget: $tw.rootWidget,
      variables: Object.assign({ currentTiddler: "GSD/Test" }, opts.variables)
    });
    if (doc.setSequenceNumber) doc.setSequenceNumber(0);   // stable fakeDOM element ids (upstream renderWidgetNode)
    const c = doc.createElement("div");
    w.render(c);
    return { w, c };
  };
}

// ── fakeDOM walkers ──────────────────────────────────────────────────────────
// fakeDOM text nodes carry .textContent; element nodes do NOT aggregate it
// (and JSON.stringify on a subtree throws on parentNode cycles).

function textOf(node) {
  let s = "";
  (function f(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(f);
    if (n.isTiddlyWikiFakeDom) return (n.children || []).forEach(f);
    s += n.textContent || "";
  })(node);
  return s.replace(/\s+/g, " ").trim();
}

function findAll(node, predicate) {
  const out = [];
  (function f(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(f);
    if (n.isTiddlyWikiFakeDom) { if (predicate(n)) out.push(n); (n.children || []).forEach(f); }
  })(node);
  return out;
}

const findByTag = (node, tag) => findAll(node, n => n.tag === tag);
const hasClass = (n, cls) => ((n.attributes || {}).class || "").indexOf(cls) !== -1;
const findByClass = (node, cls) => findAll(node, n => hasClass(n, cls));

// ── fixture isolation ────────────────────────────────────────────────────────
// Plugin shadows are read-only; only non-shadow tiddlers carry test state.
// Delete them all (except an optional keep list) to restore a pristine wiki
// between cases — the upstream suite's fresh-Wiki-per-describe discipline.
function resetFixtures(wiki, keep) {
  keep = new Set(keep || []);
  wiki.filterTiddlers("[!is[shadow]sort[title]]").forEach(title => {
    if (!keep.has(title)) wiki.deleteTiddler(title);
  });
}

// ── assertions ───────────────────────────────────────────────────────────────
// Array-safe by construction: got/want are always deep-compared via JSON, so an
// array can never slip through a truthiness check (the tickler-test.js lesson).
let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log((ok ? "PASS " : "FAIL ") + name + (ok ? "" : " got:" + JSON.stringify(got) + " want:" + JSON.stringify(want)));
  return ok;
}
function finish(label) {
  console.log(fail === 0 ? "ALL " + label + " CASES PASS (" + pass + ")" : fail + " FAILURE(S) IN " + label);
  process.exit(fail === 0 ? 0 : 1);
}

// ── date helpers (tickler-style stored dates are 17-char UTC strings) ───────
const utcMidnight = offset => {
  const d = new Date(Date.now() + offset * 86400000);
  return $twUtils().stringifyDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())));
};
const localMidnight = offset => {
  const d = new Date(Date.now() + offset * 86400000);
  return $twUtils().stringifyDate(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
};
let $twUtils$ = null;
function $twUtils() {
  if (!$twUtils$) $twUtils$ = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/utils.js");
  return $twUtils$;
}

module.exports = { boot, G, makeRender, textOf, findAll, findByTag, findByClass, hasClass, resetFixtures, t, finish, utcMidnight, localMidnight, REPO };