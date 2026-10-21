// HyperGSD performance benchmark — headless, deterministic. Measures the
// costs the status system touches: list filtering + engine-list rendering,
// panel render + status-change refresh, the modal status cascade, and
// stylesheet rendering; section 7 adds widget-tree depth telemetry (the
// stack-overflow failure mode is a JS-frame budget, not the engine's
// widget-count guard — see the probe comment). Run before and after a
// change; the synthetic corpus matches live-data scale (~905 actions / ~81
// projects / 50 references).
//
// Usage: node tests/status-bench.js [--json]
"use strict";

const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true;
$tw.boot.argv = [__dirname + "/fixture-wiki"];
$tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;

const REPS = 20;
const pad = (n, w) => String(n).padStart(w, "0");

// --- synthetic corpus at live scale --------------------------------------
const projects = [], actions = [];
for (let i = 1; i <= 81; i++) {
  const t = "P " + pad(i, 3);
  projects.push(t);
  wiki.addTiddler({title: t, tags: ["$:/GSD/Project"], gsd_status: i % 5 === 0 ? "future" : "active", gsd_complete: "false"});
}
const statuses = s => (s % 20 < 8 ? "next" : s % 20 < 13 ? "waiting" : "future");
for (let i = 1; i <= 905; i++) {
  const t = "A " + pad(i, 3);
  actions.push(t);
  wiki.addTiddler({
    title: t, tags: ["$:/GSD/Action", ...(i % 2 ? ["$:/GSD/Realm/Home"] : ["$:/GSD/Realm/Work"])],
    gsd_status: statuses(i), gsd_complete: "false", gsd_project: projects[i % 81],
  });
}
for (let i = 1; i <= 50; i++)
  wiki.addTiddler({title: "R " + pad(i, 3), tags: ["$:/GSD/Reference"], gsd_project: projects[i % 81]});
// one in ten actions completed
for (let i = 1; i <= 905; i += 10)
  wiki.addTiddler(Object.assign({}, wiki.getTiddler("A " + pad(i, 3)).fields, {gsd_complete: "true", gsd_comp_date: "20260801120000000"}));

if (!wiki.getTiddler("$:/plugins/yan/hypergsd/ui/lists/next-action-list"))
  throw new Error("plugin tiddlers not loaded — check fixture wiki symlinks");

// --- harness plumbing (same import chain as the test battery) ------------
const G = '<$importvariables filter="[[$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[$:/tags/Global/View]!is[draft]]">';
const makeWidget = (src, vars) => {
  const parser = wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + src + "\n\n</$importvariables>");
  return wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget, variables: vars || {}});
};
const time = fn => {
  const samples = [];
  for (let i = 0; i < REPS; i++) {
    const c = doc.createElement("div");
    const t0 = process.hrtime.bigint();
    const w = fn(c);
    const t1 = process.hrtime.bigint();
    if (w) w.lastContainer = c;
    samples.push(Number(t1 - t0) / 1e6);
  }
  samples.sort((a, b) => a - b);
  return {median: +samples[Math.floor(REPS / 2)].toFixed(3), p95: +samples[Math.min(REPS - 1, Math.ceil(REPS * 0.95) - 1)].toFixed(3)};
};
const timeNoWidget = fn => {
  const samples = [];
  for (let i = 0; i < REPS; i++) {
    const t0 = process.hrtime.bigint();
    fn();
    samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  samples.sort((a, b) => a - b);
  return {median: +samples[Math.floor(REPS / 2)].toFixed(3), p95: +samples[Math.min(REPS - 1, Math.ceil(REPS * 0.95) - 1)].toFixed(3)};
};
const results = {};

// --- 1. list filtering (the dashboard's per-render filter cost) ----------
const listFilters = {
  "filter next actions": "[tag[$:/GSD/Action]gsd_status[next]gsd_complete[false]] +[sort[title]]",
  "filter waiting actions": "[tag[$:/GSD/Action]gsd_status[waiting]gsd_complete[false]] +[sort[title]]",
  "filter future actions": "[tag[$:/GSD/Action]gsd_status[future]gsd_complete[false]] +[sort[title]]",
  "filter active projects": "[tag[$:/GSD/Project]gsd_status[active]gsd_complete[false]sort[title]]",
  "filter future projects": "[tag[$:/GSD/Project]gsd_status[future]gsd_complete[false]sort[title]]",
};
for (const name in listFilters)
  results[name] = timeNoWidget(() => wiki.filterTiddlers(listFilters[name]));

// --- 2. engine list render (widget build + render, parse excluded) -------
const listParsers = {};
const listParser = title => listParsers[title] || (listParsers[title] = wiki.parseText("text/vnd.tiddlywiki",
  G + '\n\n<$transclude $tiddler="' + title + '"/>\n\n</$importvariables>'));
const listRender = (title, c) => {
  const w = wiki.makeWidget(listParser(title), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
  w.render(c);
  w.lastContainer = c;
  return w;
};
const countRows = w => {
  let n = 0;
  (function f(x) {
    if (!x || typeof x !== "object") return;
    if (Array.isArray(x)) return x.forEach(f);
    if (x.isTiddlyWikiFakeDom) {
      if (((x.attributes || {}).class || "").includes("gsd-list-item")) n++;
      (x.children || []).forEach(f);
    }
  })(w.lastContainer);
  return n;
};
for (const title of [
  "$:/plugins/yan/hypergsd/ui/lists/next-action-list",
  "$:/plugins/yan/hypergsd/ui/lists/waiting-action-list",
  "$:/plugins/yan/hypergsd/ui/lists/future-action-list",
  "$:/plugins/yan/hypergsd/ui/lists/active-project-list",
]) {
  const t = time(c => listRender(title, c));
  const probe = listRender(title, doc.createElement("div"));
  results["render " + title.split("/").pop() + " (" + countRows(probe) + " rows)"] = t;
}

// --- 3. status-change refresh with the list open --------------------------
{
  const title = "$:/plugins/yan/hypergsd/ui/lists/next-action-list";
  const w = listRender(title, doc.createElement("div"));
  const victim = actions.find(t => wiki.getTiddler(t).fields.gsd_status === "next");
  results["status-change refresh (open list)"] = timeNoWidget(() => {
    wiki.addTiddler(Object.assign({}, wiki.getTiddler(victim).fields, {gsd_status: "waiting"}));
    w.refresh({[victim]: wiki.getTiddler(victim)});
    wiki.addTiddler(Object.assign({}, wiki.getTiddler(victim).fields, {gsd_status: "next"}));
    w.refresh({[victim]: wiki.getTiddler(victim)});
  });
}

// --- 4. panel render + status-change refresh ------------------------------
{
  const src = '<$tiddler tiddler="A 001"><$transclude $tiddler="$:/plugins/yan/hypergsd/ui/ViewTemplate/view-body" $mode="block"/></$tiddler>';
  results["panel render (view-body)"] = time(c => makeWidget(src, {currentTiddler: "A 001"}).render(c) || {lastContainer: c});
  const w = makeWidget(src, {currentTiddler: "A 001"});
  const c = doc.createElement("div"); w.render(c);
  const t0 = process.hrtime.bigint();
  const samples = [];
  for (let i = 0; i < REPS; i++) {
    const next = i % 2 ? "waiting" : "next";
    const before = process.hrtime.bigint();
    wiki.addTiddler(Object.assign({}, wiki.getTiddler("A 001").fields, {gsd_status: next}));
    w.refresh({"A 001": wiki.getTiddler("A 001")});
    samples.push(Number(process.hrtime.bigint() - before) / 1e6);
  }
  samples.sort((a, b) => a - b);
  results["status-change refresh (open panel)"] = {median: +samples[Math.floor(REPS / 2)].toFixed(3), p95: +samples[REPS - 1].toFixed(3)};
  wiki.addTiddler(Object.assign({}, wiki.getTiddler("A 001").fields, {gsd_status: "next"}));
}

// --- 5. modal status cascade render ---------------------------------------
{
  const src = '<$let section-target="$:/temp/bench-temp" section-type="action" section-mode="modal" section-status-target="$:/temp/bench-state" new-temp="$:/temp/bench-temp" new-state="$:/temp/bench-state" current-type="action" gsd-status="waiting" gsd-project=""><$transclude $tiddler="$:/plugins/yan/hypergsd/ui/attributes/status" $mode="block"/></$let>';
  results["modal status cascade render"] = time(c => makeWidget(src).render(c) || {lastContainer: c});
}

// --- 6. stylesheet render --------------------------------------------------
{
  // G-wrapped to match production: stylesheets render at page level where
  // the Global/Macro imports exist (a bare rootWidget hits a pathological
  // resolution path for the loop bodies and overstates the cost 50x)
  const parser = wiki.parseText("text/vnd.tiddlywiki", G + "\n\n{{||$:/plugins/yan/hypergsd/ui/stylesheet/stylesheet}}\n\n</$importvariables>");
  results["stylesheet render"] = timeNoWidget(() => {
    const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget});
    const c = doc.createElement("div");
    w.render(c);
  });
}

// --- 7. widget-tree depth telemetry ---------------------------------------
// Advisory budget: 150 levels from the rendered root (the page chassis adds
// ~30 above these surfaces). The raw "maximum call stack size exceeded"
// fires at a widget depth of roughly 150-400 because HyperGSD's per-level
// render path (gate attribute evaluation, refreshSelf cascades, per-row
// executes) costs far more JS frames per widget level than the simple
// transcludes the engine's MAX_WIDGET_TREE_DEPTH = 1000 guard was
// calibrated for.
const DEPTH_BUDGET = 150;
const describeWidget = w => {
  const node = w.parseTreeNode;
  return node && (node.tag || node.type) || "anon";
};
const compressPath = tags => {
  const runs = [];
  for (const tag of tags) {
    const last = runs[runs.length - 1];
    if (last && last.tag === tag) last.n++;
    else runs.push({tag, n: 1});
  }
  return runs.map(r => r.tag + (r.n > 1 ? "x" + r.n : "")).join(">");
};
const depthProbe = root => {
  let maxDepth = 0, deepestPath = [], deepestWidget = root, total = 0;
  const path = [];
  (function walk(node) {
    total++;
    path.push(describeWidget(node));
    if (path.length - 1 > maxDepth) {
      maxDepth = path.length - 1;
      deepestPath = path.slice();
      deepestWidget = node;
    }
    for (const child of node.children || []) walk(child);
    path.pop();
  })(root);
  return {
    depth: maxDepth,
    gates: deepestPath.filter(t => t === "$refresh").length,
    ancestorCount: deepestWidget.getAncestorCount ? deepestWidget.getAncestorCount() : maxDepth,
    widgets: total,
    path: compressPath(deepestPath),
  };
};
const depthResults = {};
{
  // Local fixtures for the context-page surface (created after all timing
  // sections, so the timed corpus is untouched): a context tiddler plus
  // dedicated next actions carrying it as a tag — the contexts sub-plugin's
  // model. Depth is per-path, so a handful of rows reaches the worst path.
  wiki.addTiddler({title: "Ctx Bench", tags: ["GSD/Contexts"]});
  for (let i = 1; i <= 5; i++)
    wiki.addTiddler({title: "AC " + pad(i, 3), tags: ["$:/GSD/Action", "Ctx Bench"], gsd_status: "next", gsd_complete: "false"});
  const surfaces = [
    ["engine list (next-action-list)", () => listRender("$:/plugins/yan/hypergsd/ui/lists/next-action-list", doc.createElement("div"))],
    ["panel (view-body)", () => {
      const src = '<$tiddler tiddler="A 001"><$transclude $tiddler="$:/plugins/yan/hypergsd/ui/ViewTemplate/view-body" $mode="block"/></$tiddler>';
      const w = makeWidget(src, {currentTiddler: "A 001"});
      w.render(doc.createElement("div"));
      return w;
    }],
    ["dashboard chassis (GSD/Action dashboard)", () => {
      const src = '<$transclude $tiddler="GSD/Action dashboard" $mode="block"/>';
      const w = makeWidget(src, {currentTiddler: "GSD/Action dashboard"});
      w.render(doc.createElement("div"));
      return w;
    }],
    ["context page (view-body-context)", () => {
      const src = '<$tiddler tiddler="Ctx Bench"><$transclude $tiddler="$:/plugins/yan/hypergsd-contexts/ui/ViewTemplate/view-body-context" $mode="block"/></$tiddler>';
      const w = makeWidget(src, {currentTiddler: "Ctx Bench"});
      w.render(doc.createElement("div"));
      return w;
    }],
  ];
  for (const [name, render] of surfaces) depthResults[name] = depthProbe(render());
  // Chip-presence guard: the contexts fragment renders its applied-context
  // pills via core's tag-pill-body — an internal macro name, so a core rename
  // or restructure breaks the chips silently. The context page above renders
  // AC rows tagged Ctx Bench; assert the pill buttons actually appear.
  {
    const c = doc.createElement("div");
    const src = '<$tiddler tiddler="Ctx Bench"><$transclude $tiddler="$:/plugins/yan/hypergsd-contexts/ui/ViewTemplate/view-body-context" $mode="block"/></$tiddler>';
    const w = makeWidget(src, {currentTiddler: "Ctx Bench"});
    w.render(c);
    let chips = 0;
    (function f(n) {
      if (!n || typeof n !== "object") return;
      if (Array.isArray(n)) return n.forEach(f);
      if (n.isTiddlyWikiFakeDom && n.tag === "button" && String((n.attributes || {}).class || "").includes("tc-tag-label")) chips++;
      (n.children || []).forEach(f);
    })(c.children);
    if (!chips) throw new Error("context chips missing on the context page — tag-pill-body invocation broken (core macro rename?)");
  }
}

// --- output ---------------------------------------------------------------
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({timings: results, depth: depthResults}, null, 2));
} else {
  const label = Math.max(...Object.keys(results).map(k => k.length));
  console.log("HyperGSD headless benchmark (" + REPS + " reps, ms)\n");
  for (const k in results) console.log(k.padEnd(label + 2) + "median " + String(results[k].median).padStart(9) + "   p95 " + String(results[k].p95).padStart(9));
  const dlabel = Math.max(...Object.keys(depthResults).map(k => k.length));
  console.log("\nWidget-tree depth telemetry (advisory budget " + DEPTH_BUDGET + ")\n");
  for (const k in depthResults) {
    const d = depthResults[k];
    const flag = d.ancestorCount > DEPTH_BUDGET ? "  << OVER BUDGET" : "";
    console.log(k.padEnd(dlabel + 2) + "depth " + String(d.depth).padStart(4) + "   gates " + String(d.gates).padStart(2) + "   ancestors " + String(d.ancestorCount).padStart(4) + "   widgets " + String(d.widgets).padStart(7) + flag);
    console.log("".padEnd(dlabel + 2) + "path: " + d.path);
  }
}
