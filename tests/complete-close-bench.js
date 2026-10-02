// Close-on-complete bench: (1) the completion click path with the setting off
// vs on (two extra gate evaluations + the $:/StoryList listops), (2) the
// $refresh cost of the story write riding a completion change set through a
// frozen heavy dashboard, (3) a story-only change set (must not descend — the
// gates exclude $:/StoryList, so dashboards stay frozen against river churn).
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-wiki"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;

const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';
const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const setConfig = (v) => wiki.addTiddler({title: "$:/config/hypergsd/close-on-complete", text: v});

// Seed: 250 actions for the dashboard surface + a 120-item click pool with a
// realistic 15-entry river of multi-word titles.
const N_ITEMS = 250, N_CLICKS = 120;
for (let p = 1; p <= 5; p++) wiki.addTiddler({title: "ZZB P" + p, tags: ["$:/GSD/Project"], gsd_status: "active"});
const statuses = ["next", "waiting", "future"];
for (let i = 1; i <= N_ITEMS; i++) {
  const fields = {title: "ZZB A" + String(i).padStart(3, "0"), text: "bench " + i, tags: ["$:/GSD/Action"], gsd_status: statuses[i % 3], gsd_complete: "false"};
  if (i % 5 !== 0) fields.gsd_project = "ZZB P" + ((i % 5) + 1);
  wiki.addTiddler(new $tw.Tiddler(fields));
}
const clickItems = [];
for (let i = 1; i <= N_CLICKS; i++) {
  const title = "ZZC click item " + String(i).padStart(3, "0");
  clickItems.push(title);
  wiki.addTiddler({title, tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false"});
}
const river = clickItems.slice(0, 15).concat(["Some other tiddler", "Another open page here"]);
wiki.addTiddler({title: "$:/StoryList", list: river});

// Click dispatch (own page: host = item) — the full real click cost:
// parse + render + invoke of the handler tree.
const fireClick = (tiddler) => {
  const body = '<$tiddler tiddler="' + tiddler + '"><$button><$let dom-data-tiddler="' + tiddler + '" dom-data-hgsd-action="complete">'
    + '<$transclude $variable="hgsd-handle-click"/></$let></$button></$tiddler>';
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + body + "\n\n</$importvariables>"), {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c);
  let btn = null;
  (function f(n) { if (!n || btn || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(f);
    if (n.parseTreeNode && n.parseTreeNode.tag === "$button") { btn = n; return; } (n.children || []).forEach(f); })(w.children);
  btn.invokeActions(btn, {type: "click"});
};

// Surface 1: completion click path, setting off vs on (own page, item in river).
const clickTimes = {off: [], on: []};
{
  // Interleaved by index parity so arm ordering cannot bias the medians.
  for (let i = 0; i < N_CLICKS / 2; i++) {
    setConfig("never");
    let t0 = process.hrtime.bigint();
    fireClick(clickItems[i * 2]);
    clickTimes.off.push(Number(process.hrtime.bigint() - t0) / 1e6);
    setConfig("always");
    t0 = process.hrtime.bigint();
    fireClick(clickItems[i * 2 + 1]);
    clickTimes.on.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  const dOff = median(clickTimes.off).toFixed(3), dOn = median(clickTimes.on).toFixed(3);
  console.log("  completion click, setting never: median " + dOff + " ms");
  console.log("  completion click, setting always (closes from river): median " + dOn + " ms  (delta " + (median(clickTimes.on) - median(clickTimes.off)).toFixed(3) + " ms)");
}

// Surface 2 + 3: heavy dashboard refresh against completion change sets.
// Each case gets its own constructed page so no case rides an
// already-consumed change from the previous one.
const body = wiki.parseText("text/vnd.tiddlywiki", G + '\n\n<$transclude $tiddler="GSD/Dashboard" $mode="block"/>\n\n</$importvariables>');
const runCase = (changeSetFor) => {
  const c = doc.createElement("div");
  const w = wiki.makeWidget(body, {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Dashboard"}});
  w.render(c);
  const probe = "ZZB A" + String((3 * 7) % N_ITEMS + 1).padStart(3, "0");
  const times = [];
  for (let i = 0; i < 30; i++) {
    wiki.addTiddler(new $tw.Tiddler(wiki.getTiddler(probe), {text: "bench edit " + i}));
    const t0 = process.hrtime.bigint();
    w.refresh(changeSetFor(probe));
    times.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  return median(times);
};
{
  const itemOnly = runCase(p => ({[p]: {modified: true}}));
  const withStory = runCase(p => ({[p]: {modified: true}, "$:/StoryList": {modified: true}}));
  const storyOnly = runCase(() => ({"$:/StoryList": {modified: true}}));
  console.log("  heavy dashboard refresh, item change alone: median " + itemOnly.toFixed(3) + " ms");
  console.log("  heavy dashboard refresh, item + $:/StoryList change: median " + withStory.toFixed(3) + " ms  (delta " + (withStory - itemOnly).toFixed(3) + " ms)");
  console.log("  heavy dashboard refresh, $:/StoryList change alone: median " + storyOnly.toFixed(3) + " ms  (river churn stays outside the gates)");
}
setConfig("never");