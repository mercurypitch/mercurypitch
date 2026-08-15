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

## Why there is no maintenance window

The clamp ships before the backfill, so a write landing mid-migration is
already subject to the invariant and cannot re-introduce a violation. There is
nothing for a window to protect. Ordering is doing the work a window would.

## Release order

Both steps are per-environment. Dev first, in full, including the checks.

1. **Deploy the Worker** — this is what carries `clampStreakHighWater` and the
   streak-column validation. From this moment no client, old bundle or new,
   can write a violating profile.
2. **Apply the migration** — `0030_streak_high_water.sql`, which repairs the
   stored rows.
3. **Deploy the app** — the client-side normalisation. Deliberately last: it
   is the only part that is purely cosmetic, because steps 1 and 2 have
   already made the stored data right.

```sh
# 1
pnpm deploy:db:dev
# 2
cd workers/db-worker
pnpm exec wrangler d1 migrations apply mercurypitch-db-dev --env dev --remote
# 3
pnpm deploy:dev
```

Steps 1 and 2 must not be reordered. Step 3 may lag by any amount. For
production, the same three with `:prod` / `mercurypitch-db --env prod` — and
production deploys on a `v*` tag, so step 3 is the tag.

## Verification

Run against dev after step 2, and again after real practice on a real device.

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
