# HyperGSD status-system benchmark

Protocol: `tests/status-bench.js` (headless, fakeDOM, synthetic corpus at
live scale — 905 actions / 81 projects / 50 references, statuses 35/25/40,
one in ten actions completed; 20 reps, medians in ms). Run it before and
after touching the status system or list rendering, and compare medians
against the current snapshot. Section 7 also reports widget-tree depth —
see the depth-budget rationale below for why that number matters.

## Current snapshot (2026-10-21, commit 27c04a0)

| metric | median | p95 |
|---|---|---|
| filter next actions | 0.585 | 1.112 |
| filter waiting actions | 0.369 | 0.482 |
| filter future actions | 0.443 | 0.609 |
| filter active projects | 0.056 | 0.082 |
| filter future projects | 0.022 | 0.024 |
| render next-action-list (514 rows) | 948.5 | 1059.8 |
| render waiting-action-list (288 rows) | 496.5 | 599.2 |
| render future-action-list (500 rows) | 880.2 | 940.4 |
| render active-project-list (130 rows) | 176.7 | 181.7 |
| status-change refresh (open list) | 530.2 | 552.1 |
| panel render (view-body) | 16.9 | 21.2 |
| status-change refresh (open panel) | 12.8 | 18.6 |
| modal status cascade render | 1.6 | 2.9 |
| stylesheet render | 1.2 | 1.7 |

Widget-tree depth telemetry (advisory budget 150 from the rendered root —
the page chassis adds ~30 above these surfaces):

| surface | depth | gates on path | ancestors | widgets |
|---|---|---|---|---|
| engine list (next-action-list) | 72 | 3 | 73 | 48,167 |
| panel (view-body) | 73 | 1 | 74 | 480 |
| dashboard chassis (GSD/Action dashboard) | 95 | 4 | 96 | 74,939 |
| context page (view-body-context) | 90 | 4 | 91 | 1,215 |

Worst surface is at 64% of budget. Re-run the probe whenever a gate layer
or nested-list feature is added.

## Design decisions behind the numbers

### Per-row `$refresh` gates (row freeze)

Each row sits behind its own `$refresh` gate (`hgsd-item`), whose
whitelist is COMPOSED per list: the engine base
(`[match<currentTiddler>]`, fragment registries + visibility config,
drafts) plus every ListItem fragment's `refresh-whitelist` field —
fragments declare their own state deps (contextualise, tickler pick
popups) instead of main-plugin whitelist edits. An unrelated item edit
now costs one filter evaluation per unchanged row instead of descending
its whole fragment tree (−75% on the headless open-list refresh at
introduction; −35% on the browser status-click with dashboard open).

Native membership patching (a live `$list` owning the item filter so
membership changes insert/remove single rows instead of rebuilding the
list via the `hgsd-filter-buster`) was attempted and REVERTED: under the
gate chain the live list did not re-filter on item changes (rows went
stale — completing an action left it listed), and the derivation `$let`s
that sit above the list rebuild it anyway when their values change.
Fixing it needs the scope arithmetic rewritten as pipeline-consuming runs
and the derivation moved out of the list's ancestry — refuse this shape
unless that restructure happens. Node-identity and
whitelist-composition regression cases live in `list-items-test`.

### Hardcoded status vocabulary

The status sets do not ride the Type registry: `hgsd-status-set/-default`
bodies carry the literals (zero registry reads per call), the registry's
statuses/default-status fields were removed, the colour loop iterates the
two type keys directly, and the row's item-type resolution uses an
input-driven `tag[]` check — O(item tags) instead of a full-source sweep,
so it scales with wiki size. Extension is by whole-tiddler shadowing of
status-sets (the type gate carries the refresh run). Timings were flat
within noise at introduction — the hardcode stands on simplification (no
per-call registry resolution, one lookup mechanism fewer), not speed.
Shadow-replacement regression cases live in `sections-test`.

### Depth budget rationale

The engine's recursion guards count the wrong unit for this plugin:
`MAX_WIDGET_TREE_DEPTH` counts widgets (1000) while the browser stack
counts JS frames (~10k in Chrome), and a HyperGSD level (gate attribute
evaluation, refreshSelf cascades, per-row executes) costs far more frames
than the simple transcludes the 1000 guard was calibrated for. A past
build hit the browser's raw "maximum call stack size exceeded" after
widening `$refresh` whitelists; the raw RangeError is estimated to fire
at a widget depth of roughly 150–400, before the engine's own friendly
recursion error can trip — hence the advisory budget of 150. Rows
carrying a context tag run deeper than plain rows (the context pill's
macrocall/transclude chain), so expect the dashboard's deepest path to
run through a context-tagged row. The shape to refuse: an engine list
rendered from INSIDE a row fragment (row tip ~95 + engine stack ≈
145–180) — mount inner lists at a page slot or trade the inline render
for a link. The shipped one-level nesting (a context page — the inline
lists mount at a view-template slot BESIDE the panel body, so the full
panel stack does not sit above them) is the approved shape.

### Context pills via tag-pill-body

The contexts fragment invokes core's tag-pill-BODY directly instead of
the outer tag-pill macro. The ladder's middle hop is load-bearing —
palette sections ({{$:/palette##tag-background}}) only resolve in
macro-parameter text position, not in attribute position, so any
parity-preserving pill needs two define hops; dropping the OUTER hop
(wrap + currentTiddler rebind only) is the whole available saving, with
cascades (colour/icon) and the palette pointer moving to the call-site
attributes. The bench asserts pill presence on the context page
(tag-pill-body is a core-internal macro name — a core rename would
otherwise break the pills silently).
