---
name: my-tiddlywiki-preferences
description: How I want TiddlyWiki work done — British English, names spelled out in full, comment policy, tiddler formatting and stylesheet conventions, plans before builds. Engine mechanics live in the TiddlyWiki-mechanics skill.
---
# Language and naming

- British English everywhere — docs, UI strings, comments, commit messages.
- UI strings short and in sentence case.
- Name the mechanism, never a metaphor — "outer derivation gate", not "the bouncer".
- **No abbreviations** in variables, parameters, procedures and widget attributes — `effective-realm` not `eff`, `realm-source-tiddler` not `rt`, `base-list-titles` not `lf-titles`. Exception: well-known plugin/domain terms (e.g. `gsd`).

# Workflow

- **Plans before builds**: propose the change set, wait for the go-ahead.
- **Versioning**: releases are `X.Y.0`; the in-flight working version is `X.Y.1`. Never bump or edit version numbers yourself — versioning is entirely the user's move; the scheme here is context for reading versions, not an instruction to change them.
- **Park, don't delete**: when a shipped plugin member stops being used on a surface, untag it from the page/tag list rather than deleting the tiddler — external references by title (user overrides, visibility configs, lingo keys) keep resolving.
- **Never change tiddlers in `tiddlers/` without permission** — the folder is the user's live content, not a build artefact; ask before creating, editing or deleting anything there.
- **Never tick items off the user's own task list** — completing a GSD action (stamping `gsd_complete`/`gsd_comp_date`) is the user's move, even after they verify the work.
- **Never delete shadow tiddlers without asking first** — they may contain intentional overrides.
- **Users don't know CSS**: prefer markup-level/native mechanisms over new stylesheet rules; when the markup can do it, delete the rule.
- **Prefer wikitext syntax over its HTML equivalent** wherever both exist — `//text//` over `<i>`, `''text''` over `<b>`/`<strong>`, `~~text~~` over `<sub>`-style charades. Reach for HTML elements only when wikitext cannot express the structure (and even then, prefer a core class over custom CSS).
- Benchmarks are always welcome — run them when a performance question appears.

# Comments

- Comments describe the current state of the code only — no historical notes, bug narratives or "was fixed" stories.
- Why-only content, never a what-narration of the adjacent code.
- **One line per comment** — no wrapping at 80 columns; break a comment across lines only when the break itself means something.
- **HTML comments only** (`<!-- ... -->`) for documentation; NEVER JavaScript-style comments (`/* ... */`, `//`) inside `.tid` files.
- Place comments outside widget tags (e.g. before `<$let>` or `<$list>`) or within dedicated whitespace-trimmed blocks — never inside filter expressions or widget attribute blocks.

# Tiddler formatting

- Always leave a newline after headings (`!`, `!!`, `!!!`). Always leave a newline before the START of a list block (lines starting with `#`, `*`, `;`, or `:`), but NEVER between individual list items. For description lists, the term (`;`) and definition (`:`) are part of the same list block — no newlines between pairs.
- **Whitespace management**: `\whitespace trim` as the first pragma in UI and widget tiddlers; **DO NOT** include it in stylesheets or dictionary tiddlers.
- **No backticks**: never use backticks for string construction or interpolation — standard double quotes or variable/filter lookups.
- **Shortcut conditionals**: `<%if ... %>` and `<%endif%>`, never `<$endif%>`.
- **Explicit ends**: every `\procedure`/`\widget` ends with an explicit `\end` — a single `\` breaks global registration.
- **Indentation in code blocks is 4 spaces**: one nesting level = +4; attribute continuation lines sit at their governing tag's indent + 4 (never aligned to the first attribute). Only already-indented code — never create indents or linebreaks for style, and never re-indent triple-quoted content where whitespace is literal output. Comment interiors keep their prose alignment.
- **Filename matching**: filenames for `.tid` files match their `title:` field exactly. Standard tiddlers use the title (`My Tiddler.tid`); system/override tiddlers in `tiddlers/` replace `/` and `:` with `_` (`$__plugins_Foo_ui_bar.tid`); plugin source files' relative path matches the title suffix (`plugins/Foo/ui/bar.tid`).
- **Header separation**: exactly one blank line between the tiddler headers (title, tags) and the first pragma.
- **Pragma blocks**: all pragmas (`\whitespace trim`, `\procedure`, `\widget`) on consecutive lines — NEVER a blank line within the block (it terminates global registration).

# Stylesheets

- Prefer 2025-baseline features: nesting, custom properties for per-class colour variants, logical properties (`padding-inline`/`padding-block`/`margin-inline`/`margin-block`), `clip-path: inset(50%)` for visually-hidden rules, `:empty` for collapsing containers.
- Keep class names in the plugin's namespaces: `hgsd-*` for plugin chrome, `gsd-*` for GSD5-inherited surface.
- Plugin styles are public API for user content — audit with usage greps across both the plugin and user tiddlers before removing any rule.

# Engine knowledge lives elsewhere

Filter semantics, pragma punctuation traps, widget/refresh behaviour, fakeDOM quirks, persistence rules and version notes are in the **TiddlyWiki-mechanics** skill — load it when writing or debugging wikitext.