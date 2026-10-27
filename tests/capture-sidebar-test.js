// Capture sidebar portion presentation: $:/tags/hypergsd/Capture members
// render grouped by their Portion/<n> tag (1 the two defaults selects, 2 the
// common new action/project/reference buttons, 3 the rarer contact/context
// pair, 4 the realm note) — within-portion order is the engine's sortByList
// (the tag list's list field first, member list-before/list-after pins, then
// engine order; a Settings drag writes the tag list's list field after
// deleting pins — core's list-tagged-draggable drop actions). A portion whose
// members are all absent never exists (no empty div).
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true;
$tw.boot.argv = [__dirname + "/fixture-wiki"];
$tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;

const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';
const CAPTURE = "$:/plugins/yan/hypergsd/ui/sidebar/capture-sidebar";

let n = 0, fails = 0;
function t(name, got, want) {
  n++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fails++;
    console.log("FAIL " + name + " got:" + JSON.stringify(got) + " want:" + JSON.stringify(want));
  }
}

function renderCapture() {
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki",
    G + '\n\n<$transclude $tiddler="' + CAPTURE + '" $mode="block"/>\n\n</$importvariables>'),
    {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c);
  const portions = [];
  (function f(x) { if (!x || typeof x !== "object") return; if (Array.isArray(x)) return x.forEach(f);
    if (x.isTiddlyWikiFakeDom) {
      const cls = (x.attributes || {}).class || "";
      if (cls.indexOf("hgsd-sidebar-portions") !== -1) {
        (x.children || []).forEach(function(div) {
          if (!div.isTiddlyWikiFakeDom || div.tag !== "div") return;
          portions.push({text: String(div.textContent || ""), buttons: 0});
          (function g(y) { if (!y || typeof y !== "object") return; if (Array.isArray(y)) return y.forEach(g);
            if (y.isTiddlyWikiFakeDom) {
              if (y.tag === "button") portions[portions.length - 1].buttons++;
              (y.children || []).forEach(g);
            } })(div);
        });
      }
      (x.children || []).forEach(f);
    } })(c.children);
  return portions;
}

const portions = renderCapture();

t("four portions render", portions.length, 4);
t("portion 1: both defaults present (realm leads — unlisted sub-plugin members append after the listed core)",
  [portions[0].text.indexOf("Default context:") !== -1, portions[0].text.indexOf("Default realm:") !== -1,
   portions[0].text.indexOf("Default realm:") < portions[0].text.indexOf("Default context:")], [true, true, true]);
t("portion 2: the common new buttons (action, project, reference) in list-field order",
  [portions[1].text.indexOf("new action") !== -1, portions[1].text.indexOf("new project") !== -1, portions[1].text.indexOf("new reference") !== -1,
   portions[1].text.indexOf("new action") < portions[1].text.indexOf("new project"),
   portions[1].text.indexOf("new project") < portions[1].text.indexOf("new reference")], [true, true, true, true, true]);
t("portion 2: no rarer buttons, no note", [portions[1].text.indexOf("new contact"), portions[1].text.indexOf("new realm")], [-1, -1]);
t("portion 3: the rarer buttons (contact, context)",
  [portions[2].text.indexOf("new contact") !== -1, portions[2].text.indexOf("new context") !== -1], [true, true]);
t("portion 4: the realm note",
  portions[3].text.indexOf("You can create a new realm by creating a new GSD item of any other type.") !== -1, true);

// visibility gate: hide new-action -> drops from portion 2; restore
const VIS = "$:/config/hypergsd/Capture/visibility/$:/plugins/yan/hypergsd/ui/sidebar/capture/new-action";
wiki.addTiddler({title: VIS, text: "hide"});
const hidden = renderCapture();
t("hidden entry drops from its portion", hidden[1].text.indexOf("new action"), -1);
t("hidden entry leaves other portions intact", [hidden.length, hidden[2].text.indexOf("new contact") !== -1, hidden[3].text.indexOf("You can create a new realm") !== -1], [4, true, true]);
wiki.deleteTiddler(VIS);

// order authority: a Settings drag deletes member pins, then writes the tag list's list field
// (core's list-tagged-draggable drop actions) — with the new-reference pin gone, the written
// list rules within portion 2
const REFERENCE_MEMBER = "$:/plugins/yan/hypergsd-references/ui/sidebar/capture/new-reference";
wiki.addTiddler(new $tw.Tiddler(wiki.getTiddler(REFERENCE_MEMBER), {"list-after": undefined}));
wiki.addTiddler({title: "$:/tags/hypergsd/Capture",
  list: "$:/plugins/yan/hypergsd-references/ui/sidebar/capture/new-reference $:/plugins/yan/hypergsd/ui/sidebar/capture/new-action $:/plugins/yan/hypergsd/ui/sidebar/capture/new-project"});
const reordered = renderCapture();
t("portion 2 follows the dragged order (reference now first)",
  reordered[1].text.indexOf("new reference") < reordered[1].text.indexOf("new action"), true);
wiki.deleteTiddler(REFERENCE_MEMBER);
wiki.deleteTiddler("$:/tags/hypergsd/Capture");

// empty portion leaves no div: empty-override both rarer buttons -> portion 3 gone, no double gap
wiki.addTiddler({title: "$:/plugins/yan/hypergsd-contacts/ui/sidebar/capture/new-contact"});
wiki.addTiddler({title: "$:/plugins/yan/hypergsd-contexts/ui/sidebar/capture/new-context"});
const emptied = renderCapture();
t("empty portion renders no div", [emptied.length, emptied[2].text.indexOf("realm note text absent")], [3, -1]);
wiki.deleteTiddler("$:/plugins/yan/hypergsd-contacts/ui/sidebar/capture/new-contact");
wiki.deleteTiddler("$:/plugins/yan/hypergsd-contexts/ui/sidebar/capture/new-context");

// portion numbers order numerically past 9: retag the realm note to Portion/10
// -> portions render 1, 2, 3, 10 (numeric), not 1, 10, 2, 3 (lexicographic)
const NOTE = "$:/plugins/yan/hypergsd/ui/sidebar/capture/realm-note";
wiki.addTiddler(new $tw.Tiddler(wiki.getTiddler(NOTE), {tags: ["$:/tags/hypergsd/Capture", "$:/tags/hypergsd/Capture/Portion/10"]}));
const numbered = renderCapture();
t("portion 10 renders after 3, not after 1",
  [numbered.length,
   numbered[3].text.indexOf("You can create a new realm") !== -1,
   numbered[1].text.indexOf("new action") !== -1],
  [4, true, true]);
wiki.deleteTiddler(NOTE);

console.log(fails ? fails + " FAILURE(S)" : "ALL " + n + " PASS");
process.exit(fails ? 1 : 0);
