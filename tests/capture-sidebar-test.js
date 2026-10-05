// Capture sidebar block presentation: $:/tags/hypergsd/Capture/Block/<n> tag
// tiddlers each own one block (1 defaults, 2 new action/project/reference,
// 3 new contact/context — the rarer pair, 4 realm note) — within-block order
// is the engine's sortByList (member list-before/list-after pins, then
// alphabetical; a Settings drag writes the block's list field after deleting
// pins — core's list-tagged-draggable drop actions). Empty blocks leave no div
// (no double gap).
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
  const blocks = [];
  (function f(x) { if (!x || typeof x !== "object") return; if (Array.isArray(x)) return x.forEach(f);
    if (x.isTiddlyWikiFakeDom) {
      const cls = (x.attributes || {}).class || "";
      if (cls.indexOf("hgsd-sidebar-block") !== -1) {
        blocks.push({text: String(x.textContent || ""), buttons: 0});
        (function g(y) { if (!y || typeof y !== "object") return; if (Array.isArray(y)) return y.forEach(g);
          if (y.isTiddlyWikiFakeDom) {
            if (y.tag === "button") blocks[blocks.length - 1].buttons++;
            (y.children || []).forEach(g);
          } })(x);
      }
      (x.children || []).forEach(f);
    } })(c.children);
  return blocks;
}

const blocks = renderCapture();

t("four blocks render", blocks.length, 4);
t("block 1: both defaults present",
  [blocks[0].text.indexOf("Default realm:") !== -1, blocks[0].text.indexOf("Default context:") !== -1], [true, true]);
t("block 2: the common new buttons (action, project, reference) in Buttons order",
  [blocks[1].text.indexOf("new action") !== -1, blocks[1].text.indexOf("new project") !== -1, blocks[1].text.indexOf("new reference") !== -1],
  [true, true, true]);
t("block 2: no rarer buttons, no note", [blocks[1].text.indexOf("new contact"), blocks[1].text.indexOf("new realm")], [-1, -1]);
t("block 3: the rarer buttons (contact, context)",
  [blocks[2].text.indexOf("new contact") !== -1, blocks[2].text.indexOf("new context") !== -1], [true, true]);
t("block 4: the realm note",
  blocks[3].text.indexOf("You can create a new realm by creating a new GSD item of any other type.") !== -1, true);

// visibility gate: hide new-action -> drops from block 2; restore
const VIS = "$:/config/hypergsd/Capture/visibility/$:/plugins/yan/hypergsd/ui/sidebar/capture/new-action";
wiki.addTiddler({title: VIS, text: "hide"});
const hidden = renderCapture();
t("hidden entry drops from its block", hidden[1].text.indexOf("new action"), -1);
t("hidden entry leaves other blocks intact", [hidden.length, hidden[2].text.indexOf("new contact") !== -1, hidden[3].text.indexOf("You can create a new realm") !== -1], [4, true, true]);
wiki.deleteTiddler(VIS);

// order authority: a Settings drag deletes member pins, then writes the block's list field (core's
// list-tagged-draggable drop actions) — with the new-reference pin gone, the written list rules
const REFERENCE_MEMBER = "$:/plugins/yan/hypergsd-references/ui/sidebar/capture/new-reference";
wiki.addTiddler(new $tw.Tiddler(wiki.getTiddler(REFERENCE_MEMBER), {"list-after": undefined}));
wiki.addTiddler({title: "$:/tags/hypergsd/Capture/Block/2",
  caption: "{{$:/language/hypergsd/Settings/Sidebar/CaptureBlock/2}}",
  list: "$:/plugins/yan/hypergsd-references/ui/sidebar/capture/new-reference $:/plugins/yan/hypergsd/ui/sidebar/capture/new-action $:/plugins/yan/hypergsd/ui/sidebar/capture/new-project"});
const reordered = renderCapture();
t("block 2 follows its dragged order (reference now first)",
  reordered[1].text.indexOf("new reference") < reordered[1].text.indexOf("new action"), true);
wiki.deleteTiddler(REFERENCE_MEMBER);
wiki.deleteTiddler("$:/tags/hypergsd/Capture/Block/2");

// empty block leaves no div: empty-override both rarer buttons -> block 3 gone, no double gap
wiki.addTiddler({title: "$:/plugins/yan/hypergsd-contacts/ui/sidebar/capture/new-contact"});
wiki.addTiddler({title: "$:/plugins/yan/hypergsd-contexts/ui/sidebar/capture/new-context"});
const emptied = renderCapture();
t("empty block renders no div", [emptied.length, emptied[2].text.indexOf("realm note text absent")], [3, -1]);
wiki.deleteTiddler("$:/plugins/yan/hypergsd-contacts/ui/sidebar/capture/new-contact");
wiki.deleteTiddler("$:/plugins/yan/hypergsd-contexts/ui/sidebar/capture/new-context");

console.log(fails ? fails + " FAILURE(S)" : "ALL " + n + " PASS");
process.exit(fails ? 1 : 0);