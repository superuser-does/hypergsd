---
name: tiddlywiki-develop-with-playwright
description: Develop and test TiddlyWiki tiddlers locally — edit sources, verify headlessly in node, verify in a local browser via Playwright, and only then deploy. Use when building or debugging TiddlyWiki plugins, wikitext or wiki content.
tools: ['bash']
---

Work locally first; a deployed wiki is only for final verification. Try the steps in order and move to the next only when the current one cannot answer the question:

1. **Edit sources locally** — plugin tiddlers in the plugin repository's `plugins/<name>/` folders; wiki content tiddlers in the wiki folder's `tiddlers/` directory.
2. **Verify headlessly** (fast, no browser) — parse checks and behaviour tests in node.
3. **Verify in the browser locally** — a local server + Playwright.
4. **Verify on a deployed server** (rarely) — final confirmation only.

Things you SHOULD AVOID:

1. DO NOT read or edit a saved single-file wiki (`index.html` and friends) directly — it is an export, not a source.
2. DO NOT use `$tw.wiki.addTiddler()` to modify **plugin** tiddlers on a running wiki — in-memory edits are ephemeral and, if saved, become shadow tiddlers that override the plugin files. Edit the source file instead, then restart the server (rule below).
3. DO NOT change the `modified` timestamp, or alter the content, of any real tiddler in `tiddlers/` while testing. Test with scratch tiddlers and delete them when done.

## How to read TiddlyWiki docs

The official documentation is at https://tiddlywiki.com; the full source (core, editions — including the tw5.com docs — and the test suites) lives at https://github.com/TiddlyWiki/TiddlyWiki5. A local checkout of that repository, when available, is the best offline reference. Search before generating code:

```bash
grep -rn "firstnonempty" <TiddlyWiki5-checkout>/editions/tw5.com/tiddlers/
```

## Step 2: headless verification (node harness)

Boot the real TiddlyWiki core in node against the local source — no server, no browser. The harness pattern:

```javascript
// tests/<area>-test.js — reuse the shared harness lib when the project has one
// (boot, makeRender, textOf, resetFixtures, array-safe t/finish) rather than
// copying the boot block afresh.
const $tw = require("<TiddlyWiki5-checkout>/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true; $tw.boot.argv = []; $tw.boot.startup();
const fd = require("<TiddlyWiki5-checkout>/core/modules/utils/fakedom.js");
const wiki = $tw.wiki, doc = fd.fakeDocument;
const fs = require("fs");

// load widget definitions (everything after the "\whitespace trim" line)
function body(p) {
  const raw = fs.readFileSync("<plugin-repo>/plugins/<plugin>/" + p, "utf8");
  return raw.substring(raw.indexOf("\n", raw.indexOf("\\whitespace")) + 1);
}
const defs = body("modules/widgets/example-widget.tid");

// fixture tiddlers
wiki.addTiddler({title: "Example", text: "x", tags: ["someTag"]});

// render wikitext (harness or file body) and inspect the fake DOM
function render(wikitext) {
  const parser = wiki.parseText("text/vnd.tiddlywiki", defs + "\n\n" + wikitext);
  const w = wiki.makeWidget(parser, {document: doc, parentWidget: $tw.rootWidget});
  const c = doc.createElement("div");
  w.render(c);
  return {w, c};
}
```

Use it for three classes of check:

**Parse-clean audit** — walk the parse tree for text nodes containing `</$` (unterminated tags) and any text starting with a stray `>`:

```javascript
(function walk(n){ if(!n) return; if(Array.isArray(n)) return n.forEach(walk);
  if(n.type==="text" && /<\/?\$|^>/.test(String(n.text))) console.log("STRAY:", JSON.stringify(n.text.slice(0,40)));
  if(n.children) walk(n.children); })(parser.tree);
```

The walk only sees top-level wikitext: a `\procedure`/`\widget` block parses to a
single `set` pragma node with its body stored unparsed (it is parsed only when
called). To audit procedure bodies, extract the text between the signature and
`\end` and parseText it separately.

**DOM assertions** — fakeDOM elements have `.tag` (not `.tagName`), `.attributes` and `.children`; text nodes have `.textContent` but avoid reading it on elements (its getter needs the `$tw` global). Collect options/buttons/etc.:

```javascript
const opts = [];
(function f(n){ if(!n||typeof n!=="object") return; if(Array.isArray(n)) return n.forEach(f);
  if(n.isTiddlyWikiFakeDom) { if(n.tag==="option") opts.push(n.attributes.value); if(n.children) f(n.children); } })(c.children);
```

**Action invocation** — find widgets by `parseTreeNode.tag`, then fire their action strings (`invokeActionString`, since action widgets never fire on render):

```javascript
let cb = null;
(function f(n){ if(!n||typeof n!=="object"||cb) return; if(Array.isArray(n)) return n.forEach(f);
  if("checkboxCheckActions" in n) cb = n; if(n.children) f(n.children); })(w.children);
cb.invokeActionString(cb.checkboxCheckActions, cb, {type: "click"});
// then assert on wiki.getTiddler(...)
```

Caveats from real test runs:

- **Boot against a disposable wiki, never a real one**: set `$tw.boot.argv = ["<fixture-wiki-folder>"]`. Booting with an empty argv uses the process working directory as the wiki — if that is ever a real wiki root, the filesystem syncer writes every harness fixture tiddler into `tiddlers/`, where empty stubs can silently shadow plugin tiddlers.
- Widget constructors all report `constructor.name === "Widget"` (TW's prototypal style) — identify widgets by `parseTreeNode.tag`, never by class name.
- `action-navigate` calls `getBoundingClientRect`, which fakeDOM lacks; patch it out on a rendered throwaway button instance if your action chain navigates.
- Popup `$reveal type="popup"` needs state text of the form `(x,y,w,h)` — e.g. `wiki.addTiddler({title: "$:/state/popup/example", text: "(0,0,1,1)"})`.
- A pragma appearing mid-wikitext (after other content) is NOT processed — hoist `\procedure`/`\widget` blocks to the top of the harness text. The same bites runtime-registered clones: `addTiddler`ing a `\widget` body that still carries the file's `title:`/`tags:` header lines leaves the pragma inert — strip headers (everything through the first blank line) first.
- **Probe-file escaping (the recurring one):** in JS probe files, `$` in strings needs NO escaping — write `$:/tags/Global` raw. A doubled `\\$` in source (a habit from shell heredocs) stays a literal backslash in the value, silently breaking every `$:/` lookup in the string (symptom: "Undefined widget", empty imports, filters matching nothing) while identical-looking code from a working file passes. When a probe misbehaves, `cat -A` the line and compare bytes against a known-good harness before trusting the logic.
- **`Error.stackTraceLimit` defaults to 10** — stacks captured in instrumentation get truncated mid-chain and look impossible (a widget refresh with no caller). Set `Error.stackTraceLimit = 60` before capturing.
- **`$refresh` return value ≠ gating:** refresh.js's permit branch is `return this.refreshChildren(...)` — a PERMITTED descent whose children changed nothing still returns false. When debugging refresh-gating widgets, instrument the filter evaluation, never the return value.
- **Refresh-map entries for never-created titles read as deletions** — `w.refresh({X: {title: X}})` without a prior `addTiddler(X)` makes `[!is[tiddler]]`-style runs match (the iterator resolves `wiki.getTiddler(X)` → null). For an "unrelated edit" benchmark/case, always addTiddler first — otherwise you are measuring the deletion path.
- **fakeDOM element nodes expose no aggregated textContent** — reading `.textContent` on an element returns undefined/empty; walk children recursively and collect text-node content. Also `JSON.stringify` on fakeDOM nodes throws (parentNode cycles) — never stringify a node subtree.
- **Run date-sensitive harnesses with `TZ=UTC`** — procedures that compare stored UTC date strings against the LOCAL calendar date disagree with `toISOString()`-built fixtures in any non-UTC zone, and passes can diverge between local and UTC midnight.
- **Array-valued assertions in test helpers are vacuously true** — a helper shaped `t(name, ok, extra)` with `if (!ok)` passes ANY array (arrays are truthy), so `[a, b]`-form assertions never fail. Guard with an explicit deep compare (`if (Array.isArray(ok)) ok = JSON.stringify(ok) === JSON.stringify(extra)`). When reviving or editing a stale test file, check the helper first — a suite that "passes" after a behaviour change may be silently vacuous.
- **Fixture-boot warnings about missing plugins are benign** when the fixture's `plugins/` folder symlinks/auto-loads the plugins anyway — folder auto-discovery loads every subfolder regardless of what `tiddlywiki.info` lists.
- **Battery drift after string/UI edits:** changes to labels, lingo keys and sidebar order surface in a test battery as stale expectations, not code bugs — check the live value before touching the plugin. Worked set: `<q>`-wrapped labels lose their quotation marks in textContent (assert the unquoted text PLUS a structural `q`-element check); renames move lingo keys and render targets; a thin-space `&#8201;` entity in a label breaks exact-equality checks; a config-tiddler rename silently no-ops a test's kill switch; and a sidebar block reorder via entry RETAGGING must also update the block tag-list `list` fields — stale lists make within-block order fall back to alphabetical silently. After moving lingo keys, run an orphan audit: `grep -rhoE '\$:/language/<plugin>/[A-Za-z0-9/]+' <sources> | sort -u` then check each resolves in a booted wiki (trailing-slash lingo bases and runtime-assembled keys are expected "orphans"). When sweeping battery results, grep `"^FAIL |FAILURES|Error:"` — a loose case-insensitive `fail|error|stray` pattern false-positives on passing output.
- **`wiki.filterTiddlers(filter, w, {variables})` does NOT bind those variables** — the third argument is not a variable-binding options bag; unresolved `<var>` references return `[]` silently while the logic under test is fine. Bind variables where the engine does: `wiki.makeWidget(parser, {variables: {...}})`, or `$let`/`$set` in the probe's wikitext. Symptom signature: a filter that works pasted into the wiki but "fails" headlessly with variables involved.
- **fakeDOM renders SVG image transclusions as fallback LETTER text** — glyph-bearing rows acquire stray letters before titles, and substring matching over row text can match link CLASS names as well. Match row identity by exact class on the identifying element, never by row-div substring.
- **Never print a filter-string variable as wikitext to probe it** — rendering `<<var>>` or `[<var>]` parses the value's brackets/`<refs>` as markup — `[tag[…]]` linkifies, a `<ref>` inside the value swallows following closers (one debug line can render literal `</$let>` text and "break" a healthy file). Probe such variables through `<$text text={{{ [<var>length[]] }}}/>` sinks or evaluate `[subfilter<var>]` and inspect the OUTPUT titles.
- **`pkill -f` on a server pattern can kill your own wrapper** — a bash command whose text contains both the pkill and the launcher line matches its own cmdline and dies with the fresh server. Kill by PID or run the pkill and the relaunch as separate commands — and after any restart, curl the server and check the SERVED content, not just the exit code.

## Step 3: local browser testing

A TiddlyWiki node-server folder serves itself, and plugins auto-load: every subfolder of the wiki's `plugins/` directory is included as a plugin (no `tiddlywiki.info` changes needed).

```bash
# start the local server (from the wiki folder)
tiddlywiki . --listen

# open a headed session (user can watch)
playwright-cli -s=local open http://localhost:8080/ --headed

# reload after editing source files: RESTART the server (edits outside
# TiddlyWiki itself are not indexed until restart), then refresh in-place
# (~2s) instead of reopening:
playwright-cli -s=local run-code 'async page => {
  await page.evaluate(() => $tw.rootWidget.dispatchEvent({type: "tm-browser-refresh"}));
  await page.waitForTimeout(2000);
}'
```

**Restart rule:** any change made through the filesystem (editing a `.tid`, saving from your editor) requires a server restart before the wiki serves it. Changes made through TiddlyWiki's own UI are saved into `tiddlers/` live and need no restart.

**Real-data rule:** a local server serves the real wiki content and saves edits back to `tiddlers/`. Never alter real tiddlers' content or `modified` timestamps while testing — create scratch tiddlers (distinctive titles help) and delete them afterwards:

```bash
# scratch tiddler for testing
playwright-cli -s=local run-code 'await page.evaluate(() => {
  $tw.wiki.addTiddler(new $tw.Tiddler({
    title: "ZZ-test-scratch",
    text: "scratch content"
  }));
});'

# clean up afterwards
playwright-cli -s=local run-code "await page.evaluate(() => \$tw.wiki.deleteTiddler('ZZ-test-scratch'));"
```

**Cleanup policy (standing rule):** delete the scratch tiddlers you created — and touch NOTHING else. `$:/StoryList` is the user's live list of OPEN tiddlers (their browsing session, shared by every browser window on the wiki). Never write, reset, "restore", or clear it; never close tiddlers on the user's behalf, including ones your navigation opened. An empty-looking story at session start is not a baseline — the user's own browser may have tiddlers open. Session teardown = scratch deletion only.

### Inspecting wiki state

```bash
playwright-cli -s=local run-code 'const r = await page.evaluate(() => {
  return $tw.wiki.filterTiddlers("[all[tiddlers]tag[example]limit[5]]");
});
console.log(r);'
```

### Inspecting rendered output of a tiddler

```bash
playwright-cli -s=local run-code 'const html = await page.evaluate(() => {
  const title = "ZZ-test-scratch";
  return $tw.wiki.renderText("text/html", "text/vnd.tiddlywiki",
    $tw.wiki.getTiddlerText(title),
    {variables: {currentTiddler: title}});
});
console.log(html);'
```

### Live filter testing

```bash
playwright-cli -s=local run-code 'async page => {
  return JSON.stringify(await page.evaluate(() =>
    $tw.wiki.filterTiddlers("[tag[nonexistent]else[active]]")));
}'
```

### DOM locators and real interactions

```js
// a tiddler's visible frame (newest copy last — the story river can hold several)
const frames = Array.from(document.querySelectorAll(".tc-tiddler-frame"))
  .filter(x => x.getAttribute("data-tiddler-title") === title);
const fr = frames[frames.length - 1];

// rows: pick yours by title text inside the frame
const rows = Array.from(fr.querySelectorAll(".tc-tiddler-frame *"))
  .filter(r => (r.textContent || "").indexOf("ZZ-test-scratch") !== -1);

// typing into an edit-text input needs the native setter or TW sees nothing
const setVal = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
setVal.call(input, "new value");
input.dispatchEvent(new Event("input", {bubbles: true}));
```

Navigate by dispatching `tm-navigate` on the NAVIGATOR widget — a rootWidget dispatch never reaches it (the handler lives on NavigatorWidget and services the event on its bubble-up path; walk the widget tree for `parseTreeNode.tag === "$navigator"` and dispatch there). Reveal/picker refreshes are synchronous, but give the page ~500–800 ms after clicks before asserting.

## Step 4: deployed wikis

Only use a deployed server for final verification:

```bash
# persistent profile avoids re-authentication across sessions
playwright-cli -s=deployed open https://<wiki-host>/ --headed --profile=/tmp/playwright-wiki
```

If the page lands on a login screen, ask the user to authenticate in the visible browser window, then wait and re-check.

If a plugin tiddler has been corrupted and single-file HTML snapshots of the wiki exist, the original can be extracted from a snapshot's tiddler store:

```bash
python3 -c "
import re, json
with open('snapshot.html') as f:
    html = f.read()
m = re.search(r'<script class=\"tiddlywiki-tiddler-store\"[^>]*>(.*?)</script>', html, re.DOTALL)
data = json.loads(m.group(1))
for td in data:
    if td.get('title') == '\$:/plugins/Foo/ui/some-tiddler':
        print(td['text'])
"
```

## Playwright troubleshooting

### Session management

```bash
playwright-cli -s=local open http://localhost:8080/ --headed   # reopen if lost
playwright-cli list                                             # list sessions
playwright-cli -s=local close                                   # close session
```

### Modal and dialog interference

When a modal or draft dialog is open, most commands (click, eval, run-code) fail:

```bash
playwright-cli -s=local press Escape    # close modal
playwright-cli -s=local dialog-accept   # dismiss "discard changes?" (stacks — repeat as needed)
```

Draft dialogs accumulate during testing; if many stack up, accept in a loop or reload.

### Locator conflicts

When multiple elements match, use role locators or scope to the container:

```bash
playwright-cli -s=local click "getByRole('button', { name: 'example', exact: true })"
playwright-cli -s=local click ".tc-modal-body select:first-of-type"
```

### Complex tests

For multi-step tests use `--filename` with a `.js` file containing a single `async page => { ... }` (avoids shell escaping):

```bash
playwright-cli -s=local run-code --filename=/tmp/my-test.js
```
