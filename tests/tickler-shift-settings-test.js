// Ticklers settings tab: the increment-option visibility lists (panel/Shift and alert/Alert) and both render-site gates.
// Checks: (1) the tab renders two sections — three panel rows and two alert rows, with caption+description text;
// (2) the panel section's shift buttons drop only Shift-hidden members; (3) the alert body's buttons drop only
// Alert-hidden members; (4) the shipped filters in both source files are the wired ones (extracted, not restated);
// (5) the year member ships tagged but withdrawn (the GroupBy/status precedent).
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-wiki"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;
const fs = require("fs");

let fails = 0;
const t = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + name + (ok ? "" : " got:" + JSON.stringify(got))); };

const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';
const render = inner => {
    const parser = wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + inner + "\n\n</$importvariables>");
    const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget});
    const c = doc.createElement("div"); w.render(c);
    return {c, w};
};
const txt = c => { let s = ""; (function f(n){ if(!n||typeof n!=="object") return; if(Array.isArray(n)) return n.forEach(f);
    if(n.isTiddlyWikiFakeDom) return (n.children||[]).forEach(f); s += (n.textContent||""); })(c); return s; };
const buttonLabels = c => { const out = []; (function f(n){ if(!n||typeof n!=="object") return; if(Array.isArray(n)) return n.forEach(f);
    if(n.isTiddlyWikiFakeDom) { if(n.tag === "button") out.push((n.textContent || "").replace(/\s+/g, " ").trim()); (n.children||[]).forEach(f); } })(c); return out; };
const checkboxCount = c => { let n0 = 0; (function f(n){ if(!n||typeof n!=="object") return; if(Array.isArray(n)) return n.forEach(f);
    if(n.isTiddlyWikiFakeDom) { if(n.tag === "input" && n.attributes && n.attributes.type === "checkbox") n0++; (n.children||[]).forEach(f); } })(c); return n0; };
const body = path => { const raw = fs.readFileSync(__dirname + "/../plugins/hypergsd-ticklers/" + path, "utf8"); return raw.substring(raw.indexOf("\n", raw.indexOf("\\whitespace")) + 1); };
const filterIn = (path, tag) => { const m = fs.readFileSync(__dirname + "/../plugins/hypergsd-ticklers/" + path, "utf8").match(new RegExp('filter="(\\[\\[\\$:/tags/hypergsd/Ticklers/' + tag + '\\]\\][^"]*)"')); return m && m[1]; };

// the actual shipped filters, extracted from the sources
const panelFilter = filterIn("ui/attributes/tickler.tid", "Shift");
const alertFilter = filterIn("modules/alert-body.tid", "Alert");
t("panel filter extracted", !!panelFilter, true);
t("alert filter extracted", !!alertFilter, true);
t("panel filter gates on the Shift visibility base", (panelFilter || "").indexOf("addprefix[$:/config/hypergsd/Ticklers/Shift/visibility/]") !== -1, true);
t("alert filter gates on the Alert visibility base", (alertFilter || "").indexOf("addprefix[$:/config/hypergsd/Ticklers/Alert/visibility/]") !== -1, true);

const DAY = "$:/plugins/yan/hypergsd-ticklers/ui/shift/day", WEEK = "$:/plugins/yan/hypergsd-ticklers/ui/shift/week", MONTH = "$:/plugins/yan/hypergsd-ticklers/ui/shift/month", YEAR = "$:/plugins/yan/hypergsd-ticklers/ui/shift/year";
const hide = (base, title) => wiki.addTiddler({title: "$:/config/hypergsd/Ticklers/" + base + "/visibility/" + title, text: "hide"});
const wipe = (base, title) => wiki.deleteTiddler("$:/config/hypergsd/Ticklers/" + base + "/visibility/" + title);

// (1) offered sets straight from the shipped filters — year parked untagged
t("panel default offers day, week, month", wiki.filterTiddlers(panelFilter), [DAY, WEEK, MONTH]);
t("alert default offers day and week", wiki.filterTiddlers(alertFilter), [DAY, WEEK]);
hide("Shift", MONTH);
t("Shift-hidden month leaves two in the panel", wiki.filterTiddlers(panelFilter), [DAY, WEEK]);
t("Shift-hidden month leaves the alert untouched", wiki.filterTiddlers(alertFilter), [DAY, WEEK]);
wipe("Shift", MONTH);
hide("Alert", DAY);
t("Alert-hidden day leaves one on the alert", wiki.filterTiddlers(alertFilter), [WEEK]);
t("Alert-hidden day leaves the panel untouched", wiki.filterTiddlers(panelFilter), [DAY, WEEK, MONTH]);
wipe("Alert", DAY);
t("year stays tagged Shift", wiki.filterTiddlers("[all[shadows+tiddlers]tag[$:/tags/hypergsd/Ticklers/Shift]] :and[match[" + YEAR + "]]"), [YEAR]);
t("shipped hidden entry withdraws year", wiki.getTiddlerText("$:/config/hypergsd/Ticklers/Shift/visibility/" + YEAR), "hide");
hide("Shift", YEAR);
t("panel drops the withdrawn year", wiki.filterTiddlers(panelFilter), [DAY, WEEK, MONTH]);
wiki.addTiddler({title: "$:/config/hypergsd/Ticklers/Shift/visibility/" + YEAR, text: "show"});
t("a show override offers year", wiki.filterTiddlers(panelFilter), [DAY, WEEK, MONTH, YEAR]);
wipe("Shift", YEAR);
t("deleting the override falls back to the shipped hide", wiki.filterTiddlers(panelFilter), [DAY, WEEK, MONTH]);

// (2) the settings tab renders: two sections — panel rows then alert rows, caption + description text
const tab = render('<$tiddler tiddler="$:/plugins/yan/hypergsd-ticklers/ui/control-panel/ticklers"><$transclude mode="inline"/></$tiddler>');
const tabText = txt(tab.c);
t("main heading", tabText.indexOf("Date increment options") !== -1, true);
t("panel and alert sub-headings", [tabText.indexOf("Panel") !== -1, tabText.indexOf("Alerts") !== -1], [true, true]);
t("tab checkbox rows (4 + 2)", checkboxCount(tab.c), 6);
["+d", "+w", "+m", "+y", "Add 1 day", "Add 7 days", "Add 30 days", "Add 365 days"].forEach(s => t("tab shows " + s, tabText.indexOf(s) !== -1, true));
const yearBoxUnchecked = (() => { let hit = null; (function f(n){ if(hit || !n || typeof n !== "object") return; if(Array.isArray(n)) return n.forEach(f);
    if(n.isTiddlyWikiFakeDom && n.tag === "input" && n.attributes && n.attributes.type === "checkbox" && (n.attributes.checked === undefined)) { const sibs = []; hit = n; } (n.children||[]).forEach(f); })(tab.c); return hit; })();
t("the year row renders unticked (one unchecked box of six)", (() => { let unchecked = 0; (function f(n){ if(!n||typeof n!=="object") return; if(Array.isArray(n)) return n.forEach(f);
    if(n.isTiddlyWikiFakeDom && n.tag === "input" && n.attributes && n.attributes.type === "checkbox" && n.attributes.checked === undefined) unchecked++; (n.children||[]).forEach(f); })(tab.c); return unchecked; })(), 1);
t("no unresolved transclusions", tabText.indexOf("{{$:") === -1, true);
t("tag-basis note names the Shift tag", tabText.indexOf("$:/tags/hypergsd/Ticklers/Shift") !== -1, true);
t("tag-basis note names the Alert tag", tabText.indexOf("$:/tags/hypergsd/Ticklers/Alert") !== -1, true);

// (3) the panel section's buttons follow the Shift knob alone
wiki.addTiddler({title: "ZZ shift host", tags: ["$:/GSD/Action"], gsd_status: "waiting", gsd_complete: "false", gsd_tickler_date: "20260101000000000"});
const panelCtx = src => `<$tiddler tiddler="ZZ shift host"><$let section-target="ZZ shift host" section-mode="panel" section-status-target="ZZ shift host" section-type="action">${src}</$let></$tiddler>`;
t("panel default buttons (year withdrawn)", buttonLabels(render(panelCtx(body("ui/attributes/tickler.tid"))).c).filter(x => /^\+[dwmy]$/.test(x)), ["+d", "+w", "+m"]);
wiki.addTiddler({title: "$:/config/hypergsd/Ticklers/Shift/visibility/" + YEAR, text: "show"});
t("panel offers +y once ticked on", buttonLabels(render(panelCtx(body("ui/attributes/tickler.tid"))).c).filter(x => /^\+[dwmy]$/.test(x)), ["+d", "+w", "+m", "+y"]);
wipe("Shift", YEAR);
hide("Shift", MONTH);
t("panel drops Shift-hidden month", buttonLabels(render(panelCtx(body("ui/attributes/tickler.tid"))).c).filter(x => /^\+[dwmy]$/.test(x)), ["+d", "+w"]);
wipe("Shift", MONTH);
hide("Alert", DAY);
t("panel ignores Alert-hidden day", buttonLabels(render(panelCtx(body("ui/attributes/tickler.tid"))).c).filter(x => /^\+[dwmy]$/.test(x)), ["+d", "+w", "+m"]);
wipe("Alert", DAY);

// (4) the alert body's buttons follow the Alert knob alone
wiki.addTiddler({title: "$:/temp/alert/ZZ shift host", text: "<$transclude $variable=\"hgsd-tickler-alert\"/>"});
const alertCtx = src => `<$tiddler tiddler="$:/temp/alert/ZZ shift host">${src}</$tiddler>`;
t("alert default buttons", buttonLabels(render(alertCtx(body("modules/alert-body.tid"))).c).filter(x => /^\+[dwmy]$/.test(x)), ["+d", "+w"]);
hide("Alert", DAY);
t("alert drops Alert-hidden day", buttonLabels(render(alertCtx(body("modules/alert-body.tid"))).c).filter(x => /^\+[dwmy]$/.test(x)), ["+w"]);
wipe("Alert", DAY);
hide("Shift", WEEK);
t("alert ignores Shift-hidden week", buttonLabels(render(alertCtx(body("modules/alert-body.tid"))).c).filter(x => /^\+[dwmy]$/.test(x)), ["+d", "+w"]);
wipe("Shift", WEEK);

// housekeeping: fixture scratch only
wiki.deleteTiddler("ZZ shift host");
wiki.deleteTiddler("$:/temp/alert/ZZ shift host");

console.log(fails ? "FAILURES: " + fails : "ALL CASES PASS");
process.exit(fails ? 1 : 0);