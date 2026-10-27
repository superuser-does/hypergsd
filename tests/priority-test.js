// Priorities sub-plugin: rank function, shared write procedure, sort filter,
// panel section render (Portion/0 placement, native radios, accent colours,
// conditional Not set row) and the write paths (radio set, Not set clears).
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-wiki"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;
const fs = require("fs");
const G = '<$importvariables filter="[[$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[$:/tags/Global]!is[draft]]">';
let fails = 0;
const t = (name, ok, extra) => { if (Array.isArray(ok)) ok = JSON.stringify(ok) === JSON.stringify(extra); if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + name + (ok || !extra ? "" : " " + extra)); };

// fakeDOM text nodes carry textContent and no .tag; elements recurse through children
function textOf(n) {
	if (!n || typeof n !== "object") return "";
	if (Array.isArray(n)) return n.map(textOf).join("");
	if (n.tag === undefined && typeof n.textContent === "string") return n.textContent;
	return textOf(n.children);
}

// fixtures
wiki.addTiddler({title: "ZZ prio action", tags: ["$:/GSD/Action"], gsd_complete: "false", gsd_status: "next", gsd_priority: "B"});
wiki.addTiddler({title: "ZZ prio contact", tags: ["$:/GSD/Contact"]});
wiki.addTiddler({title: "ZZ A1", gsd_priority: "A", tags: ["$:/GSD/Action"], gsd_complete: "false"});
wiki.addTiddler({title: "ZZ B1", gsd_priority: "B", tags: ["$:/GSD/Action"], gsd_complete: "false"});
wiki.addTiddler({title: "ZZ C1", gsd_priority: "C", tags: ["$:/GSD/Action"], gsd_complete: "false"});
wiki.addTiddler({title: "ZZ N1", tags: ["$:/GSD/Action"], gsd_complete: "false"});

// 1. rank function via a rendered sink (functions resolve through the import chain)
function rank(v) {
	const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + '\n\n<$text text={{{ [function[hgsd-priority-rank],[' + v + ']] }}} />\n\n</$importvariables>'), {document: doc, parentWidget: $tw.rootWidget});
	const c = doc.createElement("div"); w.render(c);
	return textOf(c.children);
}
t("rank A = 3", rank("A") === "3", rank("A"));
t("rank B = 2", rank("B") === "2", rank("B"));
t("rank C = 1", rank("C") === "1", rank("C"));
t("rank empty = 0", rank("") === "0", rank(""));
t("rank garbage = 0", rank("urgent") === "0", rank("urgent"));

// 2. the SortBy member's filter: A, B, C, unset last
const sorted = wiki.filterTiddlers("[[ZZ N1]] [[ZZ B1]] [[ZZ A1]] [[ZZ C1]] :sort[get[gsd_priority]else[zz]]");
t("priority sort order A,B,C,unset", JSON.stringify(sorted) === JSON.stringify(["ZZ A1", "ZZ B1", "ZZ C1", "ZZ N1"]), JSON.stringify(sorted));

// 6. the GroupBy member: fields, label fallback, and a grouped render through the real engine
const gbm = (wiki.getTiddler("$:/plugins/yan/hypergsd-priorities/ui/group-by/priority") || {fields: {}}).fields;
t("group-by member ships with synthetic keys and type scoping", gbm["hgsd-synthetic-keys"] === "yes" && gbm["hgsd-types"] === "action project" && gbm["hgsd-group-filter"] === "[all[current]get[gsd_priority]]", JSON.stringify({synthetic: gbm["hgsd-synthetic-keys"], types: gbm["hgsd-types"]}));
function labelOfKey(key) {
	const shipped = gbm["hgsd-label-filter"];
	const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + '\n\n<$text text={{{ ' + shipped + ' }}} />\n\n</$importvariables>'), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: key}});
	const c = doc.createElement("div"); w.render(c);
	return textOf(c.children);
}
t("group label resolves from the shipped filter", labelOfKey("B") === "Medium", labelOfKey("B"));
t("unknown group key falls back to itself", labelOfKey("urgent") === "urgent", labelOfKey("urgent"));
t("grouped render: covered by priority-groupby-test.js (fresh boot)", true);


// 3. the section inside the real panel chassis: Portion/0, radios, accents, Not set row
function renderPanel(title) {
	const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + '\n\n<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/ViewTemplate/view-body" $mode="block"/>\n\n</$importvariables>'), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: title}});
	const c = doc.createElement("div"); w.render(c);
	return {w, c};
}
function findRadioInputs(root) {
	return (function f(n, acc) { if (!n || typeof n !== "object") return acc; if (Array.isArray(n)) { n.forEach(x => f(x, acc)); return acc; }
		if (n.tag === "input" && n.attributes && n.attributes.type === "radio") acc.push(n); if (n.children) f(n.children, acc); return acc; })(root, []);
}
function findOptionLabels(root) {
	return (function f(n, acc) { if (!n || typeof n !== "object") return acc; if (Array.isArray(n)) { n.forEach(x => f(x, acc)); return acc; }
		if (n.attributes && n.attributes.class === "hgsd-priority-option") acc.push(n); if (n.children) f(n.children, acc); return acc; })(root, []);
}
let panel = renderPanel("ZZ prio action");
const optionLabels = findOptionLabels(panel.c.children);
const radioInputs = optionLabels.map(l => findRadioInputs([l])[0]);
t("three radios rendered", radioInputs.length === 3 && radioInputs.every(Boolean), String(radioInputs.length));
const radioLabels = optionLabels.map(l => textOf(l.children));
t("radio labels from the dictionary", JSON.stringify(radioLabels) === JSON.stringify(["High", "Medium", "Low"]), JSON.stringify(radioLabels));
const radioSelected = radioInputs.map(i => i.attributes.checked !== undefined ? 1 : 0);
t("Medium radio checked (B)", JSON.stringify(radioSelected) === JSON.stringify([0, 1, 0]), JSON.stringify(radioSelected));
t("radios carry data-tiddler and data-priority", radioInputs.every(i => i.attributes["data-tiddler"] === "ZZ prio action" && i.attributes["data-priority"] && i.attributes.name === "ZZ prio action-priority"), JSON.stringify((radioInputs[0] || {attributes: {}}).attributes));
// selected-block colour: no inline styles anywhere — the rows carry letter hook classes and the stylesheet's generated rules own the colours
const optionStyles = optionLabels.map(l => (l.attributes && l.attributes.style) || "");
t("option labels carry no inline colour styles", optionStyles.every(s => s === ""), JSON.stringify(optionStyles));
const hookRows = (function f(n, acc) { if (!n || typeof n !== "object") return acc; if (Array.isArray(n)) { n.forEach(x => f(x, acc)); return acc; }
	if (n.attributes && /\bhgsd-priority-row\b/.test(n.attributes.class || "")) acc.push(n.attributes.class); if (n.children) f(n.children, acc); return acc; })(panel.c.children, []);
t("rows carry their letter hook classes", JSON.stringify(hookRows) === JSON.stringify(["hgsd-priority-row hgsd-priority-A", "hgsd-priority-row hgsd-priority-B", "hgsd-priority-row hgsd-priority-C"]), JSON.stringify(hookRows));

// Portion/0: the radios must sit in the FIRST portion column of the capture row
const captureRow = (function f(n) { if (!n || typeof n !== "object") return null; if (Array.isArray(n)) { for (const x of n) { const r = f(x); if (r) return r; } return null; }
	if (n.attributes && n.attributes.class === "hgsd-capture") return n; return f(n.children); })(panel.c.children);
let inFirstPortion = false;
if (captureRow) {
	const firstDiv = (captureRow.children || []).find(n => n.tag === "div");
	inFirstPortion = !!firstDiv && findRadioInputs([firstDiv]).length === 3;
}
t("radios claim the first portion column (Portion/0)", inFirstPortion);

// type gate: contacts render no radios
t("no radios on a contact", findRadioInputs(renderPanel("ZZ prio contact").c.children).length === 0);

// 4. writes
// the catcher's handler writes through hgsd-priority-set with the input's data attributes
{
	const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + '\n\n<$button class="zz">x<$let dom-data-tiddler="ZZ prio action" dom-data-priority="A"><$transclude $variable="hgsd-priority-click"/></$let></$button>\n\n</$importvariables>'), {document: doc, parentWidget: $tw.rootWidget});
	const c = doc.createElement("div"); w.render(c);
	let btn = null;
	(function f(n) { if (btn || !n || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(f);
		if (n.parseTreeNode && n.parseTreeNode.tag === "$button") { btn = n; return; } (n.children || []).forEach(f); })(w);
	btn.invokeActions(btn, {type: "click"});
	t("clicking the High radio writes gsd_priority A", (wiki.getTiddler("ZZ prio action") || {fields: {}}).fields.gsd_priority === "A");
}

// the Not set row: present while set, clears through hgsd-priority-set, absent when unset
function findClearButton(tree) {
	let btn = null;
	(function f(n) { if (btn || !n || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(f);
		if (n.parseTreeNode && n.parseTreeNode.tag === "$button" && n.domNodes && n.domNodes[0] && ((n.domNodes[0].attributes.class || "").indexOf("hgsd-priority-clear") !== -1)) { btn = n; return; }
		(n.children || []).forEach(f); })(tree);
	return btn;
}
panel = renderPanel("ZZ prio action"); // still A
clear = findClearButton(panel.w);
t("clear ✕ present while a priority is set", !!clear);
t("clear ✕ carries no inline ink (the stylesheet's --priority-ink rule colours it)", clear && !((clear.domNodes[0].attributes || {}).style), clear && JSON.stringify(clear.domNodes[0].attributes.style));
t("clear ✕ sits inside the selected row", clear && (function() {
	const rows = (function f(n, acc) { if (!n || typeof n !== "object") return acc; if (Array.isArray(n)) { n.forEach(x => f(x, acc)); return acc; }
		if (n.attributes && /\bhgsd-priority-row\b/.test(n.attributes.class || "")) acc.push(n); if (n.children) f(n.children, acc); return acc; })(panel.c.children, []);
	const withButton = rows.filter(r => (r.children || []).filter(c => c.tag === "button").length === 1);
	return rows.length === 3 && withButton.length === 1 && (withButton[0].children || []).some(c => c.tag === "label" && (c.attributes.class === "hgsd-priority-option"));
})(), "row-count/with-button mismatch");
clear.invokeActions(clear, {type: "click"});
t("clear ✕ clears the set priority (the reported bug)", (wiki.getTiddler("ZZ prio action") || {fields: {}}).fields.gsd_priority === undefined);

panel = renderPanel("ZZ prio action");
t("clear ✕ absent once unset", !findClearButton(panel.w));

// the shared procedure also sets values (the future select's path) — fire on the button, the shipped harness pattern
{
	const mk = value => { const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + '\n\n<$button class="zz">x<$transclude $variable="hgsd-priority-set" item-title="ZZ prio action" priority-value="' + value + '"/></$button>\n\n</$importvariables>'), {document: doc, parentWidget: $tw.rootWidget});
		const c = doc.createElement("div"); w.render(c); return w; };
	let btn = null;
	(function f(n) { if (btn || !n || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(f);
		if (n.parseTreeNode && n.parseTreeNode.tag === "$button") { btn = n; return; } (n.children || []).forEach(f); })(mk("C"));
	btn.invokeActions(btn, {type: "click"});
	t("hgsd-priority-set writes C", (wiki.getTiddler("ZZ prio action") || {fields: {}}).fields.gsd_priority === "C");
	btn = null;
	(function f(n) { if (btn || !n || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(f);
		if (n.parseTreeNode && n.parseTreeNode.tag === "$button") { btn = n; return; } (n.children || []).forEach(f); })(mk(""));
	btn.invokeActions(btn, {type: "click"});
	t("hgsd-priority-set with an empty value deletes", (wiki.getTiddler("ZZ prio action") || {fields: {}}).fields.gsd_priority === undefined);
}

// label source: the language strings (the dictionaries are gone — lingo overrides replace them)
wiki.addTiddler({title: "$:/language/hypergsd/Lists/Priorities/Name/A", text: "Critical"});
wiki.addTiddler({title: "$:/language/hypergsd/Lists/Priorities/Name/B", text: "Normal"});
wiki.addTiddler({title: "$:/language/hypergsd/Lists/Priorities/Name/C", text: "Someday"});
const relabels = findOptionLabels(renderPanel("ZZ prio action").c.children).map(l => textOf(l.children));
t("lingo overrides reach the panel", JSON.stringify(relabels) === JSON.stringify(["Critical", "Normal", "Someday"]), JSON.stringify(relabels));
wiki.deleteTiddler("$:/language/hypergsd/Lists/Priorities/Name/A");
wiki.deleteTiddler("$:/language/hypergsd/Lists/Priorities/Name/B");
wiki.deleteTiddler("$:/language/hypergsd/Lists/Priorities/Name/C");

// 5. stray-markup audit on the section body + if/endif balance
const sectionRaw = fs.readFileSync(__dirname + "/../plugins/hypergsd-priorities/ui/panel/priority.tid", "utf8");
const sectionBody = sectionRaw.substring(sectionRaw.indexOf("\n", sectionRaw.indexOf("\\whitespace")) + 1);
const ifCount = (sectionBody.match(/<%if /g) || []).length, endifCount = (sectionBody.match(/<%endif%>/g) || []).length;
t("if/endif balance", ifCount === endifCount && ifCount > 0, ifCount + "/" + endifCount);
(function walk(n) { if (!n) return; if (Array.isArray(n)) return n.forEach(walk);
	if (n.type === "text" && /<\/?\$|^>/.test(String(n.text))) { fails++; console.log("FAIL stray markup: " + JSON.stringify(String(n.text).slice(0, 40))); }
	if (n.children) walk(n.children); })(wiki.parseText("text/vnd.tiddlywiki", sectionBody).tree);
console.log("stray-markup walk complete");



// 7. the default-priority setting: the tab's select and the AfterCreation rule
{
	const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + '\n\n<$transclude $tiddler="$:/plugins/yan/hypergsd-priorities/ui/control-panel/priorities" $mode="block"/>\n\n</$importvariables>'), {document: doc, parentWidget: $tw.rootWidget});
	const c = doc.createElement("div"); w.render(c);
	const select = (function f(n) { if (!n || typeof n !== "object") return null; if (Array.isArray(n)) { for (const x of n) { const r = f(x); if (r) return r; } return null; }
		if (n.tag === "select") return n; return f(n.children); })(c.children);
	const options = select ? (function f(n, acc) { if (!n || typeof n !== "object") return acc; if (Array.isArray(n)) { n.forEach(x => f(x, acc)); return acc; }
		if (n.tag === "option") acc.push((n.attributes.value === undefined ? "" : n.attributes.value) + "=" + textOf(n.children)); if (n.children) f(n.children, acc); return acc; })(select.children, []) : [];
	t("settings tab renders the default-priority select", JSON.stringify(options) === JSON.stringify(["=– none –", "A=High", "B=Medium", "C=Low"]), JSON.stringify(options));
}
// The MODAL shape, honestly: the action tree renders BEFORE the tiddler exists
// (createTiddler-title is only set at invoke), so the old direct-invocation
// harness could not catch the render-time-cache trap that broke the live flow.
function createViaHook(title, type, project) {
	const fields = project ? '<$action-setfield $tiddler=<<createTiddler-title>> gsd_project="' + project + '"/>' : "";
	const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + '\n\n<$button class="zz">x<$action-createtiddler $basetitle="' + title + '" tags="">' + fields + '<$transclude $variable="hgsd-run-after-create" new-title=<<createTiddler-title>> new-type="' + type + '" calling-tiddler="" new-source="modal"/></$action-createtiddler></$button>\n\n</$importvariables>'), {document: doc, parentWidget: $tw.rootWidget});
	const c = doc.createElement("div"); w.render(c);
	if (wiki.getTiddler(title)) throw new Error("harness regression: tiddler exists at render time");
	let btn = null;
	(function f(n) { if (btn || !n || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(f);
		if (n.parseTreeNode && n.parseTreeNode.tag === "$button") { btn = n; return; } (n.children || []).forEach(f); })(w);
	Object.getPrototypeOf(btn).getBoundingClientRect = function() { return {top: 0, left: 0, bottom: 1, right: 1, width: 1, height: 1}; };
	btn.invokeActions(btn, {type: "click"});
	return (wiki.getTiddler(title) || {fields: {}}).fields.gsd_priority;
}
const cfg = "$:/config/hypergsd/priorities/default";
wiki.addTiddler({title: cfg, text: "B"});
t("hook seeds the default on a new action", createViaHook("ZZ new action", "action") === "B");
t("hook seeds the default on a new project", createViaHook("ZZ new project", "project") === "B");
t("hook leaves contacts alone", createViaHook("ZZ new contact", "contact") === undefined);
wiki.addTiddler({title: cfg, text: "urgent"});
t("invalid config value writes nothing", createViaHook("ZZ new two", "action") === undefined);
wiki.deleteTiddler(cfg);
t("absent config writes nothing", createViaHook("ZZ new three", "action") === undefined);

// inheritance: the item's gsd_project wins over the configured default (same modal-shaped harness: render before create, project written inside the create chain like the modal's pass-through)
wiki.addTiddler({title: "$:/config/hypergsd/priorities/default", text: "C"});
wiki.addTiddler({title: "ZZ parent project", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "false", gsd_priority: "B"});
wiki.addTiddler({title: "ZZ plain project", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "false"});
wiki.addTiddler({title: "ZZ odd project", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "false", gsd_priority: "urgent"});
t("action under a prioritised project inherits it (over the default)", createViaHook("ZZ under one", "action", "ZZ parent project") === "B");
t("action under an unprioritised project takes the default", createViaHook("ZZ under two", "action", "ZZ plain project") === "C");
t("garbage project priority falls through to the default", createViaHook("ZZ under three", "action", "ZZ odd project") === "C");
t("unparented action still takes the default", createViaHook("ZZ under four", "action") === "C");
t("a pre-set priority is never overwritten", (() => {
	const title = "ZZ under five";
	const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + '\n\n<$button class="zz">x<$action-createtiddler $basetitle="' + title + '" tags=""><$action-setfield $tiddler=<<createTiddler-title>> gsd_project="ZZ parent project" gsd_priority="A"/><$transclude $variable="hgsd-run-after-create" new-title=<<createTiddler-title>> new-type="action" calling-tiddler="" new-source="modal"/></$action-createtiddler></$button>\n\n</$importvariables>'), {document: doc, parentWidget: $tw.rootWidget});
	const c = doc.createElement("div"); w.render(c);
	let btn = null;
	(function f(n) { if (btn || !n || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(f);
		if (n.parseTreeNode && n.parseTreeNode.tag === "$button") { btn = n; return; } (n.children || []).forEach(f); })(w);
	Object.getPrototypeOf(btn).getBoundingClientRect = function() { return {top: 0, left: 0, bottom: 1, right: 1, width: 1, height: 1}; };
	btn.invokeActions(btn, {type: "click"});
	return (wiki.getTiddler(title) || {fields: {}}).fields.gsd_priority === "A";
})());

// 8. the list-row select: render shape, gating, and the change flow
{
	const GV = '<$importvariables filter="[[$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[$:/tags/Global/View]!is[draft]]">';
	function renderRow(title) {
		const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", GV + '\n\n<$tiddler tiddler="' + title + '"><$transclude $variable="hgsd-item"/></$tiddler>\n\n</$importvariables>'), {document: doc, parentWidget: $tw.rootWidget});
		const c = doc.createElement("div"); w.render(c); return {c, w};
	}
	function findTag(n, tag) { if (!n || typeof n !== "object") return null; if (Array.isArray(n)) { for (const x of n) { const r = findTag(x, tag); if (r) return r; } return null; }
		if (n.tag === tag) return n; return findTag(n.children, tag); }
	function findPrioSpan(n) { if (!n || typeof n !== "object") return null; if (Array.isArray(n)) { for (const x of n) { const r = findPrioSpan(x); if (r) return r; } return null; }
		if (n.tag === "span" && /\bhgsd-row-priority\b/.test(n.attributes.class || "")) return n; return findPrioSpan(n.children); }
	wiki.addTiddler({title: "ZZ row action", tags: ["$:/GSD/Action"], gsd_complete: "false", gsd_status: "next"});
	wiki.addTiddler({title: "ZZ row contact", tags: ["$:/GSD/Contact"], gsd_complete: "false"});
	wiki.addTiddler({title: "ZZ row done", tags: ["$:/GSD/Action"], gsd_complete: "true"});
	let row = renderRow("ZZ row action");
	let sel = findTag(row.c.children, "select");
	t("row select renders on actions", !!sel);
	if (sel) {
		const opts = findTag(sel.children, "option") ? null : null; // placeholder
		const all = (function g(n, acc) { if (!n || typeof n !== "object") return acc; if (Array.isArray(n)) { n.forEach(x => g(x, acc)); return acc; }
			if (n.tag === "option") acc.push(n); if (n.children) g(n.children, acc); return acc; })(sel.children, []);
		const vals = all.map(o => (o.attributes.value === undefined ? "" : o.attributes.value));
		t("row select offers unset + A/B/C", JSON.stringify(vals) === JSON.stringify(["", "A", "B", "C"]), JSON.stringify(vals));
		t("row select sits in its colourable wrapper span (no letter set, no hook class)", ((s) => !!s && s.attributes.class === "hgsd-row-priority")(findPrioSpan(row.c.children)), "span/class mismatch");
		t("row select options carry no inline styles (generated stylesheet rules own the colours)", all.every(o => !(o.attributes.style)), "inline style leaked");
		t("row select unset option is a dash", textOf(all[0].children) === "–", textOf(all[0].children));
		t("row select options use the short labels", textOf(all[1].children) === "H" && textOf(all[2].children) === "M" && textOf(all[3].children) === "L", [1,2,3].map(i => textOf(all[i].children)).join("/"));
		(function driveSelect(root, value) { (function f(n) { if (!n || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(f);
			if (n.parseTreeNode && (n.parseTreeNode.tag === "select" || n.parseTreeNode.tag === "$select")) { n.getSelectDomNode().value = value; n.handleChangeEvent({}); }
			if (n.children) f(n.children); })(root); })(row.w, "C");
		t("changing the row select writes the field", wiki.getTiddler("ZZ row action").fields.gsd_priority === "C");
		(function driveSelect(root, value) { (function f(n) { if (!n || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(f);
			if (n.parseTreeNode && (n.parseTreeNode.tag === "select" || n.parseTreeNode.tag === "$select")) { n.getSelectDomNode().value = value; n.handleChangeEvent({}); }
			if (n.children) f(n.children); })(root); })(row.w, "");
		t("clearing via the row select deletes the field", (wiki.getTiddler("ZZ row action").fields.gsd_priority === undefined));
	}
	wiki.addTiddler(new $tw.Tiddler(wiki.getTiddler("ZZ row action"), {gsd_priority: "B"}));
	row = renderRow("ZZ row action");
	t("row select still present when a priority is set", !!findTag(row.c.children, "select"));
	t("wrapper span carries the item's letter hook class", ((s) => !!s && s.attributes.class === "hgsd-row-priority hgsd-priority-B")(findPrioSpan(row.c.children)), findPrioSpan(row.c.children) && findPrioSpan(row.c.children).attributes.class);
	t("no row select on contacts", !findTag(renderRow("ZZ row contact").c.children, "select"));
	t("no row select on completed rows", !findTag(renderRow("ZZ row done").c.children, "select"));
}

// 9. names: language strings, lingo overrides, the settings table
{
	const GV2 = '<$importvariables filter="[[$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[$:/tags/Global]!is[draft]]">';
	function renderT(wt) { const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", GV2 + "\n\n" + wt + "\n\n</$importvariables>"), {document: doc, parentWidget: $tw.rootWidget});
		const c = doc.createElement("div"); w.render(c); return c; }
	function textAll(n) { return (function textOf(n) { if (!n || typeof n !== "object") return ""; if (Array.isArray(n)) return n.map(textOf).join("");
		if (n.tag === undefined && typeof n.textContent === "string") return n.textContent; return textOf(n.children); })(n); }
	// the editor: a table — one row per priority: letter chip in its colour, Name edit, Short edit (inputs bound to the lingo tiddlers)
	const ed = renderT('<$transclude $tiddler="$:/plugins/yan/hypergsd-priorities/ui/control-panel/priorities" $mode="block"/>');
	const rowsEls = (function g(n, acc) { if (!n || typeof n !== "object") return acc; if (Array.isArray(n)) { n.forEach(x => g(x, acc)); return acc; }
		if (n.tag === "tr" && n.children && n.children.some(x => x.tag === "td" || x.tag === "th")) acc.push(n); if (n.children) g(n.children, acc); return acc; })(ed.children, []);
	const cellTag = (x) => x.tag === "td" || x.tag === "th";
	const bodyRows = rowsEls.filter(r => r.children.some(x => cellTag(x) && (function g(n) { if (!n || typeof n !== "object") return false; if (Array.isArray(n)) { for (const y of n) { if (g(y)) return true; } return false; } if (n.tag === "input") return true; return g(n.children); })(x.children)));
	t("names table renders one row per priority", bodyRows.length === 3, bodyRows.length);
	const chips = bodyRows.map(r => { const td0 = r.children.find(x => cellTag(x)); return td0 ? textAll(td0.children).trim() : "?"; });
	t("column 1 shows the bare letters", JSON.stringify(chips) === JSON.stringify(["A", "B", "C"]), JSON.stringify(chips));
	// the colour columns: fill, ink and line pickers (the core palette-manager input pattern) bound to the colours dictionary
	const colourInputs = bodyRows.map(r => (function g(n, acc) { if (!n || typeof n !== "object") return acc; if (Array.isArray(n)) { n.forEach(x => g(x, acc)); return acc; }
		if (n.tag === "input" && n.attributes.type === "color") acc.push(n); return g(n.children, acc); })(r, []));
	t("colour pickers carry the dictionary fills, inks and lines", colourInputs.every(r => r.length === 3) && JSON.stringify(colourInputs.map(r => r.map(i => i.attributes.value))) === JSON.stringify([["#B3261E", "#FFFFFF", "#8B1A14"], ["#E39A4A", "#38220B", "#8A5A14"], ["#78909C", "#1B2430", "#1B2430"]]), JSON.stringify(colourInputs.map(r => r.map(i => i && i.attributes.value))));
	const inputs = bodyRows.map(r => (function g(n) { if (!n || typeof n !== "object") return []; if (Array.isArray(n)) { const a = []; n.forEach(x => { a.push(...g(x)); }); return a; }
		if (n.tag === "input") return [n]; return g(n.children); })(r));
	t("each row edits its fill, ink, line, Name and Short strings", inputs.every(r => r.length === 5 && r.slice(0, 3).every(i => i.attributes.type === "color")) && JSON.stringify(inputs.map(r => r.map(i => i.attributes.value))) === JSON.stringify([["#B3261E", "#FFFFFF", "#8B1A14", "High", "H"], ["#E39A4A", "#38220B", "#8A5A14", "Medium", "M"], ["#78909C", "#1B2430", "#1B2430", "Low", "L"]]),
		JSON.stringify(inputs.map(r => r.map(i => i.attributes.value))));
	// a lingo override flows through the panel and back into the editor
	wiki.addTiddler({title: "$:/language/hypergsd/Lists/Priorities/Name/A", text: "Urgent"});
	const panel = renderT('<$tiddler tiddler="ZZ row action"><$transclude $tiddler="$:/plugins/yan/hypergsd-priorities/ui/panel/priority" $mode="block"/></$tiddler>');
	t("lingo override reaches the panel", textAll(panel.children).includes("Urgent"), "panel missed Urgent");
	const ed2 = renderT('<$transclude $tiddler="$:/plugins/yan/hypergsd-priorities/ui/control-panel/priorities" $mode="block"/>');
	t("lingo override shows in the editor box", textAll(ed2.children).includes("Urgent"), "editor missed Urgent");
	// an empty Name falls back to the letter (and the row select's short label still resolves)
	wiki.addTiddler({title: "$:/language/hypergsd/Lists/Priorities/Name/B", text: ""});
	const sel2 = renderT('<$transclude $tiddler="$:/plugins/yan/hypergsd-priorities/ui/control-panel/priorities" $mode="block"/>');
	const optTexts = (function g(n, acc) { if (!n || typeof n !== "object") return acc; if (Array.isArray(n)) { n.forEach(x => g(x, acc)); return acc; }
		if (n.tag === "option") acc.push(textAll(n.children)); if (n.children) g(n.children, acc); return acc; })(sel2.children, []);
	t("empty Name falls back to the letter", JSON.stringify(optTexts) === JSON.stringify(["– none –", "Urgent", "B", "Low"]), JSON.stringify(optTexts));
	const GV = '<$importvariables filter="[[$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[$:/tags/Global/View]!is[draft]]">';
	const rowB = renderT('<$tiddler tiddler="ZZ row action">' + GV + '\n\n<$transclude $variable="hgsd-item"/>\n\n</$importvariables></$tiddler>');
	t("row select short label unaffected by an empty Name", (function g(n) { if (!n || typeof n !== "object") return false; if (Array.isArray(n)) { for (const x of n) { if (g(x)) return true; } return false; }
		if (n.tag === "select") { const o = (function h(m) { if (!m || typeof m !== "object") return []; if (Array.isArray(m)) { const a = []; m.forEach(x => { a.push(...h(x)); }); return a; } if (m.tag === "option") return [m]; return h(m.children); })(n.children); return o.some(x => (x.attributes.value === "B") && textAll(x.children) === "M"); } return g(n.children); })(rowB.children), "short label broke");
	wiki.deleteTiddler("$:/language/hypergsd/Lists/Priorities/Name/A");
	wiki.deleteTiddler("$:/language/hypergsd/Lists/Priorities/Name/B");
}

// cleanup
["ZZ prio action", "ZZ prio contact", "ZZ A1", "ZZ B1", "ZZ C1", "ZZ N1", "ZZ new action", "ZZ new project", "ZZ new contact", "ZZ new two", "ZZ new three", "$:/config/hypergsd/priorities/default", "ZZ parent project", "ZZ plain project", "ZZ odd project", "ZZ under one", "ZZ under two", "ZZ under three", "ZZ under four", "ZZ row action", "ZZ row contact", "ZZ row done"].forEach(x => wiki.deleteTiddler(x));
console.log(fails === 0 ? "ALL PRIORITY CASES PASS" : fails + " FAILURE(S)");
process.exit(fails === 0 ? 0 : 1);