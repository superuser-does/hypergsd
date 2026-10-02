// $hgsd.pick select: NOTHING element-rendering may sit between <$select> and
// its options — modern engines (Chromium 135+/Firefox 146+) render only
// option/optgroup DIRECT children. Regression: <$reveal> wrapped the branch
// content in spans inside the select (options present in DOM, never displayed).
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-wiki"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;

wiki.addTiddler({title: "P one", tags: ["$:/GSD/Project"], gsd_status: "active"});
wiki.addTiddler({title: "P two", tags: ["$:/GSD/Project"], gsd_status: "active"});
wiki.addTiddler({title: "Planning poker set", tags: ["$:/GSD/Project"], gsd_status: "active"});

const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';
const render = (host, fieldVal) => {
  if (fieldVal === undefined) wiki.deleteTiddler(host);
  else wiki.addTiddler({title: host, "gsd_project": fieldVal});
  const src = G + "\n\n" +
    '<$let tiddler="' + host + '" field="gsd_project" none-value="" none-title="-- none --" ' +
    'scoped-titles="""[[P one]] [[P two]] [[Planning poker set]]""" search-mode="title" pop="$:/state/popup/pick-x">' +
    "<<hgsd-pick-select>>" +
    "</$let>\n\n</$importvariables>";
  const parser = wiki.parseText("text/vnd.tiddlywiki", src);
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c);
  let sel = null;
  (function f(n) {
    if (!n || typeof n !== "object" || sel) return;
    if (Array.isArray(n)) return n.forEach(f);
    if (n.isTiddlyWikiFakeDom && n.tag === "select") { sel = n; return; }
    (n.children || []).forEach(f);
  })(c);
  if (!sel) return {error: "no select rendered"};
  const childTags = (sel.children || []).map(ch => ch.tag);
  const optionValues = [];
  (function g(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(g);
    if (n.tag === "option" && n.attributes && "value" in n.attributes) optionValues.push(String(n.attributes.value));
    (n.children || []).forEach(g);
  })(sel);
  return {childTags, optionValues};
};
let fails = 0;
const t = (name, got, exp) => {
  const ok = JSON.stringify(got) === JSON.stringify(exp);
  if (!ok) fails++;
  console.log((ok ? "PASS " : "FAIL ") + name + " got:" + JSON.stringify(got));
};
// 1. blank field: full list, ONLY option elements as direct children (no span)
const blank = render("Z pick host", "");
t("blank: direct children all <option>", blank.childTags.every(x => x === "option"), true);
t("blank: none-option + 3 candidates", blank.optionValues, ["", "P one", "P two", "Planning poker set"]);
// 2. typed value: search branch filters, still no span inside select
const typed = render("Z pick host", "P one");
t("typed 'P one': no span inside select", typed.childTags.every(x => x === "option"), true);
t("typed 'P one': filter narrows to matches", typed.optionValues.indexOf("P one") !== -1 && typed.optionValues.length <= 3, true);
// 3. no field at all: treated as blank (full list)
const missing = render("Z pick host", undefined);
t("missing field: full list", missing.optionValues, ["", "P one", "P two", "Planning poker set"]);
wiki.deleteTiddler("Z pick host");
// Draft gate: base-list-titles (the $hgsd.pick funnel) excludes drafts — a
// draft inherits the base's tags, so the dropdown must not show it mid-edit.
// Popup reveals open on a 4-part coordinate state "(x,y,w,h)", so
// pre-setting pop renders the list.
{
  wiki.addTiddler({title: "Draft of P one", tags: ["$:/GSD/Project"], gsd_status: "active", "draft.of": "P one", "draft.title": "P one"});
  wiki.addTiddler({title: "Z pick draft host"});
  wiki.addTiddler({title: "$:/state/popup/pick-draftgate-GSD/Test", text: "(0,0,0,0)"});
  const src = G + "\n\n" +
    '<$set name="currentTiddler" value="GSD/Test"><$hgsd.pick tiddler="Z pick draft host" field="gsd_project" list-filter="[tag[$:/GSD/Project]]" id="draftgate" none-value="" none-title="-- none --"/></$set>' +
    "\n\n</$importvariables>";
  const parser = wiki.parseText("text/vnd.tiddlywiki", src);
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c);
  const optionValues = [];
  (function g(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(g);
    if (n.tag === "option" && n.attributes && "value" in n.attributes) optionValues.push(String(n.attributes.value));
    (n.children || []).forEach(g);
  })(c);
  t("pick draft gate: dropdown options exclude the draft, keep the base",
    [optionValues.indexOf("Draft of P one") === -1, optionValues.indexOf("P one") !== -1], [true, true]);
  wiki.deleteTiddler("Draft of P one");
  wiki.deleteTiddler("Z pick draft host");
  wiki.deleteTiddler("$:/state/popup/pick-draftgate-GSD/Test");
}
console.log(fails === 0 ? "ALL PICK-SELECT CASES PASS" : fails + " FAILURE(S)");