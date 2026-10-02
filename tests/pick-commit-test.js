// Instant-commit picker (modules/widgets/hgsd-pick): firing the select's
// change event must commit the pick through hgsd-pick-commit when the gates
// pass (commit-kind given, setting on, pointer fine) and must not when any
// gate fails. Covers all three commit kinds — field (pick-field both states,
// panel + modal drafting), append (prereq section), append-to-picked
// (dependants section) — plus blank-pick no-ops and the select content model.
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-wiki"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;
const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';

wiki.addTiddler({title: "ZZ host", tags: ["$:/GSD/Action"], gsd_complete: "false"});
wiki.addTiddler({title: "ZZ other", tags: ["$:/GSD/Action"], gsd_complete: "false"});
wiki.addTiddler({title: "ZZ third", tags: ["$:/GSD/Action"], gsd_complete: "false"});
wiki.addTiddler({title: "ZZ proj one", tags: ["$:/GSD/Project"], gsd_complete: "false"});

let fails = 0;
const t = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + name + (ok ? "" : " got:" + JSON.stringify(got))); };
const field = (title, f) => (wiki.getTiddler(title) ? wiki.getTiddler(title).fields[f] : undefined);
const listOf = (title, f) => wiki.getTiddlerList(title, f);

const render = (inner, currentTiddler) => {
  const parser = wiki.parseText("text/vnd.tiddlywiki", G + '\n\n<$tiddler tiddler="' + currentTiddler + '">' + inner + "</$tiddler>\n\n</$importvariables>");
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c);
  return {c, w};
};
const findSelect = w => { let hit = null; (function f(n) { if (hit || !n || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(f);
  if (n.domNodes && n.domNodes[0] && n.domNodes[0].tag === "select") { hit = n; return; } (n.children || []).forEach(f); })(w); return hit; };
const pick = (sw, value) => { sw.domNodes[0].value = value; sw.handleChangeEvent({}); };
// render a picker with its popup pre-opened (the reveal only constructs the select while open)
const openPicker = (inner, currentTiddler, popTitle) => {
  wiki.addTiddler({title: popTitle, text: "(0,0,0,0)"});
  const r = render(inner, currentTiddler);
  const sw = findSelect(r.w);
  if (!sw) throw new Error("no select rendered for " + popTitle);
  return sw;
};
const cleanup = ["ZZ host", "ZZ other", "ZZ third", "ZZ proj one", "$:/temp/gsd-new-temp",
  "$:/temp/hypergsd/add-t1-ZZ host", "$:/temp/hypergsd/add-prereq-ZZ host", "$:/temp/hypergsd/add-dependant-ZZ host",
  "$:/temp/hypergsd/add-project-$:/temp/gsd-new-temp", "$:/state/hypergsd/edit-gsd_project-$:/temp/gsd-new-temp",
  "$:/state/popup/pick-t1-ZZ host", "$:/state/popup/pick-prereq-ZZ host", "$:/state/popup/pick-dependant-ZZ host",
  "$:/state/popup/pick-project-ZZ modal host", "$:/info/browser/pointer-coarse", "$:/config/hypergsd/picker-instant-commit/fine", "$:/config/hypergsd/picker-instant-commit/coarse"];

// --- field kind: instant set on pick, pick retained (matches Save), popup closed
{
  const sw = openPicker('<$hgsd.pick tiddler="$:/temp/hypergsd/add-t1-ZZ host" list-filter="[tag[$:/GSD/Project]]" id="t1" commit-kind="field" commit-tiddler="ZZ host" commit-field="gsd_project"/>',
    "ZZ host", "$:/state/popup/pick-t1-ZZ host");
  const childTags = (sw.domNodes[0].children || []).map(n => n.tag);
  pick(sw, "ZZ proj one");
  t("field: pick commits the target field immediately", field("ZZ host", "gsd_project"), "ZZ proj one");
  t("field: pick temp retains the pick (Save semantics, Change-button clears)", field("$:/temp/hypergsd/add-t1-ZZ host", "hgsd-pick"), "ZZ proj one");
  t("field: popup closed by the actions", wiki.getTiddlerText("$:/state/popup/pick-t1-ZZ host"), "");
  t("field: select children remain options only (content model)", childTags.every(x => x === "option"), true);
}

// --- coarse pointer: infill only, no commit
{
  wiki.addTiddler({title: "$:/info/browser/pointer-coarse", text: "yes"});
  wiki.deleteTiddler("ZZ host"); wiki.addTiddler({title: "ZZ host", tags: ["$:/GSD/Action"], gsd_complete: "false"});
  const sw = openPicker('<$hgsd.pick tiddler="$:/temp/hypergsd/add-t1-ZZ host" list-filter="[tag[$:/GSD/Project]]" id="t1" commit-kind="field" commit-tiddler="ZZ host" commit-field="gsd_project"/>',
    "ZZ host", "$:/state/popup/pick-t1-ZZ host");
  pick(sw, "ZZ proj one");
  t("coarse: target untouched", field("ZZ host", "gsd_project"), undefined);
  t("coarse: pick retained for the Add step", field("$:/temp/hypergsd/add-t1-ZZ host", "hgsd-pick"), "ZZ proj one");
  t("coarse: popup still closes", wiki.getTiddlerText("$:/state/popup/pick-t1-ZZ host"), "");
  wiki.deleteTiddler("$:/info/browser/pointer-coarse");
}

// --- coarse pointer with the coarse setting on: commits (the per-pointer split)
{
  wiki.addTiddler({title: "$:/info/browser/pointer-coarse", text: "yes"});
  wiki.addTiddler({title: "$:/config/hypergsd/picker-instant-commit/coarse", text: "true"});
  wiki.deleteTiddler("ZZ host"); wiki.addTiddler({title: "ZZ host", tags: ["$:/GSD/Action"], gsd_complete: "false"});
  wiki.deleteTiddler("$:/temp/hypergsd/add-t1-ZZ host");
  const sw = openPicker('<$hgsd.pick tiddler="$:/temp/hypergsd/add-t1-ZZ host" list-filter="[tag[$:/GSD/Project]]" id="t1" commit-kind="field" commit-tiddler="ZZ host" commit-field="gsd_project"/>',
    "ZZ host", "$:/state/popup/pick-t1-ZZ host");
  pick(sw, "ZZ proj one");
  t("coarse + coarse setting on: target committed", field("ZZ host", "gsd_project"), "ZZ proj one");
  t("coarse + coarse setting on: pick temp retains the pick", field("$:/temp/hypergsd/add-t1-ZZ host", "hgsd-pick"), "ZZ proj one");
  wiki.deleteTiddler("$:/config/hypergsd/picker-instant-commit/coarse");
  wiki.deleteTiddler("$:/info/browser/pointer-coarse");
}

// --- fine setting off: no commit even with a fine pointer
{
  wiki.addTiddler({title: "$:/config/hypergsd/picker-instant-commit/fine", text: "false"});
  wiki.deleteTiddler("ZZ host"); wiki.addTiddler({title: "ZZ host", tags: ["$:/GSD/Action"], gsd_complete: "false"});
  wiki.deleteTiddler("$:/temp/hypergsd/add-t1-ZZ host");
  const sw = openPicker('<$hgsd.pick tiddler="$:/temp/hypergsd/add-t1-ZZ host" list-filter="[tag[$:/GSD/Project]]" id="t1" commit-kind="field" commit-tiddler="ZZ host" commit-field="gsd_project"/>',
    "ZZ host", "$:/state/popup/pick-t1-ZZ host");
  pick(sw, "ZZ proj one");
  t("setting off: target untouched", field("ZZ host", "gsd_project"), undefined);
  t("setting off: pick retained", field("$:/temp/hypergsd/add-t1-ZZ host", "hgsd-pick"), "ZZ proj one");
  wiki.deleteTiddler("$:/config/hypergsd/picker-instant-commit/fine"); // shadow default true returns
}

// --- defaults (fine on, coarse off) + raw picker without commit params: no commit machinery at all
{
  t("default: fine setting shadow is on", wiki.getTiddlerText("$:/config/hypergsd/picker-instant-commit/fine"), "true");
  t("default: coarse setting shadow is off", wiki.getTiddlerText("$:/config/hypergsd/picker-instant-commit/coarse"), "false");
  wiki.deleteTiddler("ZZ host"); wiki.addTiddler({title: "ZZ host", tags: ["$:/GSD/Action"], gsd_complete: "false"});
  wiki.deleteTiddler("$:/temp/hypergsd/add-t1-ZZ host");
  const sw = openPicker('<$hgsd.pick tiddler="$:/temp/hypergsd/add-t1-ZZ host" list-filter="[tag[$:/GSD/Project]]" id="t1"/>',
    "ZZ host", "$:/state/popup/pick-t1-ZZ host");
  pick(sw, "ZZ proj one");
  t("raw pick: no commit-kind means infill only", [field("ZZ host", "gsd_project"), field("$:/temp/hypergsd/add-t1-ZZ host", "hgsd-pick")], [undefined, "ZZ proj one"]);
}

// --- append kind: the real prereq section appends and blanks the temp
{
  const sw = openPicker('<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/panel/prereq" $mode="block"/>',
    "ZZ host", "$:/state/popup/pick-prereq-ZZ host");
  pick(sw, "ZZ other");
  t("append: prerequisites gain the pick", listOf("ZZ host", "gsd_prerequisites"), ["ZZ other"]);
  t("append: pick temp blanked (Add-button semantics)", String(field("$:/temp/hypergsd/add-prereq-ZZ host", "pick") || ""), "");
  pick(sw, ""); // the none option: a blank pick must be a no-op
  t("append: blank pick is a no-op", listOf("ZZ host", "gsd_prerequisites"), ["ZZ other"]);
}

// --- append-to-picked: the real dependants section writes the OTHER side
{
  const sw = openPicker('<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/panel/dependants" $mode="block"/>',
    "ZZ host", "$:/state/popup/pick-dependant-ZZ host");
  pick(sw, "ZZ third");
  t("append-to-picked: picked action gains the viewing title", listOf("ZZ third", "gsd_prerequisites"), ["ZZ host"]);
  t("append-to-picked: viewing action untouched", listOf("ZZ host", "gsd_prerequisites"), ["ZZ other"]);
  t("append-to-picked: pick temp blanked", String(field("$:/temp/hypergsd/add-dependant-ZZ host", "pick") || ""), "");
  pick(sw, "");
  t("append-to-picked: blank pick never self-appends", listOf("ZZ host", "gsd_prerequisites"), ["ZZ other"]);
}

// --- pick-field (project/contact control): empty state, panel-style target
{
  wiki.deleteTiddler("ZZ host"); wiki.addTiddler({title: "ZZ host", tags: ["$:/GSD/Action"], gsd_complete: "false"});
  wiki.deleteTiddler("$:/temp/hypergsd/add-project-ZZ host");
  wiki.addTiddler({title: "$:/state/popup/pick-project-ZZ host", text: "(0,0,0,0)"});
  const r = render('<$hgsd.pick-field tiddler="ZZ host" field="gsd_project" list-filter="[tag[$:/GSD/Project]]" id="project"/>', "ZZ host");
  const sw = findSelect(r.w);
  pick(sw, "ZZ proj one");
  t("pick-field empty: pick sets the field", field("ZZ host", "gsd_project"), "ZZ proj one");
}

// --- pick-field: editing state also clears the edit-mode state
{
  wiki.deleteTiddler("$:/temp/hypergsd/add-project-$:/temp/gsd-new-temp");
  wiki.addTiddler({title: "$:/temp/gsd-new-temp", gsd_project: "ZZ proj one"});
  wiki.addTiddler({title: "$:/state/hypergsd/edit-gsd_project-$:/temp/gsd-new-temp", text: "yes"});
  wiki.addTiddler({title: "$:/state/popup/pick-project-ZZ modal host", text: "(0,0,0,0)"});
  const r = render('<$hgsd.pick-field tiddler="$:/temp/gsd-new-temp" field="gsd_project" list-filter="[tag[$:/GSD/Project]]" id="project"/>', "ZZ modal host");
  const sw = findSelect(r.w);
  pick(sw, "ZZ proj one");
  t("pick-field editing (modal drafting): pick re-drafts the temp field", field("$:/temp/gsd-new-temp", "gsd_project"), "ZZ proj one");
  t("pick-field editing: edit-mode state cleared (Save semantics)", wiki.getTiddlerText("$:/state/hypergsd/edit-gsd_project-$:/temp/gsd-new-temp"), "");
}

cleanup.forEach(x => wiki.deleteTiddler(x));
console.log(fails === 0 ? "ALL PICK-COMMIT CASES PASS" : fails + " FAILURE(S)");
process.exit(fails === 0 ? 0 : 1);