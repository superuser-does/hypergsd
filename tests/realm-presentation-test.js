// Realm-selection presentation flip suite. Promotes to
// tests/realm-presentation-test.js TOGETHER WITH the option-A change
// (resolver-routed sidebar reads/writes). Until that change lands, cases
// P1-P5 FAIL BY DESIGN — the pristine assertions describe the state the
// change introduces (all boxes ticked while no config tiddler exists, first
// touch materialising "all ± one", the realmless-only triage view reachable
// stepwise). Running this file on the pre-change tree is the "before" half
// of the before/after demonstration: expect FAIL on pristine states and
// first-touch writes, PASS on nothing that depends on pristine.
"use strict";

const HARNESS = "./lib/harness"; // 
const { boot, G, findAll, hasClass, resetFixtures, t, finish } = require(HARNESS);
const seedRealmFixture = require("./lib/realm-fixture");

const { $tw, wiki, doc } = boot();
const fixture = seedRealmFixture(wiki);
const SEL = "$:/config/hypergsd/realm-selection";
const COMPONENT = "$:/plugins/yan/hypergsd/ui/components/realm-selection";
const FULL = fixture.realms.concat(["no-realm"]);
const ALL_MINUS_ERRANDS = FULL.slice().sort().filter(x => x !== "$:/GSD/Realm/Errands");

const renderWidget = body => {
  const parser = wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + body + "\n\n</$importvariables>");
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
  const c = doc.createElement("div");
  w.render(c);
  return {w, c};
};
const setSel = list => list === undefined ? wiki.deleteTiddler(SEL) : wiki.addTiddler({title: SEL, list});
const storedList = () => { const td = wiki.getTiddler(SEL); return td ? (td.fields.list || []).slice().sort() : "(missing)"; };
const findCheckboxes = w => { const acc = [];
  (function f(x){ if (!x || !x.children) return; x.children.forEach(y => { if (y.parseTreeNode && y.parseTreeNode.tag === "$checkbox" && String(y.getAttribute("filter") || "").indexOf("realm-selection") !== -1) acc.push(y); f(y); }); })(w);
  return acc; };
const findButtons = w => { const acc = [];
  (function f(x){ if (!x || !x.children) return; x.children.forEach(y => { if (y.parseTreeNode && y.parseTreeNode.tag === "$button" && y.getAttribute("actions")) acc.push(y); f(y); }); })(w);
  return acc; };
const clickBox = (cb, checked) => { cb.inputDomNode.checked = checked; cb.handleChangeEvent({type: "change"}); };
const boxStates = () => { const {w} = renderWidget('<$transclude $tiddler="' + COMPONENT + '" $mode="block" />');
  return findCheckboxes(w).map(cb => wiki.filterTiddlers(cb.getAttribute("filter"), cb).length > 0); };
const ROWS_BODY = '<$hgsd.list list-heading="T" list-filter="[tag[$:/GSD/Action]gsd_status[next]gsd_complete[false]]" group-state="false" />';
const rowTotal = () => findAll(renderWidget(ROWS_BODY).c, n => n.tag === "a" && hasClass(n, "gsd-list-item-title")).length;

// P1 pristine presentation: every box ticked (sentinel + five realms).
setSel(undefined);
t("P1 pristine: all six boxes render ticked", boxStates(), [true, true, true, true, true, true]);
t("P1 pristine: rows still 500 (presentation now matches behaviour)", rowTotal(), 500);

// P2 first untick from pristine materialises all-minus-one, not empty.
{
  const {w} = renderWidget('<$transclude $tiddler="' + COMPONENT + '" $mode="block" />');
  clickBox(findCheckboxes(w)[1], false); // Errands
}
t("P2 untick Errands from pristine: stored list is all-minus-Errands + sentinel", storedList(), ALL_MINUS_ERRANDS);
t("P2 rows drop by Errands only (405)", rowTotal(), 500 - fixture.perRealm);
t("P2 states: only Errands unticked", boxStates(), [true, false, true, true, true, true]);

// P3 none button from pristine, then sentinel-only: the triage view, reachable
// stepwise (on the pre-change tree the first untick writes the empty list and
// blanks everything, so this view is unreachable from pristine).
{
  const {w} = renderWidget('<$transclude $tiddler="' + COMPONENT + '" $mode="block" />');
  const none = findButtons(w).find(b => String(b.getAttribute("actions")).indexOf("action-setfield") !== -1);
  none.invokeActionString(none.getAttribute("actions"), none, {type: "click"});
}
t("P3 none from pristine: empty list, zero rows, all unticked", [storedList(), rowTotal(), boxStates()],
  [[], 0, [false, false, false, false, false, false]]);
{
  const {w} = renderWidget('<$transclude $tiddler="' + COMPONENT + '" $mode="block" />');
  clickBox(findCheckboxes(w)[0], true); // sentinel back on, realms still off
}
t("P3 triage: sentinel-only shows exactly the 25 realmless rows", [storedList(), rowTotal()], [["no-realm"], fixture.realmless]);

// P4 all button restores everything.
{
  const {w} = renderWidget('<$transclude $tiddler="' + COMPONENT + '" $mode="block" />');
  const all = findButtons(w).find(b => String(b.getAttribute("actions")).indexOf("action-listops") !== -1);
  all.invokeActionString(all.getAttribute("actions"), all, {type: "click"});
}
t("P4 all button: full list, 500 rows, all ticked", [storedList(), rowTotal(), boxStates()],
  [FULL.slice().sort(), 500, [true, true, true, true, true, true]]);

// P5 delete-config round trip returns to the all-ticked pristine presentation.
setSel(undefined);
t("P5 delete config: pristine presentation returns", boxStates(), [true, true, true, true, true, true]);

// P6 belt-and-braces: checkactions fired directly from pristine (unreachable
// through the UI once the box renders ticked) must write the full list, not a
// single-realm collapse.
{
  const {w} = renderWidget('<$transclude $tiddler="' + COMPONENT + '" $mode="block" />');
  clickBox(findCheckboxes(w)[5], true); // tick Work while pristine
}
t("P6 tick-from-pristine (programmatic): writes full selection", storedList(), FULL.slice().sort());

setSel(undefined);
resetFixtures(wiki);
finish("REALM-PRESENTATION");
