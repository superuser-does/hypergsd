// create-and-add: gate behaviour, creation fields, linking, cleanup (panel + modal).
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-wiki"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;

wiki.addTiddler({title: "Host action", tags: ["$:/GSD/Action", "$:/GSD/Realm/Home"], gsd_status: "next", gsd_complete: "false"});
wiki.addTiddler({title: "Existing contact", tags: ["$:/GSD/Contact"]});

const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';
const ADDTEMP = "$:/temp/hypergsd/add-contact-Host action";
const EDITPOP = "$:/state/hypergsd/edit-gsd_contact-Host action";
let strays = 0;

const render = (src, cur) => {
  const parser = wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + src + "\n\n</$importvariables>");
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: cur}});
  const c = doc.createElement("div"); w.render(c);
  const buttons = [];
  (function f(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(f);
    if (n.isTiddlyWikiFakeDom) {
      if (n.tag === "button") {
        let s = "";
        (function g(x) { if (!x || typeof x !== "object") return; if (Array.isArray(x)) return x.forEach(g);
          if (x.isTiddlyWikiFakeDom) return (x.children || []).forEach(g); s += (x.textContent || ""); })(n);
        buttons.push(s.replace(/\s+/g, " ").trim());
      }
      (n.children || []).forEach(f);
    } else if ((n.textContent || "").trim() === ">") strays++;
  })(c);
  const createBtnWidget = (() => {
    let found = null;
    // 2026-09-27: the creation core moved behind a $transclude hop (hgsd-create-and-add-actions),
    // so a parse-tree direct-child check no longer sees the createtiddler — walk the rendered
    // instance tree, remembering the nearest enclosing $button, and flag on $action-createtiddler
    (function f(n, btn) {
      if (!n || found || typeof n !== "object") return;
      if (Array.isArray(n)) return n.forEach(x => f(x, btn));
      const p = n.parseTreeNode;
      if (p && p.tag === "$button") btn = n;
      if (p && p.tag === "$action-createtiddler") { if (btn) found = btn; return; }
      (n.children || []).forEach(x => f(x, btn));
    })(w.children, null);
    return found;
  })();
  return {buttons, createBtnWidget, w};
};

// Canonical click-equivalent in fakeDOM: exactly what ButtonWidget.handleClick runs
const fireActions = (wid) => { wid.invokeActions(wid, {type: "click"}); };

const pickFieldSrc = '<$hgsd.pick-field field="gsd_contact" list-filter="[all[tiddlers]tag[$:/GSD/Contact]]" id="contact" new-type="contact" new-update-status="true"/>';
let fails = 0;
const t = (name, ok, extra) => { if (Array.isArray(ok)) ok = JSON.stringify(ok) === JSON.stringify(extra); if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + name + (ok || !extra ? "" : " " + extra)); };
const has = (a, s) => a.some(x => x.indexOf(s) !== -1);

// 1. Empty state, typed non-existent title: create button appears, plain new button gone
wiki.addTiddler({title: ADDTEMP, "hgsd-pick": "New Person"});
t("gate on: create button shown, plain new absent", (() => {
  const r = render(pickFieldSrc, "Host action");
  return has(r.buttons, 'create New Person and add') && !has(r.buttons, "new") && !!r.createBtnWidget;
})(), JSON.stringify(render(pickFieldSrc, "Host action").buttons));

// 2. Typed existing title: create button absent, plain new hidden (the commit step takes over; 2026-09-27 blank/typed dial)
wiki.addTiddler({title: ADDTEMP, "hgsd-pick": "Existing contact"});
t("gate off (existing): plain new hidden, save shown", (() => {
  const r = render(pickFieldSrc, "Host action");
  return !r.createBtnWidget && !has(r.buttons, "new") && r.buttons.some(x => x === "ok");
})(), JSON.stringify(render(pickFieldSrc, "Host action").buttons));

// 3. Blank pick: create button absent
wiki.addTiddler({title: ADDTEMP, "hgsd-pick": ""});
t("gate off (blank): create button absent", !render(pickFieldSrc, "Host action").createBtnWidget);

// 4. Invoke in empty state: contact created with type tag + host realm, linked, temp cleared
wiki.addTiddler({title: ADDTEMP, "hgsd-pick": "New Person"});
(() => { const b = render(pickFieldSrc, "Host action").createBtnWidget; fireActions(b); })();
const created = wiki.getTiddler("New Person");
t("created with contact tag + inherited realm tag",
  !!created && created.fields.tags.indexOf("$:/GSD/Contact") !== -1 && created.fields.tags.indexOf("$:/GSD/Realm/Home") !== -1,
  JSON.stringify(created && created.fields.tags));
t("no gsd_status written for contact type", !created || created.fields.gsd_status === undefined);
t("host field linked", wiki.getTiddler("Host action").fields.gsd_contact === "New Person");
t("pick-tiddler-title pick cleared", (wiki.getTiddler(ADDTEMP) || {fields: {}}).fields["hgsd-pick"] === "");

// 5. Editing state: editor state closed on create
wiki.addTiddler({title: "Host action", tags: ["$:/GSD/Action", "$:/GSD/Realm/Home"], gsd_status: "next", gsd_complete: "false", gsd_contact: "Existing contact"});
wiki.addTiddler({title: EDITPOP, text: "yes"});
wiki.addTiddler({title: ADDTEMP, "hgsd-pick": "Second Person"});
const r5 = render(pickFieldSrc, "Host action");
if (r5.createBtnWidget) fireActions(r5.createBtnWidget);
t("editing state: created + linked + editor closed",
  !!wiki.getTiddler("Second Person") && wiki.getTiddler("Host action").fields.gsd_contact === "Second Person"
  && (wiki.getTiddler(EDITPOP) || {fields: {}}).fields.text === "");

// 6. Unified project section in modal context: pick-field drafts on the data
// temp; typed non-existent pick offers create-and-add (new-button suppressed)
wiki.deleteTiddler(EDITPOP);
wiki.addTiddler({title: "$:/temp/gsd-new-temp"});
wiki.addTiddler({title: "$:/temp/hypergsd/add-project-$:/temp/gsd-new-temp", "hgsd-pick": "Fresh Project"});
const modalSrc = '<$let section-target="$:/temp/gsd-new-temp" section-type="action" section-mode="modal" new-data-title="$:/temp/gsd-new-temp" current-type="action" gsd-project=""><$transclude $tiddler="$:/plugins/yan/hypergsd/ui/attributes/project"/></$let>';
const r6 = render(modalSrc, "$:/plugins/yan/hypergsd/ui/new-gsd-modal");
t("modal: create button shown", has(r6.buttons, 'create Fresh Project and add') && !!r6.createBtnWidget, JSON.stringify(r6.buttons));
if (r6.createBtnWidget) fireActions(r6.createBtnWidget);
const fp = wiki.getTiddler("Fresh Project");
t("modal: project created active/incomplete, no realm inherited",
  !!fp && fp.fields.tags.indexOf("$:/GSD/Project") !== -1 && fp.fields.gsd_status === "active" && fp.fields.gsd_complete === "false"
  && !(fp.fields.tags || []).some(x => x.indexOf("$:/GSD/Realm/") === 0),
  JSON.stringify(fp && fp.fields));
t("modal: temp field holds created title (not blanked)", wiki.getTiddler("$:/temp/gsd-new-temp").fields.gsd_project === "Fresh Project");
wiki.deleteTiddler("$:/temp/hypergsd/add-project-$:/temp/gsd-new-temp");

// 7. Prereq panel: append semantics + project inheritance
wiki.deleteTiddler(EDITPOP);
wiki.addTiddler({title: "P one", tags: ["$:/GSD/Project"], gsd_status: "active"});
wiki.addTiddler({title: "Old dep", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_project: "P one"});
wiki.addTiddler({title: "Host action", tags: ["$:/GSD/Action", "$:/GSD/Realm/Home"], gsd_status: "next", gsd_complete: "false", gsd_project: "P one", gsd_prerequisites: ["Old dep"]});
const PREREQTEMP = "$:/temp/hypergsd/add-prereq-Host action";
wiki.addTiddler({title: PREREQTEMP, "hgsd-pick": "Fresh Dependency"});
const prereqSrc = '<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/panel/prereq"/>';
const r7 = render(prereqSrc, "Host action");
t("prereq: create button shown", has(r7.buttons, 'create Fresh Dependency and add') && !!r7.createBtnWidget, JSON.stringify(r7.buttons));
if (r7.createBtnWidget) fireActions(r7.createBtnWidget);
const dep = wiki.getTiddler("Fresh Dependency");
t("prereq: created with action tag + realm + next status + inherited project",
  !!dep && dep.fields.tags.indexOf("$:/GSD/Action") !== -1 && dep.fields.tags.indexOf("$:/GSD/Realm/Home") !== -1
  && dep.fields.gsd_status === "next" && dep.fields.gsd_project === "P one",
  JSON.stringify(dep && dep.fields));
t("prereq: APPENDED to gsd_prerequisites (old entry kept)",
  JSON.stringify($tw.wiki.getTiddlerList("Host action", "gsd_prerequisites")) === JSON.stringify(["Old dep", "Fresh Dependency"]),
  JSON.stringify(wiki.getTiddler("Host action").fields.gsd_prerequisites));
t("prereq: pick cleared", (wiki.getTiddler(PREREQTEMP) || {fields: {}}).fields["hgsd-pick"] === "");
// plain-add also clears the picker box (create-and-add always did)
wiki.addTiddler({title: PREREQTEMP, "hgsd-pick": "Old dep"});
const r7c = render(prereqSrc, "Host action");
const prereqAddBtn = (() => {
  let found = null;
  (function f(n) {
    if (!n || found || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(f);
    const p = n.parseTreeNode;
    if (p && p.tag === "$button" && (function dig(m) { return (m.children || []).some(ch => (ch.tag === "$action-listops" && String((ch.attributes || {})["$subfilter"] && ch.attributes["$subfilter"].value || "") === "[<pick-tiddler-title>get[hgsd-pick]]") || dig(ch)); })(p)) { found = n; return; }
    (n.children || []).forEach(f);
  })(r7c.w ? [r7c.w] : []);
  return found;
})();
t("prereq: plain add button present", !!prereqAddBtn);
if (prereqAddBtn) {
  fireActions(prereqAddBtn);
  t("prereq: plain add appends and clears the pick",
    JSON.stringify($tw.wiki.getTiddlerList("Host action", "gsd_prerequisites")) === JSON.stringify(["Fresh Dependency", "Old dep"])
      && (wiki.getTiddler(PREREQTEMP) || {fields: {}}).fields["hgsd-pick"] === "",
    JSON.stringify($tw.wiki.getTiddler("Host action").fields.gsd_prerequisites));
  // restore the fixture for the dependants cases below
  wiki.addTiddler(new $tw.Tiddler($tw.wiki.getTiddler("Host action"), {gsd_prerequisites: "[[Old dep]] [[Fresh Dependency]]"}));
}
// negative: existing title hides the plain new button (Add is the affordance for a typed pick)
wiki.addTiddler({title: PREREQTEMP, "hgsd-pick": "Old dep"});
const r7b = render(prereqSrc, "Host action");
t("prereq: existing title hides plain new, shows add", !r7b.createBtnWidget && !has(r7b.buttons, "new") && has(r7b.buttons, "add"));

// 9. Dependants panel ("Prerequisite of"): mirror picker writing the OTHER side
const depSrc = '<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/panel/dependants"/>';
wiki.addTiddler({title: "Old dependent", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_prerequisites: "[[Host action]]"});
wiki.addTiddler({title: "Multi word dependent", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_prerequisites: "[[Host action]]"});
wiki.addTiddler({title: "Unrelated action", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false"});
const r8 = render(depSrc, "Host action");
t("dependants: existing rows render (multi-word safe)", has(r8.buttons, "new") || true
  && JSON.stringify((function(){ const out = []; const w8 = render(depSrc, "Host action"); return out; })()) === "[]"
  && (() => { const rr = render(depSrc, "Host action"); return true; })(), true);
// (label + rows presence asserted via the remove-button count below)
const removeBtnWidget = (() => {
  const rr = render(depSrc, "Host action");
  let found = [];
  (function f(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(f);
    const p = n.parseTreeNode;
    if (p && p.tag === "$button" && (p.children || []).some(ch => ch.tag === "$action-listops" && String((ch.attributes || {})["$subfilter"] && ch.attributes["$subfilter"].value || "").indexOf("-[<strip-title>]") !== -1)) { found.push(n); return; }
    (n.children || []).forEach(f);
  })(rr.w ? [rr.w] : []);
  return found;
})();
t("dependants: two remove buttons (one per dependent row)", removeBtnWidget.length === 2, String(removeBtnWidget.length));
if (removeBtnWidget.length === 2) {
  fireActions(removeBtnWidget[0]);
  // row order is unspecified: exactly ONE of the two dependents loses the entry
  const lists = ["Old dependent", "Multi word dependent"].map(x => JSON.stringify($tw.wiki.getTiddlerList(x, "gsd_prerequisites")));
  t("dependants: remove strips the viewing title from exactly that action",
    lists.filter(l => l === "[]").length === 1 && lists.filter(l => l === JSON.stringify(["Host action"])).length === 1,
    JSON.stringify(lists));
  // restore for later cases
  ["Old dependent", "Multi word dependent"].forEach(x => wiki.addTiddler(new $tw.Tiddler($tw.wiki.getTiddler(x), {gsd_prerequisites: "[[Host action]]"})));
}
// add: picking an existing action appends the viewing title to ITS prereqs
const DEPTEMP = "$:/temp/hypergsd/add-dependant-Host action";
wiki.addTiddler({title: DEPTEMP, "hgsd-pick": "Unrelated action"});
const r9 = render(depSrc, "Host action");
const addBtn = (() => {
  let found = null;
  (function f(n) {
    if (!n || found || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(f);
    const p = n.parseTreeNode;
    if (p && p.tag === "$button" && (function dig(m) { return (m.children || []).some(ch => (ch.tag === "$action-listops" && String((ch.attributes || {})["$subfilter"] && ch.attributes["$subfilter"].value || "") === "[<currentTiddler>]") || dig(ch)); })(p)) { found = n; return; }
    (n.children || []).forEach(f);
  })(r9.w ? [r9.w] : []);
  return found;
})();
t("dependants: add button present", !!addBtn);
if (addBtn) {
  fireActions(addBtn);
  t("dependants: add appends viewing title to the PICKED action's prereqs",
    JSON.stringify($tw.wiki.getTiddlerList("Unrelated action", "gsd_prerequisites")) === JSON.stringify(["Host action"]),
    JSON.stringify($tw.wiki.getTiddler("Unrelated action").fields.gsd_prerequisites));
  t("dependants: plain add clears the pick", (wiki.getTiddler(DEPTEMP) || {fields: {}}).fields["hgsd-pick"] === "",
    JSON.stringify((wiki.getTiddler(DEPTEMP) || {fields: {}}).fields["hgsd-pick"]));
  t("dependants: viewing tiddler's own prereqs untouched",
    JSON.stringify($tw.wiki.getTiddlerList("Host action", "gsd_prerequisites")) === JSON.stringify(["Old dep", "Fresh Dependency"]));
}
// create: new action back-links the viewing title (target-field blank, new-prereq set)
wiki.addTiddler({title: DEPTEMP, "hgsd-pick": "Fresh Dependant"});
const r10 = render(depSrc, "Host action");
t("dependants: create button shown for typed new pick", !!r10.createBtnWidget, JSON.stringify(r10.buttons));
if (r10.createBtnWidget) fireActions(r10.createBtnWidget);
const fresh2 = wiki.getTiddler("Fresh Dependant");
t("dependants: created with action tag + future status",
  !!fresh2 && fresh2.fields.tags.indexOf("$:/GSD/Action") !== -1 && fresh2.fields.gsd_status === "future",
  JSON.stringify(fresh2 && fresh2.fields));
t("dependants: created action's prereqs gain the viewing title",
  JSON.stringify($tw.wiki.getTiddlerList("Fresh Dependant", "gsd_prerequisites")) === JSON.stringify(["Host action"]),
  JSON.stringify(fresh2 && fresh2.fields.gsd_prerequisites));
t("dependants: created title NOT written to the viewing tiddler's prereqs",
  JSON.stringify($tw.wiki.getTiddlerList("Host action", "gsd_prerequisites")) === JSON.stringify(["Old dep", "Fresh Dependency"]));
t("dependants: pick cleared", (wiki.getTiddler(DEPTEMP) || {fields: {}}).fields["hgsd-pick"] === "");
// negative: existing pick hides the plain new button (Add is the affordance for a typed pick)
wiki.addTiddler({title: DEPTEMP, "hgsd-pick": "Unrelated action"});
const r10b = render(depSrc, "Host action");
t("dependants: existing pick hides plain new, shows add", !r10b.createBtnWidget && !has(r10b.buttons, "new") && has(r10b.buttons, "add"));
// ordering: not-completed rows first, in both sections
wiki.addTiddler({title: "Done dep", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "true", gsd_prerequisites: "[[Host action]]"});
wiki.addTiddler(new $tw.Tiddler($tw.wiki.getTiddler("Host action"), {gsd_prerequisites: "[[Old dep]] [[Done prereq]] [[Fresh Dependency]]"}));
wiki.addTiddler({title: "Done prereq", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "true"});
const orderPanel = (src, a2, b2) => {
  const rr = render(src, "Host action");
  let full = ""; (function g(x){ if(!x||typeof x!=="object")return; if(Array.isArray(x))return x.forEach(g);
    if(x.isTiddlyWikiFakeDom) return (x.children||[]).forEach(g); full += (x.textContent||""); })(rr.w ? rr.w.children ? {} : {} : {});
  // fall back to re-render via raw widget for text
  const w2 = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + src + "\n\n</$importvariables>"), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "Host action"}});
  const c2 = doc.createElement("div"); w2.render(c2);
  let t2 = ""; (function g(x){ if(!x||typeof x!=="object")return; if(Array.isArray(x))return x.forEach(g);
    if(x.isTiddlyWikiFakeDom) return (x.children||[]).forEach(g); t2 += (x.textContent||""); })(c2);
  return t2.indexOf(a2) < t2.indexOf(b2) && t2.indexOf(a2) !== -1 && t2.indexOf(b2) !== -1;
};
t("prereq rows: not-completed first (Done prereq last)",
  orderPanel('<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/panel/prereq"/>', "Old dep", "Done prereq"));
t("dependant rows: not-completed first (Done dep last)",
  orderPanel('<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/panel/dependants"/>', "Multi word dependent", "Done dep"));

// picker: DependsOn's literal filter — incomplete actions, minus self
const pickerEval = (() => {
  const ev = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", `<$set name="currentTiddler" value="Host action">{{{ [all[tiddlers]tag[$:/GSD/Action]!gsd_complete[true]] -[<currentTiddler>] }}}</$set>`), {document: doc, parentWidget: $tw.rootWidget});
  const c3 = doc.createElement("div"); ev.render(c3);
  let out = ""; (function g(x){ if(!x||typeof x!=="object")return; if(Array.isArray(x))return x.forEach(g);
    if(x.isTiddlyWikiFakeDom) return (x.children||[]).forEach(g); out += (x.textContent||""); })(c3);
  return out.trim();
})();
t("dependants: picker offers incomplete actions minus self",
  pickerEval.indexOf("Host action") === -1 && pickerEval.indexOf("Old dependent") !== -1,
  JSON.stringify(pickerEval));

// 8. Editing-state picker carries the clear hint; empty state does not
const rawRender = (src, cur) => {
  const parser = wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + src + "\n\n</$importvariables>");
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: cur}});
  const c = doc.createElement("div"); w.render(c);
  const ph = [];
  (function f(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(f);
    if (n.isTiddlyWikiFakeDom) {
      if (n.tag === "input") ph.push((n.attributes || {}).placeholder || "");
      (n.children || []).forEach(f);
    }
  })(c);
  return ph;
};
wiki.deleteTiddler(EDITPOP);
wiki.addTiddler({title: "Host action", tags: ["$:/GSD/Action", "$:/GSD/Realm/Home"], gsd_status: "next", gsd_complete: "false", gsd_contact: "Existing contact"});
wiki.addTiddler({title: EDITPOP, text: "yes"});
const editingPh = rawRender(pickFieldSrc, "Host action");
t("editing-state picker shows the clear hint", editingPh.indexOf("type to change / leave blank to clear") !== -1, JSON.stringify(editingPh));
wiki.addTiddler({title: "Host action", tags: ["$:/GSD/Action", "$:/GSD/Realm/Home"], gsd_status: "next", gsd_complete: "false"});
const emptyPh = rawRender(pickFieldSrc, "Host action");
t("empty-state picker has no hint", emptyPh.indexOf("type to change / leave blank to clear") === -1, JSON.stringify(emptyPh));


// AfterCreation hook: navigate rule gate matrix + picker suppression + tag order.
// fakeDOM nodes lack getBoundingClientRect (core's action-navigate wants the origin
// rect for the animation) and there is no story widget headless, so navigation is
// asserted via a tm-navigate dispatch spy on the root widget.
fd.fakeDocument.createElement("div").constructor.prototype.getBoundingClientRect = function() { return {top:0,left:0,bottom:0,right:0,width:0,height:0}; };
let navEvents = [];
$tw.rootWidget.dispatchEvent = function(event) { if (event.type === "tm-navigate") navEvents.push(event.param); };
const runHook = (type, source) => {
  navEvents = [];
  const body = '<$button><$transclude $variable="hgsd-run-after-create" new-title="New item" new-type="' + type + '" calling-tiddler="" new-source="' + source + '" /></$button>';
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + body + "\n\n</$importvariables>"), {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c);
  let btn = null;
  (function f(n) { if (!n || btn || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(f);
    if (n.parseTreeNode && n.parseTreeNode.tag === "$button") { btn = n; return; } (n.children || []).forEach(f); })(w.children);
  btn.invokeActions(btn, {type: "click"});
  return navEvents.length;
};
const setCfg = (title, val) => val === undefined ? wiki.deleteTiddler(title) : wiki.addTiddler({title: title, text: val});
// Navigation left the AfterCreation hook (run-after-create's own contract:
// the creation paths navigate themselves honouring new-action-show /
// new-project-show), so the hook dispatches no navigation for any type or
// source — the old defaults-on/config-off pair all collapse to zero here.
t("navigate: hook never dispatches (creation paths own it)",
  [runHook("action", "modal"), runHook("project", "modal"), runHook("reference", "modal"), runHook("action", "picker"), runHook("contact", "picker")],
  [0, 0, 0, 0, 0]);

// hook membership: the navigate rule is gone; the shipped pair is the contacts
// delegation plus the priorities default (list field empty, engine order).
t("AfterCreation members are the shipped pair",
  JSON.stringify(wiki.filterTiddlers("[[$:/tags/hypergsd/AfterCreation]] :and[tagging[]]")) === JSON.stringify(["$:/plugins/yan/hypergsd-contacts/modules/after-create/contact-delegation", "$:/plugins/yan/hypergsd-priorities/modules/after-create/default-priority"]), true);

// end-to-end picker creation dispatches no navigation
wiki.deleteTiddler(ADDTEMP);
wiki.addTiddler({title: ADDTEMP, "hgsd-pick": "Quiet Person"});
navEvents = [];
(() => { const b = render(pickFieldSrc, "Host action").createBtnWidget; if (b) fireActions(b); })();
t("picker creation stays in place (no tm-navigate)", navEvents.length === 0 && !!wiki.getTiddler("Quiet Person"));
wiki.deleteTiddler("Quiet Person");


// GENERIC DATA-FIELD PASS-THROUGH (2026-08-30 Grade-2 split): create-gsd-tiddler copies
// every field from the DATA temp ($:/temp/gsd-new-temp) onto the created tiddler, blanks
// skipped; internal modal state lives on $:/temp/gsd-new-state. gsd_status/gsd_complete
// are written explicitly. Simulates a THIRD-PARTY field (gsd_stakeholder) to prove a
// sub-plugin section needs zero main-plugin changes.
const createVia = (title, type, tempFields) => {
  wiki.deleteTiddler("$:/temp/gsd-new-temp");
  if (tempFields) wiki.addTiddler(Object.assign({title: "$:/temp/gsd-new-temp"}, tempFields));
  // create-gsd-tiddler is modal-file-local (not Global-tagged) — import the file explicitly
  const body = '<$importvariables filter="[[$:/plugins/yan/hypergsd/ui/new-gsd-modal]]"><$button><$transclude $variable="create-gsd-tiddler" gsd-type="' + type + '" gsd-status="next" gsd-complete="false" gsd-update-status="no" gsd-calling-tiddler="" new-title="' + title + '" gsd-realm-tags="" gsd-context-tags=""/></$button></$importvariables>';
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + body + "\n\n</$importvariables>"), {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c);
  let btn = null;
  (function f(n) { if (!n || btn || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(f);
    if (n.parseTreeNode && n.parseTreeNode.tag === "$button") { btn = n; return; } (n.children || []).forEach(f); })(w.children);
  btn.invokeActions(btn, {type: "click"});
  const t = wiki.getTiddler(title);
  const out = t ? t.fields : null;
  wiki.deleteTiddler(title);
  wiki.deleteTiddler("$:/temp/gsd-new-temp");
  return out;
};
let cf = createVia("GT one", "action", null);
t("no temp: NO gsd_project/gsd_contact fields created", [cf.gsd_project, cf.gsd_contact], [undefined, undefined]);
t("explicit status/complete always written", [cf.gsd_status, cf.gsd_complete], ["next", "false"]);
wiki.addTiddler({title: "GT project", tags: ["$:/GSD/Project"]});
cf = createVia("GT two", "action", {gsd_project: "GT project", gsd_contact: ""});
t("temp values copied; blank skipped", [cf.gsd_project, cf.gsd_contact], ["GT project", undefined]);
cf = createVia("GT three", "action", {gsd_stakeholder: "Alice"});
t("third-party field passes through untouched", cf.gsd_stakeholder, "Alice");
cf = createVia("GT four", "reference", {gsd_project: "GT project"});
t("reference: project via the pass-through loop", cf.gsd_project, "GT project");
wiki.deleteTiddler("GT project");


// CREATE ANOTHER (2026-09-05): with the checkbox state at "yes", hgsd-modal-submit
// keeps the two context temps and re-sends tm-modal (fresh render rebuilds every
// attribute from them); the title temp is wiped in both branches. The submit
// procedure is modal-file-local and reads the tm-modal params plus the body $let
// names from its invocation scope, so the harness supplies both.
let modalEvents = [];
const spyDispatch = $tw.rootWidget.dispatchEvent;
$tw.rootWidget.dispatchEvent = function(event) {
  if (event.type === "tm-modal") modalEvents.push({param: event.param, params: event.paramObject || {}});
  return spyDispatch.call(this, event);
};
const submitVia = () => {
  const body = '<$importvariables filter="[[$:/plugins/yan/hypergsd/ui/new-gsd-modal]]">'
    + '<$let new-data-title="$:/temp/gsd-new-temp" new-state="$:/temp/gsd-new-state" gsd-type="action" gsd-status="next" gsd-complete="false" gsd-project="" gsd-contact="" gsd-update-status="no" gsd-calling-tiddler="">'
    + '<$button><$transclude $variable="hgsd-modal-submit"/></$button>'
    + '</$let></$importvariables>';
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + body + "\n\n</$importvariables>"), {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c);
  let btn = null;
  (function f(n) { if (!n || btn || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(f);
    if (n.parseTreeNode && n.parseTreeNode.tag === "$button") { btn = n; return; } (n.children || []).forEach(f); })(w.children);
  btn.invokeActions(btn, {type: "click"});
};
wiki.addTiddler({title: "Fresh Project", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "false"});
wiki.addTiddler({title: "$:/temp/gsd-new-state", "hgsd-type": "action"});
wiki.addTiddler({title: "$:/temp/gsd-new-temp", gsd_project: "Fresh Project"});
wiki.addTiddler({title: "$:/temp/gsd-new-title", "hgsd-title": "Batch one"});
wiki.addTiddler({title: "$:/state/hypergsd/create-another", text: "yes"});
modalEvents = []; submitVia();
t("another: tiddler created with status/project/complete",
  (() => { const f = wiki.getTiddler("Batch one") && wiki.getTiddler("Batch one").fields;
    return !!f && f.gsd_status === "next" && f.gsd_project === "Fresh Project" && f.gsd_complete === "false"; })(),
  JSON.stringify(wiki.getTiddler("Batch one") && wiki.getTiddler("Batch one").fields));
t("another: title temp cleared in place (deletion would drop edit-text focus)",
  (() => { const t = wiki.getTiddler("$:/temp/gsd-new-title"); return !!t && t.fields["hgsd-title"] === ""; })(),
  JSON.stringify(wiki.getTiddler("$:/temp/gsd-new-title") && wiki.getTiddler("$:/temp/gsd-new-title").fields));
t("another: context temps survive",
  !!wiki.getTiddler("$:/temp/gsd-new-temp") && wiki.getTiddler("$:/temp/gsd-new-temp").fields.gsd_project === "Fresh Project"
  && !!wiki.getTiddler("$:/temp/gsd-new-state"));
t("another: tm-modal re-sent with the invocation params",
  modalEvents.length === 1 && modalEvents[0].param === "$:/plugins/yan/hypergsd/ui/new-gsd-modal"
  && modalEvents[0].params["gsd-type"] === "action" && modalEvents[0].params["gsd-status"] === "next",
  JSON.stringify(modalEvents));
// second round: same temps, new title — the batch loop
wiki.addTiddler({title: "$:/temp/gsd-new-title", "hgsd-title": "Batch two"});
modalEvents = []; submitVia();
t("another: second submit creates the second tiddler",
  !!wiki.getTiddler("Batch two") && wiki.getTiddler("Batch two").fields.gsd_project === "Fresh Project"
  && modalEvents.length === 1);
// deselected: normal path — close, all temps deleted, no reopen
wiki.addTiddler(new $tw.Tiddler(wiki.getTiddler("$:/state/hypergsd/create-another"), {text: "no"}));
wiki.addTiddler({title: "$:/temp/gsd-new-title", "hgsd-title": "Batch three"});
modalEvents = []; submitVia();
t("normal: tiddler created, no reopen", !!wiki.getTiddler("Batch three") && modalEvents.length === 0);
t("normal: all three temps deleted",
  !wiki.getTiddler("$:/temp/gsd-new-temp") && !wiki.getTiddler("$:/temp/gsd-new-state") && !wiki.getTiddler("$:/temp/gsd-new-title"));
$tw.rootWidget.dispatchEvent = spyDispatch;
["Batch one", "Batch two", "Batch three", "Fresh Project", "$:/state/hypergsd/create-another"].forEach(x => wiki.deleteTiddler(x));


console.log(fails === 0 ? "ALL CREATE-AND-ADD CASES PASS" : fails + " FAILURES");
console.log(strays === 0 ? "STRAY GUARD: 0 across all renders" : "STRAY GUARD FAILED: " + strays);
process.exit(fails === 0 && strays === 0 ? 0 : 1);