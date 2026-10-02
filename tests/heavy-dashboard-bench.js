// A7 heavy-dashboard bench: realistic row counts on the real GSD/Dashboard page.
// Surfaces: full-page construct+render; single item-edit refresh (the typing loop).
// Run against current plugin state; A/B by swapping /tmp/a7-backup files in/out.
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true;
$tw.boot.argv = [__dirname + "/fixture-wiki"];
$tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;

const N_ITEMS = 250;
// seed projects, contexts, actions — deterministic
for (let p = 1; p <= 5; p++) wiki.addTiddler({title: "ZZB P" + p, tags: ["$:/GSD/Project"], gsd_status: "active"});
for (let c = 1; c <= 5; c++) wiki.addTiddler({title: "@ZZB ctx" + c, tags: ["$:/tags/hypergsd/Context"], text: ""});
const statuses = ["next", "waiting", "future"];
for (let i = 1; i <= N_ITEMS; i++) {
  const fields = {title: "ZZB A" + String(i).padStart(3, "0"), text: "bench " + i, tags: ["$:/GSD/Action"], gsd_status: statuses[i % 3], gsd_complete: "false"};
  if (i % 5 !== 0) fields.gsd_project = "ZZB P" + ((i % 5) + 1);
  if (i % 3 === 0) fields.tags.push("@ZZB ctx" + ((i % 5) + 1));
  if (i % 7 === 0) fields.tags.push("@ZZB ctx" + (((i + 2) % 5) + 1));
  wiki.addTiddler(new $tw.Tiddler(fields));
}

const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';
const body = wiki.parseText("text/vnd.tiddlywiki", G + '\n\n<$transclude $tiddler="GSD/Dashboard" $mode="block"/>\n\n</$importvariables>');

const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

// surface 1: construct + render, 30 iterations
{
  const times = [];
  for (let i = 0; i < 30; i++) {
    const c = doc.createElement("div");
    const t0 = process.hrtime.bigint();
    const w = wiki.makeWidget(body, {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Dashboard"}});
    w.render(c);
    times.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  console.log("  heavy dashboard construct+render (" + N_ITEMS + " items): median " + median(times).toFixed(3) + " ms");
}
// surface 2: item-edit refresh on a constructed page (the typing loop), 30 cycles
{
  const times = [];
  const c = doc.createElement("div");
  const w = wiki.makeWidget(body, {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Dashboard"}});
  w.render(c);
  for (let i = 0; i < 30; i++) {
    const t = "ZZB A" + String((i * 7) % N_ITEMS + 1).padStart(3, "0");
    const t0 = process.hrtime.bigint();
    wiki.addTiddler(new $tw.Tiddler(wiki.getTiddler(t), {text: "bench edit " + i}));
    w.refresh({[t]: {modified: true}});
    times.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  console.log("  heavy dashboard item-edit refresh: median " + median(times).toFixed(3) + " ms");
}