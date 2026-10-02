// Completion warning: tag list-gated confirm modal before completing.
// Covers the gate (blocked click writes nothing but the checkbox-reset),
// the confirm action (complete + close + still-incomplete guard), the modal
// body render (tripping members label + link their conditions output), and
// the list-field +/- API (removal retires the built-in; a custom member
// trips; a conditions-less member is inert).
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-wiki"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;

const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';
let fails = 0;
const t = (name, got, exp) => {
  const ok = JSON.stringify(got) === JSON.stringify(exp);
  if (!ok) fails++;
  console.log((ok ? "PASS " : "FAIL ") + name + " got:" + JSON.stringify(got));
};

// Click dispatch: $button wrapping the handler with the dom-data contract
// variables $let into scope, invoked like a real click.
let modalOpened = null, modalHost = null, closes = 0;
$tw.rootWidget.addEventListener("tm-modal", e => { modalOpened = e.param; modalHost = e.paramObject && e.paramObject["hgsd-host"]; });
$tw.rootWidget.addEventListener("tm-close-tiddler", () => { closes++; });
const fireClick = (action, tiddler) => {
  modalOpened = null; modalHost = null;
  const body = '<$button><$let dom-data-tiddler="' + tiddler + '" dom-data-hgsd-action="' + action + '">'
    + '<$transclude $variable="hgsd-handle-click"/></$let></$button>';
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + body + "\n\n</$importvariables>"), {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c);
  let btn = null;
  (function f(n) { if (!n || btn || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(f);
    if (n.parseTreeNode && n.parseTreeNode.tag === "$button") { btn = n; return; } (n.children || []).forEach(f); })(w.children);
  btn.invokeActions(btn, {type: "click"});
};

// Modal body render: transclude the modal with hgsd-host set, collect the
// tag+text of paragraphs/bullets/links/labels/buttons in list-field tag-list order.
const renderModal = (host) => {
  const src = G + '\n\n<$set name="hgsd-host" value="' + host + '"><$transclude $tiddler="$:/plugins/yan/hypergsd/ui/complete-warning-modal" $mode="block"/></$set>\n\n</$importvariables>';
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", src), {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c);
  const nodes = [];
  (function f(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(f);
    if (n.isTiddlyWikiFakeDom && ["p", "a", "button", "li", "span", "br"].includes(n.tag)) nodes.push({tag: n.tag, text: n.textContent, cls: (n.attributes && n.attributes["class"]) || ""});
    (n.children || []).forEach(f);
  })(c);
  return nodes;
};

// Fixtures: P has open + completed children of both kinds, a foreign action,
// and a reference (type-filtered out).
wiki.addTiddler({title: "Warn project", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "false"});
wiki.addTiddler({title: "Open action", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_project: "Warn project"});
wiki.addTiddler({title: "Done action", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "true", gsd_comp_date: "20260101000000000", gsd_project: "Warn project"});
wiki.addTiddler({title: "Open sub-project", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "false", gsd_project: "Warn project"});
wiki.addTiddler({title: "Done sub-project", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "true", gsd_comp_date: "20260101000000000", gsd_project: "Warn project"});
wiki.addTiddler({title: "Foreign project", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "false"});
wiki.addTiddler({title: "Other action", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_project: "Foreign project"});
wiki.addTiddler({title: "Under-project reference", tags: ["$:/GSD/Reference"], gsd_project: "Warn project"});
const modifiedBefore = wiki.getTiddler("Warn project").fields.modified;

// 1. Blocked click: nothing written (but the identical-value checkbox-reset),
//    no comp date, timestamp untouched, modal dispatched with the host.
fireClick("complete", "Warn project");
t("blocked: fields untouched", wiki.getTiddler("Warn project").fields.gsd_complete, "false");
t("blocked: no comp date", wiki.getTiddler("Warn project").fields.gsd_comp_date, undefined);
t("blocked: reset write left modified alone", String(wiki.getTiddler("Warn project").fields.modified), String(modifiedBefore));
t("blocked: modal dispatched with host", [modalOpened, modalHost], ["$:/plugins/yan/hypergsd/ui/complete-warning-modal", "Warn project"]);

// 2. Modal body: confirmation question, per-member message bullets, plain-text
//    relevant-tiddlers lead-in, open children linked; completed, foreign and
//    reference children excluded; one separator br between the two links and
//    none before the button; Complete-anyway present, Cancel gone (closing
//    rides the modal chrome).
const bodyNodes = renderModal("Warn project");
const bodyLines = bodyNodes.map(x => x.text);
t("modal: header lingo names the action",
  wiki.getTiddlerText("$:/language/hypergsd/Sections/Complete/Warning/Subtitle"), "Mark item as complete");
t("modal: question + bulleted messages + lead-in + open items + button",
  [bodyLines.includes("Are you sure you want to mark this item as complete?"),
   bodyNodes.some(x => x.tag === "li" && x.text === "There are incomplete actions"),
   bodyNodes.some(x => x.tag === "li" && x.text === "There are incomplete sub-projects"),
   bodyLines.some(l => l.includes("The following")),
   bodyLines.includes("Relevant tiddlers:"),
   bodyNodes.filter(x => x.tag === "span" && x.cls === "gsd-muted").length,
   bodyNodes.filter(x => x.tag === "br").length,
   bodyLines.includes("Open action"), bodyLines.includes("Open sub-project"),
   bodyLines.some(l => l.includes("Done action")), bodyLines.some(l => l.includes("Done sub-project")),
   bodyLines.some(l => l.includes("Other action")), bodyLines.some(l => l.includes("reference")),
   bodyLines.includes("Complete anyway"), bodyLines.includes("Cancel")],
  [true, true, true, false, true, 0, 1, true, true, false, false, false, false, true, false]);

// 3. Confirm: completes, dates, closes; the open child is not touched.
const closesBefore = closes;
fireClick("complete-confirmed", "Warn project");
t("confirmed: completed + dated", [wiki.getTiddler("Warn project").fields.gsd_complete, !!wiki.getTiddler("Warn project").fields.gsd_comp_date], ["true", true]);
t("confirmed: modal closed", closes > closesBefore, true);
t("confirmed: children untouched", wiki.getTiddler("Open action").fields.gsd_complete, "false");

// 4. Still-incomplete guard: do-complete TOGGLES, so a stacked confirm must
//    no-op on an already-complete host.
fireClick("complete-confirmed", "Warn project");
t("double-confirm guard: stays complete", wiki.getTiddler("Warn project").fields.gsd_complete, "true");

// 5. Childless project completes directly, no modal.
wiki.addTiddler({title: "Quiet project", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "false"});
fireClick("complete", "Quiet project");
t("childless: completes directly", [wiki.getTiddler("Quiet project").fields.gsd_complete, modalOpened], ["true", null]);

// 6. Action host: built-in conditions return nothing, so completing an
//    action goes straight through — and still promotes future dependants.
wiki.addTiddler({title: "Lone action", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false"});
wiki.addTiddler({title: "Waiting dependant", tags: ["$:/GSD/Action"], gsd_status: "future", gsd_complete: "false", gsd_prerequisites: "[[Lone action]]"});
fireClick("complete", "Lone action");
t("action host: completes, no modal", [wiki.getTiddler("Lone action").fields.gsd_complete, modalOpened], ["true", null]);
t("action host: dependant promoted", wiki.getTiddler("Waiting dependant").fields.gsd_status, "next");

// 7. Un-completing never warns: the date write is the pre-existing
//    then[]-empty-string (not field removal), no modal.
fireClick("complete", "Warn project");
t("un-complete: cleared + no modal",
  [wiki.getTiddler("Warn project").fields.gsd_complete, wiki.getTiddler("Warn project").fields.gsd_comp_date, modalOpened],
  ["false", "", null]);

// 8. List-field removal retires the shipped built-in.
wiki.addTiddler({title: "Warn project 2", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "false", gsd_project: "Warn project"});
wiki.addTiddler({title: "$:/tags/hypergsd/Complete/Warning", list: []});
fireClick("complete", "Warn project 2");
t("list-field removal: warning retired", [wiki.getTiddler("Warn project 2").fields.gsd_complete, modalOpened], ["true", null]);
wiki.deleteTiddler("$:/tags/hypergsd/Complete/Warning");

// 9. Custom member: trips where the built-in does not, lingo fallback to the
//    raw warning key, conditions output linked.
wiki.addTiddler({title: "My custom warning", tags: ["$:/tags/hypergsd/Complete/Warning"], "hgsd-conditions": "[<host-title>get[gsd_contact]!match[]]", "hgsd-warning": "HasContact"});
wiki.addTiddler({title: "$:/tags/hypergsd/Complete/Warning", list: ["$:/plugins/yan/hypergsd/modules/complete-warnings/open-actions", "My custom warning"]});
wiki.addTiddler({title: "Contacted project", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "false", gsd_contact: "Alice C"});
fireClick("complete", "Contacted project");
t("custom member: trips", [wiki.getTiddler("Contacted project").fields.gsd_complete, modalOpened], ["false", "$:/plugins/yan/hypergsd/ui/complete-warning-modal"]);
const customBody = renderModal("Contacted project").map(x => x.text);
t("custom member: fallback label + conditions output linked",
  [customBody.some(l => l.includes("HasContact")), customBody.some(l => l.includes("Alice C"))], [true, true]);

// 10. Conditions-less member is inert.
wiki.deleteTiddler("$:/tags/hypergsd/Complete/Warning");
wiki.deleteTiddler("My custom warning");
wiki.addTiddler({title: "Bare member", tags: ["$:/tags/hypergsd/Complete/Warning"]});
wiki.addTiddler({title: "$:/tags/hypergsd/Complete/Warning", list: ["$:/plugins/yan/hypergsd/modules/complete-warnings/open-children", "Bare member"]});
fireClick("complete", "Contacted project");
t("conditions-less member: inert", [wiki.getTiddler("Contacted project").fields.gsd_complete, modalOpened], ["true", null]);
wiki.deleteTiddler("$:/tags/hypergsd/Complete/Warning");
wiki.deleteTiddler("Bare member");

console.log(fails === 0 ? "ALL COMPLETE-WARNING CASES PASS" : fails + " FAILURE(S)");