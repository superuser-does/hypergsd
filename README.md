# HyperGSD

Development repository for the HyperGSD plugin family for TiddlyWiki: the main
`hypergsd` plugin and its sub-plugins (contacts, contexts, priorities,
references, ticklers, trashbin).

## Layout

`plugins/<name>/` mirrors the deployed layout one to one. Plugin titles come
from each `plugin.info`; the wiki loads every folder under its `plugins/`
directory automatically, so no wiki configuration changes when a plugin is
added here.

## Deploying

The copies under `/home/yan/tiddlywiki/plugins/` are generated; edit the
source only in this repository. After edits, run:

    ./sync-to-wiki.sh        # or: make sync

The script rsyncs each `plugins/hypergsd*` folder one way into the wiki,
deletions included, and removes a wiki family folder that no longer exists
here. Set `HGSD_WIKI_PLUGINS` to target a different wiki folder. Syncthing
carries the wiki directory to the server as before; there is no separate
production step.

Restart the local wiki server after syncing (`npm start` in
`/home/yan/tiddlywiki`): the node server indexes plugin files at startup only.

## Verifying

    make check               # diff this repo against the wiki copy
