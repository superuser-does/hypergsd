// Fragments settings tab: the Fragment root drives everything — one draggable per
// discovered placement tag (a synthetic Link/Contact family proves the open set),
// the placement select's options from the same discovery (caption labels, one-prefix
// retag), and the type tick row derived from the type vocabulary (filter-mode
// checkboxes writing the engine's type-hide base through setfield values). The
// engine gate honouring those writes on rows closes the loop. Shadow members are
// retagged through non-shadow overrides; resetFixtures restores them between cases.
const { boot, makeRender, textOf, resetFixtures, t, finish } = require("./lib/harness");
const { $tw, wiki, doc } = boot();
const render = makeRender(wiki, doc, $tw);

const TAB = "$:/plugins/yan/hypergsd/ui/control-panel/fragments";
const ROW_PREFIX = "$:/tags/hypergsd/Fragment/Row/Prefix", ROW_SUFFIX = "$:/tags/hypergsd/Fragment/Row/Suffix";
const PANEL = "$:/tags/hypergsd/Fragment/Panel";
const PANEL_EXTRA = "$:/tags/hypergsd/Fragment/Panel/Extra";
const placements = () => wiki.filterTiddlers("[all[shadows+tiddlers]prefix[$:/tags/hypergsd/Fragment/]] +[sort[title]]");
const membersOf = tag => wiki.filterTiddlers("[[" + tag + "]] :and[tagging[]]");
const widget = (w, pred) => {
  const out = [];
  (function f(n) { if (!n || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(f);
    if (pred(n)) out.push(n); (n.children || []).forEach(f); })(w);
  return out;
};

// an exotic placement, created as a developer would: tag tiddler with caption (hosted via panel-tag)
wiki.addTiddler({title: PANEL_EXTRA, caption: "Exotic host"});
wiki.addTiddler({title: "ZZ exotic badge", tags: [PANEL_EXTRA], caption: "Exotic badge"});

// ── 1. the merged block: one draggable per discovered placement, one prompt ──
const shippedPlacements = placements();
t("discovery finds the shipped placements plus the fixture family",
  [shippedPlacements.indexOf(PANEL) !== -1,
   shippedPlacements.indexOf(ROW_PREFIX) !== -1, shippedPlacements.indexOf(ROW_SUFFIX) !== -1,
   shippedPlacements.indexOf(PANEL_EXTRA) !== -1],
  [true, true, true, true]);
const totalMembers = shippedPlacements.reduce((n, tag) => n + membersOf(tag).length, 0);
const { w: tabw, c: tabc } = render(TAB, { mode: "block" });
const allSelects = widget(tabw, n => n.parseTreeNode && n.parseTreeNode.tag === "$select");
// the placement select's retag strips by the Fragment prefix; no other select rides the rows
const placementSelects = allSelects.filter(s => (s.getAttribute("actions") || "").indexOf("$:/tags/hypergsd/Fragment") !== -1);
t("one placement select per member row", placementSelects.length, totalMembers);
t("no second select rides the rows (the Portion picker is gone from this tab)",
  allSelects.length, placementSelects.length);
t("every placement select offers every discovered placement",
  placementSelects.every(s => {
    const opts = widget(s, n => n.tag === "option").map(o => o.attributes.value);
    return JSON.stringify(opts) === JSON.stringify(shippedPlacements);
  }), true);
const inPlacement = (member, tag) => membersOf(tag).indexOf(member) !== -1;
t("each select's default is the member's current placement",
  placementSelects.every(s => inPlacement(s.getVariable("currentTiddler"), s.getAttribute("default"))), true);
t("fixture placement's option label reads its caption",
  textOf(tabc).indexOf("Exotic host") !== -1, true);
t("the prompt names the drag, ordering and dropdown semantics", [textOf(tabc).indexOf("Choose which fragments are displayed") !== -1, textOf(tabc).indexOf("Drag and drop to change the ordering") !== -1, textOf(tabc).indexOf("Use the dropdown to move a fragment between rows and links") !== -1], [true, true, true]);

// ── 2. type tick row: on the two Row placements only, one box per type ──
const typeWords = wiki.filterTiddlers("[[$:/tags/hypergsd/Type]] :and[tagging[]] :and[get[hgsd-type]]");
const typeBoxes = placementSelects.map(s => {
  const member = s.getVariable("currentTiddler");
  const prefix = "$:/config/hypergsd/Fragment/type-hide/" + member + "/";
  const boxes = widget(tabw, n => n.parseTreeNode && n.parseTreeNode.tag === "$checkbox" && typeof n.getAttribute("tiddler") === "string" && n.getAttribute("tiddler").indexOf(prefix) === 0);
  return { member, boxes };
});
const rowMembers = membersOf(ROW_PREFIX).concat(membersOf(ROW_SUFFIX));
t("type boxes render on every row, one per type",
  typeBoxes.every(r => r.boxes.length === typeWords.length), true);
const compDateBoxes = typeBoxes.find(r => r.member === "$:/plugins/yan/hypergsd/ui/list-items/comp-date");
t("comp-date ships Projects unticked (the seeded type-hide)",
  [compDateBoxes.boxes.find(b => b.getAttribute("tiddler").endsWith("/action")).getValue(),
   compDateBoxes.boxes.find(b => b.getAttribute("tiddler").endsWith("/project")).getValue()],
  [true, false]);
const BODY_TEXT = "$:/plugins/yan/hypergsd/ui/list-items/body-text";
const typeHideTitle = (member, type) => "$:/config/hypergsd/Fragment/type-hide/" + member + "/" + type;
const bodyTextBoxes = typeBoxes.find(r => r.member === BODY_TEXT);
const boxFor = word => bodyTextBoxes.boxes.find(b => b.getAttribute("tiddler").endsWith("/" + word));
t("body-text ships everything but Actions unticked",
  typeWords.every(w => boxFor(w).getValue() === (w === "action" ? true : false)), true);

// ── 3. the boxes write their own config tiddlers: untick Actions on body-text ──
const CONFIG = typeHideTitle(BODY_TEXT, "action");
boxFor("action").inputDomNode.checked = false;
boxFor("action").handleChangeEvent({});
t("untick writes hide to the per-type tiddler", wiki.getTiddlerText(CONFIG), "hide");
{
  const { w } = render(TAB, { mode: "block" });
  const actionsAfter = widget(w, n => n.parseTreeNode && n.parseTreeNode.tag === "$checkbox" && typeof n.getAttribute("tiddler") === "string" && n.getAttribute("tiddler") === typeHideTitle(BODY_TEXT, "action"));
  const contactsAfter = widget(w, n => n.parseTreeNode && n.parseTreeNode.tag === "$checkbox" && typeof n.getAttribute("tiddler") === "string" && n.getAttribute("tiddler") === typeHideTitle(BODY_TEXT, "contact"));
  t("a fresh render shows Actions unticked", actionsAfter.length >= 1 && actionsAfter[0].getValue(), false);
  t("the seeded Contacts box stays unticked beside it", contactsAfter.length >= 1 && contactsAfter[0].getValue(), false);
  actionsAfter[0].inputDomNode.checked = true;
  actionsAfter[0].handleChangeEvent({});
  t("re-ticking writes show again", wiki.getTiddlerText(CONFIG), "show");
}
resetFixtures(wiki);

// ── 4. the engine gate honours the vocabulary on rows ──
// body-text marks rows that HAVE body text; the type-hide engine gate is the suppression under test
wiki.addTiddler({ title: "B typed action", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", text: "body" });
const rowIcons = host => {
  const { c } = render(null, { text: '<$tiddler tiddler="' + host + '"><$transclude $variable="hgsd-item"/></$tiddler>' });
  let n = 0; (function f(x) { if (!x || typeof x !== "object") return; if (Array.isArray(x)) return x.forEach(f);
    // body-text's excerpt icon: an svg inside its gsd-muted div (the contextualise button carries an svg of its own)
    if (x.isTiddlyWikiFakeDom && x.tag === "svg") {
      let p = x.parentNode, hit = false;
      while (p) { if (p.isTiddlyWikiFakeDom && (p.attributes || {}).class === "gsd-muted") { hit = true; break; } p = p.parentNode; }
      if (hit) n++;
    } (x.children || []).forEach(f); })(c);
  return n;
};
t("actions show the fragment by default", rowIcons("B typed action"), 1);
wiki.addTiddler({ title: typeHideTitle(BODY_TEXT, "action"), text: "hide" });
t("type-hide suppresses the fragment on that row type", rowIcons("B typed action"), 0);
resetFixtures(wiki);

// ── 4b. the shipped default matrix: a seed exists exactly where the matrix hides ──
{
  const HIDES = {
    "$:/plugins/yan/hypergsd/ui/list-items/complete": ["contact", "project", "reference", "context"],
    "$:/plugins/yan/hypergsd/ui/list-items/status": ["contact", "reference", "context"],
    "$:/plugins/yan/hypergsd/ui/list-items/comp-date": ["contact", "project", "reference", "context"],
    "$:/plugins/yan/hypergsd/ui/list-items/body-text": ["contact", "project", "reference", "context"],
    "$:/plugins/yan/hypergsd/ui/list-items/project-link": ["contact", "context"],
    "$:/plugins/yan/hypergsd/ui/list-items/delete": ["contact", "project", "reference", "context"],
    "$:/plugins/yan/hypergsd-priorities/ui/list-items/priority": ["contact", "reference", "context"],
    "$:/plugins/yan/hypergsd-contexts/ui/list-items/context": ["contact", "reference", "context"],
    "$:/plugins/yan/hypergsd-contacts/ui/list-items/contact-link": ["contact", "reference", "context"],
    "$:/plugins/yan/hypergsd-trashbin/ui/list-items/trash": ["contact", "reference", "context"],
    "$:/plugins/yan/hypergsd-ticklers/ui/list-items/tickler": ["contact", "project", "reference", "context"],
  };
  const shippedMembers = placements().reduce((n, tag) => n.concat(membersOf(tag)), []);
  const wrong = [];
  for (const member of shippedMembers) {
    for (const w of typeWords) {
      const wantHidden = (HIDES[member] || []).indexOf(w) !== -1;
      const isHidden = wiki.getTiddlerText("$:/config/hypergsd/Fragment/type-hide/" + member + "/" + w, "show") === "hide";
      if (wantHidden !== isHidden) wrong.push(member + "/" + w + (wantHidden ? " missing-seed" : " unexpected-seed"));
      if (w === "action" && isHidden) wrong.push(member + "/action hidden");
    }
  }
  t("shipped seeds match the defaults matrix (actions always shown)", wrong, []);
}

// ── 4c. the Panel placement gates on the link TARGET's type ──
{
  wiki.addTiddler({title: "ZZ probe badge", tags: [PANEL], text: "PROBE"});
  wiki.addTiddler({title: "ZZ ctx target", tags: ["GSD/Contexts"]});
  wiki.addTiddler({title: "ZZ act target", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false"});
  wiki.addTiddler({title: "$:/config/hypergsd/Fragment/type-hide/ZZ probe badge/context", text: "hide"});
  const probe = target => {
    const { c } = render(null, { text: '<$transclude $variable="hgsd-panel-items" linked-tiddler="' + target + '"/>' });
    return textOf(c).indexOf("PROBE") !== -1;
  };
  t("hidden-for-context member skips a context target", probe("ZZ ctx target"), false);
  t("the same member renders beside an action target", probe("ZZ act target"), true);
}
resetFixtures(wiki);

// ── 5. the placement select retags across placements — including into the fixture family ──
{
  wiki.addTiddler({title: PANEL_EXTRA, caption: "Exotic host"});
  const { w } = render(TAB, { mode: "block" });
  const bodyTextSelect = widget(w, n => n.parseTreeNode && n.parseTreeNode.tag === "$select" && n.getVariable("currentTiddler") === BODY_TEXT).pop();
  bodyTextSelect.getSelectDomNode().value = PANEL_EXTRA;
  bodyTextSelect.handleChangeEvent({});
  const tiddler = wiki.getTiddler(BODY_TEXT);
  const tags = tiddler.fields.tags.slice().sort();
  t("placement select moves a member into another family",
    [tags.indexOf(PANEL_EXTRA) !== -1, tags.indexOf(ROW_SUFFIX) === -1],
    [true, true]);
  t("the retag leaves fields alone", typeof tiddler.fields.caption === "string", true);
}
resetFixtures(wiki);

finish("FRAGMENT-SETTINGS");
