// Heading resolution: the list-heading parameter carries the declaration — a
// $:/ language title resolved through its tiddler's text, anything else taken
// literally, with the declaration itself as the fallthrough (a missing
// language tiddler renders its raw title instead of emptying). The member's
// hgsd-heading field feeds the Settings pickers and the strip-host
// derivations and must carry the identical declaration. Covers the
// dashboards, the project view, a literal declaration, direct invocation and
// the broken-reference skew.
"use strict";
const fs = require("fs");
const path = require("path");
const { boot, makeRender, textOf, findAll, resetFixtures, t, finish } = require("./lib/harness");
const { $tw, wiki, doc } = boot();
const render = makeRender(wiki, doc, $tw);

const headings = root => {
  const out = [];
  findAll(root, n => ((n.attributes || {}).class || "").indexOf("gsd-list-heading") !== -1)
    .forEach(n => out.push(textOf(n).replace(/\s+/g, " ").trim()));
  return out;
};

// Fixtures: a due tickler (positive gsd_complete per the fixture-row rule), a
// project with one next action, and a literal-declaration member.
const past = global.$tw.utils.stringifyDate(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()) - 5 * 86400000));
wiki.addTiddler({title: "TK due", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "false", gsd_tickler_date: past});
wiki.addTiddler({title: "P one", tags: "$:/GSD/Project", gsd_status: "active"});
wiki.addTiddler({title: "A next", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "false", gsd_project: "P one"});
wiki.addTiddler({title: "$:/plugins/yan/hypergsd-ticklers/ui/lists/probe-literal", tags: "$:/tags/hypergsd/Lists/Ticklers",
  text: '<$hgsd.list list-heading="My hardcoded list" list-filter="[tag[$:/GSD/Action]has[gsd_tickler_date]]" group-select="yes"/>'});

// Dashboards: every member resolves its declaration to the shipped heading
// text (the resolved text equals what the old {{...}} transclusions rendered,
// so state keys keep their values).
t("dashboard headings resolved", headings(render("GSD/Dashboard").c),
  ["Ticklers requiring action", "Next actions", "Active projects", "Future actions", "Future projects", "Waiting actions"]);
t("ticklers page headings resolved", headings(render("GSD/Ticklers").c),
  ["Ticklers requiring action", "Upcoming ticklers", "My hardcoded list"]);

// The project view hosts members through its own chassis: same resolution.
const project = render("$:/plugins/yan/hypergsd/ui/ViewTemplate/view-body-project", {variables: {currentTiddler: "P one"}}).c;
t("project view headings resolved", headings(project),
  ["Next actions", "Future actions", "Waiting actions", "References", "Sub-projects"]);

// Direct invocation: a literal declaration needs no language tiddler.
const direct = render("probe", {text:
  '<$hgsd.list list-heading="My direct literal" list-filter="[tag[$:/GSD/Action]has[gsd_tickler_date]]" group-select="yes"/>'}).c;
t("direct invocation literal declaration", headings(direct), ["My direct literal"]);

// The skew: an emptied language shadow (the deployed-mismatch shape) must
// render the raw declaration — visible, greppable — with rows intact.
resetFixtures(wiki);
wiki.addTiddler({title: "TK due", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "false", gsd_tickler_date: past});
wiki.addTiddler({title: "$:/language/hypergsd/Lists/Ticklers/Requiring", text: ""});
const skewed = render("GSD/Dashboard").c;
t("broken lingo renders the raw title", headings(skewed).indexOf("$:/language/hypergsd/Lists/Ticklers/Requiring") !== -1, true);
t("broken lingo keeps the row", textOf(skewed).indexOf("TK due") !== -1, true);

// Guard: no filter-error literal anywhere in the renders above (a broken
// derivation would surface as text, not a failure).
resetFixtures(wiki);
t("no filter errors in any render",
  ["GSD/Dashboard", "GSD/Ticklers"].reduce((acc, page) => acc + (textOf(render(page).c).match(/Filter error/g) || []).length, 0), 0);

// Consistency sweep: every shipped $hgsd.list invocation's list-heading
// declaration equals its file's hgsd-heading field (the two surfaces share
// one identity — divergence silently unhooks Settings pickers and strips).
{
  const root = path.join(__dirname, "..", "plugins");
  const mismatches = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith(".tid")) continue;
      const src = fs.readFileSync(full, "utf8");
      const field = (src.match(/^hgsd-heading: (.+)$/m) || [])[1];
      const param = ((src.match(/list-heading="?([^\s"]+)/) || [])[1] || "").trim();
      if (param !== "" && field !== undefined && param !== field.trim())
        mismatches.push(path.relative(root, full) + " param=" + param + " field=" + field);
      if (param !== "" && field === undefined)
        mismatches.push(path.relative(root, full) + " has list-heading but no hgsd-heading field");
    }
  })(root);
  t("shipped members: param declaration equals field", mismatches, []);
}

finish("HEADING-RESOLUTION");
