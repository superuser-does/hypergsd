// Close-on-complete: the three-mode config $:/config/hypergsd/close-on-complete
// (never / own-page / always) decides whether completing an item removes it
// from $:/StoryList — own-page only for completions on the item's own page
// (direct click's currentTiddler match, or hgsd-from-item through the warning
// modal), always from any origin. Covers un-completing, the still-incomplete
// guard, the membership gate (an unopened item must not mint a story list),
// exact titlelist re-serialisation for multi-word titles, and the stale
// checkbox-era value falling back to never.
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-wiki"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;

const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';
let fails = 0;
const t = (name, got, exp) => {
  const ok = JSON.stringify(got) === JSON.stringify(exp);
  if (!ok) fails++;
  console.log((ok ? "PASS " : "FAIL ") + name + " got:" + JSON.stringify(got));
};

let modalOpened = null, modalFromItem = null;
$tw.rootWidget.addEventListener("tm-modal", e => { modalOpened = e.param; modalFromItem = e.paramObject && e.paramObject["hgsd-from-item"]; });
// Click dispatch: host binds the click-site currentTiddler (the item's own page
// vs the page hosting a list); extra lets simulate the warning modal's
// paramObject variables for the confirmed action.
const fireClick = (action, tiddler, host, extraLets) => {
  modalOpened = null; modalFromItem = null;
  const lets = '<$let dom-data-tiddler="' + tiddler + '" dom-data-hgsd-action="' + action + '"'
    + (extraLets ? " " + extraLets : "") + ">";
  const body = '<$tiddler tiddler="' + host + '"><$button>' + lets
    + '<$transclude $variable="hgsd-handle-click"/></$let></$button></$tiddler>';
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + body + "\n\n</$importvariables>"), {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c);
  let btn = null;
  (function f(n) { if (!n || btn || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(f);
    if (n.parseTreeNode && n.parseTreeNode.tag === "$button") { btn = n; return; } (n.children || []).forEach(f); })(w.children);
  btn.invokeActions(btn, {type: "click"});
};

const story = () => wiki.getTiddlerList("$:/StoryList");
const setStory = (list) => wiki.addTiddler({title: "$:/StoryList", list: list});
const setConfig = (v) => v === null ? wiki.deleteTiddler("$:/config/hypergsd/close-on-complete") : wiki.addTiddler({title: "$:/config/hypergsd/close-on-complete", text: v});
const markIncomplete = (title) => wiki.addTiddler(new $tw.Tiddler(wiki.getTiddler(title), {gsd_complete: "false", gsd_comp_date: undefined}));

// Fixtures
wiki.addTiddler({title: "Own page action", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false"});
wiki.addTiddler({title: "Row action", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false"});
wiki.addTiddler({title: "Not open action", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false"});
wiki.addTiddler({title: "Warn project", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "false"});
wiki.addTiddler({title: "Open child", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_project: "Warn project"});
const BASE_STORY = ["Some other tiddler", "Own page action", "Row action", "Warn project"];

// 1. Shipped default (shadow reads never): own-page completion leaves the river alone.
setStory(BASE_STORY);
fireClick("complete", "Own page action", "Own page action");
t("never default: completed", wiki.getTiddler("Own page action").fields.gsd_complete, "true");
t("never default: story unchanged", story(), BASE_STORY);

// 2. own-page mode, own page: the item leaves the river, its neighbours stay,
//    and the multi-word title round-trips through the titlelist intact.
setConfig("own-page"); markIncomplete("Own page action"); setStory(BASE_STORY);
fireClick("complete", "Own page action", "Own page action");
t("own-page mode: completed + dated", [wiki.getTiddler("Own page action").fields.gsd_complete, !!wiki.getTiddler("Own page action").fields.gsd_comp_date], ["true", true]);
t("own-page mode: removed from story", story(), ["Some other tiddler", "Row action", "Warn project"]);

// 3. own-page mode, list host (currentTiddler is the dashboard, not the item).
markIncomplete("Row action"); setStory(BASE_STORY);
fireClick("complete", "Row action", "GSD/Dashboard");
t("own-page mode, list host: completed", wiki.getTiddler("Row action").fields.gsd_complete, "true");
t("own-page mode, list host: story unchanged", story(), BASE_STORY);

// 4. always mode: list-host completion closes the open item too.
setConfig("always");
markIncomplete("Row action"); setStory(BASE_STORY);
fireClick("complete", "Row action", "GSD/Dashboard");
t("always mode: completed", wiki.getTiddler("Row action").fields.gsd_complete, "true");
t("always mode: list host closes too", story(), ["Some other tiddler", "Own page action", "Warn project"]);

// 5. Un-completing from the own page never re-closes anything.
setConfig("own-page"); setStory(BASE_STORY);
fireClick("complete", "Row action", "Row action");
t("un-complete: item stays complete but story untouched", [wiki.getTiddler("Row action").fields.gsd_complete, story()], ["false", BASE_STORY]);

// 6. Membership gate: an unopened item must not write (or mint) the story list.
setConfig("always"); markIncomplete("Not open action");
wiki.deleteTiddler("$:/StoryList");
fireClick("complete", "Not open action", "Not open action");
t("not open: completed", wiki.getTiddler("Not open action").fields.gsd_complete, "true");
t("not open: no story list minted", wiki.getTiddler("$:/StoryList"), undefined);

// 7. Warning modal from the own page (own-page mode): blocked click opens the
//    modal with hgsd-from-item=yes and completes nothing yet.
setConfig("own-page");
markIncomplete("Warn project"); setStory(BASE_STORY);
fireClick("complete", "Warn project", "Warn project");
t("modal: dispatched with from-item=yes", [modalOpened, modalFromItem, wiki.getTiddler("Warn project").fields.gsd_complete], ["$:/plugins/yan/hypergsd/ui/complete-warning-modal", "yes", "false"]);
t("modal: story unchanged while unconfirmed", story(), BASE_STORY);

// 8. Confirmed from-item=yes (own-page mode): completes and closes.
fireClick("complete-confirmed", "Warn project", "$:/plugins/yan/hypergsd/ui/complete-warning-modal", 'hgsd-from-item="yes"');
t("confirmed from item: completed", wiki.getTiddler("Warn project").fields.gsd_complete, "true");
t("confirmed from item: removed from story", story(), ["Some other tiddler", "Own page action", "Row action"]);

// 9. Warning modal opened from a list host (own-page mode): from-item=no,
//    confirm completes but the river keeps the item.
markIncomplete("Warn project"); setStory(BASE_STORY);
fireClick("complete", "Warn project", "GSD/Dashboard");
t("modal from list: from-item=no", modalFromItem, "no");
fireClick("complete-confirmed", "Warn project", "$:/plugins/yan/hypergsd/ui/complete-warning-modal", 'hgsd-from-item="no"');
t("confirmed from list, own-page mode: completed, story unchanged", [wiki.getTiddler("Warn project").fields.gsd_complete, story()], ["true", BASE_STORY]);

// 10. Same modal-from-list, always mode: the confirm closes it.
markIncomplete("Warn project"); setStory(BASE_STORY); setConfig("always");
fireClick("complete-confirmed", "Warn project", "$:/plugins/yan/hypergsd/ui/complete-warning-modal", 'hgsd-from-item="no"');
t("confirmed from list, always mode: removed from story", [wiki.getTiddler("Warn project").fields.gsd_complete, story()], ["true", ["Some other tiddler", "Own page action", "Row action"]]);

// 11. Still-incomplete guard with the close in place: a stacked confirm on an
//     already-complete host neither uncompletes nor touches the river.
setStory(BASE_STORY);
fireClick("complete-confirmed", "Warn project", "$:/plugins/yan/hypergsd/ui/complete-warning-modal", 'hgsd-from-item="yes"');
t("double-confirm: stays complete, story untouched", [wiki.getTiddler("Warn project").fields.gsd_complete, story()], ["true", BASE_STORY]);

// 12. Stale checkbox-era value (yes) falls back to never.
setConfig("yes"); markIncomplete("Own page action"); setStory(BASE_STORY);
fireClick("complete", "Own page action", "Own page action");
t("stale value: story unchanged", story(), BASE_STORY);

setConfig(null); wiki.deleteTiddler("$:/StoryList");
console.log(fails ? "FAILURES: " + fails : "ALL CASES PASS");
process.exit(fails ? 1 : 0);