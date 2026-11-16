// Title-warning typing-loop baseline: the surfaces a bad-character warning would
// ride (modal title row, prereq pick-append row, project pick-field row), plus
// construct costs (the warning gate must be zero-cost on cold rows).
// Scratch copy of the proposed tests/title-warning-bench.js — run BEFORE and AFTER.
"use strict";
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true;
$tw.boot.argv = [__dirname + "/fixture-wiki"];
$tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;

const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';
const REPS = 30;
const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const fmt = ms => ms.toFixed(3) + " ms";

// fixture: one action with a project, on a realistic page
wiki.addTiddler({title: "ZZB P1", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "false"});
wiki.addTiddler({title: "ZZB A1", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_project: "ZZB P1"});
for (let i = 1; i <= 40; i++)
  wiki.addTiddler({title: "ZZB dep " + i, tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_project: "ZZB P1"});

const makeView = () => {
  const body = wiki.parseText("text/vnd.tiddlywiki", G + '\n\n<$tiddler tiddler="ZZB A1"><$transclude $tiddler="$:/plugins/yan/hypergsd/ui/ViewTemplate/view-body" $mode="block" /></$tiddler>\n\n</$importvariables>');
  return wiki.makeWidget(body, {document: doc, parentWidget: $tw.rootWidget});
};
const makeModal = () => {
  const body = wiki.parseText("text/vnd.tiddlywiki", G + '\n\n<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/new-gsd-modal" $mode="block" />\n\n</$importvariables>');
  return wiki.makeWidget(body, {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "$:/temp/gsd-new-state", "gsd-type": "action", "gsd-status": "next", "gsd-complete": "false", "gsd-update-status": "no", "gsd-calling-tiddler": ""}});
};

const results = {};
const timeConstruct = (name, make) => {
  const times = [];
  for (let i = 0; i < REPS; i++) {
    const c = doc.createElement("div");
    const t0 = process.hrtime.bigint();
    const w = make();
    w.render(c);
    times.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  results[name] = median(times);
  console.log("  " + name + ": median " + fmt(results[name]));
};
const timeTyping = (name, make, tempTitle, tempField) => {
  const c = doc.createElement("div");
  const w = make();
  w.render(c);
  const times = [];
  for (let i = 0; i < REPS; i++) {
    const value = (i % 2 ? "ZZB new dep [" : "ZZB new dep ") + i;
    const t0 = process.hrtime.bigint();
    wiki.addTiddler(new $tw.Tiddler(wiki.getTiddler(tempTitle) || {title: tempTitle}, {[tempField]: value}));
    w.refresh({[tempTitle]: {title: tempTitle}});
    times.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  results[name] = median(times);
  console.log("  " + name + ": median " + fmt(results[name]));
};

console.log("title-warning baseline (" + new Date().toISOString().slice(0, 10) + ")");
timeConstruct("action view construct (panel host)", makeView);
timeConstruct("new-item modal construct", makeModal);
timeTyping("modal title typing loop (hgsd-title)", makeModal, "$:/temp/gsd-new-title", "hgsd-title");
timeTyping("prereq pick-append typing loop (hgsd-pick)", makeView, "$:/temp/hypergsd/add-prereq-ZZB A1", "hgsd-pick");
timeTyping("project pick-field typing loop (hgsd-pick)", makeView, "$:/temp/hypergsd/add-project-ZZB A1", "hgsd-pick");
console.log(JSON.stringify(results, null, 1));
