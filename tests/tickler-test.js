// Ticklers sub-plugin: the wikitext check procedure (NaN regression, rollover,
// the completed-repeating due-day raise, the once-per-day alert gate), the date-input procedure, the clear-date button, the core-filter date
// arithmetic, the date-history ledger, tag list placement, the alert body actions,
// the manual check button, and Field Editor Cascade.
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = [__dirname + "/fixture-wiki"]; $tw.boot.startup();
global.$tw = $tw;
const fd = require("/home/yan/tiddlywiki/tw5source/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;

let fails = 0;
const t = (name, ok, extra) => { if (Array.isArray(ok)) ok = JSON.stringify(ok) === JSON.stringify(extra); if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + name + (ok || !extra ? "" : " " + extra)); };

const DAY = 86400000;
const midnight = offset => { const d = new Date(Date.now() + offset * DAY); return $tw.utils.stringifyDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))); };
const past = midnight(-5), future = midnight(5), today = midnight(0);
// Alert fixtures ride the LOCAL calendar date (the alert pass compares the stored date
// part to the user's local date string); rollover and dashboard fixtures ride the UTC
// string clock, which lags the local date between 00:00 and 01:00 BST.
const midnightLocal = offset => { const d = new Date(Date.now() + offset * DAY); return $tw.utils.stringifyDate(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))); };
const todayAlert = midnightLocal(0);
const fields = title => (wiki.getTiddler(title) || {fields: {}}).fields;
const historyOf = title => $tw.utils.parseStringArray(fields(title).gsd_tickler_date_history || "");

const G = '<$importvariables filter="[[\$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[\$:/tags/Macro]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global]!is[draft]] [all[shadows+tiddlers]tag[\$:/tags/Global/View]!is[draft]]">';
const render = src => {
  const w = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + "\n" + src + "\n</$importvariables>"), {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); w.render(c);
  return {w, c};
};
const txt = m => { let s = ""; (function g(x){ if(!x||typeof x!=="object")return; if(Array.isArray(x))return x.forEach(g);
  if(x.isTiddlyWikiFakeDom) return (x.children||[]).forEach(g); s += (x.textContent||""); })(m); return s.replace(/\s+/g," ").trim(); };
const findInputs = c => { const out = []; (function f(n){ if(!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
  if(n.isTiddlyWikiFakeDom){ if((n.tag||"").toUpperCase()==="INPUT") out.push(n); (n.children||[]).forEach(f); } })(c); return out; };
// The JS trigger's invocation shape: a rendered Global-import tree carrying the
// procedure transclude (trees built by invokeActionString do not execute
// actions inside a $variable transclude — a normally rendered tree does).
const runCheck = () => {
  const tree = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", G + '\n<$transclude $variable="hgsd-tickler-check"/>\n</$importvariables>'), {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div"); tree.render(c);
  return tree.invokeActions(tree, {type: "tm-generic"});
};
// The raise passes run only on a day's first check (gated on the temp marker
// $:/temp/hypergsd/Ticklers/AlertDay); a section exercising a raise simulates
// that first check by clearing the marker.
const openAlertDay = () => wiki.deleteTiddler("$:/temp/hypergsd/Ticklers/AlertDay");

// ── Check: the GSD5 NaN regression (GitLab work item 14) ─────────────────────
wiki.addTiddler({title: "TK one-shot", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "false", gsd_tickler_date: past});
wiki.addTiddler({title: "TK zero", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "false", gsd_tickler_date: past, gsd_tickler_repeat_days: "0"});
wiki.addTiddler({title: "TK garbage-days", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "false", gsd_tickler_date: past, gsd_tickler_repeat_days: "soon"});
wiki.addTiddler({title: "TK bad-date", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "false", gsd_tickler_date: "NaNNaNNaNNaNNaNNaNNaN"});
wiki.addTiddler({title: "TK future", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "false", gsd_tickler_date: future});
wiki.addTiddler({title: "TK recurring", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "false", gsd_tickler_date: past, gsd_tickler_repeat_days: "7"});
wiki.addTiddler({title: "TK due-now", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "false", gsd_tickler_date: todayAlert});
wiki.addTiddler({title: "TK due-now-done", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "true", gsd_tickler_date: todayAlert});
wiki.addTiddler({title: "TK due-now-repeat", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "false", gsd_tickler_date: todayAlert, gsd_tickler_repeat_days: "7"});
wiki.addTiddler({title: "TK done-past", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "true", gsd_tickler_date: past});
t("check procedure fires", runCheck());
t("raise pass writes the day marker", fields("$:/temp/hypergsd/Ticklers/AlertDay").text === todayAlert.substring(0, 8));
t("one-shot past-due: date retained", fields("TK one-shot").gsd_tickler_date === past);
t("repeat zero past-due: date retained", fields("TK zero").gsd_tickler_date === past);
t("non-numeric repeat past-due: date retained", fields("TK garbage-days").gsd_tickler_date === past);
t("no written value contains NaN", ["TK one-shot","TK zero","TK garbage-days","TK recurring","TK due-now"].every(x => String(fields(x).gsd_tickler_date).indexOf("NaN") === -1));
t("unparseable date: untouched", fields("TK bad-date").gsd_tickler_date === "NaNNaNNaNNaNNaNNaNNaN");
t("future date: untouched, no alert", fields("TK future").gsd_tickler_date === future && !wiki.getTiddler("$:/temp/alert/TK future"));
t("past-due incomplete raises overdue banners", ["TK one-shot","TK zero","TK garbage-days"].every(x => { const a = wiki.getTiddler("$:/temp/alert/" + x); return a && a.fields.component === "Tickler overdue"; }));
t("past-due complete one-shot raises nothing", !wiki.getTiddler("$:/temp/alert/TK done-past"));
t("alerts raised for due-today ticklers", (() => {
  const good = ["TK due-now","TK due-now-repeat"].every(x => {
    const a = wiki.getTiddler("$:/temp/alert/" + x);
    return a && a.fields.component === "Tickler due" && (a.fields.tags||[]).includes("$:/tags/Alert") && /hgsd-tickler-alert/.test(a.fields.text || "");
  });
  return good && !wiki.getTiddler("$:/temp/alert/TK due-now-done");
})());
t("due-today one-shot: date retained after firing", fields("TK due-now").gsd_tickler_date === todayAlert);
t("no alert for unparseable date", !wiki.getTiddler("$:/temp/alert/TK bad-date"));
const rolled = fields("TK recurring").gsd_tickler_date;
const rolledDate = $tw.utils.parseDate(rolled);
t("recurring: advanced into the future at midnight", rolledDate && rolledDate.getTime() > Date.now() && rolledDate.getUTCHours() === 0 && rolledDate.getUTCMinutes() === 0);
t("recurring: phase preserved (same weekday)", rolledDate && rolledDate.getUTCDay() === new Date(Date.now() - 5 * DAY).getUTCDay());
t("recurring: the rolled date joins the history", JSON.stringify(historyOf("TK recurring")) === JSON.stringify([rolled]));
t("recurring: one overdue banner for the missed occurrence", (() => { const a = wiki.getTiddler("$:/temp/alert/TK recurring"); return a && a.fields.component === "Tickler overdue"; })());
wiki.deleteTiddler("$:/temp/alert/TK recurring");
openAlertDay();
runCheck();
t("recurring: no second overdue banner after the roll", !wiki.getTiddler("$:/temp/alert/TK recurring"));

// ── Check: completed repeating ticklers — no revival; the due-day banner is the nag ───────────────────────────
wiki.addTiddler({title: "TK revive", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "true", gsd_tickler_date: midnight(1), gsd_tickler_repeat_days: "3"});
wiki.addTiddler({title: "TK stays-done", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "true", gsd_tickler_date: midnight(1)});
wiki.addTiddler({title: "TK far-future", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "true", gsd_tickler_date: midnight(2), gsd_tickler_repeat_days: "30"});
wiki.addTiddler({title: "TK done-due", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "true", gsd_tickler_date: todayAlert, gsd_tickler_repeat_days: "3"});
wiki.addTiddler({title: "TK zero-done", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "true", gsd_tickler_date: todayAlert, gsd_tickler_repeat_days: "0"});
openAlertDay();
runCheck();
t("completed repeating tickler near due stays complete (no revival)", fields("TK revive").gsd_complete === "true");
t("completed one-shot stays complete", fields("TK stays-done").gsd_complete === "true");
t("completed repeating tickler beyond the window stays complete", fields("TK far-future").gsd_complete === "true");
t("completed repeating tickler due today raises its banner (the nag)", (() => { const a = wiki.getTiddler("$:/temp/alert/TK done-due"); return a && a.fields.component === "Tickler due"; })());
t("...and stays complete after raising", fields("TK done-due").gsd_complete === "true");
t("completed zero-repeat tickler due today raises nothing", !wiki.getTiddler("$:/temp/alert/TK zero-done"));

// ── Roll guard: source carries the length guard (no write without a full date) ─
const checkSource = wiki.getTiddlerText("$:/plugins/yan/hypergsd-ticklers/modules/tickler-check") || "";
t("roll guard present in the check source", checkSource.indexOf("<%if [<rolled>minlength[17]] %>") !== -1);
t("check source is tag-driven wikitext (no JS policy)", checkSource.indexOf("$action-createtiddler") !== -1);

// ── Date-input procedure ──────────────────────────────────────────────────────
wiki.addTiddler({title: "TK valid", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "false", gsd_tickler_date: midnight(3)});
wiki.addTiddler({title: "TK nan", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "false", gsd_tickler_date: "NaNNaNNaNNaNNaNNaNNaN"});
const dateInput = title => render(`<$tiddler tiddler="${title}"><$transclude $variable="hgsd-date-input" target-tiddler="${title}" target-field="gsd_tickler_date" history-field="gsd_tickler_date_history"/></$tiddler>`);
t("date-input renders a native date box", findInputs(dateInput("TK valid").c).length === 1);
t("date-input seeds the display form", (() => {
  // fakeDOM does not surface edit-text defaults on the input node; assert
  // the seeding filter (the default attribute's value) directly
  const seeded = wiki.filterTiddlers(`[[TK valid]get[gsd_tickler_date]else[]] :filter[minlength[17]] +[format:date[YYYY-0MM-0DD]]`);
  return seeded.length === 1 && seeded[0] === new Date(Date.now() + 3 * DAY).toISOString().substr(0, 10);
})());
t("date-input guards a garbage stored value", (() => {
  const input = findInputs(dateInput("TK nan").c)[0];
  return !/NaN/.test(JSON.stringify(input.attributes || {}));
})());
// drive inputActions exactly as the DOM change event would (with actionValue)
const driveChange = (title, value) => {
  const r = dateInput(title);
  let editWidget = null;
  (function f(n){ if(editWidget||!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
    if(n.parseTreeNode && n.parseTreeNode.tag === "$edit-text") editWidget = n; (n.children||[]).forEach(f); })(r.w);
  if (!editWidget) return "no-edit-widget";
  editWidget.invokeActionString(editWidget.getAttribute("inputActions"), editWidget, null, {actionValue: value});
  return fields(title).gsd_tickler_date;
};
t("pick canonicalises to midnight UTC", driveChange("TK nan", "2030-06-15") === "20300615000000000");
t("pick appends to the date history", JSON.stringify(historyOf("TK nan")) === JSON.stringify(["20300615000000000"]));
t("empty event is a no-op on a dated target", driveChange("TK nan", "") === "20300615000000000");
t("empty event leaves the history untouched", JSON.stringify(historyOf("TK nan")) === JSON.stringify(["20300615000000000"]));
t("empty event straight after a pick keeps the picked date", (() => {
  const r = dateInput("TK nan");
  let editWidget = null;
  (function f(n){ if(editWidget||!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
    if(n.parseTreeNode && n.parseTreeNode.tag === "$edit-text") editWidget = n; (n.children||[]).forEach(f); })(r.w);
  if (!editWidget) return false;
  const actions = editWidget.getAttribute("inputActions");
  editWidget.invokeActionString(actions, editWidget, null, {actionValue: "2031-03-09"});
  if (fields("TK nan").gsd_tickler_date !== "20310309000000000") return false;
  editWidget.invokeActionString(actions, editWidget, null, {actionValue: ""});
  return fields("TK nan").gsd_tickler_date === "20310309000000000";
})());
t("a second pick appends; the history is chronological", JSON.stringify(historyOf("TK nan")) === JSON.stringify(["20300615000000000","20310309000000000"]));
wiki.addTiddler({title: "TK undated-input", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "false"});
t("empty event on a dateless target writes nothing", driveChange("TK undated-input", "") === undefined);
t("empty event leaves no discard residue", !wiki.getTiddler("$:/temp/hgsd-date-discard"));
t("temp cleared for re-seeding", (wiki.getTiddler("$:/temp/hgsd-date/TK nan/gsd_tickler_date") || {fields: {}}).fields.text === undefined);

// ── Date arithmetic (core filters: format:date[TIMESTAMP] → add → format:timestamp) ──
const plusOneDay = wiki.filterTiddlers(`[[${midnight(0)}]format:date[TIMESTAMP]add[86400000]format:timestamp[]]`)[0];
t("arithmetic: advances a date by one day at midnight",
  plusOneDay === midnight(1));
t("arithmetic: a week lands seven days out", wiki.filterTiddlers(`[[${midnight(0)}]format:date[TIMESTAMP]add[604800000]format:timestamp[]]`)[0] === midnight(7));
t("arithmetic: garbage input yields nothing", wiki.filterTiddlers("[[garbage]format:date[TIMESTAMP]add[86400000]format:timestamp[]]").length === 0);

// ── Tag list placement ────────────────────────────────────────────────────────
t("date section registered in BOTH Portion/2s (dual-tagged)", wiki.filterTiddlers("[[$:/tags/hypergsd/ModalTemplate/Portion/2]] :and[tagging[]]").includes("$:/plugins/yan/hypergsd-ticklers/ui/attributes/tickler") && wiki.filterTiddlers("[[$:/tags/hypergsd/PanelTemplate/Portion/2]] :and[tagging[]]").includes("$:/plugins/yan/hypergsd-ticklers/ui/attributes/tickler"));
t("repeat section registered in BOTH Portion/2s (dual-tagged)", wiki.filterTiddlers("[[$:/tags/hypergsd/ModalTemplate/Portion/2]] :and[tagging[]]").includes("$:/plugins/yan/hypergsd-ticklers/ui/attributes/tickler-repeat") && wiki.filterTiddlers("[[$:/tags/hypergsd/PanelTemplate/Portion/2]] :and[tagging[]]").includes("$:/plugins/yan/hypergsd-ticklers/ui/attributes/tickler-repeat"));
t("modal repeat section cites the date section via list-after", (wiki.getTiddler("$:/plugins/yan/hypergsd-ticklers/ui/attributes/tickler-repeat")||{fields:{}}).fields["list-after"] === "$:/plugins/yan/hypergsd-ticklers/ui/attributes/tickler");
t("panel repeat section cites the date section via list-after", (wiki.getTiddler("$:/plugins/yan/hypergsd-ticklers/ui/attributes/tickler-repeat")||{fields:{}}).fields["list-after"] === "$:/plugins/yan/hypergsd-ticklers/ui/attributes/tickler");
t("row suffix registered", wiki.filterTiddlers("[[$:/tags/hypergsd/Fragment/Row/Suffix]] :and[tagging[]]").includes("$:/plugins/yan/hypergsd-ticklers/ui/list-items/tickler"));
t("check procedure is Global-tagged", wiki.filterTiddlers("[all[shadows+tiddlers]tag[$:/tags/Global]]").includes("$:/plugins/yan/hypergsd-ticklers/modules/tickler-check"));
t("shift tag-list order follows the tag list", JSON.stringify(wiki.filterTiddlers("[[$:/tags/hypergsd/Ticklers/Shift]] :and[tagging[]]")) === JSON.stringify(["$:/plugins/yan/hypergsd-ticklers/ui/shift/day","$:/plugins/yan/hypergsd-ticklers/ui/shift/week","$:/plugins/yan/hypergsd-ticklers/ui/shift/month","$:/plugins/yan/hypergsd-ticklers/ui/shift/year"]));
t("alert tags exactly day and week", JSON.stringify(wiki.filterTiddlers("[[$:/tags/hypergsd/Ticklers/Alert]] :and[tagging[]]")) === JSON.stringify(["$:/plugins/yan/hypergsd-ticklers/ui/shift/day","$:/plugins/yan/hypergsd-ticklers/ui/shift/week"]));
t("members are data-only (no body to drift)", ["day","week","month","year"].every(m => (wiki.getTiddler("$:/plugins/yan/hypergsd-ticklers/ui/shift/" + m).fields.text || "") === ""));

// ── Section gating + Grade-2 pass-through data temp ──────────────────────────
const modalSrc = type => `<$let section-target="$:/temp/gsd-new-test" section-type="${type}" section-mode="modal" new-data-title="$:/temp/gsd-new-test" new-state="$:/temp/gsd-new-state" current-type="${type}"><$transclude $tiddler="$:/plugins/yan/hypergsd-ticklers/ui/attributes/tickler" $mode="block"/></$let>`;
const modalRepeatSrc = type => `<$let section-target="$:/temp/gsd-new-test" section-type="${type}" section-mode="modal" new-data-title="$:/temp/gsd-new-test" new-state="$:/temp/gsd-new-state" current-type="${type}"><$transclude $tiddler="$:/plugins/yan/hypergsd-ticklers/ui/attributes/tickler-repeat" $mode="block"/></$let>`;
const clearTip = (wiki.getTiddlerText("$:/language/hypergsd/Sections/Tickler/Clear/Hint") || "").trim();
const findClearButton = r => { let btn = null; (function f(n){ if(!n||btn||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
  if(n.parseTreeNode && n.parseTreeNode.tag === "$button" && (n.domNodes||[])[0] && (n.domNodes[0].attributes || {}).title === clearTip) { btn = n; return; }
  (n.children||[]).forEach(f); })(r.w.children); return btn; };
const modalBody = render(modalSrc("action"));
t("modal date section shows for actions", /Tickler date/.test(txt(modalBody.c)));
wiki.deleteTiddler("$:/temp/gsd-new-test");
t("modal repeat section hidden until a date is picked", !/Repeat after days/.test(txt(render(modalRepeatSrc("action")).c)));
t("modal section hidden for projects", txt(render(modalSrc("project")).c) === "");
wiki.addTiddler({title: "$:/temp/gsd-new-test", gsd_tickler_date: midnight(4), gsd_tickler_repeat_days: "2"});
t("modal repeat section shows once a date is picked", /Repeat after days/.test(txt(render(modalRepeatSrc("action")).c)));
t("modal: clear button absent even with a date", !findClearButton(render(modalSrc("action"))));
t("modal sections order: date before repeat (chassis loop, sort[] kept)", (() => {
  // the modal chassis's own per-portion section loop, evaluated for Portion/2
  const loop = render(`<$set name="capture-portion-tag" value="$:/tags/hypergsd/ModalTemplate/Portion/2">{{{ [[$:/tags/hypergsd/ModalTemplate/Portion/1]] [[$:/tags/hypergsd/ModalTemplate/Portion/2]] [[$:/tags/hypergsd/ModalTemplate]] :and[tagging[]] :and[!is[draft]] :filter[tags[]prefix[$:/tags/hypergsd/ModalTemplate/Portion/]else[$:/tags/hypergsd/ModalTemplate/Portion/1]sort[]first[]match<capture-portion-tag>] }}}`);
  const t2 = txt(loop.c);
  // titles render concatenated (whitespace trim): tickler is a strict prefix of
  // tickler-repeat, so a wrong order collapses the two indexOf calls to equal
  return t2.indexOf("ui/attributes/tickler") < t2.indexOf("ui/attributes/tickler-repeat");
})());
t("tagging-only order (no sort[]) honours list-after", (() => {
  const noSort = render(`<$set name="capture-portion-tag" value="$:/tags/hypergsd/ModalTemplate/Portion/2">{{{ [[$:/tags/hypergsd/ModalTemplate/Portion/2]] :and[tagging[]] :and[!is[draft]] :filter[tags[]prefix[$:/tags/hypergsd/ModalTemplate/Portion/]else[$:/tags/hypergsd/ModalTemplate/Portion/1]first[]match<capture-portion-tag>] }}}`);
  const t2 = txt(noSort.c);
  return t2.indexOf("ui/attributes/tickler") < t2.indexOf("ui/attributes/tickler-repeat");
})());
t("data temp carries the tickler fields", fields("$:/temp/gsd-new-test").gsd_tickler_date === midnight(4) && fields("$:/temp/gsd-new-test").gsd_tickler_repeat_days === "2");

// ── Panel + suffix gating ─────────────────────────────────────────────────────
const panelSrc = x => `<$tiddler tiddler="${x}"><$let section-target="${x}" section-mode="panel" section-type={{{ [is[current]tag[$:/GSD/Action]then[action]else[project]] }}}><$transclude $tiddler="$:/plugins/yan/hypergsd-ticklers/ui/attributes/tickler" $mode="block"/></$let></$tiddler>`;
t("panel date section shows on an action", /Tickler date/.test(txt(render(panelSrc("TK valid")).c)));
t("panel: clear button present while a date exists", !!findClearButton(render(panelSrc("TK valid"))));
const panelRepeatSrc = x => `<$tiddler tiddler="${x}"><$let section-target="${x}" section-mode="panel" section-type={{{ [is[current]tag[$:/GSD/Action]then[action]else[project]] }}}><$transclude $tiddler="$:/plugins/yan/hypergsd-ticklers/ui/attributes/tickler-repeat" $mode="block"/></$let></$tiddler>`;
t("panel repeat section shows when a date exists", /Repeat after days/.test(txt(render(panelRepeatSrc("TK valid")).c)));
wiki.addTiddler({title: "TK undated", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "false"});
const undatedPanel = txt(render(panelRepeatSrc("TK undated")).c);
t("panel repeat section hidden without a date", undatedPanel.indexOf("Repeat after days") === -1);
t("panel: clear button hidden without a date", !findClearButton(render(panelSrc("TK undated"))));
wiki.addTiddler({title: "TK clearing", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "false", gsd_tickler_date: midnight(5), gsd_tickler_date_history: midnight(5)});
const clearBtn = findClearButton(render(panelSrc("TK clearing")));
if (clearBtn) clearBtn.invokeActions(clearBtn, {type: "click"});
t("clear click removes the field", fields("TK clearing").gsd_tickler_date === undefined);
t("clear click leaves the history untouched", JSON.stringify(historyOf("TK clearing")) === JSON.stringify([midnight(5)]));
t("clear click hides the button on re-render", !findClearButton(render(panelSrc("TK clearing"))));
wiki.deleteTiddler("TK clearing");
wiki.deleteTiddler("TK undated");
wiki.addTiddler({title: "TK project", tags: "$:/GSD/Project", gsd_status: "active"});
t("panel section hidden on a project", txt(render(panelSrc("TK project")).c) === "");

// ── Shift buttons (panel-only, on the date section; they move the DATE) ─────
wiki.addTiddler({title: "TK shift-target", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "false", gsd_tickler_date: midnight(6)});
const shiftButtonsOf = r => { const out = []; (function f(n){ if(!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
  if(n.parseTreeNode && n.parseTreeNode.tag === "$button" && (n.domNodes||[])[0]) out.push(n); (n.children||[]).forEach(f); })(r.w.children); return out; };
const buttonLabel = b => ((b.domNodes||[])[0] ? (b.domNodes[0].children||[]).map(x => x.textContent || "").join("") : "");
const clickShift = (title, label) => {
  const r = render(panelSrc(title));
  const b = shiftButtonsOf(r).find(x => buttonLabel(x) === label);
  if (b) b.invokeActions(b, {type: "click"});
  return !!b;
};
let adv = render(panelSrc("TK shift-target"));
t("panel: three shift buttons render (+d +w +m)", shiftButtonsOf(adv).map(buttonLabel).filter(Boolean).join(" ") === "+d +w +m");
t("panel shift buttons render invisible (hugging the panel row)", shiftButtonsOf(adv).filter(b => buttonLabel(b)).every(b => String(((b.domNodes||[])[0].attributes||{}).class).includes("tc-btn-invisible")));
t("panel: buttons carry no dismissal actions (binding unbound)", shiftButtonsOf(adv).every(b => !b.getAttribute("actions")));
t("panel section has no stray widget markup as text", !/<\/?\$[a-zA-Z]/.test(txt(adv.c)));
t("panel: tooltips resolve through lingo", ((shiftButtonsOf(adv)[1] || {domNodes: [{attributes: {}}]}).domNodes[0].attributes || {}).title === "Add 7 days");
t("modal: shift buttons absent (panel-only)", shiftButtonsOf(render(modalSrc("action"))).length === 0);
t("panel: no shift buttons without a date", (() => {
  wiki.addTiddler({title: "TK undated-adv", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "false"});
  const count = shiftButtonsOf(render(panelSrc("TK undated-adv"))).length;
  wiki.deleteTiddler("TK undated-adv");
  return count === 0;
})());
clickShift("TK shift-target", "+w");
t("shift: +w pushes the date 7 days at midnight", fields("TK shift-target").gsd_tickler_date === midnight(13));
t("shift: the new date joins the history", JSON.stringify(historyOf("TK shift-target")) === JSON.stringify([midnight(13)]));
clickShift("TK shift-target", "+d");
t("shift: +d composes onto the moved date", fields("TK shift-target").gsd_tickler_date === midnight(14));
clickShift("TK shift-target", "+m");
t("shift: +m adds a fixed 30 days", fields("TK shift-target").gsd_tickler_date === midnight(44));
t("shift: history is chronological, last entry = current date", JSON.stringify(historyOf("TK shift-target")) === JSON.stringify([midnight(13), midnight(14), midnight(44)]));
t("repeat section carries no buttons now", shiftButtonsOf(render(panelRepeatSrc("TK shift-target"))).length === 0);
wiki.deleteTiddler("TK shift-target");

// ── The shared widget standalone (explicit parameters, no tag list) ────────
wiki.addTiddler({title: "TK widget-target", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "false", gsd_tickler_date: midnight(10)});
const widgetRender = render(`<$hgsd.tickler-shift target-tiddler="TK widget-target" base-date="${midnight(10)}" days="3" label="plain label" tooltip="plain tip"/>`);
const widgetButtons = shiftButtonsOf(widgetRender);
t("widget renders one button from explicit parameters", widgetButtons.length === 1 && buttonLabel(widgetButtons[0]) === "plain label");
t("widget resolves a plain tooltip through wikify", ((widgetButtons[0].domNodes||[])[0].attributes || {}).title === "plain tip");
t("widget without a class carries only the print-only shift hook (no screen styling)", ((widgetButtons[0].domNodes||[])[0].attributes || {}).class === "hgsd-tickler-shift");
if (widgetButtons.length === 1) {
  widgetButtons[0].invokeActions(widgetButtons[0], {type: "tm-generic"});
  t("widget shifts the date by its days parameter", fields("TK widget-target").gsd_tickler_date === midnight(13));
  t("widget records the history", JSON.stringify(historyOf("TK widget-target")) === JSON.stringify([midnight(13)]));
}
const badRender = render(`<$hgsd.tickler-shift target-tiddler="TK widget-target" base-date="garbage" days="3" label="x"/>`);
const badButtons = shiftButtonsOf(badRender);
if (badButtons.length === 1) {
  badButtons[0].invokeActions(badButtons[0], {type: "tm-generic"});
  t("widget writes nothing on an unparseable base-date", fields("TK widget-target").gsd_tickler_date === midnight(13));
} else {
  t("widget renders on an unparseable base-date", false);
}
wiki.deleteTiddler("TK widget-target");

const suffixSrc = x => `<$tiddler tiddler="${x}"><$transclude $tiddler="$:/plugins/yan/hypergsd-ticklers/ui/list-items/tickler" $mode="block"/></$tiddler>`;
const suffixEditTexts = c => {
  const out = [];
  (function f(n){ if(!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
    if(n.parseTreeNode && n.parseTreeNode.tag === "$edit-text") out.push(n); (n.children||[]).forEach(f); })(c.w);
  return out;
};
const suffixRender = render(suffixSrc("TK valid"));
const suffixInputs = suffixEditTexts(suffixRender);
t("row suffix renders the in-place date input", suffixInputs.length === 1);
t("row suffix input targets the row's tickler field", suffixInputs[0] && suffixInputs[0].getAttribute("tiddler") === "$:/temp/hgsd-date/TK valid/gsd_tickler_date");
t("row suffix hidden without a tickler date", txt(render(suffixSrc("TK undated-input")).c) === "");
let suffixStrayGt = 0;
(function f(n){ if(!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
  if(n.isTiddlyWikiFakeDom){ (n.children||[]).forEach(f);
  } else if ((n.textContent || "").trim() === ">") suffixStrayGt++;
})(suffixRender.c);
t("row suffix has no stray > text node (chevron-count guard)", suffixStrayGt === 0);

// ── Alert body: title link, core checkbox, snooze re-dates ───────────────────
wiki.addTiddler({title: "$:/temp/alert/TK valid", tags: "$:/tags/Alert", component: "Tickler due",
  modified: $tw.utils.stringifyDate(new Date()), text: '<$transclude $variable="hgsd-tickler-alert"/>'});
const alertWidget = render(`<$tiddler tiddler="$:/temp/alert/TK valid"><$transclude/></$tiddler>`);
const alertText = txt(alertWidget.c);
t("alert body renders the title link + Complete + both snooze buttons", [/TK valid/.test(alertText), /Complete/.test(alertText), /\+d/.test(alertText), /\+w/.test(alertText)].every(Boolean));
t("alert body carries no go-to button or legacy snooze captions", !/go to action|snooze a (day|week)/.test(alertText));
let alertSvgLeaks = 0;
(function f(n){ if(!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
  if(!n.isTiddlyWikiFakeDom && /<.svg|svg>/.test(n.textContent || "")) alertSvgLeaks++;
})(alertWidget.c);
t("alert body has no literal svg-tag leak", alertSvgLeaks === 0);
let alertStrayGt = 0;
(function f(n){ if(!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
  if(!n.isTiddlyWikiFakeDom && (n.textContent || "").trim() === ">") alertStrayGt++;
})(alertWidget.c);
t("alert body has no stray > text node", alertStrayGt === 0);
t("alert body has no stray widget markup as text", !/<\/?\$[a-zA-Z]/.test(alertText));
// The core checkbox contract: one raw input carrying the dispatch attributes
const alertInputs = findInputs(alertWidget.c);
t("alert body carries the core-contract Complete checkbox",
  alertInputs.length === 1 && alertInputs[0].attributes["data-tiddler"] === "TK valid" &&
  alertInputs[0].attributes["data-hgsd-action"] === "complete" && !alertInputs[0].attributes.checked);
const buttonWidgets = shiftButtonsOf(alertWidget);
t("alert body carries exactly the two Alert-tag list buttons", buttonWidgets.map(buttonLabel).join(" ") === "+d +w");
t("alert shift buttons keep the browser-default look", buttonWidgets.every(b => !String(((b.domNodes||[])[0].attributes||{}).class).includes("tc-btn-invisible")));
// Filtered transclusion linkifies its output titles — the captions must render as literal text (exactly one anchor: the title link)
const alertAnchors = [];
(function f(n){ if(!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
  if(n.isTiddlyWikiFakeDom && n.tag === "a") alertAnchors.push(n); (n.children||[]).forEach(f); })(alertWidget.c);
t("shift labels are plain text, the title is the only link", alertAnchors.length === 1 && /TK valid/.test(txt(alertAnchors[0])));
const shiftButtons = buttonWidgets.filter(b => /action-deletetiddler[\s\S]*tickler-alert-title/.test(String(b.getAttribute("actions") || "")));
t("alert shift members carry the bound dismissal actions", shiftButtons.length === 2);
if (buttonWidgets.length === 2) {
  // The browser click handler: child actions (the shift) then the actions attribute (the dismissal)
  buttonWidgets[0].invokeActions(buttonWidgets[0], {type: "tm-generic"});
  const reDated = fields("TK valid").gsd_tickler_date;
  const reDatedDate = reDated && $tw.utils.parseDate(reDated);
  t("shift re-dates the action to a future midnight",
    reDatedDate && reDatedDate.getTime() > Date.now() && reDatedDate.getTime() < Date.now() + 2 * DAY &&
    reDatedDate.getUTCHours() === 0 && reDatedDate.getUTCMinutes() === 0);
  t("shift: the new date joins the history", JSON.stringify(historyOf("TK valid")) === JSON.stringify([reDated]));
  buttonWidgets[0].invokeActionString(buttonWidgets[0].getAttribute("actions"), buttonWidgets[0], {type: "click"});
  t("shift click dismisses the alert", !wiki.getTiddler("$:/temp/alert/TK alert"));
}

// ── Completion dismissal + toolbar-close re-raise ─────────────────────────────
wiki.addTiddler({title: "TK al-target", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "false", gsd_tickler_date: todayAlert});
wiki.addTiddler({title: "$:/temp/alert/TK al-target", tags: "$:/tags/Alert", component: "Tickler due",
  modified: $tw.utils.stringifyDate(new Date()), text: '<$transclude $variable="hgsd-tickler-alert"/>'});
const completeAlert = render(`<$tiddler tiddler="$:/temp/alert/TK al-target"><$transclude/></$tiddler>`);
let catcher = null;
(function f(n){ if(catcher||!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
  if(n.parseTreeNode && String(n.parseTreeNode.tag || "").replace(/^\$/, "") === "eventcatcher") catcher = n; (n.children||[]).forEach(f); })(completeAlert.w);
t("alert body wraps its controls in the shared-dispatch eventcatcher",
  !!catcher && catcher.getAttribute("selector") === ".hgsd-interactive input, .hgsd-interactive button");
if (catcher) {
  // The browser path: handleEvent → invokeActionString($click, this, event, dom-data variables)
  catcher.invokeActionString(catcher.getAttribute("$click"), catcher, {type: "click"},
    {"dom-data-hgsd-action": "complete", "dom-data-tiddler": "TK al-target"});
  t("complete click completes the target through the shared handler",
    fields("TK al-target").gsd_complete === "true" && !!fields("TK al-target").gsd_comp_date);
  t("complete click dismisses the alert", !wiki.getTiddler("$:/temp/alert/TK al-target"));
  openAlertDay();
  runCheck();
  t("completed target is not re-raised", !wiki.getTiddler("$:/temp/alert/TK al-target"));
  // The pre-state branch: a click on an already-complete target uncompletes it and the alert stays
  wiki.addTiddler({title: "$:/temp/alert/TK al-target", tags: "$:/tags/Alert", component: "Tickler due",
    modified: $tw.utils.stringifyDate(new Date()), text: '<$transclude $variable="hgsd-tickler-alert"/>'});
  const staleAlert = render(`<$tiddler tiddler="$:/temp/alert/TK al-target"><$transclude/></$tiddler>`);
  let staleCatcher = null;
  (function f(n){ if(staleCatcher||!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
    if(n.parseTreeNode && String(n.parseTreeNode.tag || "").replace(/^\$/, "") === "eventcatcher") staleCatcher = n; (n.children||[]).forEach(f); })(staleAlert.w);
  if (staleCatcher) {
    const staleInputs = findInputs(staleAlert.c);
    t("stale alert re-renders the checkbox checked", staleInputs.length === 1 && !!staleInputs[0].attributes.checked);
    staleCatcher.invokeActionString(staleCatcher.getAttribute("$click"), staleCatcher, {type: "click"},
      {"dom-data-hgsd-action": "complete", "dom-data-tiddler": "TK al-target"});
    t("uncomplete click restores the target", fields("TK al-target").gsd_complete === "false");
    t("uncomplete click keeps the alert", !!wiki.getTiddler("$:/temp/alert/TK al-target"));
    wiki.deleteTiddler("$:/temp/alert/TK al-target");
  } else {
    t("stale alert eventcatcher found", false);
  }
}
wiki.deleteTiddler("$:/temp/alert/TK due-now");
runCheck();
t("toolbar-closed banner stays dismissed for the rest of the day", !wiki.getTiddler("$:/temp/alert/TK due-now"));
wiki.addTiddler({title: "TK late-add", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "false", gsd_tickler_date: todayAlert});
runCheck();
t("a same-day addition dated today raises nothing", !wiki.getTiddler("$:/temp/alert/TK late-add"));
wiki.addTiddler({title: "$:/temp/hypergsd/Ticklers/AlertDay", text: midnightLocal(-1).substring(0, 8)});
runCheck();
t("the next day's first check re-raises the unhandled tickler", !!wiki.getTiddler("$:/temp/alert/TK due-now"));
t("...and the same-day addition with it", !!wiki.getTiddler("$:/temp/alert/TK late-add"));
// ── Dashboard: three date-split sections, old ticklers behind the toggle ─────
// Fresh TKD fixtures (unique non-prefix titles, untouched by the cases above).
wiki.addTiddler({title: "TKD overdue", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "false", gsd_tickler_date: past});
wiki.addTiddler({title: "TKD today", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "false", gsd_tickler_date: today});
wiki.addTiddler({title: "TKD soon", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "false", gsd_tickler_date: future});
wiki.addTiddler({title: "TKD old-done", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "true", gsd_comp_date: past, gsd_tickler_date: past});
wiki.addTiddler({title: "TKD rolled", tags: "$:/GSD/Action", gsd_status: "next", gsd_complete: "true", gsd_comp_date: past, gsd_tickler_date: future});
const dashRender = () => render(`<$tiddler tiddler="GSD/Ticklers"><$transclude $tiddler="GSD/Ticklers" $mode="block"/></$tiddler>`);
let dash = dashRender();
const section = (whole, from, to) => { const a = whole.indexOf(from), b = whole.indexOf(to); return a >= 0 && b > a ? whole.substring(a, b) : ""; };
const dashTxt = txt(dash.c);
const req = section(dashTxt, "Ticklers requiring action", "Upcoming ticklers");
const upc = section(dashTxt, "Upcoming ticklers", "show old ticklers");
t("dashboard: three sections in order",
  [dashTxt.indexOf("Ticklers requiring action") >= 0, dashTxt.indexOf("Upcoming ticklers") > dashTxt.indexOf("Ticklers requiring action"), /show old ticklers/.test(dashTxt)],
  [true, true, true]);
t("dashboard: overdue + today under requiring action", [req.includes("TKD overdue"), req.includes("TKD today")], [true, true]);
t("dashboard: future under upcoming, none leaked into requiring action", [upc.includes("TKD soon"), req.includes("TKD soon"), upc.includes("TKD overdue")], [true, false, false]);
t("dashboard: old hidden until toggled, rolled complete tickler rests in upcoming",
  [dashTxt.includes("TKD old-done"), upc.includes("TKD rolled")], [false, true]);
// The toggle's own button — identified by its resolved set target, because
// rows carry Contextualise $buttons earlier in the tree.
const toggleBtn = (() => { let btn = null;
  (function f(n){ if(!n||btn||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
    if(n.parseTreeNode && n.parseTreeNode.tag === "$button" && n.set === "$:/state/hypergsd/show-completed/GSD/Ticklers") { btn = n; return; } (n.children||[]).forEach(f); })(dash.w.children);
  return btn; })();
if (toggleBtn) {
  toggleBtn.setTiddler();
  t("toggle: state written to the page's show-completed namespace", fields("$:/state/hypergsd/show-completed/GSD/Ticklers").text, "show");
  const dash2 = dashRender();
  const dash2Txt = txt(dash2.c);
  t("toggle: old ticklers revealed, rolled complete tickler stays in upcoming",
    [dash2Txt.includes("Old ticklers"), dash2Txt.includes("TKD old-done"), dash2Txt.includes("TKD rolled"), /hide old ticklers/.test(dash2Txt)],
    [true, true, true, true]);
} else {
  t("toggle button found in dashboard", false);
}
t("dashboard carries no manual check button", (() => {
  const buttons = []; (function f(n){ if(!n||typeof n!=="object")return; if(Array.isArray(n))return n.forEach(f);
    if(n.isTiddlyWikiFakeDom && n.tag === "button") buttons.push(n); (n.children||[]).forEach(f); })(dash.c);
  return !buttons.some(b => /check ticklers/i.test((b.children||[]).map(x => x.textContent || "").join("")));
})());


console.log(fails === 0 ? "ALL TICKLER CASES PASS" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);