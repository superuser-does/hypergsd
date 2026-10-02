// pick-keyboard-commit: the keyboard create-vs-commit fork of the pick family
// ($hgsd.pick-append both directions, $hgsd.pick-field empty and editing states).
// Fires the keyboard widget's actions string directly (invokeActionString), the
// canonical fakeDOM equivalent of pressing the bound key (Enter by default).
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-wiki"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;

let fails = 0;
const t = (name, ok, extra) => { if (Array.isArray(ok)) ok = JSON.stringify(ok) === JSON.stringify(extra); if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + name + (ok || !extra ? "" : " " + extra)); };

const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';

const render = (src, cur) => {
  const parser = wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + src + "\n\n</$importvariables>");
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: cur}});
  const c = doc.createElement("div"); w.render(c);
  return {w, c};
};

// fire the FIRST $keyboard in the tree (each pick row carries exactly one)
const fireKey = (w) => {
  let kb = null;
  (function f(n){ if(!n||kb) return; if(Array.isArray(n)) return n.forEach(f);
    const p = n.parseTreeNode; if(p && p.tag === "$keyboard") { kb = n; return; } if(n.children) n.children.forEach(f); })(w.children);
  if (!kb) throw new Error("no $keyboard found");
  kb.invokeActionString(kb.getAttribute("actions"), kb, {type: "keydown"});
};

const pickOf = (tmp) => (wiki.getTiddler(tmp) || {fields: {}}).fields["hgsd-pick"];
const setPick = (tmp, v) => wiki.addTiddler({title: tmp, "hgsd-pick": v});
const list = (title, field) => JSON.stringify($tw.wiki.getTiddlerList(title, field));

// ---------------------------------------------------------------------------
// 1. pick-append direction="own" (DependsOn panel): typed non-existent pick
const PREREQTEMP = "$:/temp/hypergsd/add-prereq-Host action";
const prereqSrc = '<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/panel/prereq"/>';
wiki.addTiddler({title: "P one", tags: ["$:/GSD/Project"], gsd_status: "active"});
wiki.addTiddler({title: "Old dep", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false"});
wiki.addTiddler({title: "Host action", tags: ["$:/GSD/Action", "$:/GSD/Realm/Home"], gsd_status: "next", gsd_complete: "false", gsd_project: "P one", gsd_prerequisites: ["Old dep"]});
setPick(PREREQTEMP, "Fresh Dependency");
fireKey(render(prereqSrc, "Host action").w);
const dep = wiki.getTiddler("Fresh Dependency");
t("own/create: created action with realm+status+project",
  !!dep && dep.fields.tags.indexOf("$:/GSD/Action") !== -1 && dep.fields.tags.indexOf("$:/GSD/Realm/Home") !== -1
  && dep.fields.gsd_status === "next" && dep.fields.gsd_project === "P one" && dep.fields.gsd_complete === "false",
  JSON.stringify(dep && dep.fields));
t("own/create: appended after old entry", list("Host action", "gsd_prerequisites") === JSON.stringify(["Old dep", "Fresh Dependency"]), list("Host action", "gsd_prerequisites"));
t("own/create: pick cleared", pickOf(PREREQTEMP) === "");

// 2. own, existing pick: plain append, nothing created
setPick(PREREQTEMP, "Old dep");
const before = wiki.filterTiddlers("[all[tiddlers]]").length;
fireKey(render(prereqSrc, "Host action").w);
t("own/existing: appended, moved to end (listops dedupe)",
  list("Host action", "gsd_prerequisites") === JSON.stringify(["Fresh Dependency", "Old dep"]), list("Host action", "gsd_prerequisites"));
t("own/existing: nothing created", wiki.filterTiddlers("[all[tiddlers]]").length === before);
t("own/existing: pick cleared", pickOf(PREREQTEMP) === "");
wiki.addTiddler(new $tw.Tiddler(wiki.getTiddler("Host action"), {gsd_prerequisites: "[[Old dep]] [[Fresh Dependency]]"}));

// 3. own, multi-word pick: ONE created tiddler with the exact title
setPick(PREREQTEMP, "Two Word Dep");
fireKey(render(prereqSrc, "Host action").w);
t("own/multi-word: exact single title created", !!wiki.getTiddler("Two Word Dep") && !wiki.getTiddler("Two Word Dep 1"));
t("own/multi-word: list keeps it whole", list("Host action", "gsd_prerequisites") === JSON.stringify(["Old dep", "Fresh Dependency", "Two Word Dep"]), list("Host action", "gsd_prerequisites"));

// ---------------------------------------------------------------------------
// 4. pick-append direction="item" (Prerequisite-of panel): typed non-existent pick
const DEPTEMP = "$:/temp/hypergsd/add-dependant-Host action";
const depSrc = '<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/panel/dependants"/>';
wiki.addTiddler({title: "Host action", tags: ["$:/GSD/Action", "$:/GSD/Realm/Home"], gsd_status: "next", gsd_complete: "false", gsd_project: "P one"});
setPick(DEPTEMP, "Brand New Dependant");
fireKey(render(depSrc, "Host action").w);
const nd = wiki.getTiddler("Brand New Dependant");
t("item/create: created with back-link on ITS list",
  !!nd && nd.fields.tags.indexOf("$:/GSD/Action") !== -1
  && $tw.wiki.getTiddlerList("Brand New Dependant", "gsd_prerequisites") !== undefined
  && list("Brand New Dependant", "gsd_prerequisites") === JSON.stringify(["Host action"]),
  JSON.stringify(nd && nd.fields));
t("item/create: viewing tiddler's own list untouched", (wiki.getTiddler("Host action").fields.gsd_prerequisites || "none") === "none");
t("item/create: pick cleared", pickOf(DEPTEMP) === "");

// 5. item, existing pick: viewing title appended to ITS list
wiki.addTiddler({title: "Plain target", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false"});
setPick(DEPTEMP, "Plain target");
fireKey(render(depSrc, "Host action").w);
t("item/existing: picked tiddler gained the viewing title", list("Plain target", "gsd_prerequisites") === JSON.stringify(["Host action"]), list("Plain target", "gsd_prerequisites"));
t("item/existing: pick cleared", pickOf(DEPTEMP) === "");

// ---------------------------------------------------------------------------
// 6. pick-field empty state: typed non-existent pick -> created and SET (modal-style)
const CONTACTTEMP = "$:/temp/hypergsd/add-contact-Host action";
const EDITPOP = "$:/state/hypergsd/edit-gsd_contact-Host action";
const fieldSrc = '<$hgsd.pick-field field="gsd_contact" list-filter="[all[tiddlers]tag[$:/GSD/Contact]]" id="contact" new-type="contact"/>';
wiki.addTiddler({title: "Host action", tags: ["$:/GSD/Action", "$:/GSD/Realm/Home"], gsd_status: "next", gsd_complete: "false"});
setPick(CONTACTTEMP, "Typed Person");
fireKey(render(fieldSrc, "Host action").w);
const tp = wiki.getTiddler("Typed Person");
t("field/create: contact created with realm, field SET (not appended)",
  !!tp && tp.fields.tags.indexOf("$:/GSD/Contact") !== -1 && tp.fields.tags.indexOf("$:/GSD/Realm/Home") !== -1
  && wiki.getTiddler("Host action").fields.gsd_contact === "Typed Person",
  JSON.stringify(tp && tp.fields));
t("field/create: pick cleared", pickOf(CONTACTTEMP) === "");

// 7. field, existing pick: plain set, nothing created
wiki.addTiddler(new $tw.Tiddler(wiki.getTiddler("Host action"), {gsd_contact: undefined}));
wiki.addTiddler({title: "Existing contact", tags: ["$:/GSD/Contact"]});
setPick(CONTACTTEMP, "Existing contact");
const before7 = wiki.filterTiddlers("[all[tiddlers]]").length;
fireKey(render(fieldSrc, "Host action").w);
t("field/existing: field set, nothing created, no pick clear (Save parity)",
  wiki.getTiddler("Host action").fields.gsd_contact === "Existing contact"
  && wiki.filterTiddlers("[all[tiddlers]]").length === before7 && pickOf(CONTACTTEMP) === "Existing contact");

// 8. field, blank pick in the EDITING state: field deliberately cleared
wiki.addTiddler(new $tw.Tiddler(wiki.getTiddler("Host action"), {gsd_contact: "Existing contact"}));
wiki.addTiddler({title: EDITPOP, text: "yes"});
setPick(CONTACTTEMP, "");
fireKey(render(fieldSrc, "Host action").w);
t("field/blank: field cleared, reveal closed", (wiki.getTiddler("Host action").fields.gsd_contact || "") === "" && (wiki.getTiddler(EDITPOP) || {fields: {}}).fields.text === "");

// 9. pick-field editing state: create closes the reveal
wiki.addTiddler(new $tw.Tiddler(wiki.getTiddler("Host action"), {gsd_contact: "Existing contact"}));
wiki.addTiddler({title: EDITPOP, text: "yes"});
setPick(CONTACTTEMP, "Second Person");
fireKey(render(fieldSrc, "Host action").w);
t("field/editing: created + set + reveal closed",
  !!wiki.getTiddler("Second Person") && wiki.getTiddler("Host action").fields.gsd_contact === "Second Person"
  && (wiki.getTiddler(EDITPOP) || {fields: {}}).fields.text === "");
wiki.deleteTiddler(EDITPOP);

// ---------------------------------------------------------------------------
// 10. no-creation call site (new-type blank): Enter plain-appends a non-existent
// pick exactly as before (the fork must not hijack hosts that never opted in)
const BARETEMP = "$:/temp/hypergsd/add-bare-Host action";
const bareSrc = '<$hgsd.pick-append field="gsd_refs" id="bare" list-filter="[all[tiddlers]tag[$:/GSD/Action]]"/>';
wiki.addTiddler({title: "Host action", tags: ["$:/GSD/Action", "$:/GSD/Realm/Home"], gsd_status: "next", gsd_complete: "false"});
setPick(BARETEMP, "Phantom title");
fireKey(render(bareSrc, "Host action").w);
t("bare/no new-type: plain append preserved, nothing created",
  list("Host action", "gsd_refs") === JSON.stringify(["Phantom title"]) && !wiki.getTiddler("Phantom title"), list("Host action", "gsd_refs"));

// 11. render-time cost: the create gate must NOT fire on plain render (no
// tiddler materialises without the keypress; the actions string stays inert)
setPick(BARETEMP, "Never Created");
render(bareSrc, "Host action");
t("render-only: no creation without the keypress", !wiki.getTiddler("Never Created"));

// 12. affordance matrix (2026-09-27): one commit affordance per pick state —
// blank shows the new cluster alone, a typed pick shows the row's Add/Save,
// a typed non-existent pick adds create-and-add; a set field gets a clear button
const buttonLabels = (r) => { const out = [];
  (function f(n){ if(!n||typeof n!=="object") return; if(Array.isArray(n)) return n.forEach(f);
    if(n.isTiddlyWikiFakeDom && n.tag === "button") { let s = "";
      (function g(x){ if(!x||typeof x!=="object") return; if(Array.isArray(x)) return x.forEach(g);
        if(x.isTiddlyWikiFakeDom) return (x.children||[]).forEach(g); s += (x.textContent || ""); })(n);
      out.push(s.replace(/\s+/g, " ").trim()); }
    if(n.isTiddlyWikiFakeDom) (n.children||[]).forEach(f); })(r.c.children);
  return out; };
const hasBtn = (r, s) => buttonLabels(r).some(x => x === s);
wiki.addTiddler({title: "Host action", tags: ["$:/GSD/Action", "$:/GSD/Realm/Home"], gsd_status: "next", gsd_complete: "false"});
setPick(PREREQTEMP, "");
t("matrix/append blank: new only (no add)", (() => { const r = render(prereqSrc, "Host action");
  return hasBtn(r, "new") && !buttonLabels(r).some(x => x.indexOf("add") !== -1); })(), JSON.stringify(buttonLabels(render(prereqSrc, "Host action"))));
setPick(PREREQTEMP, "Old dep");
t("matrix/append existing: add only (no new)", (() => { const r = render(prereqSrc, "Host action");
  return hasBtn(r, "add") && !hasBtn(r, "new"); })(), JSON.stringify(buttonLabels(render(prereqSrc, "Host action"))));
setPick(PREREQTEMP, "Unmade Thing");
t("matrix/append non-existent: create-and-add only (no add)", (() => { const r = render(prereqSrc, "Host action");
  return !hasBtn(r, "add") && buttonLabels(r).some(x => x.indexOf("create Unmade Thing") !== -1); })(), JSON.stringify(buttonLabels(render(prereqSrc, "Host action"))));
setPick(CONTACTTEMP, "");
t("matrix/field blank: new only (no save)", (() => { const r = render(fieldSrc, "Host action");
  return hasBtn(r, "new") && !buttonLabels(r).some(x => x === "ok"); })(), JSON.stringify(buttonLabels(render(fieldSrc, "Host action"))));
setPick(CONTACTTEMP, "Existing contact");
t("matrix/field typed existing: save shown (no new)", (() => { const r = render(fieldSrc, "Host action");
  return buttonLabels(r).some(x => x === "ok") && !hasBtn(r, "new"); })(), JSON.stringify(buttonLabels(render(fieldSrc, "Host action"))));
setPick(CONTACTTEMP, "Unmade Person");
t("matrix/field typed non-existent: create-and-add only (no save)", (() => { const r = render(fieldSrc, "Host action");
  return !buttonLabels(r).some(x => x === "ok") && buttonLabels(r).some(x => x.indexOf("create Unmade Person") !== -1); })(), JSON.stringify(buttonLabels(render(fieldSrc, "Host action"))));
// set state: change + clear; the clear click empties the field; hide opt-out suppresses
wiki.addTiddler(new $tw.Tiddler(wiki.getTiddler("Host action"), {gsd_contact: "Existing contact"}));
const setR = render(fieldSrc, "Host action");
t("matrix/field set: clear icon before change (clear is tooltip-only)", (() => {
  const btns = [];
  (function f(n){ if(!n||typeof n!=="object") return; if(Array.isArray(n)) return n.forEach(f);
    if(n.isTiddlyWikiFakeDom && n.tag === "button") btns.push({text: (n.textContent||"").replace(/\s+/g," ").trim(), tooltip: (n.attributes||{}).title || ""});
    if(n.isTiddlyWikiFakeDom) (n.children||[]).forEach(f); })(setR.c.children);
  const coreClear = $tw.wiki.getTiddlerText("$:/language/Buttons/Clear/Caption");
  const clear = btns.find(b => b.tooltip === coreClear);
  const change = btns.find(b => b.text === "change");
  return !!clear && clear.text === "" && !!change && btns.indexOf(clear) < btns.indexOf(change); })(), "clear must be icon-only, tooltip-named, before change");
let clearW = null;
(function f(n){ if(!n||clearW) return; if(Array.isArray(n)) return n.forEach(f);
  const p = n.parseTreeNode; if(p && p.tag === "$button" && String((p.attributes||{}).actions && p.attributes.actions.value || "").indexOf('$value=""') !== -1) { clearW = n; return; }
  if(n.children) n.children.forEach(f); })(setR.w.children);
if (clearW) clearW.invokeActionString(clearW.getAttribute("actions"), clearW, {type: "click"});
t("matrix/clear click empties the field", (wiki.getTiddler("Host action").fields.gsd_contact || "") === "");
const hideSrc = '<$hgsd.pick-field field="gsd_contact" list-filter="[all[tiddlers]tag[$:/GSD/Contact]]" id="contact" new-type="contact" clear-button="hide"/>';
let suppressed = true;
(function f(n){ if(!n) return; if(Array.isArray(n)) return n.forEach(f);
  const p = n.parseTreeNode; if(p && p.tag === "$button" && String((p.attributes||{}).actions && p.attributes.actions.value || "").indexOf('$value=""') !== -1) suppressed = false;
  if(n.children) n.children.forEach(f); })(render(hideSrc, "Host action").w.children);
t("matrix/clear-button=hide suppresses", suppressed);

// 13. editing-row order (2026-09-27): commit affordances (Save or create-and-add)
// sit BEFORE cancel, the plain new fallback AFTER it — the create fork is a commit,
// not a "new" — and the halves are mutually exclusive so each variant shows one shape
const EDITPOP2 = "$:/state/hypergsd/edit-gsd_contact-Host action";
const orderBtns = (r) => { const out = [];
  (function f(n){ if(!n||typeof n!=="object") return; if(Array.isArray(n)) return n.forEach(f);
    if(n.isTiddlyWikiFakeDom && n.tag === "button") { let s = "";
      (function g(x){ if(!x||typeof x!=="object") return; if(Array.isArray(x)) return x.forEach(g);
        if(x.isTiddlyWikiFakeDom) return (x.children||[]).forEach(g); s += (x.textContent || ""); })(n);
      out.push(s.replace(/\s+/g, " ").trim()); }
    if(n.isTiddlyWikiFakeDom) (n.children||[]).forEach(f); })(r.c.children);
  return out; };
wiki.addTiddler(new $tw.Tiddler(wiki.getTiddler("Host action"), {gsd_contact: "Existing contact"}));
wiki.addTiddler({title: EDITPOP2, text: "yes"});
setPick(CONTACTTEMP, "Unmade Person");
const ordCreate = orderBtns(render(fieldSrc, "Host action"));
t("matrix/editing non-existent: create BEFORE cancel", (() => {
  const ci = ordCreate.findIndex(x => x.indexOf("create Unmade Person") !== -1);
  const xi = ordCreate.findIndex(x => x === "cancel");
  return ci !== -1 && xi !== -1 && ci < xi && !ordCreate.some(x => x === "ok") && !ordCreate.some(x => x === "new");
})(), JSON.stringify(ordCreate));
setPick(CONTACTTEMP, "");
const ordBlank = orderBtns(render(fieldSrc, "Host action"));
t("matrix/editing blank: cancel then new (new last)", (() => {
  const xi = ordBlank.findIndex(x => x === "cancel");
  const ni = ordBlank.findIndex(x => x === "new");
  return xi !== -1 && ni !== -1 && xi < ni;
})(), JSON.stringify(ordBlank));
setPick(CONTACTTEMP, "Existing contact");
const ordSave = orderBtns(render(fieldSrc, "Host action"));
t("matrix/editing existing: save before cancel", (() => {
  const si = ordSave.findIndex(x => x === "ok");
  const xi = ordSave.findIndex(x => x === "cancel");
  return si !== -1 && xi !== -1 && si < xi;
})(), JSON.stringify(ordSave));
wiki.deleteTiddler(EDITPOP2);
wiki.addTiddler(new $tw.Tiddler(wiki.getTiddler("Host action"), {gsd_contact: undefined}));

// 12. stray-markup audit of the four touched files' widget trees
const fs = require("fs");
let strays = 0;
["modules/create-and-add.tid", "modules/widgets/hgsd-pick.tid", "modules/widgets/hgsd-pick-append.tid", "modules/widgets/hgsd-pick-field.tid"].forEach(p => {
  const raw = fs.readFileSync(__dirname + "/../plugins/hypergsd/" + p, "utf8");
  const body = raw.substring(raw.indexOf("\n", raw.indexOf("\\whitespace")) + 1);
  const parser = wiki.parseText("text/vnd.tiddlywiki", body, {parentWidget: $tw.rootWidget});
  (function walk(n){ if(!n) return; if(Array.isArray(n)) return n.forEach(walk);
    if(n.type==="text" && /<\/?\$|^>/.test(String(n.text))) { strays++; console.log("STRAY in " + p + ":", JSON.stringify(String(n.text).slice(0,60))); }
    if(n.children) walk(n.children); })(parser.tree);
});
t("no stray widget markup in edited files", strays === 0);

console.log(fails ? "\nFAILURES: " + fails : "\nALL PASS");
process.exit(fails ? 1 : 0);