// panel-link stamp: a pick row's plain new-button stamps the row's write shape
// onto $:/temp/gsd-new-state at click; the AfterCreation panel-link rule performs
// the kind-mapped write for modal creations. Covers the four panel surfaces, the
// blank-stamp reset, in-modal type switching and the stale-stamp source gate.
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-wiki"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;
fd.fakeDocument.createElement("div").constructor.prototype.getBoundingClientRect = function() { return {top:0,left:0,bottom:0,right:0,width:0,height:0}; };

wiki.addTiddler({title: "Host action", tags: ["$:/GSD/Action", "$:/GSD/Realm/Home"], gsd_status: "next", gsd_complete: "false"});
wiki.addTiddler({title: "Host project", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "false"});
wiki.addTiddler({title: "Old dep", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false"});

const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';
let strays = 0;

const render = (src, cur) => {
  const parser = wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + src + "\n\n</$importvariables>");
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: cur}});
  const c = doc.createElement("div"); w.render(c);
  (function f(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(f);
    if (n.isTiddlyWikiFakeDom) return (n.children || []).forEach(f);
    if ((n.textContent || "").trim() === ">") strays++;
  })(c);
  return w;
};

const fireActions = (wid) => { wid.invokeActions(wid, {type: "click"}); };

// the plain new fallback's button: a $button whose parse-tree children carry the tm-modal sendmessage
const findNewButton = (w) => {
  let found = null;
  (function f(n) {
    if (!n || found || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(f);
    const p = n.parseTreeNode;
    if (p && p.tag === "$button" && (p.children || []).some(ch => ch.tag === "$action-sendmessage" && ch.attributes["$message"] && ch.attributes["$message"].value === "tm-modal")) { found = n; return; }
    (n.children || []).forEach(f);
  })(w.children);
  return found;
};

// the create-and-add button (typed pick), same discovery as create-and-add-test
const findCreateButton = (w) => {
  let found = null;
  (function f(n, btn) {
    if (!n || found || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(x => f(x, btn));
    const p = n.parseTreeNode;
    if (p && p.tag === "$button") btn = n;
    if (p && p.tag === "$action-createtiddler") { if (btn) found = btn; return; }
    (n.children || []).forEach(x => f(x, btn));
  })(w.children, null);
  return found;
};

// capture tm-modal params (the fallback forwards gsd-calling-tiddler through them)
let modalParams = null;
const spyDispatch = $tw.rootWidget.dispatchEvent;
$tw.rootWidget.dispatchEvent = function(event) {
  if (event.type === "tm-modal") modalParams = event.paramObject || {};
  return spyDispatch.call(this, event);
};

// open the fallback from a rendered row: stamps the state temp, returns the modal params
const fireFallback = (src, cur) => {
  modalParams = null;
  fireActions(findNewButton(render(src, cur)));
  return modalParams;
};

// hgsd-modal-submit in its invocation scope (the create-another harness shape)
const submitVia = (caller, type, status, update) => {
  const body = '<$importvariables filter="[[$:/plugins/yan/hypergsd/ui/new-gsd-modal]]">'
    + '<$let new-data-title="$:/temp/gsd-new-temp" new-state="$:/temp/gsd-new-state" gsd-type="' + type + '" gsd-status="' + status + '" gsd-complete="false" gsd-project="" gsd-contact="" gsd-update-status="' + (update || "no") + '" gsd-calling-tiddler="' + caller + '">'
    + '<$button><$transclude $variable="hgsd-modal-submit" /></$button>'
    + '</$let></$importvariables>';
  const w = render(body, caller);
  let btn = null;
  (function f(n) { if (!n || btn || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(f);
    if (n.parseTreeNode && n.parseTreeNode.tag === "$button") { btn = n; return; } (n.children || []).forEach(f); })(w.children);
  fireActions(btn);
};

const resetHost = () => wiki.addTiddler({title: "Host action", tags: ["$:/GSD/Action", "$:/GSD/Realm/Home"], gsd_status: "next", gsd_complete: "false", gsd_prerequisites: "[[Old dep]]"});
const stateFields = () => (wiki.getTiddler("$:/temp/gsd-new-state") || {fields: {}}).fields;
const cleanTemps = () => ["$:/temp/gsd-new-state", "$:/temp/gsd-new-temp", "$:/temp/gsd-new-title"].forEach(x => wiki.deleteTiddler(x));

let fails = 0;
const t = (name, ok, extra) => { if (Array.isArray(ok)) ok = JSON.stringify(ok) === JSON.stringify(extra); if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + name + (ok || extra === undefined ? "" : " " + extra)); };

// 1. Project field on an action page ("Of project:"): the created project becomes the action's gsd_project
resetHost();
const projSrc = '<$hgsd.pick-field field="gsd_project" list-filter="[all[tiddlers]tag[$:/GSD/Project]gsd_complete[false]]" id="project" new-type="project" new-status="active" />';
let params = fireFallback(projSrc, "Host action");
t("project row: stamp kind/field/type", [stateFields()["hgsd-link-kind"], stateFields()["hgsd-link-field"], stateFields()["hgsd-link-type"]], ["field", "gsd_project", "project"]);
t("project row: row target forwarded as calling tiddler", params && params["gsd-calling-tiddler"], "Host action");
wiki.addTiddler({title: "$:/temp/gsd-new-title", "hgsd-title": "Fresh Parent"});
wiki.addTiddler({title: "$:/temp/gsd-new-temp"});
submitVia("Host action", "project", "active");
t("project row: host gains the created project", wiki.getTiddler("Host action").fields.gsd_project, "Fresh Parent");
t("project row: created carries the project tag", ((wiki.getTiddler("Fresh Parent") || {fields: {tags: []}}).fields.tags || []).indexOf("$:/GSD/Project") !== -1);
wiki.deleteTiddler("Fresh Parent"); cleanTemps();

// 2. Project field on a project page ("Sub-project of:"): the created project becomes the current project's parent
params = fireFallback(projSrc, "Host project");
t("subproject row: stamp field/gsd_project/project", [stateFields()["hgsd-link-kind"], stateFields()["hgsd-link-field"], stateFields()["hgsd-link-type"]], ["field", "gsd_project", "project"]);
t("subproject row: target is the viewed project", params && params["gsd-calling-tiddler"], "Host project");
wiki.addTiddler({title: "$:/temp/gsd-new-title", "hgsd-title": "Fresh Grandparent"});
wiki.addTiddler({title: "$:/temp/gsd-new-temp"});
submitVia("Host project", "project", "active");
t("subproject row: viewed project gains the created parent", wiki.getTiddler("Host project").fields.gsd_project, "Fresh Grandparent");
wiki.deleteTiddler("Fresh Grandparent"); cleanTemps();
wiki.addTiddler({title: "Host project", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "false"});

// 3. Depends on (direction own): the created action is appended to the calling action's list, no inverted link
resetHost();
const prereqSrc = '<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/panel/prereq" />';
params = fireFallback(prereqSrc, "Host action");
t("depends-on row: stamp own/gsd_prerequisites/action", [stateFields()["hgsd-link-kind"], stateFields()["hgsd-link-field"], stateFields()["hgsd-link-type"]], ["own", "gsd_prerequisites", "action"]);
wiki.addTiddler({title: "$:/temp/gsd-new-title", "hgsd-title": "Fresh Blocker"});
wiki.addTiddler({title: "$:/temp/gsd-new-temp"});
submitVia("Host action", "action", "next");
t("depends-on row: created appended to the calling action's list",
  JSON.stringify($tw.wiki.getTiddlerList("Host action", "gsd_prerequisites")), JSON.stringify(["Old dep", "Fresh Blocker"]));
t("depends-on row: NO inverted link on the created action", JSON.stringify($tw.wiki.getTiddlerList("Fresh Blocker", "gsd_prerequisites")), JSON.stringify([]));
wiki.deleteTiddler("Fresh Blocker"); cleanTemps(); resetHost();

// 4. Prerequisite of (direction item): the created action gains the calling action as prerequisite
const depSrc = '<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/panel/dependants" />';
params = fireFallback(depSrc, "Host action");
t("prereq-of row: stamp item/gsd_prerequisites/action", [stateFields()["hgsd-link-kind"], stateFields()["hgsd-link-field"], stateFields()["hgsd-link-type"]], ["item", "gsd_prerequisites", "action"]);
wiki.addTiddler({title: "$:/temp/gsd-new-title", "hgsd-title": "Fresh Dependant"});
wiki.addTiddler({title: "$:/temp/gsd-new-temp"});
submitVia("Host action", "action", "future");
t("prereq-of row: created gains the calling action", JSON.stringify($tw.wiki.getTiddlerList("Fresh Dependant", "gsd_prerequisites")), JSON.stringify(["Host action"]));
t("prereq-of row: calling action's own list untouched", JSON.stringify($tw.wiki.getTiddlerList("Host action", "gsd_prerequisites")), JSON.stringify(["Old dep"]));
wiki.deleteTiddler("Fresh Dependant"); cleanTemps(); resetHost();

// 5. Contact field (rule retired): the created contact lands on the action and the caller flips to waiting
const contactSrc = '<$hgsd.pick-field field="gsd_contact" list-filter="[all[tiddlers]tag[$:/GSD/Contact]]" id="contact" new-type="contact" new-status="next" new-update-status="true" />';
params = fireFallback(contactSrc, "Host action");
t("contact row: stamp field/gsd_contact/contact", [stateFields()["hgsd-link-kind"], stateFields()["hgsd-link-field"], stateFields()["hgsd-link-type"]], ["field", "gsd_contact", "contact"]);
wiki.addTiddler({title: "$:/temp/gsd-new-title", "hgsd-title": "Fresh Person"});
wiki.addTiddler({title: "$:/temp/gsd-new-temp"});
submitVia("Host action", "contact", "next", "true");
t("contact row: host gains the created contact (no delegation rule needed)", wiki.getTiddler("Host action").fields.gsd_contact, "Fresh Person");
t("contact row: caller flipped to waiting", wiki.getTiddler("Host action").fields.gsd_status, "waiting");
wiki.deleteTiddler("Fresh Person"); cleanTemps(); resetHost();

// 6. A non-pick button overwrites the stamp with blanks (cancel-then-sidebar can never fire a stale link)
const plainSrc = '<$hgsd.new-button gsd-type="action" gsd-status="next" gsd-complete="false" />';
fireActions(findNewButton(render(plainSrc, "$:/SiteTitle")));
t("plain button: stamp kind/field blanked", [stateFields()["hgsd-link-kind"], stateFields()["hgsd-link-field"]], ["", ""]);
t("plain button: type stamps from gsd-type", stateFields()["hgsd-link-type"], "action");
wiki.addTiddler({title: "$:/temp/gsd-new-title", "hgsd-title": "Sidebar Made"});
wiki.addTiddler({title: "$:/temp/gsd-new-temp"});
submitVia("", "action", "next");
t("plain button: modal creation links nothing", wiki.getTiddler("Host action").fields.gsd_project === undefined && JSON.stringify($tw.wiki.getTiddlerList("Host action", "gsd_prerequisites")) === JSON.stringify(["Old dep"]));
wiki.deleteTiddler("Sidebar Made"); cleanTemps();

// 7. Type switched in-modal: the origin-type gate skips the write
resetHost();
fireFallback(projSrc, "Host action");
wiki.addTiddler(new $tw.Tiddler(wiki.getTiddler("$:/temp/gsd-new-state"), {"hgsd-type": "contact"}));
wiki.addTiddler({title: "$:/temp/gsd-new-title", "hgsd-title": "Switched Contact"});
wiki.addTiddler({title: "$:/temp/gsd-new-temp"});
submitVia("Host action", "contact", "next");
t("type switch: created, but no link write", !!wiki.getTiddler("Switched Contact") && wiki.getTiddler("Host action").fields.gsd_project === undefined);
wiki.deleteTiddler("Switched Contact"); cleanTemps(); resetHost();

// 8. Source gate: a picker creation ignores a stale stamp left by a cancelled modal
wiki.addTiddler({title: "$:/temp/gsd-new-state", "hgsd-type": "action", "hgsd-link-kind": "item", "hgsd-link-field": "gsd_prerequisites", "hgsd-link-type": "action"});
const PREREQTEMP = "$:/temp/hypergsd/add-prereq-Host action";
wiki.addTiddler({title: PREREQTEMP, "hgsd-pick": "Core Made Dep"});
const pickerBtn = findCreateButton(render(prereqSrc, "Host action"));
if (pickerBtn) fireActions(pickerBtn);
t("stale stamp: picker write still lands on the calling list",
  JSON.stringify($tw.wiki.getTiddlerList("Host action", "gsd_prerequisites")), JSON.stringify(["Old dep", "Core Made Dep"]));
t("stale stamp: rule did not fire on the picker path (no inverted link)", JSON.stringify($tw.wiki.getTiddlerList("Core Made Dep", "gsd_prerequisites")), JSON.stringify([]));
wiki.deleteTiddler("Core Made Dep"); wiki.deleteTiddler(PREREQTEMP); cleanTemps();

$tw.rootWidget.dispatchEvent = spyDispatch;
console.log(fails === 0 ? "ALL PANEL-LINK CASES PASS" : fails + " FAILURES");
console.log(strays === 0 ? "STRAY GUARD: 0 across all renders" : "STRAY GUARD FAILED: " + strays);
process.exit(fails === 0 && strays === 0 ? 0 : 1);
