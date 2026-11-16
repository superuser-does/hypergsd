#!/usr/bin/env node
"use strict";

/*
Stage plugin JSON tiddlers as plugin folders for the plugin library build:
--makelibrary only scans TIDDLYWIKI_PLUGIN_PATH folders (loadPluginFolder needs
a directory with a plugin.info), so each JSON batch is unpacked to
<out>/<publisher>/<name>/plugin.info (the outer plugin fields) plus
tiddlers.json (the subtiddlers, in the array format the application/json
deserializer feeds to loadTiddlersFromPath).

Usage: node scripts/stage-plugin-json.js <plugin.json>... --out <plugins-dir>
*/

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const outAt = args.indexOf("--out");
if(outAt < 1 || outAt !== args.length - 2) {
	console.error("Usage: node scripts/stage-plugin-json.js <plugin.json>... --out <plugins-dir>");
	process.exit(1);
}
const outDir = args[outAt + 1];

for(const input of args.slice(0, outAt)) {
	const batch = JSON.parse(fs.readFileSync(input, "utf8"));
	const plugin = (Array.isArray(batch) ? batch : [batch]).find(tiddler => tiddler["plugin-type"]);
	if(!plugin || !plugin.text) {
		throw new Error("no plugin tiddler with a text field in " + input);
	}
	const parts = plugin.title.match(/^\$:\/plugins\/([^/]+)\/([^/]+)$/);
	if(!parts) {
		throw new Error("not a $:/plugins/<publisher>/<name> title: " + plugin.title);
	}
	const dir = path.join(outDir, parts[1], parts[2]);
	fs.mkdirSync(dir, {recursive: true});
	const manifest = Object.assign({}, plugin);
	delete manifest.text;
	delete manifest.type;
	fs.writeFileSync(path.join(dir, "plugin.info"), JSON.stringify(manifest, null, "    "));
	fs.writeFileSync(path.join(dir, "tiddlers.json"), JSON.stringify(Object.values(JSON.parse(plugin.text).tiddlers)));
	console.log("Staged " + plugin.title + " " + (plugin.version || "(no version)") + " at " + dir);
}
