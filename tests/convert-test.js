// Convert confirmation: message composition, accept/decline, conversion fields.
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-wiki"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;

const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';
let strays = 0;
const mkHost = (title, extra) => wiki.addTiddler(Object.assign(
  {title, tags: ["$:/GSD/Action", "$:/GSD/Realm/Home"], gsd_status: "next", gsd_complete: "false"}, extra || {}));

const runConvert = (host, accept) => {
  let message = "(no dialog)";
  const src = G + '\n\n<$hgsd.convert current-status={{!!gsd_status}} tooltip="Convert Action to Project"/>\n\n</$importvariables>';
  const p = wiki.parseText("text/vnd.tiddlywiki", src);
  const w = wiki.makeWidget(p, {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: host}});
  const c = doc.createElement("div"); w.render(c);
  (function f(n){ if(!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
    if(n.isTiddlyWikiFakeDom) return (n.children||[]).forEach(f);
    if((n.textContent||"").trim()===">") strays++; })(c);
  let btn = null;
  (function f(n){ if(!n||btn||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
    const pt = n.parseTreeNode;
    if(pt && pt.tag === "$button" && (pt.children||[]).some(x => x.tag === "$action-confirm")) { btn = n; return; }
    (n.children||[]).forEach(f); })(w.children);
  if (!btn) return {found: false};
  btn.invokeActions(btn, {type: "click", event: {view: {confirm: m => { message = m; return accept; }}}});
  return {found: true, message};
};
let fails = 0;
const t = (name, ok, extra) => { if (Array.isArray(ok)) ok = JSON.stringify(ok) === JSON.stringify(extra); if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + name + (ok || extra === undefined ? "" : " " + extra)); };

// a) plain action: message is just the base question; accept converts; decline does not
mkHost("Plain action", {});
let r = runConvert("Plain action", true);
t("plain: base message only", r.found && r.message === "Convert this action into a project?", JSON.stringify(r.message));
let f1 = wiki.getTiddler("Plain action").fields;
t("plain: accept converts (project tag, active)",
  f1.tags.indexOf("$:/GSD/Project") !== -1 && f1.tags.indexOf("$:/GSD/Action") === -1
  && f1.gsd_status === "active" && f1.gsd_contact === undefined,
  JSON.stringify({tags: f1.tags, status: f1.gsd_status}));

mkHost("Plain two", {});
r = runConvert("Plain two", false);
t("plain: decline leaves the action untouched",
  wiki.getTiddler("Plain two").fields.tags.indexOf("$:/GSD/Action") !== -1
  && wiki.getTiddler("Plain two").fields.tags.indexOf("$:/GSD/Project") === -1);

// b) prereq-of-another + contact: message carries both warnings; contact survives
mkHost("Wanted dep", {});
mkHost("Dependable action", {gsd_contact: "Alice", gsd_prerequisites: []});
wiki.addTiddler({title: "Dependable action", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_contact: "Alice", gsd_prerequisites: []});
wiki.addTiddler({title: "Depender action", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_prerequisites: "[[Dependable action]]"});
r = runConvert("Dependable action", true);
t("both warnings present", r.found
  && r.message.indexOf("\nOther actions depend on this action as a pre-requisite") !== -1
  && r.message.indexOf("\nThe contact field will be kept") !== -1
  && r.message.indexOf("Convert this action into a project?") === 0,
  JSON.stringify(r.message));
t("converted keeps contact field", wiki.getTiddler("Dependable action").fields.gsd_contact === "Alice");

// c) contact only: prereq warning absent
mkHost("Chatty action", {gsd_contact: "Bob"});
r = runConvert("Chatty action", true);
t("contact-only warning (no prereq warning)", r.found
  && r.message.indexOf("\nThe contact field will be kept") !== -1
  && r.message.indexOf("Other actions depend") === -1,
  JSON.stringify(r.message));

// d) waiting action converts to future, not active
mkHost("Waiting action", {gsd_status: "waiting"});
runConvert("Waiting action", true);
t("waiting converts to future", wiki.getTiddler("Waiting action").fields.gsd_status === "future");

// e) own prerequisites: the warning fires while the field is still set; decline keeps it, accept clears it
mkHost("Earlier action", {});
mkHost("Chained action", {gsd_prerequisites: "[[Earlier action]]"});
r = runConvert("Chained action", false);
t("own-prereq warning present, no dependants warning, decline keeps the field", r.found
  && r.message.indexOf("\nThis action still has pre-requisites, which will be cleared when it becomes a project.") !== -1
  && r.message.indexOf("Other actions depend") === -1
  && wiki.getTiddler("Chained action").fields.gsd_prerequisites === "[[Earlier action]]",
  JSON.stringify(r.message));
runConvert("Chained action", true);
t("own-prereq: accept clears the field", wiki.getTiddler("Chained action").fields.gsd_prerequisites === "");

console.log(fails === 0 ? "ALL CONVERT CASES PASS" : fails + " FAILURES");
console.log(strays === 0 ? "STRAY GUARD: 0 across all renders" : "STRAY GUARD FAILED: " + strays);
process.exit(fails === 0 && strays === 0 ? 0 : 1);