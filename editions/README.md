HyperGSD editions
=================

site            The main HyperGSD site: showcase, documentation, downloads and
                the plugin library registration tiddler. Built to output/index.html.

plugin-library  Builds the plugin library served at /library/pluginlibrary.html
                on the main site.

The download wikis (hypergsd-empty.html, hypergsd-complete.html) are not built
from folders here. They are assembled in the visitor's browser by the main
site from two recipe tiddlers, $:/editions/hypergsd/download-empty and
$:/editions/hypergsd/download-complete, which live in the site edition.

editions/site/plugins is a build-time copy of the repository's plugins folder
and is not committed.