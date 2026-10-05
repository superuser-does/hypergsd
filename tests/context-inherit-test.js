// Creation inheritance through the modal submit: the new-button forwards the
// RESOLVED caller (explicit parameter else currentTiddler) into tm-modal, and
// the Inheritance rail harvests it directly at creation — the context rule
// takes the caller's context tags, the realm rule every caller realm tag (not
// just the parameter seed), informal-tags every non-system tag; system tags
// never leak. Panel/list quick-adds and pick-field opens behave identically.
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-wiki"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;
const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';
let fails = 0;
const t = (name, ok, extra) => { if (Array.isArray(ok)) ok = JSON.stringify(ok) === JSON.stringify(extra); if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + name + (ok || !extra ? "" : " " + extra)); };

wiki.addTiddler({title: "ZZ ctx", tags: ["GSD/Contexts"]});
wiki.addTiddler({title: "ZZ person", tags: ["GSD/Contact"]});
wiki.addTiddler({title: "ZZ proj", tags: ["$:/GSD/Project", "$:/GSD/Realm/Home", "$:/GSD/Realm/Work", "ZZ ctx", "ZZ person", "chess"], gsd_status: "active", gsd_complete: "false"});
wiki.addTiddler({title: "$:/state/hypergsd/effective-realm", text: "Home"});

// 1. fire the project view's quick-add button (context inheritance seed)
const pv = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + '\n\n<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/ViewTemplate/view-body-project" $mode="block"/>\n\n</$importvariables>'), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "ZZ proj"}});
const pvc = doc.createElement("div"); pv.render(pvc);
let qbtn = null;
(function f(n){ if(qbtn||!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
  if(n.parseTreeNode && n.parseTreeNode.tag === "$button" && n.domNodes && n.domNodes[0] && ((n.domNodes[0].attributes||{}).class||"").indexOf("gsd-list-new-button")!==-1){ qbtn=n; return; }
  (n.children||[]).forEach(f); })(pv);
t("quick-add button rendered", !!qbtn);
// capture the tm-modal the button dispatches, to guard the resolved-caller forward itself
let modalParams = null;
const origDispatch = $tw.rootWidget.dispatchEvent.bind($tw.rootWidget);
$tw.rootWidget.dispatchEvent = function(ev) { if (ev.type === "tm-modal") modalParams = ev.paramObject; return origDispatch(ev); };
qbtn.invokeActions(qbtn, {type: "click"});
$tw.rootWidget.dispatchEvent = origDispatch;
t("button forwards the resolved caller to the modal", (modalParams && modalParams["gsd-calling-tiddler"]) === "ZZ proj", JSON.stringify(modalParams && modalParams["gsd-calling-tiddler"]));
t("button seeds the project on the data temp", (wiki.getTiddler("$:/temp/gsd-new-temp")||{fields:{}}).fields.gsd_project === "ZZ proj");

// 2. render the modal as tm-modal would, title typed, submit
wiki.addTiddler({title: "$:/temp/gsd-new-title", "hgsd-title": "ZZ inherit probe"});
const modal = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + '\n\n<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/new-gsd-modal" $mode="block"/>\n\n</$importvariables>'), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "$:/temp/gsd-new-state", "gsd-type": "action", "gsd-status": "next", "gsd-complete": "false", "gsd-project": "ZZ proj", "gsd-update-status": "no", "gsd-calling-tiddler": "ZZ proj"}});
const mc = doc.createElement("div"); modal.render(mc);
let cbtn = null;
(function f(n){ if(cbtn||!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
  if(n.parseTreeNode && n.parseTreeNode.tag === "$button" && n.domNodes && n.domNodes[0] && ((n.domNodes[0].attributes||{}).class||"").indexOf("gsd-new-modal-btn")!==-1){ cbtn=n; return; }
  (n.children||[]).forEach(f); })(modal);
t("modal Create button rendered", !!cbtn);
// fakeDOM lacks getBoundingClientRect on DOM nodes — patch the shared button prototype for the after-create navigate
Object.getPrototypeOf(cbtn).getBoundingClientRect = function() { return {top:0,left:0,bottom:1,right:1,width:1,height:1}; };
cbtn.invokeActionString("<<hgsd-modal-submit>>", cbtn, {type: "click"});

// 3. assertions on the created tiddler
const created = wiki.getTiddler("ZZ inherit probe");
const tags = (created && created.fields.tags) || [];
t("tiddler created", !!created);
t("type tag applied", tags.indexOf("$:/GSD/Action") !== -1, JSON.stringify(tags));
t("inherited context tag applied", tags.indexOf("ZZ ctx") !== -1, JSON.stringify(tags));
t("effective realm tag applied", tags.indexOf("$:/GSD/Realm/Home") !== -1, JSON.stringify(tags));
t("caller's second realm tag applied (rail harvest, not just the parameter seed)", tags.indexOf("$:/GSD/Realm/Work") !== -1, JSON.stringify(tags));
t("caller's informal tags applied through the forwarded caller", tags.indexOf("chess") !== -1 && tags.indexOf("ZZ person") !== -1, JSON.stringify(tags));
t("caller's system tags not inherited", tags.indexOf("$:/GSD/Project") === -1, JSON.stringify(tags));
t("project field applied", created && created.fields.gsd_project === "ZZ proj");

["ZZ inherit probe", "ZZ proj", "ZZ ctx", "ZZ person", "$:/state/hypergsd/effective-realm",
 "$:/temp/gsd-new-state", "$:/temp/gsd-new-temp", "$:/temp/gsd-new-title",
 "$:/state/hypergsd/create-another"].forEach(x => wiki.deleteTiddler(x));
console.log(fails === 0 ? "ALL CONTEXT-INHERIT CASES PASS" : fails + " FAILURE(S)");
process.exit(fails === 0 ? 0 : 1);