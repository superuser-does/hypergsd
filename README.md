# HyperGSD

HyperGSD is a family of plugins for TiddlyWiki: Get Stuff Done in hypermedia. It combines David Allen's Getting Things Done workflow with TiddlyWiki's tagging and linking, so your tasks can live inside an all-in-one personal wiki. A dedicated wiki works too.

> **Looking to use HyperGSD?** Visit **[superuser-does.github.io/hypergsd](https://superuser-does.github.io/hypergsd/)**. The wiki holds the documentation, and each plugin installs from there by drag and drop. This README covers the development repository.

## What you get

- **Actions and projects.** Actions can depend on other actions, in both directions. Projects hold actions and other projects.
- **Realms.** Tags in the `$:/GSD/Realm/<name>` format (Personal, Professional) split your items into domains. Items with no realm appear in every realm view.
- **Capture and Review.** Collect actions from the Capture sidebar tab; the new-item modal sets the type, status, project, contact, context and realm before creation. Work through what you captured on the Review tab's dashboards, including cleanup dashboards for stale items. Every dashboard section is a tiddler on a tag list, so sections can be added, removed and reordered, and which sections ship is configurable from the control panel.
- **The pick family.** Projects, contacts, contexts and prerequisites are set through type-to-search pickers. Type a title that does not exist and press Enter, and the tiddler is created and linked in one move.
- **Speed on large wikis.** Dashboards are wrapped in refresh gates that block global updates while you type or search, each list handles its clicks through a single event catcher, and item types are tags, so every lookup runs on TiddlyWiki's tag index. Completed actions on project and contact pages load on demand.
- **Extensibility.** Most surfaces are tag lists, and the same hooks are documented for your own extensions: see the HyperGSD API tiddlers on the wiki.

HyperGSD re-architects Roma Hicks's GSD5 plugin, the newest in a line of GSD plugins for TiddlyWiki going back to the mid-2000s. The rewrite removed the typing and navigation lag of large GSD wikis and ended the need to delete completed actions to keep them fast, so actions can be kept long term. GSD5 users can bring their data across: see the [migration guide](https://superuser-does.github.io/hypergsd/#Migrating%20from%20GSD5%20to%20HyperGSD).

## Sub-plugins

Each sub-plugin needs the main plugin installed.

| Plugin | Purpose |
| --- | --- |
| `hypergsd-contacts` | Contact pages with their own dashboards; one contact per action or project, by design |
| `hypergsd-contexts` | Contexts are ordinary tiddlers: assign a context to an action by tagging it with the context's title; context pages carry their own dashboards |
| `hypergsd-priorities` | Priorities with configurable names and colours |
| `hypergsd-references` | Reference material linked to your items, shown on their pages |
| `hypergsd-ticklers` | Dated reminders with repeat intervals, raised as banner alerts |
| `hypergsd-trashbin` | Sends completed items to kookma's Trashbin instead of deleting them |

## Development

The repository root is itself a TiddlyWiki wiki folder (`tiddlywiki.info`, `tiddlers/`, `plugins/`), so the stock `tiddlywiki` command works on it directly:

```
npm install
tiddlywiki . --listen          # serve the wiki: documentation and plugins together
tiddlywiki . --build index     # build a single-file wiki into output/
```

`npm install` brings the pinned `tiddlywiki` CLI. GitHub Pages deploys the single-file build to the site above on every push to `main`.

### Layout

- `plugins/` is the canonical source of the plugin family: the main plugin plus one folder per sub-plugin. `plugins/trashbin/` is the vendored third-party kookma Trashbin plugin, a dependency of hypergsd-trashbin. Copies of the plugins inside other wikis are generated; never edit those.
- `tiddlers/` is the wiki's own content: the family's documentation tiddlers, tagged `Documentation` or `HyperGSD API` and indexed from the `HyperGSD API` tiddler. Treat it as live content, not a build artefact.
- TiddlyWiki loads every folder under a wiki's `plugins/` directory automatically, so no wiki configuration is needed: serving or building this repository publishes the plugins alongside their documentation.

### Verifying

```
npm test                 # the headless battery (tests/run-all.js)
npm run bench            # the benchmarks (baselines and results in tests/)
```

The battery runs one node process per `*-test.js` file, under `TZ=UTC` because the date-sensitive harnesses compare stored UTC dates with the calendar date, and aggregates the exit codes. `node tests/run-all.js <substring>` narrows the run. The fixture wikis in `tests/` symlink this repository's `plugins/`, so the battery tests the source tree rather than a wiki's copies; the standalone kookma Trashbin symlink comes from a wiki folder outside this repository.

Wiki-test cases (`tests/wiki-tests/*.tid`, after upstream TiddlyWiki's own suite) hold fixtures, an `Output` section, an `ExpectedResult` section and an optional `Actions` section, separated by `+` lines. The runner resets fixtures between cases, renders through the standard Global import chain, runs the actions and refreshes, then compares. Derive the expected HTML with `node wiki-tests.js --show <case>` (or `--show-after` for post-action state), VERIFY it is semantically right, then freeze it into `ExpectedResult`. Run the whole battery after any change: expectations embed rendered strings, so wording changes surface as stale expectations.

## Licence

Apache Licence 2.0 (Copyright 2026 Ioannis Anthymidis). The core plugin derives from Roma Quintin Hicks's GSD5 (MIT; the notice is retained in the plugin's licence tiddler). hypergsd-trashbin depends on Mohammad Rahmani's Trashbin (MIT), and hypergsd-ticklers ships a Lucide calendar icon by Cole Bemis (MIT).
