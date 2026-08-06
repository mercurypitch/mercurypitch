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
| [docs/specs/](docs/specs/)                                 | Changing behaviour that has an EARS spec — 32 files, `*.ears.md`              |
| [docs/agent/DOCS-AUDIT.md](docs/agent/DOCS-AUDIT.md)       | Before trusting anything in `docs/plans/` — many "pending" plans have shipped |

---

## Guardrails

1. **Never test against production.** Local or dev only (`api-dev`, localhost
   workers). Prod deploys go through `/prod-upd`.
2. **Never push to `main`; never force-push.** Feature branches prefixed
   `feat/` (never `claude/`), PRs target `main`. `--force-with-lease` is fine
   for rebases; plain `--force` is not.
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

Use `gh` for issues and PRs, not WebFetch. Merge with `--rebase`, never squash,
unless told otherwise. Each task gets its own PR targeting
`mercurypitch/mercurypitch:main`; leave reviewer assignment to the owner.

## Build and verify

```bash
pnpm pr:prepare      # once before the first PR push: generated index + changed-file fixes
pnpm typecheck       # root application typecheck; select a different command below when appropriate
pnpm pr:validate     # non-mutating changed-file gate used by CI
pnpm check:ci        # full non-mutating gate; CI is authoritative
pnpm check           # optional full-tree local fix pass, not a routine per-commit gate
pnpm test:run       # vitest
pnpm test:e2e       # playwright
```

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
