/*\
title: $:/plugins/yan/hypergsd/modules/widgets/refresh.js
type: application/javascript
module-type: widget

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
    this.filter = this.getAttribute("subfilter");
    // Filtered-subfilter derivation cache (opt-in via subfilter-tag-inputs):
    // the listed tag-list titles are the derivation's only tiddler inputs —
    // their tagging sets and those tiddlers' contents. Fingerprint those
    // inputs so refreshes can skip re-deriving an unchanged subfilter. The
    // fingerprint must be read from CURRENT wiki state, not the changed
    // set: changes to these inputs may be inhibited upstream and never
    // reach this widget, so the changed set cannot prove them absent.
    this.subfilterTagInputs = this.getAttribute("subfilter-tag-inputs") ?
        ($tw.utils.parseStringArray(this.getAttribute("subfilter-tag-inputs")) || []) : null;
    this.subfilterFingerprint = this.subfilterTagInputs ? this.subfilterInputFingerprint() : null;
    this.makeChildWidgets();
};

/*
Fingerprint the tiddler inputs of a cached subfilter: per tag-list title, the
sorted member titles with their change counts (the engine's own monotonic
per-tiddler counter — the <<changecount>> / haschanged[] primitive). Member
content edits and membership changes (both directions — a departed member
leaves the live tag index, but the count sequence then differs) all alter the
fingerprint; change counts, unlike modified stamps, never collide across
rapid successive edits.
*/
RefreshWidget.prototype.subfilterInputFingerprint = function() {
    var self = this,
        parts = [];
    $tw.utils.each(this.subfilterTagInputs,function(listTitle) {
        parts.push("L" + listTitle);
        var members = self.wiki.getTiddlersWithTag(listTitle).sort();
        $tw.utils.each(members,function(memberTitle) {
            parts.push(memberTitle + "\x01" + self.wiki.getChangeCount(memberTitle));
        });
    });
    return parts.join("\x02");
};

/*
Selectively refreshes the widget if needed. Returns true if the widget or any of its children needed re-rendering
*/
RefreshWidget.prototype.refresh = function(changedTiddlers) {
    var self = this;
    // Cached-subfilter fast path: while the input fingerprint is unchanged,
    // skip re-deriving the filtered subfilter (the expensive attribute).
    // Busters and other attributes still compute, so their changes keep
    // driving refreshSelf; a refreshSelf re-executes against current state.
    var fingerprint = this.subfilterTagInputs ? this.subfilterInputFingerprint() : null;
    var skipSubfilter = fingerprint !== null && fingerprint === this.subfilterFingerprint;
    var changedAttributes = skipSubfilter ?
        this.computeAttributes({filterFn: function(name) {return name !== "subfilter";}}) :
        this.computeAttributes();
    this.subfilterFingerprint = fingerprint;
    if($tw.utils.count(changedAttributes) > 0) {
        this.refreshSelf();
        return true;
    } else {
        var changedTiddlerTitles = [];
        $tw.utils.each(changedTiddlers,function(change,title){
            changedTiddlerTitles.push(title);
        });
        // Pass this widget as the filter context so subfilters can reference
        // variables like <currentTiddler> — this is what lets a whitelist be
        // scoped per instance (e.g. only THIS panel's picker temps). Subfilters
        // that use no variables are unaffected.
        var filteredChanges = this.wiki.filterTiddlers(this.filter,this,this.wiki.makeTiddlerIterator(changedTiddlerTitles));
        if(this.filter && filteredChanges.length > 0) {
            return this.refreshChildren(changedTiddlers);
        } else {
            return false; // Inhibits refresh
        }
    }
};

exports.refresh = RefreshWidget;

})();