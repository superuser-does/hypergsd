// Realm-selection toggle benchmark: 500 items, 5 realms. Promotes to
// tests/realm-selection-bench.js (picked up by tests/run-bench.js; console
// only, no results side-file). Run BEFORE and AFTER the option-A component
// change, three passes per side, comparing medians; the pass-to-pass spread
// of the baseline is the noise floor (repo A/B convention — a difference
// inside the spread is noise, not signal).
//
// Workloads:
//   W1 fieldset render — the surface the change touches on the read side
//      (six checkbox filters per render; raw get[list] before, subfilter
//      through hgsd-realm-selection after). Cost should scale with box
//      count (realm count), not with the 500 items.
//   W2 toggle round-trip — untick+retick Errands: action filter + list
//      write + fresh fieldset render; the pristine variant exercises the
//      first-touch write path.
//   W3 control — $hgsd.list render over the 500-item fixture. The engine
//      is untouched by the change; any delta here is noise or unrelated.
//
// States: pristine / full / partial ({Home,Work}+sentinel) / empty.
"use strict";

const HARNESS = "./lib/harness"; // 
const { boot, G, findAll, hasClass } = require(HARNESS);
const seedRealmFixture = require("./lib/realm-fixture");

const { $tw, wiki, doc } = boot();
const fixture = seedRealmFixture(wiki);
const SEL = "$:/config/hypergsd/realm-selection";
const COMPONENT = "$:/plugins/yan/hypergsd/ui/components/realm-selection";

const SIDE = '<$transclude $tiddler="' + COMPONENT + '" $mode="block" />';
const LIST = '<$hgsd.list list-heading="T" list-filter="[tag[$:/GSD/Action]gsd_status[next]gsd_complete[false]]" group-state="false" />';

const STATES = {
  pristine: undefined,
  full: fixture.realms.concat(["no-realm"]),
  partial: ["$:/GSD/Realm/Home", "$:/GSD/Realm/Work", "no-realm"],
  empty: []
};

const median = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const fmt = ms => ms.toFixed(3) + " ms";
const spread = a => "(" + Math.min(...a).toFixed(3) + "–" + Math.max(...a).toFixed(3) + ")";

const setSel = list => list === undefined ? wiki.deleteTiddler(SEL) : wiki.addTiddler({title: SEL, list});

const renderOnce = body => {
  const parser = wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + body + "\n\n</$importvariables>");
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
  const c = doc.createElement("div");
  w.render(c);
  return {w, c};
};

const findCheckboxes = w => { const acc = [];
  (function f(x){ if (!x || !x.children) return; x.children.forEach(y => { if (y.parseTreeNode && y.parseTreeNode.tag === "$checkbox" && String(y.getAttribute("filter") || "").indexOf("realm-selection") !== -1) acc.push(y); f(y); }); })(w);
  return acc; };
const clickBox = (cb, checked) => { cb.inputDomNode.checked = checked; cb.handleChangeEvent({type: "change"}); };
const rowAnchorCount = c => findAll(c, n => n.tag === "a" && hasClass(n, "gsd-list-item-title")).length;

// Sanity gate: the fixture and states must produce the expected row counts,
// else the timings are timing the wrong thing (fail fast, no silent benches).
const sanity = () => {
  const expect = {pristine: 500, full: 500, partial: 95 + 95 + 25, empty: 0};
  for (const [name, list] of Object.entries(STATES)) {
    setSel(list);
    const got = rowAnchorCount(renderOnce(LIST).c);
    if (got !== expect[name]) { console.error("SANITY FAIL " + name + ": rows " + got + " want " + expect[name]); process.exit(1); }
  }
  console.log("sanity: fixture 500 items, state row counts 500/500/215/0 ok");
};

const bench = (label, N, fn) => {
  const times = [];
  for (let i = 0; i < N; i++) times.push(fn());
  console.log("  " + label + ": median " + fmt(median(times)) + " " + spread(times));
  return median(times);
};

console.log("realm-selection toggle benchmark (" + new Date().toISOString().slice(0, 10) + ")");
console.log("fixture: " + fixture.total + " items, " + fixture.names.length + " realms (" + fixture.names.join(", ") + "), " + fixture.realmless + " realmless");
sanity();

// W1 — fieldset render per state (N=200)
console.log("W1 fieldset render:");
for (const [name, list] of Object.entries(STATES)) {
  setSel(list);
  bench(name, 200, () => {
    const t0 = process.hrtime.bigint();
    renderOnce(SIDE);
    return Number(process.hrtime.bigint() - t0) / 1e6;
  });
}

// W2 — toggle round-trip per state (N=100): untick Errands, retick Errands.
// Pristine variant: delete config, untick (first touch), retick, delete config,
// so the cycle is state-neutral.
console.log("W2 toggle round-trip (untick+retick Errands):");
for (const [name, list] of Object.entries(STATES)) {
  bench(name, 100, () => {
    if (list === undefined) wiki.deleteTiddler(SEL);
    const t0 = process.hrtime.bigint();
    const a = renderOnce(SIDE);
    clickBox(findCheckboxes(a.w)[1], false);
    const b = renderOnce(SIDE);
    clickBox(findCheckboxes(b.w)[1], true);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    if (list === undefined) wiki.deleteTiddler(SEL);
    return ms;
  });
}

// W3 — control: list render per state (N=30, heavy-dashboard scale precedent)
console.log("W3 control, $hgsd.list render over 500 items:");
for (const [name, list] of Object.entries(STATES)) {
  setSel(list);
  bench(name, 30, () => {
    const t0 = process.hrtime.bigint();
    renderOnce(LIST);
    return Number(process.hrtime.bigint() - t0) / 1e6;
  });
}

setSel(undefined);
