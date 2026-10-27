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
// the priorities rewire: generated letter rules, the print line-ink swap, and no abbreviated names
const prioSheet = textOf("$:/plugins/yan/hypergsd-priorities/ui/stylesheet/priorities");
t("priorities stylesheet defines the generated custom properties", prioSheet.indexOf("&#x2D;&#x2D;priority-line") !== -1 && prioSheet.indexOf("hgsd-priority-") !== -1);
{
	const printBlock = prioSheet.substring(prioSheet.indexOf("@media print"));
	t("priorities print swap takes the line ink for the outline only (text and icons keep their ink in every media)", /^\s*border-color: var\(&#x2D;&#x2D;priority-line\)/m.test(printBlock) && !/^\s*color:/m.test(printBlock), printBlock.replace(/\s+/g, " "));
}
const fs = require("fs");
const prioSources = [];
(function walk(d) { for (const e of fs.readdirSync(d, {withFileTypes: true})) { const p = d + "/" + e.name; if (e.isDirectory()) walk(p); else if (e.name.endsWith(".tid")) prioSources.push(p); } })(__dirname + "/../plugins/hypergsd-priorities");
t("no abbreviated prio- names ship in the priorities plugin", prioSources.every(p => fs.readFileSync(p, "utf8").indexOf("prio-") === -1), prioSources.filter(p => fs.readFileSync(p, "utf8").indexOf("prio-") !== -1).join(" "));
// the generated rules as wikified output: the dictionary values land in the CSS (entity dashes decode to --)
{
	const sp = wiki.parseTiddler("$:/plugins/yan/hypergsd-priorities/ui/stylesheet/priorities");
	const sw = wiki.makeWidget(sp, {document: doc, parentWidget: $tw.rootWidget});
	const sc = doc.createElement("div"); sw.render(sc);
	const cssText = (function txt(n) { let s = ""; (function g(x) { if (!x || typeof x !== "object") return; if (Array.isArray(x)) return x.forEach(g);
		if (x.isTiddlyWikiFakeDom || x.tag !== undefined) { s += (x.textContent || ""); (x.children || []).forEach(g); return; } s += (x.text || ""); (x.children || []).forEach(g); })(n); return s; })(sc);
	t("generated letter rules carry the dictionary colours", cssText.indexOf(".hgsd-priority-A {--priority-fill:#B3261E;--priority-ink:#FFFFFF;--priority-line:#8B1A14;") !== -1, cssText.substring(cssText.indexOf(".hgsd-priority-A"), 120));
	t("generated option rules read the dictionary directly", cssText.indexOf('option[value="A"]') !== -1 && cssText.indexOf("#B3261E") !== -1);
	t("wikified sheet keeps the custom-property dashes (comments excluded — prose dashes typography-convert in comments, harmlessly)", ((c) => c.indexOf("--priority-fill") !== -1 && c.indexOf("\u2013priority") === -1)(cssText.replace(/\/\*[\s\S]*?\*\//g, "")));
}
// the redundancy removal: the shared lists stylesheet no longer sizes the clear ×
// (core's button svg.tc-image-button rule owns that inside every button host)
t("lists stylesheet carries no hgsd-clear-button styling", textOf("$:/plugins/yan/hypergsd/ui/stylesheet/lists").indexOf("hgsd-clear-button") === -1);

// ── pick-field set state: change + clear hooks land on real buttons ─────────
wiki.addTiddler({title: "ZZ host", tags: "$:/GSD/Action", gsd_complete: "false", gsd_project: "ZZ proj P"});
wiki.addTiddler({title: "ZZ proj P", tags: "$:/GSD/Project", gsd_complete: "false"});
const setR = render('<$tiddler tiddler="ZZ host"><$hgsd.pick-field field="gsd_project" id="pt1" list-filter="[tag[$:/GSD/Project]]" new-type="action"/></$tiddler>');
t("pick-field set state: change button carries hgsd-change-button", domHasClass(setR, "hgsd-change-button"));
t("pick-field set state: clear button carries hgsd-clear-button", domHasClass(setR, "hgsd-clear-button"));

// ── pick-field empty state: the "new" fallback span (the :has() anchor) ─────
wiki.addTiddler({title: "ZZ bare", tags: "$:/GSD/Action", gsd_complete: "false"});
const emptyR = render('<$tiddler tiddler="ZZ bare"><$hgsd.pick-field field="gsd_project" id="pt2" list-filter="[tag[$:/GSD/Project]]" new-type="action"/></$tiddler>');
t("pick-field empty state: new hint span renders (print :has anchor)", anyNodeHasClass(emptyR, "hgsd-new-hint"));

// ── tickler panel: the date-clear button adopts the shared value-clear hook ─
wiki.addTiddler({title: "ZZ dated", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "false", gsd_tickler_date: "202601020304"});
const tickR = render('<$tiddler tiddler="ZZ dated"><$let section-target="ZZ dated" section-mode="panel" section-type="action"><$transclude $tiddler="$:/plugins/yan/hypergsd-ticklers/ui/attributes/tickler" $mode="block"/></$let></$tiddler>');
t("tickler panel: date-clear button carries hgsd-clear-button", domHasClass(tickR, "hgsd-clear-button"));

// ── list quick-add: the + button keeps its main-owned hook (regression) ─────
const listR = render('<$tiddler tiddler="ZZ proj P"><$transclude $tiddler="$:/plugins/yan/hypergsd/ui/ViewTemplate/view-body-project" $mode="block"/></$tiddler>');
t("project view: list quick-add button carries gsd-list-new-button", domHasClass(listR, "gsd-list-new-button"));

console.log(fails === 0 ? "ALL PRINT-HOOK CHECKS PASS" : fails + " PRINT-HOOK CHECK(S) FAILED");
process.exit(fails === 0 ? 0 : 1);
