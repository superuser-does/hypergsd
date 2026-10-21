# HyperGSD status-system benchmark — before/after

Protocol: `tests/status-bench.js` (headless, fakeDOM, synthetic corpus at
live scale — 905 actions / 81 projects / 50 references, statuses 35/25/40,
one in ten actions completed; 20 reps, medians in ms) and a served copy of the
live wiki on port 38081 (real data; story-driven opens with poll-settling,
node-identity re-render detection; 10 reps items/modal, 5-8 reps heavy pages).
Browser timings include deferred story rendering but exclude paint.

## BEFORE (2026-09-04, pre-MVV implementation)

### Headless

| metric | median | p95 |
|---|---|---|
| filter next actions | 0.682 | 1.066 |
| filter waiting actions | 0.479 | 0.531 |
| filter future actions | 0.650 | 0.669 |
| filter active projects | 0.082 | 0.128 |
| filter future projects | 0.039 | 0.065 |
| render next-action-list (514 row elements) | 662.9 | 753.0 |
| render waiting-action-list (288) | 370.9 | 429.3 |
| render future-action-list (500) | 625.5 | 695.7 |
| render active-project-list (130) | 148.8 | 159.4 |
| status-change refresh (open list) | 800.9 | 820.0 |
| panel render (view-body) | 14.1 | 18.9 |
| status-change refresh (open panel) | 11.6 | 15.5 |
| modal status cascade render | 1.82 | 2.06 |
| stylesheet render | 1.02 | 1.13 |

### Browser (real data, port 38081)

| metric | median | p95 |
|---|---|---|
| open action tiddler | 111.1 | 168.5 |
| open project tiddler | 150.9 | 165.1 |
| open reference tiddler | 92.6 | 97.7 |
| open GSD/Dashboard | 1946.1 | 2395.1 |
| open GSD/Project Dashboard | 546.7 | 556.0 |
| status click, panel, item alone | 87.8 | 108.5 |
| status click, panel, dashboard + item open | 1684.2 | 1989.9 |
| status click, dashboard row | 1675.0 | 1786.0 |
| new-item modal open | 40.9 | 48.4 |

## AFTER (2026-09-04, status registry + MVV implementation — final build)

Re-run after the regressions found in live verification were fixed (pill
class computation, label fallback, refresh-whitelist runs). The first AFTER
pass had measured mid-fix builds; these are the shipping numbers.

### Headless

| metric | before | after | delta |
|---|---|---|---|
| filter next actions | 0.682 | 0.681 | flat |
| filter waiting actions | 0.479 | 0.474 | flat |
| filter future actions | 0.650 | 0.645 | flat |
| filter active projects | 0.082 | 0.079 | flat |
| filter future projects | 0.039 | 0.037 | flat |
| render next-action-list (514 row elements) | 662.9 | 662.9 | flat |
| render waiting-action-list (288) | 370.9 | 370.3 | flat |
| render future-action-list (500) | 625.5 | 625.1 | flat |
| render active-project-list (130) | 148.8 | 155.8 | +5% |
| status-change refresh (open list) | 800.9 | 903.8 | +13% (band across runs: 783–904; see note) |
| panel render (view-body) | 14.1 | 14.5 | flat |
| status-change refresh (open panel) | 11.6 | 12.6 | +9% |
| modal status cascade render | 1.82 | 1.76 | flat |
| stylesheet render | 1.02 | 3.06 | +2ms absolute, once per restyle |

Measurement note: the stylesheet metric is G-wrapped in AFTER to match
production's page-level imports. A bare-rootWidget render of the loop
version hits a pathological resolution path (~245ms) that production never
uses — the artefact initially looked like a 236× regression.

### Browser (real data, port 38081, final build)

| metric | before | after | delta |
|---|---|---|---|
| open action tiddler | 111.1 | 110.0 | −1% |
| open project tiddler | 150.9 | 154.3 | +2% |
| open reference tiddler | 92.6 | 94.2 | +2% |
| open GSD/Dashboard | 1946.1 | 1997.7 | +3% |
| open GSD/Project Dashboard | 546.7 | 540.2 | −1% |
| status click, panel, item alone | 87.8 | 89.9 | +2% |
| status click, panel, dashboard + item open | 1684.2 | 1620.9 | −4% |
| status click, dashboard row | 1675.0 | 1636.4 | −2% |
| new-item modal open | 40.9 | 37.7 | −8% |

Verdict: the final build performs at baseline everywhere in the browser.
The one headless metric above its noise band is the open-list
status-change refresh (median 904 on the final run; earlier runs on the
same build measured 783–874, single before-read 801) — a per-row re-render
now also resolves the item's type registry entry and per-pill label/glyph
lookups; worst-case reading is ~+7% on a path that ends up dominated by
the row's widget rebuild. The stylesheet's +2ms absolute is the generated
colour-rule loop, paid once per restyle, not per interaction.

## Row freeze (2026-09-04, later the same day)

Improvement #1/#2 from the post-status-registry review. Each row now sits
behind its own `$refresh` gate (`hgsd-item`), whose whitelist is COMPOSED
per list: the engine base (`[match<currentTiddler>]`, fragment registries
+ visibility config, drafts) plus every ListItem fragment's
`refresh-whitelist` field — fragments declare their own state deps
(contextualise, tickler pick popups) instead of main-plugin whitelist
edits. An unrelated item edit now costs one filter evaluation per
unchanged row instead of descending its whole fragment tree.

| metric | before | after | delta |
|---|---|---|---|
| status-change refresh (open list, headless) | 800–904 | 205–214 | **−75%** |
| status click, panel + dashboard open (browser) | 1621 | 1037–1056 | **−35%** |
| status click, dashboard row (browser) | 1636 | 1032 | −37% |
| open GSD/Dashboard (browser) | 1998 | 1778 | −11% |
| renders, filters, panel, modal, stylesheet | — | — | unchanged |

Phase 2 (native membership patching — a live `$list` owning the item
filter so membership changes insert/remove single rows instead of
rebuilding the list via the `hgsd-filter-buster`) was attempted and
REVERTED: under the gate chain the live list did not re-filter on item
changes (rows went stale — completing an action left it listed), and the
derivation `$let`s that must sit above the list rebuild it anyway when
their values change. The remaining ~1s on click-with-dashboard is the
membership rebuild of the affected lists; fixing it needs the scope
arithmetic rewritten as pipeline-consuming runs and the derivation moved
out of the list's ancestry — a bigger restructure than the prize
justified today. Battery 15/15 throughout; node-identity and
whitelist-composition regression cases added to list-items-test.

## Hardcoded status vocabulary (2026-09-06)

The status sets stopped riding the Type registry: `hgsd-status-set/-default`
bodies carry the literals (zero registry reads per call), the registry's
statuses/default-status fields were removed, the colour loop iterates the
two type keys directly, and the row's item-type resolution dropped its
full-source subtraction run for an input-driven `tag[]` check. Extension
moved to whole-tiddler shadowing of status-sets (type gate carries the
refresh run). Backup: `~/tiddlywiki-backups/pre-hardcode-20260906`.

| metric | baseline | hardcoded | + row item-type fix |
|---|---|---|---|
| filter next actions | 0.740 | 0.644 | 0.668 |
| filter waiting actions | 0.496 | 0.426 | 0.438 |
| filter future actions | 0.772 | 0.602 | 0.612 |
| filter active projects | 0.102 | 0.080 | 0.082 |
| filter future projects | 0.046 | 0.033 | 0.033 |
| render next-action-list (514 rows) | 1031.3 | 940.5 | 942.3 |
| render waiting-action-list (288) | 526.9 | 509.6 | 507.3 |
| render future-action-list (500) | 894.2 | 876.2 | 882.7 |
| render active-project-list (130) | 170.9 | 166.0 | 169.6 |
| status-change refresh (open list) | 633.2 | 610.6 | 646.3 |
| panel render (view-body) | 15.8 | 16.0 | 17.5 |
| status-change refresh (open panel) | 14.9 | 13.8 | 15.1 |
| modal status cascade render | 1.97 | 1.82 | 1.82 |
| stylesheet render | 3.44 | 3.25 | 3.22 |

Verdict: flat within noise. The filter deltas (−13…−28%) are jitter — those
filters never touch the status system. Row renders sit inside the run-to-run
band (per-row deltas inconsistent across lists, 0.04–0.18ms): the registry
read was never the row bottleneck — row cost is dominated by widget
construction and per-pill glyph/label lookups. The hardcode stands on
simplification (no per-call registry resolution, one lookup mechanism
fewer), not speed; the row item-type fix is kept as strictly less work per
row (O(item tags) vs a full-source sweep) that scales with wiki size.
Battery 16/16; shadow-replacement regression cases live in sections-test.

## Widget-tree depth telemetry (2026-09-26)

New section 7 in `tests/status-bench.js` (no timing change — the
sections above all sat inside their run-to-run bands). Background: a past
build hit the browser's raw "maximum call stack size exceeded" after
widening `$refresh` whitelists. The engine's recursion guards count the
wrong unit for this plugin — `MAX_WIDGET_TREE_DEPTH` counts widgets (1000)
while the stack counts JS frames (~10k in Chrome), and a HyperGSD level
(gate attribute evaluation, refreshSelf cascades, per-row executes) costs
far more frames than the simple transcludes the 1000 guard was calibrated
for. Estimate: the raw RangeError fires at a widget depth of roughly
150–400, before the engine's own friendly recursion error can trip. The
probe walks the rendered widget tree of the worst surfaces and reports
depth, gates on the deepest path, and the core-visible ancestor count;
advisory budget 150 from the rendered root (the page chassis adds ~30
above).

| surface | depth | gates on path | ancestors | widgets |
|---|---|---|---|---|
| engine list (next-action-list, context-tagged rows) | 90 | 3 | 91 | 40,834 |
| panel (view-body) | 67 | 1 | 68 | 407 |
| dashboard chassis (GSD/Action dashboard) | 105 | 4 | 106 | 63,538 |
| context page (view-body-context) | 103 | 4 | 104 | 1,101 |

Measured 2026-09-26, later the same day, after adding the context-page
surface and context-tagged fixture rows: rows carrying a context tag run
~12 levels deeper than plain rows (the context chip's macrocall/transclude
chain), so the dashboard's deepest path now runs through a context-tagged
row — realistic data, kept. Verdict: every shipped surface sits at ≤70% of
budget, worst 105/150. The shipped one-level nesting (a context page — the
inline lists mount at a view-template slot BESIDE the panel body, so the
full panel stack does not sit above them) measures 103, well under the
earlier ~140–170 arithmetic estimate. That estimate applies only to the
hypothetical of an engine list rendered from INSIDE a row fragment
(row tip ~105 + engine stack ≈ 155–180) — unreachable through today's data
model (context tiddlers never appear as rows in action lists), and the
shape to refuse if a future feature reaches for it: mount inner lists at
a page slot or trade the inline render for a link. The probe exists to
catch drift before the stack does; re-run it whenever a gate layer or
nested-list feature is added.

## Context chips via tag-pill-body (2026-09-26, later still)

The contexts fragment now invokes core's tag-pill-BODY directly instead of
the outer tag-pill macro (G' of the chip-depth options). Prototyping showed
the ladder's middle hop is load-bearing — palette sections
({{$:/palette##tag-background}}) only resolve in macro-parameter text
position, not in attribute position, so any parity-preserving pill needs
two define hops; the promised single-hop component was infeasible. Dropping
the OUTER hop (wrap + currentTiddler rebind only) is the whole available
saving: the pill chain went 17 → 12 levels from the contexts loop, with
cascades (colour/icon) and the palette pointer moving to the call-site
attributes. Pixel parity verified in the served wiki, including a custom
per-tag colour (color field → cascade → pill → contrast against the
palette) and the style string's core formatting.

| surface | before | after |
|---|---|---|
| dashboard chassis | 105 | 100 |
| context page | 103 | 98 |
| engine list (context-tagged rows) | 90 | 85 |

Timings all inside their run-to-run bands. The bench now also asserts chip
presence on the context page (tag-pill-body is a core-internal macro name —
a core rename would otherwise break the chips silently).
