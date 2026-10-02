// Cleanup: open actions under completed projects — the recovery half of the
// open-children completion warning. The list joins open actions to their
// project's completion state through the cleanup-actions :filter idiom.
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-wiki"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;

const PAGE = "GSD/Cleanup: open actions under completed projects";

// Fixtures — open rows carry gsd_complete "false" explicitly (the list filters on the positive test)
wiki.addTiddler({title: "P finished", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "true", gsd_comp_date: "20260901000000000"});
wiki.addTiddler({title: "A stranded next", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_project: "P finished"});
wiki.addTiddler({title: "A stranded waiting", tags: ["$:/GSD/Action"], gsd_status: "waiting", gsd_complete: "false", gsd_project: "P finished"});
wiki.addTiddler({title: "A done under finished", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "true", gsd_comp_date: "20260902000000000", gsd_project: "P finished"});
wiki.addTiddler({title: "SP stranded", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "false", gsd_project: "P finished"});
wiki.addTiddler({title: "P ongoing", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "false"});
wiki.addTiddler({title: "A normal", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_project: "P ongoing"});
wiki.addTiddler({title: "A dangling", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_project: "P deleted"});

const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';

let n = 0, fails = 0;
function t(name, got, want) {
  n++;
  if (Array.isArray(got) && want !== undefined && !Array.isArray(want)) got = JSON.stringify(got) === JSON.stringify(want);
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fails++;
    console.log("FAIL " + name + " got:" + JSON.stringify(got) + " want:" + JSON.stringify(want));
  }
}

function renderPage() {
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki",
    G + '\n\n<$transclude $tiddler="' + PAGE + '" $mode="block"/>\n\n</$importvariables>'),
    {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c);
  return {w, c};
}

function collect(c) {
  const out = {rows: [], groups: [], headings: [], text: "", strays: 0};
  (function f(x) {
    if (!x || typeof x !== "object") return;
    if (Array.isArray(x)) return x.forEach(f);
    if (x.isTiddlyWikiFakeDom) {
      const cls = (x.attributes || {}).class || "";
      if (x.tag === "a" && cls.indexOf("gsd-list-item-title") !== -1) out.rows.push(String(x.textContent || ""));
      if (cls.indexOf("hgsd-group-title") !== -1)
        out.groups.push((function tx(m) { let s = ""; (function g(y) { if (!y || typeof y !== "object") return; if (Array.isArray(y)) return y.forEach(g); if (y.isTiddlyWikiFakeDom) return (y.children || []).forEach(g); s += (y.textContent || ""); })(m); return s; })(x).trim());
      if (cls.indexOf("gsd-list-heading") !== -1)
        out.headings.push((function tx(m) { let s = ""; (function g(y) { if (!y || typeof y !== "object") return; if (Array.isArray(y)) return y.forEach(g); if (y.isTiddlyWikiFakeDom) return (y.children || []).forEach(g); s += (y.textContent || ""); })(m); return s; })(x).replace(/\s+/g, " ").trim());
      (x.children || []).forEach(f);
    } else if (String(x.textContent || "").trim() === ">") out.strays++;
  })(c.children);
  out.text = (function tx(m) { let s = ""; (function g(y) { if (!y || typeof y !== "object") return; if (Array.isArray(y)) return y.forEach(g); if (y.isTiddlyWikiFakeDom) return (y.children || []).forEach(g); s += (y.textContent || ""); })(m); return s; })(c);
  return out;
}

// 1. Composition: both stranded actions, nothing else
const first = renderPage();
const r1 = collect(first.c);
t("no filter errors, no stray markup", [r1.text.indexOf("Filter error") !== -1, r1.strays > 0], [false, false]);
t("list heading renders", r1.headings.indexOf("Incomplete actions under completed projects") !== -1, true);
t("message box explains the page", r1.text.indexOf("still open but their project is complete") !== -1, true);
t("stranded open actions of both statuses appear", r1.rows.indexOf("A stranded next") !== -1 && r1.rows.indexOf("A stranded waiting") !== -1, true);
t("completed action under finished project stays out", r1.rows.indexOf("A done under finished") !== -1, false);
t("open subproject under finished project stays out (actions only)", r1.rows.indexOf("SP stranded") !== -1, false);
t("action under active project stays out", r1.rows.indexOf("A normal") !== -1, false);
t("action pointing at a missing project stays out", r1.rows.indexOf("A dangling") !== -1, false);
t("grouped by the completed project", r1.groups, ["P finished"]);

// 2. Refresh gates: a project completing live must cross chassis and list gates
wiki.addTiddler({title: "P ongoing", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "true", gsd_comp_date: "20260920000000000"});
first.w.refresh({"P ongoing": {title: "P ongoing"}});
const r2 = collect(first.c);
t("completing a project surfaces its open actions live", r2.rows.indexOf("A normal") !== -1, true);
t("both completed projects now group their rows", r2.groups.sort(), ["P finished", "P ongoing"].sort());

// 3. Refresh gates: completing the stranded action retires its row live
wiki.addTiddler({title: "A stranded next", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "true", gsd_comp_date: "20260920000000001", gsd_project: "P finished"});
first.w.refresh({"A stranded next": {title: "A stranded next"}});
const r3 = collect(first.c);
t("completing the action retires its row", r3.rows.indexOf("A stranded next") !== -1, false);
t("sibling stranded action remains", r3.rows.indexOf("A stranded waiting") !== -1, true);

// 4. The Settings tab: page caption and the member's row caption
const sw = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki",
  G + '\n\n<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/control-panel/dashboards/cleanup-open-actions-list" $mode="block"/>\n\n</$importvariables>'),
  {document: doc, parentWidget: $tw.rootWidget});
const sc = doc.createElement("div"); sw.render(sc);
const s = collect(sc);
t("settings tab lists the member with caption only",
  [s.text.indexOf("Incomplete actions under completed projects") !== -1, s.text.indexOf("Incomplete actions in projects which are complete") !== -1],
  [true, false]);

console.log(fails ? fails + " FAILURE(S)" : "ALL " + n + " PASS");
process.exit(fails ? 1 : 0);