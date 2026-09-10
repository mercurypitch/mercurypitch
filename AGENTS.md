# Agent instructions — MercuryPitch

Canonical agent context. `CLAUDE.md` points here; keep the content in this file
so the two cannot drift.

**Before exploring the codebase, read [docs/agent/INDEX.md](docs/agent/INDEX.md).**
It is a generated module map with entry points for every feature, store and
worker — cheaper than grepping, and it will not be stale (CI checks it).

| Document                                                   | Read it when                                                                  |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [docs/agent/INDEX.md](docs/agent/INDEX.md)                 | Orienting, or looking for where something lives                               |
| [docs/agent/CONVENTIONS.md](docs/agent/CONVENTIONS.md)     | Writing code — naming, state, styling, tests                                  |
| [docs/agent/MISTAKES.md](docs/agent/MISTAKES.md)           | Before a first change in an unfamiliar area                                   |
| [docs/agent/REFACTOR-PLAN.md](docs/agent/REFACTOR-PLAN.md) | Touching one of the oversized files                                           |
| [docs/agent/CODE-HEALTH.md](docs/agent/CODE-HEALTH.md)     | Deciding what to work on — measured state, hotspots, ranked problems          |
| [docs/agent/TESTING.md](docs/agent/TESTING.md)             | Writing or reviewing a test                                                   |
| [docs/agent/METRICS.md](docs/agent/METRICS.md)             | Reading a metric, or tempted to add a quality gate                            |
| [docs/agent/BUGS.md](docs/agent/BUGS.md)                   | Looking for known defects before reporting a new one                          |
| [docs/specs/](docs/specs/)                                 | Changing behaviour that has an EARS spec — 32 files, `*.ears.md`              |
| [docs/agent/DOCS-AUDIT.md](docs/agent/DOCS-AUDIT.md)       | Before trusting anything in `docs/plans/` — many "pending" plans have shipped |

Repeatable procedures live in [.agents/skills/](.agents/skills/) — one directory
per skill, each a `SKILL.md` whose front matter says when to use it. Codex loads
them for this repo automatically; any other agent can read them as documentation.
Today: releasing to prod (`prod-upd`), walking the guided tours (`tour-check`),
auditing the exercise UI on a phone (`mobile-ui-check`), and a summary of these
rules (`memory`).

---

## Guardrails

1. **Never test against production.** Local or dev only (`api-dev`, localhost
   workers). Prod deploys go through `/prod-upd`.
2. **Never push to `main`.** Feature branches prefixed `feat/` (never
   `claude/`), PRs target `main`.

   **Update a branch by rebasing onto `main`. Never merge `main` into it.** A
   merge commit on a feature branch buries the change among someone else's and
   leaves a reviewer diffing two histories instead of reading one. Rebasing
   rewrites your own commits, so the push that follows needs a force, and
   **`--force-with-lease` is the expected way** — the lease is what refuses to
   overwrite commits that landed while you were rebasing. Plain `--force` is
   not allowed, and neither is rewriting a branch you do not own.

   ```bash
   git fetch origin main && git rebase origin/main
   git push --force-with-lease origin <your-branch>
   ```

   Read this rule here, not from the summary in CLAUDE.md. That summary said
   only "never force-push" for a while, and agents acting on it merged `main`
   into their branches instead of rebasing — the exact thing this forbids.

3. **Do not commit, push, or open a PR unless asked.** Write the code, report
   what changed, stop. The user tests first and says when to commit.
4. **Never merge a PR** without an explicit go-ahead in the current
   conversation. Report CI green and stop.
5. **No Claude attribution anywhere** — no `Co-Authored-By`, no "Generated
   with", in commits, PR bodies, or any other artifact. The user is the sole
   author. Verify `git log --format='%an|%ae'` before merging; cloud sessions
   have authored as Claude before.
6. **No emojis** in code, UI, logs, commits, or PR text. Use an SVG icon
   component from `src/components/icons`.
7. **Keep local gates proportional.** Run focused tests while developing. Once
   per work item, immediately before its first PR push, run `pnpm pr:prepare`
   and the one relevant typecheck from the table below. A work item may contain
   several commits. After the PR exists, CI is the authoritative code, test,
   and build gate; fix a failure with its targeted command instead of
   rerunning every local check.

Use `gh` for issues and PRs, not WebFetch. Each task gets its own PR targeting
`mercurypitch/mercurypitch:main`; leave reviewer assignment to the owner.

### Squash or rebase, when merging

**Never merge without an explicit go-ahead** (guardrail 4) — the strategy
question only arises once the owner has approved the merge.

Then look at what the branch's commits actually are:

- **`--squash`** when they are one piece of work and its iterations: polish on
  polish, review fixes, a typo, a CI green-up, four passes at the same
  component. Nobody will ever want those separately, and `main` reads better
  with one honest commit than with twelve saying "fix the fix".
- **`--rebase`** when they are genuinely distinct — separate features, or
  unrelated bugfixes that happened to travel together. Squashing those buries
  changes a future reader would want to find, revert, or bisect on their own.

The test is not the number of commits, it is whether any of them would be
worth reading alone a year from now. When both apply — real features plus a
tail of polish — say so and ask, rather than flattening the features to be rid
of the noise.

## Build and verify

```bash
pnpm pr:prepare      # once before the first PR push: generated index + changed-file fixes
pnpm typecheck       # root application typecheck; select a different command below when appropriate
pnpm pr:validate     # non-mutating changed-file gate used by CI
pnpm check:ci        # full non-mutating gate; CI is authoritative
pnpm check           # optional full-tree local fix pass, not a routine per-commit gate
pnpm test:run       # vitest (whole repo)
pnpm test:db        # vitest, DB Worker only
pnpm test:jam       # vitest, Jam Worker only
pnpm test:e2e       # playwright
```

### Code health

```bash
pnpm metrics         # measured state: size, layering, cycles, complexity, hotspots, test shape
pnpm metrics:check   # ratchet — fails if any tracked number got worse
pnpm metrics:update  # re-freeze the baseline; say why in the commit message
pnpm arch            # layer-boundary violations and import cycles, by rule
```

`pnpm metrics:check` is a **ratchet, not a threshold**: it compares against
`docs/agent/code-metrics.baseline.json` and only complains about regressions.
Absolute gates on a codebase this size either never fire or are red forever, and
both teach people to ignore them — see [METRICS.md](docs/agent/METRICS.md).

The churn-based hotspot section needs real history. A shallow clone (which is
what cloud sessions get) makes it report `skipped`; run `git fetch --unshallow`
first if you want it.

`pnpm pr:prepare` always regenerates `docs/agent/INDEX.md`, formats and lints
only files changed from `origin/main`, and runs `git diff --check`. It does not
typecheck or run tests. Use `--base <ref>` only when the PR targets something
other than `main`.

### Which local check for which change

| Change touches                               | Required check                                                        |
| -------------------------------------------- | --------------------------------------------------------------------- |
| Root app (`src/`, root config)               | `pnpm typecheck` once before the first PR push                        |
| Beside Cue app or shared mobile packages     | `pnpm beside-cue:typecheck` once before the first PR push             |
| DB Worker                                    | `pnpm typecheck:db` once before the first PR push                     |
| Jam Worker                                   | `pnpm typecheck:jam` once before the first PR push                    |
| Tour steps or tour-targeted DOM              | Verify the affected `targetSelector`s resolve — **not** the full walk |
| Exercise chrome, mobile layout               | `pnpm audit:mobile`                                                   |
| Pointer-driven controls (drag, scrub, swipe) | A real-mouse Playwright spec, red→green, tagged `@smoke`              |
| Release                                      | `/prod-upd`, which includes the full `pnpm test:tours` walk           |

For a cross-workspace change, run each affected typecheck once. Keep tests
focused on the changed behaviour during development. Open draft PRs early and
let cloud CI run the complete affected-code format, lint, typecheck, test, and
build matrix. A later docs-only or CI-fix commit does not trigger another full
local pass.

`pnpm test:tours` takes 20+ minutes. It is a **release gate, not a per-change
gate** — do not run it per PR, even when editing tour steps. Only _new_ misses
introduced by your change are blockers outside a release.

Tours should cover ≥80% of a page's user-visible features. Adding a feature to
a page that has a tour means updating that tour in the same PR.

## Stack

SolidJS + TypeScript, Vite, Web Audio API, Dexie/IndexedDB, Cloudflare Workers +
D1. Conventions in [docs/agent/CONVENTIONS.md](docs/agent/CONVENTIONS.md); the
two rules that bite hardest are **never destructure props** and **read signals
synchronously before going async**.

## Keeping the docs honest

```bash
node scripts/gen-agent-index.mjs        # after adding/moving/renaming modules
node scripts/gen-agent-index.mjs --check # CI: fails if stale
```

New modules need a banner header comment — the index harvests its first
sentence. See [CONVENTIONS.md](docs/agent/CONVENTIONS.md) §7.

When you hit something that cost real time and would cost the next agent the
same, append it to [docs/agent/MISTAKES.md](docs/agent/MISTAKES.md) using the
template at the top of that file. That is the intended way to leave insight
behind — not a comment in a PR, and not a new document.
