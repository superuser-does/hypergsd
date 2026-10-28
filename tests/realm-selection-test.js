// Realm set scoping: one state tiddler ($:/config/hypergsd/realm-selection, list
// field) = full realm tag titles + optional `no-realm` sentinel. Pristine
// (missing) = all realms + sentinel. Empty = nothing (sentinel may re-add
// realm-less items). Matrix over selection × sentinel, plus sidebar UI
// structure.
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-wiki"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;
wiki.addTiddler({title: "P one", tags: ["$:/GSD/Project"], gsd_status: "active"});
wiki.addTiddler({title: "W item", tags: ["$:/GSD/Action", "$:/GSD/Realm/Work"], gsd_status: "next", gsd_complete: "false", gsd_project: "P one"});
wiki.addTiddler({title: "H item", tags: ["$:/GSD/Action", "$:/GSD/Realm/Home"], gsd_status: "next", gsd_complete: "false", gsd_project: "P one"});
wiki.addTiddler({title: "N item", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_project: "P one"});
const SEL = "$:/config/hypergsd/realm-selection";
const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';
const LF = "[tag[$:/GSD/Action]gsd_status[next]gsd_complete[false]] +[sort[title]]";
const setSel = (list) => list === undefined ? wiki.deleteTiddler(SEL)
  : wiki.addTiddler({title: SEL, list: list.map(t => t === "no-realm" ? t : "$:/GSD/Realm/" + t)});
const render = () => {
  const body = '<$hgsd.list list-heading="T" list-filter="' + LF + '" group-state="false"/>';
  const parser = wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + body + "\n\n</$importvariables>");
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
  const c = doc.createElement("div"); w.render(c);
  const hrefs = [];
  (function f(n){ if(!n||typeof n!=="object") return; if(Array.isArray(n)) return n.forEach(f);
    if(n.isTiddlyWikiFakeDom) { if(n.tag === "a" && n.attributes && n.attributes.href && ((n.attributes.class||"").indexOf("gsd-list-item-title") !== -1)) hrefs.push(decodeURIComponent(n.attributes.href.replace(/^#\/?/, ""))); if(n.children) f(n.children); } })(c.children);
  return hrefs.sort();
};
let fails = 0;
const t = (name, got, exp) => { const ok = JSON.stringify(got) === JSON.stringify(exp); if(!ok) fails++; console.log((ok?"PASS ":"FAIL ") + name + " got:" + JSON.stringify(got)); };
const sentinel = "no-realm";

// core matrix
setSel(undefined);                        t("pristine (missing) = all + realmless", render(), ["H item","N item","W item"]);
setSel(["Work", sentinel]);               t("{Work}+sentinel = union mode", render(), ["N item","W item"]);
setSel(["Work","Home",sentinel]);         t("{Work,Home}+sentinel = multi-union (new)", render(), ["H item","N item","W item"]);
setSel(["Work"]);                         t("{Work} no sentinel = Work only", render(), ["W item"]);
setSel([]);                               t("empty = nothing", render(), []);
setSel([sentinel]);                       t("{}+sentinel = realmless only (old no-realm-only)", render(), ["N item"]);
setSel(["Work","Home"]);                  t("{Work,Home} no sentinel = realmed only (old exclude)", render(), ["H item","W item"]);

// pristine fallback embraces realms created later
setSel(undefined);
wiki.addTiddler({title: "L item", tags: ["$:/GSD/Action", "$:/GSD/Realm/Later"], gsd_status: "next", gsd_complete: "false", gsd_project: "P one"});
t("pristine picks up new realm live", render(), ["H item","L item","N item","W item"]);
wiki.deleteTiddler("L item");

// sidebar UI: buttons, per-realm checked states, sentinel box — and NO wikilink
// in the realm label even when a tiddler with the realm's short name exists
// (filtered transclusion linkifies existing titles; <$text> must not)
const sidebar = () => {
  const parser = wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + '<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/sidebar/review-sidebar" $mode="block"/>' + "\n\n</$importvariables>");
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c);
  return c;
};
wiki.addTiddler({title: "Home", text: "a plain tiddler named like the realm"});
setSel(["Home"]);
let sb = sidebar();
const labels = [];
let linksInLabels = 0;
(function f(n){ if(!n||typeof n!=="object") return; if(Array.isArray(n)) return n.forEach(f);
  if(n.isTiddlyWikiFakeDom) {
    if(n.tag === "input" && n.attributes.type === "checkbox") {
      labels.push((n.attributes.checked !== undefined ? "[x] " : "[ ] ") + (n.parentNode && n.parentNode.textContent || "").trim());
      if (n.parentNode && (n.parentNode.children || []).some(ch => ch.tag === "a")) linksInLabels++;
    }
    if(n.tag === "button") labels.push("BTN:" + (n.textContent || "").trim());
    (n.children||[]).forEach(f);
  } })(sb);
t("sidebar: 2 buttons + sentinel box first + 2 realm boxes (Home checked)", labels,
  ["BTN:all","BTN:none","[ ] Items not in a realm","[x] Home","[ ] Work"]);
t("sidebar: realm labels are not wikilinks", linksInLabels, 0);
// layout: the fieldset itself is a grid (single inline style) — legend row 1,
// one label per row, no <br>s, no separator text nodes between labels
const comp = (() => {
  const parser = wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + '<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/components/realm-selection" $mode="block"/>' + "\n\n</$importvariables>");
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c); return c;
})();
let brs = 0;
let fsNode = null;
(function f2(n){ if(!n||typeof n!=="object") return; if(Array.isArray(n)) return n.forEach(f2);
  if(n.isTiddlyWikiFakeDom) {
    if(n.tag === "br") brs++;
    if(n.tag === "fieldset" && !fsNode) fsNode = n;
    (n.children||[]).forEach(f2);
  } })((comp));
const elChildren = (fsNode && fsNode.children || []);
const tagSeq = elChildren.filter(ch => ch.isTiddlyWikiFakeDom && ch.tag).map(ch => ch.tag).join(",");
const labelTexts = elChildren.filter(ch => ch.isTiddlyWikiFakeDom && ch.tag === "label").map(l => (l.textContent || "").trim());
const nonElements = elChildren.filter(ch => !(ch.isTiddlyWikiFakeDom && ch.tag)).length;
t("component: grid fieldset, legend first, one label per row, no separators",
  [brs === 0, nonElements === 0, tagSeq, labelTexts,
   fsNode.attributes && fsNode.attributes.class === "hgsd-realm-fieldset",
   fsNode._style && fsNode._style.display === "grid"],   // fakedom routes style into _style, not attributes
  [true, true, "legend,label,label,label", ["Items not in a realm", "Home", "Work"], true, true]);
wiki.deleteTiddler("Home");
// ── Cross-realm link warning (globe = linked tiddler outside the selection) ──
const warnSvg = title => {
  const parser = wiki.parseText("text/vnd.tiddlywiki", G + '\n\n<$transclude $variable="hgsd-realm-warning" linked-tiddler="' + title + '"/>\n\n</$importvariables>');
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c);
  let globes = 0;
  (function f(n){ if(!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
    if(n.isTiddlyWikiFakeDom) { if(n.tag === "svg") globes++; if(n.children) f(n.children); } })(c.children);
  return globes;
};
setSel(undefined);
t("warning: pristine selection, no globes", [warnSvg("W item"), warnSvg("H item"), warnSvg("N item")], [0, 0, 0]);
setSel(["Work", sentinel]);
t("warning: Work+sentinel, globe only for the Home link", [warnSvg("W item"), warnSvg("H item"), warnSvg("N item")], [0, 1, 0]);
setSel(["Work"]);
t("warning: Work only, globes for Home and the realmless link", [warnSvg("H item"), warnSvg("N item")], [1, 1]);
setSel(["Work", sentinel]);
wiki.addTiddler({title: "$:/config/hypergsd/realm-warning", text: "hide"});
t("warning: config hide turns every surface off", warnSvg("H item"), 0);
wiki.deleteTiddler("$:/config/hypergsd/realm-warning");
t("warning: empty linked renders nothing", warnSvg(""), 0);
setSel(undefined);
wiki.deleteTiddler("R ref");
wiki.deleteTiddler("P out");
setSel(undefined);

// ── Row globes via hgsd-item (Row/Suffix fragment; spans counted, rows carry other svgs) ──
const rowGlobes = title => {
  const src = '<$tiddler tiddler="' + title + '"><<hgsd-item>></$tiddler>';
  const parser = wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + src + "\n\n</$importvariables>");
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c);
  let n = 0;
  (function f(x){ if(!x||typeof x!=="object")return; if(Array.isArray(x))return x.forEach(f);
    if(x.isTiddlyWikiFakeDom) { if(x.tag === "span" && x.attributes && x.attributes.class === "hgsd-realm-warning") n++; (x.children||[]).forEach(f); } })(c.children);
  return n;
};
setSel(["Work"]);
t("row globe: realmless item under Work-only selection", rowGlobes("N item"), 1);
t("row globe: selected-realm item has none", rowGlobes("W item"), 0);
t("row globe: other-realm item is outside the selection", rowGlobes("H item"), 1);
setSel(["Work", sentinel]);
t("row globe: sentinel opt-in removes it", rowGlobes("N item"), 0);
setSel(["Work"]);
wiki.addTiddler({title: "$:/config/hypergsd/realm-warning", text: "hide"});
t("row globe: config hide removes it", rowGlobes("N item"), 0);
wiki.deleteTiddler("$:/config/hypergsd/realm-warning");
setSel(undefined);
t("row globe: pristine selection has none", rowGlobes("N item"), 0);

// ── Panel pick-field placement: globe between the value link and the change button ──
wiki.addTiddler({title: "P ord", tags: ["$:/GSD/Project"], gsd_status: "active"});
wiki.addTiddler({title: "A ord", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_project: "P ord"});
setSel(["Work"]);
const order = (() => {
  const src = '<$tiddler tiddler="A ord"><$let section-target="A ord" section-type="action" section-mode="panel"><$transclude $tiddler="$:/plugins/yan/hypergsd/ui/attributes/project" $mode="block"/></$let></$tiddler>';
  const parser = wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + src + "\n\n</$importvariables>");
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c);
  const seq = [];
  (function f(x){ if(!x||typeof x!=="object")return; if(Array.isArray(x))return x.forEach(f);
    if(x.isTiddlyWikiFakeDom) { if(x.tag === "a") seq.push("link");
      if(x.tag === "span" && x.attributes && x.attributes.class === "hgsd-realm-warning") seq.push("globe");
      if(x.tag === "button") seq.push("button"); (x.children||[]).forEach(f); } })(c.children);
  return seq;
})();
t("panel order: link, globe, change button", order.indexOf("globe") > order.indexOf("link") && order.indexOf("globe") < order.indexOf("button"), true);
t("panel order: exactly one globe in the set state", order.filter(x => x === "globe").length, 1);
wiki.deleteTiddler("A ord");
wiki.deleteTiddler("P ord");
setSel(undefined);

// ── The globe is host-rendered (one indicator, one switch): direct hgsd-realm-warning calls ──
setSel(["Work"]);
const warningGlobes = title => {
  const parser = wiki.parseText("text/vnd.tiddlywiki", G + '\n\n<$transclude $variable="hgsd-realm-warning" linked-tiddler="' + title + '"/>\n\n</$importvariables>');
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c);
  let n = 0; (function f(x){ if(!x||typeof x!=="object")return; if(Array.isArray(x))return x.forEach(f);
    if(x.isTiddlyWikiFakeDom){ if(x.tag === "span" && x.attributes && x.attributes.class === "hgsd-realm-warning") n++; (x.children||[]).forEach(f); } })(c.children);
  return n;
};
t("empty target renders nothing", warningGlobes(""), 0);
t("outside-selection target renders the globe", warningGlobes("H item"), 1);
wiki.addTiddler({title: "@NoRealm ctx", tags: ["GSD/Contexts"]});
t("context-typed target renders no globe (contexts carry no realms)", warningGlobes("@NoRealm ctx"), 0);
wiki.deleteTiddler("@NoRealm ctx");
// the globe renders beside every pick-field value link and prereq row through direct calls, not family membership
wiki.addTiddler({title: "P ord3", tags: ["$:/GSD/Project"], gsd_status: "active"});
wiki.addTiddler({title: "A ord3", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_project: "P ord3"});
const pickFieldGlobes = attrs => {
  const src = '<$tiddler tiddler="A ord3"><$hgsd.pick-field field="gsd_project" id="li3" ' + attrs + '/></$tiddler>';
  const parser = wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + src + "\n\n</$importvariables>");
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c);
  let n = 0; (function f(x){ if(!x||typeof x!=="object")return; if(Array.isArray(x))return x.forEach(f);
    if(x.isTiddlyWikiFakeDom){ if(x.tag === "span" && x.attributes && x.attributes.class === "hgsd-realm-warning") n++; (x.children||[]).forEach(f); } })(c.children);
  return n;
};
t("pick-field set state carries the host-rendered globe", pickFieldGlobes(""), 1);
t("pick-field hide hatch suppresses adornments", pickFieldGlobes('panel-items="hide"'), 0);
wiki.deleteTiddler("A ord3");
wiki.deleteTiddler("P ord3");
setSel(undefined);

// ── The Fragments tab names no tag title (data-driven over the root) ──
const tabSrc = wiki.getTiddlerText("$:/plugins/yan/hypergsd/ui/control-panel/fragments") || "";
t("settings: the Fragments tab is data-driven (names no placement tag title)",
  ["$:/tags/hypergsd/Fragment/Link/Action", "$:/tags/hypergsd/Fragment/Link/Project", "$:/tags/hypergsd/Fragment/Row/Prefix", "$:/tags/hypergsd/Fragment/Row/Suffix"]
    .every(tag => tabSrc.indexOf(tag) === -1) && tabSrc.indexOf("prefix[$:/tags/hypergsd/Fragment/") !== -1, true);
setSel(undefined);

console.log(fails === 0 ? "ALL REALM-SELECTION CASES PASS" : fails + " FAILURE(S)");
if (fails > 0) console.log("(debug sidebar labels were:", JSON.stringify(labels) + ")");
wiki.deleteTiddler(SEL);