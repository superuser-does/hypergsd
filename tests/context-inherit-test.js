// The modal's context behaviour, both halves through the real submit path:
// (1) creation inheritance — the new-button forwards the RESOLVED caller
// (explicit parameter else currentTiddler) into tm-modal, and the Inheritance
// rail harvests it directly at creation: the context rule takes the caller's
// context tags, the realm rule every caller realm tag (not just the parameter
// seed), informal-tags every non-system tag; system tags never leak.
// Panel/list quick-adds and pick-field opens behave identically.
// (2) the context section as a multi-pick — $hgsd.pick-append appends into
// new-state's gsd_context LIST (the Add button; the dropdown's instant commit
// and Enter ride the family's own dispatchers), the <<tag>> pills strip from
// the list through their × button, create-and-add appends the created title,
// the plain new fallback self-suppresses in the modal host (hgsd-new-fallback's
// ambient section-mode gate), and the Inheritance rule enlists the list at
// submit — every picked context becomes a tag on the created tiddler.
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-wiki"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;
const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';
let fails = 0;
const t = (name, ok, extra) => { if (Array.isArray(ok)) ok = JSON.stringify(ok) === JSON.stringify(extra); if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + name + (ok || !extra ? "" : " " + extra)); };

const PICK_TEMP = "$:/temp/hypergsd/add-context-$:/temp/gsd-new-state";
const picked = () => wiki.filterTiddlers("[[$:/temp/gsd-new-state]get[gsd_context]enlist-input[]]");
const renderModal = (vars) => {
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + '\n\n<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/new-gsd-modal" $mode="block" />\n\n</$importvariables>'), {document: doc, parentWidget: $tw.rootWidget, variables: Object.assign({currentTiddler: "$:/temp/gsd-new-state", "gsd-type": "action", "gsd-status": "next", "gsd-complete": "false", "gsd-update-status": "no", "gsd-calling-tiddler": ""}, vars)});
  const c = doc.createElement("div"); w.render(c);
  return {w, c};
};
const findAll = (root, pred, acc) => { acc = acc || []; (function f(n){ if(!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
  if(pred(n))acc.push(n); (n.children||[]).forEach(f); })(root); return acc; };
const pillNode = root => findAll(root, n => n.isTiddlyWikiFakeDom && n.attributes && n.attributes["data-tag-title"] !== undefined);
const buttonsWithText = (root, text) => findAll(root, n => n.parseTreeNode && n.parseTreeNode.tag === "$button" && n.domNodes && n.domNodes[0] && (n.domNodes[0].textContent || "").indexOf(text) !== -1);

wiki.addTiddler({title: "ZZ ctx", tags: ["GSD/Contexts"]});
wiki.addTiddler({title: "ZZ person", tags: ["GSD/Contact"]});
wiki.addTiddler({title: "ZZ proj", tags: ["$:/GSD/Project", "$:/GSD/Realm/Home", "$:/GSD/Realm/Work", "ZZ ctx", "ZZ person", "chess"], gsd_status: "active", gsd_complete: "false"});
wiki.addTiddler({title: "ZZ alpha", tags: ["GSD/Contexts"]});
wiki.addTiddler({title: "ZZ beta", tags: ["GSD/Contexts"]});
wiki.addTiddler({title: "$:/state/hypergsd/effective-realm", text: "Home"});

// 1. fire the project view's quick-add button (context inheritance seed)
const pv = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + '\n\n<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/ViewTemplate/view-body-project" $mode="block" />\n\n</$importvariables>'), {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "ZZ proj"}});
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
let m = renderModal({"gsd-calling-tiddler": "ZZ proj", "gsd-project": "ZZ proj"});
const cbtn = findAll(m.w, n => n.parseTreeNode && n.parseTreeNode.tag === "$button" && n.domNodes && ((n.domNodes[0].attributes||{}).class||"").indexOf("gsd-new-modal-btn")!==-1)[0];
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

// 4. the context section's empty state: the pick-append draft input renders, no pills, no plain new fallback
m = renderModal();
t("pick-append drafts on the state-suffixed temp", findAll(m.w, n => n.parseTreeNode && n.parseTreeNode.tag === "$edit-text" && n.getAttribute && n.getAttribute("tiddler") === PICK_TEMP).length === 1);
t("no pills while nothing is picked", pillNode(m.c).length === 0);
t("no plain new fallback in the modal host (ambient section-mode gate)", findAll(m.c, n => n.isTiddlyWikiFakeDom && n.attributes && ((n.attributes["class"] || "") + "").indexOf("hgsd-new-hint") !== -1).length === 0);

// 5. Add button appends an existing context
wiki.addTiddler({title: PICK_TEMP, "hgsd-pick": "ZZ alpha"});
m = renderModal();
const addBtn = buttonsWithText(m.w, "add").filter(b => (b.domNodes[0].textContent || "") === "add")[0];
t("Add button rendered for an existing pick", !!addBtn);
addBtn.invokeActions(addBtn, {type: "click"});
t("Add appends into the gsd_context list", picked(), ["ZZ alpha"]);
t("pick temp blanked after the append", (wiki.getTiddler(PICK_TEMP) || {fields: {}}).fields["hgsd-pick"] === "");

// 6. the pill renders and its × strips the list
m = renderModal();
t("picked context renders as a tag pill", pillNode(m.c).map(n => n.attributes["data-tag-title"]), ["ZZ alpha"]);
const clearBtn = findAll(m.w, n => n.parseTreeNode && n.parseTreeNode.tag === "$button" && n.domNodes && ((n.domNodes[0].attributes || {}).class || "").indexOf("hgsd-clear-button") !== -1)[0];
t("removal × rendered on the entry", !!clearBtn);
clearBtn.invokeActions(clearBtn, {type: "click"});
t("× strips the context from the list", picked(), []);

// 7. create-and-add appends the created title
wiki.addTiddler({title: PICK_TEMP, "hgsd-pick": "ZZ fresh context"});
m = renderModal();
const createBtn = buttonsWithText(m.w, "and add")[0];
t("create-and-add rendered for an unknown pick", !!createBtn);
createBtn.invokeActions(createBtn, {type: "click"});
t("created context carries the context family tag", ((wiki.getTiddler("ZZ fresh context") || {fields: {}}).fields.tags || []).indexOf("GSD/Contexts") !== -1);
t("created context appended to the list", picked(), ["ZZ fresh context"]);

// 8. a second context joins the list
wiki.addTiddler({title: PICK_TEMP, "hgsd-pick": "ZZ alpha"});
m = renderModal();
buttonsWithText(m.w, "add").filter(b => (b.domNodes[0].textContent || "") === "add")[0].invokeActions(m.w, {type: "click"});
t("second context appended", picked(), ["ZZ fresh context", "ZZ alpha"]);

// 10. live refresh: the modal's $refresh gate must admit BOTH picker draft families while typing (a run-level :and intersects the whole accumulated output, so a second scoped add- pair mid-list starves the data-temp drafts — create buttons only appeared after an outside click; the add- run is one unscoped prefix)
const PROJECT_PICK_TEMP = "$:/temp/hypergsd/add-project-$:/temp/gsd-new-temp";
const createAndAddFor = (root, name) => findAll(root, n => n.parseTreeNode && n.parseTreeNode.tag === "$button" && n.domNodes && n.domNodes[0] && (n.domNodes[0].textContent || "").indexOf(name) !== -1 && (n.domNodes[0].textContent || "").indexOf("and add") !== -1).length;
let m10 = renderModal();
t("no create-and-add while nothing is drafted", createAndAddFor(m10.w, "and add") === 0, true);
wiki.addTiddler({title: PROJECT_PICK_TEMP, "hgsd-pick": "ZZ unplanned project"});
m10.w.refresh({[PROJECT_PICK_TEMP]: {modified: true}});
t("project draft (data temp) live-renders its create-and-add", createAndAddFor(m10.w, "ZZ unplanned project") === 1, true);
wiki.addTiddler({title: PICK_TEMP, "hgsd-pick": "ZZ live ctx"});
m10.w.refresh({[PICK_TEMP]: {modified: true}});
t("context draft (state temp) live-renders its create-and-add", createAndAddFor(m10.w, "ZZ live ctx") === 1, true);
wiki.deleteTiddler(PROJECT_PICK_TEMP);

// 9. submit stamps every picked context as a tag
wiki.addTiddler({title: "$:/temp/gsd-new-title", "hgsd-title": "ZZ multi probe"});
m = renderModal();
const cbtn2 = findAll(m.w, n => n.parseTreeNode && n.parseTreeNode.tag === "$button" && n.domNodes && ((n.domNodes[0].attributes||{}).class||"").indexOf("gsd-new-modal-btn")!==-1)[0];
cbtn2.invokeActionString("<<hgsd-modal-submit>>", cbtn2, {type: "click"});
const created2 = wiki.getTiddler("ZZ multi probe");
const tags2 = (created2 && created2.fields.tags) || [];
t("tiddler created on submit", !!created2);
t("first picked context applied as a tag", tags2.indexOf("ZZ fresh context") !== -1, JSON.stringify(tags2));
t("second picked context applied as a tag", tags2.indexOf("ZZ alpha") !== -1, JSON.stringify(tags2));
t("unpicked context not applied", tags2.indexOf("ZZ beta") === -1, JSON.stringify(tags2));

["ZZ inherit probe", "ZZ multi probe", "ZZ fresh context", "ZZ alpha", "ZZ beta", "ZZ proj", "ZZ ctx", "ZZ person", PICK_TEMP,
 "$:/state/hypergsd/effective-realm", "$:/temp/gsd-new-state", "$:/temp/gsd-new-temp", "$:/temp/gsd-new-title",
 "$:/state/hypergsd/create-another"].forEach(x => wiki.deleteTiddler(x));
console.log(fails === 0 ? "ALL CONTEXT-INHERIT CASES PASS" : fails + " FAILURE(S)");
process.exit(fails === 0 ? 0 : 1);
