// Contextualise row fragment: gating, gated reveal open through the frozen-list
// refresh gates, per-copy state/temp/popup titles (row + group + instance
// scope), picker options (own contexts excluded), add/create flows.
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-wiki"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;

wiki.addTiddler({title: "@Phone", tags: ["GSD/Contexts"]});
wiki.addTiddler({title: "@out and about", tags: ["GSD/Contexts"]});
wiki.addTiddler({title: "A done", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "true", gsd_comp_date: "20260820120000000"});
wiki.addTiddler({title: "B open", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false"});
wiki.addTiddler({title: "P one", tags: ["$:/GSD/Project"], gsd_status: "active"});
wiki.addTiddler({title: "R one", tags: ["$:/GSD/Reference"]});
wiki.addTiddler({title: "$:/state/hypergsd/current-realm", text: "NoRealm"});

const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';
// one flat list of actions + projects + references so every row type renders
const LIST_FILTER = "[all[tiddlers]tag[$:/GSD/Action]] [all[tiddlers]tag[$:/GSD/Project]] [all[tiddlers]tag[$:/GSD/Reference]] +[sort[title]]";

let fails = 0;
const t = (name, got, exp) => {
  const ok = JSON.stringify(got) === JSON.stringify(exp);
  if (!ok) fails++;
  console.log((ok ? "PASS " : "FAIL ") + name + " got:" + JSON.stringify(got));
};

const findWidgets = (w, pred, acc = []) => {
  (function f(n) {
    if (!n || typeof n !== "object") return;
    if (!Array.isArray(n) && pred(n)) acc.push(n);
    (n.children || []).forEach(f);
  })(w);
  return acc;
};

// Walk the fake DOM collecting rows (keyed by title-link href) and selects
const collect = (c) => {
  const rows = {}, selects = [];
  let row = null;
  (function f(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(f);
    if (!n.isTiddlyWikiFakeDom) return;
    if ((n.attributes && n.attributes.class || "").indexOf("gsd-list-item-title") !== -1) {
      row = decodeURIComponent((n.attributes.href || "").replace(/^#\/?/, ""));
      rows[row] = {ctxButton: false, marks: []};
    }
    if (n.tag === "select" && (n.attributes || {}).size === "8") {
      const opts = [];
      (function g(m) {
        if (!m || typeof m !== "object") return;
        if (Array.isArray(m)) return m.forEach(g);
        if (m.isTiddlyWikiFakeDom) {
          if (m.tag === "option") opts.push(m.attributes.value);
          (m.children || []).forEach(g);
        }
      })(n);
      selects.push(opts);
    }
    (n.children || []).forEach(f);
  })(c);
  return {rows, selects};
};

// Mark contextualise icon buttons per row: closed cluster carries exactly the icon
// toggle (tooltip "Add a context"); distinguishable from the trashbin button (kookma's
// own tooltip) and the eventcatcher buttons (data-hgsd-action).
const rowCtxButtons = (c) => {
  const rows = {};
  let row = null;
  (function f(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(f);
    if (!n.isTiddlyWikiFakeDom) return;
    if ((n.attributes && n.attributes.class || "").indexOf("gsd-list-item-title") !== -1)
      row = decodeURIComponent((n.attributes.href || "").replace(/^#\/?/, ""));
    if (row !== null) {
      if (n.tag === "button" && (n.attributes || {}).title === "Add a context")
        rows[row] = (rows[row] || 0) + 1;
    }
    (n.children || []).forEach(f);
  })(c);
  return rows;
};

// Render a flat list; titles are EXTRACTED from the widget tree (the per-copy
// scheme makes them row-group-scope, so hardcoding is no longer possible):
// the reveal state from the toggle button's resolved set, then (after opening
// the reveal through the gates) the picker's popup and temp from the rendered
// picker input's focusPopup / tiddler.
const renderOpen = (host, listFilter, heading) => {
  const body = '<$hgsd.list list-heading="' + (heading || "T") + '" list-filter="' + (listFilter || LIST_FILTER) + '" group-state="false" active-parents-only="no"/>';
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + body + "\n\n</$importvariables>"),
    {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: host || "GSD/Test"}});
  const c = doc.createElement("div");
  w.render(c);
  const toggle = findWidgets(w, n => n.parseTreeNode && n.parseTreeNode.tag === "$button" &&
    typeof n.set === "string" && n.set.indexOf("$:/state/hypergsd/contextualise") === 0).pop();
  const state = toggle && toggle.set;
  wiki.addTiddler({title: state, text: "open"});
  w.refresh({[state]: {modified: true}});
  const et = findWidgets(w, n => n.parseTreeNode && n.parseTreeNode.tag === "$edit-text" &&
    typeof n.getAttribute === "function" && typeof n.getAttribute("tiddler") === "string" &&
    n.getAttribute("tiddler").indexOf("$:/temp/hypergsd/add-context-") === 0).pop();
  const pop = et && et.getAttribute("focusPopup"), temp = et && et.getAttribute("tiddler");
  wiki.addTiddler({title: pop, text: "(0,0,1,1)"});
  w.refresh({[pop]: {modified: true}});
  return {w, c, state, pop, temp};
};

// --- 1. gating: icon renders on incomplete actions only ---
{
  const body = '<$hgsd.list list-heading="T" list-filter="' + LIST_FILTER + '" group-state="false" active-parents-only="no"/>';
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + body + "\n\n</$importvariables>"),
    {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
  const c = doc.createElement("div");
  w.render(c);
  const btns = rowCtxButtons(c);
  t("icon on incomplete action", btns["B open"] >= 1, true);
  t("no icon on completed action", btns["A done"], undefined);
  t("no icon on project row", btns["P one"], undefined);
  t("no icon on reference row", btns["R one"], undefined);
}

// --- 2. per-copy titles; the reveal opens THROUGH the frozen-list refresh gates ---
{
  const {w, c, state, pop} = renderOpen("GSD/Test");
  // the scope component is the ambient listState collapse title sans prefix
  const cb = findWidgets(w, n => n.parseTreeNode && n.parseTreeNode.tag === "$checkbox" &&
    typeof n.getAttribute === "function" && typeof n.getAttribute("tiddler") === "string" &&
    n.getAttribute("tiddler").indexOf("$:/temp/gsd-list/") === 0).pop();
  const scope = cb.getAttribute("tiddler").slice("$:/temp/gsd-list/".length);
  t("state title is row-group-scope (flat: empty group)", state, "$:/state/hypergsd/contextualise-B open--" + scope);
  t("popup title carries the copy too", pop, "$:/state/popup/pick-contextualise--" + scope + "-B open");
  const toggles = findWidgets(w, n => n.parseTreeNode && n.parseTreeNode.tag === "$button" &&
    typeof n.set === "string" && n.set.indexOf("$:/state/hypergsd/contextualise") === 0);
  t("rows do not share a state title", new Set(toggles.map(b => b.set)).size === toggles.length, true);
  t("reveal opened through gate", collect(c).selects.length >= 1, true);
  t("options = both contexts + none-label", collect(c).selects[0], ["", "@out and about", "@Phone"]); // sort[] is case-insensitive
}

// --- 2b. the reveal opens through the DASHBOARD CHASSIS gate as well ---
// (regression guard: the chassis gate in section-portions.tid once froze the
// three contextualise state/temp prefixes, dead-buttoning the fragment on every
// chassis-hosted page — dashboards, project view, contact view; fixed 2026-09-13)
{
  wiki.addTiddler({title: "$:/tags/Test/Chassis", list: "$:/temp/test-chassis-member"});
  wiki.addTiddler({title: "$:/temp/test-chassis-member", tags: "$:/tags/Test/Chassis",
    text: '<$hgsd.list list-heading="C" list-filter="' + LIST_FILTER + '"/>'});
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki",
      G + '\n\n<$transclude $variable="hgsd-dashboard-portions" tag-list="$:/tags/Test/Chassis" visibility-base="$:/config/Test/vis/"/>\n\n</$importvariables>'),
    {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
  const c = doc.createElement("div");
  w.render(c);
  t("chassis renders member rows", collect(c).rows["B open"] !== undefined, true);
  const toggle = findWidgets(w, n => n.parseTreeNode && n.parseTreeNode.tag === "$button" &&
    typeof n.set === "string" && n.set.indexOf("$:/state/hypergsd/contextualise") === 0).pop();
  wiki.addTiddler({title: toggle.set, text: "open"});
  w.refresh({[toggle.set]: {modified: true}});
  const et = findWidgets(w, n => n.parseTreeNode && n.parseTreeNode.tag === "$edit-text" &&
    typeof n.getAttribute === "function" && typeof n.getAttribute("tiddler") === "string" &&
    n.getAttribute("tiddler").indexOf("$:/temp/hypergsd/add-context-") === 0).pop();
  wiki.addTiddler({title: et.getAttribute("focusPopup"), text: "(0,0,1,1)"});
  w.refresh({[et.getAttribute("focusPopup")]: {modified: true}});
  t("reveal opens through chassis gate", collect(c).selects.length >= 1, true);
}

const findButtonByTooltip = (w, tooltip) => findWidgets(w,
  n => n.parseTreeNode && n.parseTreeNode.tag === "$button" &&
       typeof n.getAttribute === "function" && n.getAttribute("tooltip") === tooltip &&
       !(typeof n.set === "string"));

// --- 3. add flow: pick an existing context, fire the Add button ---
{
  const {w, state, pop, temp} = renderOpen("GSD/Test");
  wiki.addTiddler({title: temp, "hgsd-pick": "@Phone"});
  w.refresh({[temp]: {modified: true}});
  const addBtns = findButtonByTooltip(w, "Add a context");
  t("add button present", addBtns.length >= 1, true);
  addBtns[addBtns.length - 1].invokeActions(addBtns[addBtns.length - 1], {type: "click"});
  t("add tags the row", wiki.getTiddler("B open").fields.tags.indexOf("@Phone") !== -1, true);
  t("add clears the pick", wiki.getTiddler(temp).fields["hgsd-pick"], "");
  // multi-word tag
  wiki.addTiddler({title: temp, "hgsd-pick": "@out and about"});
  const {w: w2, temp: temp2} = renderOpen("GSD/Test");
  wiki.addTiddler({title: temp2, "hgsd-pick": "@out and about"});
  w2.refresh({[temp2]: {modified: true}});
  const add2 = findButtonByTooltip(w2, "Add a context");
  add2[add2.length - 1].invokeActions(add2[add2.length - 1], {type: "click"});
  t("multi-word tag added whole", wiki.getTiddler("B open").fields.tags.indexOf("@out and about") !== -1, true);
  // empty pick is a no-op (no empty tag)
  wiki.addTiddler({title: temp2, "hgsd-pick": ""});
  w2.refresh({[temp2]: {modified: true}});
  const add3 = findButtonByTooltip(w2, "Add a context");
  add3[add3.length - 1].invokeActions(add3[add3.length - 1], {type: "click"});
  t("empty pick adds nothing", wiki.getTiddler("B open").fields.tags.indexOf(""), -1);
}

// --- 3b. instant commit: an option pick appends the tag with no Add button ---
{
  // fresh row (section 3 left @Phone/@out and about on it), fresh temp, fresh states
  wiki.deleteTiddler("B open"); wiki.addTiddler({title: "B open", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_project: "P one"});
  let {w, state, pop, temp} = renderOpen("GSD/Test");
  const sw = findWidgets(w, n => n.parseTreeNode && n.parseTreeNode.tag === "$select" && String(n.getAttribute("size")) === "8").pop();
  sw.domNodes[0].value = "@Phone";
  sw.handleChangeEvent({});
  t("instant commit: option pick appends the tag", wiki.getTiddler("B open").fields.tags.indexOf("@Phone") !== -1, true);
  t("instant commit: pick temp cleared for the next pick (append-kind semantics)", wiki.getTiddler(temp).fields["hgsd-pick"], "");
  // fine setting off: option pick is temp-only again (the Add button remains the commit path)
  wiki.addTiddler({title: "$:/config/hypergsd/picker-instant-commit/fine", text: "false"});
  wiki.deleteTiddler("B open"); wiki.addTiddler({title: "B open", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_project: "P one"});
  ({w, state, pop, temp} = renderOpen("GSD/Test"));
  const sw4 = findWidgets(w, n => n.parseTreeNode && n.parseTreeNode.tag === "$select" && String(n.getAttribute("size")) === "8").pop();
  sw4.domNodes[0].value = "@Phone";
  sw4.handleChangeEvent({});
  t("setting off: option pick leaves tags untouched", wiki.getTiddler("B open").fields.tags.indexOf("@Phone"), -1);
  t("setting off: pick still written for the buttons", wiki.getTiddler(temp).fields["hgsd-pick"], "@Phone");
  wiki.deleteTiddler("$:/config/hypergsd/picker-instant-commit/fine"); // shadow default true returns
  // state hygiene for later sections: restore the tags section 3 left on the row, clear states/temp
  wiki.deleteTiddler("B open"); wiki.addTiddler({title: "B open", tags: ["$:/GSD/Action", "@Phone", "@out and about"], gsd_status: "next", gsd_complete: "false"});
  wiki.deleteTiddler(state); wiki.deleteTiddler(pop); wiki.deleteTiddler(temp);
}

// --- 4. picker options exclude the row's own contexts; create flow ---
{
  const {w, c, state, pop, temp} = renderOpen("GSD/Test");
  const {selects} = collect(c);
  t("own contexts excluded from options", selects[0], [""]);
  // typed unknown name -> create button appears; firing it creates + registers + applies
  wiki.addTiddler({title: temp, "hgsd-pick": "Brand new ctx"});
  w.refresh({[temp]: {modified: true}});
  const createBtns = findButtonByTooltip(w, "Create a new context and add it");
  t("create button offered for unknown name", createBtns.length >= 1, true);
  createBtns[createBtns.length - 1].invokeActions(createBtns[createBtns.length - 1], {type: "click"});
  t("context tiddler created", wiki.tiddlerExists("Brand new ctx"), true);
  t("context registered", (wiki.getTiddler("Brand new ctx").fields.tags || []).indexOf("GSD/Contexts") !== -1, true);
  t("row tagged with new context", wiki.getTiddler("B open").fields.tags.indexOf("Brand new ctx") !== -1, true);
  t("create clears the pick", wiki.getTiddler(temp).fields["hgsd-pick"], "");
}

// --- 5. known name -> no create button ---
{
  const {w, temp} = renderOpen("GSD/Test");
  wiki.addTiddler({title: temp, "hgsd-pick": "@Phone"});
  w.refresh({[temp]: {modified: true}});
  t("no create button for existing title", findButtonByTooltip(w, "Create a new context and add it").length, 0);
}

// --- 6. applied-context chips: contexts already on the row item render as
// linked chips before the button; the chip for the enclosing view's tiddler
// (storyTiddler) is suppressed; no contexts -> no chips ---
const chips = (vars) => {
  const body = '<$hgsd.list list-heading="T" list-filter="' + LIST_FILTER + '" group-state="false" active-parents-only="no"/>';
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + body + "\n\n</$importvariables>"),
    {document: doc, parentWidget: $tw.rootWidget, variables: Object.assign({currentTiddler: "GSD/Test"}, vars || {})});
  const c = doc.createElement("div");
  w.render(c);
  let row = null;
  const out = {};
  const textOf = (m) => { let s = ""; (function g(x){ if(!x||typeof x!=="object") return; if(Array.isArray(x)) return x.forEach(g); if(x.isTiddlyWikiFakeDom) return (x.children||[]).forEach(g); s += (x.textContent||""); })(m); return s.replace(/\s+/g," ").trim(); };
  (function f(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(f);
    if (!n.isTiddlyWikiFakeDom) return;
    if ((n.attributes && n.attributes.class || "").indexOf("gsd-list-item-title") !== -1)
      row = decodeURIComponent((n.attributes.href || "").replace(/^#\/?/, ""));
    if (row !== null && n.tag === "button" && (n.attributes.class || "").indexOf("tc-tag-label") !== -1)
      out[row] = (out[row] || []).concat(textOf(n));
    (n.children || []).forEach(f);
  })(c);
  return out;
};
{
  wiki.addTiddler({title: "C open tagged", tags: ["$:/GSD/Action", "@Phone", "@out and about"], gsd_status: "next", gsd_complete: "false"});
  wiki.addTiddler({title: "C bare", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false"});
  t("applied contexts chip on the row, sorted", chips()["C open tagged"], ["@out and about", "@Phone"]);
  t("context-less row has no chips", chips()["C bare"], undefined);
  t("chip for the enclosing view's context suppressed", chips({storyTiddler: "@Phone"})["C open tagged"], ["@out and about"]);
  wiki.deleteTiddler("C open tagged");
  wiki.deleteTiddler("C bare");
}

// --- 7. alias path: rows rendered OUTSIDE hgsd-render-inner, where no
// per-list scope exists — the state degrades to row-only (trailing empty
// group and scope components) and still opens through the row gate.
// (2026-09-05: with the whitelist variable undefined the gate was inhibited
// permanently and the reveal could never open — contextualise buttons looked
// dead on project pages while the same rows worked on dashboards.) ---
{
  const body = '<$list filter="[[B open]]"><$transclude $variable="hgsd-item"/></$list>';
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + body + "\n\n</$importvariables>"),
    {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
  const c = doc.createElement("div");
  w.render(c);
  const toggle = findWidgets(w, n => n.parseTreeNode && n.parseTreeNode.tag === "$button" &&
    typeof n.set === "string" && n.set.indexOf("$:/state/hypergsd/contextualise") === 0).pop();
  t("alias path: scope degrades to row-only", toggle.set, "$:/state/hypergsd/contextualise-B open--");
  wiki.addTiddler({title: toggle.set, text: "open"});
  w.refresh({[toggle.set]: {modified: true}});
  const et = findWidgets(w, n => n.parseTreeNode && n.parseTreeNode.tag === "$edit-text" &&
    typeof n.getAttribute === "function" && typeof n.getAttribute("tiddler") === "string" &&
    n.getAttribute("tiddler").indexOf("$:/temp/hypergsd/add-context-") === 0).pop();
  wiki.addTiddler({title: et.getAttribute("focusPopup"), text: "(0,0,1,1)"});
  w.refresh({[et.getAttribute("focusPopup")]: {modified: true}});
  let selects = 0;
  (function f(n){ if(!n||typeof n!=="object") return; if(Array.isArray(n)) return n.forEach(f);
    if(n.isTiddlyWikiFakeDom) { if(n.tag === "select") selects++; (n.children||[]).forEach(f); } })(c);
  t("alias-path row unfreezes on its state change (project-page rows)", selects >= 1, true);
  wiki.deleteTiddler(toggle.set);
  wiki.deleteTiddler(et.getAttribute("focusPopup"));
  wiki.deleteTiddler(et.getAttribute("tiddler"));
}

// --- 8. show-contexts config: absent = chips show (sections 1-6 prove it);
// text "no" hides ONLY the chips (button remains); deleting restores ---
{
  wiki.addTiddler({title: "C gate2", tags: ["$:/GSD/Action", "@Phone"], gsd_status: "next", gsd_complete: "false"});
  wiki.addTiddler({title: "$:/config/hypergsd/Contexts/show-contexts", text: "no"});
  const out = chips();
  t("config no: chips hidden", out["C gate2"], undefined);
  t("config no: contextualise button remains", rowCtxButtons((() => {
    const body = '<$hgsd.list list-heading="T" list-filter="' + LIST_FILTER + '" group-state="false" active-parents-only="no"/>';
    const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + body + "\n\n</$importvariables>"),
      {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
    const c = doc.createElement("div"); w.render(c);
    return c;
  })())["C gate2"], 1);
  wiki.deleteTiddler("$:/config/hypergsd/Contexts/show-contexts");
  t("config deleted: chips return", chips()["C gate2"], ["@Phone"]);
  wiki.deleteTiddler("C gate2");
  // the Settings tab renders the core-styled checkbox with its label
  const tab = '<$transclude $tiddler="$:/plugins/yan/hypergsd-contexts/ui/control-panel/context-list" $mode="block"/>';
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + tab + "\n\n</$importvariables>"),
    {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
  const c = doc.createElement("div"); w.render(c);
  let label = "", hasCheckbox = false;
  (function f(n){ if(!n||typeof n!=="object") return; if(Array.isArray(n)) return n.forEach(f);
    if(n.isTiddlyWikiFakeDom) { if(n.tag === "input" && (n.attributes||{}).type === "checkbox") hasCheckbox = true;
      (n.children||[]).forEach(f); }
    else label += (n.textContent||"") + " "; })(c);
  t("settings tab: checkbox present with linked label",
    [hasCheckbox, label.indexOf("Show tagged contexts with links") !== -1], [true, true]);
}

// --- 9. grouped copies: one action under two context groups renders two rows
// whose state/temp/popup titles differ; opening one copy leaves the other
// closed (the 2026-09-13 "picker open in every copy" bug, A14) ---
{
  wiki.addTiddler({title: "D dual", tags: ["$:/GSD/Action", "@Phone", "@out and about"], gsd_status: "next", gsd_complete: "false"});
  wiki.addTiddler({title: "$:/config/hypergsd/list-view/GSD/Grp/T", "hgsd-group": "$:/plugins/yan/hypergsd-contexts/ui/group-by/context"});
  const body = '<$hgsd.list list-heading="T" list-filter="[all[tiddlers]tag[$:/GSD/Action]] +[sort[title]]" group-select="yes" active-parents-only="no"/>';
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + body + "\n\n</$importvariables>"),
    {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Grp"}});
  const c = doc.createElement("div");
  w.render(c);
  const sets = findWidgets(w, n => n.parseTreeNode && n.parseTreeNode.tag === "$button" &&
    typeof n.set === "string" && n.set.indexOf("$:/state/hypergsd/contextualise-D dual-") === 0).map(b => b.set);
  t("grouped: two copies of the dual-context row", sets.length, 2);
  t("grouped: copies carry distinct state titles", new Set(sets).size, 2);
  const cb = findWidgets(w, n => n.parseTreeNode && n.parseTreeNode.tag === "$checkbox" &&
    typeof n.getAttribute === "function" && typeof n.getAttribute("tiddler") === "string" &&
    n.getAttribute("tiddler").indexOf("$:/temp/gsd-list/") === 0).pop();
  const scope9 = cb.getAttribute("tiddler").slice("$:/temp/gsd-list/".length);
  t("grouped: copy under @out and about", sets[0], "$:/state/hypergsd/contextualise-D dual-@out and about-" + scope9);
  t("grouped: copy under @Phone", sets[1], "$:/state/hypergsd/contextualise-D dual-@Phone-" + scope9);
  // open ONE copy: its picker renders, the sibling stays closed (no second picker)
  wiki.addTiddler({title: sets[0], text: "open"});
  w.refresh({[sets[0]]: {modified: true}});
  const ets = findWidgets(w, n => n.parseTreeNode && n.parseTreeNode.tag === "$edit-text" &&
    typeof n.getAttribute === "function" && typeof n.getAttribute("tiddler") === "string" &&
    n.getAttribute("tiddler").indexOf("$:/temp/hypergsd/add-context-D dual-") === 0);
  t("grouped: one open copy renders one picker input", ets.length, 1);
  t("grouped: temp title carries the group", ets[0].getAttribute("tiddler"), sets[0].replace("$:/state/hypergsd/contextualise-", "$:/temp/hypergsd/add-context-"));
  t("grouped: sibling copy stays closed", wiki.tiddlerExists(sets[1]), false);
  wiki.deleteTiddler(sets[0]); wiki.deleteTiddler(ets[0].getAttribute("tiddler"));
  wiki.deleteTiddler("D dual");
  wiki.deleteTiddler("$:/config/hypergsd/list-view/GSD/Grp/T");
}

// --- 10. cross-instance: the same row on two list instances carries different
// scope components, so opening one copy cannot open the other (A14) ---
{
  const a = renderOpen("GSD/HostA");
  const b = renderOpen("GSD/HostB");
  t("instances: state titles differ", a.state !== b.state, true);
  t("instances: both carry the row", [a.state.indexOf("$:/state/hypergsd/contextualise-B open-") === 0, b.state.indexOf("$:/state/hypergsd/contextualise-B open-") === 0], [true, true]);
  t("instances: popups differ", a.pop !== b.pop, true);
  t("instances: temps differ", a.temp !== b.temp, true);
  wiki.deleteTiddler(a.state); wiki.deleteTiddler(a.pop); wiki.deleteTiddler(a.temp);
  wiki.deleteTiddler(b.state); wiki.deleteTiddler(b.pop); wiki.deleteTiddler(b.temp);
}
console.log(fails === 0 ? "ALL CONTEXTUALISE CASES PASS" : fails + " FAILURE(S)");