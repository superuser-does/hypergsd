// Parse-level audit: every wikitext tiddler shipped by the HyperGSD plugins must be
// free of stray widget markup as literal text. An unbalanced closer (e.g. a leftover
// </$let> after flattening nested lets) parses as a plain text node inside otherwise
// working wikitext, so functional click tests still pass — the 2026-09-11 alert leak.
// Top-level parseText does NOT look inside \procedure/\widget bodies, so each block
// is parsed separately; the detector self-test guards against a vacuous check.
const $tw = require("/home/yan/tiddlywiki/tw5source/boot/boot.js").TiddlyWiki();
$tw.boot.suppressBoot = true;
$tw.boot.argv = [__dirname + "/fixture-wiki"];
$tw.boot.startup();
const wiki = $tw.wiki;

let pass = 0, fail = 0;
const t = (name, ok, detail) => {
  if (Array.isArray(ok)) ok = JSON.stringify(ok) === JSON.stringify(detail);   // arrays are truthy — deep-compare instead (the tickler-test lesson)
  console.log((ok ? "PASS " : "FAIL ") + name + (ok || !detail ? "" : " — " + detail));
  ok ? pass++ : fail++;
};

const strayInTree = (nodes, found, context) => {
  (function f(n) {
    if(!n || typeof n !== "object") return;
    if(Array.isArray(n)) return n.forEach(f);
    if(n.type === "text") {
      const s = n.text || "";
      if(/^>/.test(s.trim()) || /<\/?\$[a-zA-Z]/.test(s)) found.push(context + ": " + JSON.stringify(s.slice(0, 60)));
    }
    if(n.children) f(n.children);
  })(nodes);
};

// a \procedure/\widget block parses to a single "set" pragma node whose body is stored
// unparsed (it is only parsed when called), so the body is extracted and parsed directly
const blockBodies = text => (text.match(/\\(?:procedure|widget)\b[\s\S]*?\\end\b/g) || [])
  .map(block => block.slice(block.indexOf(")") + 1, block.lastIndexOf("\\end")));

// self-test: the detector must flag a known-bad snippet (guards against vacuous passes),
// through BOTH shapes — raw wikitext and an extracted procedure body
const selfFound = [];
strayInTree(wiki.parseText("text/vnd.tiddlywiki", '<$list><$let a="1">x</$let></$let></$list>').tree, selfFound, "self-test raw");
strayInTree(wiki.parseText("text/vnd.tiddlywiki", blockBodies("\\procedure selftest()\n<$list><$let a=\"1\">x</$let></$let></$list>\n\\end")[0]).tree, selfFound, "self-test procedure");
t("detector flags a leftover closer (self-test)", selfFound.length === 2, selfFound.join(" | "));
const selfClean = [];
strayInTree(wiki.parseText("text/vnd.tiddlywiki", '<$list><$let a="1">x</$let></$list> plain <br> text').tree, selfClean, "self-test-clean raw");
strayInTree(wiki.parseText("text/vnd.tiddlywiki", blockBodies("\\procedure selftest()\n<$list><$let a=\"1\">x</$let></$list>\n\\end")[0]).tree, selfClean, "self-test-clean procedure");
t("detector passes a balanced snippet (self-test)", selfClean.length === 0, selfClean.join(" | "));

const audited = [];
wiki.filterTiddlers("[all[shadows]prefix[$:/plugins/yan/]]").forEach(title => {
  const tiddler = wiki.getTiddler(title);
  if(!tiddler) return;
  const type = tiddler.fields.type || "text/vnd.tiddlywiki";
  if(type !== "text/vnd.tiddlywiki") return;                        // skip js/css/multids payloads
  if(/\/language\/|readme$/.test(title)) return;                    // code samples live here legitimately
  const text = tiddler.fields.text || "";
  const found = [];
  strayInTree(wiki.parseText("text/vnd.tiddlywiki", text).tree, found, title + " (top level)");
  const bodies = blockBodies(text);
  bodies.forEach((body, i) => strayInTree(wiki.parseText("text/vnd.tiddlywiki", body).tree, found, title + " (procedure " + (i + 1) + ")"));
  audited.push(title + (bodies.length ? " [" + bodies.length + " procedure" + (bodies.length > 1 ? "s" : "") + "]" : ""));
  t("no stray widget markup: " + title, found.length === 0, found.join(" | "));
});

t("wikitext tiddlers were actually found", audited.length >= 20, "only " + audited.length + " matched the shadow filter");
console.log(audited.join("\n"));
console.log(audited.length + " wikitext tiddlers audited");
console.log(fail === 0 ? "ALL STRAY-MARKUP CASES PASS" : fail + " FAILURES");
process.exit(fail === 0 ? 0 : 1);