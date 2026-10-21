// Cleanup archive: the GSD/Cleanup button renames completed items to
// $:/GSD/<title> through the core rename inside a TimestampDisable window, so
// fields and timestamps survive. Also covers the archived-row hiding/showing
// and the !is[system] exclusions on the other completed lists.
const { boot, makeRender, textOf, findAll, findByClass, resetFixtures, t, finish } = require("./lib/harness");
const { $tw, wiki, doc } = boot();
const render = makeRender(wiki, doc, $tw);

// rootwidget.js's tm-rename-tiddler handler is platforms:["browser"] — the real
// wiki registers it at startup; mirror it verbatim for the headless battery.
$tw.rootWidget.addEventListener("tm-rename-tiddler", function(event) {
  var options = {}, paramObject = event.paramObject || {},
      from = paramObject.from || event.tiddlerTitle, to = paramObject.to;
  options.dontRenameInTags = (paramObject.renameInTags === "false" || paramObject.renameInTags === "no");
  options.dontRenameInLists = (paramObject.renameInLists === "false" || paramObject.renameInLists === "no");
  $tw.wiki.renameTiddler(from, to, options);
});

const PAGE = "GSD/Cleanup: completed items";
const OLD = "20200101000000000", RECENT = "29991231235959999";

// the archive button widget (class-marked), from the widget tree
const findArchiveButton = (w) => {
  let found = null;
  (function f(n) {
    if (found || !n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(f);
    if (n.parseTreeNode && n.parseTreeNode.tag === "$button" &&
        (n.parseTreeNode.attributes.class || "").value.indexOf("hgsd-cleanup-archive") !== -1) { found = n; return; }
    (n.children || []).forEach(f);
  })(w.children);
  return found;
};
const fire = (btn) => btn.invokeActionString(btn.actions, btn, {type: "click"});
// row titles = the engine's title links (fakeDOM elements carry textContent directly)
const rows = (c) => findAll(c, n => n.tag === "a" && ((n.attributes || {}).class || "").indexOf("gsd-list-item-title") !== -1)
  .map(n => String(n.textContent || ""));

function seed() {
  wiki.addTiddler({title: "P done", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "true", gsd_comp_date: OLD});
  wiki.addTiddler({title: "Old task", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "true", gsd_comp_date: OLD,
    gsd_project: "P done", created: "20260101010101111", modified: "20260202020202222", modifier: "yan", text: "body"});
  wiki.addTiddler({title: "Fresh task", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "true", gsd_comp_date: RECENT});
  wiki.addTiddler({title: "Action", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "true", gsd_comp_date: OLD});
  wiki.addTiddler({title: "Open task", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false"});
}
const iso = (title, field) => { const f = wiki.getTiddler(title).fields[field]; return f instanceof Date ? f.toISOString() : String(f); };

// ── 1. Button, archive, timestamps ──────────────────────────────────────────
seed();
let r = render(PAGE, {mode: "block"});
let btn = findArchiveButton(r.w);
t("button renders with eligible items", !!btn, true);
t("show-archived checkbox label present", textOf(r.c).indexOf("Show archived items") !== -1, true);
t("no filter errors on the page", /Filter error/.test(textOf(r.c)), false);
t("eligible rows listed", [rows(r.c).indexOf("Old task") !== -1, rows(r.c).indexOf("P done") !== -1], [true, true]);
t("too-young item not listed", rows(r.c).indexOf("Fresh task") === -1, true);

fire(btn);
t("archived copy exists", !!wiki.getTiddler("$:/GSD/Old task"), true);
t("original gone", !!wiki.getTiddler("Old task"), false);
t("project archived too", [!!wiki.getTiddler("$:/GSD/P done"), !!wiki.getTiddler("P done")], [true, false]);
t("timestamps untouched", [iso("$:/GSD/Old task", "created"), iso("$:/GSD/Old task", "modified")],
  ["2026-01-01T01:01:01.111Z", "2026-02-02T02:02:02.222Z"]);
t("fields survive the rename", [
  wiki.getTiddler("$:/GSD/Old task").fields.modifier,
  wiki.getTiddler("$:/GSD/Old task").fields.text,
  wiki.getTiddler("$:/GSD/Old task").fields.tags.join(" "),
  wiki.getTiddler("$:/GSD/Old task").fields.gsd_comp_date
], ["yan", "body", "$:/GSD/Action", OLD]);
t("too-young item untouched", !!wiki.getTiddler("Fresh task"), true);
t("collision guard: item named Action untouched", !!wiki.getTiddler("Action"), true);
t("collision guard: $:/GSD/Action shadow not overwritten", wiki.tiddlerExists("$:/GSD/Action"), false);
t("open items untouched", !!wiki.getTiddler("Open task"), true);
t("TimestampDisable restored (not yes)", wiki.getTiddlerText("$:/config/TimestampDisable", "").toLowerCase() === "yes", false);
wiki.setText("Stamp probe", "text", undefined, "x");
t("timestamps live again after the batch", !!wiki.getTiddler("Stamp probe").fields.modified, true);

// re-render: archived rows hidden by default. "Action" stays listed (and keeps the button
// eligible) BY DESIGN: the collision guard cannot archive it — its prefixed target IS the
// $:/GSD/Action tag tiddler — so the row remains visible and deletable instead of vanishing silently.
r = render(PAGE, {mode: "block"});
t("archived rows hidden from cleanup lists", rows(r.c), ["Action"]);
t("collision-guarded item keeps the button rendered", !!findArchiveButton(r.w), true);

// show-archived: rows return with delete buttons (delete stays available for them)
wiki.addTiddler({title: "Action2 cleanup", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "true", gsd_comp_date: OLD});
wiki.renameTiddler("Action2 cleanup", "$:/GSD/Action2 cleanup");
wiki.addTiddler({title: "$:/config/hypergsd/cleanup-archived-items", text: "show"});
r = render(PAGE, {mode: "block"});
const archivedRows = rows(r.c);
t("show-archived: archived rows listed", [archivedRows.indexOf("$:/GSD/Old task") !== -1, archivedRows.indexOf("$:/GSD/P done") !== -1], [true, true]);
t("show-archived: fresh task still age-gated out", archivedRows.indexOf("Fresh task") === -1, true);
const deleteButtons = findAll(r.c, n => n.tag === "button" && (n.attributes || {})["data-hgsd-action"] === "delete");
t("archived rows keep their delete button", deleteButtons.length >= 2, true);

// ── 2. Parent-condition parity and prior-timestamp respect ─────────────────
resetFixtures(wiki);
wiki.addTiddler({title: "P ongoing", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "false"});
wiki.addTiddler({title: "Under live project", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "true",
  gsd_comp_date: OLD, gsd_project: "P ongoing", created: "20260101010101111", modified: "20260202020202222"});
r = render(PAGE, {mode: "block"}); btn = findArchiveButton(r.w);
fire(btn); // config default hide: actions of uncompleted projects are not archived
t("uncompleted-parent config hide: action not archived", [!!wiki.getTiddler("Under live project"), !!wiki.getTiddler("$:/GSD/Under live project")], [true, false]);
wiki.addTiddler({title: "$:/config/hypergsd/cleanup-uncompleted-project-actions", text: "show"});
r = render(PAGE, {mode: "block"}); btn = findArchiveButton(r.w);
fire(btn);
t("uncompleted-parent config show: action archived", [!!wiki.getTiddler("$:/GSD/Under live project"), !!wiki.getTiddler("Under live project")], [true, false]);

// prior TimestampDisable=yes must survive the batch (globally disabled users)
resetFixtures(wiki);
wiki.addTiddler({title: "$:/config/TimestampDisable", text: "yes"});
wiki.addTiddler({title: "Old one", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "true",
  gsd_comp_date: OLD, created: "20260101010101111", modified: "20260202020202222"});
r = render(PAGE, {mode: "block"}); btn = findArchiveButton(r.w);
fire(btn);
t("prior TimestampDisable=yes restored", wiki.getTiddlerText("$:/config/TimestampDisable"), "yes");
t("archive still renames under global disable", !!wiki.getTiddler("$:/GSD/Old one"), true);

// ── 3. Other completed lists exclude archived rows ──────────────────────────
resetFixtures(wiki);
wiki.addTiddler({title: "Live project", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "false"});
wiki.addTiddler({title: "Ann Contact", tags: ["$:/GSD/Contact"], gsd_complete: "false"});
wiki.addTiddler({title: "Plain done", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "true", gsd_comp_date: OLD,
  gsd_project: "Live project", gsd_contact: "Ann Contact"});
wiki.addTiddler({title: "Archived done", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "true", gsd_comp_date: OLD,
  gsd_project: "Live project", gsd_contact: "Ann Contact"});
wiki.renameTiddler("Archived done", "$:/GSD/Archived done"); // the archive button's output shape

// completed-action-list (state: actions@<host>)
wiki.addTiddler({title: "$:/state/hypergsd/show-completed/actions@GSD/Test", text: "show"});
let lr = render("$:/plugins/yan/hypergsd/ui/lists/completed-action-list", {mode: "block"});
t("completed-action-list: plain done listed, archived done excluded",
  [rows(lr.c).indexOf("Plain done") !== -1, rows(lr.c).indexOf("$:/GSD/Archived done") !== -1], [true, false]);
deleteButtons;
let cp = findAll(lr.c, n => n.tag === "button" && (n.attributes || {})["data-hgsd-action"] === "delete");
t("completed-action-list rows keep delete buttons", cp.length >= 1, true);

// completed-project-list (state: projects@<host>)
wiki.addTiddler({title: "Plain project done", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "true", gsd_comp_date: OLD});
wiki.addTiddler({title: "$:/GSD/Archived project done", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "true", gsd_comp_date: OLD});
wiki.addTiddler({title: "$:/state/hypergsd/show-completed/projects@GSD/Test", text: "show"});
lr = render("$:/plugins/yan/hypergsd/ui/lists/completed-project-list", {mode: "block"});
t("completed-project-list: archived project excluded",
  [rows(lr.c).indexOf("Plain project done") !== -1, rows(lr.c).indexOf("$:/GSD/Archived project done") !== -1], [true, false]);

// project-view completed-actions (toggle state derived from the project title)
wiki.addTiddler({title: "$:/state/hypergsd/show-completed/Live project", text: "show"});
lr = render(undefined, {text: '<$set name="section-target" value="Live project"><$set name="currentTiddler" value="Live project"><$transclude $tiddler="$:/plugins/yan/hypergsd/ui/project-view/completed-actions" $mode="block"/></$set></$set>'});
t("project-view: archived action of the project excluded",
  [rows(lr.c).indexOf("Plain done") !== -1, rows(lr.c).indexOf("$:/GSD/Archived done") !== -1], [true, false]);

// contacts list (toggle state derived from the contact title)
wiki.addTiddler({title: "$:/state/hypergsd/show-completed/Ann Contact", text: "show"});
lr = render("$:/plugins/yan/hypergsd-contacts/ui/lists/contact-completed-action-list", {mode: "block", variables: {currentTiddler: "Ann Contact"}});
t("contact list: archived action excluded",
  [rows(lr.c).indexOf("Plain done") !== -1, rows(lr.c).indexOf("$:/GSD/Archived done") !== -1], [true, false]);

finish("CLEANUP-ARCHIVE");
