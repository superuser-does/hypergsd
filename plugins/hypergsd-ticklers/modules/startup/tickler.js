/*\
title: $:/plugins/yan/hypergsd-ticklers/modules/startup/tickler.js
type: application/javascript
module-type: startup

Tickler check trigger: runs the wikitext check procedure
(modules/tickler-check.tid, $:/tags/Global) at startup, at the top of
every hour, and at local midnight. All policy lives in the procedure.

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

exports.name = "hgsd-tickler-check-trigger";
exports.platforms = ["browser"];
exports.after = ["startup"];
exports.synchronous = true;

exports.startup = function() {
	const doc = $tw.fakeDocument || document;
	const run = () => {
		// No-ops safely if the procedure is absent
		const tree = $tw.wiki.makeWidget($tw.wiki.parseText("text/vnd.tiddlywiki",
				'<$importvariables filter="[all[shadows+tiddlers]tag[$:/tags/Macro]] [all[shadows+tiddlers]tag[$:/tags/Global]]"><$transclude $variable="hgsd-tickler-check"/></$importvariables>'),
			{parentWidget: $tw.rootWidget, document: doc});
		const container = doc.createElement("div");
		tree.render(container);
		tree.invokeActions(tree,{type: "tm-generic"});
	};
	run();
	// Align to the top of the next hour, then run hourly
	const msToNextHour = 3600000 - (Date.now() % 3600000);
	setTimeout(() => {
		run();
		setInterval(run,3600000);
	},msToNextHour);
	// Local-midnight run: the alert pass matches the stored date part to the
	// user's calendar date, so the day's ticklers alert the moment that date
	// begins rather than at the next top-of-hour check (up to 59 minutes
	// later). Each midnight run books the next.
	const scheduleMidnightRun = () => {
		const now = new Date();
		const nextMidnight = new Date(now);
		nextMidnight.setHours(24,0,0,0); // rolls to the start of tomorrow, local time
		setTimeout(() => {
			run();
			scheduleMidnightRun();
		},nextMidnight - now);
	};
	scheduleMidnightRun();
};

})();