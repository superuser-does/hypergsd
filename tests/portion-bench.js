// Portion chassis benchmark: construct+render cost of the three surfaces the
// Top band touches (dashboard chassis, panel chassis, Settings sections page
// with its picker rows), plus a membership-edit refresh cycle. Run before AND
// after a chassis change; compare medians. Labels are read live from the wiki
// so the report self-describes which vocabulary was active.
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-wiki"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;

const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';
// fixture items so dashboard lists render real rows
wiki.addTiddler({title: "P one", tags: ["$:/GSD/Project"], gsd_status: "active"});
wiki.addTiddler({title: "A next", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_project: "P one"});

const median = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const fmt = ms => ms.toFixed(3) + " ms";

const surfaces = {
  "dashboard chassis (GSD/Dashboard)":
    '<$transclude $tiddler="GSD/Dashboard" $mode="block"/>',
  "panel chassis (hgsd-section-portions)":
    '<$tiddler tiddler="A next"><$transclude $variable="hgsd-section-portions" tag-list="$:/tags/hypergsd/PanelTemplate" visibility-base="$:/config/hypergsdPanel/visibility/"/></$tiddler>',
  "Settings sections page (picker rows)":
    '<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/control-panel/sections" $mode="block"/>'
};

console.log("portion chassis benchmark (" + new Date().toISOString().slice(0, 10) + ")");
console.log("picker labels: Top=" + JSON.stringify(wiki.getTiddlerText("$:/language/hypergsd/Settings/PanelModal/PortionTop")) +
  " Full=" + JSON.stringify(wiki.getTiddlerText("$:/language/hypergsd/Settings/PanelModal/PortionFull")));

const N = 200;
const results = {};
for (const [name, inner] of Object.entries(surfaces)) {
  const body = wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + inner + "\n\n</$importvariables>");
  const times = [];
  for (let i = 0; i < N; i++) {
    const c = doc.createElement("div");
    const t0 = process.hrtime.bigint();
    const w = wiki.makeWidget(body, {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
    w.render(c);
    times.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  results[name] = median(times);
  console.log("  " + name + ": median " + fmt(results[name]));
}

// refresh cycle: a membership tag write (the change class a portion pick makes)
// must wake the dashboard chassis; time construct + render + one refresh.
{
  const body = wiki.parseText("text/vnd.tiddlywiki", G + '\n\n<$transclude $tiddler="GSD/Dashboard" $mode="block"/>\n\n</$importvariables>');
  const times = [];
  for (let i = 0; i < N; i++) {
    const c = doc.createElement("div");
    const w = wiki.makeWidget(body, {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
    w.render(c);
    const t0 = process.hrtime.bigint();
    wiki.addTiddler({title: "ZZ bench member", tags: ["$:/tags/hypergsd/Lists/Dashboard", "$:/tags/hypergsd/Lists/Dashboard/Portion/2"], text: "BENCH"});
    w.refresh({["ZZ bench member"]: wiki.getTiddler("ZZ bench member")});
    wiki.deleteTiddler("ZZ bench member");
    w.refresh({["ZZ bench member"]: null});
    times.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  results["dashboard refresh (member add+remove)"] = median(times);
  console.log("  dashboard refresh (member add+remove): median " + fmt(results["dashboard refresh (member add+remove)"]));
}

require("fs").writeFileSync(__dirname + "/portion-bench-results.json", JSON.stringify(results, null, 2));
console.log("results written to portion-bench-results.json");