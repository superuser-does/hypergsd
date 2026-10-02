// View placement tag list ($:/tags/hypergsd/ViewPlacement): the two
// view-body hooks loop members (type-tag match + config/default side + list
// bodies), the Settings tab renders one radio pair per member, an overridden
// empty member drops out. Also covers the ActionProject → Action/Project split.
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true;
$tw.boot.argv = [__dirname + "/fixture-wiki"];
$tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;

const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';
const TOP = "$:/plugins/yan/hypergsd/ui/ViewTemplate/view-body-top";
const BOTTOM = "$:/plugins/yan/hypergsd/ui/ViewTemplate/view-body-bottom";
const CONTACT_MEMBER = "$:/plugins/yan/hypergsd-contacts/ui/view-placement/contact";

let n = 0, fails = 0;
function t(name, got, want) {
  n++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fails++;
    console.log("FAIL " + name + " got:" + JSON.stringify(got) + " want:" + JSON.stringify(want));
  }
}

wiki.addTiddler({title: "A one", tags: ["$:/GSD/Action"]});
wiki.addTiddler({title: "P one", tags: ["$:/GSD/Project"]});
wiki.addTiddler({title: "C one", tags: ["$:/GSD/Contact"]});
wiki.addTiddler({title: "R one", tags: ["$:/GSD/Reference"]});

function renderSide(sideTitle, current) {
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki",
    G + '\n\n<$transclude $tiddler="' + sideTitle + '" $mode="block"/>\n\n</$importvariables>'),
    {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: current}});
  const c = doc.createElement("div"); w.render(c);
  const out = {fieldset: 0, view: 0};
  (function f(x) { if (!x || typeof x !== "object") return; if (Array.isArray(x)) return x.forEach(f);
    if (x.isTiddlyWikiFakeDom) {
      const cls = (x.attributes || {}).class || "";
      if (cls.indexOf("hgsd-panel-fieldset") !== -1) out.fieldset++;
      if (cls.indexOf("project-view-template") !== -1) out.view++;
      (x.children || []).forEach(f);
    } })(c.children);
  return out;
}

// 1. defaults: action bottom, project bottom (fieldset + view together), contact top, reference top
t("action default: top empty, bottom fieldset", [renderSide(TOP, "A one"), renderSide(BOTTOM, "A one")],
  [{fieldset: 0, view: 0}, {fieldset: 1, view: 0}]);
t("project default: bottom fieldset + view, top empty", [renderSide(TOP, "P one"), renderSide(BOTTOM, "P one")],
  [{fieldset: 0, view: 0}, {fieldset: 1, view: 1}]);
t("contact default: top view, bottom empty", [renderSide(TOP, "C one"), renderSide(BOTTOM, "C one")],
  [{fieldset: 0, view: 1}, {fieldset: 0, view: 0}]);
t("reference default: top fieldset, bottom empty", [renderSide(TOP, "R one"), renderSide(BOTTOM, "R one")],
  [{fieldset: 1, view: 0}, {fieldset: 0, view: 0}]);

// 2. config flips the side
wiki.addTiddler({title: "$:/config/hypergsd/Placement/Action", text: "top"});
t("action configured top: fieldset moves", [renderSide(TOP, "A one").fieldset, renderSide(BOTTOM, "A one").fieldset], [1, 0]);
wiki.addTiddler({title: "$:/config/hypergsd/Placement/Contact", text: "bottom"});
t("contact configured bottom: view moves", [renderSide(TOP, "C one").view, renderSide(BOTTOM, "C one").view], [0, 1]);

// 3. the split: flipping Project leaves the action panel alone
wiki.addTiddler({title: "$:/config/hypergsd/Placement/Project", text: "top"});
t("project top: action panel stays where Action says", [renderSide(TOP, "A one").fieldset, renderSide(BOTTOM, "A one").fieldset], [1, 0]);
t("project top: both bodies moved together", [renderSide(TOP, "P one").fieldset, renderSide(TOP, "P one").view], [1, 1]);

// 4. absent member: an empty override of the member drops it from the tag list
wiki.addTiddler({title: CONTACT_MEMBER});
t("overridden-empty member: neither side renders", [renderSide(TOP, "C one").view, renderSide(BOTTOM, "C one").view], [0, 0]);

// 5. Settings tab (the View placement page, split out of sections 2026-09-26): one radio pair per member, saved/default side selected
wiki.deleteTiddler(CONTACT_MEMBER);
const sw = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki",
  G + '\n\n<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/control-panel/view-placement" $mode="block"/>\n\n</$importvariables>'),
  {document: doc, parentWidget: $tw.rootWidget});
const sc = doc.createElement("div"); sw.render(sc);
const rows = [];
(function f(x) { if (!x || typeof x !== "object") return; if (Array.isArray(x)) return x.forEach(f);
  if (x.isTiddlyWikiFakeDom) {
    if (x.tag === "label" && ((x.attributes || {}).class || "").indexOf("tc-radio") !== -1) {
      const sel = ((x.attributes || {}).class || "").indexOf("tc-radio-selected") !== -1;
      rows.push([(x.children || []).map(k => k.textContent || "").join("").trim(), sel]);
    }
    (x.children || []).forEach(f);
  } })(sc.children);
t("settings rows: four pairs, saved/default side selected (Action top, Project top, Contact bottom, Reference default top)",
  rows.filter(r => ["Top", "Bottom"].indexOf(r[0]) !== -1),
  [["Top", true], ["Bottom", false], ["Top", true], ["Bottom", false], ["Top", false], ["Bottom", true], ["Top", true], ["Bottom", false]]);

console.log(fails ? fails + " FAILURE(S)" : "ALL " + n + " PASS");
process.exit(fails ? 1 : 0);