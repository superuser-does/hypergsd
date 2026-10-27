// Review sidebar block tag list: $:/tags/hypergsd/Review/<n> tag tiddlers are
// blocks (within-block order = the engine's sortByList: member
// list-before/list-after pins, then alphabetical; block 5's contacts entry
// pins before the core cleanup member so references leads), entries ship in
// their owning plugin, one adjacent-sibling CSS rule is the gap. Realm
// selection must render live inside block 1 (checkboxes, all/none, the
// no-realm sentinel).
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true;
$tw.boot.argv = [__dirname + "/fixture-wiki"];
$tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;

const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';
const REVIEW = "$:/plugins/yan/hypergsd/ui/sidebar/review-sidebar";

let n = 0, fails = 0;
function t(name, got, want) {
  n++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fails++;
    console.log("FAIL " + name + " got:" + JSON.stringify(got) + " want:" + JSON.stringify(want));
  }
}

// realms are tags in use: each needs at least one carrying item ([all[tags]] basis)
wiki.addTiddler({title: "$:/GSD/Realm/Home", tags: []});
wiki.addTiddler({title: "$:/GSD/Realm/Work", tags: []});
wiki.addTiddler({title: "Home item", tags: ["$:/GSD/Action", "$:/GSD/Realm/Home"], gsd_status: "next"});
wiki.addTiddler({title: "Work item", tags: ["$:/GSD/Action", "$:/GSD/Realm/Work"], gsd_status: "next"});

function renderReview() {
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki",
    G + '\n\n<$transclude $tiddler="' + REVIEW + '" $mode="block"/>\n\n</$importvariables>'),
    {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c);
  const blocks = [];
  (function f(x) { if (!x || typeof x !== "object") return; if (Array.isArray(x)) return x.forEach(f);
    if (x.isTiddlyWikiFakeDom) {
      const cls = (x.attributes || {}).class || "";
      if (cls.indexOf("hgsd-sidebar-block") !== -1) {
        const b = {text: String(x.textContent || ""), checkboxes: 0, links: []};
        (function g(y) { if (!y || typeof y !== "object") return; if (Array.isArray(y)) return y.forEach(g);
          if (y.isTiddlyWikiFakeDom) {
            if (y.tag === "input") b.checkboxes++;
            if (y.tag === "a") b.links.push(String(y.textContent || ""));
            (y.children || []).forEach(g);
          } })(x);
        blocks.push(b);
      }
      (x.children || []).forEach(f);
    } })(c.children);
  return blocks;
}

const blocks = renderReview();

t("six blocks render", blocks.length, 6);

// 1. Realm selection, live in block 1
t("block 1 is the realm-selection fieldset: legend, all/none, both realms, the no-realm sentinel",
  [blocks[0].text.indexOf("Select realms:") !== -1,
   blocks[0].text.indexOf("all") !== -1 && blocks[0].text.indexOf("none") !== -1,
   blocks[0].text.indexOf("Home") !== -1 && blocks[0].text.indexOf("Work") !== -1,
   blocks[0].text.indexOf("Items not in a realm") !== -1],
  [true, true, true, true]);
t("realm checkboxes: one per realm plus the no-realm sentinel", blocks[0].checkboxes, 3);
t("block 1 has no page links", blocks[0].links, []);

// 2-4. Core link blocks, in the pinned order (reordered 2026-09-26: actions before projects —
// the block list fields pin within-block order and must match the entries' block tags)
t("block 2 is the dashboard link", blocks[1].links, ["Dashboard"]);
t("block 3 order", blocks[2].links, ["Action dashboard", "Actions waiting", "Actions completed"]);
t("block 4 order", blocks[3].links, ["Project dashboard", "Projects without next actions", "Projects completed"]);

// 5-6. Sub-plugin blocks
t("block 5 order", blocks[4].links, ["Contexts", "Ticklers"]);
t("block 6 order", blocks[5].links, ["References", "Contacts", "Cleanup: completed items", "Cleanup: open actions under completed projects"]);

// 6. Absence: an empty override of the contexts entry drops it, Ticklers stays
wiki.addTiddler({title: "$:/plugins/yan/hypergsd-contexts/ui/sidebar/review/contexts"});
const after = renderReview();
t("overridden-empty entry: block 5 keeps only Ticklers", after[4].links, ["Ticklers"]);
t("other blocks unaffected by the override", [after.length, after[2].links, after[5].links],
  [6, ["Action dashboard", "Actions waiting", "Actions completed"], ["References", "Contacts", "Cleanup: completed items", "Cleanup: open actions under completed projects"]]);
wiki.deleteTiddler("$:/plugins/yan/hypergsd-contexts/ui/sidebar/review/contexts");

// 7. Realm list is live: a third realm (with a carrying item) appears in block 1
wiki.addTiddler({title: "$:/GSD/Realm/Side", tags: []});
wiki.addTiddler({title: "Side item", tags: ["$:/GSD/Action", "$:/GSD/Realm/Side"], gsd_status: "next"});
const grown = renderReview();
t("new realm adds a checkbox in block 1", grown[0].checkboxes, 4);
t("new realm named in block 1", grown[0].text.indexOf("Side") !== -1, true);

// 8. Visibility: a hidden entry drops out of the sidebar render
wiki.addTiddler({title: "$:/config/hypergsd/Review/visibility/$:/plugins/yan/hypergsd/ui/sidebar/review/action-dashboard", text: "hide"});
const hidden = renderReview();
t("hidden entry drops from its block", hidden[2].links, ["Actions waiting", "Actions completed"]);
wiki.deleteTiddler("$:/config/hypergsd/Review/visibility/$:/plugins/yan/hypergsd/ui/sidebar/review/action-dashboard");

// 9. The Sidebar settings tab: the four capture block lists, then the six review blocks
const sw = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki",
  G + '\n\n<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/control-panel/sidebar" $mode="block"/>\n\n</$importvariables>'),
  {document: doc, parentWidget: $tw.rootWidget});
const sc = doc.createElement("div"); sw.render(sc);
const tab = String(sc.children.length ? (function f(x) { let t = ""; (function g(y) { if (!y || typeof y !== "object") return; if (Array.isArray(y)) return y.forEach(g); t += (y.textContent || ""); (y.children || []).forEach(g); })(x); return t; })(sc.children[0] && sc.children[0].children ? sc.children : sc.children) : "");
const flat9 = tab.replace(/\s+/g, " ");
const order = ["Capture defaults", "New action, project and reference", "New contact and context", "Realm note", "Realm selection", "Dashboard", "Action links", "Project links", "Contexts and ticklers", "References, contacts and cleanup"];
t("sidebar tab: capture blocks first, then review blocks in numeric order",
  order.map((k, i) => [flat9.indexOf(k) !== -1, i === 0 || flat9.indexOf(order[i - 1]) < flat9.indexOf(k)]),
  order.map(() => [true, true]));
t("sidebar tab: capture member and review entry rows render",
  [flat9.indexOf("new action") !== -1, flat9.indexOf("Project dashboard") !== -1], [true, true]);

console.log(fails ? fails + " FAILURE(S)" : "ALL " + n + " PASS");
process.exit(fails ? 1 : 0);