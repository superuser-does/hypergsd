// Review sidebar portion tag list: $:/tags/hypergsd/Review members render
// grouped by their Portion/<n> tag (1 realm selection, 2 the dashboard link,
// 3 the action links, 4 the project links, 7 references/ticklers,
// 8 contexts/contacts, 9 the cleanup pair — 7-9 ship deliberately, leaving
// 5-6 free for later additions) — within-portion order is the engine's
// sortByList (the tag list's list field first, then member pins, then engine
// registration order — the sub-plugin pairs in 7 and 8 ride engine order,
// no core anchor lives in those portions), entries ship in their owning
// plugin. Realm selection must render live inside portion 1 (checkboxes,
// all/none, the no-realm sentinel).
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
  const portions = [];
  (function f(x) { if (!x || typeof x !== "object") return; if (Array.isArray(x)) return x.forEach(f);
    if (x.isTiddlyWikiFakeDom) {
      const cls = (x.attributes || {}).class || "";
      if (cls.indexOf("hgsd-sidebar-portions") !== -1) {
        (x.children || []).forEach(function(div) {
          if (!div.isTiddlyWikiFakeDom || div.tag !== "div") return;
          const p = {text: String(div.textContent || ""), checkboxes: 0, links: []};
          (function g(y) { if (!y || typeof y !== "object") return; if (Array.isArray(y)) return y.forEach(g);
            if (y.isTiddlyWikiFakeDom) {
              if (y.tag === "input") p.checkboxes++;
              if (y.tag === "a") p.links.push(String(y.textContent || ""));
              (y.children || []).forEach(g);
            } })(div);
          portions.push(p);
        });
      }
      (x.children || []).forEach(f);
    } })(c.children);
  return portions;
}

const portions = renderReview();

t("seven portions render", portions.length, 7);

// 1. Realm selection, live in portion 1
t("portion 1 is the realm-selection fieldset: legend, all/none, both realms, the no-realm sentinel",
  [portions[0].text.indexOf("Select realms:") !== -1,
   portions[0].text.indexOf("all") !== -1 && portions[0].text.indexOf("none") !== -1,
   portions[0].text.indexOf("Home") !== -1 && portions[0].text.indexOf("Work") !== -1,
   portions[0].text.indexOf("Items not in a realm") !== -1],
  [true, true, true, true]);
t("realm checkboxes: one per realm plus the no-realm sentinel", portions[0].checkboxes, 3);
t("portion 1 has no page links", portions[0].links, []);

// 2-4. Core link portions, in the list-field order
t("portion 2 is the dashboard link", portions[1].links, ["Dashboard"]);
t("portion 3 order", portions[2].links, ["Action dashboard", "Actions waiting", "Actions completed"]);
t("portion 4 order", portions[3].links, ["Project dashboard", "Projects without next actions", "Projects completed"]);

// 5-9. Sub-plugin portions 7 and 8 plus the core cleanup pair in 9 (7-9 ship
// deliberately, leaving 5-6 free); the pairs in 7 and 8 ride engine
// registration order — no pin and no core anchor lives in those portions
t("portion 7 order", portions[4].links, ["References", "Ticklers"]);
t("portion 8 order", portions[5].links, ["Contacts", "Contexts"]);
t("portion 9 holds the cleanup pair",
  portions[6].links, ["Cleanup: completed items", "Cleanup: open actions under completed projects"]);

// 6. Absence: an empty override of the contexts entry drops it, Contacts stays
wiki.addTiddler({title: "$:/plugins/yan/hypergsd-contexts/ui/sidebar/review/contexts"});
const after = renderReview();
t("overridden-empty entry: portion 8 keeps only Contacts", after[5].links, ["Contacts"]);
t("other portions unaffected by the override", [after.length, after[2].links, after[6].links],
  [7, ["Action dashboard", "Actions waiting", "Actions completed"], ["Cleanup: completed items", "Cleanup: open actions under completed projects"]]);
wiki.deleteTiddler("$:/plugins/yan/hypergsd-contexts/ui/sidebar/review/contexts");

// 7. Realm list is live: a third realm (with a carrying item) appears in portion 1
wiki.addTiddler({title: "$:/GSD/Realm/Side", tags: []});
wiki.addTiddler({title: "Side item", tags: ["$:/GSD/Action", "$:/GSD/Realm/Side"], gsd_status: "next"});
const grown = renderReview();
t("new realm adds a checkbox in portion 1", grown[0].checkboxes, 4);
t("new realm named in portion 1", grown[0].text.indexOf("Side") !== -1, true);

// 8. Visibility: a hidden entry drops out of the sidebar render
wiki.addTiddler({title: "$:/config/hypergsd/Review/visibility/$:/plugins/yan/hypergsd/ui/sidebar/review/action-dashboard", text: "hide"});
const hidden = renderReview();
t("hidden entry drops from its portion", hidden[2].links, ["Actions waiting", "Actions completed"]);
wiki.deleteTiddler("$:/config/hypergsd/Review/visibility/$:/plugins/yan/hypergsd/ui/sidebar/review/action-dashboard");

// 9. The Sidebar settings tab: one draggable per sidebar, tag-basis note with the numbered
// portion sentence, a Portion picker on every row (numbers only — no band labels)
const sw = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki",
  G + '\n\n<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/control-panel/sidebar" $mode="block"/>\n\n</$importvariables>'),
  {document: doc, parentWidget: $tw.rootWidget});
const sc = doc.createElement("div"); sw.render(sc);
const flat9 = (function f(x) { let t = ""; (function g(y) { if (!y || typeof y !== "object") return; if (Array.isArray(y)) return y.forEach(g); t += (y.textContent || ""); (y.children || []).forEach(g); })(x); return t.replace(/\s+/g, " "); })(sc);
t("sidebar tab: both tag-basis notes render with their tag pills",
  [flat9.indexOf("Tiddlers tagged with $:/tags/hypergsd/Capture") !== -1,
   flat9.indexOf("Tiddlers tagged with $:/tags/hypergsd/Review") !== -1],
  [true, true]);
t("sidebar tab: the numbered portion sentence renders (no Top/Full slots)",
  [flat9.indexOf("such as Portion/1, to this tag") !== -1,
   flat9.indexOf("Top, full-width"), flat9.indexOf("Bottom, full-width")],
  [true, -1, -1]);
t("sidebar tab: capture heading precedes review heading, member rows render",
  [flat9.indexOf("Capture sidebar tab") < flat9.indexOf("Review sidebar tab"),
   flat9.indexOf("new action") !== -1, flat9.indexOf("Project dashboard") !== -1],
  [true, true, true]);
t("sidebar tab: the realm-selection and dashboard rows carry their own captions",
  [flat9.indexOf("Realm selection – ") !== -1, flat9.indexOf("Dashboard – ") !== -1], [true, true]);
// every picker option label is a number: 1..9 and the next-free 10 on the review list
const pickOptions = [];
(function f(x) { if (!x || typeof x !== "object") return; if (Array.isArray(x)) return x.forEach(f);
  if (x.isTiddlyWikiFakeDom && x.tag === "select") {
    (x.children || []).forEach(function(o) {
      if (o.tag === "option") pickOptions.push(String(o.textContent || ""));
    });
  }
  (x.children || []).forEach(f); })(sc.children);
t("portion picker options are all numbers (review offers next-free 10 past the shipped 9)",
  [pickOptions.length > 0, pickOptions.indexOf("10") !== -1, pickOptions.every(function(o) { return /^[0-9]+$/.test(o); })],
  [true, true, true]);

console.log(fails ? fails + " FAILURE(S)" : "ALL " + n + " PASS");
process.exit(fails ? 1 : 0);
