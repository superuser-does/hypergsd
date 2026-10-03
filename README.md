# HyperGSD

Development repository for the HyperGSD plugin family for TiddlyWiki: the main
`hypergsd` plugin and its sub-plugins (contacts, contexts, priorities,
references, ticklers, trashbin). The repository root is itself a TiddlyWiki
wiki folder (after the tw5-relink convention): `tiddlywiki.info`, `plugins/`,
`tiddlers/` — so the stock `tiddlywiki` command works on it directly.

## The wiki site

This wiki exists specifically to host HyperGSD as a plugin. `tiddlers/` holds
the plugin family's documentation as content tiddlers (tagged
`Documentation`/`HyperGSD API`, indexed from the `HyperGSD API` tiddler), and
`plugins/` holds the family source — every folder under a wiki's `plugins/`
directory loads automatically, so serving or building this folder publishes
the plugin alongside its docs:

    tiddlywiki . --listen          # serve the wiki (docs + plugins live)
    tiddlywiki . --build index     # or build a static single-file wiki

(Both need the `tiddlywiki` CLI, e.g. `npm install` in this repo.)

## Layout

`plugins/<name>/` mirrors the deployed layout one to one. Plugin titles come
from each `plugin.info`; a wiki loads every folder under its `plugins/`
directory automatically, so no wiki configuration changes when a plugin is
added here. `plugins/trashbin/` is the vendored third-party kookma Trashbin
plugin (a soft dependency of hypergsd-trashbin).

## Deploying

The copies inside a wiki folder's `plugins/` directory are generated; edit the
source only in this repository. After edits, run:

    ./sync-to-wiki.sh

The script rsyncs each `plugins/hypergsd*` folder one way into the target
wiki's `plugins/` directory, deletions included, and removes a family folder
that no longer exists here. `./sync-to-wiki.sh --check` diffs the two without
writing. Set `HGSD_WIKI_PLUGINS` to the target wiki folder's `plugins`
directory. Restart the target wiki's server after syncing: the node server
indexes plugin files at startup only. If that wiki folder is carried to a
production server by an external sync, that pipeline picks changes up on its
own; there is no separate production step here.

## Verifying

    npm test                 # the headless battery (tests/run-all.js)
    npm run bench            # the benchmarks (baselines/results in tests/)
    ./sync-to-wiki.sh --check  # diff this repo against the deployed copies

### The battery

`tests/` carries the headless suite: one node process per `*-test.js` file, the
data-driven `wiki-tests.js` cases, the shared harness (`lib/harness.js`) and two
fixture wikis whose `plugins/` symlink THIS repository's plugins — the battery
tests the source tree, not the deployed copies (the standalone kookma trashbin
plugin, a dependency of hypergsd-trashbin, stays symlinked from the deployed
wiki). `node tests/run-all.js` runs everything under `TZ=UTC` (the date-sensitive
harnesses compare stored UTC dates with the calendar date) and aggregates exit
codes; `node tests/run-all.js <substring>` narrows the run.

Wiki-test cases (`tests/wiki-tests/*.tid`, after upstream TiddlyWiki's own
suite) hold fixtures, an `Output` section, an `ExpectedResult` section and an
optional `Actions` section, separated by `+` lines. The runner resets fixtures
between cases, renders through the standard Global import chain, runs the
actions and refreshes before comparing. Derive the expected HTML with
`node wiki-tests.js --show <case>` (or `--show-after` for post-action state),
VERIFY it is semantically right, then freeze it into `ExpectedResult`.
