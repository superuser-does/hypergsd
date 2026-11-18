/*\
title: $:/plugins/sq/widgets/refresh.js
type: application/javascript
module-type: widget

Copyright 2026 Saq Imtiaz
License: BSD 3 Clause: https://opensource.org/license/bsd-3-clause

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var Widget = require("$:/core/modules/widgets/widget.js").widget;

var RefreshWidget = function(parseTreeNode,options) {
	this.initialise(parseTreeNode,options);
};

/*
Inherit from the base widget class
*/
RefreshWidget.prototype = new Widget();

/*
Render this widget into the DOM
*/
RefreshWidget.prototype.render = function(parent,nextSibling) {
	this.parentDomNode = parent;
	this.computeAttributes();
	this.execute();
	this.renderChildren(parent,nextSibling);
};

/*
Compute the internal state of the widget
*/
RefreshWidget.prototype.execute = function() {
	// Get our parameters
	this.filter = this.getAttribute("subfilter");
	// Construct the child widgets
	this.makeChildWidgets();
};

/*
Selectively refreshes the widget if needed. Returns true if the widget or any of its children needed re-rendering
*/
RefreshWidget.prototype.refresh = function(changedTiddlers) {
	var changedAttributes = this.computeAttributes(),
		filteredChanges;
	if($tw.utils.count(changedAttributes) > 0) {
		this.refreshSelf();
		return true;
	} else {
		var changedTiddlerTitles = [];
		$tw.utils.each(changedTiddlers,function(change,title){
			changedTiddlerTitles.push(title);
		});
		filteredChanges = this.wiki.filterTiddlers(this.filter,null,this.wiki.makeTiddlerIterator(changedTiddlerTitles));
		if(this.filter && filteredChanges.length > 0) {
			return this.refreshChildren(changedTiddlers);
		} else {
			return true;
		}
	}
};

exports.refresh = RefreshWidget;

})();