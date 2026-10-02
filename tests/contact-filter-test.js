// Multi-contact search (hypergsd-contacts 0.2.1): the picker strip member
// (Strip tag list, bound to the "Actions by contact" heading) rendered inside
// the host list's view strip ahead of Sort by, plus the always-grouped
// combined member in Portion/1 and the roster's Portion/Full band. Covers
// strip placement, no placeholder, Group by withdrawn on the combined list,
// popup and typing THROUGH the chassis and row gates (the freeze
// regressions), instant commit, chip removal and the two-string tooltip.
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-wiki"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;

const SELECTION = "$:/config/hypergsd/contact-filter/selection";
const POPUP = "$:/state/popup/pick-contact-filter-GSD/Contacts";
const TEMP = "$:/temp/hypergsd/contact-filter/pick";

// Fixtures: contacts with a spaced title (titlelist quoting), actions across
// the three statuses, plus the two excluded shapes (contactless, completed).
wiki.addTiddler({title: "ZZ Alice", tags: ["$:/GSD/Contact"]});
wiki.addTiddler({title: "ZZ Bob Comp", tags: ["$:/GSD/Contact"]});
wiki.addTiddler({title: "ZZ Carol", tags: ["$:/GSD/Contact"]});
wiki.addTiddler({title: "ZZ act next Alice", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_contact: "ZZ Alice"});
wiki.addTiddler({title: "ZZ act wait Alice", tags: ["$:/GSD/Action"], gsd_status: "waiting", gsd_complete: "false", gsd_contact: "ZZ Alice"});
wiki.addTiddler({title: "ZZ act future Bob", tags: ["$:/GSD/Action"], gsd_status: "future", gsd_complete: "false", gsd_contact: "ZZ Bob Comp"});
wiki.addTiddler({title: "ZZ act next Bob", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_contact: "ZZ Bob Comp"});
wiki.addTiddler({title: "ZZ act solo", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false"});
wiki.addTiddler({title: "ZZ act done Alice", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "true", gsd_contact: "ZZ Alice"});

let fails = 0;
const t = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + name + (ok ? "" : " got:" + JSON.stringify(got))); };
const setSelection = (list) => list === null ? wiki.deleteTiddler(SELECTION) : wiki.addTiddler({title: SELECTION, list});
const renderPage = () => {
  const body = '<$importvariables filter="[[$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[$:/tags/Global/View]!is[draft]]">' + '\n\n<$transclude $tiddler="GSD/Contacts"/>\n\n</$importvariables>';
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", body), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Contacts"}});
  const c = doc.createElement("div"); w.render(c);
  return {c, w};
};
// The page widget stays alive across writes; refresh(changedTiddlers) replays
// the browser's change dispatch (the gates read change-map titles only).
const poke = (w, title) => { const m = {}; m[title] = {}; w.refresh(m); };
const textOf = (x) => { let s = ""; (function h(y) { if (!y || typeof y !== "object") return; if (Array.isArray(y)) return y.forEach(h); if (y.isTiddlyWikiFakeDom) return (y.children || []).forEach(h); s += (y.textContent || ""); })(x); return s.replace(/\s+/g, " ").trim(); };
const byClass = (c, cls) => { const out = []; (function f(n) { if (!n || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(f); if (!n.isTiddlyWikiFakeDom) return; if ((((n.attributes || {}).class) || "").indexOf(cls) !== -1) out.push(n); (n.children || []).forEach(f); })(c.children); return out; };
const findWidgets = (w, pred) => { const out = []; (function f(n) { if (!n || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(f); if (pred(n)) out.push(n); (n.children || []).forEach(f); })(w); return out; };
const actionRows = (c) => byClass(c, "gsd-list-item-title").map(textOf).filter(s => s.indexOf("ZZ act") !== -1).sort();
const headings = (c) => byClass(c, "gsd-list-heading").map(textOf);
const groupTitles = (c) => byClass(c, "hgsd-group-title").map(textOf);
const inputsIn = (node) => { const out = []; (function f(n) { if (!n || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(f); if (!n.isTiddlyWikiFakeDom) return; if (n.tag === "input") out.push((n.attributes || {})); (n.children || []).forEach(f); })(node.children || node); return out; };

// 1. Page composition: the combined list claims Portion/1, the roster the
//    trailing Full band (Actions first in the DOM), always grouped by contact.
setSelection(null);
{
  const {c} = renderPage();
  t("headings (Portion/1 before Full band)", headings(c), ["Actions by contact", "Contact list"]);
  t("empty selection rows", actionRows(c), ["ZZ act future Bob", "ZZ act next Alice", "ZZ act next Bob", "ZZ act wait Alice"]);
  t("always grouped by contact (no selection)", groupTitles(c), ["ZZ Alice", "ZZ Bob Comp"]);
  t("no filter error", textOf(c).indexOf("Filter error") !== -1, false);
  t("no raw template markers", /<%|%>/.test(textOf(c)), false);
}

// 2. The strip member: inside the HOST list's strip, ahead of Sort by, with
//    no placeholder, and the host's Group by block withdrawn (the roster's
//    own strip keeps its grouping controls).
setSelection(null);
{
  const {c} = renderPage();
  const strips = byClass(c, "hgsd-group-strip");
  t("strip count (one per list)", strips.length, 2);
  const host = textOf(strips[0]);
  const labelAt = host.indexOf("Filter by contacts:"), sortAt = host.indexOf("Sort by");
  t("strip label renders in host strip", labelAt !== -1, true);
  t("strip label before Sort by", labelAt !== -1 && sortAt !== -1 && labelAt < sortAt, true);
  t("no empty-state hint anywhere", textOf(c).indexOf("no contacts picked") !== -1, false);
  t("picker input present with no placeholder", inputsIn(strips[0]).filter(a => (a.class || "").indexOf("tc-popup-handle") !== -1).map(a => a.placeholder === undefined), [true]);
  t("host strip has no Group by", host.indexOf("Group by") !== -1, false);
  t("roster strip keeps Group by", textOf(strips[1]).indexOf("Group by") !== -1, true);
  t("roster strip has no strip member", textOf(strips[1]).indexOf("no contacts picked") !== -1, false);
}

// 3. Popup and typing THROUGH the gates: render closed, then open the popup
//    and narrow it by writes alone (chassis + row gate prefix runs — the
//    strip-member freeze regression).
setSelection(null);
{
  const {c, w} = renderPage();
  const selectIn = () => findWidgets(w, n => n.parseTreeNode && n.parseTreeNode.tag === "$select" && String(n.getAttribute("size")) === "8").pop();
  t("popup closed at render", !!selectIn(), false);
  wiki.addTiddler({title: POPUP, text: "(0,0,0,0)"});
  poke(w, POPUP);
  let sel = selectIn();
  t("popup opens through the gates", !!sel, true);
  wiki.addTiddler({title: TEMP, text: "carol", "hgsd-pick": "carol"});
  poke(w, TEMP);
  sel = selectIn();
  const options = sel ? findWidgets(sel, n => n.parseTreeNode && n.parseTreeNode.type === "element" && n.parseTreeNode.tag === "option").map(n => textOf(n.domNodes && n.domNodes[0] || n)).filter(s => s.indexOf("ZZ ") !== -1) : null;
  t("typing narrows candidates through the gates", options, ["ZZ Carol"]);
  wiki.deleteTiddler(TEMP); wiki.deleteTiddler(POPUP);
}

// 4. Add-button flow: the dropdown only FILLS the input; Add commits, and
//    ((input-accept)) runs the same commit; rows narrow on the live tree.
setSelection(null);
{
  const {c, w} = renderPage();
  wiki.addTiddler({title: POPUP, text: "(0,0,0,0)"});
  poke(w, POPUP);
  const sel = findWidgets(w, n => n.parseTreeNode && n.parseTreeNode.tag === "$select" && String(n.getAttribute("size")) === "8").pop();
  t("picker select rendered", !!sel, true);
  if (sel) { sel.domNodes[0].value = "ZZ Carol"; sel.handleChangeEvent({}); }
  t("dropdown fills without committing", wiki.getTiddlerList(SELECTION, "list"), []);
  t("input holds the pick", wiki.getTiddlerText(TEMP + "::hgsd-pick") !== null ? wiki.filterTiddlers("[[" + TEMP + "]get[hgsd-pick]]").join("") : "?", "ZZ Carol");
  const addBtn = findWidgets(w, n => n.parseTreeNode && n.parseTreeNode.tag === "$button" && n.domNodes && n.domNodes[0] && /\badd\b/i.test((n.domNodes[0].textContent || "")) && !(n.domNodes[0].attributes || {}).title).pop();
  t("Add button present with core string", !!addBtn, true);
  if (addBtn) addBtn.invokeActionString(addBtn.getAttribute("actions"), addBtn, {type: "click"}, {variables: {}});
  t("Add commits the pick", wiki.getTiddlerList(SELECTION, "list"), ["ZZ Carol"]);
  poke(w, SELECTION);
  t("rows narrow after commit", actionRows(c), []);
  // keyboard route: type a fresh pick, fire the ((input-accept)) actions string
  wiki.addTiddler({title: TEMP, "hgsd-pick": "ZZ Bob Comp"});
  poke(w, TEMP);
  const kb = (() => { let k = null; (function f(n) { if (k || !n || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(f); if (n.parseTreeNode && n.parseTreeNode.tag === "$keyboard") { k = n; return; } (n.children || []).forEach(f); })(w.children); return k; })();
  t("keyboard bound", kb ? (kb.getAttribute("key") || "").indexOf("input-accept") !== -1 : false, true);
  if (kb) kb.invokeActionString(kb.getAttribute("actions"), kb, null, {variables: {}});
  t("input-accept commits", wiki.getTiddlerList(SELECTION, "list"), ["ZZ Carol", "ZZ Bob Comp"]);
  // guard: a non-existent pick neither commits nor clears the box
  wiki.addTiddler({title: TEMP, "hgsd-pick": "No Such Contact"});
  if (kb) kb.invokeActionString(kb.getAttribute("actions"), kb, null, {variables: {}});
  t("non-existent pick adds nothing", wiki.getTiddlerList(SELECTION, "list"), ["ZZ Carol", "ZZ Bob Comp"]);
  t("non-existent pick keeps the text", wiki.filterTiddlers("[[" + TEMP + "]get[hgsd-pick]]").join(""), "No Such Contact");
  t("input cleared after real commit", (() => { wiki.addTiddler({title: TEMP, "hgsd-pick": "ZZ Carol"}); if (kb) kb.invokeActionString(kb.getAttribute("actions"), kb, null, {variables: {}}); const f = wiki.getTiddler(TEMP).fields; return f["hgsd-pick"] === undefined ? "" : f["hgsd-pick"]; })(), "");
  wiki.deleteTiddler(POPUP);
}

// 5. Selections: one contact, then two incl. a spaced title through the
//    titlelist round trip; grouping follows the narrowed rows.
setSelection(["ZZ Alice"]);
{
  const {c} = renderPage();
  t("alice rows", actionRows(c), ["ZZ act next Alice", "ZZ act wait Alice"]);
  t("grouped to the selection", groupTitles(c), ["ZZ Alice"]);
  t("label stays with selection", byClass(c, "hgsd-contact-select").map(textOf).some(s => s.indexOf("Filter by contacts:") !== -1), true);
}
setSelection(["ZZ Alice", "ZZ Bob Comp"]);
{
  const {c} = renderPage();
  t("alice+bob rows", actionRows(c), ["ZZ act future Bob", "ZZ act next Alice", "ZZ act next Bob", "ZZ act wait Alice"]);
}

// 6. Chips: one per selected contact, link text + two-string × tooltip.
{
  const {c, w} = renderPage();
  const chips = byClass(c, "hgsd-contact-chip");
  t("chip count", chips.length, 2);
  const tips = findWidgets(w, n => n.parseTreeNode && n.parseTreeNode.tag === "$button" && n.domNodes && n.domNodes[0] && /Remove contact ZZ /.test((n.domNodes[0].attributes || {}).title || "")).map(n => n.domNodes[0].attributes.title).sort();
  t("chip tooltips", tips, ["Remove contact ZZ Alice from search", "Remove contact ZZ Bob Comp from search"]);
}

// 7. × removal strips exactly the chip's contact.
setSelection(["ZZ Alice", "ZZ Bob Comp"]);
{
  const {w} = renderPage();
  const btns = findWidgets(w, n => n.parseTreeNode && n.parseTreeNode.tag === "$button" && n.domNodes && n.domNodes[0] && (n.domNodes[0].attributes || {}).title === "Remove contact ZZ Alice from search");
  t("alice remove button", btns.length, 1);
  if (btns.length) btns[0].invokeActions(btns[0], {type: "click"});
  t("removal result", wiki.getTiddlerList(SELECTION, "list"), ["ZZ Bob Comp"]);
}

// 8. Lingo strings resolve; the placeholder key is gone.
t("heading lingo", wiki.getTiddlerText("$:/language/hypergsd/Lists/ContactFilter"), "Actions by contact");
t("roster heading lingo", wiki.getTiddlerText("$:/language/hypergsd/Lists/Contacts"), "Contact list");
t("placeholder key removed", wiki.getTiddlerText("$:/language/hypergsd/Lists/ContactFilter/Placeholder"), undefined);
t("filter label lingo", wiki.getTiddlerText("$:/language/hypergsd/Lists/ContactFilter/Filter"), "Filter by contacts:&#x2004;");
t("all-hint key removed", wiki.getTiddlerText("$:/language/hypergsd/Lists/ContactFilter/All"), undefined);
t("hintA lingo", wiki.getTiddlerText("$:/language/hypergsd/Lists/ContactFilter/Remove/HintA"), "Remove contact");
t("hintB lingo", wiki.getTiddlerText("$:/language/hypergsd/Lists/ContactFilter/Remove/HintB"), "from search");

setSelection(null);
console.log(fails ? "FAILURES: " + fails : "ALL PASS");
process.exit(fails ? 1 : 0);