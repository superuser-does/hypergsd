// Drawers/GSD (site-edition drawer view): the grouping strip offers the two
// candidate dimensions while present and not withdrawn — Settings withdrawal
// drops the Priority radio and re-falls the default and the sort with no edit.
// The absent-plugin degradation lives in drawer-gsd-absent-test.js (one wiki
// boot per file). The drawer tiddler is mounted as real content so its own
// \import pragmas process through block transclusion (the page-level mount shape).
"use strict";
const fs = require("fs");
const path = require("path");
const { boot, makeRender, textOf, findAll, t, finish, REPO } = require("./lib/harness");

const { $tw, wiki, doc } = boot();
const render = makeRender(wiki, doc, $tw);

const raw = fs.readFileSync(path.join(REPO, "editions/site/tiddlers/Drawers_GSD.tid"), "utf8");
wiki.addTiddler({title: "Drawers/GSD", text: raw.substring(raw.indexOf("\n\n") + 2), type: "text/vnd.tiddlywiki"});

const PRIORITY_MEMBER = "$:/plugins/yan/hypergsd-priorities/ui/group-by/priority";
const PROJECT_MEMBER = "$:/plugins/yan/hypergsd/ui/group-by/project";
const VIEW_STATE = "$:/config/hypergsd/list-view/GSD drawer actions/Actions";
const HIDDEN = "$:/config/hypergsd/GroupBy/hidden/" + PRIORITY_MEMBER;
const NO_GROUP = () => wiki.getTiddlerText("$:/language/hypergsd/Lists/NoGroup");

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

// two active projects; P one holds next a/b/c by priority plus a waiting row
// that must trail every next row; P two holds one next row
wiki.addTiddler({title: "ZZ P one", tags: ["$:/GSD/Project"], gsd_status: "active"});
wiki.addTiddler({title: "ZZ P two", tags: ["$:/GSD/Project"], gsd_status: "active"});
wiki.addTiddler({title: "ZZ P1-a", tags: ["$:/GSD/Action"], gsd_complete: "false", gsd_status: "next", gsd_project: "ZZ P one", gsd_priority: "A"});
wiki.addTiddler({title: "ZZ P1-b", tags: ["$:/GSD/Action"], gsd_complete: "false", gsd_status: "next", gsd_project: "ZZ P one", gsd_priority: "B"});
wiki.addTiddler({title: "ZZ P1-c", tags: ["$:/GSD/Action"], gsd_complete: "false", gsd_status: "next", gsd_project: "ZZ P one", gsd_priority: "C"});
wiki.addTiddler({title: "ZZ P1-w", tags: ["$:/GSD/Action"], gsd_complete: "false", gsd_status: "waiting", gsd_project: "ZZ P one", gsd_priority: "A"});
wiki.addTiddler({title: "ZZ P2-a", tags: ["$:/GSD/Action"], gsd_complete: "false", gsd_status: "next", gsd_project: "ZZ P two"});

// pristine: both radios, Priority selected by default, priority grouping
let r = renderDrawer();
t("no Filter error in render", r.text.indexOf("Filter error") === -1, true);
t("no stray > text nodes", r.strays, 0);
t("two radios: Priority then Projects", r.radios.map(x => x.label), ["Priority", "Projects"]);
t("default selection is Priority", r.radios.filter(x => x.selected).map(x => x.label), ["Priority"]);
t("default grouping: High, Medium, Low, No group", r.headings, ["High", "Medium", "Low", NO_GROUP()]);
t("priority row select offered in rows", findAll(render("Drawers/GSD", {mode: "block"}).c, n => n.tag === "select" && (n.attributes.class || "").indexOf("hgsd-priority-select") !== -1).length > 0, true);

// project view state: project grouping, rows ordered status → priority → title
wiki.addTiddler({title: VIEW_STATE, "hgsd-group": PROJECT_MEMBER, "hgsd-ungrouped": "yes", type: "text/vnd.tiddlywiki"});
r = renderDrawer();
t("project choice: Projects selected", r.radios.filter(x => x.selected).map(x => x.label), ["Projects"]);
t("project grouping headings", r.headings, ["ZZ P one", "ZZ P two"]);
t("rows in P one: next a/b/c by priority, waiting last", r.rowsIn(r.groupBlocks[0]), ["ZZ P1-a", "ZZ P1-b", "ZZ P1-c", "ZZ P1-w"]);

// Settings withdraws Priority: radio gone, a stored priority choice falls to Projects
wiki.addTiddler({title: VIEW_STATE, "hgsd-group": PRIORITY_MEMBER, "hgsd-ungrouped": "yes", type: "text/vnd.tiddlywiki"});
wiki.addTiddler({title: HIDDEN, text: "hide", type: "text/vnd.tiddlywiki"});
r = renderDrawer();
t("hidden Priority: one radio left", r.radios.map(x => x.label), ["Projects"]);
// the stored value names a non-offered member: no radio checks (field beats default; the engine strip behaves identically) until the next click heals the state
 t("hidden Priority with stale choice: no radio checked (engine parity)", r.radios.filter(x => x.selected).length, 0);
t("hidden Priority with stale priority choice: project grouping", r.headings, ["ZZ P one", "ZZ P two"]);
t("hidden Priority: no Filter error", r.text.indexOf("Filter error") === -1, true);

// hidden Priority with no stored choice: default falls to Projects
wiki.deleteTiddler(VIEW_STATE);
r = renderDrawer();
t("hidden Priority, no choice: Projects default selected", r.radios.filter(x => x.selected).map(x => x.label), ["Projects"]);
t("hidden Priority, no choice: project grouping", r.headings, ["ZZ P one", "ZZ P two"]);

// the documented manual edit: delete the priority candidate run from the offered-members filter —
// grouping, ordering AND the row select all withdraw (drawer-local removal, plugin still installed)
const edited = raw.substring(raw.indexOf("\n\n") + 2).replace("[<priority-member>] [<project-member>]", "[<project-member>]");
wiki.deleteTiddler(HIDDEN);
wiki.addTiddler({title: "Drawers/GSD", text: edited, type: "text/vnd.tiddlywiki"});
r = renderDrawer();
t("edited filter: one radio left", r.radios.map(x => x.label), ["Projects"]);
t("edited filter: project grouping", r.headings, ["ZZ P one", "ZZ P two"]);
t("edited filter: no priority row select in rows", findAll(render("Drawers/GSD", {mode: "block"}).c, n => n.tag === "select" && (n.attributes.class || "").indexOf("hgsd-priority-select") !== -1).length, 0);
t("edited filter: no Filter error", r.text.indexOf("Filter error") === -1, true);

["ZZ P1-a", "ZZ P1-b", "ZZ P1-c", "ZZ P1-w", "ZZ P2-a", "ZZ P one", "ZZ P two", VIEW_STATE, HIDDEN, "Drawers/GSD"].forEach(x => wiki.deleteTiddler(x));
finish("DRAWER-GSD");
