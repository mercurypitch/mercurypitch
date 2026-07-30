---
name: docs-sync
description: Check whether docs still match the code they describe, update the drifted ones, and re-anchor them. Use after changing code under a documented area, when asked to "check the docs", "update the docs", "fix docs drift", or before a release. Also use to add a new anchored doc for an undocumented area.
---

# docs-sync

Anchored docs declare which source files they describe and carry a fingerprint of
those files. This skill runs the loop that keeps the two in step. The contract is
documented in `docs/DOCS_SYSTEM.md`; read it before changing the front-matter
schema or the tool.

## Read this first

`docs/agents/context.json` is the manifest: every tracked doc, its area, its
sources, the verified commands for this repo, and the current drift list. Read it
before searching the docs tree by hand.

## Checking

```bash
pnpm docs:status                   # full status table
pnpm docs:check --since main       # only what this branch changed
pnpm docs:plan --since main        # work orders, symbol by symbol
```

`MAJOR` and `BROKEN` block CI. `MINOR` means implementation-only change and
usually needs no edit.

## Fixing drift

Work one doc at a time, in the order `pnpm docs:plan` gives them.

1. Read the work order. It names the changed files and the exact symbols added or
   removed from the exported surface.
2. Read those files. Do not update prose from the symbol diff alone — the diff
   tells you where to look, not what is now true.
3. Rewrite the affected sections. Keep the page's existing shape; do not
   restructure a doc just because one section moved.
4. Re-anchor: `pnpm docs:anchor docs/features/<name>.md`

Anchoring is a claim that you read the page against the code. Never anchor a doc
you did not verify — that is the one action that turns this system into
decoration. If a page is too far gone to verify in the current task, leave it
drifted and say so.

If the state is `BROKEN`, the declared sources match nothing: the code moved or
was deleted. Update `sources:` to the new paths, or retire the doc if the feature
is gone.

## Adding a doc

```bash
pnpm docs:gaps    # ranks units by how little of them is documented
```

Pick a unit, read its code, then create `docs/features/<name>.md` with front
matter (see `docs/DOCS_SYSTEM.md` for the fields), leaving `anchor:` empty. Run
`pnpm docs:anchor <path>` when the prose is written.

What makes these pages worth having:

- Say what the module decides, not what each function is named. The signatures
  are already in the code.
- Quote the real constants and thresholds. Those are what readers come for.
- Keep a Gotchas section for the non-obvious: invariants, ordering constraints,
  things that will silently break. This is the part that saves someone an hour.
- Note anything the fingerprint cannot see — private constants a page quotes, DOM
  selectors used as guards — so a future reader knows it is not machine-checked.

Do not scaffold empty pages to improve the gaps number. An honest gap beats a
doc that claims coverage the team does not have.

## After any change here

Run `pnpm check` (required for any code change in this repo), and
`pnpm docs:context` if you edited front matter by hand — the manifest and lock
file are generated and must stay in step.
