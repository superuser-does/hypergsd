# HyperGSD plugin code map

`$:/plugins/yan/hypergsd` v0.10.0 — "Get Stuff Done in hypermedia", a hard fork of
GSD5 by Yannis Anthymidis (MIT; GSD5 lineage credited in `contributors.tid`).
Requires core >= 5.4.0 (uses `\widget`/`\procedure`, `<$eventcatcher>`,
`<$messagecatcher>`, `\whitespace trim`). No official docs; the wiki tiddlers
"Migrating from GSD5 to HyperGSD" and "HyperGSD Project Showcase" are the only
prose references. Everything below is hand-verified against the sources.

Architecture thesis: identity lives in **tags** (`$:/GSD/Action|Project|Contact|Reference`,
`$:/GSD/Realm/<name>`, `GSD/Contexts`), all lists render through a
frozen-refresh (double-gated in the list engine) + delegated-events pipeline, and
every dashboard/list surface is a tag-driven transclusion stack. There is exactly
**one JavaScript file** (third-party `refresh.js`, 69 lines); all logic is wikitext.

## 1. Identity

| | |
|---|---|
| Plugin | `$:/plugins/yan/hypergsd` v0.10.0 (`plugin.info`) |
| Author | Yannis Anthymidis (fork); upstream GSD5 by Roma Quintin Hicks et al. |
| License | MIT (`license.tid`, (c) 2023 roma.hicks) |
| Core requirement | >= 5.4.0 |
| Content | 202 `.tid`/`.multids`/`.js` files + `plugin.info` (185 tid + 16 multids + 1 js); counts verified 2026-09-11 |
| Docs | wiki tiddlers only (migration guide + showcase); `readme.tid` is a stub; `ui/readme.tid` (`$:/language/Help/hypergsd/about`) is a stale GSD5 leftover |
| Language | en-US/GB only |

## 2. Code organisation

```
plugins/hypergsd/
├── plugin.info                  plugin manifest (list: readme)
├── readme.tid, license.tid, contributors.tid
├── modules/
│   ├── event-handler.tid        hgsd-handle-click — THE click dispatcher ($:/tags/Global);
│   │                            hgsd-handle-complete-event(item-title) = the
│   │                            completion cluster (warning gate + confirm modal +
│   │                            hgsd-do-complete + the optional story close);
│   │                            hgsd-do-complete(item-title) = the shared completion
│   │                            toggle (fields + dependant promotion); completing
│   │                            gates on the Complete/Warning tag list first;
│   │                            hgsd-close-completed(item-title) = the optional
│   │                            story-river close, three-mode config
│   │                            $:/config/hypergsd/close-on-complete (never/
│   │                            own-page/always — always closes from any origin,
│   │                            own-page only the item's own page; direct
│   │                            $:/StoryList write)
│   ├── type-gate.tid            Global/View \procedure hgsd-type-gate (generic
│   │                            refresh-gate run; View scope — see §3/§6 note)
│   ├── run-after-create.tid     Global \procedure hgsd-run-after-create — the shared
│   ├── status-sets.tid          Global \functions hgsd-status-set(type)/
│   │                            hgsd-status-default(type) + \procedures
│   │                            hgsd-status-label/hgsd-row-glyph — the status
│   │                            vocabulary is HARDCODED in the two functions
│   │                            (2026-09-06; tag list fields removed —
│   │                            replacement = shadow the whole tiddler),
│   │                            with lingo-key-or-word label/glyph fallbacks
│   │                            AfterCreation hook runner (both creation
│   │                            paths; §5)
│   ├── realm-scopes.tid         Global \procedures: scope-list + scoping
│   │                            arithmetic (must stay Global — pick/pick-field
│   │                            reach the modal, where Global/View resolves not)
│   │                            (hgsd-realm-selection/-all, hgsd-scope-include/exclude)
│   ├── create-and-add.tid       Global \procedure pair (split 2026-09-27):
│   │                            hgsd-create-and-add (the shared "create
│   │                            «typed» and add" picker button) now a thin
│   │                            shell over hgsd-create-and-add-actions (the
│   │                            creation core — callable from actions strings,
│   │                            every dynamic attribute a {{{ }}} filtered
│   │                            transclusion); gate at each caller:
│   │                            [<typed-pick>!match[]] :and[!is[tiddler]];
│   │                            callers: hgsd-new-options (pick-field's two set
│   │                            states and pick-append's kind=own/item forks),
│   │                            the modal's project/contact/context pickers and
│   │                            hgsd-pick-keyboard-commit (the keyboard fork);
│   │                            target-mode=append uses
│   │                            action-listops so list fields (gsd_prerequisites)
│   │                            gain the title rather than being replaced, and
│   │                            new-project passes the host's project through;
│   │                            label via $slot with English default, tooltip
│   │                            param — i18n hooks)
│   ├── convert-warnings/        Convert/Warning fragments (see hgsd-convert)
│   ├── complete-warnings/       Complete/Warning members (tag's list field
│   │                            IS the membership — [list[]], not tagging[];
│   │                            ambient host-title; output = modal links)
│   └── widgets/                 all hgsd-* (refresh.js is the only JS file)
│       ├── refresh.js           <$refresh> widget (refresh inhibitor)
│       ├── hgsd-list.tid        $hgsd.list + hgsd-render-inner + hgsd-item (primary
│       │                        rendering engine; Global/View). VIEW STRIP (2026-09-05: grouping, +same-day sort + persistent config home;
│       │                        labels now CAPTION-DRIVEN — hgsd-view-label renders
│       │                        the member's caption FIELD via <$tiddler>+field
│       │                        transclusion (get[caption] returns raw {{…}} text;
│       │                        the $tiddler-attr form rendered EMPTY in fakedom —
│       │                        wrapper form is the working one), lingo-key fallback
│       │                        kept for caption-less third parties; Settings →
│       │                        Dashboards gains drag-ordered GroupBy/SortBy lists
│       │                        (since 2026-09-06 hgsd-visibility-list calls over
│       │                        view-option-item-template — the core row whose
│       │                        checkbox is the OFFERED toggle: unticking writes hide under
│       │                        $:/config/hypergsd/<Tag list>/hidden/<member>, withdrawing the
│       │                        member from every strip and picker; view states/defaults naming
│       │                        it fall back via the choice chains, explicit group-members is
│       │                        exempt, and the hidden/ BASE tiddlers ship reading hide so
│       │                        empty candidates are withdrawn by construction;
│       │                        order-list/order-item-template retired); since 2026-09-06 the
│       │                        PER-LIST settings pages swap the draggable's item
│       │                        template to ui/components/list-item-template: core
│       │                        row + portion-picker + a Group by / Sort by pair
│       │                        whose selects bind $:/config/hypergsd/list-default/
│       │                        <heading> NATIVELY (the strip's own write mechanism —
│       │                        no state/actions plumbing), each list tiddler
│       │                        carrying a heading FIELD naming its heading's lingo
│       │                        tiddler so Settings and the widget derive the same
│       │                        key from list-heading; a leading "List default"
│       │                        option (value "") clears the field; the widget's
│       │                        default chain is view state → list-default config →
│       │                        invocation parameters, and heading-sharing lists
│       │                        (completed + cleanup pairs) share one default;
│       │                        MIGRATED same day to EVERY review-sidebar dashboard
│       │                        list — group-default/sort-default are tag list
│       │                        TITLES preserving each list's prior behaviour
│       │                        (action lists grouped by project, completed lists
│       │                        by completion date via the new typed completed-desc/
│       │                        -asc SortBy members; project member now typed
│       │                        action+project+reference; five dashboards renamed
│       │                        to their sidebar labels; dashboard-grouping config
│       │                        + checkbox + lingo deleted);
│       │                        helpers unified same day — hgsd-view-label (lingo+
│       │                        fallback labels for BOTH tag lists) and
│       │                        $hgsd.view-relevant (slot-bearing relevance guard
│       │                        for every member loop; fixed two latent bugs:
│       │                        list-types was bound only under the grouping control
│       │                        so sort-only lists never filtered, and bare
│       │                        uncategorised sort options skipped relevance);
│       │                        list-types hoisted above both controls
│       │                        $:/config/hypergsd/list-view/<host>/<heading> with
│       │                        hgsd-group/hgsd-ungrouped/hgsd-sort fields — the config prefix run
│       │                        alone gates every level now, scoped pairs deleted):
│       │                        Strip tag-list members lead the row (since
│       │                        2026-09-27: $:/tags/hypergsd/Strip, each member
│       │                        bound by hgsd-strip-host = a list heading; they
│       │                        render OUTSIDE the choice gate so member-hosted
│       │                        popups stay live — their state prefixes ride the
│       │                        row gate and chassis gates; first shipped member:
│       │                        the Contacts page's filter picker), then the
│       │                        Sort by select (sort-select; $:/tags/hypergsd/SortBy
│       │                        members: hgsd-sort-filter = COMPLETE suffix-run
│       │                        expression, multi-field = more runs; hgsd-sort-category
│       │                        optgroups; relevance contract shared) FIRST, then
│       │                        grouping radios — since 2026-09-13 offered via ONE
│       │                        derivation (offered-group-members, titlelist string:
│       │                        explicit group-members or tag list minus hidden minus
│       │                        type-irrelevant, relevance as a per-member regex
│       │                        test on hgsd-types — types-regex's · alternative
│       │                        passes universal members — radios iterate the string,
│       │                        and an EMPTY set withdraws the whole Group by block
│       │                        incl. the None radio, the row surviving only for a
│       │                        Sort by select); sort applies via the composed-
│       │                        variable rows-filter ([loop-base] [sort-expr]
│       │                        +[join[ ]], passed whole to $list — subfilter does
│       │                        NOT reorder, and macrocalls inside quoted filter
│       │                        attrs are literal); ONE grouped renderer
│       │                        (hgsd-render-grouped) + ONE flat (hgsd-render-flat),
│       │                        fed either by the strip's chosen member or by legacy
│       │                        group-by via the constant subfilter string
│       │                        "[all[current]get<group-by>]" (self-bracketed — subfilter
│       │                        parses the value as a whole filter); group-select="yes" renders a radio
│       │                        strip (leading None = flat) per $:/tags/hypergsd/GroupBy member;
│       │                        members may declare hgsd-types (absent = universal) and the
│       │                        strip offers only dimensions matching the list's own items'
│       │                        types (derived INSIDE the buster gate — item edits never
│       │                        re-run it); group-members="<filter>" overwrites the offered
│       │                        set outright (type relevance skipped), composing from
│       │                        hgsd-group-default = the tag tiddler's list field (data-only:
│       │                        hgsd-group-key/hgsd-group-filter/optional hgsd-label-filter; label
│       │                        via lingo fallback to the key) + include-ungrouped
│       │                        toggle; per-list state
│       │                        $:/state/hypergsd/list-group/<host>/<heading>. Strip
│       │                        SPACING: the row is a flex container whose gap
│       │                        spaces the controls — the gap guarantees a space
│       │                        after every colon in every locale, so no hug
│       │                        rules, class hooks or spacer entities sit
│       │                        between strip children. The
│       │                        generic branch's :map/:filter expressions MUST live
│       │                        in $list filter attributes — a triple-brace $let
│       │                        attr with a multi-item :map silently evaluates EMPTY;
│       │                        :map:flat for multi-key items; :and[unique[]sort[title]!match[]]
│       │                        dedupes (a +[unique[]] append does not). The scoped
│       │                        list-group prefix pair is whitelisted in THREE gates
│       │                        (chassis, outer derivation, inner freeze) — miss one
│       │                        and the strip freezes shut live. OUTER DERIVATION GATE
│       │                        (2026-09-01): the $let tree computing all-titles +
│       │                        realm scope sits inside its own <$refresh> — before it,
│       │                        every global refresh descent re-evaluated the filters
│       │                        (~0.3ms × items × visible lists per unrelated edit;
│       │                        285ms→3ms at 1000 actions). Whitelist = what the
│       │                        derivation reads: type gate + realm TAG-tiddler prefix
│       │                        + config prefix + [!is[tiddler]] (deletions — see §3).
│       │                        NO input-driven realm-membership run: :and replaces
│       │                        accumulated output, wiping the type-gate run (only one
│       │                        :and chain per filter; suffix runs append).
│       ├── hgsd-new-button.tid  $hgsd.new-button + gsd-select-action
│       ├── hgsd-pick.tid        $hgsd.pick searchable picker (generic group-by,
│       │                        realm scoping; 6 internal procedures — the fifth,
│       │                        hgsd-pick-commit (2026-09-06), runs from the
│       │                        select's actions for INSTANT COMMITS: commit-kind
│       │                        field/append/append-to-picked, gated at pick time
│       │                        on the picker-instant-commit setting for the active
│       │                        pointer class (fine defaults on, coarse off — both
│       │                        ui/config shadows; class from core MediaQueryTracker
│       │                        via ui/config/pointer-coarse-tracker writing
│       │                        $:/info/browser/pointer-coarse); the sixth,
│       │                        hgsd-pick-keyboard-commit (2026-09-27), is the pick
│       │                        family's keyboard-commit dispatcher (the
│       │                        caller's $keyboard binding, Enter by default): a non-blank pick naming
│       │                        no existing tiddler routes through the creation
│       │                        core (ambient direction playing new-options' kind
│       │                        bit), else commits as the row's own Add/Save
│       │                        button — the existence check evaluates ONLY at
│       │                        keypress (the dispatcher lives inside the
│       │                        keyboard's actions string);
│       │                        every dynamic attribute in both is a {{{ }}} filtered
│       │                        transclusion — macro-style <<param>> attributes
│       │                        never fire inside a procedure called from an
│       │                        actions string. An off setting keeps the Add
│       │                        step; the buttons always remain). Display-
│       │                        neutral since 2026-09-01: no root wrapper — the
│       │                        handle input is a native inline element carrying
│       │                        hgsd-sizer-select (flex hosts stretch it); the
│       │                        popup's inner dropdown div stays block.
│       ├── hgsd-pick-field.tid  $hgsd.pick-field 3-state field editor widget
│       │                        (both $hgsd.pick invocations pass commit-kind
│       │                        "field" — picking drafts the target directly in
│       │                        the modal and writes it live in the panel; the
│       │                        editing state also commit-clears edit-pop). Both
│       │                        keyboard-commit sites route through hgsd-pick-keyboard-commit
│       │                        (create-if-missing at keypress; the editing state
│       │                        passes edit-pop as close-state). 2026-09-27
│       │                        affordance matrix: both Save buttons render only
│       │                        for a pick commitable without creation (elseif on
│       │                        the dispatcher's create gate — non-existent picks
│       │                        leave create-and-add as the only commit step), the
│       │                        set state gains an icon-only clear button between
│       │                        the link and change (tooltip core
│       │                        Buttons/Clear/Caption; clear-button=hide opts
│       │                        out) blanking the field
│       │                        directly, and hgsd-new-options dials blank->new /
│       │                        typed-existing->nothing (Add is the step) /
│       │                        typed-new->create-and-add, each declared in row
│       │                        order through one elseif on the create gate —
│       │                        hgsd-new-options (create button, kind-mapped,
│       │                        ungated-by-contract: called inside the gate's
│       │                        then-branch) in the commit slot, hgsd-new-fallback
│       │                        (plain new button, self-gated) last; riding the
│       │                        per-keystroke add-temp refresh the create gate
│       │                        always used.
│       │                        Also hosts hgsd-new-options (the kind-mapped
│       │                        create-and-add button, rendered inside the
│       │                        caller's create gate) and hgsd-new-fallback (the
│       │                        self-gated plain new button for a blank box),
│       │                        shared by pick-field's two set states and
│       │                        pick-append; new-*/tooltip/caption remain
│       │                        ambient-guarded passthroughs
│       ├── hgsd-pick-append.tid   $hgsd.pick-append one-row list adder — the pick
│       │                        family's list member (2026-09-26, A7): direction
│       │                        "own" (picked title appended to target's field)
│       │                        vs "item" (target's title appended to the PICKED
│       │                        tiddler's field); the keyboard commit routes through
│       │                        hgsd-pick-keyboard-commit (create-if-missing fork at
│       │                        keypress — replaced the former triple-$let
│       │                        picked-title/edit-target/append-val derivation,
│       │                        2026-09-27), Add (commitable pick only — the
│       │                        elseif create gate) keeps the direct append and the
│       │                        picker's commit-kind stays append/
│       │                        append-to-picked
│       ├── hgsd-toggle.tid      $hgsd.toggle disclosure wrapper (Global/View,
│       │                        2026-09-05): children render behind a
│       │                        text/hide-text button pair over the standard
│       │                        reveal idiom; default state
│       │                        $:/state/hypergsd/show-completed/<hosting page>
│       │                        (shared per page — members using the default
│       │                        toggle together), state/state-prefix/class
│       │                        override, unwrap-tag-lists renders children
│       │                        bare (reads the ambient tag-list inherited
│       │                        through the chassis's plain transclusion). The
│       │                        shipped completed lists self-wrap: lazy on
│       │                        Dashboard/Action/Project tag lists, bare on
│       │                        the dedicated Completed pages. \widget gotchas:
│       │                        blocks need an explicit \end, and $(var)$
│       │                        substitution is \define-era only — compute
│       │                        attribute strings via filtered transclusion
│       ├── hgsd-realm-picker.tid $hgsd.realm-picker(state-tiddler) — plain realm
│       │                        select bound to a state tiddler; PUBLIC sub-plugin
│       │                        surface (briefly retired 2026-09-01, restored same
│       │                        day — documented widgets are extension surface);
│       │                        internal caller: ui/sidebar/capture/default-realm
│       └── hgsd-convert.tid     $hgsd.convert (Global/View — panel only;
│                                action→project; every convert
│                                passes <$action-confirm>). Message = base +
│                                $:/tags/hypergsd/Convert/Warning fragments
│                                (modules/convert-warnings/): each carries
│                                `hgsd-warning` (sentence) + optional `hgsd-conditions`
│                                (filter; ambient host-title; absent = always).
│                                Two enumeration pipelines (:filter runs are
│                                SINGLE runs — no multi-run operands; constructor
│                                runs REPLACE accumulated output, so parts append
│                                via +[addsuffix<part>]); lines separate with nl
│                                ([[%0A]] + decodeuricomponent — entities don't
│                                decode in filter attrs and op[]] tails break the
│                                scanner, hence the else[nl] guard).
│                                The prereq fragment captures host-title in a
│                                $let first — :filter[] rebinds currentTiddler
│                                to each candidate. title[X] is existence-blind —
│                                gate on presence via [[X]get[title]]
│
│   SUB-PLUGINS (siblings under plugins/, parent-plugin + dependents wired,
│   degrade fully when absent — sidebar entries gate on has[title] of the
│   type-member tiddler): plugins/hypergsd-contacts ships the contact type +
│   all contact surfaces incl. contact-delegation, the waiting-by-contact
│   action list (grouped by contact; a $:/tags/hypergsd/Lists/Waiting member
│   — the visible default on the Actions waiting page — plus a hidden
│   Dashboard membership), and since 2026-09-27 the Contacts page's
│   multi-contact search: contact-select (ui/components) is a member of
│   the engine's Strip tag list ($:/tags/hypergsd/Strip, bound to the
│   "Actions by contact" heading via hgsd-strip-host) and renders inside
│   that list's view strip ahead of Sort by — its picker's popup/temp
│   prefixes ride the chassis, list derivation and row gates
│   (pick-contact-filter runs); the dropdown only fills the input, and
│   the persistently-visible Add button (core's EditTemplate/Fields/
│   Add/Button string, the pick-append pattern) plus the ((input-accept))
│   named shortcut commit the append to the persistent
│   $:/config/hypergsd/contact-filter/selection tiddler, and the one
│   combined member (contact-filtered-action-list, a Portion/1 claimant:
│   incomplete next/waiting/future with a contact, ALWAYS grouped by
│   contact via the legacy group-by path — no Group-by controls) joins a
│   derived intersect gate into its list-filter — an empty selection
│   drops the gate and shows every contacted action; the roster
│   (contact-list) claims Portion/Full on that page (heading
│   "Contact list" since 2026-09-27) and keeps its own strip controls;
│   the by-contact trio stays in the plugin untagged from the Contact
│   tag list (available-but-hidden on the main Dashboard, titles intact
│   for external references); the Contact tag
│   tiddler ships there too, roster first; the Contacts PAGE renders
│   through the shared hgsd-dashboard-portions chassis since 2026-09-13 —
│   its hand-rolled member loop ignored Portion claims, so portion picks
│   made on the Contact settings tab did nothing there),
│   the Contact link row suffix (ui/list-items/contact-link, 2026-09-05 — the
│   gsd_contact twin of the core project link, same storyTiddler/current-group
│   suppression, target-title tooltip) and a Convert/Warning fragment (seeds
│   moved so the flat waiting list is
│   the default without it). Since 2026-09-01 its view template is ENGINE-
│   POWERED: four $hgsd.list blocks tagged $:/tags/hypergsd/Lists/ContactAction
│   (next/waiting/future/completed for the contact) replace the hardcoded
│   <$list>s — the GSD5 hook is live again, with realm scoping, per-block
│   visibility ($:/config/hypergsd/Lists/ContactAction/visibility/*) and a
│   Settings → Contact page drag tab; the local hgsd-row wrapper is gone
│   (rows compose through the shared hgsd-item). plugins/hypergsd-contexts
│   (2026-08-30) ships the context type; since 2026-09-02 the GSD/Contexts
│   dashboard IS the tag list (tagged $:/tags/hypergsd/Type + hgsd-type:
│   context — the dashboard, the tag and the type anchor are one
│   open GSD/* tiddler; extension tag lists stay $:/tags/hypergsd/*, user-
│   data tag lists are open dashboard tags)
│   member, GSD/Contexts page, context view template (ContextAction list
   blocks + their tag tiddler, visibility multids and Settings tab since
   2026-09-02), modal context section,
│   capture default + entry button, the contextualise ListItem/Suffix row
│   fragment (ui/list-items/context, 2026-09-03: contexts-icon toggle opens an
│   inline reveal holding an unmodified $hgsd.pick + Add/Create buttons on
│   incomplete action rows; the pick temp is deterministic per row title, a
│   typed unknown name creates the tiddler tagged GSD/Contexts and applies it;
│   the cluster sits outside hgsd-interactive so the eventcatcher leaves its
│   buttons alone — the three chassis gate runs it requires are in Refresh
│   guards below; 2026-09-05: the reveal state became per-row
│   $:/state/hypergsd/contextualise-<item> — qualify's transclusion-chain
│   hash is identical for every row of a list, so the qualified state was
│   shared list-wide and other rows' stale setTo wrote "open" onto an open
│   state (no change event — the button looked dead); 2026-09-26: the three
│   state/temp/popup titles became per-copy — <item>-<group>-<scope>, group
│   = current-group ambient from the grouped renderer, scope = the ambient
│   listState collapse title stripped of its $:/temp/gsd-list/ prefix — so
│   copies of one row (grouped under several contexts, or on several list
│   instances) no longer open each other's picker, and a copy appearing when
│   a context is added renders closed instead of focusing its input (the
│   2026-09-13 "navigated by itself" page jump); applied contexts now
│   render as core tag-pill pills before the icon (2026-09-05: transcluded
│   with element-tag=$button + an <$action-navigate> — the macro's internal
│   currentTiddler=tag makes the action a one-liner; tc-tags-wrapper supplies
│   the gaps), the pill for the enclosing view's context suppressed via
│   storyTiddler, the pills gated by
│   $:/config/hypergsd/Contexts/show-contexts (2026-09-05, default-absent =
│   show; checkbox on the sub-plugin's "Context page" settings tab in core's
│   ToolbarButtons form — yes/no + default on the widget + label linked to
│   the config tiddler; no whitelist entry needed, the $:/config/hypergsd
│   prefix is in every gate base)), the context image, its
│   two CSS rules (FIRST
│   sub-plugin stylesheet) and its docs type page (repo wiki content, tagged
│   `Documentation`/`HyperGSD API`, the contacts pattern). Main keeps only inert-when-absent
│   couplings: new-button's inherited-contexts, the modal chassis's context-tag
│   resolution, realm-selection's whitelist tag run, Type.tid's list entry.
│   plugins/hypergsd-ticklers (2026-08-30) ships ticklers (GSD5-ticklers
│   ported, its severe rollover bug fixed — see the sub-plugin readme):
│   fields gsd_tickler_date + gsd_tickler_repeat_days +
│   gsd_tickler_date_history on actions (dates are 17-digit
│   midnight strings — string-compare orders them, garbage sorts after any
│   date and is never touched; the history field is a chronological list
│   of every date carried — every pick, shift press and
│   automatic roll appends the new date, so the last entry is always the
│   current one). ALL check policy is wikitext
│   (modules/tickler-check.tid, Global procedure: due-day alert ONLY —
│   incomplete + the core days operator's local calendar day
│   (days:gsd_tickler_date[0]), never past-due; the date field is NEVER
│   deleted (an overdue tickler stays dashboard-visible until handled —
│   no unseen device login can silently consume it); the alert body
│   carries the title link + core-contract Complete checkbox + the
│   Alert-tag list shift members (ui/shift tag list: data-only member
│   tiddlers — days/label/tooltip(+optional class) — rendered by the
│   shared $hgsd.tickler-shift Global widget: panel binds the stored
│   date, alert binds now + binds the widget's after-shift-actions so
│   shifts dismiss), dismissing
│   itself on completion or shift (a toolbar-closed
│   banner re-raises at the top of the next hour while due and
│   incomplete); then phase-preserving
│   rollover via range/multiply/TIMESTAMP/add/compare chains at any
│   overdue age, revival a day before due); ALL date arithmetic is core
│   filters (format:date[TIMESTAMP] reads epoch milliseconds, add shifts,
│   format:timestamp canonicalises back to the midnight form — no custom
│   operator); the only JS is a ~15-line browser trigger
│   running the procedure at startup, hourly on the hour, and at
│   local midnight (renders a detached Global-import tree and invokeActions it — trees
│   built by invokeActionString do not execute actions inside a $variable
│   transclude). Date input = the hgsd-date-input procedure (edit-text
│   on a temp, default-reseeded from the canonical field, inputActions
│   canonicalises with the guard in the value filter and appends to the
│   history list — inputActions runs bare action widgets only; an EMPTY
│   event is a total no-op on both writes — browsers emit empty change
│   events without interaction, so nothing destructive hangs off them;
│   removing a date = deleting the field in edit mode). Also: the
│   dual-context date/repeat sections in ui/attributes (the panel's pair
│   are the FIRST Group/2 members; the date section carries the
│   +d/+w/+m/+y shift buttons — panel-only while dated, moving the
│   date 1/7/30/365 days through the same core-filter arithmetic and
│   recording each push on the history list; the
│   repeat hidden until a date exists on the temp/current tiddler), the
│   ListItem/Suffix row fragment (an always-visible in-place date input in
│   the row's centred flex layout — no popup), the alert body (title
│   link; core-contract Complete checkbox; Alert-tag list shift members
│   through the shared $hgsd.tickler-shift widget, base = now),
│   GSD/Ticklers, and lingo in the
│   shared namespaces. The ticklers plugin also ships its own review-sidebar
│   entry (block 4 of the $:/tags/hypergsd/Review/<n> tag list), so core keeps
│   no tickler branch in the sidebar.
│   plugins/hypergsd-references (2026-09-06) ships the reference type +
│   every reference surface: the $:/GSD/Reference type member, the
│   GSD/References page, the references-list block (the sole
│   $:/tags/hypergsd/Lists/Reference member + its visibility multids and
│   Settings Lists tab), the capture button, the shared new-reference-button
│   ($:/tags/Global/View) and the project view's References section — the
│   section lives in ui/ViewTemplate/project-references, transcluded in
│   place by core's view-body-project behind a has[title] gate on the type
│   tiddler (core keeps only the gate + the path; no core hook names a
│   sub-plugin body — the ViewPlacement tag list supplies every placement); rows render through
│   the host project page's ProjectView member list (shared hgsd-item). Also
│   the reference image and lingo in
│   the shared namespaces (its docs type page is repo wiki content, tagged
│   `Documentation`/`HyperGSD API`; no own Settings tab — the view-placement tag list
│   absorbed it into core's Panel and modal tab). References have no status set and never complete; core keeps
│   inert-when-absent reference branches only where they mirror the contact
│   precedent (new-gsd-modal's context suppression, the project picker's
│   section-type gate, body-text-fragment suppression, GroupBy project typing,
│   ViewPlacement membership).
│   plugins/hypergsd-priorities (2026-09-27) ships the gsd_priority field
│   (A/B/C, absent = not set): modules/priority-sets holds the vocabulary
│   (\function hgsd-priority-rank, the status-sets pattern) AND the shared
│   write \procedure hgsd-priority-set(item-title, priority-value) — the set
│   path for every action-driven surface (the panel's Not set row, a planned
│   list-item select); the panel's Portion/0 section (ui/panel/priority — the
│   first portion claim below Portion/1) is three raw radios behind the
│   section's OWN eventcatcher (the status-pill architecture: the catcher
│   receives the label-forwarded click — display:none inputs skip the change
│   cascade — and hgsd-priority-click commits through hgsd-priority-set) inside
│   hairline option blocks, the selected one filled solid with its colour
│   inline from the colours dictionary (fill + text keys — deep red / bright
│   orange / grey-blue, deliberately unlike the pastel status pills; the dot
│   hidden); the clear ✕ drops into a reserved end slot on the selected row
│   only (every block carries the slot padding, so widths never change and
│   translated labels cannot collide; ink-matched via one fill rule — core
│   pins button icons to the page foreground; logical properties throughout,
│   RTL mirrors for free) — a three-rule stylesheet, no JS, no state of its own (the
│   write re-renders the panel through the type gate); plus the SortBy priority
│   member (:sort[get[gsd_priority]
│   else[zz]] — A,B,C, unset last) and the GroupBy priority member (synthetic
│   keys — plain headings from the Name/ language strings; A/B/C alphabetical =
│   High→Low for free; not-set items land in the engine's keyless No group) —
│   both typed action+project; a list-row select (ui/list-items/priority, a
│   ListItem/Prefix member pinned after the status pills via the tag tiddler's
│   list field — native $select, colour via CSS custom properties from the
│   colours dict, Short/ language strings with Name/ fallback, commits through
│   hgsd-priority-set); a Settings → HyperGSD → Priorities tab (a native
│   select binding $:/config/hypergsd/priorities/default — None/A/B/C — plus
│   a configuration table — bare letter, colour (the core palette-manager input on the colours dict), full and short names (edit-text on the Name/ and Short/ language strings; edits create standard lingo overrides); the hgsd-priority-config class keeps its natural width) and an AfterCreation rule
│   (modules/after-create/default-priority: a created item linked to a project
│   inherits its priority, else the configured default; valid A/B/C only,
│   never over an existing value — all reads ride action attributes, invoke-
│   time, because the calling tree renders before the item exists). No
│   whitelist edits anywhere.
│
│   DEFINITION SCOPES (2026-08-30 audit): $:/tags/Global = everywhere (the
│   PageTemplate imports GlobalImportFilter at its root — page chrome, sidebar,
│   modals, ControlPanel included). $:/tags/Global/View = ViewTemplate subtree
│   + edit-mode PREVIEW only (core ViewTemplate.tid imports it; the
│   EditTemplate imports NOTHING extra, so edit-mode chrome sees only Global;
│   there is no Global/Page tag). Global/View-tagged: hgsd-list, hgsd-convert,
│   both view-body-*-buttons files, type-gate (the References sub-plugin adds
│   new-reference-button to this scope). Staying
│   Global — modal-blocked: hgsd-pick/-pick-field, create-and-add,
│   run-after-create, realm-scopes, status-radios,
│   event-handler; chrome-blocked: hgsd-new-button (capture sidebar +
│   PageControls), hgsd-realm-picker (sidebar). RULE: a WRAPPER file pulls its
│   transcluded dependencies into its own context — status-radios.tid must be
│   Global because the modal wrapper renders it inside a modal, where
│   Global/View does not resolve (consumer greps must exclude by exact file,
│   not substring — a filename-prefix filter once hid this exact dependency).
│   A fourth sibling, plugins/hypergsd-trashbin (2026-08-30), ships ONE
│   ListItem/Suffix member (ui/list-items/trash) — the alternative to the
│   built-in delete button on completed rows, trashing via kookma Trashbin
│   ($:/plugins/kookma/trashbin, SOFT dependency: the fragment self-gates on
│   the macro's has[title], reuses kookma's icon + hint string, invokes
│   move-to-trashbin as a <$button> action child, carries no data-hgsd-action
│   so the central handler ignores it; ships no lingo). The user's wiki swaps
│   buttons via a $:/tags/hypergsd/ListItem/Suffix list override (drops the
│   built-in delete, keeps trash).
├── images/                      6 SVG tiddlers ($:/tags/Image; globe = the
│                                realm-warning icon (GSD5's realm glyph);
│                                action/project/dashboard/convert/excerpt all in
│                                use; 5 unused GSD5 icons deleted 2026-08-30)
└── ui/
    ├── new-gsd-modal.tid        creation modal chassis (title+create+submit; sections
    │                            are tag-driven, see ui/attributes/ + ui/modal/). Submit
    │                            tail: $:/state/hypergsd/create-another=yes keeps both
    │                            temps and re-sends tm-modal (only the title wiped);
    │                            else closes and deletes all three temps
    ├── complete-warning-modal.tid  confirm modal for the completion warning
    │                            (hgsd-host param from tm-modal; re-evaluates the
    │                            tag list for display; complete-confirmed button)
    ├── ViewTemplate/            view-body (the shared panel chassis, plain-transcluded
    │                            by the two slots) + view-body-top/-bottom (the two
    │                            $:/tags/ViewTemplate injections, exact twins looping
    │                            the ViewPlacement tag list top/bottom) + view-body-project
    │                            (the ProjectView tag list host) + view-body-project-
    │                            buttons (Global/View; the four quick-add procedures);
    │                            contact/context bodies ship from their sub-plugins
    ├── buttons/                 3 PageControls buttons
    ├── capture/                 3 files: 2 entry buttons (new-action/-project;
    │                            new-contact ships from Contacts, new-reference
    │                            from References, new-context from Contexts) + default-realm (the
    │                            <$hgsd.realm-picker> call, "Default realm:" label;
    │                            default-context ships from Contexts)
    ├── components/              10 shared fragments: status-radios (Global — the
    │                            dual-context status section renders it in the modal,
    │                            where Global/View resolves not), realm-selection
    │                            (sidebar's checkbox group: the fieldset itself is
    │                            inline display:grid — legend row 1, one label per
    │                            row, no stylesheet rule), visibility-list
    │                            (2026-09-03, Global —
    │                            hgsd-visibility-list(tag-list,
    │                            visibility-base): core's list-tagged-draggable +
    │                            ItemTemplate behind the $set config-base the
    │                            ItemTemplate reads; every settings draggable —
    │                            the list tabs, Panel and modal, Fragments — calls it;
    │                            2026-09-12: renders the tag-basis note above
    │                            each list — lingo Settings/TagBasis/*, the tag
    │                            pill via core's tag macro; portions="no" (the
    │                            sidebar blocks, Group by / Sort by) drops the
    │                            portion clause;
    │                            Global because the control panel renders at page
    │                            level),
    │                            link-items (2026-09-02, Global — the LinkItem
│                            tag-list loop: hgsd-link-items(linked-tiddler)
│                            transcludes every $:/tags/hypergsd/LinkItem
│                            member after a GSD link; membership is the
│                            switch, order via the tag list field; panel and
│                            modal share one tag list, members self-gate on
│                            section-mode; pick-field hides them with
│                            link-items="hide"),
│                            prereq-row (2026-09-26, A7 — Global \procedure
│                            hgsd-prereq-row(item, direction:"own"): one row of
│                            the prereq/dependants twins; direction "own"/"item"
│                            swaps which tiddler's list the × trims, same bit and
│                            word as $hgsd.pick-append),
│                            realm-warning (2026-09-02, Global — the 1em
    │                            globe beside links whose target falls OUTSIDE
    │                            the current realm selection, and on list rows
    │                            whose ITEM does (same hgsd-realm-selection
    │                            scope as the list engine; consumers: every GSD
    │                            LINK via the LinkItem tag list (hgsd-link-items
    │                            after pick-field's value link, between it and
    │                            the change button; prereq/dependants rows; the
    │                            ; member:
    │                            ui/link-items/realm), and rows
    │                            via ui/list-items/realm, a ListItem/Suffix
    │                            fragment firing on unscoped surfaces such as
    │                            project pages' local lists — scoped dashboards
    │                            never show it, outside rows are invisible by
    │                            construction; one switch
    │                            $:/config/hypergsd/realm-warning show/hide in
    │                            Settings), list-item-template (the per-list
    │                            Settings row: core row + portion-picker + a
    │                            Group by / Sort by pair binding list-default
    │                            config natively; the member's heading field
    │                            names the key), portion-item-template (core row
    │                            + portion-picker — every other draggable's
    │                            row), portion-picker (the Portion select that
    │                            retags the member) and view-option-item-template
    │                            (the GroupBy/SortBy Settings rows)
    ├── config/                  23 files: 7 .multids list-visibility shadows + 8 scalars
    │                            (dashboard-future-project-items, cleanup-uncompleted-project-
    │                            actions, cleanup-age-in-days, group-by/sort-by hidden bases,
    │                            picker-instant-commit/{fine,coarse}, pointer-coarse-tracker)
    │                            + shortcuts/
    │                            + ShortcutInfo/ (4 keyboard bindings each;
    │                            titles are core-owned $:/config/shortcuts/* etc.)
    ├── control-panel/           SettingsTab tab + Behaviour + Colours + View
    │                            placement tabs + Lists tab
    │                            (nested tc-vertical tabs over
    │                            $:/tags/hypergsd/Settings/Lists: Project view,
    │                            Dashboards — whose inner list tabs live in
    │                            control-panel/dashboards/ under
    │                            $:/tags/hypergsd/Settings/Lists/Dashboard (8 core
    │                            + the Contact and Reference page tabs shipping
    │                            from their sub-plugins) — and Fragments
    │                            + Panel-and-modal tab (sections.tid: panel
    │                            placement + layout at top, then the panel/modal
    │                            visibility draggables) + item template
    ├── dashboards/              8 user-facing pages (title prefix `GSD/`; Contacts/
    │                            Contexts/References pages ship from their sub-plugins)
    ├── docs/                    API documentation set — moved 2026-10-02 to the
    │                            repo wiki's tiddlers/ as flat-titled content
    │                            tiddlers tagged Documentation/`HyperGSD API`
    │                            (incl. the sub-plugin type pages); `HyperGSD
    │                            API` index (TOC over its tag) + widgets/
    │                            procedures/list-widget/fields/tiddler-types/
    │                            system-tags sections + per-widget/type/tag
    │                            detail pages +
    │                            the GSD5 comparison, refresh-gates and
    │                            panel-chrome pages
    │                            complete/toggle pages deleted 2026-09-01 with their
    │                            already-gone widgets (docs were orphans); the
    │                            realm-picker page was deleted then REINSTATED the
    │                            same day with the widget (rewritten accurately — the
    │                            old page advertised long-removed mode parameters)
    ├── attributes/              DUAL-CONTEXT sections (2026-09-01 section unification):
    │                            one tiddler per section, BOTH tags
    │                            ($:/tags/hypergsd/PanelTemplate + ModalTemplate) + both
    │                            column tags — main ships status + project; Contacts
    │                            ships contact, Ticklers tickler + tickler-repeat.
    │                            Chassis contract: view-body and new-gsd-modal set
    │                            section-target/-type/-mode/-status-target around their
    │                            loops (panel: currentTiddler for both; modal: the data
    │                            temp + state temp). gsd_status is NOT seeded on the
    │                            modal temp (pass-through would overwrite per-type
    │                            resolution); gsd_project/gsd_contact ARE seeded
    │                            inheritance in hgsd.new-button. pick-field gained
    │                            tiddler (write target, blank=currentTiddler) and
    │                            new-button="hide" (modal: modals do not stack).
    │                            Status save logic MERGED 2026-09-01: one renderer
    │                            hgsd-status-radios(target-tiddler,current-type,
    │                            current-status), each chassis carries the eventcatcher,
    │                            the handler's per-type memory write guards to
    │                            $:/temp/gsd-new-state — see Procedures and Globals.
    ├── modal/                   2 modal-only sections (type, realm), tag-driven; context
    │                            ships from Contexts
    ├── panel/                   4 panel-only sections (complete/convert/prereq/
    │                            dependants), tag-driven; prereq/dependants are
    │                            thin callers of the shared twins (2026-09-26,
    │                            A7): hgsd-prereq-row draws each row and
    │                            $hgsd.pick-append adds, both keyed by one
    │                            direction bit ("own" vs "item") — commit-kind
    │                            append/append-to-picked rides inside pick-append
    ├── list-items/              7 self-gating row fragments (complete/status/body-text/delete/
    │                            comp-date/project/project-link; + the trash alternative shipped from
    │                            the hypergsd-trashbin sub-plugin), tag-driven: Prefix-tagged render before the
    │                            title link, Suffix-tagged after; single row composer
    │                            \procedure hgsd-item() in hgsd-list.tid (GSD5's
    │                            gsd5-item + GSD5ListItemPrefix/Suffix lineage); project-link
    │                            (2026-09-05) jumps to gsd_project with the target title as
    │                            tooltip, suppressed via storyTiddler (the enclosing view) and
    │                            current-group (the grouped heading) — contacts ships the
    │                            gsd_contact counterpart (ui/list-items/contact-link)
    ├── lists/                   10 reusable list blocks ($hgsd.list invocations;
    │                            references-list ships from References)
    ├── shortcuts/               2 KeyboardShortcut triggers (modal openers)
    ├── sidebar/                 Capture + Review tabs ($:/tags/SideBar); Review
    │                            is a block tag list — $:/tags/hypergsd/Review/<n>
    │                            tag tiddlers (list field = within-block order),
    │                            entries in ui/sidebar/review/ shipped by their
    │                            owning plugin, gaps via one adjacent-sibling
    │                            margin rule on .hgsd-review-block
    ├── stylesheet/              6 stylesheets: base (shared utilities),
    │                            sections, lists, pills, colour-manager,
    │                            hgsd-status-colours (status→colour dictionary)
    └── tags/                    folder names MIRROR the two title namespaces:
                                 GSD/ holds tiddlers titled under $:/GSD/
                                 (Action, Project — the identity tags; Contact
                                 and Reference ship from their sub-plugins,
                                 which repeat the GSD/ folder convention),
                                 HyperGSD/ holds those titled under
                                 $:/tags/hypergsd/ (AfterCreation,
                                 Complete/Warning, GroupBy, LinkItem,
                                 ListItemSuffix, ModalTemplate, PanelTemplate,
                                 ProjectView, SortBy, Type,
                                 Capture/{Buttons,Defaults},
                                 Lists/{Action,Dashboard,Project} — the
                                 control tag lists). Paths are
                                 organisational only (the title: field names
                                 the tiddler, never the file path), so any
                                 tag list title sits at a predictable path;
                                 ContactAction ships from Contacts, and
                                 GSD/Contexts — the contexts dashboard in
                                 ui/dashboards/ — is that sub-plugin's type
                                 tag list. Portion/N tags exist by use, no
                                 tag tiddlers.
```

## 3. Layering and coupling (hand-traced; `.tid` is invisible to gortex)

Rendering pipeline (dashboard path):

```
ui/dashboards/*            tag-driven loops ($:/tags/hypergsd*List; order = tag
  │                        tiddler list field, blocks gated by visibility)
  └─ ui/lists/*            one <$hgsd.list> each (+ realm/group wiring)
       └─ $hgsd.list       realm set-arithmetic → pre-bracketed `hgsd-titles`
            └─ hgsd-render-inner   <$refresh> freeze + <$eventcatcher>
                 ├─ list-item fragments ×4 (pure <input>/<button> + data-* attrs)
                 └─ click → hgsd-handle-click (modules/event-handler.tid)
                              complete | status | delete dispatch
```

ViewTemplate path: `view-body-top`/`view-body-bottom` (both `$:/tags/ViewTemplate`,
before/after core body, looping the `$:/tags/hypergsd/ViewPlacement` tag list:
per member, the type-tag match + `hgsd-config`/`hgsd-default` side pick the
hook, the `list` field orders the bodies) → shared
`view-body` panel (styled `<fieldset>` chassis; sections from two tag loops over
``$:/tags/hypergsd/PanelTemplate` portioned via modules/section-portions (Portion/N + the Top/Full bands), visibility-guarded) +
`view-body-project` (own `$refresh`+`$eventcatcher` wrappers around the
`$:/tags/hypergsd/ProjectView` tag list rendered through
hgsd-dashboard-portions — the five ui/project-view members
(next/waiting/future/subprojects/completed) are thin `$hgsd.list` calls since
2026-09-13 (same widget as the dashboard lists; view controls off by default so
no group-by/sort-by strip here, `realm-scope=""` keeps the project's own page
unscoped, quick-add buttons travel through the add-button slot; the completed
member keeps its $hgsd.toggle disclosure; `section-target` carries the project
past the chassis's block-mode transclusion) +
`view-body-contact` (sub-plugin; migrated 2026-09-13 to the same
hgsd-dashboard-portions chassis as view-body-project over the unchanged
$:/tags/hypergsd/Lists/ContactAction tag list and visibility base — the
completed list became a Portion/Full member self-toggling via $hgsd.toggle,
deleting the hand-rolled loop exclusion and show-completed reveal pair) +
`view-body-context` (per-context dashboard for `GSD/Contexts`-tagged
tiddlers; since 2026-09-02 its lists are $:/tags/hypergsd/Lists/ContextAction-
tagged `$hgsd.list` blocks — next/waiting/future for the context, pinned by
the tag tiddler's list field, per-block visibility
`$:/config/hypergsd/Lists/ContextAction/visibility/*`, Settings → Context page
drag tab, group-by-project via the shared $:/state/hypergsd/context-group
toggle; the view's former border-top rule is gone — it read as a stray hr).

Creation path: `$hgsd.new-button` → seeds `$:/temp/gsd-new-temp`
(gsd_project, gsd_contact, gsd_inherited_contexts) + `$:/temp/gsd-new-state`
(hgsd-type, per-type status memory) + `$:/state/hypergsd/effective-realm`
→ `tm-modal` → `ui/new-gsd-modal` (chassis: keyboard wrappers, title input, create
button, Attributes `<fieldset>`; attribute rows from two tag loops over
`$:/tags/hypergsd/ModalTemplate` portioned via the same chassis, transcluding the
tagged sections (ui/attributes/* dual-context, ui/modal/* modal-only, sub-plugin
sections), visibility-guarded, chassis variables propagate; the section tree sits inside a
`<$refresh>` gate — prefix/tag runs only, never a literal `[[title]]` run which
emits unconditionally and defeats the gate — and the title input writes to
`$:/temp/gsd-new-title`, outside the whitelist, so title keystrokes never
re-render the sections) → `hgsd-modal-submit` (project resolution + status cascade only) →
`create-gsd-tiddler` (tags + fields + side-effects, §5) — which transcludes
`$:/tags/hypergsd/Inheritance` members at the point of creation (contract
vars create-title/new-type/calling-tiddler/new-temp/new-state; core ships
informal-tags — caller's non-`$/:` tags flow onto the new item, blank caller =
nothing — and realm; HyperGSD-Contexts ships context-tags; the contract is
Inheritance; plain tag scan, removable by untagging; runs only in the submit
action — no render path).

Picker path — two layers. **`$hgsd.pick`** (raw): prereq/dependants section
add-rows (per-tiddler temp `$:/temp/hypergsd/add-prereq-<title>`, grouped by
project, extended search). **`$hgsd.pick-field`** (3-state field editor
wrapping the picker): the unified project/contact sections (ui/attributes,
both panel and modal contexts — the `tiddler` parameter points the modal's
instance at the data temp) are each a single invocation — the widget owns
the empty/set/editing machine, enter/escape, save/blank-clears, the embedded
new-button (below in empty state, adjacent in the editing fieldset;
`new-button="hide"` in the modal — modals do not stack), and
`realm-scope="tiddler"` candidate scoping; its state lives at
`$:/state/hypergsd/edit-<field>-<title>` and `$:/temp/hypergsd/add-<id>-<title>`
(deterministic titles, not `$qualify`, so simultaneous tiddlers stay isolated).

Refresh guards (whitelists passed as `subfilter` to `<$refresh>`):
all four GSD gates (view-body, view-body-project, view-body-contact, list
engine) open on listed types via the GENERIC run (draft-immune since 2026-09-12: [!is[draft]tags[]] heads the chain — drafts inherit the base tiddler's tags, so without the head every editor keystroke opened every gate carrying the subfilter)
`[subfilter<hgsd-type-gate>]` (a `$:/tags/Global/View` \procedure holding (2026-08-30: was a Global \define; retagged Global/View — every consumer renders inside a ViewTemplate, and harnesses import the tag explicitly)
`[tags[]] :and[tag[$:/tags/hypergsd/Type]]` — input-driven: emits the
known-type tags carried by the changed tiddlers; extension types work
with zero core edits). It MUST stay a plain additive subfilter run — inlining
its text where another `:and` chain exists would wipe that chain, and a
`:and` chain placed mid-whitelist wipes every run before it (verified live
2026-09-01: a `[tags[]] :and[prefix[...]]` realm-membership run placed after
the type-gate run replaced the accumulated output and silently closed the
gate — suffix runs APPEND, `:and` REPLACES; one `:and` chain per filter).
The list engine whitelists the type gate + listState match + `$:/config/hypergsd`;
the Review sidebar whitelists realm tags + context tag + state. The list engine
deliberately has NO `$:/state/hypergsd` run: a state run would only add cross-list
amplification — the buster (below) covers what matters. The CONTEXTUALISE runs
(three narrow prefixes — `$:/state/hypergsd/contextualise`, `$:/state/popup/pick-contextualise`,
`$:/temp/hypergsd/add-context-` — in BOTH list-engine gates, view-body-project and
view-body-contact) are the one sanctioned exception: the contexts sub-plugin's row
fragment (its ListItem/Suffix contextualise button) holds an inline $hgsd.pick
cluster behind an inline reveal INSIDE the freeze, so its state/temps must be able
to open and live-filter there; feature-owned prefixes, no other writers, so the no
cross-list amplification property holds (typing in one picker descends every frozen
list — inherent to live filtering, scoped to this feature). **OUTER DERIVATION GATE**
(2026-09-01): $hgsd.list's derivation $let tree (list-filter evaluation + realm
scope arithmetic) sits inside its OWN `<$refresh>` ABOVE the row-freeze — before
it, every global refresh descent re-evaluated those filter-valued attributes
(~0.3ms per item per visible list per cycle: ~300ms at 1000 actions for the
Dashboard page, on edits unrelated to GSD). Its whitelist = exactly what the
derivation reads — the type gate, `[prefix[$:/GSD/Realm/]]` (tag-tiddler edits),
`[prefix[$:/config/hypergsd]]` (realm-selection, dashboard-future-project-items, grouping),
and `[!is[tiddler]]` — DELETIONS (a deleted title carries no tags, so no other
run catches it; without this run deleted rows would ghost until the next
relevant edit) — PLUS the three contextualise runs as PASS-THROUGHS (the
derivation reads none of them; without them the fragment's state changes never
reach the row-freeze below). Realm-membership runs are neither needed (GSD items are covered
by the type gate; non-GSD tiddlers cannot alter list membership) nor legal
(the `:and`-wipe above). Measured: unrelated-edit cost 285ms → 3ms at 1000
actions (flat — the residue is page chrome). **ROW FREEZE** (2026-09-04):
each row's content sits behind its own `<$refresh>` gate in `hgsd-item`,
so a RELEVANT item edit (one row's own item changed) descends only that
row — unrelated-but-GSD edits, which the inner gate admits, cost one
filter evaluation per unchanged row instead of that row's whole fragment
tree (status pills, tag lists, label lookups). The row whitelist is
COMPOSED per list in hgsd-render-inner: the engine base
(`[match<currentTiddler>]` — input-driven, a changed title passes only if
it IS the row's item; fragment tag lists + visibility config; drafts)
plus every ListItem member's `hgsd-refresh-whitelist` field (split on spaces;
runs must be single bracketed tokens) — a stateful fragment DECLARES its
own state deps there instead of the main plugin hardcoding them
(hypergsd-contexts/context: the three contextualise runs;
hypergsd-ticklers/tickler: the pick-popup prefix). Membership (row
added/removed) stays with the outer string-buster rebuild. Measured:
open-list status-change refresh 800–900ms → ~210ms (headless);
click-with-dashboard 1.6s → ~1.05s (browser; the residue is the
membership rebuild — a native-patching live $list was attempted and
reverted, see scripts/bench-results.md). The view-panel gate scopes picker temps per panel — the FIRST
run pair `[prefix[$:/temp/hypergsd/add-]] :and[suffix<currentTiddler>]` (order
matters: `:and` replaces output so far; later runs append) so typing into one
panel's picker refreshes only that panel — the MODAL chassis carries the same
scoped pair FIRST (`:and[suffix<new-temp>]`), without which typing into the
modal's pickers never filtered the dropdown (fixed 2026-09-01 during section
unification). The project/contact view templates
scope by SUBTRACTION runs (only one `:and` chain is possible per filter — a
second would wipe the first's output): additive runs admit all
gsd-list/show-completed temps, then
`-[prefix[$:/temp/gsd-list/]!prefix<this-liststate-prefix>]` and
`-[prefix[...show-completed/]!suffix<currentTiddler>]` drop other hosts'
temps — a completed-toggle/collapse/state-write in one view refreshes only
that view (~90% fewer filter calls with 10 views open). Whitelist authoring
rules: prefix/tag runs only — a literal `[[title]]` run emits unconditionally
and defeats the gate (introduced 2026-08-25 migration bug, fixed same day).
`search:title` must NOT be used for host scoping: it is case-insensitive
substring AND term-split (e.g. term "x" matches "-Next Actions"), so it
cross-matches hosts. NOTE on reading `$refresh` behaviour: a PERMITTED descent
still returns false when nothing below re-rendered (`return this.refreshChildren(...)`
propagates children verdicts) — "returned false" ≠ "was blocked"; instrument the
whitelist evaluation, not the return value, when debugging gates. **Shadow-config trailing newline**: a `.tid` shadow's
body includes the file's trailing newline (`get[text]` on
`$:/config/hypergsd/dashboard-future-project-items` yields `"hide\n"`), and `match[]`
is EXACT string equality (core `filters/match.js`), so any comparison of a
shadow-read value MUST append `trim[]` after `get[text]…else[...]` — e.g.
`get[text]else[hide]trim[]match[hide]`. Same applies to values arriving via
`{{shadow}}` attribute transclusion (`group-state`) — trim at the comparison
site. State tiddlers written by checkboxes/radios/buttons carry clean values.
(2026-08-26 bug: the untrimmed active-parents read silently disabled the
future-project guard on every dashboard — 176 leaked actions — plus the
cleanup-uncompleted-project-actions cleanup filter and the flat-list default; all fixed with
trim[].) **`<%if%>` has no balance validation**: an orphan `<%endif%>` or
mismatched chain renders as literal text in the page (2026-08-26: two extra
`<%endif%>` at the end of $hgsd.list's realm tree left a stray at the bottom
of every dashboard list; check `<%if ` count == `<%endif%>` count per file).
**`tagging[]` is INPUT-driven and silently ignores its operand** (core
`filters/tagging.js` maps each input title to its tagging[] set, never reads
options.operand): `tagging[$:/tags/X]` returns every tiddler tagged with ANY
input title, not members of $:/tags/X. Always write the literal-input form
`[[$:/tags/X]] :and[tagging[]]` — which also respects the tag tiddler's
`list`-field ordering (2026-08-26: the modal Type select's operand form
produced ~6000 empty `<option>`s on the real wiki; the modal $refresh gate's
`pick-` whitelist then re-rendered all of them on every picker open, reading
 as "pickers don't load" on slower hardware). **Filter-parser position rules**
(2026-08-27, all hit during the realm-selection build): `[[title]op[...]]`
parses reliably only as a filter's FIRST run — mid-filter a following `[[`
restarts a literal scan and swallows to the next `]]` (use `[title[X]…]`
anywhere); prefix-run subfilters (`:filter[…]` `:and[…]` `:then[…]`) must
start with a BARE operator run — a leading space or `[` is a parse error
("Missing ["); `then[<var>]`/`else[<var>]` do not parse — use the
`:then[enlist<var>]` prefix run for value fallbacks; `:and` does NOT
short-circuit on empty input (always evaluates its subfilter). Action-mode
checkboxes use the `filter` attribute (non-empty output = checked) +
checkactions/uncheckactions — `checked={{{…}}}` is inert. A bare single-bracket
run `[no-realm]` does not parse (write `[[no-realm]]`), which bites inside
action-listops subfilters because core prefixes them with `[all[]] `.
**Stylesheet tiddlers render through wikitext**: its typography rule converts
literal `--` to an en-dash (U+2013), silently killing CSS custom properties
(`--x: v` becomes `–x: v`, declarations dropped as invalid) — write the dashes
as `&#x2D;&#x2D;` entities, which decode after that pass (2026-08-28, verified
via renderText probes; entity form survives, literal form does not). **`<$select>` content model**:
nothing that renders a DOM element may sit between `<$select>` and its
options — `<$reveal>` wraps content in a `span.tc-reveal`, and spec-valid
selects take only option/optgroup (+hr) children, so span-wrapped options
exist in the DOM but are not guaranteed to render anywhere. Whether they DO
render is a property of each OS's native select-widget backend, not engine
version (2026-08-27: $hgsd.pick's two branch `<$reveal>`s made every picker
show only its none-option on Windows while same-version newest Linux
browsers still rendered the invalid structure leniently — the Linux leniency
was luck; fixed by replacing the reveals with an `<%if%>` chain, which
compiles to `$list` and renders no element, making the DOM spec-valid on
every platform. NOTE: `HTMLSelectElement.options`/`.length` collects
DESCENDANT options on every engine, so DOM-count probes cannot catch this —
assert `:scope > span` is absent instead). The modal gates its attribute sections on ModalTemplate
+ temp/state/Realm prefixes, with the title input on
`$:/temp/gsd-new-title` outside the whitelist so title keystrokes never
re-render sections. Host names that are prefixes/suffixes of other hosts'
over-refresh — harmless, never under-refresh.

JS surface: `refresh.js` exports `exports.refresh` (`<$refresh subfilter>`);
render→execute→refreshInhibit pattern; no other module-type. No DOM listeners
of its own. The subfilter is evaluated WITH the widget as filter context
(passed as the widget argument to `filterTiddlers`), which is what allows
whitelists to reference `<currentTiddler>`; subfilters without variables are
unaffected. Two behaviours matter for consumers:
1. A whitelist match only PERMITS a normal refresh descent
   (`refreshChildren`) — widgets whose attributes are unchanged still ignore
   it. Core's filter-mode `<$checkbox>` never re-evaluates on tiddler
   changes, so checkbox visuals freeze behind a gate even when the state
   tiddler is whitelisted.
2. ANY additional attribute acts as a ''buster'': if its value changes
   between renders the widget runs `refreshSelf()` — children destroyed and
   recreated, every child widget re-executed. This is the reactive-UI fix:
   `hgsd-filter-buster=<<hgsd-titles>>` (list titles) and
   `hgsd-realm-buster={{{ …get[list]else[pristine]] }}}` (review sidebar
   checkboxes, in ui/components/realm-selection since 2026-08-30) both force
   full re-render when their derived value changes.

Coupling notes:
- `hgsd-render-inner` receives pre-computed titles as a **string attribute**
  (`hgsd-titles`), so realm math happens exactly once per list.
- Rows compose through ONE shared `\procedure hgsd-item()` in hgsd-list.tid
  (ListItem Prefix/Suffix tag loops around the title link). Both former
  view-body `hgsd-row` wrappers are gone — view-body-contact's deleted with
  its hardcoded lists (2026-09-01), view-body-project's replaced by the
  ProjectView members, which call `hgsd-item` directly outside the engine's
  per-list whitelist (hence the `hgsd-row-whitelist-expr` function's param default).
- Extension surface: Type tag list, AfterCreation, PanelTemplate/ModalTemplate
  (+ Group tags), ListItem Prefix/Suffix, dashboard list tags (incl. the
  revived ContactAction), per-list visibility, KeyboardShortcut triggers (see
  HyperGSD API). The pre-fork `$:/tags/hypergsdCollect`/`HyperGSDReview` hook tags
  were removed with their loops (2026-08-30) — no relic tiddlers remain.
- Colour editor: `ui/stylesheet/colour-manager.tid` does
  `\import "$:/PaletteManager"` — a CORE tiddler since TW 5.3 (the old
  "requires the PaletteManager plugin" note was stale); since 2026-09-25 the
  editor renders unconditionally from the Colours settings tab (the
  show/hide reveal + `$:/state/hypergsd/show-palette-editor` state removed).

## 4. Data model (tags first, fields second)

Identity tags (one per tiddler, except realms):

| Tag | Meaning |
|---|---|
| `$:/GSD/Action` | action item |
| `$:/GSD/Project` | project (may nest via gsd_project) |
| `$:/GSD/Contact` | person/context of delegation |
| `$:/GSD/Reference` | reference material |
| `$:/GSD/Realm/<name>` | realm membership (any GSD item may carry one; `prefix[]`+`tagging[]` used for catch-all set math) |
| `GSD/Contexts` (the dashboard tiddler) | opts ANY tiddler in as a GTD context |

Persisted fields (set by modal/panel fragments/handler):

| Field | Values | Set by |
|---|---|---|
| `gsd_status` | `next`/`waiting`/`future` (actions), `active`/`future` (projects) — the vocabulary is hardcoded in modules/status-sets (2026-09-06; tag list-field extensibility retired); replacement = shadow the whole status-sets tiddler; the shipped lists/sections stay the shipped five | status radios, rows, convert, modal |
| `gsd_complete` | `true`/`false` | complete fragments/handler. Convention (2026-09-03): incomplete is always checked as the positive `gsd_complete[false]` — every creation path seeds the field, so a missing value is not "incomplete"; the one negative check is list-items/body-text (not type-gated, must pass field-less types such as contacts) |
| `gsd_comp_date` | UTC timestamp `YYYY0MM0DD0hh0mm0ssXXX` | completion actions (cleared on uncomplete) |
| `gsd_project` | parent project title | project picker, modal |
| `gsd_contact` | **single** contact title (design decision) | contact picker, delegation |
| `gsd_prerequisites` | title **list** of actions this one depends on | prereq picker `listops`, modal back-linking |
| `gsd_action_status` / `gsd_project_status` | per-type radio memory (modal UI persistence across type switches) | status radios with `data-hgsd-status-field` |

Working-only fields (never persisted on real tiddlers): `hgsd-type`,
`gsd_status` pick + per-type memory, `gsd_context`,
`gsd_inherited_contexts` — these live on `$:/temp/gsd-new-state` during
modal editing; the data fields (`gsd_project`, `gsd_contact`, `gsd-title`)
live on `$:/temp/gsd-new-temp` (Grade-2 temp split, §5). Removed vs GSD5:
`gsd_realm`, `gsd_tickdate`, `gsd_action` (migrated to `gsd_prerequisites`),
`gsd_type` (renamed `hgsd-type`).

## 5. API surface (code-verified)

Widgets (`$:/tags/Global` unless noted):

| Widget | Params | Role |
|---|---|---|
| `$hgsd.list` | list-heading, list-filter, group-by, group-state, group-select:"no", group-members:"", sort-select:"no", sort-default (the modified-desc member), group-default:"", add-button, future-items-sweep:"no", realm-scope:"[subfilter<hgsd-realm-selection>]" | realm-filtered, frozen, delegated list (core engine); future-items-sweep="yes" hides items whose parent project is not active when the config says hide (parentless items always pass). group-is-date/eachday branch removed 2026-08-27 (dead code, no callers). all-titles is the draft gate (inline `!is[draft]`, 2026-09-06); list-filters start with `tag[]` to ride the tag index |
| `$hgsd.new-button` | gsd-type, gsd-status, gsd-complete, gsd-project, gsd-contact, gsd-realm, gsd-update-status, gsd-calling-tiddler, class/style/aria-label/role/tooltip/disabled | seeds temp tiddler + opens creation modal |
| `$hgsd.pick` | tiddler, field:"pick", list-filter, placeholder, none-title:"-- none --", none-value, group-by (any field), none-group-title:"(none)", initial, id, search-mode:"title"\|"extended", focus:"no", realm-scope:"[subfilter<hgsd-realm-selection>]" | searchable popup select w/ generic optgroups; realm-scope = always-evaluated filter (scope list: realm tags + no-realm sentinel; "" = everything via hgsd-realm-all). Display-neutral (no root wrapper — 2026-09-01): native inline handle; flex hosts stretch it via hgsd-sizer-select on the input |
| `$hgsd.pick-field` | field, tiddler:"" (write target, blank=currentTiddler — the modal's drafting editor), new-button:"show" ("hide" suppresses the plain new-button fallback — modals do not stack), list-filter, id, label, group-by, none-title, none-group-title, new-type (blank=omit), new-status:"next", new-update-status:"no", search-mode, placeholder, realm-scope:"[subfilter<hgsd-realm-selection>]", link-items:"show" ("hide" — no LinkItem adornments in the set state) | 3-state field editor (empty/set/editing) wrapping `$hgsd.pick` |
| create-gsd-tiddler | gsd-type,gsd-status,gsd-complete,gsd-update-status,gsd-calling-tiddler,new-title,gsd-realm-tags,gsd-context-tags | modal create procedure. Grade-2 temp SPLIT (2026-08-30): $:/temp/gsd-new-temp = DATA fields only (pass-through loop copies every field onto the created tiddler, blanks skipped via hgsd-set-field-if-present — structural exclusions as negated title runs; -enlist[...] negated runs DO NOT parse); $:/temp/gsd-new-state = internal (hgsd-type, gsd_status pick, per-type memory, gsd_context, inherited contexts). gsd_status/gsd_complete written explicitly (resolution-owned); gsd_project/gsd_contact validated in submit then written back to the data temp for the loop. Both temps deleted on submit only (cancel keeps entries by design). A sub-plugin modal section writes gsd_whatever to the data temp — zero main-plugin changes |
| `$hgsd.realm-picker` | state-tiddler:"$:/state/hypergsd/effective-realm" | plain realm `<$select>` bound to a state tiddler; public sub-plugin surface (retired then restored 2026-09-01 — single internal caller: capture default-realm; the old single-realm-model mode params are gone for good) |
| `$hgsd.convert` | current-status, class/style/aria-label/role/tooltip | action→project (next→active else future, clears prereqs, retags) |
| `$refresh` (JS) | subfilter | inhibits child refresh unless changed tiddlers match filter |

Procedures: `hgsd-handle-click` (the dispatcher), `hgsd-render-inner(hgsd-titles)`,
`hgsd-pick-list`/`hgsd-pick-select`/`hgsd-pick-scoped`/`hgsd-pick-ui`/`hgsd-pick-commit`
(picker internals: option rendering, the 8-row listbox select, realm scoping, popup
chrome, instant-commit dispatch — all list evaluation lives inside the popup reveal
so a closed picker evaluates no candidate filters), `hgsd-item()`
(the shared row composer: ListItem Prefix/Suffix loops around the title link),
plus, in hgsd-list.tid, `hgsd-row-whitelist` (the outside-the-engine row whitelist),
`hgsd-strip-radio`/`hgsd-view-label`/`$hgsd.view-relevant`/`hgsd-render-grouped`/
`hgsd-render-flat` (the view strip and its two renderers); shared chassis and
components elsewhere: `hgsd-section-portions`/`hgsd-dashboard-portions`
(modules/section-portions), `hgsd-visibility-list`/`hgsd-link-items`
(ui/components), `hgsd-create-and-add` (modules/create-and-add),
`hgsd-run-after-create` (modules/run-after-create) and `hgsd-do-complete`
(the completion toggle inside the click dispatcher),
`hgsd-status-radios(target-tiddler,current-type,current-status)`
(one renderer, both contexts — a ul/li radio list where the label itself is
the pill, filled by stylesheet `:has(input:checked)`; the modal wrapper is
gone since 2026-09-01),
`hgsd-modal-submit()`, `create-gsd-tiddler(gsd-type,gsd-status,gsd-complete,
gsd-project,gsd-contact,gsd-update-status,gsd-calling-tiddler,new-title,
gsd-realm-tags,gsd-context-tags)`, `gsd-select-action`,
`add-context-actions`, `new-*-button` ×8 (project/contact/views). The colour
path history: hgsd-colour/gsd5-colour defines were retired 2026-08-30 for a
file-local `hgsd-colour` \function in stylesheet.tid, which was itself
deleted 2026-09-04 when the pill rules became generated — the loop reads the
colours dictionary via `getindex` directly. Since 2026-09-06 the two pill
shapes fork: row pills keep the span + sibling combinator, the attribute
section's pill is the label itself.

Event delegation contract (all interactive HTML controls):
`data-tiddler` (target title) + `data-hgsd-action` ∈ {`complete`,`complete-confirmed`,`status`,`delete`}
+ `data-status` (new status) + `data-hgsd-status-field` (optional per-type
persist); controls must sit inside `.hgsd-interactive` under an `$eventcatcher`
with selector `.hgsd-interactive input, .hgsd-interactive button`.

Completion side-effects — ONE mechanism (the compat `$hgsd.complete` widget
was removed with the 2026-08-30 legacy-alias retirement; its docs orphans
deleted 2026-09-01): raw-HTML checkboxes inside `$eventcatcher` regions
dispatch to `hgsd-handle-click`, whose `hgsd-do-complete` sets
gsd_complete/gsd_comp_date (date stamp on check, cleared on uncheck), then
promotes dependants via exact `enlist-input[]match`. Completing (never
un-completing) first gates on $:/tags/hypergsd/Complete/Warning — the list
field is the membership (delete a title to retire the warning, shipped
built-in included; ui/tags/HyperGSD/Complete/Warning.tid): a tripping member
(conditions filter, ambient host-title, output = the items to link) pops
ui/complete-warning-modal.tid instead (identical-value gsd_complete re-write
with $timestamp=no resets the natively-toggled checkbox; tm-modal carries
hgsd-host + hgsd-from-item + explicit tv-story-list/tv-history-list). Its
complete-confirmed button re-enters the handler (still-incomplete guard —
do-complete TOGGLES), then closes the modal. Completing from the item's own
page (currentTiddler match at the click site; the modal learns it via
hgsd-from-item) additionally removes the item from $:/StoryList per the
close-on-complete mode ($:/config/hypergsd/close-on-complete: never /
own-page / always — own-page closes only own-page completions, always closes
from any origin) — a direct list write, never tm-close-tiddler (the modal's
body swallows that message).

Creation side-effects (`create-gsd-tiddler`): type + **all union realms** +
context tags applied (realm union = effective-realm contribution — name, or
the typed new-realm name — plus every `$:/GSD/Realm/` tag of the calling
tiddler, deduped; effective `none`/blank contributes nothing); modal pickers
scope candidates to realm-less ∪ the same union (`realm-scope="union"`).
Action/project get status+complete+project+contact; caller action→`waiting` /
caller project→`future` when `gsd-update-status=true`; contact created from an
action is auto-assigned to that action's `gsd_contact`; action created from an
action gets the caller in `gsd_prerequisites`; navigation per
new-action-navigate/new-project-navigate; temp deleted **only on submit** (cancel
preserves entries).

`realm-scope` (on both picker widgets AND `$hgsd.list`): ALWAYS evaluated as
a filter; output is the scope list — allowed realm tags plus the literal
`no-realm` sentinel when realm-less items are included. Default
`[subfilter<hgsd-realm-selection>]` (the review sidebar's selection; pristine
state = everything); blank falls back to `[subfilter<hgsd-realm-all>]` via a
`$set emptyValue` (everything — observably identical to unscoped, so no
special-case branches exist); any other value evaluated as given (direct
filters and composed scopes work). Arithmetic + scope-list procedures (\procedure, 2026-08-30: converted from \defines — procedures work identically as subfilter<> operands) live in
modules/realm-scopes.tid (2026-08-28: replaced the former
tiddler/effective/union keyword modes and pick-field's realm-tiddler
parameter — removed with no compatibility, per maintainer decision).

Keyboard: `alt+A` / `ctrl+alt+P` open modal (delete gsd_project from temp
first); `enter`/`escape` bound inside modal via `((hgsd-modal-submit))` /
`((hgsd-modal-close))` shortcut tiddlers; pickers/panels additionally bind
enter/escape per-widget.

## 5a. Configuration surface

| Namespace | Purpose |
|---|---|
| `$:/config/hypergsd/new-action-navigate` / `new-project-navigate` | navigate to new tiddler (default yes) |
| `$:/config/hypergsd/cleanup-uncompleted-project-actions` | show or hide completed actions of uncompleted projects on Cleanup (default hide) |
| `$:/config/hypergsd/dashboard-future-project-items` | show or hide items under future projects on dashboards (default hide; parentless items always pass; Dashboards tab checkbox) |
| `$:/config/hypergsd/Placement/{Action,Project,Contact,Reference}` | HyperGSD content above/below body per GSD type (defaults bottom/bottom/top/top; all four render from the ViewPlacement tag list in the View placement tab) |
| `$:/config/hypergsd/panel-layout` | section orientation: `vertical` (default) keeps groups as side-by-side stacks; `horizontal` flattens them into one wrapping flow (`display: contents`) — panel and modal share it (Panel and modal tab radio, 2026-09-04) |
| `$:/config/hypergsd/cleanup-age-in-days` | cleanup minimum age in days before completed items appear (default 14; the !days:gsd_comp_date threshold — renamed from cleanup-timeout, which in turn came from core-cleanup-timeout, and moved into $:/config/hypergsd so it rides the config-prefix refresh gates) |
| `$:/config/shortcuts/*` + `$:/config/ShortcutInfo/*` | 4 keyboard shortcuts |
| `$:/config/hypergsdPanel/visibility/<section>` / `$:/config/hypergsdModal/visibility/<section>` | per-section show/hide (`show`\|`hide`, default show) — written by Sections tab checkboxes, read by the panel/modal tag loops |
| `$:/tags/hypergsd/Type` + members (`hgsd-type` field) | **type tag list** — item-type tag-tiddlers (the `context` member ships from the HyperGSD-Contexts sub-plugin since 2026-08-30, `contact` from HyperGSD-Contacts, `reference` from HyperGSD-References); drives the generic refresh gate (`modules/type-gate.tid` `\procedure hgsd-type-gate`), the modal Type dropdown, and create-gsd-tiddler's type→tag mapping (`:filter[get[hgsd-type]match<gsd-type>] +[first[]]`; unique `hgsd-type` values are an extension-author contract, `first[]` guards duplicates). Naming: `hgsd-type` follows core's hyphenated shadow-config convention (caption, list-after, plugin-type) — dotted fields (draft.of, throttle.refresh) are transient/behavioral, not config. The modal temp's selected type is also `hgsd-type` (renamed from the deprecated `gsd_type`) |
| `ui/panel/dependants` mirror picker | the "Prerequisite of" section carries the full DependsOn interaction writing the OTHER side: picker over incomplete actions minus self (the literal filter carries a `-[<currentTiddler>]` run — variable operands resolve at evaluation, so self-exclusion needs no dynamic composition), add/remove write the PICKED action's `gsd_prerequisites` (both sections' rows sort `gsd_complete` — incomplete first, stable within groups — and every add path clears the per-action pick afterwards), typed new picks go through `hgsd-create-and-add` with `new-prereq` (blank `target-field` skips the target write; `target-tiddler` still names the caller for AfterCreation rules) |
| `$:/tags/hypergsd/AfterCreation` | post-create extension point — tagged rules transcluded by the shared runner `hgsd-run-after-create` (modules/run-after-create.tid, $:/tags/Global) after EVERY creation: the modal (new-source=modal) AND create-and-add pickers (new-source=picker, calling-tiddler = the tiddler whose field receives the item). Contract vars `hgsd-new-title`/`hgsd-new-type`/`hgsd-calling-tiddler`/`hgsd-new-source` are `$let` into scope (plain tiddler transclusion inherits caller scope but DROPS extra <$transclude> attributes — those only reach procedures/widgets). No list-field pinning: navigation is not a member — the modal navigates itself after the hook honouring new-action-navigate / new-project-navigate (pickers never navigate), so members are order-independent and no rule invalidates the invoking tree mid-chain (2026-09-28). Members must read created-item data through ACTION attributes (invoke-time) — the calling tree renders before the item exists; the priorities default-priority rule is the reference. Shipped rules: contact-delegation + priorities default-priority (sub-plugins) |
| `$:/tags/hypergsd/Ticklers/Snooze` + members | snooze-interval tag list (sub-plugin, 2026-08-30) — each member carries `days` + `caption`; the tickler alert body renders one button per member (list field pins one-day → one-week; ship your own by tagging) |
| `$:/tags/hypergsd/Capture/Block/<n>` + members | **capture tag list** (2026-09-12) — numbered blocks own the capture sidebar outright (1 defaults: the //Default context:// select + //Default realm:// picker, one labelled line per member; 2 the common new-item buttons: action/project/reference; 3 the rarer pair: contact/context; 4 the realm note). Each block tag tiddler's `list` field pins member order (unlisted append alphabetically) and its `caption` (lingo `Settings/Sidebar/CaptureBlock/<n>`) labels its drag list in Settings → Sidebar; hide writes `$:/config/hypergsd/Capture/visibility/<title>` (default show), gated per entry by the renderer. Buttons are single `<$hgsd.new-button>` invocations; members ship from whichever plugin owns the type, so an absent sub-plugin is a missing entry (an all-absent block renders no div — no double gap). The former Buttons/Defaults tag lists were removed 2026-09-12 when the flat draggable's writes were redirected to the block `list` fields (earlier the same day they had driven order through a `hgsd-order-tag-list` pointer field — one mechanism survives, the pointer does not); the ul/li capture-entries component and its `hgsd-capture-list` rule went the same day |
| `$:/config/hypergsd*/visibility/*` (11 list .multids across main + sub-plugins) | per-dashboard list visibility + drag-order seeds — live, consumed by the dashboard tag loops (see §7) |

Control panel (`$:/tags/ControlPanel/SettingsTab` → HyperGSD): General
checkboxes + cleanup timeout; View placement radios; Dashboards grouping
checkbox + per-dashboard list tabs — 9 from main + Contact page from the
Contacts sub-plugin. Every draggable surface (list tabs, Panel and modal, Fragments)
calls the one shared procedure `hgsd-visibility-list(tag-list,
visibility-base)` (ui/components/visibility-list, $:/tags/Global — Global
because the control panel renders outside the ViewTemplate chain): it wraps
core's `list-tagged-draggable` + `$:/core/ui/ControlPanel/Toolbars/ItemTemplate`
in the `$set config-base` the ItemTemplate reads, so the checkbox writes
`<visibility-base><item-title>` as show/hide and drag-reorder writes the
tag's `list` field; items carry `description` fields shown as the
muted hint line. Lists → Fragments tab (four draggable blocks — link items,
row prefix/suffix fragments, capture buttons); Panel and modal tab (same
mechanism over `$:/tags/hypergsd/PanelTemplate` +
`$:/tags/hypergsd/ModalTemplate` — visibility + drag-order for panel/modal
sections, under the panel position/layout radios); the Colours tab (own
$:/tags/hypergsd/Settings member since 2026-09-25, slotted after Sidebar —
transcludes `colour-manager`, editor always visible).

## 5b. Variables and ambient state

Ordered broadest → narrowest scope.

**Tiddler-backed global state** (survives save): realm system —
`$:/config/hypergsd/realm-selection` (ONE list field: full realm tag titles +
literal `no-realm` sentinel = "include realm-less"; missing = pristine =
all+sentinel, empty = nothing; written by the realm-selection component's
checkboxes/Select
all/none via action-listops; read by $hgsd.list's shown-realms/show-realmless
derivation — see Boilerplate: realm scoping for the contract),
`effective-realm`, `effective-context` (creation side,
separate vocabulary); UI state —
`show-completed/<tiddler>` and `show-completed/<dashboard page>` (lazy lists — $hgsd.toggle members default to the page-title form; the old literal `show-completed/dashboard` key died 2026-09-05),
`edit-<field>-<tiddler>` (per-tiddler field-editor flag, deterministic titles),
`context-group` (the contexts view's grouped-by-project toggle),
`$:/state/popup/pick-<id>-<tiddler>` (picker
popups; prefix whitelisted by refresh guards); temps — `$:/temp/gsd-new-temp`
(modal working tiddler), `$:/temp/gsd-new-title` (modal title; separate tiddler
so keystrokes stay outside the modal refresh gate; deleted on submit, kept on
cancel like the main temp), `$:/temp/gsd-new-realm-name` (modal "new realm"
typed name; outside every refresh-gate prefix for the same reason), `$:/temp/hypergsd/add-<id>-<title>` (per-tiddler
picker state; ids: contact/project/prereq), `$:/temp/hypergsd/NewContextName`, `$:/temp/gsd-list/<tiddler>-<title>`
(`$qualify`d collapse state).

**Global definitions**: the widget/procedure families above (§5).

**Ambient transclusion variable**: `age-in-days` — set by `Cleanup: completed items.tid`
(`$let age-in-days=-<N> days`) and read inside the transcluded `cleanup-actions` /
`cleanup-projects` lists (`!days:gsd_comp_date<age-in-days>`). The cleanup lists
break if transcluded anywhere else. Also `listState` ($qualify name, scoped per
list), and tv-config-toolbar-{class,icons,text} in PageControls buttons.

**Widget/loop-locals**: `hgsd-titles`, `current-type`, `current-status`,
`target-tiddler`, the section chassis contract vars (`section-target`,
`section-type`, `section-mode`, `section-status-target` — set by view-body and
new-gsd-modal around their section loops; dual sections in ui/attributes read
them), `new-temp`/`new-state` (modal's two temps),
`viewing-title` (dependants section: viewing title vs item),
`radio-name`, `edit-pop`/`add-temp`, `current-group`, `current-date`,
`final-*`/`raw-*` (modal submit), `realmTag`, `groupState`,
`caller` (new-button fallback chain), loop vars `listItem`-style:
`dependant`, `prereq-item`, `dependant-item`, `context-tag-item`,
`project-item`, `list-item`, `realmTag`.

**CSS/DOM contract**: classes `hgsd-interactive` (delegation scope),
`hgsd-list-collapse`, `hgsd-radio-group` (the attribute section's radio
list), `view-status`, `item-status`,
`hgsd-capture` + its bare `> div` groups (tag-driven section containers;
  `:empty` flip; orientation = `$:/config/hypergsd/panel-layout` via ONE
  transcluded display value — vertical stacks each group as a box,
  horizontal flattens the groups (`display: contents`) so all sections
  share `.hgsd-capture`'s single wrapping flow and the row itself wraps
  (a cramped group drops below, never hugs the right edge); panel and
  modal, 2026-09-04),
`gsd-list-item(-vertical|-title)`, `hgsd-sizer-select`,
`hgsd-edit-fieldset`; colours: the `hgsd-status-colours` dictionary (keys
`action-next|waiting|future`, `project-active|future`, each with `-border`)
is read DIRECTLY by the stylesheet's generated per-status rules (2026-09-04:
a `$list` over the type tag's status sets emits one `.<type>-<status>`
rule each, neutral fallbacks for absent keys — replaces the five fixed class
rules; a custom status is colourable by adding `action-<word>`/`-border`
keys) — consumed as per-class `--pill-bg`/`--pill-fg` custom properties (2026-08-27 audit: 2025-baseline
stylesheet — dead rules removed (.gsd-notify/.gsd-goto/.sidebar-spacer/
.gsd-info-modification/.hgsd-visible-checkbox), gsd5→hgsd slightly-large-text
mismatch fixed, #eee → palette token, nesting + logical properties, clip-path;
inline styles hoisted to classes: .hgsd-toolbar/.context-view-template/
.hgsd-context-controls/.hgsd-completed-toggle(-hide)/.hgsd-new-hint/
.hgsd-tabledash*).

## 6. Behaviour notes

- **Frozen refresh**: every list/panel wraps content in `<$refresh subfilter=…>`
  listing exactly the tiddler sets that may wake it (type tags, its own state
  prefix, config prefix, the listState tiddler). Typing/search edits never
  re-render GSD UI; modifying a GSD item does. Deletions ARE admitted since
  2026-09-01 — the list engine's outer derivation gate carries `[!is[tiddler]]`,
  so a deleted item's row disappears on the next refresh cycle (before that,
  deleted items lingered as ghost rows; the derivation-level admission also
  covers rows in still-frozen inner trees via the buster cascade).
- **Stack-frame budget**: the engine's recursion guard counts widgets (1000
  deep) while the browser stack counts JS frames, and a HyperGSD widget level
  is expensive in frames (gate attribute evaluation, refreshSelf cascades,
  per-row executes) — the raw "maximum call stack size exceeded" surfaces at
  widget depths of roughly 150–400, before the engine's friendly recursion
  error can trip. Measured (scripts/hypergsd-bench.js §7, 2026-09-26):
  dashboard chassis 100 deep / 4 gates on the deepest path (rows carrying a
  context tag run ~7 deeper than plain rows: the context chip is core's
  tag-pill invoked at tag-pill-BODY level — colour/icon cascades and the
  palette pointer ride call-site attributes; the body hop is load-bearing,
  it resolves palette sections into plain params, which attribute position
  cannot do, so two hops is the floor for a parity pill and the outer
  tag-pill hop was the only one spare; a core rename of the internal macro
  is caught by the bench's chip assertion),
  context page
  98 / 4 (the inline lists mount at a view-template slot BESIDE the panel
  body, so the panel stack does not sit above them), panel 67 / 1 — ≤67% of
  the advisory 150 budget. An engine list rendered from INSIDE a row fragment
  (~155–180) would breach it — unreachable through the data model today; mount
  such a list at a page slot instead.
  Safety rules live in Refresh gates: no \define in gate plumbing
  (its variable-substitution path is unguarded mutual recursion — a direct
  stack overflow); a whitelist admits only what the subtree READS, never a
  render-time write (write → change → gate opens → re-render is the loop);
  a self-referential whitelist does not error but silently OPENS the gate
  (the filter-recursion guard returns a marker string, which counts as a
  whitelist hit).
- **Future-items sweep** (`$hgsd.list` + config): the five dashboard lists pass
  future-items-sweep="yes"; when the config ($:/config/hypergsd/dashboard-future-project-items,
  show/hide) says hide, each realm branch
  appends :filter[get[gsd_project]get[gsd_status]else[active]match[active]] to
  its result — items under future (or non-active) projects are hidden from
  dashboards, parentless items always pass, and the guard reads gsd_status
  only (a completed-but-active parent still passes; its own gsd_complete
  filter governs completed items).
- **Realm set arithmetic** (`$hgsd.list`): global view = filter as-is;
  +exclude = `:intersection[all[tags]prefix[$:/GSD/Realm/]tagging[]]`;
  specific realm = `filter -[all realm-tagged] + [filter tag<realmTag>]`;
  no-realm-only = `-[all[tags]prefix[$:/GSD/Realm/]tagging[]]` (BUGFIX
  2026-08-25: was `!tag[$:/GSD/Realm/]` — exact-tag negation, so realm-tagged
  items leaked through and "no realm only" showed everything; same trap as
  `search:title` host scoping). The union branches evaluate the base
  `list-filter` ONCE into `all-titles` and enlist from the string in both
  legs (was: subfilter evaluated twice per render). Results flattened to a
  bracketed titlelist string once, then rendered.
- **Event delegation**: one `<$eventcatcher>` per list/panel/modal region;
  all controls are raw `<input>`/`<button>` carrying `data-*` attributes.
  Plain inputs (not `<$radio>`) are required so `input:checked + span` CSS
  sibling selectors work; the `checked` attribute is emitted conditionally to
  dodge browser caching bugs.
- **Per-type status memory**: modal radios persist to `gsd_action_status` /
  `gsd_project_status`, restored when the user switches type back and forth;
  validated against `[enlist[next waiting future]match<status>]` /
  `[enlist[active future]…]` with defaults next/active.
- **Prerequisites**: add via picker (enter or ⊕), remove via `listops -subfilter`;
  completing a prerequisite promotes future→next dependants; the dependants
  section lists reverse dependencies with exact membership matching.
- **Contexts**: any tiddler tagged `GSD/Contexts` becomes a
  context (created from the Contexts dashboard or the modal type dropdown);
  context tiddlers show an inline next/waiting/future dashboard
  (view-body-context); contexts are excluded for contact/reference types;
  the Collect sidebar pins an "effective context" for new items; new-buttons
  harvest the caller's context tags into `gsd_inherited_contexts`.
- **Realms for new items**: Collect sidebar sets effective-realm; project/contact
  buttons inherit the parent's first realm tag; the modal offers "new realm"
  free-text creation. New items are tagged with the
  **union** of effective realm and the calling tiddler's realms; modal picker
  candidates follow the same union (§5).
- **Picker caching tradeoffs**: dropdown filters are variable-free for cache
  friendliness; missing contact/project targets render blank (`--`) instead of
  a fallback search. Drafts no longer appear as duplicates (2026-09-06): both
  widget funnels (`$hgsd.list` all-titles, `$hgsd.pick` base-list-titles)
  exclude them with an inline `!is[draft]` on the candidates — never a per-list
  `-[is[draft]]` run, which sweeps the whole wiki per evaluation. Item filters
  dropped their `all[tiddlers]` prefixes the same day: the default filter
  source carries the tag index (`wiki.each.byTag`), so a leading `tag[]` reads
  it directly while an explicit prefix forces a full-wiki scan plus
  `sortByList` (bypass filters — view-body-project, tickler-check,
  event-handler's dependant promotion — keep an inline `!is[draft]` of
  their own). Exception: the warning `hgsd-conditions` fields keep their
  `all[tiddlers]` — they are evaluated through `subfilter`, which passes
  its incoming source through (the tag-list member), so a leading
  selection operator is the source reset; a leading `tag[]` would filter
  the member and always return nothing.

## 7. Known issues and vestiges (hand-verified; maintainer-reviewed)

Vestigial mechanisms (inert after the fork; documented, not bugs):
- Dashboard list visibility/drag-order is LIVE (2026-08-29): every dashboard
  renders `[[<tag>]] :and[tagging[]]` loops, ordered by the tag tiddler's
  `list` field (pinned for DashboardLists/ActionList/ProjectList) and gated
  per block by `$:/config/<ns>/visibility/<list-heading>` (else[show] default).
  The .multids seeds are real defaults — each block's `title:` line plus its
  `index: value` lines reassemble into the exact state-tiddler paths (a
  .multids loader property worth knowing: no trailing newline in values, but
  the gate trim[]s anyway). Main Dashboard: the two completed lists are
  Portion/Full members carrying their own $hgsd.toggle disclosure (one
  per-page show-completed state opens both), so no page-level markup or
  literal `-[[title]]` exclusions remain — their Settings drag position is
  still inert (the Full band renders after every portion; only the in-band
  order follows the list field). The waiting list is the sole Portion/2
  member (renders after Portion/1's members regardless of list-field
  position). every by-contact list is seeded hidden on the main dashboard
  (available in its Settings drag rows), the flat waiting list seeded hidden
  on the Actions waiting page. ui/tags/HyperGSD/Lists/ContactAction + its multids
  are LIVE (2026-09-01): the contact page's four lists (next/waiting/future/
  completed for the contact) are $hgsd.list blocks tagged with the hook (see
  the dedicated §7 entry) — the hardcoded-inline relic is gone, and contacts
  gained realm scoping + a settings tab.
  (The 4 stale TypeCore `core-*-visibility.multids` were deleted when the
  tag-driven Sections mechanism went live; the section-visibility *readers*
  now live in view-body/new-gsd-modal tag loops.) A fifth survivor,
  core-referencedashboard-visibility.multids (seeded visibility for a GSD5
  doodad panel section, ViewReferenceGroup, that never existed in either fork),
  was deleted 2026-08-30 — as were the unused GSD5 icons control/goto/notify/
  realm, the orphan lingo key Review/ProjectsActive, the baseless
  <<lingo Prompt>> line in colour-manager, and the sub-plugin's
  delegated-list.multids filename (renamed waiting-list.multids to match its
  $:/config/hypergsd/Lists/Waiting/ namespace; both entries are sub-plugin
  behaviour — absent plugin, flat waiting list shows).
- UNIFIED PORTIONS (2026-09-04, superseding the morning's Group rename):
  modules/section-portions (Global) holds BOTH chassis procedures —
  hgsd-section-portions (panel + modal; the twin inline loops in
  view-body/new-gsd-modal were deleted) and hgsd-dashboard-portions (the
  nine dashboard pages are now one-line calls; since 2026-09-05 every
  page uses the plain default — the completed lists are Portion/Full
  members that SELF-toggle via $hgsd.toggle, so GSD/Dashboard's former
  full="no" + hand-rolled reveal collapsed to the one-liner, and the
  chassis gate carries scoped show-completed runs to admit the in-member
  toggle writes). Portion/N slots sit side by side (.hgsd-capture row for
  panels/modal, full-width .hgsd-portion-columns for dashboards); the two
  band slots bracket the row as plain block siblings — Portion/Top spans
  before it (added 2026-09-06), Portion/Full after it (band gates chain the
  limit INSIDE the :and run — `:and[tag<X>limit[1]]`; the shipped
  `:and[tag<X>]limit[1]]` shape closed the run early, leaving limit[1] to
  parse as orphan titles that union-ed in, so band divs rendered empty-but-
  present on unclaimed tag lists until 2026-09-06); a portion exists the
  moment a member claims it; untagged members land in Portion/1 (routed by
  a separate untagged loop — else[<variable>] does not parse); order
  numeric, zero-pad beyond nine. Settings: the visibility-list draggable's
  item template (ui/components/portion-item-template wraps the core row +
  the Portion select, itself extracted 2026-09-06 into
  ui/components/portion-picker for sharing) retags the member (drops its other portion
  tags, adds the choice; options = the two bands bracketing portions in use
  + next-free, mirroring visual order; next-free is MAX-BASED since
  2026-09-06 — one past the highest number in use, seeded with the implicit
  Portion/1 as a plain run AFTER the :and enumeration (a seed before it is
  wiped — :and replaces the accumulator; the count-based form it replaced
  ignored the implicit 1, so an all-untagged tag list — the shipped main
  Dashboard among them — offered no number past 1, and a gapped tag's
  next-free duplicated an in-use number and vanished) so a fresh portion is
  always one pick away; the append run is deliberately UNPREFIXED — a + run
  replaces the accumulator with its own output, and a +[list[...]] once
  stripped every tag from the member instead of appending).
- Section visibility/order is now tag-driven and live: panel and modal render
  `tagging[$:/tags/hypergsd/{Panel,Modal}Template]` in two portion loops
  (one loop per distinct Portion/N tag in use — a portion exists the moment a
  section claims it; untagged sections land in Portion/1; order numeric, zero-pad
  beyond nine), guarded by
  `$:/config/hypergsd{Panel,Modal}/visibility/<section>` (`else[show]`).
  Order single-sourced in each primary tag tiddler's `list` field (drag
  writes an override); a container hugs its content (`width:fit-content`) and
  empty groups collapse via `:empty` (groups are bare `> div`s — the
  `.hgsd-capture-col` class was deleted 2026-09-04 when orientation became
  the `$:/config/hypergsd/panel-layout` setting via one transcluded display
  value: vertical stacks groups as boxes, horizontal flattens them
  (`display: contents`) so all sections share `.hgsd-capture`'s single
  wrapping flow — the first flow-inside-groups attempt kept Group/2 as a
  right-hand box, replaced same day; the group row also wraps now, so a
  cramped group drops below).
  Panel chassis is a styled `<fieldset class="hgsd-panel-fieldset">` (border
  box; revert option in Panel chrome); modal Attributes is a
  `<fieldset class="hgsd-modal-attributes">` + visible legend. Status radios
  are nested named fieldsets (visible legend in the modal, sr-only in the
  panel). Third-party sections need only the membership tag (+ optional
  Portion/N, /Top or /Full) — spacing/resets inherit from container rules (labels flow natively since 2026-09-01 — the grid stacking and 1em span inset are gone)
  (documented in readme "Extending HyperGSD").
- Status system (rode the Type tag list 2026-09-04, HARDCODED 2026-09-06):
  `hgsd-status-set/-default` (modules/status-sets, Global) single-source
  the sets — the function bodies now carry the literals
  (`[<type>match[action]then[next waiting future]split[ ]]` etc.), zero
  tag list reads per call; the tag's statuses/default-status fields
  were removed and the colour loop iterates `[[action]] [[project]]`
  directly. Replacement = shadow the whole status-sets tiddler (same
  title, Global tag, both function names, label/glyph procedures
  re-shipped); the type gate gained a status-sets prefix run so a
  replacement re-renders frozen panels, modals and rows live. status-radios
  and the row fragment render ONE loop template over
  the set (memory field computed as `gsd_<type>_status`; labels/glyphs fall
  back to the word/first letter when lingo keys are absent), the four
  `enlist[next waiting future]` validations and the per-type modal cascades
  collapsed to type-generic form, view-body's type computation is the
  tag list intersection (replacing the three-branch `then[action]`), and the
  pill colour classes are generated per status from the dictionary. MVV
  outcome: `\function` list returns + `[function[fn],[param]]` calls carry
  the sets — the round-bracket `[(var)]` retrieval turned out unnecessary.
  Per-status dashboard lists/sections remain the shipped five (opt-in via
  the list tag lists for replacement statuses). Benchmarked
  before/after (`scripts/bench-results.md`): no actionable regressions.
- Sidebar Collect tab renamed Capture (title, caption, hook tag
  `$:/tags/hypergsdCapture`; review-sidebar list-after, Table
  Dashboard transclusion, and the user `$:/tags/SideBar` list updated).
  The hook loop shipped with zero members and was removed 2026-08-30,
  superseded by the capture block tag lists.
- $:/tags/hypergsd/Lists/ContactAction (tag tiddler ships from the SUB-plugin):
  GSD5's contact-page list hook — **LIVE since 2026-09-01**. view-body-contact
  renders the tagged $hgsd.list blocks (next/waiting/future/completed for the
  contact; list field pins the order, completed excluded from the loop and
  transcluded inside the show-completed reveal, Dashboard pattern). Per-block
  visibility at `$:/config/hypergsd/Lists/ContactAction/visibility/*` (seeded
  show via contact-action-list.multids), editable on Settings → Contact page
  (the sub-plugin ships a `$:/tags/hypergsd/Settings/List` tab; caption key
  Settings/Pages/Contact/Caption). Realm scoping and grouping support arrive
  free via the engine. Historical: the main plugin's orphan
  contact-action-list multids seeds were deleted 2026-08-30 (they referenced
  list tiddlers that never existed in HyperGSD — the sub-plugin's tag tiddler
  also carried two such stale list-field entries until this conversion rewrote
  it); the former $:/tags/hypergsdReview mention here was stale — that tag
  never existed.
- (removed 2026-08-30) the never-read $:/config/hypergsd/references-group
  shadow and the user's stale override of it — the References dashboard reads
  $:/state/hypergsd/references-group.
- REMOVED 2026-09-05 (view-strip migration): the dashboard-grouping config,

Planned in-fork work (kept as reminders):
- Sidebar targets not yet shipped: GSD/Active Project List, GSD/Active
  Actions, GSD/Completed * sorted by name. GSD/Table Dashboard was extracted
  from the plugin to a user wiki tiddler on 2026-08-30 (hardcoded list set by
  design; review-sidebar link + Review/TableDashboard key retired with it) —
  the plugin now ships no table variant.
- The ticklers stylesheet title
  ($:/plugins/yan/hypergsd-ticklers/stylesheet/ticklers) does not match its
  disk path (ui/stylesheet/ticklers.tid) — the filename=title convention is
  broken for this one file.

Intentional:
- ui/readme.tid keeps GSD5 author credit — fork lineage attribution.
- Dashboard page titles are user-facing (`GSD/…`, linked by plain title from
  the sidebar and buttons); filenames match the last title segment by design,
  so the filename=title rule deliberately does not apply to them.

## 8. Index coverage (gortex)

- Repo tracked as `HyperGSD` (1 of 9). `.tid`/`.multids` have no extractor →
  0 symbol nodes for 125 wikitext files; this map was built from native reads
  and grep inventories.
- `modules/widgets/refresh.js`: file indexed and text-searchable
  (`search text "RefreshWidget"` → 6 hits) but currently exposes no symbol
  nodes (`read summary` → file_not_indexed); the earlier SCC analysis shows it
  as a singleton component (0 cycles).
- No md-mirror generated for HyperGSD (not requested; the gsd5-docs / tw5.com
  / dev mirrors cover their repos only).

## 9. Divergence from GSD5

Written after §1–8; comparative mapping, sourced from the migration/showcase
tiddlers plus both codebases.

| Dimension | GSD5 | HyperGSD |
|---|---|---|
| Item identity | `gsd_type` field | `$:/GSD/Action\|Project\|Contact\|Reference` tags (C-level tag index; "100% tags") |
| Realms | `gsd_realm` field + `$:/currentRealm` ("all" default) | `$:/GSD/Realm/<name>` tags + `$:/config/hypergsd/realm-selection` (multi-select set + `no-realm` sentinel; pristine=all; realm-less inclusion orthogonal; 2026-08-27 replaced the single-value 4-case tree); realms creatable in-modal |
| Contexts | gen-1 `gsd_type[context]` vs gen-2 "any tag" tension | explicit opt-in `GSD/Contexts` (the dashboard is the tag list); per-context view template + dashboard; excluded for contacts/references |
| Dependencies | `gsd_action` (single) | `gsd_prerequisites` list + picker + promotion + dependants section + modal back-linking |
| Contacts | `gsd_contact` field (34 sites) | same field, deliberately single; "new contact from action" auto-assigns |
| Rendering | gen-1 JS widgets; gen-2 `$gsd5.*` + dynamic `$:/tags/GSD5*` shadow-tag loops | `$hgsd.*` wikitext widgets; dashboard/list/section composition tag-driven (Lists/*, Panel/ModalTemplate, Capture/Block, ContactAction hooks) |
| Refresh | default widget refresh | `<$refresh>` freeze wrappers + whitelists; invisible to CPU until GSD item changes |
| Events | one widget per checkbox/radio | 1 `<$eventcatcher>` per region + raw `<input>`/`<button>` + `data-hgsd-*` contract |
| Status controls | `<$radio>` widgets | pure HTML radios (`input:checked + span` CSS), conditional `checked` attr |
| Completed items | always rendered | lazy "show completed" toggles (Dashboard, project/contact view templates) |
| Comments | terse What-one-liners | fully rewritten; Why-only convention since 2026-09-03 (engine gotchas and design decisions survive, narration and change-log residue are gone — history lives in this map). Provenance checkable with `scripts/gsd5-comment-match.js` against the workspace `gsd5/` reference copy: 10 inherited comments remain, all JS pragmas/widget-method boilerplate |
| Item-row hooks | `$:/tags/GSD5ListItemPrefix/Suffix` (11+ tag system) | RESTORED 2026-08-27 as `$:/tags/hypergsd/ListItem/Prefix`+`/Suffix` via `\procedure hgsd-item()`; fragments are ordinary tagged tiddlers (complete/status → Prefix; comp-date/note/realm/delete → Suffix — realm is the outside-selection globe fragment 2026-09-02); ordering = tag-tiddler `list` field first (Suffix ships one pinning comp-date→note→realm→project-link→delete), per-member visibility $:/config/hypergsd/ListItem/visibility/<title> since 2026-09-02 (hgsd-item's loops gate on it; the Settings → Fragments draggable edits Prefix+Suffix; Prefix ships none — alphabetical is already complete,status), unlisted append alphabetically; the four row-rendering refresh gates carry `[prefix[$:/tags/hypergsd/ListItem]] [tags[]prefix[$:/tags/hypergsd/ListItem]]` so fragment/tag-tiddler ADDITIONS and edits re-render frozen views live (removals ghost until next refresh — a deleted tiddler matches no whitelist run, same as item deletion, §9); row alignment is container-owned since 2026-09-03 (`.gsd-list-item` and `.hgsd-sizer-droplist` both `align-items: center`, so combined rows — prereq/dependants, panel value lines — never stretch; fragments carry no alignment CSS) |
| `$:/tags/hypergsd/LinkItem` + members | **link-adornment tag list** (2026-09-02) — fragments rendered after a GSD link to ANOTHER tiddler (the link-target counterpart of ListItem's own-item tag lists); `hgsd-link-items(linked-tiddler)` (ui/components/link-items, Global) is placed after the link by every host — pick-field's set state between value link and change button (`link-items="hide"` suppresses), prereq/dependants rows; members get `linked-tiddler` with ambient scope intact; membership = the switch, order via list field, per-member visibility $:/config/hypergsd/LinkItem/visibility/<title> (the Settings → Fragments draggable; hgsd-link-items gates on it); ONE tag list for panel and modal (read-only adornments self-gate on section-mode); members render inside the `span.hgsd-link-items` container (stylesheet: inline-flex, centred, `vertical-align: middle` — the centring mechanism for every host, so members carry no alignment CSS); ships one member: ui/link-items/realm (the cross-realm globe, gating in hgsd-realm-warning) |
| Panel | two columns (GSD5PanelCore + GSD5PanelPlugin hook) | Portion/N + Top/Full bands (Column→Group→Portion same day, 2026-09-04; Top band added 2026-09-06), one shared chassis (modules/section-portions) across panel/modal/dashboards; placement toggle above/below per type; orientation toggle stacked/flowing via stylesheet-transcluded `$:/config/hypergsd/panel-layout`; Settings Portion picker; prereq/dependants sections added |
| New-item flow | modal with type+title (status side-effects) | modal + type/status/project/contact/context/realm pickers, per-type status memory, keyboard submit/cancel, cancel-preserves-temp; inheritance = `$:/tags/hypergsd/Inheritance` rules at creation (informal-tags default, realm, contexts' context-tags; field values are the sections' — the temp pass-through copies render-time fields, mid-submit mutation never reaches it) |
| Pickers | flat `<$select>` dropdowns w/ dynamic filters | `$hgsd.pick` searchable popup (optgroups, current-project-first, extended search); cacheable static filters; blank-on-broken-link tradeoff |
| Deletion | core delete + refresh | no delete listener → ghost rows until refresh/next edit (deliberate) |
| Ticklers | subplugin (`gsd_tickdate`) | re-shipped as plugins/hypergsd-ticklers (2026-08-30): `gsd_tickler_date` + `gsd_tickler_repeat_days`, wikitext check policy, browser trigger hourly + `hgsd-plusdays`; GSD5's rollover bug fixed; 2026-09-02: firing became non-destructive (date never removed, due-day alerts, per-session dismissal); 2026-09-11: date arithmetic became core filters (`format:date[TIMESTAMP]`→`add`→`format:timestamp`, `hgsd-plusdays` deleted), quick buttons became advance buttons on the date section (+d/+w/+m/+y), `gsd_tickler_date_history` ledger appends on every date write, due-today via the core `days` operator; 2026-09-13: alert day became a local-date string compare (stored date part vs `<<now YYYY0MM0DD>>`) so alerts fire from local midnight in every timezone, with a dedicated self-rescheduling midnight run in the trigger |
| Namespace | `$:/config/gsd5/*`, `$:/tags/GSD5*` | `$:/config/hypergsd/*`, `$:/tags/hypergsd*`, `$:/state/hypergsd/*`; stragglers: CamelCase state titles (see §7) — the former dead ContactAction/HyperGSDReview hooks are gone (ContactAction live again since 2026-09-01) |
| Dashboards | plain titles (Dashboard, Contacts…) + Table Dashboard via plugin | `GSD/` title prefix; Table Dashboard extracted to user wiki 2026-08-30; Contexts dashboard added |
| Colours | per-status CSS tiddlers | `hgsd-status-colours` dictionary + generated per-status stylesheet rules (the colour-manager/PaletteManager editor still edits the dictionary) |
| Legacy compat | — | none left: the `$gsd5.complete`/`$gsd5.toggle` wrappers and `gsd5-colour` define were retired 2026-08-30 (zero consumers for months) |
| Migration path | — | migration tiddler: tag bulk-add via Tiddler Commander, gsd_action→gsd_prerequisites copy button, optional field cleanup (`gsd_type`, `gsd_realm`, `gsd_context`, `gsd_action`) |

Performance rationale (showcase): event delegation, pure-HTML rendering,
strict index lookups, frozen refresh triggers — decoupling GSD UI from the
global refresh cycle so large wikis keep actions forever without lag.

### Localisation
Every user-visible string lives as a `$:/language/hypergsd/*` shadow in
`language/en-GB/*.multids`, one file per feature family (Settings, Sections,
Convert, Lists, Dashboards, Toolbar, Sidebar, NewItem, Widgets); the Contacts
sub-plugin contributes keys to the same namespaces from its own `language/` folder
and reuses main keys for identical texts. Consumers: `lingo-base` + `<<lingo>>` in
transcluded tiddlers, full-path transclusions in Global-tagged files and attribute
position, filter-side pieces via `:map[get[text]]` and `{title}` operands (see
Localisation for the full recipe and traps). Convert fragments carry
lingo KEYS in their warning field. Translations wait on upstream bundled sub-plugins
(TiddlyWiki5 PR #8957, targeted v5.5.0).

### List grouping (2026-08-30)
$hgsd.list's grouped branch (used by 8 call sites — seven group-by="gsd_project",
one group-by="gsd_contact"):
group headings are now LINKS to the project (the group value is a project title;
the no-field fallback group, "No group" ($:/language/hypergsd/Lists/NoGroup),
stays unlinked plain text, always last); the trailing fallback container is
gated as a whole — previously its empty div rendered whenever every
item had a value. The engine sets `hgsd-grouped` (true/false) around both branch
families; the reference project chip (ListItem/Prefix, hgsd-grouped-gated) was
REMOVED 2026-09-05 — flat rows carry only the project-link suffix icon
(tooltip = project title), the chip's sole render context making it dead code; hgsd-grouped
stays set by the engine as a documented fragment contract. Its old gate read
"false" — absent (pick fields and other non-engine callers) means suppressed;
the chip also carries the realm-warning globe when the project falls outside
the current realm selection (untag the fragment to drop row globes).
`new-reference-button` is a single shared component
(ui/components/new-reference-button.tid in the References sub-plugin, $:/tags/Global/View, full-path transclusions
only): project-page calls pass project+realm, the dashboard call passes neither
(blank gsd-project/gsd-realm mean "no inheritance" in $hgsd.new-button).
Traps found: (a) References.tid's three <optgroup> tags shipped without their
closing `>` — the attribute scanner absorbs the following <option> tag as
attributes, so the select offered only its descending options (fakeDOM option
counts catch it: assert optgroup children, not descendant options);
(b) `:and[<var>…]` resurrects empty pipelines — filterrunprefix and.js
pushTop's the operand output and a <var> first-operator ignores the input
iterator, so `[items-without-field] :and[<flag>match[x]]` yields ["x"] — use
`:filter[<flag>match[x]]` (input-driven) like the parents-param guard;
(c) l10n rewordings outpaced three harnesses (dashboard-list/lingo/list-item
expectations still carried pre-rewording strings — found only when extending
dashboard-list-test); re-run the full battery after any string change.