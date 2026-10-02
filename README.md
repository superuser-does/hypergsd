# HyperGSD

Development repository for the HyperGSD plugin family for TiddlyWiki: the main
`hypergsd` plugin and its sub-plugins (contacts, contexts, priorities,
references, ticklers, trashbin). The repository root is itself a TiddlyWiki
wiki folder (after the tw5-relink convention): `tiddlywiki.info`, `plugins/`,
`tiddlers/` — so the stock `tiddlywiki` command works on it directly.

## Layout

`plugins/<name>/` mirrors the deployed layout one to one. Plugin titles come
from each `plugin.info`; the wiki loads every folder under its `plugins/`
directory automatically, so no wiki configuration changes when a plugin is
added here.

## Development wiki

    tiddlywiki . --listen

serves this repository as a wiki with the whole family loaded (needs the
`tiddlywiki` CLI, e.g. `npm install` in this repo).

## Deploying

The copies under `/home/yan/tiddlywiki/plugins/` are generated; edit the
source only in this repository. After edits, run:

    ./sync-to-wiki.sh

The script rsyncs each `plugins/hypergsd*` folder one way into the wiki,
deletions included, and removes a wiki family folder that no longer exists
here. `./sync-to-wiki.sh --check` diffs the two without writing. Set
`HGSD_WIKI_PLUGINS` to target a different wiki folder. Syncthing carries the
wiki directory to the server as before; there is no separate production step.

Restart the local wiki server after syncing (`npm start` in
`/home/yan/tiddlywiki`): the node server indexes plugin files at startup only.

## Verifying

    npm test                 # the headless battery (tests/run-all.js)
    npm run bench            # the benchmarks (baselines/results in tests/)
    ./sync-to-wiki.sh --check  # diff this repo against the wiki copy

### The battery

`tests/` carries the headless suite: one node process per `*-test.js` file, the
data-driven `wiki-tests.js` cases, the shared harness (`lib/harness.js`) and two
fixture wikis whose `plugins/` symlink THIS repository's plugins — the battery
tests the source tree, not the deployed copies (the standalone kookma trashbin
plugin, a dependency of hypergsd-trashbin, stays symlinked from the wiki).
`node tests/run-all.js` runs everything under `TZ=UTC` (the date-sensitive
harnesses compare stored UTC dates with the calendar date) and aggregates exit
codes; `node tests/run-all.js <substring>` narrows the run.

Wiki-test cases (`tests/wiki-tests/*.tid`, after upstream TiddlyWiki's own
suite) hold fixtures, an `Output` section, an `ExpectedResult` section and an
optional `Actions` section, separated by `+` lines. The runner resets fixtures
between cases, renders through the standard Global import chain, runs the
actions and refreshes before comparing. Derive the expected HTML with
`node wiki-tests.js --show <case>` (or `--show-after` for post-action state),
VERIFY it is semantically right, then freeze it into `ExpectedResult`.
