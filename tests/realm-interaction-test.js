// Realm-selection interaction invariants at scale (500 items, 5 realms).
// Promotes to tests/realm-interaction-test.js.
//
// Steady-state matrix over the SHIPPED sidebar component: whatever the
// read/write implementation is at run time (today's raw list reads, or the
// option-A resolver-routed reads), these cases must produce IDENTICAL
// results before and after the change — the regression guard for the toggle
// path. Pristine PRESENTATION (which boxes render ticked while no config
// tiddler exists) is deliberately NOT asserted here; that lives in
// realm-presentation-test.js, which lands with the change.
//
// Click simulator (the council-probe path): checkbox widgets located by a
// filter attribute containing "realm-selection" (matches the raw-read and
// subfilter forms alike), fired through handleChangeEvent; buttons through
// invokeActionString (invokeActions alone does not fire them).
"use strict";

const HARNESS = "./lib/harness"; // 
const { boot, G, findAll, hasClass, resetFixtures, t, finish } = require(HARNESS);
const seedRealmFixture = require("./lib/realm-fixture");

const { $tw, wiki, doc } = boot();
const fixture = seedRealmFixture(wiki);
const SEL = "$:/config/hypergsd/realm-selection";
const COMPONENT = "$:/plugins/yan/hypergsd/ui/components/realm-selection";
const FULL = fixture.realms.concat(["no-realm"]); // sorted tag titles + sentinel

const renderWidget = body => {
  const parser = wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + body + "\n\n</$importvariables>");
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
  const c = doc.createElement("div");
  w.render(c);
  return {w, c};
};

// setSel(undefined) restores pristine (no tiddler); a sorted array materialises.
const setSel = list => list === undefined ? wiki.deleteTiddler(SEL)
  : wiki.addTiddler({title: SEL, list});
const storedList = () => { const td = wiki.getTiddler(SEL); return td ? (td.fields.list || []).slice().sort() : "(missing)"; };

// Checkbox widgets in tree order: sentinel first, then realm tags title-sorted
// (the component renders the sentinel box above its $list loop).
const findCheckboxes = w => { const acc = [];
  (function f(x){ if (!x || !x.children) return; x.children.forEach(y => { if (y.parseTreeNode && y.parseTreeNode.tag === "$checkbox" && String(y.getAttribute("filter") || "").indexOf("realm-selection") !== -1) acc.push(y); f(y); }); })(w);
  return acc; };
const findButtons = w => { const acc = [];
  (function f(x){ if (!x || !x.children) return; x.children.forEach(y => { if (y.parseTreeNode && y.parseTreeNode.tag === "$button" && y.getAttribute("actions")) acc.push(y); f(y); }); })(w);
  return acc; };
const buttonBy = (w, marker) => findButtons(w).find(b => String(b.getAttribute("actions")).indexOf(marker) !== -1);
const clickBox = (cb, checked) => { cb.inputDomNode.checked = checked; cb.handleChangeEvent({type: "change"}); };
const clickButton = (w, marker) => { const b = buttonBy(w, marker); b.invokeActionString(b.getAttribute("actions"), b, {type: "click"}); };

const sideLabels = c => findAll(c, n => n.tag === "input" && (n.attributes || {}).type === "checkbox")
  .map(n => (n.parentNode && n.parentNode.textContent || "").replace(/\s+/g, " ").trim());
const boxStates = () => { const {w} = renderWidget('<$transclude $tiddler="' + COMPONENT + '" $mode="block" />');
  return findCheckboxes(w).map(cb => wiki.filterTiddlers(cb.getAttribute("filter"), cb).length > 0); };

// Row counts per title prefix through the real list engine (realm-scope default).
const ROWS_BODY = '<$hgsd.list list-heading="T" list-filter="[tag[$:/GSD/Action]gsd_status[next]gsd_complete[false]]" group-state="false" />';
const rows = () => {
  const {c} = renderWidget(ROWS_BODY);
  const counts = {};
  findAll(c, n => n.tag === "a" && hasClass(n, "gsd-list-item-title")).forEach(n => {
    const title = decodeURIComponent((n.attributes.href || "").replace(/^#\/?/, ""));
    const key = title.startsWith("A Side project ") ? "A Side project" : title.split(" ").slice(0, 2).join(" ");
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
};
const rowTotal = () => Object.values(rows()).reduce((a, b) => a + b, 0);
const sortedCounts = o => Object.keys(o).sort().reduce((a, k) => (a[k] = o[k], a), {});

// Cross-realm globe beside a link (same transclusion as realm-selection-test).
const globes = title => {
  const {c} = renderWidget('<$transclude $variable="hgsd-realm-warning" linked-tiddler="' + title + '" />');
  return findAll(c, n => n.tag === "span" && hasClass(n, "hgsd-realm-warning")).length;
};

// ── structural baseline ──────────────────────────────────────────────────────
{
  const {w, c} = renderWidget('<$transclude $tiddler="' + COMPONENT + '" $mode="block" />');
  t("component: 6 boxes, sentinel first, realm tags title-sorted", sideLabels(c),
    ["Items not in a realm", "Errands", "Home", "Reading", "Side project", "Work"]);
  t("component: all and none buttons present (action-listops vs action-setfield)",
    [!!buttonBy(w, "action-listops"), !!buttonBy(w, "action-setfield")], [true, true]);
}

// ── pristine scope (engine behaviour; presentation owned by the flip suite) ──
setSel(undefined);
t("pristine: fixture rows 5×95 + 25 realmless", sortedCounts(rows()),
  {"A Errands": 95, "A Home": 95, "A Reading": 95, "A Side project": 95, "A Work": 95, "A none": 25});
t("pristine: total 500", rowTotal(), 500);

// ── full materialised behaves identically to pristine ───────────────────────
setSel(FULL);
t("full: all boxes ticked (materialised read agrees both sides)", boxStates(), [true, true, true, true, true, true]);
t("full: rows identical to pristine", rowTotal(), 500);

// ── untick / retick one realm (the toggle under test) ───────────────────────
{
  const {w} = renderWidget('<$transclude $tiddler="' + COMPONENT + '" $mode="block" />');
  clickBox(findCheckboxes(w)[1], false); // Errands
}
t("untick Errands: stored list is all-minus-Errands + sentinel", storedList(), FULL.slice().sort().filter(x => x !== "$:/GSD/Realm/Errands"));
t("untick Errands: rows 405, Errands 0", [rows()["A Errands"] || 0, rowTotal()], [0, 405]);
t("untick Errands: only the Errands box unticks", boxStates(), [true, false, true, true, true, true]);
{
  const {w} = renderWidget('<$transclude $tiddler="' + COMPONENT + '" $mode="block" />');
  clickBox(findCheckboxes(w)[1], true);
}
t("retick Errands: full again (sorted compare)", storedList(), FULL.slice().sort());

// ── sentinel untick: realmed-only view ───────────────────────────────────────
{
  const {w} = renderWidget('<$transclude $tiddler="' + COMPONENT + '" $mode="block" />');
  clickBox(findCheckboxes(w)[0], false);
}
t("untick sentinel: realmless rows drop to 0, realmed stay", [rows()["A none"] || 0, rowTotal()], [0, 475]);
setSel(FULL);

// ── none and all buttons ─────────────────────────────────────────────────────
{
  const {w} = renderWidget('<$transclude $tiddler="' + COMPONENT + '" $mode="block" />');
  clickButton(w, "action-setfield");
}
t("none button: empty list, zero rows, all boxes unticked", [storedList(), rowTotal(), boxStates()], [[], 0, [false, false, false, false, false, false]]);
{
  const {w} = renderWidget('<$transclude $tiddler="' + COMPONENT + '" $mode="block" />');
  clickButton(w, "action-listops");
}
t("all button: full list restored, rows 500", [storedList(), rowTotal()], [FULL.slice().sort(), 500]);
t("config tiddler is the savable artefact (list field, sorted)", storedList(), FULL.slice().sort());

// ── delete-config round trip ────────────────────────────────────────────────
setSel(undefined);
t("delete config: pristine scope returns", rowTotal(), 500);

// ── partial selection + globe sampling ──────────────────────────────────────
setSel(["$:/GSD/Realm/Home", "$:/GSD/Realm/Work", "no-realm"]);
t("partial {Home,Work}+sentinel: rows 215", rowTotal(), 95 + 95 + 25);
t("globe: outside-selection item carries it, inside and realmless-under-sentinel do not",
  [globes("A Errands 01"), globes("A Work 01"), globes("A none 01")], [1, 0, 0]);

// ── buster: a membership write re-renders the checked states ────────────────
setSel(FULL);
{
  const {w, c} = renderWidget('<$transclude $tiddler="' + COMPONENT + '" $mode="block" />');
  clickBox(findCheckboxes(w)[2], false); // Home off
  w.refresh({[SEL]: wiki.getTiddler(SEL)});
  const domChecked = findAll(c, n => n.tag === "input" && (n.attributes || {}).type === "checkbox").map(n => n.attributes.checked !== undefined);
  t("buster: DOM checked states follow the write without re-parse", domChecked, [true, true, false, true, true, true]);
}

setSel(undefined);
resetFixtures(wiki);
finish("REALM-INTERACTION");
