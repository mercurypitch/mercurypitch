# Anchored docs

Docs rot because nothing connects them to the code they describe. This system
makes that connection explicit and checkable: a doc declares which source files
it covers, we fingerprint those files, and CI tells us when the fingerprint no
longer matches.

The tool is `scripts/docs-sync.mjs`. It has no dependencies beyond TypeScript
(already a devDependency, and it degrades gracefully without it).

## Tracking a doc

Add a `sources:` list to the doc's YAML front matter. That is the whole opt-in —
a doc without `sources:` is ordinary prose and is ignored.

```yaml
---
doc_id: mic-feedback
title: Mic feedback and insights
area: audio-input
status: current
sources:
  - src/features/mic-feedback/**/*.ts
  - '!**/*.test.ts'
related:
  - src/stores/mic-store.ts
anchor:
---
```

| Field | Meaning |
| --- | --- |
| `doc_id` | Stable key. Used by the lock file and the agent manifest, so renaming a file does not lose history |
| `area` | Grouping for `--area` filters and the manifest |
| `status` | Free-form, e.g. `current` or `deprecated` |
| `sources` | Globs the doc describes. `**`, `*`, `?`, `{a,b}` and `!negation` are supported. A bare directory means everything under it |
| `related` | Files worth reading that are *not* fingerprinted. Use it for large shared modules where a doc would otherwise be flagged constantly |
| `anchor` | Written by the tool. Leave it as an empty `anchor:` on a new doc |

Leave `anchor:` empty, then run `pnpm docs:anchor <path>` to stamp it.

## The two fingerprints

Each anchor stores two hashes, and the difference between them is the point of
the whole system.

- **content** — sha256 over the raw bytes of every declared source.
- **api** — sha256 over the *exported surface* only, extracted from the
  TypeScript AST: function signatures, interface members, type aliases, class
  members, re-exports, and the values of exported literal constants. Function
  bodies and private members are excluded.

That gives four states:

| State | Meaning | Blocks CI |
| --- | --- | --- |
| `ok` | Content matches. Nothing to do | no |
| `MINOR` | Implementation changed, exported surface identical. Docs are probably still true | only with `--strict` |
| `MAJOR` | The exported surface moved. The page is probably wrong now | yes |
| `BROKEN` | A declared source matches no file. The doc points at deleted or moved code | yes |
| `NEW` | Tracked but never anchored | no |

Exported constant *values* count as API on purpose. Docs quote thresholds
("warns after roughly 0.75s"), so retuning a constant is exactly the kind of edit
that silently makes a page lie. Private module constants are not exported and so
are not tracked — if a doc quotes one, say so in a Gotchas section.

## Commands

```
pnpm docs:status      # status table for every tracked doc
pnpm docs:check       # CI gate, exits 1 on MAJOR or BROKEN
pnpm docs:plan        # work orders for everything drifted
pnpm docs:anchor <doc>  # re-stamp after updating (--all for everything)
pnpm docs:gaps        # units with no doc, and tracked docs never anchored
pnpm docs:context     # regenerate the agent manifest and lock file
```

Useful flags: `--since <ref>` limits to docs whose sources changed since a ref
(this is what CI uses, so a PR is judged only on the drift it caused),
`--area <name>`, `--strict`, `--json`, `--quiet`.

## Generated files

- `docs/agents/context.json` — what an agent reads before working: the doc index,
  areas, verified commands, convention pointers, and the current drift list.
- `docs/agents/docs-sync.lock.json` — per-file hashes and extracted symbols from
  the last anchor. This is what lets `plan` say *which* symbols were added or
  removed rather than just "something changed".

Both are byte-stable — no timestamps — so CI can regenerate and diff them. Do
not edit either by hand.

## The loop

When you change code:

1. `pnpm docs:check --since main` tells you if you moved something a doc describes.
2. `pnpm docs:plan` tells you what changed, symbol by symbol.
3. Update the prose.
4. `pnpm docs:anchor <doc>` re-stamps it. The anchor's `reviewed` date and
   `commit` are your signature that the page was actually read against the code.

Anchoring without reading is the one way to defeat this system. The commit hash
in the anchor is there so that claim is auditable in review.

## Adding coverage

`pnpm docs:gaps` ranks units by how little of them is documented. Coverage units
are configured in `docs/docs-sync.config.json` (`coverage.units`), currently
`src/features/*`, `src/stores/*.ts`, `src/pages/*.tsx` and `workers/*`.

Write the doc for the unit, anchor it, and the gap closes. Do not scaffold empty
pages to move the number — an anchored doc that says nothing is worse than an
honest gap, because it claims coverage the team does not have.
