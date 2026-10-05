// Dashboard list composition: tag-driven loops, visibility gating, order via
// the tag list (core-owned list field plus member list-before/list-after pins).
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-wiki"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;

// Fixture data: a few items so lists exercise rows, but assertions target list titles.
wiki.addTiddler({title: "P one", tags: ["$:/GSD/Project"], gsd_status: "active"});
wiki.addTiddler({title: "A next", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_project: "P one"});
wiki.addTiddler({title: "A wait", tags: ["$:/GSD/Action"], gsd_status: "waiting", gsd_complete: "false", gsd_project: "P one"});
wiki.addTiddler({title: "A done", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "true", gsd_comp_date: "20260820120000000", gsd_project: "P one"});
wiki.addTiddler({title: "C one", tags: ["$:/GSD/Contact"]});
wiki.addTiddler({title: "R one", tags: ["$:/GSD/Reference"]});

const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';
const render = (title) => {
  const body = G + '\n\n<$transclude $tiddler="' + title + '"/>\n\n</$importvariables>';
  const parser = wiki.parseText("text/vnd.tiddlywiki", body);
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
  const c = doc.createElement("div"); w.render(c);
  const titles = [];
  let strays = 0;
  (function f(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(f);
    if (n.isTiddlyWikiFakeDom) {
      if (((n.attributes || {}).class || "").indexOf("gsd-list-heading") !== -1)
        titles.push((function txt(m) {
          let s = "";
          (function g(x) {
            if (!x || typeof x !== "object") return;
            if (Array.isArray(x)) return x.forEach(g);
            if (x.isTiddlyWikiFakeDom) return (x.children || []).forEach(g);
            s += (x.textContent || "");
          })(m);
          return s;
        })(n).replace(/\s+/g, " ").trim());
      (n.children || []).forEach(f);
    } else if ((n.textContent || "").trim() === ">") strays++;
  })(c);
  render.strays = (render.strays || 0) + strays;
  return titles;
};
const vis = (ns, list) => "$:/config/" + ns + "/visibility/" + list;

// Shared strip collector: labels (with optional on/off state via the
// tc-radio-selected label class / input checked attribute) from every
// .hgsd-group-strip in a rendered container.
const collectStrip = (root, withStates) => {
  const out = [];
  (function f(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(f);
    if (!n.isTiddlyWikiFakeDom) return;
    if (((n.attributes || {}).class || "").indexOf("hgsd-group-strip") !== -1) {
      (function g(m) {
        if (!m || typeof m !== "object") return;
        if (Array.isArray(m)) return m.forEach(g);
        if (m.isTiddlyWikiFakeDom && m.tag === "label") {
          const text = (m.children || []).map(x => x.textContent || "").join("").trim();
          if (!withStates) { out.push(text); return; }
          const cls = (m.attributes || {}).class || "";
          const input = (m.children || []).find(x => x.tag === "input");
          out.push(text + "|" + ((cls.indexOf("tc-radio-selected") !== -1 || (input && input.attributes && input.attributes.checked === "true")) ? "on" : "off"));
        }
        (m.children || []).forEach(g);
      })(n);
    }
    (n.children || []).forEach(f);
  })(root);
  return out;
};
let fails = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? "PASS " : "FAIL ") + name + (ok ? "" : " got:" + JSON.stringify(got) + " want:" + JSON.stringify(want)));
};

// 1. Main dashboard: default composition and order (by-contact seeded hidden, completed in collapsed reveal; the roster left the dashboard with 4356189)
check("main default composition",
  render("GSD/Dashboard").filter(t => !t.includes("items")),
  ["Next actions", "Active projects", "Future actions", "Future projects", "Waiting actions"]);

// 2. Visibility toggle hides a list (checkbox state tiddler)
wiki.addTiddler({title: vis("hypergsd/Lists/Dashboard", "$:/plugins/yan/hypergsd/ui/lists/future-project-list"), text: "hide"});
check("hide Future projects via visibility",
  render("GSD/Dashboard").filter(t => !t.includes("items")),
  ["Next actions", "Active projects", "Future actions", "Waiting actions"]);
wiki.deleteTiddler(vis("hypergsd/Lists/Dashboard", "$:/plugins/yan/hypergsd/ui/lists/future-project-list"));

// 3. Seeded-hidden member appears when enabled (joins Portion/1 unlisted; the flat list stays Portion/2)
wiki.addTiddler({title: vis("hypergsd/Lists/Dashboard", "$:/plugins/yan/hypergsd-contacts/ui/lists/waiting-action-list-by-contact"), text: "show"});
check("enable by-contact variant",
  render("GSD/Dashboard").filter(t => !t.includes("items")),
  ["Next actions", "Waiting actions by contact", "Active projects", "Future actions", "Future projects", "Waiting actions"]);
wiki.deleteTiddler(vis("hypergsd/Lists/Dashboard", "$:/plugins/yan/hypergsd-contacts/ui/lists/waiting-action-list-by-contact"));

// 4. Drag-reorder = tag tiddler list field write (core's drag deletes member
// pins first; the by-contact pins stay inert here because those lists are
// seeded hidden): future projects pinned first (within Portion/1; waiting keeps
// its explicit Portion/2 tag, completed stay in the Full band)
wiki.addTiddler({title: "$:/tags/hypergsd/Lists/Dashboard", list: [
  "$:/plugins/yan/hypergsd/ui/lists/future-project-list",
  "$:/plugins/yan/hypergsd/ui/lists/next-action-list",
  "$:/plugins/yan/hypergsd/ui/lists/active-project-list",
  "$:/plugins/yan/hypergsd/ui/lists/future-action-list",
  "$:/plugins/yan/hypergsd/ui/lists/waiting-action-list",
  "$:/plugins/yan/hypergsd/ui/lists/completed-action-list",
  "$:/plugins/yan/hypergsd/ui/lists/completed-project-list"]});
check("list-field reorder honored",
  render("GSD/Dashboard").filter(t => !t.includes("items")),
  ["Future projects", "Next actions", "Active projects", "Future actions", "Waiting actions"]);

// 5. Completed lists are self-lazy ($hgsd.toggle inside the members): collapsed
// by default (button, no heading); one per-page state opens both (shared default);
// the per-member visibility gate removes a member entirely, button and all
const textOf = (title) => {
  const body = G + '\n\n<$transclude $tiddler="' + title + '"/>\n\n</$importvariables>';
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", body), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
  const c = doc.createElement("div"); w.render(c);
  let s = "";
  (function f(n){ if(!n||typeof n!=="object") return; if(Array.isArray(n)) return n.forEach(f);
    if(n.isTiddlyWikiFakeDom) return (n.children||[]).forEach(f);
    s += (n.textContent||"") + " "; })(c);
  return s.replace(/\s+/g, " ").trim();
};
let out = render("GSD/Dashboard");
check("completed collapsed by default (no headings, both buttons present)",
  [out.includes("Completed actions"), out.includes("Completed projects"),
   textOf("GSD/Dashboard").includes("show completed actions"), textOf("GSD/Dashboard").includes("show completed items")],
  [false, false, true, true]);
wiki.addTiddler({title: "$:/state/hypergsd/show-completed/GSD/Test", text: "show"}); // render() pins currentTiddler=GSD/Test
out = render("GSD/Dashboard");
check("one page state opens both completed lists",
  [out.includes("Completed actions"), out.includes("Completed projects")], [true, true]);
wiki.addTiddler({title: vis("hypergsd/Lists/Dashboard", "$:/plugins/yan/hypergsd/ui/lists/completed-action-list"), text: "hide"});
out = render("GSD/Dashboard");
check("visibility gate removes the member (button and all)",
  [out.includes("Completed actions"), textOf("GSD/Dashboard").includes("show completed actions"), out.includes("Completed projects")],
  [false, false, true]);
wiki.deleteTiddler("$:/state/hypergsd/show-completed/GSD/Test");
wiki.deleteTiddler(vis("hypergsd/Lists/Dashboard", "$:/plugins/yan/hypergsd/ui/lists/completed-action-list"));

// 6. Waiting page: seeded default renders only the by-contact view; enabling adds the flat list
check("waiting default = by-contact only", render("GSD/Actions waiting"), ["Waiting actions by contact"]);
wiki.addTiddler({title: vis("hypergsd/Lists/Waiting", "$:/plugins/yan/hypergsd/ui/lists/waiting-action-list"), text: "show"});
check("waiting page with flat list enabled", render("GSD/Actions waiting"),
  ["Waiting actions by contact", "Waiting actions"]);

// 7. No Next Action page renders the tagged list tiddler (deduplicated)
check("no-next-action page", render("GSD/Projects without next actions"), ["Projects without next actions"]);

// 8. Other pages render via their tags (completed members self-lazy: no heading until opened)
check("action dashboard (completed self-lazy below)", render("GSD/Action dashboard"),
  ["Next actions", "Waiting actions"]);
check("project dashboard (completed self-lazy below)", render("GSD/Project dashboard"),
  ["Active projects", "Future projects"]);
check("cleanup page", render("GSD/Cleanup: completed items"), ["Completed actions", "Completed projects"]);
check("contacts page", render("GSD/Contacts"),
  ["Actions by contact", "Contact list"]);
// the combined member's visibility config is honoured: hiding it leaves the roster alone
wiki.addTiddler({title: vis("hypergsd/Lists/Contact", "$:/plugins/yan/hypergsd-contacts/ui/lists/contact-filtered-action-list"), text: "hide"});
check("contacts page: combined list hidden",
  render("GSD/Contacts"),
  ["Contact list"]);
wiki.deleteTiddler(vis("hypergsd/Lists/Contact", "$:/plugins/yan/hypergsd-contacts/ui/lists/contact-filtered-action-list"));

// 8b. Portion claims on the Contact surface: the Contacts page runs the shared
// chassis, so Portion/2 members land in a second .hgsd-portion-columns child
// (the old hand-rolled loop ignored claims — a settings promise the page broke)
{
  const CL = "$:/plugins/yan/hypergsd-contacts/ui/lists/contact-list";
  const FA = "$:/plugins/yan/hypergsd-contacts/ui/lists/contact-filtered-action-list";
  // claim portions on USER overrides carrying the shadow bodies (a tag-only override
  // would mask the plugin list with an empty text); restore by deleting the override
  const claim = (title, extra) => wiki.addTiddler({title, text: wiki.getTiddler(title).fields.text, tags: ["$:/tags/hypergsd/Lists/Contact"].concat(extra)});
  const columns = () => {
    const body = G + '\n\n<$transclude $tiddler="GSD/Contacts"/>\n\n</$importvariables>';
    const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", body), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
    const c = doc.createElement("div"); w.render(c);
    let cols = null;
    (function f(n) {
      if (cols || !n || typeof n !== "object") return;
      if (Array.isArray(n)) return n.forEach(f);
      if (!n.isTiddlyWikiFakeDom) return;
      if (((n.attributes || {}).class || "").indexOf("hgsd-portion-columns") !== -1) {
        cols = (n.children || []).filter(ch => ch.isTiddlyWikiFakeDom && ch.tag === "div").map(col => {
          const hs = [];
          (function g(m) {
            if (!m || typeof m !== "object") return;
            if (Array.isArray(m)) return m.forEach(g);
            if (!m.isTiddlyWikiFakeDom) return;
            if (((m.attributes || {}).class || "").indexOf("gsd-list-heading") !== -1)
              hs.push((function txt(x) { let s = ""; (function h(y) { if (!y || typeof y !== "object") return; if (Array.isArray(y)) return y.forEach(h); if (y.isTiddlyWikiFakeDom) return (y.children || []).forEach(h); s += (y.textContent || ""); })(x); return s.replace(/\s+/g, " ").trim(); })(m));
            (m.children || []).forEach(g);
          })(col);
          return hs;
        });
        return;
      }
      (n.children || []).forEach(f);
    })(c);
    return cols;
  };
  claim(CL, []);
  claim(FA, ["$:/tags/hypergsd/Lists/Contact/Portion/2"]);
  check("contacts page: portion claims make two columns",
    columns(), [["Contact list"], ["Actions by contact"]]);
  wiki.deleteTiddler(CL); wiki.deleteTiddler(FA);
  // shipped claims: the combined list owns Portion/1; the roster rides the trailing Full band
  const fullBand = () => {
    const body = G + '\n\n<$transclude $tiddler="GSD/Contacts"/>\n\n</$importvariables>';
    const w2 = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", body), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
    const c2 = doc.createElement("div"); w2.render(c2);
    const hs = [];
    (function f(n) {
      if (!n || typeof n !== "object") return;
      if (Array.isArray(n)) return n.forEach(f);
      if (!n.isTiddlyWikiFakeDom) return;
      if (((n.attributes || {}).class || "").indexOf("hgsd-portion-full") !== -1) {
        (function g(m) {
          if (!m || typeof m !== "object") return;
          if (Array.isArray(m)) return m.forEach(g);
          if (!m.isTiddlyWikiFakeDom) return;
          if (((m.attributes || {}).class || "").indexOf("gsd-list-heading") !== -1)
            hs.push((function txt(x) { let s = ""; (function h(y) { if (!y || typeof y !== "object") return; if (Array.isArray(y)) return y.forEach(h); if (y.isTiddlyWikiFakeDom) return (y.children || []).forEach(h); s += (y.textContent || ""); })(x); return s.replace(/\s+/g, " ").trim(); })(m));
          (m.children || []).forEach(g);
        })(n);
        return;
      }
      (n.children || []).forEach(f);
    })(c2);
    return hs;
  };
  check("contacts page: shipped portions — combined in Portion/1",
    columns(), [["Actions by contact"]]);
  check("contacts page: shipped portions — roster in the Full band",
    fullBand(), ["Contact list"]);
}

// by-contact trio available-but-hidden on the main Dashboard: the Dashboards
// settings rows carry their captions (main sub-tab), the Contacts sub-tab
// lists the roster and the combined list (the trio is untagged from that page)
{
  const text = (tid) => {
    const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki",
      G + '\n\n<$transclude $tiddler="' + tid + '" $mode="block"/>\n\n</$importvariables>'),
      {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
    const c = doc.createElement("div"); w.render(c); return String(c.textContent || "");
  };
  const mainRows = text("$:/plugins/yan/hypergsd/ui/control-panel/dashboards/main-dashboard-list");
  check("settings: main Dashboard rows include the by-contact captions",
    [mainRows.indexOf("Next actions list by contact") !== -1, mainRows.indexOf("Waiting actions list by contact") !== -1, mainRows.indexOf("Future actions list by contact") !== -1],
    [true, true, true]);
  const contactRows = text("$:/plugins/yan/hypergsd-contacts/ui/control-panel/dashboards/contacts-dashboard-list");
  check("settings: Contacts sub-tab lists the roster and the combined list",
    [contactRows.indexOf("Contact list") !== -1, contactRows.indexOf("Actions by contact") !== -1],
    [true, true]);
}

// 7b. Tag-basis note: every settings drag list gains "Tiddlers tagged with <pill>";
// the portion clause appears only where rows carry a Portion picker
{
  const dom = (tid) => {
    const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki",
      G + '\n\n<$transclude $tiddler="' + tid + '" $mode="block"/>\n\n</$importvariables>'),
      {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
    const c = doc.createElement("div"); w.render(c); return c;
  };
  const textsOf = (c) => {
    let texts = [];
    (function f(n){ if(!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
      if(!n.isTiddlyWikiFakeDom)return; { let s=""; (function g(x){if(!x||typeof x!=="object")return;if(Array.isArray(x))return x.forEach(g);if(x.isTiddlyWikiFakeDom)return (x.children||[]).forEach(g);s+=(x.textContent||"");})(n); const t = s.replace(/\s+/g," ").trim(); if(t) texts.push(t); } (n.children||[]).forEach(f); })(c);
    return texts;
  };
  const noteOf = (c) => textsOf(c).filter(t => t.indexOf("Tiddlers tagged") === 0);

  const pillCheck = (c) => {
    let pills = 0;
    (function f(n){ if(!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
      if(!n.isTiddlyWikiFakeDOM)return; if((((n.attributes||{}).class)||"").indexOf("tc-tag-list-item")!==-1)pills++; (n.children||[]).forEach(f); })(c);
    return pills;
  };
  const pv = dom("$:/plugins/yan/hypergsd/ui/control-panel/project-view");
  check("tag-basis: portions list carries tag line + portion sentence in one paragraph (line break, no full stop after the pill)",
    noteOf(pv).some(s => s.indexOf("Tiddlers tagged with") === 0 && s.indexOf("Portions are the layout slots") !== -1 && s.indexOf(".") > s.indexOf("Portions are")), true);
  const sb = dom("$:/plugins/yan/hypergsd/ui/control-panel/sidebar");
  check("tag-basis: sidebar blocks carry the note without the portion sentence",
    [noteOf(sb).length >= 2, noteOf(sb).every(s => s.indexOf("Tiddlers tagged with") === 0 && s.indexOf("Portions") === -1)], [true, true]);
  const db = dom("$:/plugins/yan/hypergsd/ui/control-panel/dashboards");
  check("tag-basis: Group by / Sort by sections carry the note without the portion clause",
    noteOf(db).filter(s => s.indexOf("Portions") === -1).length >= 2, true);
}
check("completed actions page", render("GSD/Actions completed"), ["Completed actions"]);
check("completed projects page", render("GSD/Projects completed"), ["Completed projects"]);
check("references page", render("GSD/References"), ["References"]);

// 8a. project view: the References section (shipped by the References sub-plugin,
// transcluded by core's view-body-project) still renders in place with its rows
{
  wiki.addTiddler({title: "R one", tags: ["$:/GSD/Reference"], gsd_project: "P one"});
  const body = G + '\n\n<$tiddler tiddler="P one"><$transclude $tiddler="$:/plugins/yan/hypergsd/ui/ViewTemplate/view-body-project" $mode="block"/></$tiddler>\n\n</$importvariables>';
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", body), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
  const c = doc.createElement("div"); w.render(c);
  let text = "";
  (function g(x){ if(!x||typeof x!=="object")return; if(Array.isArray(x))return x.forEach(g);
    if(x.isTiddlyWikiFakeDom) return (x.children||[]).forEach(g); text += (x.textContent||""); })(c);
  check("project view shows the References section and its row", [text.indexOf("References") !== -1, text.indexOf("R one") !== -1], [true, true]);
  wiki.addTiddler({title: "R one", tags: ["$:/GSD/Reference"]});
}

// 8b. $hgsd.toggle unit: class passthrough + state hooks, hide-text default, explicit state
{
  const GI = '<$importvariables filter="[[\$:/plugins/yan/hypergsd/modules/widgets/hgsd-toggle]]">';
  const runT = (inner) => {
    const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", GI + inner + "</$importvariables>"),
      {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "Unit page"}});
    const c = doc.createElement("div"); w.render(c);
    const btns = [];
    (function f(n){ if(!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
      if(n.isTiddlyWikiFakeDom){ if(n.tag==="button") { let s="";(function g(x){if(!x||typeof x!=="object")return;if(Array.isArray(x))return x.forEach(g);if(x.isTiddlyWikiFakeDom)return (x.children||[]).forEach(g);s+=(x.textContent||"");})(n);
          btns.push({cls:(n.attributes||{}).class||"", text:s.trim()}); }
        (n.children||[]).forEach(f);} })(c);
    return btns;
  };
  const b1 = runT('<$hgsd.toggle text="TT" class="cc">KIDS</$hgsd.toggle>');
  check("toggle collapsed: one button, class passthrough + state hooks",
    [b1.length, b1[0].cls, b1[0].text], [1, "cc hgsd-toggle hgsd-toggle-closed", "TT"]);
  wiki.addTiddler({title: "$:/state/hypergsd/show-completed/Unit page", text: "show"});
  const b2 = runT('<$hgsd.toggle text="TT" class="cc">KIDS</$hgsd.toggle>');
  check("toggle open: hide-text defaults to text, open hook",
    [b2.length, b2[0].cls, b2[0].text], [1, "cc hgsd-toggle hgsd-toggle-open", "TT"]);
  wiki.addTiddler({title: "$:/state/mine2", text: "show"});
  const b3 = runT('<$hgsd.toggle text="TT" hide-text="HH" state="$:/state/mine2">KIDS</$hgsd.toggle>');
  check("toggle explicit state + hide-text", [b3[0].cls, b3[0].text], ["hgsd-toggle hgsd-toggle-open", "HH"]);
  wiki.deleteTiddler("$:/state/hypergsd/show-completed/Unit page");
  wiki.deleteTiddler("$:/state/mine2");
}

// 8c. Chassis gate scoping: another page's toggle write must not open this page's
// reveal (the scoped subtraction run); the page's own write must open it
{
  const headingsOf = (c) => { const a = []; (function f(n){ if(!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
    if(n.isTiddlyWikiFakeDom){ if(((n.attributes||{}).class||"").indexOf("gsd-list-heading")!==-1){ let s="";(function g(x){if(!x||typeof x!=="object")return;if(Array.isArray(x))return x.forEach(g);if(x.isTiddlyWikiFakeDom)return (x.children||[]).forEach(g);s+=(x.textContent||"");})(n);a.push(s.trim());} (n.children||[]).forEach(f);} })(c); return a; };
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki",
    G + '\n\n<$transclude $tiddler="GSD/Action dashboard"/>\n\n</$importvariables>'),
    {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Action dashboard"}});
  const c = doc.createElement("div"); w.render(c);
  const before = headingsOf(c);
  wiki.addTiddler({title: "$:/state/hypergsd/show-completed/Some Other Page", text: "show"});
  w.refresh({"$:/state/hypergsd/show-completed/Some Other Page": wiki.getTiddler("$:/state/hypergsd/show-completed/Some Other Page")});
  check("other page's toggle does not open this page's reveal", headingsOf(c), before);
  wiki.addTiddler({title: "$:/state/hypergsd/show-completed/GSD/Action dashboard", text: "show"});
  w.refresh({"$:/state/hypergsd/show-completed/GSD/Action dashboard": wiki.getTiddler("$:/state/hypergsd/show-completed/GSD/Action dashboard")});
  check("own page state opens the completed list", headingsOf(c),
    ["Next actions", "Waiting actions", "Completed actions"]);
  wiki.deleteTiddler("$:/state/hypergsd/show-completed/GSD/Action dashboard");
  wiki.deleteTiddler("$:/state/hypergsd/show-completed/Some Other Page");
}

// 9. References toolbar: the sort select offers all six options (ascending first)
wiki.addTiddler({title: "R two", tags: ["$:/GSD/Reference"], gsd_project: "P two"});
wiki.addTiddler({title: "R three", tags: ["$:/GSD/Reference"], gsd_project: "P one"});
wiki.addTiddler({title: "$:/state/hypergsd/references-sort", text: "+[sort[title]]"});
const renderRefs = () => {
  const body = G + '\n\n<$transclude $tiddler="GSD/References"/>\n\n</$importvariables>';
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", body), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
  const c = doc.createElement("div"); w.render(c);
  const out = {options: [], optionLabels: [], groups: [], chips: [], rows: [], strip: [], stripPrompt: null, emptyContainers: 0, stripGapCount: 0, stripChildren: [], stripMutedTexts: [], stripSelectClass: undefined};
  (function f(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(f);
    if (!n.isTiddlyWikiFakeDom) return;
    const cls = (n.attributes || {}).class || "";
    if (n.tag === "option") out.options.push(String((n.attributes || {}).value || ""));
    if (n.tag === "option") out.optionLabels.push((n.children || []).map(x => x.textContent || "").join("").trim());
    if (cls.indexOf("hgsd-group-title") !== -1) {
      const a = (n.children || []).find(x => x.tag === "a");
      out.groups.push(((n.children || []).map(x => x.textContent || "").join("") || "").trim() + (a ? "|link" : "|plain"));
    }
    if (cls.indexOf("gsd-project-chip") !== -1) out.chips.push((n.children || []).map(x => x.textContent || "").join("").trim());
    if (cls.indexOf("gsd-list-item-title") !== -1) out.rows.push((n.children || []).map(x => x.textContent || "").join("").trim());
    if (cls.indexOf("hgsd-strip-gap") !== -1) out.stripGapCount++;
    if (cls.indexOf("hgsd-group-strip") !== -1) {
      const span = (n.children || []).find(x => x.tag === "span");
      if (span) out.stripPrompt = (span.children || []).map(x => x.textContent || "").join("").replace(/\u00A0/g, " ").trim();
      out.stripChildren = (n.children || []).filter(x => x.isTiddlyWikiFakeDom).map(x => ({tag: x.tag, cls: ((x.attributes || {}).class || "")}));
      out.stripMutedTexts = (n.children || []).filter(x => ((x.attributes || {}).class || "").indexOf("gsd-muted") !== -1).map(x => (x.children || []).map(y => y.textContent || "").join(""));
      const sel = (n.children || []).find(x => x.tag === "select");
      if (sel) out.stripSelectClass = ((sel.attributes || {}).class || "");
      (function g(m) {
      if (!m || typeof m !== "object") return;
      if (Array.isArray(m)) return m.forEach(g);
      if (m.isTiddlyWikiFakeDom && m.tag === "label") out.strip.push((m.children || []).map(x => x.textContent || "").join("").trim());
      (m.children || []).forEach(g);
    })(n);
    }
    if (cls.indexOf("hgsd-project-list") !== -1 && !(n.children || []).length) out.emptyContainers++;
    (n.children || []).forEach(f);
  })(c);
  return out;
};
check("strip sort select: six member options, categories alphabetical",
  renderRefs().options,
  ["$:/plugins/yan/hypergsd/ui/sort-by/created-desc", "$:/plugins/yan/hypergsd/ui/sort-by/created-asc",
   "$:/plugins/yan/hypergsd/ui/sort-by/modified-desc", "$:/plugins/yan/hypergsd/ui/sort-by/modified-asc",
   "$:/plugins/yan/hypergsd/ui/sort-by/title-asc", "$:/plugins/yan/hypergsd/ui/sort-by/title-desc"]);
check("strip sort select: option LABELS render (not just values)",
  renderRefs().optionLabels,
  ["Recently created", "Oldest created", "Recently modified", "Oldest modified", "Title A–Z", "Title Z–A"]);
{
  const r = renderRefs();
  check("strip: flat flex items — two muted labels, the select, then the radios (no wrappers)",
    r.stripChildren.map(k => k.tag), ["span", "select", "span", "label", "label", "label"]);
  check("strip: muted labels carry no spacing entities (pair spacing is the flex gap)",
    r.stripMutedTexts, ["Sort by:", "Group by:"]);
  check("strip: the never-styled spacer span is gone", r.stripGapCount, 0);
  check("strip: select and checkbox carry no class hooks", [r.stripSelectClass, r.stripChildren.some(k => k.cls.indexOf("hgsd-group-ungrouped") !== -1)], ["", false]);
}

// 10. Grouping strip (list-level, tag list-driven): flat default offering every dimension
const GST = "$:/config/hypergsd/list-view/GSD/Test/References";
const GBT = "$:/plugins/yan/hypergsd/ui/group-by/";
let refs = renderRefs();
check("strip flat default: no groups, type-relevant dimensions only",
  [refs.groups.length, refs.strip], [0, ["None", "Projects", "Realms"]]);
check("strip carries Sort by: then Group by: prompts",
  renderRefs().stripPrompt, "Sort by:");
check("flat default: no project chip text (the jump icon covers it)", refs.chips, []);

// 11. Tick Projects: linked headings, No group plain and last, no chips, ungrouped toggle appears
wiki.addTiddler({title: GST, "hgsd-group": GBT + "project"});
refs = renderRefs();
check("grouped headings", refs.groups, ["P one|link", "P two|link", "No group|plain"]);
check("grouped: no chips, no empty containers", [refs.chips.length, refs.emptyContainers], [0, 0]);
check("strip with active dimension gains the ungrouped toggle",
  refs.strip, ["None", "Projects", "Realms", "include ungrouped"]);

// 11c. Radio selection state: None selected while flat; the chosen member selected otherwise
const stripStates = () => {
  const body = G + '\n\n<$transclude $tiddler="GSD/References"/>\n\n</$importvariables>';
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", body), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
  const c = doc.createElement("div"); w.render(c);
  return collectStrip(c, true);
};
wiki.deleteTiddler(GST);
check("radio states: None on while flat", stripStates(),
  ["None|on", "Projects|off", "Realms|off"]);
wiki.addTiddler({title: GST, "hgsd-group": GBT + "project"});
check("radio states: chosen member on, None off", stripStates(),
  ["None|off", "Projects|on", "Realms|off", "include ungrouped|on"]);

// 11b. Untick include-ungrouped: keyless rows vanish entirely
wiki.addTiddler({title: GST, "hgsd-group": GBT + "project", "hgsd-ungrouped": "no"});
refs = renderRefs();
check("ungrouped off: container gone, keyless row hidden",
  [refs.groups, refs.rows.indexOf("R one")], [["P one|link", "P two|link"], -1]);
wiki.addTiddler({title: GST, "hgsd-group": GBT + "project", "hgsd-ungrouped": "yes"});

// 11d. Group by status: ships hidden; enabled, groups follow status-set order with plain (unlinked) headings
{
  const HS = "$:/config/hypergsd/GroupBy/hidden/$:/plugins/yan/hypergsd/ui/group-by/status";
  wiki.addTiddler({title: "A fut", tags: ["$:/GSD/Action"], gsd_status: "future", gsd_complete: "false", gsd_project: "P one"});
  wiki.addTiddler({title: "A bare", tags: ["$:/GSD/Action"], gsd_complete: "false", gsd_project: "P one"});
  const renderStatus = () => {
    const body = G + '\n\n<$hgsd.list list-heading="S" list-filter="[tag[$:/GSD/Action]] -[field:gsd_complete[true]]" group-select="yes"/>\n\n</$importvariables>';
    const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", body), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
    const c = doc.createElement("div"); w.render(c);
    const out = {groups: [], strip: []};
    (function f(n) {
      if (!n || typeof n !== "object") return;
      if (Array.isArray(n)) return n.forEach(f);
      if (!n.isTiddlyWikiFakeDom) return;
      const cls = (n.attributes || {}).class || "";
      if (cls.indexOf("hgsd-group-title") !== -1) {
        const hasLink = (function l(m) { if (!m || typeof m !== "object") return false; if (Array.isArray(m)) return m.some(l);
          if (m.isTiddlyWikiFakeDom && m.tag === "a") return true; return l(m.children); })(n.children);
        out.groups.push((function txt(m) { let s = ""; (function g(x) { if (!x || typeof x !== "object") return; if (Array.isArray(x)) return x.forEach(g); if (x.isTiddlyWikiFakeDom) return (x.children || []).forEach(g); s += x.textContent || ""; })(m); return s; })(n) + (hasLink ? "|link" : "|plain"));
      }
      if (cls.indexOf("hgsd-group-strip") !== -1) (function g(m) {
        if (!m || typeof m !== "object") return;
        if (Array.isArray(m)) return m.forEach(g);
        if (m.isTiddlyWikiFakeDom && m.tag === "label") out.strip.push((m.children || []).map(x => x.textContent || "").join("").trim());
        (m.children || []).forEach(g);
      })(n);
      (n.children || []).forEach(f);
    })(c);
    return out;
  };
  const VS = "$:/config/hypergsd/list-view/GSD/Test/S";
  check("status: hidden by default — no radio", renderStatus().strip.indexOf("Status") === -1, true);
  wiki.addTiddler({title: HS, text: "show"});
  const st = renderStatus();
  check("status: un-hidden — radio offered in tag-list order", st.strip, ["None", "Projects", "Contacts", "Contexts", "Realms", "Priority", "Status"]);
  wiki.addTiddler({title: VS, "hgsd-group": GBT + "status"});
  check("status: groups follow status-set order, plain headings, keyless last",
    renderStatus().groups, ["next|plain", "waiting|plain", "future|plain", "No group|plain"]);
  wiki.deleteTiddler(VS); wiki.deleteTiddler(HS);
  wiki.deleteTiddler("A fut"); wiki.deleteTiddler("A bare");
}


// 12. All references have projects: No group group and empty container vanish
wiki.deleteTiddler("R one");
refs = renderRefs();
check("no-project group absent", refs.groups, ["P one|link", "P two|link"]);
check("no empty containers", refs.emptyContainers, 0);
wiki.addTiddler({title: "R one", tags: ["$:/GSD/Reference"]});

// 12c. Context dimension: a multi-context item renders under EVERY group
wiki.addTiddler({title: "CtxA", tags: ["GSD/Contexts"]});
wiki.addTiddler({title: "CtxB", tags: ["GSD/Contexts"]});
wiki.addTiddler({title: "R multi", tags: ["$:/GSD/Reference", "CtxA", "CtxB"]});
wiki.addTiddler({title: GST, "hgsd-group": "$:/plugins/yan/hypergsd-contexts/ui/group-by/context"});
refs = renderRefs();
check("context grouping: item under both groups",
  [refs.groups, refs.rows.filter(r => r === "R multi").length],
  [["CtxA|link", "CtxB|link", "No group|plain"], 2]);
wiki.deleteTiddler("R multi"); wiki.deleteTiddler("CtxA"); wiki.deleteTiddler("CtxB");

// 12d. Realm dimension: the heading strips the $:/GSD/Realm/ tag prefix
wiki.addTiddler({title: "R one", tags: ["$:/GSD/Reference", "$:/GSD/Realm/Home"]});
wiki.addTiddler({title: GST, "hgsd-group": GBT + "realm"});
refs = renderRefs();
check("realm grouping: prefix stripped in label, links to the realm tiddler",
  refs.groups, ["Home|link", "No group|plain"]);
wiki.addTiddler({title: "R one", tags: ["$:/GSD/Reference"]});

// 12d-bis. Relevance and the group-members param (bare-widget engine cases)
{
  const stripOf = (attrs) => {
    const body = G + '\n\n<$hgsd.list ' + attrs + ' />\n\n</$importvariables>';
    const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", body), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
    const c = doc.createElement("div"); w.render(c);
    return collectStrip(c, false);
  };
  check("action list offers every dimension (contact/context declare action)",
    stripOf('list-heading="TX" list-filter="[tag[$:/GSD/Action]]" group-select="yes"'),
    ["None", "Projects", "Contacts", "Contexts", "Realms", "Priority"]);
  check("group-members overwrite wins over relevance",
    stripOf('list-heading="TY" list-filter="[tag[$:/GSD/Reference]]" group-select="yes" group-members="[[$:/plugins/yan/hypergsd-contacts/ui/group-by/contact]] [[$:/plugins/yan/hypergsd/ui/group-by/realm]]"'),
    ["None", "Contacts", "Realms"]);
  check("group-members subtracts from the full tag list",
    stripOf('list-heading="TZ" list-filter="[tag[$:/GSD/Reference]]" group-select="yes" group-members="[subfilter<hgsd-group-default>] -[[$:/plugins/yan/hypergsd/ui/group-by/project]]"'),
    ["None", "Contacts", "Contexts", "Realms", "Priority", "Status"]);
}

// 12e-bis. Relevance regressions: sort-only lists compute list-types (the
// derivation must not live under the grouping control), and BARE (uncategorised)
// sort members filter by type exactly like categorised ones
{
  wiki.addTiddler({title: "R2", tags: ["$:/GSD/Reference"]});
  const sortOptionsOf = (attrs) => {
    const body = G + "\n\n<$hgsd.list " + attrs + " />\n\n</$importvariables>";
    const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", body), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
    const c = doc.createElement("div"); w.render(c);
    const out = [];
    (function f(n) {
      if (!n || typeof n !== "object") return;
      if (Array.isArray(n)) return n.forEach(f);
      if (!n.isTiddlyWikiFakeDom) return;
      if (n.tag === "option") out.push(String((n.attributes || {}).value || ""));
      (n.children || []).forEach(f);
    })(c);
    return out;
  };
  wiki.addTiddler({title: "ZZ typed cat sort", tags: ["$:/tags/hypergsd/SortBy"], "sort-key": "zzc", "sort-filter": "+[sort[title]]", "sort-category": "ZZ Cat", "hgsd-types": "action"});
  wiki.addTiddler({title: "ZZ typed bare sort", tags: ["$:/tags/hypergsd/SortBy"], "sort-key": "zzb", "sort-filter": "+[sort[title]]", "hgsd-types": "action"});
  check("sort-only list: typed members hidden on a reference list (categorised AND bare)",
    sortOptionsOf('list-heading="TR" list-filter="[tag[$:/GSD/Reference]]" sort-select="yes"')
      .filter(v => v.indexOf("ZZ typed") === 0), []);
  wiki.addTiddler({title: "ZZ act2", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false"});
  const actionOpts = sortOptionsOf('list-heading="TA" list-filter="[tag[$:/GSD/Action]gsd_complete[false]]" sort-select="yes"');
  check("sort-only ACTION list offers both typed members",
    [actionOpts.indexOf("ZZ typed cat sort") !== -1, actionOpts.indexOf("ZZ typed bare sort") !== -1], [true, true]);
  wiki.deleteTiddler("ZZ typed cat sort"); wiki.deleteTiddler("ZZ typed bare sort"); wiki.deleteTiddler("ZZ act2"); wiki.deleteTiddler("R2");
}

// 12g-ter. Settings ordering section: both drag lists render captions, and
// editing a tag's list field reorders the strip
{
  const body = G + '\n\n<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/control-panel/dashboards"/>\n\n</$importvariables>';
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", body), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
  const c = doc.createElement("div"); w.render(c);
  const dragRows = [];
  (function f(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(f);
    if (!n.isTiddlyWikiFakeDom) return;
    if (((n.attributes || {}).class || "").indexOf("tc-menu-list-item") !== -1) dragRows.push((function txt(m) { let s = ""; (function g(x) { if (!x || typeof x !== "object") return; if (Array.isArray(x)) return x.forEach(g); if (x.isTiddlyWikiFakeDom) return (x.children || []).forEach(g); s += (x.textContent || ""); })(m); return s; })(n).replace(/\s+/g, " ").trim());
    (n.children || []).forEach(f);
  })(c);
  check("settings: GroupBy drag rows render captions",
    dragRows.filter(r => ["Projects", "Contacts", "Contexts", "Realms"].some(name => r.indexOf(name) === 0)).length >= 3, true);
  check("settings: SortBy drag rows render captions",
    dragRows.filter(r => r.indexOf("modified") !== -1 || r.indexOf("Title") !== -1 || r.indexOf("completed") !== -1).length >= 6, true);
  // order: move realm first in the GroupBy list field, strip radios follow
  const radioOrder = () => {
    const w2 = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + '\n\n<$transclude $tiddler="GSD/References"/>\n\n</$importvariables>'), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
    const c2 = doc.createElement("div"); w2.render(c2);
    const out = [];
    (function f(n) {
      if (!n || typeof n !== "object") return;
      if (Array.isArray(n)) return n.forEach(f);
      if (!n.isTiddlyWikiFakeDom) return;
      if (((n.attributes || {}).class || "").indexOf("hgsd-group-strip") !== -1) (function g(m) {
        if (!m || typeof m !== "object") return;
        if (Array.isArray(m)) return m.forEach(g);
        if (m.isTiddlyWikiFakeDom && m.tag === "label") out.push((m.children || []).map(x => x.textContent || "").join("").trim());
        (m.children || []).forEach(g);
      })(n);
      (n.children || []).forEach(f);
    })(c2);
    return out;
  };
  const GBTAG = "$:/tags/hypergsd/GroupBy";
  const origList = wiki.getTiddler(GBTAG).fields.list;
  wiki.addTiddler({title: GBTAG, list: "$:/plugins/yan/hypergsd/ui/group-by/realm $:/plugins/yan/hypergsd/ui/group-by/project $:/plugins/yan/hypergsd-contacts/ui/group-by/contact $:/plugins/yan/hypergsd-contexts/ui/group-by/context"});
  check("reordering the tag's list field reorders the strip",
    radioOrder(), ["None", "Realms", "Projects", "include ungrouped"]);
  wiki.addTiddler({title: GBTAG, list: origList});
  check("restored order", radioOrder(), ["None", "Projects", "Realms", "include ungrouped"]);
}

// 12g-bis. Explicit None beats group-default (the sentinel regression: get[]
// on an existing-but-empty field emitted nothing, resurrecting the default)
{
  const GST2 = "$:/config/hypergsd/list-view/GSD/Test/Next actions";
  wiki.deleteTiddler(GST2);
  const body = '<$hgsd.list list-heading="Next actions" list-filter="[tag[$:/GSD/Action]gsd_complete[false]]" group-select="yes" group-default="$:/plugins/yan/hypergsd/ui/group-by/project"/>';
  const render2 = () => {
    const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + body + "\n\n</$importvariables>"), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
    const c = doc.createElement("div"); w.render(c);
    let groups = 0, sel = null;
    (function f(n) {
      if (!n || typeof n !== "object") return;
      if (Array.isArray(n)) return n.forEach(f);
      if (!n.isTiddlyWikiFakeDom) return;
      const cls = (n.attributes || {}).class || "";
      if (cls.indexOf("hgsd-group-title") !== -1) groups++;
      if (cls.indexOf("tc-radio-selected") !== -1 && !sel) sel = (n.children || []).map(x => x.textContent || "").join("").trim();
      (n.children || []).forEach(f);
    })(c);
    return {groups, sel};
  };
  check("group-default: grouped by default, radio shows it", render2(), {groups: 1, sel: "Projects"});
  wiki.addTiddler({title: GST2, "hgsd-group": "none"});
  check("explicit None stays flat despite group-default", render2(), {groups: 0, sel: "None"});
  wiki.deleteTiddler(GST2);
}

// 12g. Migration defaults: group-default and title-valued sort-default
{
  const stripAndRows = (page, heading) => {
    const body = G + '\n\n<$transclude $tiddler="' + page + '"/>\n\n</$importvariables>';
    const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", body), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: page}});
    const c = doc.createElement("div"); w.render(c);
    const out = {selectedRadio: null, selectValue: null, groups: 0};
    (function f(n) {
      if (!n || typeof n !== "object") return;
      if (Array.isArray(n)) return n.forEach(f);
      if (!n.isTiddlyWikiFakeDom) return;
      const cls = (n.attributes || {}).class || "";
      if (cls.indexOf("tc-radio-selected") !== -1 && !out.selectedRadio) out.selectedRadio = (n.children || []).map(x => x.textContent || "").join("").trim();
      if (n.tag === "select" && !out.selectValue) out.selectValue = String((n.attributes || {}).value || "");
      if (cls.indexOf("hgsd-group-title") !== -1) out.groups++;
      (n.children || []).forEach(f);
    })(c);
    return out;
  };
  // action dashboard: grouped by project out of the box (group-default)
  wiki.deleteTiddler("$:/config/hypergsd/list-view/GSD/Action dashboard/Next actions");
  const ad = stripAndRows("GSD/Action dashboard");
  check("action list: grouped by project by default, radio displays it",
    [ad.groups > 0, ad.selectedRadio], [true, "Projects"]);
  // completed page: completion-date order, select displays completed-desc
  wiki.deleteTiddler("$:/config/hypergsd/list-view/GSD/Actions completed/Completed actions");
  const ca = stripAndRows("GSD/Actions completed");
  check("completed page: select displays the completion-date default",
    ca.selectValue, "$:/plugins/yan/hypergsd/ui/sort-by/completed-desc");
  // contacts: project/contact dims hidden (relevance), realm offered
  wiki.deleteTiddler("$:/config/hypergsd/list-view/GSD/Contacts/Contacts");
  const co = stripAndRows("GSD/Contacts");
  let coLabels = [];
  {
    const body = G + '\n\n<$transclude $tiddler="GSD/Contacts"/>\n\n</$importvariables>';
    const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", body), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Contacts"}});
    const c = doc.createElement("div"); w.render(c);
    (function f(n) {
      if (!n || typeof n !== "object") return;
      if (Array.isArray(n)) return n.forEach(f);
      if (!n.isTiddlyWikiFakeDom) return;
      if (((n.attributes || {}).class || "").indexOf("hgsd-group-strip") !== -1) (function g(m) {
        if (!m || typeof m !== "object") return;
        if (Array.isArray(m)) return m.forEach(g);
        if (m.isTiddlyWikiFakeDom && m.tag === "label") coLabels.push((m.children || []).map(x => x.textContent || "").join("").trim());
        (m.children || []).forEach(g);
      })(n);
      (n.children || []).forEach(f);
    })(c);
  }
  check("contacts strip: realm offered, project/contact dims hidden",
    [coLabels.indexOf("Projects") === -1, coLabels.indexOf("Contacts") === -1, coLabels.indexOf("Realms") !== -1],
    [true, true, true]);
  // ticklers: grouping strip, no sort select (tickler harness covers the page)
  wiki.deleteTiddler("$:/config/hypergsd/list-view/GSD/Ticklers/Upcoming ticklers");
}

// 12f. Sort behaviour: engine default, per-list state, within-group scope,
// and a multi-field custom member (the sort-filter contract: any operators)
{
  wiki.addTiddler({title: "ZZ sa", tags: ["$:/GSD/Reference"], gsd_project: "P one", modified: "20260901120000000"});
  wiki.addTiddler({title: "ZZ sc", tags: ["$:/GSD/Reference"], gsd_project: "P one", modified: "20260903120000000"});
  wiki.addTiddler({title: "ZZ sb", tags: ["$:/GSD/Reference"], gsd_project: "P two", modified: "20260902120000000"});
  const ATS = "$:/config/hypergsd/list-view/GSD/Test/TS";
  const rowsOf = (attrs, state) => {
    wiki.deleteTiddler(ATS);
    if (state) wiki.addTiddler(state);
    const body = G + "\n\n<$hgsd.list " + attrs + " />\n\n</$importvariables>";
    const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", body), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
    const c = doc.createElement("div"); w.render(c);
    const rows = [];
    (function f(n) {
      if (!n || typeof n !== "object") return;
      if (Array.isArray(n)) return n.forEach(f);
      if (!n.isTiddlyWikiFakeDom) return;
      if (((n.attributes || {}).class || "").indexOf("gsd-list-item-title") !== -1) rows.push((n.children || []).map(x => x.textContent || "").join("").trim());
      (n.children || []).forEach(f);
    })(c);
    return rows.filter(r => r.indexOf("ZZ s") === 0);
  };
  const AT = 'list-heading="TS" list-filter="[tag[$:/GSD/Reference]] -[is[draft]]" sort-select="yes"';
  check("default sort: newest modified first",
    rowsOf(AT), ["ZZ sc", "ZZ sb", "ZZ sa"]);
  check("title-asc state sorts A-Z",
    rowsOf(AT, {title: ATS, "hgsd-sort": "$:/plugins/yan/hypergsd/ui/sort-by/title-asc"}), ["ZZ sa", "ZZ sb", "ZZ sc"]);
  check("sort applies within groups (title-asc under project headings)",
    rowsOf(AT + ' group-select="yes"', {title: ATS, "hgsd-group": "$:/plugins/yan/hypergsd/ui/group-by/project", "hgsd-sort": "$:/plugins/yan/hypergsd/ui/sort-by/title-asc"}),
    ["ZZ sa", "ZZ sc", "ZZ sb"]);
  wiki.addTiddler({title: "ZZ sort member", tags: ["$:/tags/hypergsd/SortBy"], "sort-key": "zz-multi", "sort-filter": "+[nsort[gsd_status]] +[sort[title]]"});
  wiki.addTiddler({title: "ZZ sd", tags: ["$:/GSD/Reference"], gsd_status: "waiting", modified: "20260904120000000"});
  check("multi-field custom member: status then title",
    rowsOf(AT, {title: ATS, "hgsd-sort": "ZZ sort member"}), ["ZZ sa", "ZZ sb", "ZZ sc", "ZZ sd"]);
  wiki.deleteTiddler("ZZ sort member");
  ["ZZ sa", "ZZ sb", "ZZ sc", "ZZ sd"].forEach(t => wiki.deleteTiddler(t));
  wiki.deleteTiddler(ATS);
}

// 12e. LIVE refresh: a strip state write regroups without a fresh render — pins the
// scoped gate runs (chassis + outer derivation + inner freeze all carry list-group)
wiki.deleteTiddler(GST);
{
  const body = G + '\n\n<$transclude $tiddler="GSD/References"/>\n\n</$importvariables>';
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", body), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
  const c = doc.createElement("div"); w.render(c);
  const groupsNow = () => { const out = [];
    (function f(n) {
      if (!n || typeof n !== "object") return;
      if (Array.isArray(n)) return n.forEach(f);
      if (!n.isTiddlyWikiFakeDom) return;
      if (((n.attributes || {}).class || "").indexOf("hgsd-group-title") !== -1) out.push((n.children || []).map(x => x.textContent || "").join("").trim());
      (n.children || []).forEach(f);
    })(c.children); return out; };
  const before = groupsNow();
  wiki.addTiddler({title: GST, "hgsd-group": GBT + "project"});
  w.refresh({[GST]: {title: GST}});
  const after = groupsNow();
  wiki.deleteTiddler(GST);
  w.refresh({[GST]: {title: GST, deleted: true}});
  check("live tick regroups in place", [before, after, groupsNow()],
    [[], ["P one", "P two", "No group"], []]);
}

// 12b. Waiting-by-contact lists ONLY actions that carry a contact: the
// contactless "A wait" must not render (and no trailing No group container),
// the delegated one renders under its contact's heading. Drop test 6's
// override first so the page is back to its seeded default (by-contact only).
wiki.deleteTiddler(vis("hypergsd/Lists/Waiting", "$:/plugins/yan/hypergsd/ui/lists/waiting-action-list"));
wiki.addTiddler({title: "A delegated", tags: ["$:/GSD/Action"], gsd_status: "waiting", gsd_complete: "false", gsd_contact: "C one"});
{
  const body = G + '\n\n<$transclude $tiddler="GSD/Actions waiting"/>\n\n</$importvariables>';
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", body), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
  const c = doc.createElement("div"); w.render(c);
  const groups = [], rows = [];
  (function f(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(f);
    if (!n.isTiddlyWikiFakeDom) return;
    const cls = (n.attributes || {}).class || "";
    if (cls.indexOf("hgsd-group-title") !== -1)
      groups.push((n.children || []).map(x => x.textContent || "").join("").trim());
    if (cls.indexOf("gsd-list-item-title") !== -1)
      rows.push((n.children || []).map(x => x.textContent || "").join("").trim());
    (n.children || []).forEach(f);
  })(c);
  check("by-contact: contactless waiting action excluded", rows.indexOf("A wait"), -1);
  check("by-contact: delegated action present under its contact", [rows.indexOf("A delegated") !== -1, groups.indexOf("C one") !== -1], [true, true]);
  check("by-contact: no trailing No group container", groups.indexOf("No group"), -1);
}
wiki.deleteTiddler("A delegated");

// Settings → Sidebar: per-block capture drag lists (block tag tiddlers'
// captions as labels; plain rows — no Portion select on portion-less entries).
{
  const body = G + '\n\n<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/control-panel/sidebar" $mode="block"/>\n\n</$importvariables>';
  const parser = wiki.parseText("text/vnd.tiddlywiki", body);
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c);
  let capItems = null;
  (function f(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(f);
    if (n.isTiddlyWikiFakeDom) {
      if (((n.attributes || {}).class || "").indexOf("tc-tagged-draggable-list") !== -1
          && (n.textContent || "").indexOf("new action") !== -1) {
        capItems = (n.children || []).filter(ch => ch.isTiddlyWikiFakeDom && ch.tag).map(ch =>
          (n2 => { let s = ""; (function g(x) { if (!x || typeof x !== "object") return; if (Array.isArray(x)) return x.forEach(g); if (x.isTiddlyWikiFakeDom) return (x.children || []).forEach(g); s += (x.textContent || ""); })(n2); return s.replace(/\s+/g, " ").trim(); })(ch)).filter(s => s);
      }
      (n.children || []).forEach(f);
    }
  })(c);
  // the block's own rows: caption -- description, drag order = the block's list field
  check("settings: block 2 drag list = the common buttons (caption -- description) in list-field order", capItems, [
    "new action – Add a new action",
    "new project – Add a new project",
    "new reference – Add new reference"
  ]);
  const tabText = String(c.textContent || "");
  check("settings: all four capture block captions render",
    ["Capture defaults", "New action, project and reference", "New contact and context", "Realm note"]
      .every(s2 => tabText.indexOf(s2) !== -1), true);
  check("settings: review block captions still render", tabText.indexOf("Realm selection") !== -1, true);
  check("settings: defaults and note rows carry captions and hints",
    ["Default realm – The realm inherited by new items created in the capture sidebar",
     "Default context – The context inherited by new items created in the capture sidebar",
     "Realm note – The small-print hint about creating new realms"]
      .every(s2 => tabText.indexOf(s2.replace(/\s+/g, " ")) !== -1), true);

}

// Refresh-path cases for the OUTER DERIVATION GATE (2026-09-01): the $let tree above
// hgsd-render-inner's freeze recomputed its filters on every descent; the outer $refresh
// now admits only what the derivation reads. Assert: relevant change still updates rows,
// deletion removes rows, unrelated edit does not corrupt the render.
{
  const body = G + '\n\n<$transclude $tiddler="GSD/Dashboard"/>\n\n</$importvariables>';
  const mk = () => wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", body), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
  const textOf = (c) => { let s = ""; (function f(x) { if (Array.isArray(x)) return x.forEach(f);
    if (x && typeof x === "object" && x.isTiddlyWikiFakeDom) return (x.children || []).forEach(f); s += (x && x.textContent) || ""; })(c.children); return s; };
  // setup: one visible action + one project
  wiki.addTiddler({title: "P gate", tags: ["$:/GSD/Project"], gsd_status: "active"});
  wiki.addTiddler({title: "A gateone", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_project: "P gate"});
  const w = mk(), c = doc.createElement("div"); w.render(c);
  check("gate: action row present on first render", textOf(c).includes("A gateone"), true);
  // relevant change: completing the action removes it from Next actions (completed
  // rows live in the lazy show-completed reveal, absent until expanded)
  wiki.addTiddler({title: "A gateone", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "true", gsd_comp_date: "20260901120000000", gsd_project: "P gate"});
  w.refresh({["A gateone"]: wiki.getTiddler("A gateone")});
  check("gate: relevant change updates rows", textOf(c).includes("A gateone"), false);
  // deletion: row disappears (outer [!is[tiddler]] run admits the derivation)
  wiki.addTiddler({title: "A gatetwo", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_project: "P gate"});
  w.refresh({["A gatetwo"]: wiki.getTiddler("A gatetwo")});
  check("gate: new action appears", textOf(c).includes("A gatetwo"), true);
  wiki.deleteTiddler("A gatetwo");
  w.refresh({["A gatetwo"]: null});
  check("gate: deletion removes row", textOf(c).includes("A gatetwo"), false);
  // unrelated edit: render stays intact (gate blocks descent; DOM unchanged)
  wiki.addTiddler({title: "Scratch unrelated", text: "x"});
  w.refresh({["Scratch unrelated"]: wiki.getTiddler("Scratch unrelated")});
  check("gate: unrelated edit leaves render intact", textOf(c).includes("Next actions"), true);
  wiki.deleteTiddler("Scratch unrelated"); wiki.deleteTiddler("P gate");
}

// Contact view (2026-09-01): hardcoded lists became $hgsd.list blocks tagged with the
// revived $:/tags/hypergsd/Lists/ContactAction hook — tag-driven order, visibility gates,
// completed list lazy behind show-completed, realm scoping inherited from the engine.
{
  const viewBody = G + '\n\n<$transclude $tiddler="$:/plugins/yan/hypergsd-contacts/ui/ViewTemplate/view-body-contact" $mode="block"/>\n\n</$importvariables>';
  const mkContact = () => wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", viewBody), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "C gate"}});
  const titles = (c) => { const out = [];
    (function f(n) { if (!n || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(f);
      if (n.isTiddlyWikiFakeDom) { if (((n.attributes || {}).class || "").indexOf("gsd-list-heading") !== -1)
        out.push((function txt(m) { let s = ""; (function g(x) { if (Array.isArray(x)) return x.forEach(g);
          if (x && typeof x === "object" && x.isTiddlyWikiFakeDom) return (x.children || []).forEach(g); s += (x && x.textContent) || ""; })(m); return s.replace(/\s+/g, " ").trim(); })(n));
        (n.children || []).forEach(f); } })(c);
    return out.filter(t => t && !t.includes("completed")); };
  const rowsOf = (c, needle) => { let found = 0;
    (function f(n) { if (!n || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(f);
      if (n.isTiddlyWikiFakeDom) { if (((n.attributes || {}).class || "").trim() === "gsd-list-item") {
        let s = ""; (function g(x) { if (Array.isArray(x)) return x.forEach(g);
          if (x && typeof x === "object" && x.isTiddlyWikiFakeDom) return (x.children || []).forEach(g); s += (x && x.textContent) || ""; })(n);
        if (s.indexOf(needle) !== -1) found++; }
        (n.children || []).forEach(f); } })(c); return found; };
  // seeds: one contact, one action in each status + one completed
  wiki.addTiddler({title: "C gate", tags: ["$:/GSD/Contact"]});
  wiki.addTiddler({title: "A cnext", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_contact: "C gate"});
  wiki.addTiddler({title: "A cwait", tags: ["$:/GSD/Action"], gsd_status: "waiting", gsd_complete: "false", gsd_contact: "C gate"});
  wiki.addTiddler({title: "A cdone", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "true", gsd_comp_date: "20260901120000000", gsd_contact: "C gate"});
  const w = mkContact(), c = doc.createElement("div"); w.render(c);
  const lists = titles(c);
  check("contact view: three lists in tag order", lists, ["Next actions", "Waiting actions", "Future actions"]);
  check("contact view: action in its list (engine filter)", [rowsOf(c, "A cnext") === 1, rowsOf(c, "A cwait") === 1], [true, true]);
  check("contact view: completed row lazy (absent until reveal)", rowsOf(c, "A cdone"), 0);
  // visibility gate drops a block
  const vis = "$:/config/hypergsd/Lists/ContactAction/visibility/$:/plugins/yan/hypergsd-contacts/ui/lists/contact-future-action-list";
  wiki.addTiddler({title: vis, text: "hide"});
  const w2 = mkContact(), c2 = doc.createElement("div"); w2.render(c2);
  check("contact view: visibility hides the future list", titles(c2), ["Next actions", "Waiting actions"]);
  wiki.deleteTiddler(vis);
  // show-completed reveal renders the completed block
  wiki.addTiddler({title: "$:/state/hypergsd/show-completed/C gate", text: "show"});
  const w3 = mkContact(), c3 = doc.createElement("div"); w3.render(c3);
  check("contact view: show-completed reveals the completed row", rowsOf(c3, "A cdone"), 1);
  wiki.deleteTiddler("$:/state/hypergsd/show-completed/C gate");
  for (const t of ["C gate", "A cnext", "A cwait", "A cdone"]) wiki.deleteTiddler(t);
}
// ── Context view: tag-driven ContextAction blocks ─────────────────────────────
wiki.addTiddler({title: "Ctx one", tags: "GSD/Contexts", text: "ctx body"});
wiki.addTiddler({title: "CA next", tags: ["$:/GSD/Action", "Ctx one"], gsd_status: "next", gsd_complete: "false"});
wiki.addTiddler({title: "CA waiting", tags: ["$:/GSD/Action", "Ctx one"], gsd_status: "waiting", gsd_complete: "false"});
const ctxSrc = '<$tiddler tiddler="Ctx one"><$transclude $tiddler="$:/plugins/yan/hypergsd-contexts/ui/ViewTemplate/view-body-context" $mode="block"/></$tiddler>';
const ctxRender = () => {
  const parser = wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + ctxSrc + "\n\n</$importvariables>");
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c);
  let text = ""; (function f(n){ if(!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
    if(n.isTiddlyWikiFakeDom) return (n.children||[]).forEach(f); text += (n.textContent||""); })(c);
  return text;
};
const ctxText = ctxRender();
check("context view: next and waiting rows render", ["CA next", "CA waiting"].every(x => ctxText.indexOf(x) !== -1), true);
check("context view: pinned order next before waiting", ctxText.indexOf("CA next") < ctxText.indexOf("CA waiting"), true);
check("context view: future block titled", ctxText.indexOf("Future") !== -1, true);
wiki.addTiddler({title: "$:/config/hypergsd/Lists/ContextAction/visibility/$:/plugins/yan/hypergsd-contexts/ui/lists/context-waiting-action-list", text: "hide"});
check("context view: visibility hides the waiting block", ctxRender().indexOf("CA waiting") === -1, true);
wiki.deleteTiddler("$:/config/hypergsd/Lists/ContextAction/visibility/$:/plugins/yan/hypergsd-contexts/ui/lists/context-waiting-action-list");
check("context tag list pins three blocks", wiki.filterTiddlers("[[$:/tags/hypergsd/Lists/ContextAction]] :and[tagging[]]").length, 3);
wiki.deleteTiddler("CA next"); wiki.deleteTiddler("CA waiting"); wiki.deleteTiddler("Ctx one");

// portion routing (modules/section-portions): Portion/2 members land in the
// second column div; Portion/Full members render only in the Full region
// (GSD/Dashboard skips it — its Full slot is the completed reveal); Portion/Top
// members render only in a band BEFORE the columns; the picker's retag effect
// is simulated by the tag changes themselves
{
  wiki.addTiddler({title: "ZZ portion two", tags: ["$:/tags/hypergsd/Lists/Dashboard", "$:/tags/hypergsd/Lists/Dashboard/Portion/2"], text: "EXT-P2"});
  wiki.addTiddler({title: "ZZ portion full", tags: ["$:/tags/hypergsd/Lists/Dashboard", "$:/tags/hypergsd/Lists/Dashboard/Portion/Full"], text: "EXT-PF"});
  wiki.addTiddler({title: "ZZ portion top", tags: ["$:/tags/hypergsd/Lists/Dashboard", "$:/tags/hypergsd/Lists/Dashboard/Portion/Top"], text: "EXT-PT"});
  const containerOf = page => {
    const body = G + '\n\n<$transclude $tiddler="' + page + '"/>\n\n</$importvariables>';
    const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", body), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
    const cc = doc.createElement("div"); w.render(cc); render.strays = (render.strays || 0) + 0;
    return cc;
  };
  const divText = d => { let s = ""; (function g(x){ if(!x||typeof x!=="object")return; if(Array.isArray(x))return x.forEach(g); if(x.isTiddlyWikiFakeDom)return (x.children||[]).forEach(g); s += (x.textContent||""); })(d); return s; };
  const colsOf = cc => { const out = [];
    (function f(n){ if(!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
      if(n.isTiddlyWikiFakeDom && ((n.attributes||{}).class||"").includes("hgsd-portion-columns")) (n.children||[]).forEach(ch => { if (ch.isTiddlyWikiFakeDom && ch.tag === "div") out.push(ch); }); (n.children||[]).forEach(f); })(cc);
    return out; };
  const regionOrder = cc => { const out = [];
    (function f(n){ if(!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
      if(n.isTiddlyWikiFakeDom){ const cls = ((n.attributes||{}).class||"").split(" ");
        for (const k of ["hgsd-portion-top", "hgsd-portion-columns", "hgsd-portion-full"]) if (cls.includes(k) && !out.includes(k)) out.push(k);
        (n.children||[]).forEach(f); } })(cc);
    return out; };
  const dashCols = colsOf(containerOf("GSD/Dashboard"));
  check("portions: second column renders the Portion/2 member only",
    [dashCols.length >= 2, divText(dashCols[1]).includes("EXT-P2"), !divText(dashCols[0]).includes("EXT-P2")], [true, true, true]);
  check("portions: Full member skipped on GSD/Dashboard (reveal owns it)",
    dashCols.some(d => divText(d).includes("EXT-PF")), false);
  check("portions: Top member skipped by the columns on GSD/Dashboard",
    dashCols.some(d => divText(d).includes("EXT-PT")), false);
  check("portions: region order is Top band, columns, Full band",
    regionOrder(containerOf("GSD/Dashboard")), ["hgsd-portion-top", "hgsd-portion-columns", "hgsd-portion-full"]);
  let topRegion = null;
  (function f(n){ if(topRegion||!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
    if(n.isTiddlyWikiFakeDom){ if((((n.attributes||{}).class||"")).split(" ").includes("hgsd-portion-top")) topRegion = n; else (n.children||[]).forEach(f); } })(containerOf("GSD/Dashboard"));
  check("portions: Top band renders its member above the columns",
    [!!topRegion, topRegion ? divText(topRegion).includes("EXT-PT") : false, topRegion ? !divText(topRegion).includes("EXT-P2") : false], [true, true, true]);
  wiki.deleteTiddler("ZZ portion top");
  check("portions: Top band absent when no member claims it",
    regionOrder(containerOf("GSD/Action dashboard")), ["hgsd-portion-columns", "hgsd-portion-full"]);
  check("portions: Full band absent when no member claims it (References tag list)",
    regionOrder(containerOf("GSD/References")), ["hgsd-portion-columns"]);
  wiki.addTiddler({title: "ZZ portion full", tags: ["$:/tags/hypergsd/Lists/Action", "$:/tags/hypergsd/Lists/Action/Portion/Full"], text: "EXT-PF"});
  let fullRegion = null, columnsSeen = false;
  (function f(n){ if(!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
    if(n.isTiddlyWikiFakeDom){ const cls = (n.attributes||{}).class||""; if(cls.includes("hgsd-portion-columns")) columnsSeen = true; if(cls.includes("hgsd-portion-full")) fullRegion = n; (n.children||[]).forEach(f); } })(containerOf("GSD/Action dashboard"));
  check("portions: Full region renders after the columns on other pages",
    [!!fullRegion, fullRegion ? divText(fullRegion).includes("EXT-PF") : false, columnsSeen], [true, true, true]);
  wiki.deleteTiddler("ZZ portion two"); wiki.deleteTiddler("ZZ portion full");
}

// Portion/Top on the PANEL chassis (hgsd-section-portions): the band must
// precede the .hgsd-capture row there too, and a Top claim must not affect
// the picker's next-free derivation (bands are excluded from the count)
{
  wiki.addTiddler({title: "ZZ panel top", tags: ["$:/tags/hypergsd/PanelTemplate", "$:/tags/hypergsd/PanelTemplate/Portion/Top"], text: "PANEL-TOP-MARK"});
  wiki.addTiddler({title: "ZZ panel full", tags: ["$:/tags/hypergsd/PanelTemplate", "$:/tags/hypergsd/PanelTemplate/Portion/Full"], text: "PANEL-FULL-MARK"});
  const body = G + '\n\n<$tiddler tiddler="A next"><$transclude $variable="hgsd-section-portions" tag-list="$:/tags/hypergsd/PanelTemplate" visibility-base="$:/config/hypergsdPanel/visibility/"/></$tiddler>\n\n</$importvariables>';
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", body), {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c);
  const order = [];
  (function f(n){ if(!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
    if(n.isTiddlyWikiFakeDom){ const cls = ((n.attributes||{}).class||"").split(" ");
      for (const k of ["hgsd-portion-top", "hgsd-capture", "hgsd-portion-full"]) if (cls.includes(k) && !order.includes(k)) order.push(k);
      (n.children||[]).forEach(f); } })(c);
  check("panel portions: Top band precedes the capture row (Full trails it)",
    order, ["hgsd-portion-top", "hgsd-capture", "hgsd-portion-full"]);
  wiki.deleteTiddler("ZZ panel top"); wiki.deleteTiddler("ZZ panel full");
}

// Draft gate: a draft inherits the base's tags and fields, so it matches the
// list predicates mid-edit — the $hgsd.list all-titles funnel must exclude it
// (waiting-action-list shipped with no exclusion of its own until 2026-09-06)
{
  wiki.addTiddler({title: "Draft of A wait", tags: ["$:/GSD/Action"], gsd_status: "waiting", gsd_complete: "false", gsd_project: "P one", "draft.of": "A wait", "draft.title": "A wait"});
  const body = G + '\n\n<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/lists/waiting-action-list"/>\n\n</$importvariables>';
  const parser = wiki.parseText("text/vnd.tiddlywiki", body);
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
  const c = doc.createElement("div"); w.render(c);
  const s = (function txt(m) { let out = ""; (function g(x) { if (!x || typeof x !== "object") return; if (Array.isArray(x)) return x.forEach(g); if (x.isTiddlyWikiFakeDom) return (x.children || []).forEach(g); out += (x.textContent || ""); })(m); return out; })(c);
  check("draft gate: waiting list keeps the draft out, keeps the base",
    [s.indexOf("Draft of A wait") === -1, s.indexOf("A wait") !== -1], [true, true]);
  wiki.deleteTiddler("Draft of A wait");
}

// Portion picker (portion-item-template): firing the select's change event must
// SWAP the member's portion tag while keeping every other tag — a `+`-prefixed
// list[] run in the $tags filter once replaced the whole tag list with the pick
// alone, untagging the member from its tag list (row vanished from Settings and
// panel alike). Also covers the picker's initial display (default=, not value=,
// which SelectWidget ignores) and dual-tag-list members.
{
  const page = G + '\n\n<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/control-panel/sections" $mode="block"/>\n\n</$importvariables>';
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", page), {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c);
  const pickers = {};
  (function f(n) {
    if (!n || typeof n !== "object" || Array.isArray(n)) return;
    if (n.domNodes && n.domNodes.length && n.domNodes[0] && n.domNodes[0].tag === "select") {
      const cur = n.getVariable("currentTiddler");
      if (cur && !pickers[cur]) pickers[cur] = n;
    }
    if (n.children) n.children.forEach(f);
  })(w);
  const COMPLETE = "$:/plugins/yan/hypergsd/ui/panel/complete";
  const PROJECT = "$:/plugins/yan/hypergsd/ui/attributes/project";
  const PANEL = "$:/tags/hypergsd/PanelTemplate", MODAL = "$:/tags/hypergsd/ModalTemplate";
  const P = n => PANEL + "/Portion/" + n;
  const pick = (sw, value) => { sw.domNodes[0].value = value; sw.handleChangeEvent({}); };
  const tags = t => (wiki.getTiddler(t).fields.tags || []).slice().sort();

  check("picker: initial display shows the member's current portion (default=, else Portion/1)",
    pickers[COMPLETE].domNodes[0].value, P(1));
  check("picker: options are the two bands + portions in use + next-free",
    (pickers[COMPLETE].domNodes[0].children || []).filter(ch => ch.tag === "option").map(ch => ch.attributes.value),
    [PANEL + "/Portion/Top", P(0), P(1), P(2), P(3), PANEL + "/Portion/Full"]);

  pick(pickers[COMPLETE], P(2));
  check("picker: pick 2 keeps the tag and swaps the portion", tags(COMPLETE), [PANEL, P(2)].sort());
  check("picker: member still in the tag list after a pick",
    wiki.filterTiddlers("[[" + COMPLETE + "]tag[" + PANEL + "]]").length, 1);
  pick(pickers[COMPLETE], PANEL + "/Portion/Full");
  check("picker: pick Full swaps to the Full tag", tags(COMPLETE), [PANEL, PANEL + "/Portion/Full"].sort());
  pick(pickers[COMPLETE], P(1));
  check("picker: re-pick a number returns from Full", tags(COMPLETE), [PANEL, P(1)].sort());
  const modifiedBefore = wiki.getTiddler(COMPLETE).fields.modified;
  pick(pickers[COMPLETE], P(1));
  check("picker: same-value pick writes nothing (no modified bump)",
    String(wiki.getTiddler(COMPLETE).fields.modified), String(modifiedBefore));

  pick(pickers[COMPLETE], PANEL + "/Portion/Top");
  check("picker: pick Top retags to the band (tag list kept)",
    tags(COMPLETE), [PANEL, PANEL + "/Portion/Top"].sort());
  // a Top claim must not open a fresh numbered column: fresh page render, options unchanged
  {
    const w2 = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", page), {document: doc, parentWidget: $tw.rootWidget});
    const c2 = doc.createElement("div"); w2.render(c2);
    let sw = null;
    (function f(n){ if(sw||!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
      if(n.domNodes&&n.domNodes[0]&&n.domNodes[0].tag==="select"&&n.getVariable("currentTiddler")===COMPLETE) sw=n; else if(n.children)n.children.forEach(f); })(w2);
    check("picker: Top claim does not bump next-free (no fresh column)",
      (sw.domNodes[0].children||[]).filter(ch=>ch.tag==="option").map(ch=>ch.attributes.value),
      [PANEL+"/Portion/Top", P(0), P(1), P(2), P(3), PANEL+"/Portion/Full"]);
  }
  pick(pickers[COMPLETE], P(1));

  // dual-tag-list member (project section sits in BOTH PanelTemplate and
  // ModalTemplate with each side's Portion/1): a panel-side pick must retag
  // only the panel portion, leaving the modal tags untouched
  check("picker: dual member starts tagged in both tag lists' Portion/1",
    tags(PROJECT), [MODAL, MODAL + "/Portion/1", PANEL, P(1)].sort());
  pick(pickers[PROJECT], P(2));
  check("picker: panel-side pick retags only the panel portion",
    tags(PROJECT), [MODAL, MODAL + "/Portion/1", PANEL, P(2)].sort());

  wiki.deleteTiddler(COMPLETE); wiki.deleteTiddler(PROJECT);
  wiki.deleteTiddler("$:/state/hypergsd/portion/" + COMPLETE);
  wiki.deleteTiddler("$:/state/hypergsd/portion/" + PROJECT);
  check("picker: test overrides and states cleaned (shadows intact)",
    [wiki.getTiddler(COMPLETE).fields.tags.length, wiki.getTiddler(PROJECT).fields.tags.length], [2, 4]);
}

// Portion picker next-free derivation (visibility-list): MAX-based with an
// implicit-1 seed — a fresh number must always be offered. The count-based
// form ignored the implicit Portion/1 of untagged members, so an all-untagged
// tag list (the shipped main Dashboard among them) offered no number past 1,
// and a gapped tag's next-free duplicated an in-use number and vanished.
{
  const REG = "$:/tags/ZZ/ScratchRegistry", V = n => REG + "/Portion/" + n;
  const rows = i => "ZZ row " + i;
  const reset = memberTags => {
    for (let i = 0; i < 9; i++) { wiki.deleteTiddler(rows(i)); wiki.deleteTiddler("$:/state/hypergsd/portion/" + rows(i)); }
    wiki.deleteTiddler(REG);
    wiki.addTiddler({title: REG, tags: [], list: ""});
    memberTags.forEach((tags, i) => wiki.addTiddler({title: rows(i), tags: [REG].concat(tags)}));
  };
  const renderScratch = () => {
    const src = G + '\n\n<$transclude $variable="hgsd-visibility-list" tag-list="' + REG + '" visibility-base="$:/config/ZZ/scratch/"/>\n\n</$importvariables>';
    const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", src), {document: doc, parentWidget: $tw.rootWidget});
    const c = doc.createElement("div"); w.render(c);
    return w;
  };
  const pickerOf = (w, row) => { let sw = null;
    (function f(n){ if(sw||!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
      if(n.domNodes&&n.domNodes[0]&&n.domNodes[0].tag==="select"&&n.getVariable("currentTiddler")===row) sw=n; else if(n.children)n.children.forEach(f); })(w);
    return sw; };
  const optionsOf = (w, row) => { const sw = pickerOf(w, row);
    return sw ? (sw.domNodes[0].children||[]).filter(ch=>ch.tag==="option").map(ch=>ch.attributes.value) : null; };
  const pick = (sw, value) => { sw.domNodes[0].value = value; sw.handleChangeEvent({}); };

  reset([[], [], []]);
  check("next-free: all-untagged tag list offers a fresh number (the main-Dashboard scenario)",
    optionsOf(renderScratch(), rows(0)), [V("Top"), V(1), V(2), V("Full")]);

  pick(pickerOf(renderScratch(), rows(0)), V(2));
  check("next-free: picking the fresh number mints the portion (tag kept)",
    (wiki.getTiddler(rows(0)).fields.tags || []).slice().sort(), [REG, V(2)].sort());
  check("next-free: minted portion is then offered as in-use, next-free steps up",
    optionsOf(renderScratch(), rows(1)), [V("Top"), V(1), V(2), V(3), V("Full")]);

  reset([[V(1)], [V(3)]]);
  check("next-free: gapped tag list {1,3} offers 4, never a duplicate",
    optionsOf(renderScratch(), rows(0)), [V("Top"), V(1), V(3), V(4), V("Full")]);

  reset([[V("Full")], []]);
  check("next-free: a Full claim never suppresses the fresh number",
    optionsOf(renderScratch(), rows(1)), [V("Top"), V(1), V(2), V("Full")]);

  reset([]);
}

// Per-list group/sort defaults (list-item-template + the widget's default chain):
// the Settings pickers write $:/config/hypergsd/list-default/<heading> directly
// (heading field -> lingo text == the widget's list-heading); the widget reads
// view state first, then that config, then its hardcoded parameters. Rows
// without a heading field show no pickers.
{
  const NEXT = "$:/plugins/yan/hypergsd/ui/lists/next-action-list";
  const GROUP_BY_REALM = "$:/plugins/yan/hypergsd/ui/group-by/realm";
  const SORT_BY_TITLE = "$:/plugins/yan/hypergsd/ui/sort-by/title-asc";
  const DEFAULT_T = "$:/config/hypergsd/list-default/Next actions";
  const VIEW_T = "$:/config/hypergsd/list-view/GSD/Dashboard/Next actions";
  const pageSrc = () => wiki.parseText("text/vnd.tiddlywiki",
    G + '\n\n<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/control-panel/dashboards/main-dashboard-list" $mode="block"/>\n\n</$importvariables>');
  const renderPage = () => { const w = wiki.makeWidget(pageSrc(), {document: doc, parentWidget: $tw.rootWidget});
    const c = doc.createElement("div"); w.render(c); return w; };
  const rowSelects = w => { const rows = {};
    (function f(n) { if (!n || typeof n !== "object" || Array.isArray(n)) return;
      if (n.domNodes && n.domNodes[0] && n.domNodes[0].tag === "select") {
        const cur = n.getVariable("currentTiddler");
        if (cur) { rows[cur] = rows[cur] || []; rows[cur].push(n); } }
      (n.children || []).forEach(f); })(w);
    return rows; };
  const optionsOf = sw => (sw.domNodes[0].children || []).filter(ch => ch.tag === "option").map(ch => ch.attributes.value);
  const pick = (sw, value) => { sw.domNodes[0].value = value; sw.handleChangeEvent({}); };
  const dashboardStrip = () => { const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki",
      G + '\n\n<$transclude $tiddler="GSD/Dashboard" $mode="block"/>\n\n</$importvariables>'), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
    const c = doc.createElement("div"); w.render(c); return {w, c}; };
  const stripStates = c => { let out = [];
    (function f(n) { if (!n || typeof n !== "object" || Array.isArray(n)) return;
      if (n.isTiddlyWikiFakeDom && n.tag === "label" && ((n.attributes || {}).class || "").indexOf("tc-radio") !== -1) {
        const sel = ((n.attributes || {}).class || "").indexOf("tc-radio-selected") !== -1;
        out.push((sel ? "[x]" : "[ ]") + (n.children || []).map(x => x.textContent || "").join("").replace(/\u00A0/g, " ").trim()); }
      (n.children || []).forEach(f); })(c); return out; };
  const stripSortValue = w => { let hit = null;
    (function f(n) { if (hit || !n || typeof n !== "object" || Array.isArray(n)) return;
      if (n.domNodes && n.domNodes[0] && n.domNodes[0].tag === "select") { hit = n.domNodes[0].value; return; }
      (n.children || []).forEach(f); })(w); return hit; };

  let rows = rowSelects(renderPage());
  check("list-defaults: every Dashboard row carries three selects (portion, sort, group)",
    rows[NEXT].length, 3);
  check("list-defaults: sort options are List default + the full SortBy tag list (no relevance filter in Settings)",
    [optionsOf(rows[NEXT][1])[0], optionsOf(rows[NEXT][1]).length],
    ["", 1 + wiki.filterTiddlers("[[$:/tags/hypergsd/SortBy]] :and[tagging[]]").length]);
  check("list-defaults: group options are List default + None + the GroupBy tag list",
    optionsOf(rows[NEXT][2]).slice(0, 2), ["", "none"]);

  pick(rows[NEXT][2], GROUP_BY_REALM);
  check("list-defaults: a pick writes the heading-keyed config tiddler",
    wiki.getTiddler(DEFAULT_T) && wiki.getTiddler(DEFAULT_T).fields["hgsd-group"], GROUP_BY_REALM);
  let strip = stripStates(dashboardStrip().c);
  check("list-defaults: the strip pre-checks the config default",
    strip.some(s => s.indexOf("[x]Realms") !== -1), true);

  wiki.addTiddler({title: VIEW_T, "hgsd-group": "none"});
  strip = stripStates(dashboardStrip().c);
  check("list-defaults: view state still wins over the config default",
    strip.some(s => s.indexOf("[x]None") !== -1), true);
  wiki.deleteTiddler(VIEW_T);

  let page = renderPage();
  pick(rowSelects(page)[NEXT][2], "");
  check("list-defaults: List default clears the field (empty, so the chain falls through)",
    String((wiki.getTiddler(DEFAULT_T) || {fields: {}}).fields["hgsd-group"] || ""), "");
  strip = stripStates(dashboardStrip().c);
  check("list-defaults: clearing falls back to the built-in parameter default",
    strip.some(s => s.indexOf("[x]Projects") !== -1), true);

  pick(rowSelects(renderPage())[NEXT][1], SORT_BY_TITLE);
  check("list-defaults: a sort pick lands and pre-selects in the strip",
    [wiki.getTiddler(DEFAULT_T).fields["hgsd-sort"], stripSortValue(dashboardStrip().w)], [SORT_BY_TITLE, SORT_BY_TITLE]);

  wiki.deleteTiddler(DEFAULT_T);
}

// Option withdrawal (Settings -> Dashboards untick): members with a hide
// config under $:/config/hypergsd/<Tag list>/hidden/ vanish from every
// offered set; view states and defaults naming them fall back; explicit
// group-members lists are exempt; the Settings page keeps listing them.
{
  const REALM = "$:/plugins/yan/hypergsd/ui/group-by/realm";
  const PROJECT = "$:/plugins/yan/hypergsd/ui/group-by/project";
  const TITLE_ASC = "$:/plugins/yan/hypergsd/ui/sort-by/title-asc";
  const MOD_DESC = "$:/plugins/yan/hypergsd/ui/sort-by/modified-desc";
  const HIDDEN_REALM = "$:/config/hypergsd/GroupBy/hidden/" + REALM;
  const VIEW_T = "$:/config/hypergsd/list-view/GSD/Dashboard/Next actions";
  const stripRadios = c => { const out = [];
    (function f(n) { if (!n || typeof n !== "object" || Array.isArray(n)) return;
      if (n.isTiddlyWikiFakeDom && n.tag === "label" && ((n.attributes || {}).class || "").indexOf("tc-radio") !== -1)
        out.push((((n.attributes || {}).class || "").indexOf("tc-radio-selected") !== -1 ? "[x]" : "[ ]") + (n.children || []).map(x => x.textContent || "").join("").replace(/\u00A0/g, " ").trim());
      (n.children || []).forEach(f); })(c); return out; };
  const renderPage = title => { const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki",
      G + '\n\n<$transclude $tiddler="' + title + '" $mode="block"/>\n\n</$importvariables>'), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
    const c = doc.createElement("div"); w.render(c); return {w, c}; };
  const checkboxesFor = (root, row) => { let hit = null;
    (function f(n) { if (hit || !n || typeof n !== "object" || Array.isArray(n)) return;
      const d = n.domNodes && n.domNodes[0];
      if (d && d.tag === "label" && (d.children || []).some(ch => ch.tag === "input" && (ch.attributes || {}).type === "checkbox") && n.getVariable("currentTiddler") === row) hit = d;
      else (n.children || []).forEach(f); })(root); return hit; };

  // the Dashboards page renders checkbox rows for both tag lists; realm offered (checked) by default
  const dp = renderPage("$:/plugins/yan/hypergsd/ui/control-panel/dashboards");
  const realmBox = checkboxesFor(dp.w, REALM);
  const realmInput = realmBox && (realmBox.children || []).find(ch => ch.tag === "input");
  check("withdrawal: dashboards page offers realm as a checked checkbox row",
    [!!realmBox, realmInput && realmInput.attributes.checked !== undefined], [true, true]);

  // untick (the core row's write): realm hidden -> strip omits the radio, Settings picker omits the option
  wiki.addTiddler({title: HIDDEN_REALM, text: "hide"});
  const dash = renderPage("GSD/Dashboard");
  check("withdrawal: strip omits a withdrawn dimension",
    stripRadios(dash.c).some(r => r.indexOf("Realms") !== -1), false);
  const mp = renderPage("$:/plugins/yan/hypergsd/ui/control-panel/dashboards/main-dashboard-list");
  let groupOptions = [];
  (function f(n) { if (!n || typeof n !== "object" || Array.isArray(n)) return;
    if (n.domNodes && n.domNodes[0] && n.domNodes[0].tag === "select") {
      const cur = n.getVariable("currentTiddler");
      if (cur === "$:/plugins/yan/hypergsd/ui/lists/next-action-list") groupOptions.push((n.domNodes[0].children || []).filter(ch => ch.tag === "option").map(ch => ch.attributes.value)); }
    (n.children || []).forEach(f); })(mp.c);
  check("withdrawal: per-list Settings picker omits a withdrawn dimension",
    groupOptions.some(opts => opts.indexOf(REALM) !== -1), false);

  // a view state naming the withdrawn member falls back to the default grouping
  wiki.addTiddler({title: VIEW_T, group: REALM});
  const dash2 = renderPage("GSD/Dashboard");
  check("withdrawal: view state naming a withdrawn member falls back to the default",
    [stripRadios(dash2.c).some(r => r.indexOf("[x]Projects") !== -1), stripRadios(dash2.c).some(r => r.indexOf("Realms") !== -1)], [true, false]);
  wiki.deleteTiddler(VIEW_T);

  // the Settings page still lists the withdrawn member (management surface)
  const dp2 = renderPage("$:/plugins/yan/hypergsd/ui/control-panel/dashboards");
  check("withdrawal: dashboards page still lists the withdrawn member",
    !!checkboxesFor(dp2.w, REALM), true);

  // sort: hide modified-desc (the references list's built-in default) -> option gone, select unpreselected
  wiki.addTiddler({title: "$:/config/hypergsd/SortBy/hidden/" + MOD_DESC, text: "hide"});
  const refs = renderPage("GSD/References");
  let sortSelect = null;
  (function f(n) { if (sortSelect || !n || typeof n !== "object" || Array.isArray(n)) return;
    if (n.domNodes && n.domNodes[0] && n.domNodes[0].tag === "select") sortSelect = n; else (n.children || []).forEach(f); })(refs.w);
  check("withdrawal: strip sort omits a withdrawn member and its default falls through",
    [(sortSelect.domNodes[0].children || []).filter(ch => ch.tag === "option").map(ch => ch.attributes.value).indexOf(MOD_DESC), sortSelect.domNodes[0].value === MOD_DESC],
    [-1, false]);

  // explicit group-members is exempt: the author's set is final
  const exempt = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki",
    G + '\n\n<$hgsd.list list-heading="ZZ exempt" list-filter="[tag[$:/GSD/Action]gsd_status[next]gsd_complete[false]]" group-select="yes" group-members="[[$:/plugins/yan/hypergsd/ui/group-by/realm]]"/>\n\n</$importvariables>'),
    {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
  const ec = doc.createElement("div"); exempt.render(ec);
  check("withdrawal: explicit group-members keeps a withdrawn dimension",
    stripRadios(ec).some(r => r.indexOf("Realms") !== -1), true);

  wiki.deleteTiddler(HIDDEN_REALM);
  wiki.deleteTiddler("$:/config/hypergsd/SortBy/hidden/" + MOD_DESC);
}

// Offered-set withdrawal (None-only strip auto-hide): when no dimension is
// offered — all withdrawn, or nothing type-relevant — the whole Group by block
// withdraws (label, None radio, dimensions, ungrouped toggle); the strip row
// survives only for a Sort by select; an explicit group-members set that
// evaluates empty withdraws the block too; an empty LIST still offers
// universal dimensions (no items is not no dimensions).
{
  const GBT2 = "$:/plugins/yan/hypergsd/ui/group-by/";
  const ALL_MEMBERS = [GBT2 + "project", GBT2 + "realm", "$:/plugins/yan/hypergsd-contacts/ui/group-by/contact", "$:/plugins/yan/hypergsd-contexts/ui/group-by/context"];
  const stripInfo = (attrs) => {
    const body = G + '\n\n<$hgsd.list ' + attrs + ' />\n\n</$importvariables>';
    const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", body), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
    const c = doc.createElement("div"); w.render(c);
    const info = {divs: 0, radios: [], hasSelect: false, hasGroupLabel: false};
    (function f(n) {
      if (!n || typeof n !== "object") return;
      if (Array.isArray(n)) return n.forEach(f);
      if (!n.isTiddlyWikiFakeDom) return;
      if (((n.attributes || {}).class || "").indexOf("hgsd-group-strip") !== -1) {
        info.divs++;
        (function g(m) {
          if (!m || typeof m !== "object") return;
          if (Array.isArray(m)) return m.forEach(g);
          if (!m.isTiddlyWikiFakeDom) return;
          if (m.tag === "label") info.radios.push((m.children || []).map(x => x.textContent || "").join("").trim());
          if (m.tag === "select") info.hasSelect = true;
          if (/group/i.test((m.children || []).map(x => x.textContent || "").join("")) && ((m.attributes || {}).class || "").indexOf("gsd-muted") !== -1) info.hasGroupLabel = true;
          (m.children || []).forEach(g);
        })(n);
      }
      (n.children || []).forEach(f);
    })(c);
    return info;
  };

  // relevance alone empties the set: a contacts-only list matches no typed member,
  // so with the universal (realm) member withdrawn nothing is offered
  wiki.addTiddler({title: "$:/config/hypergsd/GroupBy/hidden/" + GBT2 + "realm", text: "hide"});
  const relEmpty = stripInfo('list-heading="ZZ rel" list-filter="[tag[$:/GSD/Contact]]" group-select="yes"');
  check("auto-hide: nothing type-relevant, no strip at all",
    [relEmpty.divs, relEmpty.radios.length, relEmpty.hasGroupLabel], [0, 0, false]);
  const relSort = stripInfo('list-heading="ZZ rel2" list-filter="[tag[$:/GSD/Contact]]" group-select="yes" sort-select="yes"');
  check("auto-hide: sort select keeps the row, no group controls",
    [relSort.divs, relSort.hasSelect, relSort.radios.length, relSort.hasGroupLabel], [1, true, 0, false]);
  wiki.deleteTiddler("$:/config/hypergsd/GroupBy/hidden/" + GBT2 + "realm");

  // an empty list still offers the universal dimension
  const emptyList = stripInfo('list-heading="ZZ empty" list-filter="[tag[$:/GSD/Action]gsd_status[nonexistent]]" group-select="yes"');
  check("auto-hide: empty list keeps universal dimensions",
    emptyList.radios, ["None", "Realms"]);

  // every member unticked: hidden config alone empties the set
  ALL_MEMBERS.forEach(m => wiki.addTiddler({title: "$:/config/hypergsd/GroupBy/hidden/" + m, text: "hide"}));
  const allHidden = stripInfo('list-heading="ZZ hid" list-filter="[tag[$:/GSD/Action]]" group-select="yes"');
  check("auto-hide: every shipped dimension withdrawn except the priorities member — strip survives on it",
    [allHidden.divs, allHidden.radios], [1, ["None", "Priority"]]);

  // explicit group-members that evaluates empty withdraws the block too
  const explicitEmpty = stripInfo('list-heading="ZZ exp" list-filter="[tag[$:/GSD/Action]]" group-select="yes" group-members="[tag[ZZNoSuchDimensionTag]]"');
  check("auto-hide: explicit empty set, no strip at all",
    [explicitEmpty.divs, explicitEmpty.radios], [0, []]);
  ALL_MEMBERS.forEach(m => wiki.deleteTiddler("$:/config/hypergsd/GroupBy/hidden/" + m));
}

console.log(fails === 0 ? "ALL DASHBOARD-LIST CASES PASS" : fails + " FAILURES");
console.log(render.strays === 0 ? "STRAY GUARD: 0 across all renders" : "STRAY GUARD FAILED: " + render.strays);
process.exit(fails === 0 && render.strays === 0 ? 0 : 1);