# Streak high-water repair — release order and verification

`userProfiles.longestStreak` was never a high-water mark. This is what ships
to make it one, in what order, and how to tell it worked.

Measured 2026-08-15, before any of it ran:

|                                   |    dev |   prod |
| --------------------------------- | -----: | -----: |
| profiles                          |    137 |    212 |
| `currentStreak > longestStreak`   |     13 |     60 |
| — anonymous / registered          | 12 / 1 | 53 / 7 |
| profiles with `currentStreak > 0` |     17 |     80 |
| profiles with `longestStreak > 0` |      4 |     20 |

Fifty-nine of the sixty production violations store `(1, 0)`; the last stores
`(2, 0)`. Nothing stores a violation bigger than that, because every code path
that _raises_ `currentStreak` already raised `longestStreak` with it — the
debt is bounded, legacy, and cannot grow.

## What actually protects the repair

Not the ordering, in the end — the idempotence.

The intuition is that the Worker clamp should be live before the backfill
runs, so nothing can undo it. `deploy-db.yml` does the opposite: it applies
migrations and _then_ deploys the Worker, so that application code never runs
against a database missing the tables it queries. That is the correct default
for every other migration and is not worth bending here.

So there is a window, and it is worth being exact about its size. The clamp
exists to stop an **old client** re-persisting a violating pair — the
pre-normalisation bundle reads a legacy row, holds `longestStreak: 0` in
memory, and writes it back on the same-day or reset branch. Old clients do not
disappear when the app deploys; a PWA-cached shell keeps running until its
owner reloads. So:

- **Before the Worker deploys** — any client can re-introduce a violation.
- **After the Worker deploys** — none can, whatever bundle they are on.
- **Between the migration and the Worker deploy** — roughly one deploy step,
  during which the rows are repaired and unprotected.

The migration is written to be re-runnable precisely so that window costs
nothing: **apply it once more after the Worker is live.** A second pass
selects nothing if nothing slipped through, and repairs it if something did.

No maintenance window, and no writes lost to one.

## Release order

Per-environment, dev first and in full, including the checks.

CI does steps 1 and 2 by itself on a merge to `main` that touches
`workers/db-worker/**` (`deploy-db.yml`), and step 3 in parallel
(`build.yml`). Step 4 is the manual part and the one that is easy to forget.

1. **Migrations apply** — `0030_streak_high_water.sql` repairs the stored rows.
2. **Worker deploys** — carries `clampStreakHighWater` and the streak-column
   validation.
3. **App deploys** — the client-side normalisation. In parallel, and it can
   lag by any amount: steps 1 and 2 already made the stored data right.
4. **Re-apply the migration**, once the Worker deploy has finished. This is
   the step that closes the window above.

```sh
cd workers/db-worker
pnpm exec wrangler d1 migrations apply mercurypitch-db-dev --env dev --remote
```

`d1 migrations apply` records applied files, so a re-run reports nothing to
do. To actually re-run the repair, execute the statement directly:

```sh
pnpm exec wrangler d1 execute mercurypitch-db-dev --env dev --remote \
  --command "UPDATE userProfiles SET longestStreak = currentStreak WHERE currentStreak > longestStreak"
```

For production it is the same shape against `mercurypitch-db --env prod`, and
production deploys on a `v*` tag rather than a merge.

## Verification

Run against dev after step 4, and again after real practice on a real device.

```sql
-- Must be 0. The invariant, stated directly.
SELECT COUNT(*) AS violations
  FROM userProfiles
 WHERE currentStreak > longestStreak;

-- Must be unchanged from the pre-migration count: the repair raises records,
-- it never lowers a run and never deletes a profile.
SELECT COUNT(*) AS profiles,
       SUM(CASE WHEN currentStreak > 0 THEN 1 ELSE 0 END) AS withStreak
  FROM userProfiles;

-- Practice history is untouched by all of this. Compare before and after.
SELECT COUNT(*) AS runs, COUNT(DISTINCT userId) AS singers
  FROM sessionRecords;

-- The rows that moved, for spot-checking against the audit export.
SELECT id, currentStreak, longestStreak
  FROM userProfiles
 WHERE longestStreak > 0
 ORDER BY longestStreak DESC
 LIMIT 20;
```

After deploying, exercise the write path itself — the migration proves the
rows were repaired, not that they stay repaired:

- Practise once on a fresh account, then again the same day. The second run
  goes through the same-day branch, which used to re-persist a violation.
- Practise, let the streak break, practise again. That is the reset branch,
  the other one that never repaired.
- Confirm the Home card's "longest" figure survives the streak breaking.

## What this deliberately does not do

Straight from the audit, and worth keeping in front of anyone tempted to make
the invariant true the cheap way:

- **Never lower `currentStreak`** to meet a wrong `longestStreak`. That
  satisfies the constraint by deleting the run instead of recording it.
- **Never delete a profile** that looks inconsistent.
- **Never treat every stored positive as a live streak.** A stored
  `currentStreak` is the last run's length, not proof anyone is running now —
  `computeStreakState` decides that from `lastPracticeDate`.

## Rollback

The migration only raises values, so there is no "undo" that restores
meaning — the pre-migration `longestStreak: 0` was not information, it was
its absence. If the Worker needs reverting, revert it; the repaired rows stay
correct and the old code reads them fine.

Take an export first anyway:

```sh
cd workers/db-worker
pnpm exec wrangler d1 export mercurypitch-db --env prod --output <path>
```
