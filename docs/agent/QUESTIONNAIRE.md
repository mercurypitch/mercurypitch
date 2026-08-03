# Conventions questionnaire

Eight decisions the codebase does not currently make for itself. Each shows the
measured split and a recommendation. Answer inline (fill in the Answer line) or
in chat; answers get folded into [CONVENTIONS.md](CONVENTIONS.md) as settled
rules and the OPEN markers removed.

Nothing here is urgent. Unanswered questions simply stay OPEN, which is honest
and better than a guessed rule.

---

### Q1 — Export style for components — SETTLED

The tree is genuinely three-way split.

| Style | Count |
|---|---|
| `export const Foo = (props) => ...` | 78 |
| `export function Foo(props)` | 58 |
| `export default Foo` | 30 |

Default exports are concentrated in `src/features/exercises/*` (the exercise
runners, which `ExercisesPage.tsx` imports by name).

**Recommendation:** `export function Foo(props: FooProps)` for all new
components; no default exports. Named exports keep grep and auto-import
honest, and `function` matches the hoisting the rest of the codebase relies on.
Leave existing files alone — this is a rule for new code, not a migration.

**Answer:** `export function Foo(props: FooProps)`, no default exports. Applies
to new code only; existing files are not migrated. **Settled 2026-07-28.**

---

### Q2 — Test placement — SETTLED

| Location | Count |
|---|---|
| `src/tests/` | 197 |
| Colocated `<module>.test.ts` | 38 (mostly `src/lib/`) |
| `src/e2e/` (Playwright) | 34 |

**Recommendation:** colocate unit tests next to the module under test; keep
`src/tests/` for cross-module and integration tests; `src/e2e/` unchanged.
Colocated tests get moved and deleted along with their subject, which the
refactor in [REFACTOR-PLAN.md](REFACTOR-PLAN.md) will exercise heavily.

Alternative: keep everything in `src/tests/` and migrate the 38 colocated ones.
Either is defensible — the cost is having no rule.

**Answer:** Colocate new unit tests beside their module; `src/tests/` keeps
cross-module and integration tests; `src/e2e/` unchanged. The 197 existing
files stay put. **Settled 2026-07-28.**

---

### Q3 — `src/components/` vs `src/features/` — SETTLED

`src/components/` holds 325 files / 74k LOC, including the largest files in the
repo. `src/features/` holds 192 files / 46k LOC and contains all the newer
work. There is no stated rule about which gets new code.

**Recommendation:** state it as policy — new user-facing surfaces go in
`src/features/<name>/`; `src/components/` is for genuinely cross-feature,
reusable UI only (`ConfirmDialog`, `Skeleton`, `icons`). Not a migration
mandate; a direction so the split stops being accidental.

**Answer:** Stated as direction — new user-facing surfaces go in
`src/features/<name>/`; `src/components/` is for cross-feature reusable UI
only. Not a migration mandate. **Settled 2026-07-28.**

---

### Q4 — File size ceiling

25 files exceed 1,200 LOC; the largest is 6,268. No limit is stated anywhere.

**Recommendation:** a soft ceiling of 1,500 LOC, warned on in review rather
than enforced by lint, with `piano-roll.ts` explicitly exempt. A hard lint
error would block legitimate work and generate artificial splits.

Options: (a) soft 1,500 as above, (b) hard lint error at some threshold,
(c) no rule, rely on [REFACTOR-PLAN.md](REFACTOR-PLAN.md).

**Answer:**

---

### Q5 — Global CSS growth

`src/styles/` is 10 files, several very large: `uvr.css` 88 KB,
`vocal-analysis.css` 79 KB, `guitar-practice.css` 38 KB, `exercises.css` 38 KB,
`app.css` 63 KB. Meanwhile 120 `.module.css` files sit beside their components.

The large ones are feature-specific despite being global, which is why they
grew — and they are unreadable to agents (grep-only).

**Recommendation:** freeze them. New styling for a feature goes in a
`.module.css` beside the component, or a feature-local `.css`. Split the
existing five opportunistically as part of the refactor slices that touch them,
not as its own project.

**Answer:**

---

### Q6 — Should CI enforce module header comments? — SETTLED

`scripts/gen-agent-index.mjs` harvests each module's header into the index. All
37 previously-undocumented modules now have one. Without enforcement this will
decay.

**Recommendation:** enforce the *index freshness* check in CI (paths and
structure), but only warn on missing headers. A hard failure on a missing
comment invites one-line filler headers, which are worse than none — they
produce a confident-looking blurb that says nothing.

Options: (a) warn only, (b) fail CI on any module with no header, (c) fail only
for `src/features/` and `src/stores/`.

**Answer:** (a) No CI gate. A gentle written convention instead, in
[CONVENTIONS.md](CONVENTIONS.md) §7: new module in `features`/`lib`/`stores`/
`workers` gets a header; a substantial rework re-checks it. The
`_(no header comment)_` entries in the index are the worklist.
**Settled 2026-07-28.**

---

### Q7 — Where should specs live? — SETTLED

Three prose-spec locations exist today: `docs/specs/*.ears.md` (12),
`tests/ears/*.md` (13), and `docs/plans/`.

**Recommendation:** `docs/specs/` for EARS behavioural specs, `docs/plans/` for
forward-looking plans, and retire `tests/ears/` by moving its contents into
`docs/specs/` — it is not run by any test runner, so its location under
`tests/` is misleading.

**Answer:** Done. All 12 `tests/ears/` specs converted to EARS and moved to
`docs/specs/*.ears.md`; `tests/` removed (Playwright reads `src/e2e`).
`docs/specs/` now holds 25 specs under one naming convention.
**Settled 2026-07-28.**

---

### Q8 — Move to real D1 migrations? — SETTLED

As of 2026-07-28, schema changes were ad-hoc `scripts/migrate-*.sql` files
applied by hand with `wrangler d1 execute`, plus a parallel edit to
`workers/db-worker/schema.sql`. There was no ordering, no record of what had
been applied where, and nothing stopped the two drifting apart. Six such files
existed.

**Recommendation:** adopt `wrangler d1 migrations` — a numbered
`workers/db-worker/migrations/` directory with `migrations_dir` set in
`wrangler.jsonc`, applied by `wrangler d1 migrations apply` on deploy. Wrangler
then tracks applied state per environment. Keep `schema.sql` only as a
generated snapshot, or drop it.

Cost: one migration to bootstrap existing tables, plus a deploy-workflow change.

**Answer:** Adopted. The 2026-07 integration train (#374) landed
`workers/db-worker/migrations/0001_baseline.sql` onward, applied by
`wrangler d1 migrations apply` from `deploy-db.yml`; `migrations_dir` is set on
every `d1_databases` block. `schema.sql` is gone and the legacy scripts survive
only as the pre-adoption record
([README](../../scripts/README-legacy-migrations.md)). **Settled 2026-08-01.**

---

## Beyond conventions

Two things worth deciding separately, since they change tooling rather than style:

- **Wire `gen-agent-index.mjs --check` into CI?** Done — `check:ci` (formerly `check:syntax`, kept as an alias) now
  runs `docs:index:check`, so a stale index fails CI.
- **Port this setup to your other repos?** The portable version is installed at
  `~/.claude/skills/repo-index/`. Invoke `/repo-index` in any project.
