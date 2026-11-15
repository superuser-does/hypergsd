# Editions

* **site**: The main HyperGSD site: showcases the plugin and features documentation, downloads and the plugin library registration tiddler. Builds to `output/index.html`.
* **plugin-library**: Builds the plugin library served at `/library/pluginlibrary.html` on the main site.

The wiki downloads (`hypergsd-empty.html`, `hypergsd-complete.html`) are not built from folders here. They are assembled in the visitor's browser by the main site from two recipe tiddlers, `$:/editions/hypergsd/download-empty` and `$:/editions/hypergsd/download-complete`, which can be found under the `site` edition.

`editions/site/plugins` is a build-time copy of the repository's plugins folder and is never committed (it is in `.gitignore`)