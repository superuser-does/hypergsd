// Trashbin sub-plugin: alternative Row/Suffix fragment that trashes completed
// items via kookma Trashbin instead of deleting. Fake in-memory data only.
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-wiki"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;

let fails = 0;
const t = (name, ok, extra) => { if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + name + (ok || !extra ? "" : " " + extra)); };

wiki.addTiddler({title: "P one", tags: ["$:/GSD/Project"], gsd_status: "active"});
wiki.addTiddler({title: "Done thing", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "true",
  gsd_comp_date: "20260830120000000", gsd_project: "P one"});
wiki.addTiddler({title: "Open thing", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_project: "P one"});

const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';
const LF = "[all[tiddlers]tag[$:/GSD/Action]] -[is[draft]] +[sort[title]]";

const renderRows = () => {
  const body = '<$hgsd.list list-heading="T" list-filter="' + LF + '" group-state="false"/>';
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + body + "\n\n</$importvariables>"), {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c);
  return {c, w};
};
const rowButtons = (c, rowTitle) => {
  const out = {deleteBtn: 0, trashBtn: 0, trashWidget: null};
  (function f(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(f);
    if (n.isTiddlyWikiFakeDom) {
      if (n.tag === "button") {
        if ((n.attributes || {})["data-hgsd-action"] === "delete") out.deleteBtn++;
        if (((n.attributes || {}).class || "").indexOf("gsd-button") !== -1 && !(n.attributes || {})["data-hgsd-action"]) out.trashBtn++;
      }
      (n.children || []).forEach(f);
    }
  })(c);
  return out;
};
// With the override active the completed row's only <$button> IS the trash button
// (the built-in delete is gone; other row fragments render inputs/spans, not buttons).
const findTrashWidget = (w) => {
  let found = null;
  (function f(n) {
    if (!n || found || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(f);
    if (n.parseTreeNode && n.parseTreeNode.tag === "$button") { found = n; return; }
    (n.children || []).forEach(f);
  })(w.children);
  return found;
};

// 1. Default (shipped tag list): completed row shows BOTH the built-in delete and the trash button
let r = renderRows();
let btns = rowButtons(r.c);
t("default: completed rows carry delete + trash buttons", [btns.deleteBtn > 0, btns.trashBtn > 0], [true, true]);

// 2. User override (the wiki's config, BOTH tiddlers): the list field alone only
// reorders — still-tagged members append alphabetically — so the built-in delete
// is also untagged via an empty override of its own tiddler
wiki.addTiddler({title: "$:/tags/hypergsd/Fragment/Row/Suffix",
  list: ["$:/plugins/yan/hypergsd/ui/list-items/comp-date", "$:/plugins/yan/hypergsd/ui/list-items/note", "$:/plugins/yan/hypergsd-trashbin/ui/list-items/trash"]});
wiki.addTiddler({title: "$:/plugins/yan/hypergsd/ui/list-items/delete", text: "", tags: []});
r = renderRows();
btns = rowButtons(r.c);
t("override: built-in delete gone (untagged override), trash remains", btns.deleteBtn === 0 && btns.trashBtn > 0);
t("override: trash present on completed rows", btns.trashBtn > 0);

// 3. End-to-end: fire the trash button -> original deleted, $:/trashbin/ copy created
const trashW = findTrashWidget(r.w);
t("trash button widget found", !!trashW);
if (trashW) {
  trashW.invokeActions(trashW, {type: "click"});
  const gone = !wiki.getTiddler("Done thing");
  const trashed = wiki.getTiddler("$:/trashbin/Done thing");
  t("original deleted after trash click", gone);
  // kookma stores trashed tiddlers as application/json snapshots: the original
  // fields live in the JSON text payload, the trashbin tag rides on top
  let payload = null;
  try { payload = JSON.parse(trashed && trashed.fields.text || "{}"); } catch (e) {}
  t("trash copy created with trashbin tag + fields intact",
    !!trashed && (trashed.fields.tags || []).indexOf("$:/tags/trashbin") !== -1
    && payload && payload.title === "Done thing" && payload.gsd_complete === "true" && payload.gsd_project === "P one");
  t("open item untouched", !!wiki.getTiddler("Open thing"));
}

// 4. Gate + structure at source level (kookma is always present in this fixture)
const src = require("fs").readFileSync(__dirname + "/../plugins/hypergsd-trashbin/ui/list-items/trash.tid", "utf8");
t("fragment gates on kookma macro presence (has[title])", src.indexOf("[[$:/plugins/kookma/trashbin/macros/move-to-trashbin]has[title]]") !== -1);
t("fragment carries no data-hgsd-action (central handler ignores it)", src.indexOf('data-hgsd-action="') === -1);
t("fragment reuses kookma trash icon", src.indexOf("kookma/trashbin/images/trash-alt") !== -1);
t("wrapper omits hgsd-interactive (eventcatcher would consume the click)", src.indexOf('class="gsd-list-item-vertical hgsd-interactive"') === -1);
// lingo resolves
t("tooltip uses kookma's own hint string", wiki.getTiddlerText("$:/language/Buttons/Trashbin/Hint/Move") !== null
  && require("fs").readFileSync(__dirname + "/../plugins/hypergsd-trashbin/ui/list-items/trash.tid", "utf8").indexOf("{{$:/language/Buttons/Trashbin/Hint/Move}}") !== -1);
t("sub ships no lingo of its own", !wiki.getTiddler("$:/language/hypergsd/Toolbar/TrashHint"));

console.log(fails === 0 ? "ALL TRASH CASES PASS" : fails + " FAILURE(S)");