// Unified dual-context sections (ui/attributes): one tiddler, both tag list
// tags; chassis-provided section-target/section-type/section-mode. Covers the
// status branch pair, pick-field-over-target (panel immediate vs modal draft),
// tag list/column wiring, and the new-button suppression in modal mode.
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-wiki"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;
const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';

wiki.addTiddler({title: "Host action", tags: ["$:/GSD/Action"], gsd_status: "waiting", gsd_complete: "false"});
wiki.addTiddler({title: "Done action", tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "true"});
wiki.addTiddler({title: "Host project", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "false"});
wiki.addTiddler({title: "Some project", tags: ["$:/GSD/Project"], gsd_status: "active", gsd_complete: "false"});

let fails = 0;
const t = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + name + (ok ? "" : " got:" + JSON.stringify(got))); };

const panelCtx = (src, host) => `<$tiddler tiddler="${host}"><$let section-target="${host}" section-mode="panel" section-status-target="${host}" section-type={{{ [is[current]tag[$:/GSD/Action]then[action]else[project]] }}}>${src}</$let></$tiddler>`;
const modalCtx = (src, type, temp, state, gsdStatus) => `<$let section-target="${temp}" section-type="${type}" section-mode="modal" section-status-target="${state}" new-data-title="${temp}" new-state="${state}" current-type="${type}" gsd-status="${gsdStatus || "next"}" gsd-project="">${src}</$let>`;
const render = (inner, imports) => {
  const parser = wiki.parseText("text/vnd.tiddlywiki", G + "\n\n" + inner + "\n\n</$importvariables>");
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c);
  return {c, w};
};
const buttonWidgets = w => { const out = []; (function f(n){ if(!n||typeof n!=="object") return; if(Array.isArray(n)) return n.forEach(f);
  if(n.parseTreeNode && n.parseTreeNode.tag === "$button") { out.push(n); return; } (n.children||[]).forEach(f); })(w.children); return out; };
const txt = c => { let s = ""; (function f(n){ if(!n||typeof n!=="object") return; if(Array.isArray(n)) return n.forEach(f);
  if(n.isTiddlyWikiFakeDom) return (n.children||[]).forEach(f); s += (n.textContent||""); })(c); return s; };
const radios = c => { const out = []; (function f(n){ if(!n||typeof n!=="object") return; if(Array.isArray(n)) return n.forEach(f);
  if(n.isTiddlyWikiFakeDom) { if(n.tag === "input" && n.attributes && n.attributes.type === "radio") out.push((n.attributes.checked !== undefined ? "[x]" : "[ ]") + (n.attributes["data-status"] || "?")); (n.children||[]).forEach(f); } })(c); return out; };
const buttons = c => { const out = []; (function f(n){ if(!n||typeof n!=="object") return; if(Array.isArray(n)) return n.forEach(f);
  if(n.isTiddlyWikiFakeDom) { if(n.tag === "button") out.push((n.textContent || "").replace(/\s+/g, " ").trim()); (n.children||[]).forEach(f); } })(c); return out; };
const findButton = (c, label) => { let hit = null; (function f(n){ if(hit||!n||typeof n!=="object") return; if(Array.isArray(n)) return n.forEach(f);
  if(n.isTiddlyWikiFakeDom) { if(n.tag === "button" && (n.textContent || "").indexOf(label) !== -1) { hit = n; return; } (n.children||[]).forEach(f); } })(c); return hit; };
const fireActions = n => { n.invokeActions(n, {type: "click"}); };
const L = t => ((wiki.getTiddlerText(t) || "").replace(/\s+/g, " ").trim());

// tag list wiring: dual tags + dual groups, lists re-pointed
t("status: dual tag-list membership", [
  wiki.filterTiddlers("[[$:/tags/hypergsd/PanelTemplate]] :and[tagging[]]").includes("$:/plugins/yan/hypergsd/ui/attributes/status"),
  wiki.filterTiddlers("[[$:/tags/hypergsd/ModalTemplate]] :and[tagging[]]").includes("$:/plugins/yan/hypergsd/ui/attributes/status")], [true, true]);
t("project/contact: dual membership + Portion/1 both sides", [
  wiki.filterTiddlers("[[$:/tags/hypergsd/PanelTemplate/Portion/1]] :and[tagging[]]").includes("$:/plugins/yan/hypergsd/ui/attributes/project"),
  wiki.filterTiddlers("[[$:/tags/hypergsd/ModalTemplate/Portion/1]] :and[tagging[]]").includes("$:/plugins/yan/hypergsd/ui/attributes/project"),
  wiki.filterTiddlers("[[$:/tags/hypergsd/ModalTemplate/Portion/1]] :and[tagging[]]").includes("$:/plugins/yan/hypergsd-contacts/ui/attributes/contact")], [true, true, true]);
t("no stale panel/modal titles pinned in either list",
  wiki.filterTiddlers("[[$:/tags/hypergsd/PanelTemplate]] :and[tagging[]], [[$:/tags/hypergsd/ModalTemplate]] :and[tagging[]]")
    .filter(x => /\/ui\/(panel|modal)\/(status|project)$/.test(x) || /Contacts\/ui\/(panel|modal)\/contact$/.test(x)).length, 0);

// status: panel branch
const stPanelR = render(panelCtx('<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/attributes/status" $mode="block"/>', "Host action"));
t("status panel: action radios with waiting checked", radios(stPanelR.c), ["[ ]next", "[x]waiting", "[ ]future"]);
t("status panel: pill classes computed (colour hooks)", (() => {
  const out = [];
  (function f(n){ if(!n||typeof n!=="object") return; if(Array.isArray(n)) return n.forEach(f);
    if(n.isTiddlyWikiFakeDom){ const cls = (n.attributes||{}).class || ""; if(cls.indexOf("view-status") === 0) out.push(cls); (n.children||[]).forEach(f); } })(stPanelR.c);
  return out;
})(), ["view-status action-next", "view-status action-waiting", "view-status action-future"]);
// radio-list structure: ul > li > label wrapping input + resolved label text;
// the pill span is gone (the label itself is the pill, filled via :has)
t("status panel: radio list structure (ul > li > label-wrapped input, no span)", (() => {
  let ul = null;
  (function f(n){ if(ul||!n||typeof n!=="object") return; if(Array.isArray(n)) return n.forEach(f);
    if(n.isTiddlyWikiFakeDom){ if(n.tag === "ul" && (n.attributes||{}).class === "hgsd-radio-group") ul = n; else (n.children||[]).forEach(f); } })(stPanelR.c);
  if (!ul) return ["no ul found"];
  const items = (ul.children || []).filter(n => n.isTiddlyWikiFakeDom && n.tag === "li");
  return [items.length, items.map(li => {
    const lab = (li.children || []).find(n => n.isTiddlyWikiFakeDom && n.tag === "label");
    if (!lab) return "no label";
    const inp = (lab.children || []).find(n => n.isTiddlyWikiFakeDom && n.tag === "input");
    if (!inp) return "no input";
    return [(lab.attributes.class.indexOf("view-status") === 0),
            inp.attributes.name,
            (lab.children || []).filter(n => n.isTiddlyWikiFakeDom && n.tag === "span").length === 0,
            txt(lab).length > 0];
  })];
})(), [3, [[true, "Host action-status", true, true], [true, "Host action-status", true, true], [true, "Host action-status", true, true]]]);
t("status panel: complete action renders nothing",
  txt(render(panelCtx('<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/attributes/status" $mode="block"/>', "Done action")).c), "");
const stProjR = render(panelCtx('<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/attributes/status" $mode="block"/>', "Host project"));
t("status panel: project radios with active checked", radios(stProjR.c), ["[x]active", "[ ]future"]);

// regression guard (2026-09-12 panel typed every host "action"): the REAL view-body section-type derivation must yield the host's own type — an :and[list[]] operand replaces the accumulator wholesale (list[] ignores its input), so the simplified panelCtx above cannot be the only project-panel coverage
const viewBodyText = require("fs").readFileSync(__dirname + "/../plugins/hypergsd/ui/ViewTemplate/view-body.tid", "utf8").replace(/^[\s\S]*?\\whitespace trim\n/, "");
// The whole-panel render also carries other radio sections (priority); the
// status pills are the radios carrying data-status.
const realPanelPills = host => radios(render('<$tiddler tiddler="' + host + '">' + viewBodyText + "</$tiddler>").c).filter(s => !/\?/.test(s));
t("status panel: real view-body types the host (project pills, active checked)", realPanelPills("Host project"), ["[x]active", "[ ]future"]);
t("status panel: real view-body types the host (action pills, waiting checked)", realPanelPills("Host action"), ["[ ]next", "[x]waiting", "[ ]future"]);

// status: modal branch (cascade — per-type memory beats inherited default)
wiki.addTiddler({title: "$:/temp/sec-state", "hgsd-type": "action", gsd_action_status: "future"});
const stModalR = render(modalCtx('<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/attributes/status" $mode="block"/>', "action", "$:/temp/sec-temp", "$:/temp/sec-state"));
t("status modal: per-type memory (future) beats inherited default", radios(stModalR.c), ["[ ]next", "[ ]waiting", "[x]future"]);
wiki.deleteTiddler("$:/temp/sec-state");
const stModal2R = render(modalCtx('<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/attributes/status" $mode="block"/>', "action", "$:/temp/sec-temp", "$:/temp/sec-state"));
t("status modal: inherited valid status used when no memory", radios(stModal2R.c), ["[x]next", "[ ]waiting", "[ ]future"]);
const stModal3R = render(modalCtx('<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/attributes/status" $mode="block"/>', "project", "$:/temp/sec-temp", "$:/temp/sec-state"));
t("status modal: invalid inherited status falls to type default (active)", radios(stModal3R.c), ["[x]active", "[ ]future"]);

// project: panel branch — pick-field State 1 (empty field) + immediate save
wiki.addTiddler({title: "$:/temp/hypergsd/add-project-Host action", "hgsd-pick": "Some project"});
const prPanelR = render(panelCtx('<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/attributes/project" $mode="block"/>', "Host action"));
const saveBtn = findButton(prPanelR.c, L("$:/language/Buttons/Save/Caption"));
t("project panel: save button present (State 1, empty field)", !!saveBtn, true);
if (saveBtn) fireActions(buttonWidgets(prPanelR.w)[0]);
t("project panel: save writes the HOST immediately",
  wiki.getTiddler("Host action").fields.gsd_project, "Some project");

// project: modal branch — pick-field over the temp, new-button suppressed
wiki.deleteTiddler("$:/temp/hypergsd/add-project-Host action");
wiki.addTiddler({title: "$:/temp/gsd-new-temp"});
const prModalR = render(modalCtx('<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/attributes/project" $mode="block"/>', "action", "$:/temp/gsd-new-temp", "$:/temp/sec-state"));
t("project modal: no plain new-button (suppressed), no create button (blank pick)",
  buttons(prModalR.c).filter(b => /new project|create/.test(b)).length, 0);
wiki.addTiddler({title: "$:/temp/hypergsd/add-project-$:/temp/gsd-new-temp", "hgsd-pick": "Nowhere"});
const prModal2R = render(modalCtx('<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/attributes/project" $mode="block"/>', "action", "$:/temp/gsd-new-temp", "$:/temp/sec-state"));
t("project modal: typed non-existent pick offers create-and-add",
  buttons(prModal2R.c).some(b => b.indexOf("create") !== -1 && b.indexOf("Nowhere") !== -1), true);
wiki.deleteTiddler("$:/temp/hypergsd/add-project-$:/temp/gsd-new-temp");
wiki.addTiddler({title: "$:/temp/hypergsd/add-project-$:/temp/gsd-new-temp", "hgsd-pick": "Some project"});
const prModal3R = render(modalCtx('<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/attributes/project" $mode="block"/>', "action", "$:/temp/gsd-new-temp", "$:/temp/sec-state"));
const saveBtn2 = findButton(prModal3R.c, L("$:/language/Buttons/Save/Caption"));
if (saveBtn2) fireActions(buttonWidgets(prModal3R.w)[0]);
t("project modal: save writes the DATA TEMP (drafting, not the host)",
  wiki.getTiddler("$:/temp/gsd-new-temp").fields.gsd_project, "Some project");
t("project modal: host action untouched by modal drafting",
  wiki.getTiddler("Host action").fields.gsd_project, "Some project");

// refresh whitelist: the modal chassis must wake on pick-field's add- temps
// (scoped to the modal's own temp suffix), or typing never filters the dropdown
(() => {
  const src = (wiki.getTiddler("$:/plugins/yan/hypergsd/ui/new-gsd-modal") || {fields: {}}).fields.text || "";
  const wl = (src.match(/<\$refresh subfilter="([^"]+)"/) || [])[1] || "";
  t("modal whitelist: scoped add- pair present and FIRST (the :and trap)",
    [wl.indexOf("[prefix[$:/temp/hypergsd/add-]] :and[suffix<new-data-title>]") === 0,
     wl.indexOf("[prefix[$:/temp/hypergsd/add-]] :and") < wl.indexOf("[tag[$:/tags/hypergsd/ModalTemplate]]")],
    [true, true]);
})();

// seeded inheritance: new-button's gsd_contact seeding drives display + submit target
wiki.deleteTiddler("$:/temp/gsd-new-temp");
wiki.addTiddler({title: "$:/temp/gsd-new-temp", gsd_contact: "Ana"});
const ctModalR = render(modalCtx('<$transclude $tiddler="$:/plugins/yan/hypergsd-contacts/ui/attributes/contact" $mode="block"/>', "action", "$:/temp/gsd-new-temp", "$:/temp/sec-state"));
t("contact modal: seeded contact shows as the current value (link state)",
  /Ana/.test(txt(ctModalR.c)) && buttons(ctModalR.c).some(x => x.indexOf(L("$:/language/hypergsd/Widgets/Change")) !== -1), true);

// MERGED SAVE LOGIC: simulated hgsd-handle-click fire (the eventcatcher's
// dom-data-* variables preset) — writes gsd_status + the per-type memory,
// guarded to the modal state temp
{
  wiki.deleteTiddler("$:/temp/sec-state");
  wiki.addTiddler({title: "$:/temp/gsd-new-state", "hgsd-type": "action"});
  const sim = `<$button><$set name="dom-data-tiddler" value="$:/temp/gsd-new-state"><$set name="dom-data-hgsd-action" value="status"><$set name="dom-data-status" value="future"><$set name="dom-data-hgsd-status-field" value="gsd_action_status"><$transclude $variable="hgsd-handle-click"/></$set></$set></$set></$set></$button>`;
  const r = render(sim);
  const btn = buttonWidgets(r.w)[0];
  if (btn) fireActions(btn);
  t("click merge: gsd_status + per-type memory land on the state temp",
    [wiki.getTiddler("$:/temp/gsd-new-state").fields.gsd_status, wiki.getTiddler("$:/temp/gsd-new-state").fields.gsd_action_status],
    ["future", "future"]);
  // per-type write guard: a REAL tiddler gets gsd_status but never the memory field
  const sim2 = `<$button><$set name="dom-data-tiddler" value="Host action"><$set name="dom-data-hgsd-action" value="status"><$set name="dom-data-status" value="next"><$set name="dom-data-hgsd-status-field" value="gsd_action_status"><$transclude $variable="hgsd-handle-click"/></$set></$set></$set></$set></$button>`;
  const r2 = render(sim2);
  const btn2 = buttonWidgets(r2.w)[0];
  if (btn2) fireActions(btn2);
  t("click merge: real tiddler gets gsd_status only (no memory field)",
    [wiki.getTiddler("Host action").fields.gsd_status, wiki.getTiddler("Host action").fields.gsd_action_status],
    ["next", undefined]);
}

// type-switch memory: both per-type fields set — each type's render remembers its own
{
  wiki.deleteTiddler("$:/temp/sec-state");
  wiki.addTiddler({title: "$:/temp/sec-state", "hgsd-type": "action", gsd_action_status: "waiting", gsd_project_status: "active"});
  const sec = '<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/attributes/status" $mode="block"/>';
  const asAction = radios(render(modalCtx(sec, "action", "$:/temp/sec-temp", "$:/temp/sec-state")).c);
  const asProject = radios(render(modalCtx(sec, "project", "$:/temp/sec-temp", "$:/temp/sec-state")).c);
  t("type-switch memory: action shows waiting, project shows active", [asAction, asProject],
    [["[ ]next", "[x]waiting", "[ ]future"], ["[x]active", "[ ]future"]]);
  wiki.deleteTiddler("$:/temp/sec-state");
}

// panel layout: orientation is ONE transcluded display value — groups are
// flex boxes by default (absent setting); horizontal flattens them via
// display:contents so all sections share .hgsd-capture's wrapping flow
{
  const ss = () => txt(render('{{||$:/plugins/yan/hypergsd/ui/stylesheet/sections}}').c);
  t("stylesheet: absent setting keeps groups as flex boxes", /display:\s*contents\s*;/.test(ss()), false);
  wiki.addTiddler({title: "$:/config/hypergsd/panel-layout", text: "horizontal"});
  t("stylesheet: horizontal flattens groups (display: contents)", /display:\s*contents\s*;/.test(ss()), true);
  wiki.deleteTiddler("$:/config/hypergsd/panel-layout");
}

// status vocabulary: hardcoded in modules/status-sets — the tag's
// statuses field is inert; replacement happens by shadowing the whole
// status-sets tiddler (same title, same Global tag, same function names,
// label/glyph procedures re-shipped)
{
  wiki.addTiddler({title: "$:/GSD/Action", tags: ["$:/tags/hypergsd/Type"], "hgsd-type": "action", statuses: "next waiting future someday", "default-status": "next"});
  t("tag list statuses field is inert (vocabulary is hardcoded)",
    radios(render(panelCtx('<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/attributes/status" $mode="block"/>', "Host action")).c),
    ["[x]next", "[ ]waiting", "[ ]future"]);
  wiki.deleteTiddler("$:/GSD/Action");
  wiki.addTiddler({title: "$:/plugins/yan/hypergsd/modules/status-sets", tags: ["$:/tags/Global"], text:
`\\function hgsd-status-set(type) [<type>match[action]then[next waiting future someday]split[ ]] [<type>match[project]then[active future]split[ ]]
\\function hgsd-status-default(type) [<type>match[action]then[next]] [<type>match[project]then[active]]

\\procedure hgsd-status-label(status)
<%if [[$:/language/hypergsd/Capturing/Status/]addsuffix<status>get[text]] %><$text text={{{ [[$:/language/hypergsd/Capturing/Status/]addsuffix<status>get[text]] }}}/><%else%><$text text=<<status>>/><%endif%>
\\end

\\procedure hgsd-row-glyph(status)
<%if [[$:/language/hypergsd/Lists/Row/]addsuffix<status>get[text]] %><$text text={{{ [[$:/language/hypergsd/Lists/Row/]addsuffix<status>get[text]] }}}/><%else%><$text text={{{ [<status>split[]first[]] }}}/><%endif%>
\\end`});
  t("status-sets shadow override: fourth pill on panel",
    radios(render(panelCtx('<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/attributes/status" $mode="block"/>', "Host action")).c),
    ["[x]next", "[ ]waiting", "[ ]future", "[ ]someday"]);
  const m = render(modalCtx('<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/attributes/status" $mode="block"/>', "action", "$:/temp/sec-temp", "$:/temp/sec-state2", "someday"));
  t("status-sets shadow override: inherited validates in modal cascade",
    radios(m.c), ["[ ]next", "[ ]waiting", "[ ]future", "[x]someday"]);
  t("status-sets shadow override: label falls back to the word",
    txt(m.c).includes("someday"), true);
  const ssText = txt(render('{{||$:/plugins/yan/hypergsd/ui/stylesheet/pills}}').c);
  t("status-sets shadow override: generated colour rule (fallback, no key)",
    [/\.action-someday \{/.test(ssText), /\.action-next \{/.test(ssText), ssText.indexOf("Filter error") === -1], [true, true, true]);
  wiki.deleteTiddler("$:/plugins/yan/hypergsd/modules/status-sets");
  t("override removed: shipped three pills again",
    radios(render(panelCtx('<$transclude $tiddler="$:/plugins/yan/hypergsd/ui/attributes/status" $mode="block"/>', "Host action")).c),
    ["[x]next", "[ ]waiting", "[ ]future"]);
  t("empty-set type (reference) renders no pills",
    radios(render('<$transclude $variable="hgsd-status-radios" target-tiddler="X" current-type="reference" current-status="next"/>').c), []);
}

// view-body's own section-type resolution (tag list intersection) drives
// every dual-context section — assert the status fieldset actually renders
// through the chassis (a broken filter here silently drops ALL attribute
// sections; the sections above bypass view-body via panelCtx)
{
  const r = render('<$tiddler tiddler="Host action"><$transclude $tiddler="$:/plugins/yan/hypergsd/ui/ViewTemplate/view-body" $mode="block"/></$tiddler>');
  const st = (r.c.textContent || "").replace(/\s+/g, " ");
  t("view-body: status fieldset renders via chassis (tag list type resolution)",
    [!(/Filter error/.test(st)), /next/.test(st), /waiting/.test(st)], [true, true, true]);
}

console.log(fails === 0 ? "ALL SECTION CASES PASS" : fails + " FAILURE(S)");
process.exit(fails === 0 ? 0 : 1);