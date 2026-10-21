// Cleanup archive/delete: the GSD/Cleanup page's type-scoped buttons. Archive
// renames completed actions/projects to $:/GSD/<title> through the core rename
// inside a TimestampDisable window, so fields and timestamps survive; delete
// removes them permanently. Both sit behind $action-confirm dialogs.
const { boot, makeRender, textOf, findAll, resetFixtures, t, finish } = require("./lib/harness");
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

// the buttons, identified by the procedure invocation their actions carry
const findButton = (w, needle) => {
  let found = null;
  (function f(n) {
    if (found || !n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(f);
    if (n.parseTreeNode && n.parseTreeNode.tag === "$button") {
      const a = n.parseTreeNode.attributes.actions;
      if (a && typeof a.value === "string" && a.value.indexOf(needle) !== -1) { found = n; return; }
    }
    (n.children || []).forEach(f);
  })(w.children);
  return found;
};
const ARCH_A = 'hgsd-cleanup-archive" item-type="Actions';
const ARCH_P = 'hgsd-cleanup-archive" item-type="Projects';
const DEL_A = 'hgsd-cleanup-delete" item-type="Actions';
const DEL_P = 'hgsd-cleanup-delete" item-type="Projects';
let confirmMessage = null;
const fire = (btn, ok) => btn.invokeActionString(btn.actions, btn, {type: "click",
  event: {view: {confirm: m => { confirmMessage = m; return ok !== false; }}}});
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

// ── 1. Buttons, confirmation, archive, timestamps ──────────────────────────
seed();
let r = render(PAGE, {mode: "block"});
let btn = findButton(r.w, ARCH_A), pbtn = findButton(r.w, ARCH_P),
    delBtn = findButton(r.w, DEL_A), delPBtn = findButton(r.w, DEL_P);
t("all four type-scoped buttons render", [!!btn, !!pbtn, !!delBtn, !!delPBtn], [true, true, true, true]);
t("show-archived checkbox label present", textOf(r.c).indexOf("Show archived items") !== -1, true);
t("no filter errors on the page", /Filter error/.test(textOf(r.c)), false);
t("eligible rows listed", [rows(r.c).indexOf("Old task") !== -1, rows(r.c).indexOf("P done") !== -1], [true, true]);
t("too-young item not listed", rows(r.c).indexOf("Fresh task") === -1, true);

// declining the confirmation changes nothing at all
fire(btn, false);
t("declined: nothing archived", [!!wiki.getTiddler("Old task"), !!wiki.getTiddler("$:/GSD/Old task")], [true, false]);
t("declined: TimestampDisable untouched", wiki.tiddlerExists("$:/config/TimestampDisable"), false);
t("actions confirm message is the lingo string", /Archive these completed actions\?/.test(confirmMessage || ""), true);

// the actions button archives only actions; the projects button only projects
fire(btn);
t("archived copy exists", !!wiki.getTiddler("$:/GSD/Old task"), true);
t("original gone", !!wiki.getTiddler("Old task"), false);
t("projects untouched by the actions button", !!wiki.getTiddler("P done"), true);
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

r = render(PAGE, {mode: "block"}); pbtn = findButton(r.w, ARCH_P);
fire(pbtn);
t("project archived by the projects button", [!!wiki.getTiddler("$:/GSD/P done"), !!wiki.getTiddler("P done")], [true, false]);
t("projects confirm message is the lingo string", /Archive these completed projects\?/.test(confirmMessage || ""), true);

// re-render: archived rows hidden by default. "Action" stays listed (and keeps the
// buttons eligible) BY DESIGN: the collision guard cannot archive it — its prefixed
// target IS the $:/GSD/Action tag tiddler — so the row remains visible and deletable.
r = render(PAGE, {mode: "block"});
t("archived rows hidden from cleanup lists", rows(r.c), ["Action"]);
t("collision-guarded item keeps the buttons rendered",
  [!!findButton(r.w, ARCH_A), !!findButton(r.w, DEL_A)], [true, true]);

// show-archived: rows return with delete buttons (delete stays available for them)
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
r = render(PAGE, {mode: "block"}); btn = findButton(r.w, ARCH_A);
// config default hide: the ONLY age-eligible action is parent-hidden, so the list is empty
// and the buttons withdraw with it (strict WYSIWYG — the gate carries the parent-condition too)
t("hide config: actions buttons hidden when only parent-hidden items qualify",
  [!!btn, !!findButton(r.w, DEL_A)], [false, false]);
t("uncompleted-parent config hide: action not archived", [!!wiki.getTiddler("Under live project"), !!wiki.getTiddler("$:/GSD/Under live project")], [true, false]);
wiki.addTiddler({title: "$:/config/hypergsd/cleanup-uncompleted-project-actions", text: "show"});
r = render(PAGE, {mode: "block"}); btn = findButton(r.w, ARCH_A);
t("show config: actions buttons back", !!btn, true);
fire(btn);
t("uncompleted-parent config show: action archived", [!!wiki.getTiddler("$:/GSD/Under live project"), !!wiki.getTiddler("Under live project")], [true, false]);

// prior TimestampDisable=yes must survive the batch (globally disabled users)
resetFixtures(wiki);
wiki.addTiddler({title: "$:/config/TimestampDisable", text: "yes"});
wiki.addTiddler({title: "Old one", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "true",
  gsd_comp_date: OLD, created: "20260101010101111", modified: "20260202020202222"});
r = render(PAGE, {mode: "block"}); btn = findButton(r.w, ARCH_A);
fire(btn);
t("prior TimestampDisable=yes restored", wiki.getTiddlerText("$:/config/TimestampDisable"), "yes");
t("archive still renames under global disable", !!wiki.getTiddler("$:/GSD/Old one"), true);

// ── 2b. The delete buttons: own confirmations, per type, story pruning ─────
resetFixtures(wiki);
wiki.addTiddler({title: "$:/StoryList", list: ["Del task", "GSD/Cleanup: completed items"]});
wiki.addTiddler({title: "P del", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "true", gsd_comp_date: OLD});
wiki.addTiddler({title: "Del task", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "true", gsd_comp_date: OLD, gsd_project: "P del", text: "body"});
wiki.addTiddler({title: "Keep task", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "true", gsd_comp_date: RECENT}); // too young
r = render(PAGE, {mode: "block"}); delBtn = findButton(r.w, DEL_A); delPBtn = findButton(r.w, DEL_P);
fire(delBtn, false);
t("delete declined: nothing removed", [!!wiki.getTiddler("Del task"), !!wiki.getTiddler("P del")], [true, true]);
t("delete declined: message is the delete lingo", /Delete these completed actions permanently\?/.test(confirmMessage || ""), true);
fire(delBtn);
t("actions delete confirmed: action gone, project kept", [!!wiki.getTiddler("Del task"), !!wiki.getTiddler("P del")], [false, true]);
t("actions delete confirmed: story pruned", wiki.getTiddlerList("$:/StoryList"), ["GSD/Cleanup: completed items"]);
fire(delPBtn);
t("projects delete confirmed: project gone", [!!wiki.getTiddler("P del"), !!wiki.getTiddler("Keep task")], [false, true]);
t("projects delete message is the lingo string", /Delete these completed projects permanently\?/.test(confirmMessage || ""), true);

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

// ── 4. Archive relinks dependency references ───────────────────────────────
resetFixtures(wiki);
wiki.addTiddler({title: "A prereq", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "true", gsd_comp_date: OLD});
wiki.addTiddler({title: "B dependent", tags: ["$:/GSD/Action"], gsd_status: "future", gsd_complete: "false",
  gsd_prerequisites: "[[A prereq]]", created: "20260101010101111", modified: "20260202020202222"});
wiki.addTiddler({title: "P project", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "true", gsd_comp_date: OLD});
wiki.addTiddler({title: "C child", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false",
  gsd_project: "P project", created: "20260101010101111", modified: "20260202020202222"});
wiki.addTiddler({title: "SP sub", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "false",
  gsd_project: "P project", created: "20260101010101111", modified: "20260202020202222"});
r = render(PAGE, {mode: "block"});
fire(findButton(r.w, ARCH_A));
fire(findButton(r.w, ARCH_P));
t("prerequisites relinked to the archived title",
  wiki.filterTiddlers("[[B dependent]get[gsd_prerequisites]enlist-input[]]"), ["$:/GSD/A prereq"]);
t("child action gsd_project relinked", wiki.getTiddler("C child").fields.gsd_project, "$:/GSD/P project");
t("subproject gsd_project relinked", wiki.getTiddler("SP sub").fields.gsd_project, "$:/GSD/P project");
t("stranded open action still surfaces in the open-actions cleanup filter",
  wiki.filterTiddlers("[tag[$:/GSD/Action]gsd_complete[false]] :filter[get[gsd_project]tag[$:/GSD/Project]gsd_complete[true]]"), ["C child"]);
t("relinked children keep their timestamps (writes inside the window)",
  [iso("B dependent", "modified"), iso("C child", "modified"), iso("SP sub", "modified")],
  ["2026-02-02T02:02:02.222Z", "2026-02-02T02:02:02.222Z", "2026-02-02T02:02:02.222Z"]);

// ── 5. Regression: the projects loop carries NO parent-condition (the live-wiki
// report — twelve completed subprojects under live parents, list showed them all,
// button archived one). Subprojects of live parents archive with the batch.
resetFixtures(wiki);
wiki.addTiddler({title: "Live parent", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "false"});
for (let i = 1; i <= 3; i++)
  wiki.addTiddler({title: "Done sub " + i, tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "true",
    gsd_comp_date: OLD, gsd_project: "Live parent", created: "20260101010101111", modified: "20260202020202222"});
wiki.addTiddler({title: "Done action under live parent", tags: ["$:/GSD/Action"], gsd_status: "next",
  gsd_complete: "true", gsd_comp_date: OLD, gsd_project: "Live parent"});
r = render(PAGE, {mode: "block"});
const listed = rows(r.c);
t("subprojects of live parents are listed",
  [listed.indexOf("Done sub 1") !== -1, listed.indexOf("Done sub 3") !== -1], [true, true]);
fire(findButton(r.w, ARCH_P));
t("projects button archives ALL listed subprojects",
  [!!wiki.getTiddler("$:/GSD/Done sub 1"), !!wiki.getTiddler("$:/GSD/Done sub 2"), !!wiki.getTiddler("$:/GSD/Done sub 3")],
  [true, true, true]);
t("live parent itself untouched (not completed)", !!wiki.getTiddler("Live parent"), true);
t("actions still honour the parent-condition (config hide)", !!wiki.getTiddler("Done action under live parent"), true);

finish("CLEANUP-ARCHIVE");
