# Living docs: an in-repo Moxie Docs

Brainstorm and plan for keeping docs honest while agents are doing most of the
writing. Phase 0 of this plan is built and working — see `docs/DOCS_SYSTEM.md`
for the contract and `scripts/docs-sync.mjs` for the tool.

## The problem, stated precisely

We have 300+ files under `docs/`. Nothing connects any of them to the code they
describe. When an agent changes `src/features/practice-intelligence`, nothing
tells it that a page describing the EMA window exists, and nothing tells a
reviewer that the page is now wrong.

Agents make this worse in a specific way. They ship more changes per unit of
human attention, and they read docs credulously — a stale page does not just fail
to help, it actively misleads the next agent into writing code against an API
that no longer exists. Docs rot has gone from a documentation problem to a
correctness problem.

## What Moxie Docs does

[Moxie Docs](https://moxiedocs.com/) indexes a GitHub repo once, then keeps that
understanding where the work happens. Five pillars, from their own material:

1. **Generated docs** — index the repo, produce a searchable knowledge base.
2. **PR checks** — check each merged PR against the documentation it touches,
   compare generated docs to current source, regenerate impacted pages.
3. **Gap surfacing** — show what is undocumented in the workspace.
4. **MCP server** — every plan includes one, so agents query current docs,
   conventions, verified commands, and open gaps instead of guessing from
   partial file reads. Cuts token waste and wrong API assumptions.
5. **Friday Cleanup** — a weekly docs-only automation that batches stale pages,
   gaps and drift into a single reviewable PR.

The insight worth stealing is pillar 2. Everything else is packaging. "Compare
the doc against the source and tell me when they diverged" is the mechanism; the
hosted UI, the search, the generation are conveniences on top.

## Buy or build

Worth saying out loud, because building was not obviously right.

**For buying:** generation quality is real work, a hosted search UI is real work,
and zero maintenance has a price we would otherwise pay in attention.

**For building, which is what we did:**

- Our docs already live in the repo and are already read by agents from disk. A
  hosted workspace would be a second home for them, and two homes means drift
  between the homes on top of drift against the code.
- The drift signal has to be tuned to our noise tolerance or the team learns to
  ignore it. That tuning is the product, and we cannot tune someone else's.
- We can gate CI on it and hook it into `.claude/skills/`, which a third-party
  service cannot do without repo write access.
- It came out at roughly 700 lines with no runtime dependencies.

Not a permanent decision. If generation quality turns out to be the bottleneck,
the anchor contract survives a switch — it is just front matter.

## The core design bet: two fingerprints

Naive drift detection hashes the file and flags any change. Within two weeks
everyone ignores it, because most changes to a file do not change what a doc
about that file says.

So every doc carries two hashes:

- **content** — sha256 over the raw source bytes.
- **api** — sha256 over the exported surface only, pulled from the TypeScript
  AST: signatures, interface members, type aliases, class members, re-exports,
  and the values of exported literal constants.

Content changed but API identical is `MINOR` — someone refactored an
implementation, the page is probably still true, glance at it. API changed is
`MAJOR` — the contract the page describes moved, the page is probably wrong.
Only `MAJOR` and `BROKEN` (declared sources matching nothing) block CI.

The bet is that this keeps the loud signal rare enough to stay credible. If
`MAJOR` starts firing on changes that do not actually invalidate prose, the
extraction is too coarse and needs narrowing — not the threshold raising.

Including exported constant *values* in the API hash was the other deliberate
call. Docs quote thresholds; retuning `NOISE_FLOOR` from 0.01 to 0.02 is exactly
the edit that silently makes a page lie, and it is invisible to signature-only
extraction.

### What this deliberately does not catch

- Private module constants. `practice-intelligence` quotes several, and the doc
  says so in its Gotchas. Fingerprinting private state would mean flagging every
  internal edit, which is the noise problem again.
- Behaviour changes inside a function body with an unchanged signature. Nothing
  short of tests catches these, and tests are the right tool.
- Prose that was wrong the day it was written. The anchor proves a page was
  reviewed against a specific commit, not that the review was good.

## What exists now (phase 0, built)

- Anchor contract in doc front matter: `sources`, `related`, `doc_id`, `area`,
  and a tool-written `anchor` block with both hashes, a `reviewed` date and the
  commit it was verified against.
- `scripts/docs-sync.mjs` with `status`, `check`, `plan`, `anchor`, `gaps`,
  `context`. No dependencies; degrades to regex extraction without TypeScript.
- Symbol-level work orders. `plan` names the exact signatures added and removed,
  so the fix starts from evidence rather than a diff hunt.
- `docs/agents/context.json` — the local stand-in for Moxie's MCP payload: doc
  index, areas, verified commands, convention pointers, current drift list.
  Byte-stable so CI can regenerate and diff it.
- `docs/agents/docs-sync.lock.json` — per-file hashes and symbols from the last
  anchor. This is what makes the symbol diff possible.
- CI job on pull requests, scoped with `--since origin/<base>` so a PR is judged
  only on drift it caused, and advisory (`continue-on-error`) while coverage is
  low.
- `/docs-sync` skill so an agent runs the loop the same way every time.
- Three seeded docs written against real code: `mic-feedback`, `tour-offers`,
  `practice-intelligence`. Coverage today is 3 of 63 units.

## Roadmap

Ordered by value per unit of effort. The first three are the ones that matter.

### Next: adoption, not features

The tool works. What it lacks is coverage — a drift checker over 5% of the
codebase is a rounding error on real risk.

1. **Anchor the ten highest-traffic units.** From `pnpm docs:gaps`, weighted by
   commit frequency rather than file count: `stem-mixer`, `exercises`,
   `karaoke-night`, `app-store`, `mic-store`, `settings-store`. Roughly one doc
   per session, written by an agent against the code and reviewed by a human.
2. **Flip CI to blocking** once coverage passes about a third of units. Until
   then advisory, because a red job people are told to ignore trains them to
   ignore red jobs.
3. **Post work orders as a PR comment** instead of only a step summary, so drift
   is visible where review happens.

### Then: close the agent loop

4. **Weekly batched cleanup** — our Friday Cleanup. A scheduled agent run does
   `docs:plan`, fixes what it can verify, and opens one docs-only PR. The
   constraint that makes it safe: it may only touch pages whose drift is
   `MINOR`, or `MAJOR` where every changed symbol is inside its declared sources.
   Anything needing judgment stays on the list for a human.
5. **Scaffold from the AST.** `docs:new <unit>` emits front matter with sources
   pre-filled and a skeleton listing exported symbols, so writing a page starts
   from structure. Generate the skeleton, never the prose — generated prose about
   your own code is restated signatures, and it is worse than nothing because it
   reads like coverage.
6. **Pre-push hook** running `docs:check --since main`, matching the existing
   `.githooks/pre-commit` pattern.

### Then: retrieval

7. **A real MCP server** over `context.json` plus the doc bodies, so Cursor,
   Zed and Copilot get the same context Claude Code gets from disk. Small job
   once the manifest exists — the manifest was the hard part.
8. **Reverse lookup.** "Which docs describe this file?" is the query an agent
   actually has when it opens a file, and the lock file already holds the index.

### Later: quality, not just freshness

9. **Verified snippets.** Fenced code blocks in docs get typechecked against the
   real project. Catches the most damaging kind of stale doc — the copy-pasteable
   example that no longer compiles.
10. **Link and selector checking.** `tour-offers` guards on a `data-tour`
    selector; if that selector is renamed the guard inverts silently. The same
    check `/tour-check` does for tours applies to selectors quoted in docs.
11. **Staleness half-life.** A page anchored 9 months ago against a unit with 200
    commits since is suspect even at `ok`. Rank by anchor age weighted by churn
    and surface the worst offenders.

## Metrics

Watch these four. The first two go up, the second two go down.

- Anchored units as a share of configured units (today: 3/63).
- Share of PRs touching a documented unit that also updated its doc.
- Median days between a `MAJOR` first appearing and being resolved.
- `MINOR`-to-`MAJOR` ratio. If `MAJOR` is common, extraction is too coarse and
  the signal is going stale.

## Failure modes

**Anchoring without reading.** The one action that turns this into decoration.
`pnpm docs:anchor --all` after a big refactor makes everything green and nothing
true. The mitigation is social, not technical: the anchor records the commit it
was verified against, so "you anchored 12 docs in one commit" is visible in
review. Worth considering whether `--all` should require a flag that reads like
an admission.

**Coverage theater.** Scaffolding empty pages moves the gaps number without
moving the risk. Both `docs/DOCS_SYSTEM.md` and the skill say not to; the metric
that resists it is the third one above, since a page nobody maintains never
shows up in resolution time.

**Noise fatigue.** Covered by the two-hash split, but it needs watching as
coverage grows. The failure looks like drift sitting unresolved for weeks.

## Open questions

1. **Doc granularity.** Currently one page per feature directory. Feature
   directories vary from 3 files to 49 — `stem-mixer` at 8,500 lines across 17
   files probably wants several pages (audio, canvas, lyrics, mic) rather than
   one. Split by controller, or by user-facing concern?
2. **Where anchored docs live.** `docs/features/` mirrors `src/features/`, which
   is easy to navigate but means two trees to keep aligned. The alternative is
   co-located `README.md` files inside each feature directory, which never get
   out of step with a rename. Co-location is probably right and is a cheap
   change now, expensive later.
3. **Should `related:` be checked at all?** It is currently informational.
   A weaker "related sources changed a lot" signal might be useful, or might be
   exactly the noise the design avoids.
4. **Blocking threshold.** Is a third of units the right point to flip CI, or
   should it be per-area — block on areas that are fully covered, advise
   elsewhere?
