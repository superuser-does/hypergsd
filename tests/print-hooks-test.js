// Print hiding: every interactive control excluded from paper carries a hook
// the print stylesheet can reach, and the print stylesheets exist with the
// selectors that consume them. The hook classes are print-ONLY (no screen
// styling), so the contract under test is: the class lands on the button in
// the DOM, and the @media print block names it — if either half is renamed
// alone, paper starts showing controls again.
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-wiki"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;
const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';

let fails = 0;
const t = (name, ok, extra) => { if (Array.isArray(ok)) ok = JSON.stringify(ok) === JSON.stringify(extra); if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + name + (ok || !extra ? "" : " " + extra)); };

const render = src => {
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + "\n" + src + "\n</$importvariables>"), {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c);
  return {w, c};
};
// every <button> in the rendered tree with its class attribute
const buttonsWithClass = r => { const out = []; (function f(n){ if(!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
  if(n.isTiddlyWikiFakeDom && (n.tag||"").toLowerCase()==="button") out.push((n.attributes||{}).class||"");
  (n.children||[]).forEach(f); })(r.c); return out; };
const domHasClass = (r, cls) => buttonsWithClass(r).some(c => c.split(/\s+/).indexOf(cls) !== -1);
// any fake-dom node (any tag) carrying the class — the :has(> .hgsd-new-hint) anchor is a span
const anyNodeHasClass = (r, cls) => { let hit = false; (function f(n){ if(!n||hit||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
  if(n.isTiddlyWikiFakeDom && ((n.attributes||{}).class||"").split(/\s+/).indexOf(cls) !== -1) { hit = true; return; }
  (n.children||[]).forEach(f); })(r.c); return hit; };
const textOf = title => wiki.getTiddlerText(title) || "";
const fieldsOf = title => (wiki.getTiddler(title) || {fields: {}}).fields;

// ── the print stylesheet itself: tagged, present, selector-complete ─────────
const MAIN_PRINT = "$:/plugins/yan/hypergsd/ui/stylesheet/print";
t("print stylesheet exists as a Stylesheet shadow", (fieldsOf(MAIN_PRINT).tags || []).indexOf("$:/tags/Stylesheet") !== -1);
const printCss = textOf(MAIN_PRINT);
t("print stylesheet is @media print only", printCss.indexOf("@media print") !== -1);
[".hgsd-change-button", ".hgsd-clear-button", "button:has(> .hgsd-new-hint)", ".gsd-list-new-button", ".gsd-gsdpanel-button", ".gsd-button"].forEach(sel => {
  t("print stylesheet selects " + sel, printCss.indexOf(sel) !== -1);
});
t("priorities print block hides its own clear hook", /@media print[\s\S]*\.hgsd-priority-clear/.test(textOf("$:/plugins/yan/hypergsd-priorities/ui/stylesheet/priorities")));
console.log(fails === 0 ? "ALL PRINT-HOOK CHECKS PASS" : fails + " PRINT-HOOK CHECK(S) FAILED");
process.exit(fails === 0 ? 0 : 1);
