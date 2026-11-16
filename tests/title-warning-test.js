// Title-warning battery: the shared component (both modes), every wired
// creation surface (modal title row, pick-field both states, pick-append
// add-row, contexts add-row, realm pill), and the live-refresh paths the
// per-keystroke warnings depend on.
"use strict";
const { boot, makeRender, textOf, resetFixtures, t, finish } = require("./lib/harness");
const { $tw, wiki, doc } = boot();
const render = makeRender(wiki, doc, $tw);

const findAll = (node, pred) => { const out = []; (function f(n){ if(!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
  if(n.isTiddlyWikiFakeDom){ if(pred(n))out.push(n); (n.children||[]).forEach(f); } })(node); return out; };
const findWidgets = (w, pred, acc = []) => { (function f(n){ if(!n||typeof n!=="object")return; if(!Array.isArray(n)&&pred(n))acc.push(n); (n.children||[]).forEach(f); })(w); return acc; };
const findByClass = (node, cls) => findAll(node, n => ((n.attributes||{}).class || "").indexOf(cls) !== -1);
const boxes = node => findByClass(node, "tc-message-box").filter(n => textOf(n).indexOf("avoid using any of the characters") !== -1);
const icons = node => findByClass(node, "hgsd-title-warning");
const svgOf = node => findAll(node, n => n.tag === "svg").length;

const MESSAGE = "Warning: avoid using any of the characters `| [ ] { }` in tiddler titles";
// textOf cannot see backtick markup (it renders as <code>), so box-text expectations use the plain form; the code element is asserted structurally below
const MESSAGE_PLAIN = "Warning: avoid using any of the characters | [ ] { } in tiddler titles";

// 1. Component, box mode: core's exact presentation
{
  const { c } = render("$:/plugins/yan/hypergsd/ui/components/title-warning", { text: '<$transclude $variable="hgsd-title-warning" typed-value="Bad [title" warning-style="box" />' });
  t("box mode: message box with core text", [boxes(c).length, textOf(boxes(c)[0])], [1, MESSAGE_PLAIN]);
  t("box mode: core chrome + compact hook on one element", ((boxes(c)[0].attributes || {}).class || "").trim(), "tc-message-box hgsd-title-warning");
  t("box mode: character list renders as code (core's own formatting)", findAll(boxes(c)[0], n => n.tag === "code" && textOf(n) === "| [ ] { }").length, 1);
  t("box mode: warning svg inside the box", svgOf(boxes(c)[0]) > 0, true);
  const clean = render("$:/plugins/yan/hypergsd/ui/components/title-warning", { text: '<$transclude $variable="hgsd-title-warning" typed-value="Clean title" warning-style="box" />' });
  t("box mode: clean value renders nothing", boxes(clean.c).length, 0);
  const empty = render("$:/plugins/yan/hypergsd/ui/components/title-warning", { text: '<$transclude $variable="hgsd-title-warning" typed-value="" warning-style="box" />' });
  t("box mode: empty value renders nothing", boxes(empty.c).length, 0);
}

// 2. Component, icon mode: the realm-warning shape, tooltip carries the substituted message
{
  const { c } = render("$:/plugins/yan/hypergsd/ui/components/title-warning", { text: '<$transclude $variable="hgsd-title-warning" typed-value="Pipe | here" />' });
  t("icon mode: span with svg", [icons(c).length, svgOf(icons(c)[0])], [1, 1]);
  t("icon mode: tooltip is the substituted core message", (icons(c)[0].attributes || {}).title, MESSAGE);
  const clean = render("$:/plugins/yan/hypergsd/ui/components/title-warning", { text: '<$transclude $variable="hgsd-title-warning" typed-value="Clean title" />' });
  t("icon mode: clean value renders nothing", icons(clean.c).length, 0);
}

// 3. Every forbidden character triggers; no filter-error leakage
{
  const cases = {"pipe": "A | B", "open bracket": "A [ B", "close bracket": "A ] B", "open brace": "A { B", "close brace": "A } B"};
  for (const name in cases) {
    const { c } = render("$:/plugins/yan/hypergsd/ui/components/title-warning", { text: '<$transclude $variable="hgsd-title-warning" typed-value="' + cases[name] + '" />' });
    t("triggers on " + name, icons(c).length, 1);
  }
  const { c } = render("$:/plugins/yan/hypergsd/ui/components/title-warning", { text: '<$transclude $variable="hgsd-title-warning" typed-value="A [ B" />' });
  t("no Filter error in output", /Filter error/.test(textOf(c)), false);
}

// 4. Modal title row: box below the row, live per keystroke (the row sits above the attribute gate)
const renderModal = () => render("$:/plugins/yan/hypergsd/ui/new-gsd-modal", { variables: { currentTiddler: "$:/temp/gsd-new-state", "gsd-type": "action", "gsd-status": "next", "gsd-complete": "false", "gsd-update-status": "no", "gsd-calling-tiddler": "" } });
{
  wiki.addTiddler({title: "$:/temp/gsd-new-title", "hgsd-title": "Bad [modal title"});
  const { c } = renderModal();
  t("modal: box present for bad title", boxes(c).length, 1);
  resetFixtures(wiki);
  wiki.addTiddler({title: "$:/temp/gsd-new-title", "hgsd-title": "Clean modal title"});
  const m = renderModal();
  t("modal: no box for clean title", boxes(m.c).length, 0);
  wiki.addTiddler(new $tw.Tiddler(wiki.getTiddler("$:/temp/gsd-new-title"), {"hgsd-title": "Now {bad}"}));
  m.w.refresh({"$:/temp/gsd-new-title": {title: "$:/temp/gsd-new-title"}});
  t("modal: box appears live on keystroke refresh", boxes(m.c).length, 1);
}

// 5. Realm pill: the small icon beside the pill, live through the modal gate (the gsd-new-realm-name prefix run)
{
  resetFixtures(wiki);
  wiki.addTiddler({title: "$:/state/hypergsd/effective-realm", text: "new"});
  const m = renderModal();
  t("realm: pill flow open, no warning yet", icons(m.c).length, 0);
  wiki.addTiddler({title: "$:/temp/gsd-new-realm-name", text: "Half [time"});
  m.w.refresh({"$:/temp/gsd-new-realm-name": {title: "$:/temp/gsd-new-realm-name"}});
  t("realm: icon appears through the gate on refresh", [icons(m.c).length, boxes(m.c).length], [1, 0]);
  t("realm: icon tooltip carries the substituted message", (icons(m.c)[0].attributes || {}).title, MESSAGE);
}

// 6. Pick-append add-row (prereq panel on an action view): icon beside create-and-add
{
  resetFixtures(wiki);
  wiki.addTiddler({title: "ZZB P1", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "false"});
  wiki.addTiddler({title: "ZZB A1", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_project: "ZZB P1"});
  const view = render("$:/plugins/yan/hypergsd/ui/ViewTemplate/view-body", { text: '<$tiddler tiddler="ZZB A1"><$transclude $tiddler="$:/plugins/yan/hypergsd/ui/ViewTemplate/view-body" $mode="block" /></$tiddler>', variables: { currentTiddler: "ZZB A1" } });
  t("pick-append: no icon on cold render", icons(view.c).length, 0);
  const pickTemp = "$:/temp/hypergsd/add-prereq-ZZB A1";
  wiki.addTiddler({title: pickTemp, "hgsd-pick": "New dep [x"});
  view.w.refresh({[pickTemp]: {title: pickTemp}});
  t("pick-append: icon beside create-and-add for bad pick", [icons(view.c).length, /create/.test(textOf(view.c))], [1, true]);
  t("pick-append: icon tooltip substituted", (icons(view.c)[0].attributes || {}).title, MESSAGE);
  wiki.addTiddler(new $tw.Tiddler(wiki.getTiddler(pickTemp), {"hgsd-pick": "ZZB A1"}));
  view.w.refresh({[pickTemp]: {title: pickTemp}});
  t("pick-append: existing pick shows no icon", icons(view.c).length, 0);
  wiki.addTiddler(new $tw.Tiddler(wiki.getTiddler(pickTemp), {"hgsd-pick": "New dep clean"}));
  view.w.refresh({[pickTemp]: {title: pickTemp}});
  t("pick-append: clean non-existent pick shows create, no icon", [icons(view.c).length, /create/.test(textOf(view.c))], [0, true]);
}

// 7. Pick-field: empty state and editing state (project attribute section on the action view)
{
  resetFixtures(wiki);
  wiki.addTiddler({title: "ZZB P1", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "false"});
  wiki.addTiddler({title: "ZZB A1", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false"});
  const view = render("$:/plugins/yan/hypergsd/ui/ViewTemplate/view-body", { text: '<$tiddler tiddler="ZZB A1"><$transclude $tiddler="$:/plugins/yan/hypergsd/ui/ViewTemplate/view-body" $mode="block" /></$tiddler>', variables: { currentTiddler: "ZZB A1" } });
  const pickTemp = "$:/temp/hypergsd/add-project-ZZB A1";
  wiki.addTiddler({title: pickTemp, "hgsd-pick": "New {project}"});
  view.w.refresh({[pickTemp]: {title: pickTemp}});
  t("pick-field empty state: icon for bad pick", icons(view.c).length, 1);
  // editing state: open the editor reveal (the icon site inside the fieldset)
  const editState = "$:/state/hypergsd/edit-gsd_project-ZZB A1";
  wiki.addTiddler({title: editState, text: "yes"});
  view.w.refresh({[editState]: {title: editState}});
  wiki.addTiddler(new $tw.Tiddler(wiki.getTiddler(pickTemp), {"hgsd-pick": "Worse [project]"}));
  view.w.refresh({[pickTemp]: {title: pickTemp}});
  t("pick-field editing state: icon for bad pick", icons(view.c).length, 1);
}

// 8. Contextualise fragment: the icon rides the shared create-and-add shell, so this direct shell caller (no pick shell in between) inherits it
{
  resetFixtures(wiki);
  wiki.addTiddler({title: "@Phone", tags: ["GSD/Contexts"]});
  wiki.addTiddler({title: "B open", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false"});
  const page = render("GSD/Test", { text: '<$hgsd.list list-heading="T" list-filter="[all[tiddlers]tag[$:/GSD/Action]]" group-state="false" />' });
  // open the row's contextualise reveal (state title extracted from the toggle button's resolved set — the per-copy scheme forbids hardcoding)
  const toggle = findWidgets(page.w, n => n.parseTreeNode && n.parseTreeNode.tag === "$button" && typeof n.set === "string" && n.set.indexOf("$:/state/hypergsd/contextualise") === 0).pop();
  wiki.addTiddler({title: toggle.set, text: "open"});
  page.w.refresh({[toggle.set]: {title: toggle.set}});
  const pickTemp = findWidgets(page.w, n => n.parseTreeNode && n.parseTreeNode.tag === "$edit-text" && typeof n.getAttribute === "function" && typeof n.getAttribute("tiddler") === "string" && n.getAttribute("tiddler").indexOf("$:/temp/hypergsd/add-context-") === 0).pop().getAttribute("tiddler");
  t("contextualise: no icon before typing", icons(page.c).length, 0);
  wiki.addTiddler({title: pickTemp, "hgsd-pick": "New [ctx"});
  page.w.refresh({[pickTemp]: {title: pickTemp}});
  t("contextualise: icon beside create-and-add for bad typed context", [icons(page.c).length, /create/.test(textOf(page.c))], [1, true]);
  wiki.addTiddler(new $tw.Tiddler(wiki.getTiddler(pickTemp), {"hgsd-pick": "@Phone"}));
  page.w.refresh({[pickTemp]: {title: pickTemp}});
  t("contextualise: existing context pick shows no icon", icons(page.c).length, 0);
}

// 9. Contexts add-row: box below the row, live per keystroke
{
  resetFixtures(wiki);
  const page = render("GSD/Contexts");
  t("contexts: no box on cold render", boxes(page.c).length, 0);
  wiki.addTiddler({title: "$:/temp/hypergsd/NewContextName", text: "Week[end]"});
  page.w.refresh({"$:/temp/hypergsd/NewContextName": {title: "$:/temp/hypergsd/NewContextName"}});
  t("contexts: box appears on keystroke refresh", [boxes(page.c).length, textOf(boxes(page.c)[0])], [1, MESSAGE_PLAIN]);
}

finish("title-warning");
