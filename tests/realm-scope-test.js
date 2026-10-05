// Realm-scope unification: realm-scope is an evaluated filter expression
// (scope list = realm tags + no-realm sentinel). Matrix over BOTH consumers
// ($hgsd.list and $hgsd.pick) × scope forms (default, explicit subfilter,
// direct filter, composed, blank-unscoped) × selection states.
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-wiki"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;

wiki.addTiddler({title: "P one", tags: ["$:/GSD/Project"], gsd_status: "active"});
wiki.addTiddler({title: "W item", tags: ["$:/GSD/Action", "$:/GSD/Realm/Work"], gsd_status: "next", gsd_complete: "false", gsd_project: "P one"});
wiki.addTiddler({title: "H item", tags: ["$:/GSD/Action", "$:/GSD/Realm/Home"], gsd_status: "next", gsd_complete: "false", gsd_project: "P one"});
wiki.addTiddler({title: "N item", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false", gsd_project: "P one"});
wiki.addTiddler({title: "$:/state/hypergsd/current-realm", text: "DEAD-STATE"}); // must be ignored entirely
const SEL = "$:/config/hypergsd/realm-selection";
const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';
const LF = "[tag[$:/GSD/Action]gsd_status[next]gsd_complete[false]] +[sort[title]]";
const setSel = (list) => list === undefined ? wiki.deleteTiddler(SEL)
  : wiki.addTiddler({title: SEL, list: list.map(t => t === "no-realm" ? t : "$:/GSD/Realm/" + t)});
const names = (l) => l.map(t => t.replace("$:/GSD/Realm/", ""));

const listRender = (attrs) => {
  const body = '<$hgsd.list list-heading="T" list-filter="' + LF + '" group-state="false" ' + attrs + "/>";
  const parser = wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + body + "\n\n</$importvariables>");
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
  const c = doc.createElement("div"); w.render(c);
  const hrefs = [];
  (function s2(n){ if(!n||typeof n!=="object") return; if(Array.isArray(n)) return n.forEach(s2);
    if(n.isTiddlyWikiFakeDom) { if(n.children) s2(n.children); }
    else if((n.textContent||"").trim() === ">") hrefs.push("STRAY>"); })(c);
  (function f(n){ if(!n||typeof n!=="object") return; if(Array.isArray(n)) return n.forEach(f);
    if(n.isTiddlyWikiFakeDom) { if(n.tag === "a" && n.attributes && n.attributes.href && ((n.attributes.class||"").indexOf("gsd-list-item-title") !== -1)) hrefs.push(decodeURIComponent(n.attributes.href.replace(/^#\/?/, ""))); if(n.children) f(n.children); } })(c.children);
  return hrefs.sort();
};
// picker: render the popup OPEN by setting pop state text, collect option values
const pickRender = (attrs) => {
  wiki.addTiddler({title: "$:/state/popup/pick-test-GSD/Test", text: "(0,0,0,0)"});
  const body = '<$hgsd.pick tiddler="Z host" field="pick" id="test" list-filter="' + LF + '" ' + attrs + "/>";
  const parser = wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + body + "\n\n</$importvariables>");
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget, variables: {currentTiddler: "GSD/Test"}});
  const c = doc.createElement("div"); w.render(c);
  const opts = [];
  let spans = 0, stray = 0;
  (function f(n){ if(!n||typeof n!=="object") return; if(Array.isArray(n)) return n.forEach(f);
    if(n.isTiddlyWikiFakeDom) {
      if(n.tag === "select" && (n.attributes||{}).size === "8") {
        (n.children || []).forEach(ch => { if (ch.tag === "span") spans++; });
        (function g(m){ if(!m||typeof m!=="object") return; if(Array.isArray(m)) return m.forEach(g);
          if(m.tag === "option" && m.attributes && "value" in m.attributes) opts.push(String(m.attributes.value));
          (m.children||[]).forEach(g); })(n);
      }
      (n.children||[]).forEach(f);
    } else if((n.textContent||"").trim() === ">") stray++; })(c);
  wiki.deleteTiddler("$:/state/popup/pick-test-GSD/Test");
  return {opts: opts.sort(), spans, stray};
};
wiki.addTiddler({title: "Z host", text: ""});

let fails = 0;
const t = (name, got, exp) => { const ok = JSON.stringify(got) === JSON.stringify(exp); if(!ok) fails++; console.log((ok?"PASS ":"FAIL ") + name + " got:" + JSON.stringify(got)); };

// ── list: default across the five selection states (matches the realm-selection matrix) ──
setSel(undefined);                t("list default pristine", listRender(""), ["H item","N item","W item"]);
setSel(["Work"]);                 t("list default {Work}", listRender(""), ["W item"]);
setSel(["Work","no-realm"]);      t("list default {Work}+sent", listRender(""), ["N item","W item"]);
setSel([]);                       t("list default empty", listRender(""), []);
setSel(["no-realm"]);             t("list default {}+sent", listRender(""), ["N item"]);
// explicit subfilter == default
setSel(["Work"]);                 t("list explicit subfilter", listRender('realm-scope="[subfilter<hgsd-realm-selection>]"'), ["W item"]);
// direct filter scope
                                  t("list direct [[no-realm]]", listRender('realm-scope="[[no-realm]]"'), ["N item"]);
                                  t("list direct Work tag", listRender('realm-scope="[[$:/GSD/Realm/Work]]"'), ["W item"]);
// composed scope
                                  t("list composed union", listRender('realm-scope="[subfilter<hgsd-realm-all>]"'), ["H item","N item","W item"]);
// blank = unscoped
                                  t("list blank = everything", listRender('realm-scope=""'), ["H item","N item","W item"]);

// ── picker: same matrix (options minus the none-option; assert no span inside select) ──
const P = (a) => { const r = pickRender(a); return {opts: r.opts.filter(o => o !== ""), spans: r.spans, stray: r.stray}; };
setSel(undefined);                t("pick default pristine", P(""), {opts: ["H item","N item","W item"], spans: 0, stray: 0});
setSel(["Work"]);                 t("pick default {Work}", P(""), {opts: ["W item"], spans: 0, stray: 0});
setSel(["Work","no-realm"]);      t("pick default {Work}+sent", P(""), {opts: ["N item","W item"], spans: 0, stray: 0});
setSel([]);                       t("pick default empty", P(""), {opts: [], spans: 0, stray: 0});
                                  t("pick blank = everything", P('realm-scope=""'), {opts: ["H item","N item","W item"], spans: 0, stray: 0});
                                  t("pick direct [[no-realm]]", P('realm-scope="[[no-realm]]"'), {opts: ["N item"], spans: 0, stray: 0});
                                  t("pick explicit realm-all", P('realm-scope="[subfilter<hgsd-realm-all>]"'), {opts: ["H item","N item","W item"], spans: 0, stray: 0});
wiki.deleteTiddler(SEL);
console.log(fails === 0 ? "ALL REALM-SCOPE CASES PASS" : fails + " FAILURE(S)");