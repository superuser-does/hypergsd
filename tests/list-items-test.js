// Row composition via ListItem tags: fragment order, extension hooks, live re-render.
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-wiki"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;

wiki.addTiddler({title: "P one", tags: ["$:/GSD/Project"], gsd_status: "active"});
wiki.addTiddler({title: "A done noted", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "true",
  gsd_comp_date: "20260820120000000", gsd_project: "P one"});
wiki.addTiddler({title: "B open", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_project: "P one", text: "open with note"});
wiki.addTiddler({title: "$:/state/hypergsd/current-realm", text: "NoRealm"});

const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';
const LF = "[all[tiddlers]tag[$:/GSD/Action]] +[sort[title]]";
const render = () => {
  const body = '<$hgsd.list list-heading="T" list-filter="' + LF + '" group-state="false"/>';
  const parser = wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + body + "\n\n</$importvariables>");
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
  const c = doc.createElement("div"); w.render(c);
  const rows = {};
  (function f(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(f);
    if (n.isTiddlyWikiFakeDom) {
      if ((n.attributes && n.attributes.class || "").indexOf("gsd-list-item-title") !== -1)
        rows[decodeURIComponent((n.attributes.href || "").replace(/^#\/?/, ""))] = n.parentNode;
      (n.children || []).forEach(f);
    }
  })(c);
  const fingerprint = (row) => {
    const marks = [];
    (function g(n) {
      if (!n || typeof n !== "object") return;
      if (Array.isArray(n)) return n.forEach(g);
      if (!n.isTiddlyWikiFakeDom) {
      if ((n.textContent || "").indexOf("EXT-") !== -1) marks.push(n.textContent.trim().slice(0, 14));
      return;
    }
      const cls = n.attributes && n.attributes.class || "";
      const attrs = n.attributes || {};
      if (n.tag === "input" && attrs.type === "checkbox") marks.push("checkbox");
      else if (n.tag === "input" && attrs.type === "radio") marks.push("status");
      else if (n.tag === "a" && cls.indexOf("gsd-list-item-title") !== -1) marks.push("title");
      else if (n.tag === "a" && cls.indexOf("hgsd-project-link") !== -1) marks.push("project-link");
      else if (n.tag === "a" && cls.indexOf("hgsd-contact-link") !== -1) marks.push("contact-link");
      else if (n.tag === "span" && cls.indexOf("gsd-muted") !== -1) marks.push("comp-date");
      else if (n.tag === "div" && attrs.title === "This tiddler contains text in its body") marks.push("body-text");
      else if (n.tag === "button" && attrs["data-hgsd-action"] === "delete") marks.push("delete");
      else if ((n.textContent || "").indexOf("EXT-") !== -1 && !(n.children || []).some(ch => ch.isTiddlyWikiFakeDom))
        marks.push(n.textContent.trim().slice(0, 14));
      (n.children || []).forEach(g);
    })(row);
    return marks;
  };
  const pillClasses = (row) => {
    const out = [];
    (function g(n) {
      if (!n || typeof n !== "object") return;
      if (Array.isArray(n)) return n.forEach(g);
      if (n.isTiddlyWikiFakeDom) {
        const cls = (n.attributes && n.attributes.class) || "";
        if (cls.indexOf("item-status") === 0) out.push(cls);
        (n.children || []).forEach(g);
      }
    })(row);
    return out;
  };
  return {
    done: rows["A done noted"] ? fingerprint(rows["A done noted"]) : "ROW NOT FOUND",
    open: rows["B open"] ? fingerprint(rows["B open"]) : "ROW NOT FOUND",
    unseeded: rows["C unseeded"] ? fingerprint(rows["C unseeded"]) : "ROW NOT FOUND",
    openPillClasses: rows["B open"] ? pillClasses(rows["B open"]) : "ROW NOT FOUND"
  };
};
let fails = 0;
const t = (name, got, exp) => {
  const ok = JSON.stringify(got) === JSON.stringify(exp);
  if (!ok) fails++;
  console.log((ok ? "PASS " : "FAIL ") + name + " got:" + JSON.stringify(got));
};
// completed+dated row: checkbox, title, comp-date, project-link, delete (status AND note both hidden when complete)
t("completed row order", render().done, ["checkbox", "title", "comp-date", "project-link", "delete"]);
// open row with body text: checkbox, 3 status radios, title, body-text icon, project-link
t("open row order", render().open, ["checkbox", "status", "status", "status", "title", "body-text", "project-link"]);
// colour hooks: pill labels carry computed item-status <type>-<status> classes
// (a literal {{{ }}} in a quoted class attr once shipped — pills painted nothing)
t("open row pill classes (colour hooks)", render().openPillClasses,
  ["item-status action-next", "item-status action-waiting", "item-status action-future"]);

// gsd_complete convention (2026-09-03): incomplete is the positive
// gsd_complete[false] everywhere — every creation path seeds the field, so a
// missing value is NOT incomplete (no pills, not listed). body-text.tid keeps
// the one negative check (not type-gated; field-less types like contacts pass).
wiki.addTiddler({title: "C unseeded", tags: ["$:/GSD/Action"], text: "has body"});
t("unseeded action row: checkbox+title+body-text, no status pills", render().unseeded, ["checkbox", "title", "body-text"]);
t("unseeded action not listed as incomplete",
  wiki.filterTiddlers("[all[tiddlers]tag[$:/GSD/Action]gsd_complete[false]]").includes("C unseeded"), false);
const offenders = wiki.filterTiddlers("[all[shadows+tiddlers]prefix[$:/plugins/yan/hypergsd/]]")
  .filter(tt => tt !== "$:/plugins/yan/hypergsd/ui/list-items/body-text"
    && (wiki.getTiddlerText(tt) || "").indexOf("!gsd_complete[true]") !== -1);
t("no negative gsd_complete checks outside body-text.tid", offenders, []);
wiki.deleteTiddler("C unseeded");
// extension hooks: prefix before title, suffix after delete (appended after listed fragments)
wiki.addTiddler({title: "ZZ ext prefix", tags: ["$:/tags/hypergsd/ListItem/Prefix"], text: "EXT-P"});
wiki.addTiddler({title: "ZZ ext suffix", tags: ["$:/tags/hypergsd/ListItem/Suffix"], text: "EXT-S"});
const withExt = render();
t("prefix extension before title", withExt.done.indexOf("EXT-P") !== -1 && withExt.done.indexOf("EXT-P") < withExt.done.indexOf("title"), true);
t("suffix extension after delete", withExt.done.indexOf("EXT-S") !== -1 && withExt.done.indexOf("EXT-S") > withExt.done.indexOf("delete"), true);
// live removal restores
wiki.deleteTiddler("ZZ ext prefix"); wiki.deleteTiddler("ZZ ext suffix");
t("extensions removed", render().done, ["checkbox", "title", "comp-date", "project-link", "delete"]);
// user order override: create a user Suffix tag tiddler pinning an extension FIRST
wiki.addTiddler({title: "ZZ ext first", tags: ["$:/tags/hypergsd/ListItem/Suffix"], text: "EXT-F"});
wiki.addTiddler({title: "$:/tags/hypergsd/ListItem/Suffix",
  list: "[[ZZ ext first]] [[$:/plugins/yan/hypergsd/ui/list-items/comp-date]] [[$:/plugins/yan/hypergsd/ui/list-items/note]] [[$:/plugins/yan/hypergsd/ui/list-items/delete]]"});
const reordered = render().done;
t("user list-field reorder honored (unlisted project-link appends after)", reordered, ["checkbox", "title", "EXT-F", "comp-date", "delete", "project-link"]);
wiki.deleteTiddler("ZZ ext first");
wiki.addTiddler({title: "$:/tags/hypergsd/ListItem/Suffix"});

// ROW FREEZE: an unrelated item edit must not rebuild unchanged rows (node
// identity survives); the row's own item edit must reach it (node replaced)
{
  wiki.addTiddler({title: "A other", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false"});
  const body = '<$hgsd.list list-heading="T" list-filter="' + LF + '" group-state="false"/>';
  const parser = wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + body + "\n\n</$importvariables>");
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
  const c = doc.createElement("div"); w.render(c);
  const rowOf = title => {
    let hit = null;
    (function f(n){ if (hit || !n || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(f);
      if (n.isTiddlyWikiFakeDom) { if (n.tag === "a" && ((n.attributes||{}).class||"").includes("gsd-list-item-title")) { const t = (function tx(m){ let s = ""; (function g(x){ if(!x||typeof x!=="object")return; if(Array.isArray(x))return x.forEach(g); if(x.isTiddlyWikiFakeDom)return (x.children||[]).forEach(g); s += (x.textContent||""); })(m); return s; })(n); if (t === title) hit = n; } (n.children||[]).forEach(f); } })(c);
    return hit;
  };
  const inTree = node => { let found = false; (function f(n){ if (found || !n || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(f); if (n === node) { found = true; return; } if (n.isTiddlyWikiFakeDom) (n.children||[]).forEach(f); })(c); return found; };
  const bRow = rowOf("B open");
  if (!bRow) { t("row freeze: fixture row found", false, true); }
  else {
    wiki.addTiddler({title: "A other", tags: ["$:/GSD/Action"], gsd_status: "waiting", gsd_complete: "false"});
    w.refresh({"A other": wiki.getTiddler("A other")});
    t("row freeze: unrelated item edit keeps the row node (no rebuild)", inTree(bRow), true);
    wiki.addTiddler({title: "B open", tags: ["$:/GSD/Action"], gsd_status: "waiting", gsd_complete: "false", gsd_project: "P one", text: "open with note"});
    w.refresh({"B open": wiki.getTiddler("B open")});
    t("row freeze: own item edit rebuilds the row", inTree(bRow), false);
  }
  wiki.deleteTiddler("A other");
  wiki.addTiddler({title: "B open", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_project: "P one", text: "open with note"});
}

// WHITELIST COMPOSITION: a fragment's refresh-whitelist field joins the
// row gate's subfilter (tag list-driven extensibility, not main-plugin edits)
{
  wiki.addTiddler({title: "ZZ wl test", tags: ["$:/tags/hypergsd/ListItem/Suffix"], text: "EXT-W", "hgsd-refresh-whitelist": "[prefix[$:/state/hypergsd/ext-feature]]"});
  const body = '<$hgsd.list list-heading="T" list-filter="' + LF + '" group-state="false"/>';
  const parser = wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + body + "\n\n</$importvariables>");
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
  const c = doc.createElement("div"); w.render(c);
  let wl = "";
  (function f(n){ if (!n || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(f);
    if (n.filter && String(n.filter).indexOf("match<currentTiddler>") !== -1) wl = String(n.filter);
    (n.children || []).forEach(f); })(w);
  t("row whitelist: fragment field composed into the gate subfilter",
    [/match<currentTiddler>/.test(wl), /state\/hypergsd\/ext-feature/.test(wl), /prefix\[\$:\/state\/popup\/pick-\]/.test(wl)], [true, true, true]);
  wiki.deleteTiddler("ZZ wl test");
}


// Project chip REMOVED (2026-09-05): flat reference rows rely on the
// project-link suffix icon alone (tooltip = project title), so the chip
// fragment was dead code. Pin that no chip text ever returns — the exact
// action fingerprints above also fail if any prefix chip leaks.
const chipRender = (filter) => {
  const body = '<$hgsd.list list-heading="T" list-filter="' + filter + '" group-state="false"/>';
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + body + "\n\n</$importvariables>"), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
  const c = doc.createElement("div"); w.render(c);
  const chips = [];
  (function f(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(f);
    if (n.isTiddlyWikiFakeDom) {
      if ((n.attributes && n.attributes.class || "").indexOf("gsd-project-chip") !== -1)
        chips.push((n.children || []).map(x => x.textContent || "").join("").trim());
      (n.children || []).forEach(f);
    }
  })(c);
  return chips;
};
wiki.addTiddler({title: "R withp", tags: ["$:/GSD/Reference"], gsd_project: "P one"});
wiki.addTiddler({title: "R bare", tags: ["$:/GSD/Reference"]});
t("flat reference rows: no project chip (the jump icon covers it)",
  chipRender("[all[tiddlers]tag[$:/GSD/Reference]] +[sort[title]]"), []);
t("flat action rows: no chips",
  chipRender(LF), []);

// Jump links (project-link + contacts contact-link): tooltip is the target
// tiddler's title; suppressed on the target's own page (storyTiddler —
// snapshotted by the core ViewTemplate, never redefined by list loops) and
// under its own group heading (current-group — ambient only in the grouped
// branch; every shipped grouping is by gsd_project or gsd_contact).
const jumpRender = (filter, attrs, vars) => {
  const body = '<$hgsd.list list-heading="T" list-filter="' + filter + '" ' + (attrs || "") + "/>";
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + body + "\n\n</$importvariables>"),
    {document: doc, parentWidget: $tw.rootWidget, variables: Object.assign({currentTiddler: "GSD/Test"}, vars || {})});
  const c = doc.createElement("div"); w.render(c);
  const out = {project: [], contact: [], tooltips: []};
  (function f(n){ if(!n||typeof n!=="object") return; if(Array.isArray(n)) return n.forEach(f);
    if(n.isTiddlyWikiFakeDom) { const cls = (n.attributes&&n.attributes.class)||"", href = decodeURIComponent((n.attributes.href||"").replace(/^#\/?/,""));
      if(n.tag === "a" && cls.indexOf("hgsd-project-link") !== -1) { out.project.push(href); out.tooltips.push(n.attributes.title || ""); }
      if(n.tag === "a" && cls.indexOf("hgsd-contact-link") !== -1) { out.contact.push(href); out.tooltips.push(n.attributes.title || ""); }
      (n.children||[]).forEach(f); } })(c);
  out.project.sort(); out.contact.sort(); out.tooltips.sort();
  return out;
};
wiki.addTiddler({title: "C one", tags: ["$:/GSD/Contact"]});
wiki.addTiddler({title: "J act", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_project: "P one"});
wiki.addTiddler({title: "J both", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_project: "P one", gsd_contact: "C one"});
wiki.addTiddler({title: "J ref", tags: ["$:/GSD/Reference"], gsd_project: "P one"});
const JF = "[all[tiddlers]prefix[J ]] +[sort[title]]";
const flatJ = jumpRender(JF, 'group-state="false"');
t("flat rows: jump links on all three rows, tooltips are target titles",
  [flatJ.project, flatJ.contact, flatJ.tooltips], [["P one","P one","P one"], ["C one"], ["C one","P one","P one","P one"]]);
const onProject = jumpRender(JF, 'group-state="false"', {storyTiddler: "P one"});
t("inside the project's page: project links suppressed, contact links kept",
  [onProject.project, onProject.contact], [[], ["C one"]]);
const onContact = jumpRender(JF, 'group-state="false"', {storyTiddler: "C one"});
t("inside the contact's page: contact links suppressed, project links kept",
  [onContact.project, onContact.contact], [["P one","P one","P one"], []]);
const byProject = jumpRender(JF, 'group-state="true" group-by="gsd_project"');
t("grouped by project: hidden under own heading, contact link kept",
  [byProject.project, byProject.contact], [[], ["C one"]]);
const byContact = jumpRender(JF, 'group-state="true" group-by="gsd_contact"');
t("grouped by contact: contact hidden under own heading, project links kept",
  [byContact.project, byContact.contact], [["P one","P one","P one"], []]);
console.log(fails === 0 ? "ALL LIST-ITEM CASES PASS" : fails + " FAILURE(S)");
process.exit(fails ? 1 : 0);