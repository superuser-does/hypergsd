// Localisation: strings in $:/language/hypergsd/ shadows, lingo-base override,
// field transclusions, user overrides.
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-wiki"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;

// Mirror the live global import chain (PageMacros + Macro + Global) so <<lingo>> resolves.
const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';
const render = (title, mode) => {
  const body = G + '\n\n<$transclude $tiddler="' + title + '"' + (mode ? ' $mode="' + mode + '"' : "") + '/>\n\n</$importvariables>';
  const parser = wiki.parseText("text/vnd.tiddlywiki", body);
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
  const c = doc.createElement("div"); w.render(c);
  let text = "";
  let strays = 0;
  (function f(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(f);
    if (n.isTiddlyWikiFakeDom) return (n.children || []).forEach(f);
    text += (n.textContent || "");
    if ((n.textContent || "").trim() === ">") strays++;
  })(c);
  render.strays = (render.strays || 0) + strays;
  return text.replace(/\s+/g, " ");
};
let fails = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? "PASS " : "FAIL ") + name + (ok ? "" : " got:" + JSON.stringify(got) + " want:" + JSON.stringify(want)));
};

const B = "$:/language/hypergsd/Settings/";

// 1. English shadows exist for every key family
check("en shadow present", wiki.getTiddlerText(B + "Behaviour/Caption"), "Behaviour");
check("en nested key", wiki.getTiddlerText(B + "ViewPlacement/Top"), "Top");
check("en list hint", wiki.getTiddlerText(B + "Lists/NextActions/Hint"), "Incomplete actions with status next");

// 2. Behaviour settings page renders via <<lingo>> (lingo-base override; renamed Core→Behaviour 2026-09-26)
let core = render("$:/plugins/yan/hypergsd/ui/control-panel/behaviour");
check("behaviour: checkbox labels", [core.includes("Navigate to new actions upon creation"), core.includes("Inherit the tiddler's tags when creating from its panel")], [true, true]);
const sections = render("$:/plugins/yan/hypergsd/ui/control-panel/sections");
// placement moved to its own View placement tab (2026-09-26/27 reorganisation; own lingo family ViewPlacement/*)
check("panel-and-modal: placement section gone", [sections.includes("View placement"), sections.includes("above or below")], [false, false]);
const vp = render("$:/plugins/yan/hypergsd/ui/control-panel/view-placement");
check("view-placement tab: prompt, member captions, radio pair", [vp.includes("above or below"), vp.includes("Action tiddlers") && vp.includes("Reference tiddlers"), vp.includes("Top"), vp.includes("Bottom")], [true, true, true, true]);
check("panel-and-modal: fragment lists gone", [sections.includes("Link items"), sections.includes("Capture sidebar entries")], [false, false]);
const fragments = render("$:/plugins/yan/hypergsd/ui/control-panel/fragments", "block");
check("fragments tab: one merged block over the four families", [fragments.includes("Fragments are tiddlers tagged"), fragments.includes("Panel or modal, after link"), fragments.includes("Row, before title") && fragments.includes("Row, after title"), fragments.includes("Use the dropdown to move a fragment between rows and links"), fragments.includes("Actions") && fragments.includes("Projects"), fragments.includes("Top, full-width") === false], [true, true, true, true, true, true]);
// (the preserve-action checkbox and its cleanup-link prose moved to the Cleanup page, which owns those controls)

// 2b. Dashboards tab renders via <<lingo>> (moved out of Core 2026-09-04)
const dash = render("$:/plugins/yan/hypergsd/ui/control-panel/dashboards");
check("dashboards: own tab with lists prompt", [dash.includes("Show items under future projects"), dash.includes("Choose which lists are displayed in each dashboard")], [true, true]);

// 3. List page renders item captions/hints via field transclusions (ItemTemplate wikifies)
const page = render("$:/plugins/yan/hypergsd/ui/control-panel/dashboards/main-dashboard-list");
check("lists page items", [page.includes("Next action list"), page.includes("Incomplete actions with status next"), page.includes("Active project list")], [true, true, true]);

// 3b. A sub-plugin list tab resolves the shared hgsd-visibility-list procedure
// (main plugin, $:/tags/Global) — cross-plugin call proof through the one-liner body
const contactPage = render("$:/plugins/yan/hypergsd-contacts/ui/control-panel/contact-list");
check("contact list page items (sub-plugin tab, shared procedure)",
  [contactPage.includes("Next action list"), contactPage.includes("Waiting action list"), contactPage.includes("Future action list")], [true, true, true]);

// 4. User tiddler overrides a shadow without touching plugins
wiki.addTiddler({title: B + "ViewPlacement/Top", text: "OVERRIDE-TOP"});
check("user override wins", render("$:/plugins/yan/hypergsd/ui/control-panel/view-placement").includes("OVERRIDE-TOP"), true);
wiki.deleteTiddler(B + "ViewPlacement/Top");
check("override removed", render("$:/plugins/yan/hypergsd/ui/control-panel/view-placement").includes("OVERRIDE-TOP"), false);

// 5. Every family ships its expected shadows (en-GB, main plugin)
const famCount = (prefix) => wiki.filterTiddlers("[all[shadows]prefix[" + prefix + "]]").length;
const fams = {
  "$:/language/hypergsd/Settings/": 153, "$:/language/hypergsd/Sections/": 75,
  "$:/language/hypergsd/Convert/": 5, "$:/language/hypergsd/Lists/": 79,
  "$:/language/hypergsd/Dashboards/": 22, "$:/language/hypergsd/Toolbar/": 12,
  "$:/language/hypergsd/Sidebar/": 42, "$:/language/hypergsd/NewItem/": 5,
  "$:/language/hypergsd/Widgets/": 13,
};
for (const fam in fams) check("family count " + fam.split("/")[3].toLowerCase(), famCount(fam), fams[fam]);

// 6. Sub-plugin families present in the shared namespaces
check("sub Settings keys", wiki.getTiddlerText("$:/language/hypergsd/Settings/Contacts/Placement/Caption"), "Contact tiddlers");
check("sub Sections keys", wiki.getTiddlerText("$:/language/hypergsd/Sections/Contact/Label"), "Contact:");
check("sub Lists keys", wiki.getTiddlerText("$:/language/hypergsd/Lists/WaitingByContact"), "Waiting actions by contact");
check("sub Convert key", wiki.getTiddlerText("$:/language/hypergsd/Convert/Warnings/Contact"), "The contact field will be kept, but it no longer applies to a project.");
check("sub Sidebar keys", wiki.getTiddlerText("$:/language/hypergsd/Sidebar/Capture/NewContact/Hint"), "Add a new contact");
check("ticklers Sections keys", wiki.getTiddlerText("$:/language/hypergsd/Sections/Tickler/Label"), "Tickler date:");
check("ticklers Lists keys", wiki.getTiddlerText("$:/language/hypergsd/Lists/UpcomingTicklers"), "Upcoming ticklers");
check("ticklers shift lingo pairs", [wiki.getTiddlerText("$:/language/hypergsd/Sections/Tickler/Shift/Week/Short"), wiki.getTiddlerText("$:/language/hypergsd/Sections/Tickler/Shift/Week/Hint")], ["+w", "Add 7 days"]);
check("sub Context Sidebar keys", wiki.getTiddlerText("$:/language/hypergsd/Sidebar/Capture/DefaultContext/Label"), "Default context:&#x2004;");
check("sub Context Sections keys", wiki.getTiddlerText("$:/language/hypergsd/Sections/Context/Label"), "Context:");
check("references Settings keys", wiki.getTiddlerText("$:/language/hypergsd/Settings/References/Placement/Caption"), "Reference tiddlers");
check("references Lists keys", wiki.getTiddlerText("$:/language/hypergsd/Lists/Add/Reference"), "add new reference");
check("references Sidebar keys", wiki.getTiddlerText("$:/language/hypergsd/Sidebar/Capture/NewReference/Label"), "new reference");
check("portion band labels", [wiki.getTiddlerText("$:/language/hypergsd/Settings/PanelModal/PortionTop"), wiki.getTiddlerText("$:/language/hypergsd/Settings/PanelModal/PortionFull")], ["Top, full-width", "Bottom, full-width"]);
check("tag-basis note lingo", [wiki.getTiddlerText("$:/language/hypergsd/Settings/TagBasis/Prompt"), wiki.getTiddlerText("$:/language/hypergsd/Settings/TagBasis/Portions")], ["Tiddlers tagged with", "Portions are the layout slots an entry renders in. Each portion is a tag named by adding a suffix -- such as `/Portion/1` or `/Portion/Top`, to this tag"]);
check("picker instant-commit labels present", [/instantly/i.test(wiki.getTiddlerText("$:/language/hypergsd/Settings/Behaviour/PickerInstantCommit") || ""), /fine pointers/i.test(wiki.getTiddlerText("$:/language/hypergsd/Settings/Behaviour/PickerInstantCommit/Fine") || ""), /coarse pointers/i.test(wiki.getTiddlerText("$:/language/hypergsd/Settings/Behaviour/PickerInstantCommit/Coarse") || "")], [true, true, true]);

// 7. Fragment warning fields hold keys, not prose
const frag = wiki.getTiddler("$:/plugins/yan/hypergsd/modules/convert-warnings/prerequisite");
check("fragment warning is a key", frag && frag.fields["hgsd-warning"], "Prerequisite");
const fragOwn = wiki.getTiddler("$:/plugins/yan/hypergsd/modules/convert-warnings/own-prerequisites");
check("own-prereq fragment warning is a key", fragOwn && fragOwn.fields["hgsd-warning"], "OwnPrerequisites");
check("own-prereq warning text resolves", /pre-requisites/.test(wiki.getTiddlerText("$:/language/hypergsd/Convert/Warnings/OwnPrerequisites") || ""), true);

// 8. Spot renders: sidebar tabs and toolbar buttons localise
const review = render("$:/plugins/yan/hypergsd/ui/sidebar/review-sidebar");
check("review sidebar renders", [review.includes("Select realms:"), review.includes("Actions waiting"), review.includes("Cleanup")], [true, true, true]);
const capture = render("$:/plugins/yan/hypergsd/ui/sidebar/capture-sidebar");
check("capture sidebar renders", [capture.includes("Default context:"), capture.includes("Default realm:"), capture.includes("new action"), capture.includes("new contact"), capture.includes("create a new realm")], [true, true, true, true, true]);

// 9. Global-tagged widget defaults: full-path transclusions resolve (create-and-add label, convert button)
wiki.addTiddler({title: "Lingo host", tags: ["$:/GSD/Action"], gsd_complete: "false", gsd_status: "next"});
wiki.addTiddler({title: "$:/temp/gsd-new-title", "hgsd-title": ""});
const btn = (b) => b.tag === "button";
const renderBtns = (title, vars) => {
  const body = G + '\n\n<$tiddler tiddler="' + title + '">' + vars + '</$tiddler>\n\n</$importvariables>';
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", body), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: title}});
  const c = doc.createElement("div"); w.render(c);
  const out = [];
  (function f(n){ if(!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
    if(n.isTiddlyWikiFakeDom){ if(btn(n)) out.push((n.textContent||"").replace(/\s+/g," ").trim()); (n.children||[]).forEach(f);} })(c);
  return out;
};
const caBtns = renderBtns("Lingo host", '<$transclude $variable="hgsd-create-and-add" typed-pick="New Person" new-type="contact" new-status="next" target-tiddler="Lingo host" target-field="gsd_contact"/>');
// The typed pick is wrapped in a <q> element (browser supplies the quotation marks) — assert the
// assembled text (marks absent from textContent) AND the structural q-wrap, so a regression to
// plain text cannot pass silently.
const caRender = (() => { let qWrap = false;
  const body = G + '\n\n<$tiddler tiddler="Lingo host"><$transclude $variable="hgsd-create-and-add" typed-pick="New Person" new-type="contact" new-status="next" target-tiddler="Lingo host" target-field="gsd_contact"/></$tiddler>\n\n</$importvariables>';
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", body), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "Lingo host"}});
  const c = doc.createElement("div"); w.render(c);
  (function f(n){ if(!n||qWrap||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
    if(n.isTiddlyWikiFakeDom && n.tag === "q" && String(n.textContent||"").trim() === "New Person") qWrap = true; (n.children||[]).forEach(f); })(c);
  return qWrap; })();
check("create-and-add label", [caBtns.some(x => x === "create New Person and add"), caRender], [true, true]);
const convBtns = renderBtns("Lingo host", '<$hgsd.convert current-status="next"/>');
check("convert default label", convBtns.some(x => x === "convert"), true);

console.log(fails === 0 ? "ALL LINGO CASES PASS" : fails + " FAILURES");
console.log(render.strays === 0 ? "STRAY GUARD: 0 across all renders" : "STRAY GUARD FAILED: " + render.strays);
process.exit(fails === 0 && render.strays === 0 ? 0 : 1);