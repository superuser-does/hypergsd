#!/usr/bin/env bash
# One-way deploy of the HyperGSD plugin family into the wiki's plugins folder.
# With --check: report drift between repo and wiki copies instead of syncing.
set -euo pipefail

repo_plugins="$(cd "$(dirname "$0")" && pwd)/plugins"
wiki_plugins="${HGSD_WIKI_PLUGINS:-/home/yan/tiddlywiki/plugins}"

shopt -s nullglob

if [ "${1:-}" = "--check" ]; then
  status=0
  for d in "$repo_plugins"/hypergsd*; do
    diff -rq "$d" "$wiki_plugins/$(basename "$d")" || status=1
  done
  for dst in "$wiki_plugins"/hypergsd*; do
    [ -d "$repo_plugins/$(basename "$dst")" ] || { echo "wiki-only family folder: $dst"; status=1; }
  done
  if [ $status -eq 0 ]; then echo "wiki copy matches the repo"; fi
  exit $status
fi

# --checksum: converge by content, so equal-size edits and preserved mtimes cannot mask a difference
for src in "$repo_plugins"/hypergsd*; do
    rsync -a --checksum --delete "$src/" "$wiki_plugins/$(basename "$src")/"
done

# Folder-level counterpart of rsync --delete: a family member withdrawn from the repo leaves the wiki too
for dst in "$wiki_plugins"/hypergsd*; do
    [ -d "$repo_plugins/$(basename "$dst")" ] || rm -rf "$dst"
done