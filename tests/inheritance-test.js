// Inheritance rules ($:/tags/hypergsd/Inheritance): the informal-tags default
// (caller's non-system tags flow onto a new item created from its panel; blank
// caller = toolbar/sidebar = nothing inherited; $:/-prefixed tags never leak),
// the contact field's validation, and the removal contract (untag a member
// override and the plain tag scan drops it — the shipped rule is a shadow).
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-wiki"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;
const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';
let fails = 0;
const t = (name, ok, extra) => { if (Array.isArray(ok)) ok = JSON.stringify(ok) === JSON.stringify(extra); if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + name + (ok || !extra ? "" : " " + extra)); };

const RULE_INFORMAL = "$:/plugins/yan/hypergsd/modules/inheritance/informal-tags";
const RULE_REALM = "$:/plugins/yan/hypergsd/modules/inheritance/realm";
const RULE_CONTACT = "$:/plugins/yan/hypergsd-contacts/modules/inheritance/contact-field";
const RULE_CONTEXT = "$:/plugins/yan/hypergsd-contexts/modules/inheritance/context-tags";

// members present in the fixture (all three plugins load there)
const members = wiki.filterTiddlers("[all[shadows+tiddlers]tag[$:/tags/hypergsd/Inheritance]!is[draft]]");
t("rail members: informal-tags, realm, context-tags", JSON.stringify(members.slice().sort()) === JSON.stringify([RULE_CONTEXT, RULE_INFORMAL, RULE_REALM]), JSON.stringify(members));

function submit(variables) {
  wiki.addTiddler({title: "$:/temp/gsd-new-title", "hgsd-title": "ZZ informal probe"});
  const modal = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki",
    G + '\n\n<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/new-gsd-modal" $mode="block"/>\n\n</$importvariables>'),
    {document: doc, parentWidget: $tw.rootWidget, variables: Object.assign({currentTiddler: "$:/temp/gsd-new-state"}, variables)});
  const c = doc.createElement("div"); modal.render(c);
  let btn = null;
  (function f(n){ if(btn||!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
    if(n.parseTreeNode && n.parseTreeNode.tag === "$button" && n.domNodes && n.domNodes[0] && ((n.domNodes[0].attributes||{}).class||"").indexOf("gsd-new-modal-btn")!==-1){ btn=n; return; }
    (n.children||[]).forEach(f); })(modal);
  if (!btn) throw new Error("submit button not found");
  // fakeDOM lacks getBoundingClientRect — the after-create navigate needs it
  Object.getPrototypeOf(btn).getBoundingClientRect = function() { return {top:0,left:0,bottom:1,right:1,width:1,height:1}; };
  btn.invokeActionString("<<hgsd-modal-submit>>", btn, {type: "click"});
  return wiki.getTiddler("ZZ informal probe");
}

// 1. informal tags: caller action carrying informal + system tags
wiki.addTiddler({title: "ZZ caller action", tags: ["$:/GSD/Action", "$:/GSD/Realm/Home", "chess", "work"], gsd_status: "next", gsd_complete: "false"});
wiki.addTiddler({title: "$:/state/hypergsd/effective-realm", text: "NoRealm"});
let created = submit({"gsd-type": "action", "gsd-status": "next", "gsd-complete": "false", "gsd-project": "", "gsd-update-status": "no", "gsd-calling-tiddler": "ZZ caller action"});
t("informal tags inherited", created && created.fields.tags.indexOf("chess") !== -1 && created.fields.tags.indexOf("work") !== -1, JSON.stringify(created && created.fields.tags));
t("caller type tag NOT inherited", created && created.fields.tags.indexOf("$:/GSD/Action") !== -1 && created.fields.tags.filter(function(x){return x === "$:/GSD/Action";}).length === 1, JSON.stringify(created && created.fields.tags));
t("caller realm tag inherited once (realm rule, not leak)", created && created.fields.tags.indexOf("$:/GSD/Realm/Home") !== -1 && created.fields.tags.indexOf("$:/GSD/Realm/Home") === created.fields.tags.lastIndexOf("$:/GSD/Realm/Home"), JSON.stringify(created && created.fields.tags));
t("no other system tags leaked", created && created.fields.tags.filter(function(x){return x.indexOf("$:/") === 0;}).join(",") === "$:/GSD/Action,$:/GSD/Realm/Home", JSON.stringify(created && created.fields.tags));

// 2. blank caller: toolbar-style, nothing informal inherited
wiki.deleteTiddler("ZZ informal probe");
created = submit({"gsd-type": "action", "gsd-status": "next", "gsd-complete": "false", "gsd-project": "", "gsd-update-status": "no", "gsd-calling-tiddler": ""});
t("blank caller inherits nothing informal", created && created.fields.tags.indexOf("chess") === -1 && created.fields.tags.indexOf("work") === -1, JSON.stringify(created && created.fields.tags));

// 3. valid contact carries through the temp pass-through (field values are the sections' responsibility)
wiki.deleteTiddler("ZZ informal probe");
wiki.addTiddler({title: "$:/temp/gsd-new-temp", "gsd_contact": "ZZ real contact"});
created = submit({"gsd-type": "action", "gsd-status": "next", "gsd-complete": "false", "gsd-project": "", "gsd-update-status": "no", "gsd-calling-tiddler": ""});
t("real contact kept as field", created && created.fields.gsd_contact === "ZZ real contact", JSON.stringify(created && created.fields.gsd_contact));

// 4. Settings kill switch: off stops informal inheritance only; realm rule unaffected
wiki.deleteTiddler("ZZ informal probe");
wiki.addTiddler({title: "$:/config/hypergsd/inherit-tags", text: "no"});
created = submit({"gsd-type": "action", "gsd-status": "next", "gsd-complete": "false", "gsd-project": "", "gsd-update-status": "no", "gsd-calling-tiddler": "ZZ caller action"});
t("kill switch stops informal inheritance", created && created.fields.tags.indexOf("chess") === -1, JSON.stringify(created && created.fields.tags));
t("kill switch leaves realm rule alone", created && created.fields.tags.indexOf("$:/GSD/Realm/Home") !== -1, JSON.stringify(created && created.fields.tags));
wiki.deleteTiddler("$:/config/hypergsd/inherit-tags"); // absent config = default on
wiki.deleteTiddler("ZZ informal probe");

// 5. removal contract: untagging the shipped rule (a user override without the tag) drops it from the rail
wiki.deleteTiddler("ZZ informal probe");
wiki.addTiddler({title: RULE_INFORMAL, tags: [], text: ""}); // user override supersedes the shadow, tag removed
created = submit({"gsd-type": "action", "gsd-status": "next", "gsd-complete": "false", "gsd-project": "", "gsd-update-status": "no", "gsd-calling-tiddler": "ZZ caller action"});
t("untagged rule no longer applies", created && created.fields.tags.indexOf("chess") === -1, JSON.stringify(created && created.fields.tags));
wiki.deleteTiddler(RULE_INFORMAL); // remove override; shadow returns
const membersAfter = wiki.filterTiddlers("[all[shadows+tiddlers]tag[$:/tags/hypergsd/Inheritance]!is[draft]]");
t("shadow rule returns after override deletion", membersAfter.indexOf(RULE_INFORMAL) !== -1, JSON.stringify(membersAfter));

console.log(fails === 0 ? "ALL PASS" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);