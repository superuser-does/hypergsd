// Priorities GroupBy member: end-to-end grouped render through the real
// dashboard chassis with the view state seeded (one wiki boot per file —
// the shared-context priority-test render proved order-sensitive).
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-wiki"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;
const G = '<$importvariables filter="[[$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[$:/tags/Global/View]!is[draft]]">';
let fails = 0;
const t = (name, ok, extra) => { if (Array.isArray(ok)) ok = JSON.stringify(ok) === JSON.stringify(extra); if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + name + (ok || !extra ? "" : " " + extra)); };
function textOf(n) { if (!n || typeof n !== "object") return ""; if (Array.isArray(n)) return n.map(textOf).join("");
	if (n.tag === undefined && typeof n.textContent === "string") return n.textContent; return textOf(n.children); }

["ZZ A1", "ZZ B1", "ZZ C1", "ZZ N1"].forEach((title, i) => wiki.addTiddler({title, tags: ["$:/GSD/Action"], gsd_complete: "false", gsd_status: "next", gsd_priority: ["A", "B", "C", undefined][i]}));

// the strip radios must offer the member on the action dashboard, and a seeded
// view state must drive the grouping: High, Medium, Low, then No group
const stateTitle = "$:/config/hypergsd/list-view/GSD/Action dashboard/" + wiki.getTiddlerText("$:/language/hypergsd/Lists/NextActions");
wiki.addTiddler({title: stateTitle, "hgsd-group": "$:/plugins/yan/hypergsd-priorities/ui/group-by/priority", "hgsd-ungrouped": "yes", type: "text/vnd.tiddlywiki"});
const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + '\n\n<$transclude $tiddler="GSD/Action dashboard" $mode="block"/>\n\n</$importvariables>'), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Action dashboard"}});
const c = doc.createElement("div"); w.render(c);
const headings = (function f(n, acc) { if (!n || typeof n !== "object") return acc; if (Array.isArray(n)) { n.forEach(x => f(x, acc)); return acc; }
	if (n.attributes && n.attributes.class === "hgsd-group-title") acc.push(textOf(n.children)); if (n.children) f(n.children, acc); return acc; })(c.children, []);
const noGroup = wiki.getTiddlerText("$:/language/hypergsd/Lists/NoGroup");
t("grouped render: High, Medium, Low, then No group", JSON.stringify(headings) === JSON.stringify(["High", "Medium", "Low", noGroup]), JSON.stringify(headings));

// the rows sit under their group: A1 under High, N1 under No group
const groupBlocks = (function f(n, acc) { if (!n || typeof n !== "object") return acc; if (Array.isArray(n)) { n.forEach(x => f(x, acc)); return acc; }
	if (n.attributes && (n.attributes.class || "").indexOf("hgsd-project-list") !== -1) acc.push(n); if (n.children) f(n.children, acc); return acc; })(c.children, []);
function rowsIn(block) { return (function f(n, acc) { if (!n || typeof n !== "object") return acc; if (Array.isArray(n)) { n.forEach(x => f(x, acc)); return acc; }
	if (n.tag === "a" || (n.attributes && (n.attributes.class || "").indexOf("gsd-list-item-title") !== -1)) acc.push(textOf(n.children)); if (n.children) f(n.children, acc); return acc; })(block.children, []).filter(x => x.indexOf("ZZ ") !== -1); }
t("High group holds A1", groupBlocks.length >= 4 && rowsIn(groupBlocks[0]).join().indexOf("ZZ A1") !== -1, JSON.stringify(groupBlocks.map(b => rowsIn(b).join(","))));
t("No group holds the unset item", rowsIn(groupBlocks[groupBlocks.length - 1]).join().indexOf("ZZ N1") !== -1, JSON.stringify(groupBlocks.map(b => rowsIn(b).join(","))));

// the strip's Group by radios offer Priority (the $radio widgets render tc-radio labels; field= is not a DOM attribute)
const radioLabels = (function f(n, acc) { if (!n || typeof n !== "object") return acc; if (Array.isArray(n)) { n.forEach(x => f(x, acc)); return acc; }
	if (n.attributes && (n.attributes.class || "").indexOf("tc-radio") !== -1) acc.push(textOf(n.children)); if (n.children) f(n.children, acc); return acc; })(c.children, []);
t("strip offers the Priority group-by radio", radioLabels.indexOf("Priority") !== -1, JSON.stringify(radioLabels));

wiki.deleteTiddler(stateTitle);
["ZZ A1", "ZZ B1", "ZZ C1", "ZZ N1"].forEach(x => wiki.deleteTiddler(x));
console.log(fails === 0 ? "ALL PRIORITY-GROUPBY CASES PASS" : fails + " FAILURE(S)");
process.exit(fails === 0 ? 0 : 1);