// Shadow-config trailing-newline regression: get[text] on a .tid shadow yields
// "true\n"; match[] is EXACT equality, so untrimmed comparisons always fail.
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-wiki"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;
wiki.addTiddler({title: "P active", tags: ["$:/GSD/Project"], gsd_status: "active"});
wiki.addTiddler({title: "P future", tags: ["$:/GSD/Project"], gsd_status: "future"});
wiki.addTiddler({title: "A under active", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_project: "P active"});
wiki.addTiddler({title: "B under future", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_project: "P future"});
wiki.addTiddler({title: "C no project", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false"});
wiki.addTiddler({title: "$:/state/hypergsd/current-realm", text: "NoRealm"});
const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';
const LF = "[tag[$:/GSD/Action]gsd_status[next]gsd_complete[false]] +[sort[title]]";
const render = (opts) => {
  const attrs = Object.entries(opts).map(([k, v]) => " " + k + '="' + v + '"').join("");
  const body = "<$hgsd.list list-heading=\"T\" list-filter=\"" + LF + "\"" + attrs + "/>";
  const parser = wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + body + "\n\n</$importvariables>");
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
  const c = doc.createElement("div"); w.render(c);
  const items = [], groups = [];
  (function f(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(f);
    if (n.isTiddlyWikiFakeDom) {
      if (n.attributes && n.attributes.href && (n.attributes.class || "").indexOf("gsd-list-item-title") !== -1)
        items.push(decodeURIComponent(n.attributes.href.replace(/^#\/?/, "")));
      if ((n.attributes && n.attributes.class || "").indexOf("hgsd-group-title") !== -1)
        groups.push(n.textContent);
      (n.children || []).forEach(f);
    }
  })(c);
  return {items: items.sort(), groups};
};
let fails = 0;
const t = (name, got, exp) => {
  const ok = JSON.stringify(got) === JSON.stringify(exp);
  if (!ok) fails++;
  console.log((ok ? "PASS " : "FAIL ") + name + " got:" + JSON.stringify(got));
};
t("shadow active-parents hides future-parented (dashboard case)",
  render({"active-parents-only": "yes", "group-by": "gsd_project", "group-state": "false"}).items,
  ["A under active", "C no project"]);
// Lint: with the trim[] guards gone, exact-match config reads depend on
// shipped shadows carrying no trailing newline in their TEXT field (the
// header ends at the blank line; only text swallows the file's final byte).
// Multids are line-based and exempt.
const path = require("path");
const fs = require("fs");
const configDirs = ["hypergsd", "hypergsd-contacts", "hypergsd-contexts", "hypergsd-ticklers", "hypergsd-trashbin"]
  .map(p => path.join(__dirname, "../plugins", p, "ui/config"));
const dirty = [];
for (const dir of configDirs) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".tid")) continue;
    const full = path.join(dir, f);
    const raw = fs.readFileSync(full, "utf8");
    const split = raw.indexOf("\n\n");
    const text = split === -1 ? "" : raw.slice(split + 2);
    if (text.endsWith("\n")) dirty.push(path.relative(path.join(__dirname, "../plugins"), full));
  }
}
t("shipped config shadows: no trailing newline in text fields", dirty, []);

// The trailing-newline group-state guard was removed 2026-09-05: config is
// dashboard-written (clean values) and shipped .tid files carry no trailing
// newlines (battery-linted), so exact matches need no trim[].
wiki.addTiddler({title: "P done", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "true"});
wiki.addTiddler({title: "D old under done", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "true", gsd_project: "P done", gsd_comp_date: "20260101000000000"});
wiki.addTiddler({title: "E old under active", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "true", gsd_project: "P active", gsd_comp_date: "20260101000000000"});
const condTxt = (src) => {
  const parser = wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + src + "\n\n</$importvariables>");
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c);
  return c.textContent;
};
t("preserve-action shadow=true takes preserve branch",
  condTxt("<%if [title[$:/config/hypergsd/preserve-action]get[text]else[true]trim[]match[true]] %>BRANCH-PRESERVE<%else%>BRANCH-PLAIN<%endif%>"),
  "BRANCH-PRESERVE");
console.log(fails === 0 ? "ALL SHADOW-NEWLINE CASES PASS" : fails + " FAILURE(S)");