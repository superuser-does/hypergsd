// Panel folding: foldable sections render inside a reveal keyed on the tiddler's
// CORE fold state ($:/state/folded/<title>), so the built-in fold bar / toolbar
// fold button folds body and panel together. Covers the shipped show defaults
// (Status, Complete), the wrap/no-wrap split, the hidden attribute when folded,
// the per-section config override, the Settings row select, and the two refresh
// gates admitting the state prefix (a frozen panel would otherwise ignore the
// toggle — the silent-failure route this guards).
"use strict";
const harness = require("./lib/harness");
const { $tw, wiki, doc } = harness.boot();
const render = harness.makeRender(wiki, doc, $tw);

const VIEW_BODY = "$:/plugins/yan/hypergsd/ui/ViewTemplate/view-body";
const SLOT_MODULE = "$:/plugins/yan/hypergsd/modules/view-body-slot";
const STATUS = "$:/plugins/yan/hypergsd/ui/attributes/status";
const COMPLETE = "$:/plugins/yan/hypergsd/ui/panel/complete";
const PROJECT = "$:/plugins/yan/hypergsd/ui/attributes/project";
const PRIORITY = "$:/plugins/yan/hypergsd-priorities/ui/panel/priority";
const CFG = "$:/config/hypergsdPanel/folded/";
const STATE = "$:/state/folded/Host action";

const resetFixtures = () => harness.resetFixtures(wiki);
const t = harness.t;
const finish = harness.finish;
const textOf = harness.textOf;

// Widget-tree walker: every $reveal widget whose stateTitle is the fold state.
const foldReveals = w => {
  const out = [];
  (function f(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(f);
    if (n.parseTreeNode && n.parseTreeNode.tag === "$reveal") {
      if (n.stateTitle === STATE) out.push(n);
      return;                                       // nested reveals (popups) belong to their members
    }
    (n.children || []).forEach(f);
  })(w.children);
  return out;
};
// DOM walker: does this node sit inside a fold-slot wrapper?
const inFoldSlot = n => {
  for (let p = n; p; p = p.parentNode) {
    if (p.isTiddlyWikiFakeDom && p.attributes && (p.attributes.class || "").indexOf("hgsd-fold-slot") !== -1) return true;
  }
  return false;
};
const findAll = (n, pred) => {
  const out = [];
  (function f(x) {
    if (!x || typeof x !== "object") return;
    if (Array.isArray(x)) return x.forEach(f);
    if (x.isTiddlyWikiFakeDom) { if (pred(x)) out.push(x); (x.children || []).forEach(f); }
  })(n);
  return out;
};

// ── shipped defaults (ui/config/panel-fold/defaults.multids) ─────────────────
t("shipped defaults: status, complete and the sub-plugin priority Shown; the rest default hide", [
  wiki.getTiddlerText(CFG + STATUS),
  wiki.getTiddlerText(CFG + COMPLETE),
  wiki.getTiddlerText(CFG + PRIORITY),
  wiki.getTiddlerText(CFG + PROJECT)], ["show", "show", "show", null]);

// ── gates admit the core fold prefix (the silent-dead-toggle guard) ──────────
t("view-body gate admits $:/state/folded/", (wiki.getTiddlerText(VIEW_BODY) || "").indexOf("[prefix[$:/state/folded/]]") !== -1, true);
t("view-body-slot whitelist admits $:/state/folded/", (wiki.getTiddlerText(SLOT_MODULE) || "").indexOf("[prefix[$:/state/folded/]]") !== -1, true);

// ── the chassis wraps exactly the foldable members ───────────────────────────
wiki.addTiddler({ title: "Host action", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false" });
const members = wiki.filterTiddlers("[[$:/tags/hypergsd/PanelTemplate]] :and[tagging[]] :and[!is[draft]]");
const foldableExpected = members.filter(m => m !== STATUS && m !== COMPLETE && m !== PRIORITY).length;   // default hide, minus the shipped shows (main + priorities sub-plugin)

const unfolded = render(VIEW_BODY, { variables: { currentTiddler: "Host action" } });
const unfoldedReveals = foldReveals(unfolded.w);
t("unfolded: every foldable member wrapped, nothing hidden", [
  unfoldedReveals.length,
  unfoldedReveals.every(r => !(r.domNode && r.domNode.attributes && r.domNode.attributes.hidden))], [foldableExpected, true]);
t("unfolded: status radios render outside the fold slots", (() => {
  const radios = findAll(unfolded.c, n => n.tag === "input" && (n.attributes || {}).type === "radio" && (n.attributes || {})["data-hgsd-action"] === "status");
  return [radios.length, radios.every(r => !inFoldSlot(r))];
})(), [3, true]);
t("unfolded: complete checkbox renders outside the fold slots", (() => {
  const boxes = findAll(unfolded.c, n => n.tag === "input" && (n.attributes || {}).type === "checkbox" && (n.attributes || {})["data-hgsd-action"] === "complete");
  return [boxes.length, boxes.every(b => !inFoldSlot(b))];
})(), [1, true]);

// ── folding the tiddler hides the wrapped members, leaves the Shown ones ─────
wiki.addTiddler({ title: STATE, text: "hide" });
const folded = render(VIEW_BODY, { variables: { currentTiddler: "Host action" } });
const foldedReveals = foldReveals(folded.w);
t("folded: all fold slots hidden, Shown sections still rendered", [
  foldedReveals.length,
  foldedReveals.every(r => r.domNode && r.domNode.attributes && r.domNode.attributes.hidden === "true"),
  findAll(folded.c, n => n.tag === "input" && (n.attributes || {}).type === "radio" && (n.attributes || {})["data-hgsd-action"] === "status").every(r => !inFoldSlot(r)),
  findAll(folded.c, n => n.tag === "input" && (n.attributes || {}).type === "checkbox" && (n.attributes || {})["data-hgsd-action"] === "complete").every(b => !inFoldSlot(b))],
  [foldableExpected, true, true, true]);

// ── per-section override flips a member out of the fold ─────────────────────
resetFixtures();
wiki.addTiddler({ title: "Host action", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false" });
wiki.addTiddler({ title: STATE, text: "hide" });
wiki.addTiddler({ title: CFG + PROJECT, text: "show" });
const overridden = render(VIEW_BODY, { variables: { currentTiddler: "Host action" } });
t("config override: a section set Shown drops out of the fold set", foldReveals(overridden.w).length, foldableExpected - 1);

// ── the priorities panel folds itself to the selected stop (in-member) ───────
// The section ships Shown-when-folded and owns its fold response: folded, only
// the selected block renders (checked, no ✕ — clearing needs the open panel);
// with no priority set the whole section renders nothing. The B-set fixture
// covers selection, the bare one the fold-all case, plus the open three-row
// render for the ✕ placement.
resetFixtures();
wiki.addTiddler({ title: "Prio action", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_priority: "B" });
const prioRowClasses = c => findAll(c, n => n.tag === "div" && /\bhgsd-priority-row\b/.test((n.attributes || {}).class || "")).map(n => n.attributes.class);
const prioClears = c => findAll(c, n => n.tag === "button" && /\bhgsd-priority-clear\b/.test((n.attributes || {}).class || "")).length;
const prioChecked = c => findAll(c, n => n.tag === "input" && (n.attributes || {}).type === "radio" && (n.attributes || {})["data-priority"] && n.attributes.checked !== undefined).map(n => n.attributes["data-priority"]);
const prioOpen = render(VIEW_BODY, { variables: { currentTiddler: "Prio action" } });
t("priorities open: three letter rows, checked B, ✕ on the selected row only", [
  prioRowClasses(prioOpen.c), prioClears(prioOpen.c), prioChecked(prioOpen.c)],
  [["hgsd-priority-row hgsd-priority-A", "hgsd-priority-row hgsd-priority-B", "hgsd-priority-row hgsd-priority-C"], 1, ["B"]]);
wiki.addTiddler({ title: "$:/state/folded/Prio action", text: "hide" });
const prioFolded = render(VIEW_BODY, { variables: { currentTiddler: "Prio action" } });
t("priorities folded: only the selected block survives, checked, no ✕", [
  prioRowClasses(prioFolded.c), prioClears(prioFolded.c), prioChecked(prioFolded.c)],
  [["hgsd-priority-row hgsd-priority-B"], 0, ["B"]]);
t("priorities folded: the section label stays beside the surviving block", textOf(prioFolded.c).indexOf("Priority") !== -1, true);
resetFixtures();
wiki.addTiddler({ title: "Bare action", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false" });
wiki.addTiddler({ title: "$:/state/folded/Bare action", text: "hide" });
const bareFolded = render(VIEW_BODY, { variables: { currentTiddler: "Bare action" } });
t("priorities folded with no priority: the section renders nothing at all", [
  prioRowClasses(bareFolded.c).length, prioClears(bareFolded.c),
  findAll(bareFolded.c, n => n.tag === "input" && (n.attributes || {})["data-priority"]).length,
  textOf(bareFolded.c).indexOf("Priority") === -1],
  [0, 0, 0, true]);

// ── the Settings row select ──────────────────────────────────────────────────
resetFixtures();
const row = render("$:/plugins/yan/hypergsd/ui/components/portion-item-template", {
  variables: { currentTiddler: STATUS, "fold-visibility-base": CFG, "config-base": "$:/config/hypergsdPanel/visibility/" } });
const select = findAll(row.c, n => n.tag === "select").pop();
t("settings row: folded-visibility select with the two labelled options", (() => {
  const opts = select ? findAll(select, n => n.tag === "option").map(o => (o.children || []).map(c => c.textContent || "").join("")) : null;
  return opts;
})(), ["Shown when folded", "Hidden when folded"]);
const bareRow = render("$:/plugins/yan/hypergsd/ui/components/portion-item-template", {
  variables: { currentTiddler: STATUS, "config-base": "$:/config/hypergsdPanel/visibility/" } });
t("settings row: no select where the host list passes no fold base", findAll(bareRow.c, n => n.tag === "select" && findAll(n, o => o.tag === "option" && (o.children || []).some(c => (c.textContent || "") === "Shown when folded")).length > 0).length, 0);

// ── lists fold with the tiddler (the dashboard chassis reveal) ───────────────
// The generic route: hgsd-dashboard-portions wraps itself in a fold reveal on
// $:/state/folded/<host>, so every host folds — verified through the REAL
// placement chain (slot → body, block mode) for the project view, plus the
// contact view, the context view (whose own reveal nests a second one around
// heading and toggle), and a dashboard page.
const viewFoldReveals = (w, host) => {
  const out = [];
  (function f(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(f);
    if (n.parseTreeNode && n.parseTreeNode.tag === "$reveal" && n.stateTitle === "$:/state/folded/" + host) { out.push(n); return; }
    (n.children || []).forEach(f);
  })(w.children);
  return out;
};
const hasHidden = reveals => reveals.length > 0 && reveals.every(r => r.domNode && r.domNode.attributes && r.domNode.attributes.hidden === "true");
const allOpen = reveals => reveals.length > 0 && reveals.every(r => !r.domNode || !r.domNode.attributes || !r.domNode.attributes.hidden);

resetFixtures();
wiki.addTiddler({ title: "Host project", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "false" });
wiki.addTiddler({ title: "Child action", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_project: "Host project" });
const projectChain = render("$:/plugins/yan/hypergsd/modules/view-body-slot", {
  text: '<$tiddler tiddler="Host project"><$transclude $variable="hgsd-view-body-slot" side="bottom"/></$tiddler>' });
const projectOpen = viewFoldReveals(projectChain.w, "Host project");
t("project view through the placement chain: panel + view reveals key on the host, all open", [
  projectOpen.length > 1, allOpen(projectOpen)], [true, true]);
wiki.addTiddler({ title: "$:/state/folded/Host project", text: "hide" });
const projectFoldedChain = render("$:/plugins/yan/hypergsd/modules/view-body-slot", {
  text: '<$tiddler tiddler="Host project"><$transclude $variable="hgsd-view-body-slot" side="bottom"/></$tiddler>' });
t("project view folded: every fold reveal hidden; cores with lazy reveals skip the content entirely", (() => {
  const rv = viewFoldReveals(projectFoldedChain.w, "Host project");
  const listsText = textOf(projectFoldedChain.c);
  return [hasHidden(rv), listsText.indexOf("Next action") !== -1, listsText.indexOf("Complete") !== -1];
})(), [true, false, true]);

resetFixtures();
wiki.addTiddler({ title: "Host contact", tags: ["$:/GSD/Contact"] });
wiki.addTiddler({ title: "$:/state/folded/Host contact", text: "hide" });
const contactFolded = render("$:/plugins/yan/hypergsd-contacts/ui/ViewTemplate/view-body-contact", { variables: { currentTiddler: "Host contact" } });
t("contact view folded: chassis reveal hidden", hasHidden(viewFoldReveals(contactFolded.w, "Host contact")), true);

resetFixtures();
wiki.addTiddler({ title: "Work", tags: ["GSD/Contexts"] });
wiki.addTiddler({ title: "$:/state/folded/Work", text: "hide" });
const contextFolded = render("$:/plugins/yan/hypergsd-contexts/ui/ViewTemplate/view-body-context", { variables: { currentTiddler: "Work" } });
t("context view folded: view reveal hidden", hasHidden(viewFoldReveals(contextFolded.w, "Work")), true);

resetFixtures();
wiki.addTiddler({ title: "$:/state/folded/GSD/Dashboard", text: "hide" });
const dashFolded = render("GSD/Dashboard", { variables: { currentTiddler: "GSD/Dashboard" } });
t("dashboard page folded: chassis reveal hidden", hasHidden(viewFoldReveals(dashFolded.w, "GSD/Dashboard")), true);

// Host gates admit the fold prefix (the dead-toggle guard, list views edition)
t("view-body-project whitelist admits $:/state/folded/", (wiki.getTiddlerText("$:/plugins/yan/hypergsd/ui/ViewTemplate/view-body-project") || "").indexOf("[prefix[$:/state/folded/]]") !== -1, true);
t("view-body-contact whitelist admits $:/state/folded/", (wiki.getTiddlerText("$:/plugins/yan/hypergsd-contacts/ui/ViewTemplate/view-body-contact") || "").indexOf("[prefix[$:/state/folded/]]") !== -1, true);
t("view-body-context whitelist admits $:/state/folded/", (wiki.getTiddlerText("$:/plugins/yan/hypergsd-contexts/ui/ViewTemplate/view-body-context") || "").indexOf("[prefix[$:/state/folded/]]") !== -1, true);

finish("PANEL-FOLD");
