---
name: hypergsd-maintenance
description: Maintenance and development of the HyperGSD plugin in TiddlyWiki. Use when editing HyperGSD tiddlers, fixing dashboard lists, or maintaining the tag-driven ($:/GSD/Action, $:/GSD/Project, etc.) architecture.
---

# HyperGSD maintenance

This skill provides specialized knowledge for maintaining the HyperGSD plugin in TiddlyWiki.

## Core architecture

### Tag-driven identity
HyperGSD identifies items through specific system tags under the `$:/GSD/` prefix:

- `$:/GSD/Action` — next actions
- `$:/GSD/Project` — projects
- `$:/GSD/Contact` — contacts
- `$:/GSD/Reference` — reference material

All database queries route through TW's C-level tag index for instant lookups.

The `$:/tags/hypergsd/Type` tag list tiddler carries NO `list` field — membership comes from the tag index, and the type dropdown's order is engine-determined (title-sorted); pin a specific position with `list-before`/`list-after` on an individual type tiddler.

Which fragment renders on an item's page is tag-dispatched: the view-body slot pulls in everything tagged `$:/tags/hypergsd/ViewPlacement`, and each placement member's own filter picks its type and side — sub-plugins add page panels with zero main-plugin coupling (the references panel arrives purely as a ViewPlacement member).

### Realms (tag-based)
Realms use a tag prefix system: `$:/GSD/Realm/Work`, `$:/GSD/Realm/Home`, etc. Because they start with `$:/`, they are system tags and don't clutter the tag pills.

- **Multi-realm**: A tiddler can carry multiple realm tags.
- **Catch-all**: Items with zero realm tags are "catch-all" — they appear in every realm view unless filtered out.
- **Auto-discovery**: Available realms are discovered via `[all[tags]prefix[$:/GSD/Realm/]removeprefix[$:/GSD/Realm/]]`.
- **State**: The current realm is stored in `$:/state/hypergsd/CurrentRealm` (defaults to `All`).
- **Dashboard filtering**: A shared `hgsd-realm-filter` macro applies set-arithmetic to efficiently combine catch-all items with realm-specific items.
- **Creation**: `$hgsd.new-button` seeds `$:/state/hypergsd/effective-realm` from its `gsd-realm` parameter only when unset; the realm Inheritance rule applies the state value plus every caller realm tag at creation (the button forwards the resolved caller — parameter else currentTiddler — into the modal; multi-item caller harvests must ride the list filter, never a triple-brace `$let` attribute, which truncates to the first item).

### Contexts (opt-in)
A context is a tiddler tagged `$:/tags/hypergsd/Context` — that tag is the sole identifier. Actions are assigned to a context by carrying the context's title as a regular tag (e.g., `@Phone`), so an action's effective contexts are its tags filtered through `[tag[$:/tags/hypergsd/Context]]`. Contexts are created through the modal's context type, which tags the new tiddler with `$:/tags/hypergsd/Context`.

On creation, contexts are inherited as a union: the sidebar "Context for new stuff:" selection (`$:/state/hypergsd/effective-context`), any context explicitly picked in the modal, and the caller's context tags — combined in the contexts sub-plugin's Inheritance-rail member (`modules/inheritance/context-tags.tid`), the same state-default + pick + caller-harvest shape as the realm rule, then applied via `tm-add-tag` inside `create-gsd-tiddler`. `$hgsd.new-button` forwards the RESOLVED caller into tm-modal (explicit parameter else currentTiddler), so panel and list quick-adds inherit everything the rail harvests — contexts, every caller realm tag, informal tags; sidebar and toolbar buttons render with a blank currentTiddler and forward nothing. Context, reference and contact types receive no context tags. Dashboard injection into context tiddlers uses `[is[current]tag[GSD/Contexts]]`.

The contextualise row fragment (incomplete actions AND projects) keys its state, temp and popup titles per COPY, not per row: `contextualise-<row>-<group>-<scope>`, where group is the ambient `current-group` from the grouped renderer (empty in flat lists) and scope is the list's `listState` title stripped of its `$:/temp/gsd-list/` prefix (separates copies across list instances; derived above the group loop, so grouped copies share it and differ only by group). Per-row `$qualify` cannot replace this scheme: its hash is identical for every row of a list (so a per-row state was shared list-wide and other rows' stale writes made buttons look dead) and identical for grouped copies. A copy that appears when a context is added has no state tiddler and renders closed, so the picker input's `focus="yes"` never scrolls the new copy into view. All refresh-gate whitelists match these titles by prefix, so the suffixes ride along with no gate edits.

### Per-type status persistence
The modal uses typed status fields (`gsd_action_status`, `gsd_project_status`) to persist the user's selection across type switches. When a status radio is clicked, the event handler sets both `gsd_status` and the per-type field. When switching types, the display and submit procedures check the per-type field first; if absent, they fall back to type-appropriate defaults ("next" for action, "active" for project).

### Performance architecture
- **EventCatcher**: A single `<$eventcatcher>` handles clicks for entire dashboard lists, replacing hundreds of individual checkbox/radio widgets.
- **Pure HTML rendering**: Dashboards use raw `<input>` and `<button>` tags controlled by CSS classes, flattening the widget tree for better parse-tree caching.
- **Frozen refresh triggers**: Dashboards are wrapped in `<$refresh>` widgets that block updates during global actions (like typing in search).
- **Statically-cached dropdowns**: Contact, project, and prerequisite dropdowns have stripped dynamic variables and implicit `OR` operators.
- **Per-instance list state**: `$hgsd.list` and `project-references` derive the collapse-state title once per list — `$:/temp/gsd-list/<host>-<heading>-<qualify-hash>` — and rows read it ambiently as `listState`. The host/heading chain sits inside one outer bracket pair (a chain written after a closed literal run silently drops — see the mechanics skill).
- **List headings fold (GSD5's mechanism)**: every heading is the label of a hidden `$checkbox` (checked=hide / unchecked=show) writing `listState`; the rows sit in a `$reveal` on it, and the folded-state indicator is an `hgsd-fold-chevron` reveal hanging in the gutter LEFT of the text — absolutely positioned so the text start stays fixed across fold states, and its svg square-clamped (see the mechanics skill's transcluded-image sizing constraint). The mechanism is GSD5's unchanged (born 2015-02-06 in gsd5-core, hidden checkbox from day one; full history at gitlab.com/gsd5-tiddlywiki/gsd5-core) — when an inherited control misbehaves, check the ancestor's behaviour before suspecting the port's markup.
- **A stateful control needs EVERY ancestor gate to admit its writes, not just the nearest one**: the fold write passes view-body gate → chassis gate → `$hgsd.list`'s outer gate → the reveal, and each gate returns false independently. The engine's own two gates carry the scoped pair (`[prefix[$:/temp/gsd-list/]]` plus a `!prefix` subtraction run — heading-scoped at the list gate via `list-fold-prefix`, host-scoped at the chassis via `this-list-prefix`, mirroring the view-body gates' idiom); engine-owned state rides base runs (the show-completed precedent), member-owned state rides `hgsd-refresh-whitelist` declarations. Worked starvation: the refresh-gate work landed without the pair and the fold died silently on every surface — the state tiddler flipped on click but no DOM moved, and any admitted change made the UI catch up out of nowhere; the inner gate's `[match<listState>]` admission was unreachable because the outer gate blocked first. Symptom signature for any frozen control: state tiddler correct, DOM stale, spontaneous catch-up on admitted writes — audit every ancestor gate, not just the nearest.
- **List filters carry no base sorts**: the default filter source is title-sorted (mechanics skill), so a `tag[]`-led pipeline is already alphabetical, and where the sort strip is on its effective SortBy member re-sorts the rows regardless — a trailing `sort[title]` or duplicated `!nsort` run was dead weight (ties fall to the default title order either way). Only non-title keys do real work in-filter: tickler dates, prereq completion, subproject status.
- **Generic pickers inside the dashboard chassis declare their prefixes**: `hgsd-dashboard-portions`' refresh gate DERIVES its feature-owned runs from member declarations — Row-fragment members' and the tag list's members' `hgsd-refresh-whitelist` fields, plus Strip members found transitively through members' `hgsd-heading`. A plain `$hgsd.pick`/`pick-append` rendered as a chassis member still freezes shut unless its member declares the popup/temp prefixes in that field (hosting at PAGE level, above the chassis transclusion, remains the zero-declaration route — ui/dashboards/Contacts.tid + hgsd-contact-select is the worked shape); a Strip tag-list member declares on itself and every gate that renders it picks the runs up.
- **Feature state under `$:/config/hypergsd/*` rides every existing refresh gate**: the chassis, `$hgsd.list`'s outer gate and the view-body gates all carry a `[prefix[$:/config/hypergsd]]` run, so a selection/config tiddler there live-updates dashboards with ZERO gate edits — the contact-filter selection tiddler lives there for that reason (persistence across reloads comes free; see the mechanics skill's namespace rules).
- **Feature-owned gate runs derive from `hgsd-refresh-whitelist` declarations**: a stateful member (Row placement fragment, Strip member, Lists member, ViewPlacement body) carries its state prefixes in that field — single bracketed prefix runs, space-separated — and every gate that renders it composes them: the row freeze, `$hgsd.list`'s outer and per-list gates, the dashboard chassis, the view-body gates, the placement slot (`hgsd-row-feature-runs` reads the fixed Row pair; Panel-placement members are read-only adornments and keep state under gate-admitted prefixes instead). The chassis finds Strip members transitively: members' `hgsd-heading` lingo titles resolve to heading text, matched against `hgsd-strip-host` (the sentinel member keeps the anchored regex from compiling empty — an empty regexp matches everything). Scoped `:and` pairs (the modal add- pair, show-completed) stay hand-written in host gates; `tests/gate-purity-test.js` fails if a sub-plugin namespace is hand-copied back into the main plugin.

### The Fragment root and config-driven fragment behaviour
Fragments live under ONE root: `$:/tags/hypergsd/Fragment/` — `Row/Prefix` and `Row/Suffix` (the closed pair; `hgsd-item`'s loops around the title link, one placement tag per member) and `Panel` (after a value link — pick-field's set state, the prereq rows; `hgsd-panel-items(linked-tiddler)` hosts them, `panel-tag` overrides the family for an exotic host). The cross-realm globe is NOT a fragment: the row composer, pick-field and the prereq rows call `hgsd-realm-warning` directly — one indicator behind one switch (`$:/config/hypergsd/realm-warning`), never on contexts. Every gate carries `[prefix[$:/tags/hypergsd/Fragment]] [tags[]prefix[$:/tags/hypergsd/Fragment]]`, so placement tag edits live-refresh everywhere.

Config decides fragment behaviour without editing fragments:

* ''Visibility'' — `$:/config/hypergsd/Fragment/<placement-path>/visibility/<member>` reading show/hide (absent = show), per placement, the base derived from the tag.
* ''Type suppression'' — `$:/config/hypergsd/Fragment/type-hide/<full member title>/<type>` reading hide (absent = show). The row engine gates every fragment on the row item's hgsd-type; `hgsd-panel-items` gates on the link TARGET's type, derived once per call through the Type tag list. The settings boxes are PLAIN field checkboxes on these tiddlers (the actions-string variable trap is why — see the mechanics skill).
* ''Settings → Fragments'' is data-driven over the root: one draggable per placement tag TIDDLER (title-prefix enumeration, so empty placements stay as drag targets), a per-row placement select (label = the tag tiddler's caption; the retag is one prefix strip) and one tick box per type in the type vocabulary. Placement names: Row/Prefix "Row, before title", Row/Suffix "Row, after title", Panel "Panel or modal, after link".
* ''Shipped default matrix'' (seeds under each OWNING plugin's `ui/config/type-hide/`, one line each): everything on actions; nothing on contacts or contexts; on projects only the status selector, project link, priority select, trash button and contextualise button; on references only the project link.

### The pick family and the prereq twins
`$hgsd.pick` (the engine) has two presentation shells in `modules/widgets/`: `$hgsd.pick-field` (three-state single-value field editor) and `$hgsd.pick-append` (one-row list adder). Both share the create-and-add/new-button fork through `hgsd-new-options` (in pick-field.tid), whose `kind` picks the create fork's write shape (`field`/`own`/`item`); `new-project`/`new-complete`/`tooltip`/`caption` are ambient-guarded passthroughs pick-field never defines. The DependsOn/PrereqOf panels are thin callers of two shared components keyed by ONE direction bit and vocabulary: `hgsd-prereq-row(item, direction)` for the display row (ui/components/prereq-row.tid) and `$hgsd.pick-append(direction)` for the add side — `own` writes the viewed action's list, `item` writes the row item's. Do not name a future widget `$hgsd.pick-list`: the picker's internal pipeline already owns the procedure name `hgsd-pick-list()` (the option-list step).

**Affordance matrix:** the Add/Save buttons of both shells render only for a pick commitable without creation — an `<%if create-gate %>`/`<%elseif non-blank %>` pair reusing hgsd-pick-keyboard-commit's create gate verbatim (a combined single-filter form does not parse and its error literal is truthy — tested), riding the per-keystroke refresh the create gate always used; each row declares its buttons in order through one elseif on the create gate — `hgsd-new-options` (the kind-mapped create-and-add button, UNGATED by contract: transcluded inside the gate's then-branch, i.e. in the commit slot) and `hgsd-new-fallback` (the self-gated plain new button, last); and pick-field's set state carries an icon-only clear button between the link and change (`clear-button="hide"` opts out; tooltip core `Buttons/Clear/Caption`) that blanks the field directly — clearing no longer depends on "open the editor, leave it empty, save" (the keyboard's blank commit still clears).

**Keyboard commits create:** every keyboard-commit site of the family (pick-append's add-row, pick-field's empty and editing states — the key is each row's `$keyboard` binding, Enter by default) routes through `hgsd-pick-keyboard-commit` (in pick.tid, beside its sibling `hgsd-pick-commit`): a non-blank pick naming no existing tiddler — gated additionally on `new-type` being set — runs the shared creation core `hgsd-create-and-add-actions` (create-and-add.tid, split out of the button shell for exactly this), with the ambient `direction` playing `hgsd-new-options`' kind bit; anything else commits exactly as the row's own Add/Save button (blank pick still clears a field-kind target). The dispatcher is parameterless beyond `close-state` (pick-field's editing state passes its reveal), reads the caller's ambient scope, and uses only actions-string-safe forms (`{{{ }}}` filter attributes, `<%if%>` gates — the hgsd-pick-commit pattern); the existence check evaluates ONLY when the bound key is pressed because the whole dispatcher lives inside the keyboard's actions string.

### Ticklers sub-plugin (behaviour contract)
All policy lives in `hypergsd-ticklers/modules/tickler-check.tid` (a `$:/tags/Global` wikitext procedure); `modules/startup/tickler.js` is timing only — browser-side, runs the procedure at startup, top of every hour and local midnight. Never move policy into the JS.

- **Raise window**: due-day-or-overdue on the LOCAL calendar clock — the stored 17-char UTC date minus its nine trailing zeros compared `lteq` the local 8-char date; future and unparseable dates drop out by string comparison ("NaN…" sorts after digits).
- **Completion gating**: incomplete ticklers always raise; completed ticklers raise only with a POSITIVE repeat interval (`get[gsd_tickler_repeat_days]else[0]compare:integer:gt[0]` — the same absent/empty/zero/non-numeric = one-shot convention the rollover uses; plain `has[]` would match a literal "0" and nag hourly with nothing to stop it). A completed one-shot stays silent.
- **Banner title** is computed per item (`Tickler due` vs `Tickler overdue` lingo keys, `Sections.multids`) through a `$let`-bound `then<var>else<var>` chain on the date comparison — the alert's `component` field; `modified` carries the stored date.
- **One banner per occurrence** comes from the snapshot semantics (see the mechanics skill): the raise renders against the pre-roll date, and the rollover's write lands after — so a repeating tickler cannot re-raise within a cycle. Unhandled ONE-SHOT banners re-raise on the FIRST CHECK OF EACH LOCAL DAY (a toolbar-closed banner returns while its raise condition still holds): the raise passes are gated on `$:/temp/hypergsd/Ticklers/AlertDay` — a temp tiddler whose text is the local day whose pass has already run, written by the pass itself; absent or stale text opens the gate, so a fresh session and the midnight run both raise. The rollover stays ungated — it must keep rolling on every check after the gate closes.
- **No revival pass** — deliberate. Completion always sticks; the banner is the "due again" signal. GSD5 parity was considered and rejected on both halves: GSD5 never un-completed (its nag was an always-true `day !== NaN` guard rolling dates by `undefined × 86400000 = NaN`, re-alerting hourly on garbage dates forever), and hourly-forever overdue nagging was also declined — one overdue banner per missed occurrence instead.
- **Dashboard** (`GSD/Ticklers`): "requiring action" = incomplete + date ≤ today; "Upcoming" = any completion state with a future date (completed repeating ticklers rest here between cycles — without this they would be invisible once revival was removed); "Old ticklers" = complete + past, behind a toggle.
- **Shift-button visibility**: the Settings → HyperGSD → Ticklers tab (`ui/control-panel/ticklers`) is an `hgsd-visibility-list` per tag — the Shift list (panel set, base `$:/config/hypergsd/Ticklers/Shift/visibility/`) and the Alert list (banner set, `$:/config/hypergsd/Ticklers/Alert/visibility/`), one independent knob per surface; the bases sit under `$:/config/hypergsd/`, so they ride the view-body refresh gates unchanged. Shipped members: day/week/month/year tagged Shift, day/week additionally tagged Alert (+d/+w on the banner); the year member ships WITHDRAWN — `ui/config/shift-visibility-year.tid` (its visibility entry reads hide, the GroupBy/status mechanism; the `visibility/` vocabulary, not GroupBy's `hidden/`) — so the settings row renders unticked and the panel shows +d/+w/+m until the user ticks +y on.
- Known accepted quirks: dismissing a repeating tickler's banner is permanent for that cycle (reload does not restore — the roll consumed the date), an ignored repeating tickler leaves "requiring action" for "Upcoming" on its due day, and the day gate silences a tickler given a due date mid-session until the next day's first check (a reload re-opens the gate — the marker is temp — so banners return on session restart).

### Print architecture (paper is CSS only)
TiddlyWiki has no print mode: `tm-print` just calls `window.print()`, and paper shows whatever `@media print` rules leave standing over the live DOM (core strips sidebar/topbar/tiddler controls; the TiddlyTools print popup ships the same stylesheets through `$:/core/ui/PageStylesheet`, so one rule set covers both paths). Family rules live in `hypergsd/ui/stylesheet/print.tid` (plus priorities' own block), all plain class selectors at (0,1,0):

- **Control hooks, unconditional:** `hgsd-change-button` (pick-field's change), `hgsd-clear-button` (the value-clear × — an OPT-IN contract: any surface adopting the hook hides on paper wherever it lives: pick-field, prereq rows, the contacts filter, the tickler date), `button:has(> .hgsd-new-hint)` (the "new" fallback), `gsd-list-new-button` (list quick-adds), `gsd-gsdpanel-button` (convert), `gsd-button` (icon-only row buttons: delete/context/trash), `hgsd-pick-append-row` (every add-row — interaction, not data, hidden even beside populated rows).
- **Blank fields, behind the Behaviour toggle** (`$:/config/hypergsd/print-blank-fields`, show default / hide opt-in): hosts carry `hgsd-print-hide-blank` (single-value pickers, empty DependsOn/PrereqOf sections), the rule keying on `:not(:has(a.tc-tiddlylink))` — a set field or prerequisite row always renders a link, the unset state never an anchor; the tickler date carries `hgsd-print-hide-blank-input` keyed on `:not(:has(.hgsd-clear-button))`, because a set date renders the clear ✕ and never an anchor. Hosts compute the class from the config (`get[text]else[show]match[hide]then[hook]`), so the toggle live-updates via the config prefix the view-body gate already carries.
- **Never hide an element that carries a display rule:** `display: none` at (0,1,0) loses to an equal-specificity rule in a stylesheet sorting later in the `$:/tags/Stylesheet` tag list. The pick-append add-row's flex comes from the base stylesheet, so its print hook sits on a display-rule-free wrapper div — that wrapper exists precisely so no specificity escalation is ever needed (see the mechanics skill).

### Priorities colours (dictionary → generated rules, the pills.tid shape)
`hypergsd-priorities/ui/config/colours` is the single source, three keys per letter: `A` the fill, `A-ink` text and icons (applies in EVERY media — print keeps it, the browser drops only the fill), `A-line` the print-only outline ink. No template carries a colour: the stylesheet generates `.hgsd-priority-A { --priority-fill/ink/line }` per letter (`getindex`, grey fallbacks), panel rows carry `hgsd-priority-<letter>` hook classes, selection fills via `:has(input:checked)`, the clear ✕'s ink and the row select's closed box ride the same custom properties, and the dropdown's `option[value]` rules read the dictionary directly (the `$select` widget drops foreign attributes on options). Settings → HyperGSD → Priorities edits all three roles (core palette-manager inputs; the Line column is marked print only) plus Name/Short strings; the table's letter column centres by a class rule because core's `.tc-control-panel table > tbody > tr > td { text-align: start }` overrides the `align` attribute the table parser emits for space-padded cells.

## TW patterns and anti-patterns

### Lingo key naming
Tooltip strings in the language files use `Hint` as the key segment, matching TW core's `Buttons/*/Hint` convention — never `Tooltip`, and never glued (`AddHint`); the idiomatic shape is the path form `Add/Hint`. The widget attribute is still `tooltip=` (TW's own attribute name); only the key is Hint. Visible button text uses the `Caption`/`Label` segment (core's `Buttons/*/Caption`), which also disambiguates pairs like `Add/Hint` (tooltip) vs `Add/Caption` (label) in the DependsOn/PrereqOf families.
- **Field namespace**: plugin-custom tiddler fields carry the `hgsd-` prefix on plugin-owned tiddlers (tag-list members, fragments, list blocks, temp pickers, view state — e.g. `hgsd-group-filter`, `hgsd-refresh-whitelist`, `hgsd-pick`, `hgsd-group`); user-item data keeps `gsd_`; core-convention field names (`caption`, `description`, `list`) stay unprefixed; widget-local variables and parameters are exempt.
- **Interpolated names split across two lingo strings** (the CreateAdd pattern): `…/HintA` + `…/HintB` sandwich a title — plain filter concatenation for `title`/tooltip attributes (no HTML survives an attribute), `<q><$text text=<<var>>/></q>` for visible labels (create-and-add's button and the contact entry's × tooltip are the shipped examples; contact-select derives its tooltip with `addsuffix`).
- **No aria-labels**: nothing ships `aria-label`. A control's accessible name comes from its visible text, or falls back to its `title` — and every HyperGSD control that needs naming carries `tooltip=` (the Hint), which is the `title`. One string, one attribute; the Hint covers both hover and screen-reader naming. No separate Aria lingo keys exist.

### Adding tags to a tiddler: use `tm-add-tag` + `$fieldmangler`

When you need to add a tag to a tiddler after creation (e.g., a context or realm tag), use the built-in `tm-add-tag` message wrapped in a `<$fieldmangler>`. This is the canonical TW approach — it handles multi-word tags, spaces, and special characters natively without any filter gymnastics.

```html
<$fieldmangler tiddler=<<createTiddler-title>>>
  <$action-sendmessage $message="tm-add-tag" $param=<<realm-tag>> />
  <$action-sendmessage $message="tm-add-tag" $param="@out and about" />
</$fieldmangler>
```

**Never** try to construct tag strings with `join[ ]` and `format:titlelist[]` — the filter pipeline for spaced tags is fragile, scope-dependent, and repeatedly fails across TW versions. `tm-add-tag` just works.

### Variable scope in procedure invocations vs filter strings

Procedure parameters (e.g., `gsd-context`, `gsd-realm`) are template variables within the procedure body's widget tree (like `<%if%>` blocks), but they do NOT reliably resolve inside filter STRINGS passed to action widgets (like `$subfilter="[<gsd-context>]"` or `$tags="+[<gsd-context>]"`). The filter parser evaluates these strings at action-time, where the procedure's parameter scope may be unavailable.

- **Safe**: `<%if [<gsd-context>!match[none]] %>` — widget conditionals use the live template scope.
- **Unsafe**: `$subfilter="[<gsd-context>]"` in `$action-listops` — the filter string may resolve `<gsd-context>` to `currentTiddler` (the modal) instead of the procedure parameter.

To pass values into action-widget filter strings, compute them in a `<$let>` variable first and reference that.

### Filter runs in `{{{ }}}` are additive but fragile

In TiddlyWiki's `{{{ }}}` filter evaluation, consecutive `[run]` steps add their results to the pipeline (they don't filter each other). This is how tags are built:

```
{{{ [<type>match[action]then[$:/GSD/Action]] [<realm>] [<context>] +[join[ ]] }}}
```

However, this pattern only works reliably for simple values without spaces. Tags with spaces (like `@out and about`) break when passed through `join[ ]` because the resulting string is re-parsed as space-separated tokens by TW's tag storage. Use `tm-add-tag` for those instead.

### Multi-operand `match[a][b][c]` breaks inside then/else chains

A multi-operand `match` silently fails when combined with `then[...]`/`else[...]` — both branches come back empty even for literals:

```
<$let raw="A [[B b]]" ft="action">
{{{ [<ft>match[context][reference][contact]then[]else[XYZ]] }}}   ← empty (broken)
```

Single-operand `match[x]then[..]else[..]` works. For "if none of these match" semantics, use the negated form, which works correctly with multiple operands:

```
{{{ [<final-type>!match[context][reference][contact]then<raw-value>] }}}
```

### Runs cannot be nested inside runs

A filter run must not contain another bracketed run — `[ [<var>get[field]] :and[tag[x]] ]` is a parse error ("Missing [ in filter expression"). Each source pipeline must be its own top-level run; validate or transform the combined output with trailing modifier runs instead:

```
{{{ [<new-data-title>get[gsd_context]] [[$:/state/x]get[text]] +[tag[$:/GSD/Contact]] +[unique[]] }}}
```

### Keep the modal's tag computation in `hgsd-modal-submit`

The `hgsd-modal-submit` procedure runs in the modal template scope where all variables (temp tiddler fields, button parameters, state tiddlers) resolve correctly. Compute complex values here and pass them as parameters to `create-gsd-tiddler`, which should be a thin wrapper that just fires actions based on its parameters.

## Headless battery conventions

The battery lives in the repo at `tests/` (one wiki boot per `*-test.js`; `npm test` or `node tests/run-all.js [substring]` runs it under `TZ=UTC` with aggregated exit codes — pure node, no shell dependency). The fixture wikis sit beside it: `tests/fixture-wiki` (the FAMILY symlinks point at the repo's own `plugins/`, so the battery tests the source tree, not wiki copies; a kookma-trashbin symlink comes from a wiki folder outside this repo) and `tests/fixture-absent` (main plugin only). Data-driven cases live in `tests/wiki-tests/*.tid` (fixtures + Output + ExpectedResult + optional Actions, `+`-separated, after upstream TiddlyWiki's own wiki-test format): the runner resets fixtures per case, renders through the standard Global import chain, runs the actions and refreshes before comparing innerHTML. Derive expected HTML with `node wiki-tests.js --show <case>` (or `--show-after` for post-action state), VERIFY it is semantically right, then freeze it into `ExpectedResult`.

Conventions for new or modified tests:

- Use `tests/lib/harness.js` (array-safe `t(name, got, want)` deep-compare — a boolean-form helper must carry the `Array.isArray` guard) and isolate sections with `resetFixtures(wiki)`.
- Treat the CURRENT plugin code as correct — a failing expectation means a stale expectation: probe the live render, name the mechanism, update the expectation (only if a string contradicts what the user approved is the STRING wrong).
- Benchmarks (`node tests/run-bench.js`, one process per `*-bench.js`) rewrite `tests/portion-bench-results.json` as a side effect — `git checkout --` it after a bench session so the tree stays clean. A/B method: 3 baseline passes for a noise floor, swap the variant in by editing sources, 3 more passes, restore; a difference inside the pass-to-pass spread of one variant is noise, not signal. Scale note from the fold-machinery A/B: per-LIST widgets (a `$qualify` + checkbox + two reveals) sit three-plus orders of magnitude below per-ROW fragment cost and never surfaced at any benchmarked surface — bench before stripping list-level widgets for performance.
- `stray-markup-test.js` parse-audits every wikitext tiddler under `$:/plugins/yan/` for stray widget markup rendered as literal text (an unbalanced `</$let>` renders in the UI while functional click tests still pass), with a self-test so the detector cannot go vacuous.
- Widget-tree assertions that check WHERE a widget writes should resolve titles via `widget.getAttribute("tiddler")`/`getAttribute("set")` — the parse-tree attribute — not widget-class properties (EditWidget stores `editTitle`, CheckboxWidget `checkboxTitle`; `getAttribute` is the one resolver that works for every class, and the title strings often come from filter chains that broke silently — assert the assembled title, not just that the widget exists).
- Fixture rows meant to appear in dashboard lists must carry `gsd_complete: "false"` EXPLICITLY: the lists filter on the positive `gsd_complete[false]` test, and a missing field does not match it.

Run the WHOLE battery after any change (`npm test` in the repo) — and especially after user-facing string changes: expectations embed rendered strings, and live user edits to plugin language files (e.g. a settings-string rewording) surface here as stale expectations. When a check fails on a string, compare against the shipping `.multids` value before touching the harness — but if the string contradicts what the user approved, fix the STRING.

## Directory constraints
- **Plugin source**: the canonical source is THIS repository — `plugins/<name>/` (main plugin plus the six sub-plugins). Any copies inside another wiki's `plugins/` directory are generated; never edit them directly, and never use `$tw.wiki.addTiddler()` to modify plugin tiddlers.
- **The repository is itself a wiki**: its `tiddlers/` folder holds the plugin family's documentation tiddlers (tagged `Documentation`/`HyperGSD API`), served by running `tiddlywiki . --listen` in the repository root. Never treat that folder as scratch space.
- **Tests**: the headless battery and fixture wikis live in the repo's `tests/` (`npm test`; family symlinks point at the repo plugins, so tests run against the source, pre-sync). Conventions for writing or modifying tests live in the tiddlywiki-develop-with-playwright skill.
- **Shadow tiddlers**: Tiddlers in `tiddlers/` override plugin tiddlers with the same `title:` field. Shadows can only come from historical in-memory pushes (no longer used) or intentional user overrides — the local-first workflow never creates them. If a plugin change doesn't take effect, check for a shadow; ask before deleting any shadow found. See the preferences skill for how to find one.