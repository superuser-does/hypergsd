// Degradation: HyperGSD WITHOUT the Contacts sub-plugin — every contact surface
// disappears, legacy gsd_contact data stays untouched and unwarned.
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-absent"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;
const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';
let strays = 0, fails = 0;
const t = (name, ok, extra) => { if (Array.isArray(ok)) ok = JSON.stringify(ok) === JSON.stringify(extra); if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + name + (ok || extra === undefined ? "" : " " + extra)); };
const render = (src, cur) => {
  const p = wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + src + "\n\n</$importvariables>");
  const w = wiki.makeWidget(p, {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: cur || "GSD/Test"}});
  const c = doc.createElement("div"); w.render(c);
  (function f(n){ if(!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
    if(n.isTiddlyWikiFakeDom) return (n.children||[]).forEach(f);
    if((n.textContent||"").trim()===">") strays++; })(c);
  let text = ""; (function f(n){ if(!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
    if(n.isTiddlyWikiFakeDom) return (n.children||[]).forEach(f); text += (n.textContent||""); })(c);
  return {w, c, text};
};

// 1. type tag list: contact member gone
t("type tag list has no contact member", wiki.filterTiddlers("[all[shadows+tiddlers]tag[$:/tags/hypergsd/Type]]").indexOf("$:/GSD/Contact") === -1);

// 2. capture sidebar: no new-contact button, but the tag list still renders the
//    four main entries (sub-plugin member drops out structurally)
wiki.addTiddler({title: "Host", text: "x"});
const cap = render('<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/sidebar/capture-sidebar"/>');
t("capture sidebar hides the new-contact entry", cap.text.indexOf("new contact") === -1, cap.text.slice(0, 80));
t("capture sidebar keeps the main entries", ["new action", "new project", "Default realm:"]
  .every(s => cap.text.indexOf(s) !== -1));

// 3. modal: no contact section; creation of an action works without it
t("modal sections have no contact", wiki.filterTiddlers("[all[shadows+tiddlers]tag[$:/tags/hypergsd/ModalTemplate]]")
  .every(x => x.indexOf("contact") === -1));

// 4. waiting page: flat waiting list is the default (by-contact moved with its seeds)
wiki.addTiddler({title: "A wait", tags: ["$:/GSD/Action"], gsd_status: "waiting", gsd_complete: "false"});
const waiting = render('<$transclude $tiddler="GSD/Actions waiting"/>');
t("waiting page shows the flat list by default", waiting.text.indexOf("Waiting actions") !== -1 && waiting.text.indexOf("By Contact") === -1);

// 5. convert: legacy gsd_contact data produces NO contact warning
wiki.addTiddler({title: "Legacy action", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_contact: "Ghost"});
let message = "(none)";
const conv = render('<$hgsd.convert current-status={{!!gsd_status}}/>', "Legacy action");
let btn = null;
(function f(n){ if(!n||btn||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
  const pt = n.parseTreeNode;
  if(pt && pt.tag === "$button" && (pt.children||[]).some(x => x.tag === "$action-confirm")) { btn = n; return; }
  (n.children||[]).forEach(f); })(conv.w.children);
if (btn) btn.invokeActions(btn, {type: "click", event: {view: {confirm: m => { message = m; return true; }}}});
t("convert message has no contact warning (fragment absent)", message === "Convert this action into a project?", message);
t("convert still succeeds on legacy action", wiki.getTiddler("Legacy action").fields.tags.indexOf("$:/GSD/Project") !== -1);
t("legacy gsd_contact untouched by conversion", wiki.getTiddler("Legacy action").fields.gsd_contact === "Ghost");

// 6. main dashboard: contacts list gone
const dash = render('<$transclude $tiddler="GSD/Dashboard"/>');
t("main dashboard has no Contacts list", dash.text.indexOf("Contacts") === -1);

// 7. settings: no Contacts tab; the Lists sub-tab carries project view + dashboards + fragments
t("settings tabs: core only (Behaviour, Panel and modal, View placement, Lists, Sidebar, Colours) when sub-plugins are absent", wiki.filterTiddlers("[all[shadows+tiddlers]tag[$:/tags/hypergsd/Settings]]").length === 6);
t("Lists sub-tab carries exactly project view, dashboards and fragments", (() => {
  const members = wiki.filterTiddlers("[all[shadows+tiddlers]tag[$:/tags/hypergsd/Settings/Lists]]").sort();
  return members.length === 3 &&
    members.indexOf("$:/plugins/yan/hypergsd/ui/control-panel/project-view") !== -1 &&
    members.indexOf("$:/plugins/yan/hypergsd/ui/control-panel/dashboards") !== -1 &&
    members.indexOf("$:/plugins/yan/hypergsd/ui/control-panel/fragments") !== -1;
})());
t("settings tabs have no Ticklers page", wiki.filterTiddlers("[all[shadows+tiddlers]tag[$:/tags/hypergsd/Settings]]")
  .every(x => x.indexOf("hypergsd-ticklers") === -1));

// 6. Contexts sub-plugin absent: type member, page, capture members, modal section, review link, view template, CSS
t("type tag list has no context member", wiki.filterTiddlers("[all[shadows+tiddlers]tag[$:/tags/hypergsd/Type]]").indexOf("GSD/Contexts") === -1);
t("GSD/Contexts page absent", !wiki.getTiddler("GSD/Contexts"));
const capCtx = render('<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/sidebar/capture-sidebar"/>');
t("capture sidebar hides the new-context entry", capCtx.text.indexOf("new context") === -1);
t("capture sidebar has no Default context line", ["Default context:", "Default realm:", "new action", "new project"]
  .map(x => capCtx.text.indexOf(x) !== -1), [false, true, true, true]);
t("modal sections have no context", wiki.filterTiddlers("[all[shadows+tiddlers]tag[$:/tags/hypergsd/ModalTemplate]]")
  .every(x => x.indexOf("modal/context") === -1));
const review = render('<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/sidebar/review-sidebar"/>');
t("review sidebar hides the Contexts link", review.text.indexOf("Contexts") === -1);
t("main stylesheet has no context rules", (wiki.getTiddlerText("$:/plugins/yan/hypergsd/ui/stylesheet/stylesheet") || "").indexOf("context-view-template") === -1);
// a user tiddler still carrying the context tag renders NO context view template
wiki.addTiddler({title: "Orphan context", tags: ["GSD/Contexts"], gsd_status: "next"});
const ctxView = render('<$tiddler tiddler="Orphan context"><$transclude $tiddler="$:/core/ui/ViewTemplate/body" $mode="block"/></$tiddler>');
t("context-tagged tiddler renders no context view", ctxView.text.indexOf("HyperGSD context") === -1);
wiki.deleteTiddler("Orphan context");
// and the type tag list offers no context type
t("type tag list has no context type", wiki.filterTiddlers("[all[shadows+tiddlers]tag[$:/tags/hypergsd/Type]]")
  .every(x => (wiki.getTiddler(x) || {fields: {}}).fields["hgsd-type"] !== "context"));

// 8. Ticklers sub-plugin absent: modal/panel sections, row suffix, review link,
// page, snooze tag list, Field Editor Cascade members
t("modal sections have no tickler", wiki.filterTiddlers("[all[shadows+tiddlers]tag[$:/tags/hypergsd/ModalTemplate]]")
  .every(x => x.indexOf("hypergsd-ticklers") === -1));
t("panel sections have no tickler", wiki.filterTiddlers("[all[shadows+tiddlers]tag[$:/tags/hypergsd/PanelTemplate]]")
  .every(x => x.indexOf("hypergsd-ticklers") === -1));
t("row suffixes have no tickler", wiki.filterTiddlers("[all[shadows+tiddlers]tag[$:/tags/hypergsd/ListItem/Suffix]]")
  .every(x => x.indexOf("hypergsd-ticklers") === -1));
t("GSD/Ticklers page absent", !wiki.getTiddler("GSD/Ticklers"));
const reviewTk = render('<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/sidebar/review-sidebar"/>');
t("review sidebar hides the Ticklers link", reviewTk.text.indexOf("Ticklers") === -1);
t("no snooze tag list", wiki.filterTiddlers("[all[shadows+tiddlers]tag[$:/tags/hypergsd/Ticklers/Snooze]]").length === 0);
t("no Global-tagged tickler members", wiki.filterTiddlers("[all[shadows+tiddlers]tag[$:/tags/Global]]")
  .every(x => x.indexOf("hypergsd-ticklers") === -1));
t("no tickler type in the type tag list", wiki.filterTiddlers("[all[shadows+tiddlers]tag[$:/tags/hypergsd/Type]]")
  .every(x => (wiki.getTiddler(x) || {fields: {}}).fields["hgsd-type"] !== "tickler"));
// an action with GSD5-era tickler fields renders an untouched plain row
wiki.addTiddler({title: "Orphan tickler", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_tickler_date: "20300101000000000"});
const orphanRow = render('<$tiddler tiddler="Orphan tickler"><$transclude $tiddler="$:/plugins/yan/hypergsd/ui/list-items/tickler" $mode="block"/></$tiddler>');
t("tickler suffix transclude of an absent plugin renders nothing", orphanRow.text.trim() === "");
wiki.deleteTiddler("Orphan tickler");

// 9. References sub-plugin absent: type member, page, capture button, review
//    link, project-view section, settings page, Global/View component
t("type tag list has no reference member", wiki.filterTiddlers("[all[shadows+tiddlers]tag[$:/tags/hypergsd/Type]]").indexOf("$:/GSD/Reference") === -1);
t("GSD/References page absent", !wiki.getTiddler("GSD/References"));
const capRef = render('<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/sidebar/capture-sidebar"/>');
t("capture sidebar hides the new-reference entry", capRef.text.indexOf("new reference") === -1);
const reviewRef = render('<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/sidebar/review-sidebar"/>');
t("review sidebar hides the References link", reviewRef.text.indexOf("References") === -1);
// a project renders without the References section even though core transcludes the template path
wiki.addTiddler({title: "Orphan project", tags: ["$:/GSD/Project"], gsd_status: "active"});
wiki.addTiddler({title: "Orphan ref", tags: ["$:/GSD/Reference"], gsd_project: "Orphan project"});
const projView = render('<$tiddler tiddler="Orphan project"><$transclude $tiddler="$:/plugins/yan/hypergsd/ui/ViewTemplate/view-body-project" $mode="block"/></$tiddler>', "Orphan project");
t("project view hides the References section", projView.text.indexOf("References") === -1);
t("project view hides the orphan reference", projView.text.indexOf("Orphan ref") === -1);
t("settings tabs have no References page", wiki.filterTiddlers("[all[shadows+tiddlers]tag[$:/tags/hypergsd/Settings]]")
  .every(x => x.indexOf("hypergsd-references") === -1));
t("no Lists/Reference members", wiki.filterTiddlers("[all[shadows+tiddlers]tag[$:/tags/hypergsd/Lists/Reference]]").length === 0);
wiki.deleteTiddler("Orphan ref");
wiki.deleteTiddler("Orphan project");

console.log(fails === 0 ? "ALL ABSENT CASES PASS" : fails + " FAILURES");
console.log(strays === 0 ? "STRAY GUARD: 0 across all renders" : "STRAY GUARD FAILED: " + strays);
process.exit(fails === 0 && strays === 0 ? 0 : 1);