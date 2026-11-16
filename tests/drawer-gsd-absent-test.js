// Drawers/GSD absent-plugin degradation: priorities uninstalled — the strip
// offers Projects alone, a stale priority view state and stale gsd_priority
// fields order nothing, and the grouping falls to Projects (drawer-gsd-test.js
// covers the present-plugin surface).
"use strict";
const fs = require("fs");
const path = require("path");
const { boot, makeRender, textOf, findAll, t, finish, REPO } = require("./lib/harness");

const { $tw, wiki, doc } = boot("fixture-absent");
const render = makeRender(wiki, doc, $tw);

const raw = fs.readFileSync(path.join(REPO, "editions/site/tiddlers/Drawers_GSD.tid"), "utf8");
wiki.addTiddler({title: "Drawers/GSD", text: raw.substring(raw.indexOf("\n\n") + 2), type: "text/vnd.tiddlywiki"});

const PRIORITY_MEMBER = "$:/plugins/yan/hypergsd-priorities/ui/group-by/priority";
const VIEW_STATE = "$:/config/hypergsd/list-view/GSD drawer actions/Actions";

function renderDrawer() {
  const { c } = render("Drawers/GSD", {mode: "block"});
  const radios = findAll(c, n => (n.attributes.class || "").indexOf("tc-radio") !== -1)
    .map(n => ({label: textOf(n.children).trim(), selected: n.attributes.class.indexOf("tc-radio-selected") !== -1}));
  const headings = findAll(c, n => n.attributes.class === "hgsd-group-title").map(n => textOf(n.children).trim());
  const rowsIn = block => findAll(block, n => (n.attributes.class || "").indexOf("gsd-list-item-title") !== -1)
    .map(n => textOf(n.children).trim()).filter(x => x.indexOf("ZZ ") !== -1);
  const groupBlocks = findAll(c, n => (n.attributes.class || "").indexOf("hgsd-project-list") !== -1);
  const strays = findAll(c, n => !n.isTiddlyWikiFakeDom && (n.textContent || "").trim() === ">").length;
  return {text: textOf(c), radios, headings, groupBlocks, rowsIn, strays};
}

wiki.addTiddler({title: "ZZ P one", tags: ["$:/GSD/Project"], gsd_status: "active"});
wiki.addTiddler({title: "ZZ P1-a", tags: ["$:/GSD/Action"], gsd_complete: "false", gsd_status: "next", gsd_project: "ZZ P one", gsd_priority: "C"});
wiki.addTiddler({title: "ZZ P1-b", tags: ["$:/GSD/Action"], gsd_complete: "false", gsd_status: "next", gsd_project: "ZZ P one", gsd_priority: "A"});
wiki.addTiddler({title: "ZZ P1-w", tags: ["$:/GSD/Action"], gsd_complete: "false", gsd_status: "waiting", gsd_project: "ZZ P one", gsd_priority: "A"});

// stale priority view state: Projects alone offered and selected, project grouping
wiki.addTiddler({title: VIEW_STATE, "hgsd-group": PRIORITY_MEMBER, "hgsd-ungrouped": "yes", type: "text/vnd.tiddlywiki"});
let r = renderDrawer();
t("no Filter error in render", r.text.indexOf("Filter error") === -1, true);
t("no stray > text nodes", r.strays, 0);
t("one radio: Projects only", r.radios.map(x => x.label), ["Projects"]);
// the stale stored value matches no radio: field beats default (engine strip parity); the next click heals the state
 t("stale choice: no radio checked (engine parity)", r.radios.filter(x => x.selected).length, 0);
t("stale priority choice falls to project grouping", r.headings, ["ZZ P one"]);
t("rows ignore stale gsd_priority (title order, waiting last)", r.rowsIn(r.groupBlocks[0]), ["ZZ P1-a", "ZZ P1-b", "ZZ P1-w"]);

// no view state: same fallback
wiki.deleteTiddler(VIEW_STATE);
r = renderDrawer();
t("no choice: Projects default, project grouping", r.headings, ["ZZ P one"]);

["ZZ P1-a", "ZZ P1-b", "ZZ P1-w", "ZZ P one", "Drawers/GSD"].forEach(x => wiki.deleteTiddler(x));
finish("DRAWER-GSD-ABSENT");
