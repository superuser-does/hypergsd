// Modal type-select: must enumerate EXACTLY the tag-list members.
// Regression: the operand form tagging[$:/tags/hypergsd/Type] returns every
// tagged tiddler in the wiki (core tagging[] ignores its operand) — ~6000
// empty <option>s on the real wiki.
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-wiki"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;

const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';
const render = () => {
  wiki.addTiddler({title: "$:/temp/gsd-new-state", text: "", "hgsd-type": "action"});
  const src = G + "\n\n" +
    '<$let new-temp="$:/temp/gsd-new-temp" new-state="$:/temp/gsd-new-state" gsd-type="action">' +
    '<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/modal/type" $mode="block"/>' +
    "</$let>\n\n</$importvariables>";
  const parser = wiki.parseText("text/vnd.tiddlywiki", src);
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c);
  const opts = [];
  (function f(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(f);
    if (n.isTiddlyWikiFakeDom && n.tag === "option" && n.attributes && "value" in n.attributes)
      opts.push(String(n.attributes.value));
    (n.children || []).forEach(f);
  })(c);
  return opts;
};
let fails = 0;
const t = (name, got, exp) => {
  const ok = JSON.stringify(got) === JSON.stringify(exp);
  if (!ok) fails++;
  console.log((ok ? "PASS " : "FAIL ") + name + " got:" + JSON.stringify(got));
};
t("exactly the 5 tag list options (no empties)", render(), ["action", "contact", "project", "reference", "context"]);
wiki.addTiddler({title: "$:/GSD/Stakeholder", tags: ["$:/tags/hypergsd/Type"], "hgsd-type": "stakeholder"});
t("extension type appears as 6th option", render(), ["action", "contact", "project", "reference", "context", "stakeholder"]);
t("contexts dashboard is the type anchor", wiki.filterTiddlers("[all[shadows+tiddlers]tag[$:/tags/hypergsd/Type]]").includes("GSD/Contexts")
  && (wiki.getTiddler("GSD/Contexts") || {fields: {}}).fields["hgsd-type"] === "context", true);
wiki.deleteTiddler("$:/GSD/Stakeholder");
wiki.deleteTiddler("$:/temp/gsd-new-state");

// Per-type status memory is TEMP-ONLY (2026-08-30): the status click handler writes
// gsd_action_status/gsd_project_status solely on $:/temp/gsd-new-state; real tiddlers
// only ever receive gsd_status. Invoked via $transclude $variable with the dom-*
// contract variables $let into scope, fired like a button click.
const fireStatus = (tiddler, status, field) => {
  wiki.addTiddler({title: tiddler, tags: ["$:/GSD/Action"], gsd_status: "waiting", gsd_complete: "false"});
  const body = '<$button><$let dom-data-tiddler="' + tiddler + '" dom-data-status="' + status + '" dom-data-hgsd-action="status" dom-data-hgsd-status-field="' + field + '">'
    + '<$transclude $variable="hgsd-handle-click"/></$let></$button>';
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + "\\n\\n" + body + "\\n\\n</$importvariables>"), {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c);
  let btn = null;
  (function f(n) { if (!n || btn || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(f);
    if (n.parseTreeNode && n.parseTreeNode.tag === "$button") { btn = n; return; } (n.children || []).forEach(f); })(w.children);
  btn.invokeActions(btn, {type: "click"});
  return wiki.getTiddler(tiddler).fields;
};
let f1 = fireStatus("Real panel item", "next", "gsd_action_status");
t("panel status click: gsd_status updated, NO per-type field", [f1.gsd_status, f1.gsd_action_status], ["next", undefined]);
wiki.deleteTiddler("Real panel item");
let f2 = fireStatus("$:/temp/gsd-new-state", "next", "gsd_action_status");
t("modal state click: BOTH fields written", [f2.gsd_status, f2.gsd_action_status], ["next", "next"]);
wiki.deleteTiddler("$:/temp/gsd-new-state");

console.log(fails === 0 ? "ALL TYPE-SELECT CASES PASS" : fails + " FAILURE(S)");