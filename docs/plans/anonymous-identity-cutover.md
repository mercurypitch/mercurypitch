# Anonymous identity: grandfather or hard cutover?

**Date**: 2026-08-15 · **Status**: decision pending · **Blocks**: nothing (the
PR ships either way; this decides which clause it ships with)

Migration `0029_device_secret.sql` stops the published user id from being the
anonymous credential. Existing anonymous rows have no secret and nothing can
back-fill one, because the secret only ever existed on a client. So there are
two ways to land it, and this document is the evidence for choosing.

Everything below was measured against the real worker with the real migrations
applied to an in-memory SQLite, not reasoned about. §7 says how to re-run it.

---

## 1. The question

> "The users will not lose any client side data, they will just be repositioned
> to have a new ID, rather than using the old ID they had for leaderboard etc.
> So we can just fill their new identities and no grandfathering?"

**Half true, and the other half is a blocker.** Most client-side data does
survive. But an anonymous singer's practice history, streak, profile and
friendships are server-side only; one piece of _local_ data is lost too,
because its localStorage key contains the user id; and the client cannot
currently recover from being refused at all.

---

## 2. What an anonymous identity actually holds

Measured by counting what a signed-in identity can reach through the API.

| Data                                                               | Where it lives                                                              | Survives a new id? |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------- | ------------------ |
| Written melodies, playlists, practice sessions                     | `localStorage`, one blob (`melody-store.ts:120`)                            | **Yes**            |
| Separated stems, original songs, lyrics, pitch analyses            | IndexedDB (`dexie-adapter.ts`)                                              | **Yes**            |
| App settings held locally                                          | `localStorage`                                                              | **Yes**            |
| **Today's daily-goal minutes, and "streak already counted today"** | `localStorage`, but **keyed by user id** (`practice-minutes.ts:19-32`)      | **No**             |
| Practice history (`sessionRecords`)                                | **Cloud only** — `CLOUD_ENTITIES` (`hybrid-adapter.ts:20`), no local mirror | **No**             |
| Current + longest streak                                           | **Cloud only** — `userProfiles.currentStreak/longestStreak`                 | **No**             |
| Display name, bio, avatar, join date                               | **Cloud only** — `userProfiles`                                             | **No**             |
| Leaderboard opt-in and standing                                    | **Cloud only** — `userProfiles.leaderboardOptIn` + derived board            | **No**             |
| Friendships (`follows`)                                            | **Cloud only**                                                              | **No**             |
| Voiceprints, song manifests, user activity, synced settings        | **Cloud only**                                                              | **No**             |
| League placement                                                   | **Cloud only** — `leagueMembership`                                         | **No**             |
| Supporter perks                                                    | Keyed by **verified email**, not user id (`perks.ts`)                       | N/A for anonymous  |

The reason it splits this way is deliberate and documented: audio never goes to
our servers, so it is local; everything rankable is server-derived so it cannot
be forged.

**One correction to the "no client-side data is lost" framing.** It is not quite
true. `practice-minutes.ts:19` keys today's accumulated practice as
`mp_practice_ms_<userId>_<date>`, and the "streak already counted today" marker
the same way. Both are local, and both become unreachable when the id changes:
the daily-goal ring resets to zero mid-day and the singer has to practise the
day's minutes again for it to count. The pruning at `:60-80` only sweeps the
current owner's prefix, so the old keys are orphaned in localStorage rather than
cleaned up.

---

## 3. What the simulation showed

One anonymous singer, six months in: 120 practice sessions, 41-day current
streak, 63-day longest, display name "Nightingale", saved settings, a
voiceprint, a song manifest, and a mutual friendship.

### Scenario A — grandfather (the PR as it stands)

```
POST /api/auth/anonymous  → 200
  user id .............. 1111…1111   (unchanged)
  display name ......... Nightingale
  current streak ....... 41       longest .......... 63
  practice sessions .... 120
  settings 1 · voiceprints 1 · manifests 1 · activity 1
  friends on board ..... 1        own row on board .. true
```

Byte-for-byte identical to the pre-migration baseline. Nothing moves.

### Scenario B — hard cutover

```
old id   → 403
fresh id → 200
  user id .............. 3333…3333   (new)
  display name ......... Singer-3333
  current streak ....... 0        longest .......... 0
  practice sessions .... 0
  settings 0 · voiceprints 0 · manifests 0 · activity 0
  friends on board ..... 0        own row on board .. false

ORPHANED — unreachable by anybody, never cleaned up:
  sessionRecords 120 · userProfiles 1 · userSettings 1
  voiceprints 1 · songManifests 1 · userActivity 1 · follows 2
```

### Scenario C — what the _friend_ sees

This one is the surprise.

```
BEFORE:  Nightingale — streak 41 — 1111…1111
AFTER:   Nightingale — streak 41 — 1111…1111      ← unchanged, forever
         the singer's new id appears: false
```

The friendship still points at the abandoned id, and that id still owns 120
`sessionRecords`, so the leaderboard keeps aggregating it. The friend keeps
seeing a **frozen ghost** of their friend at a streak that will never move
again, while the real person, now on a new id, is invisible to them.

A clean break would be better than this. This is worse than losing the friend.

**Since §5 landed, this scenario can only involve rows that already exist.** No
new friendship can name an anonymous account, so the ghost is bounded by
whatever the blast-radius query counts today — and on a database where that
count is zero, scenario C cannot happen at all.

---

## 4. The blocker: the client cannot self-heal

This is the finding that decides it. A hard cutover makes
`POST /api/auth/anonymous` answer 403. The client does **not** mint a new id:

```
  device id ............ unchanged
  mp:requiresLogin ..... 1
  network calls made ... 1   (then it stops trying, forever)
```

The path, in `src/db/services/auth-service.ts`:

1. `requireAuth()` catches the 403 and, because it is not the account-suspended
   code, reads it as "an upgraded account signed out" — `setRequiresLogin(true)`
   at line 371.
2. That writes `mp:requiresLogin=1` to **localStorage** (line 269), so it
   survives reloads.
3. Every later `requireAuth()` short-circuits at line 356 before it reaches the
   network. Verified: one request, then silence, across a simulated reload.
4. The only caller of `resetUserId()` is account deletion (line 1044). There is
   no automatic path to a fresh identity.

So a hard cutover does not reposition anyone. It leaves every existing
anonymous singer permanently signed out, syncing nothing, with the only exit
being "create an account". People on a cached old bundle would never even get a
client that could recover.

**A hard cutover requires a client change shipped first.** Roughly: on a 403
from `/api/auth/anonymous` that is neither suspended nor a real upgraded
account, call `resetUserId()` and retry once. That is small, but it is not in
this PR, and it has to reach users before the worker change does.

---

## 5. Who can actually have friends (answered, then changed)

You asked whether anonymous singers can have friends at all. What was measured
at the time, on this PR before the follow-up commit:

| Path                                          | Anonymous allowed?                              | Gate                                                           |
| --------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------- |
| `POST /api/friends/request` → `accept`        | **Yes**                                         | auth only, no account check                                    |
| Friend codes (`/api/friends/code`, `/redeem`) | **No** — 403 "Create an account to add friends" | `isRegistered()` (`friends.ts:94,181`)                         |
| The Follow button on the leaderboard          | **Yes**                                         | only gated on "not yourself" (`CommunityLeaderboard.tsx:1413`) |

A full anonymous→anonymous request/accept cycle completed and wrote both rows
as `'accepted'`. So friendships involving anonymous singers were reachable, and
always had been: `follows` carried no `requiresAccount` flag.

**Now closed.** Friends are a registered-account feature on both sides of every
row: `accountRequired` in `friends.ts` gates `code`, `redeem`, `request`,
`accept` and the requests list; `request` also refuses an anonymous _target_,
and `accept` re-checks the requester so a pending row left by an anonymous
asker cannot become a friendship. `remove` stays open on purpose — needing an
account to leave a row you needed none to enter would strand the very people
the rule protects — and rows already `'accepted'` are left standing rather than
deleted under anyone.

**What that does to this decision:** friendships drop out of the blast radius
entirely. No new row can involve an anonymous account, so a cutover cannot
orphan one; the `follows` line in §6's queries is now a count of history, not
of exposure. What is left to weigh is only §2's practice data.

### A correction to the migration comment

`0028_follow_requests.sql` originally said a reciprocal `follows` pair "can only
have come from a friend code". **That was wrong** — two independent one-way
follows produce a pair too, and the Follow button was open to everyone. The
back-fill rule is unchanged, because two independent follows are still two
yeses, but the stated reason was false and is now corrected in the migration and
in BUGS.md.

---

## 6. Measuring the blast radius

Run against **dev first**, never production, per AGENTS.md.

```bash
cd workers/db-worker
npx wrangler d1 execute mercurypitch-db --env dev --command "<SQL>"
```

**How many anonymous accounts exist at all:**

```sql
SELECT COUNT(*) AS anonymous_accounts
FROM users WHERE authProvider = 'anonymous';
```

**How many would actually lose something** — the number that decides this:

```sql
SELECT
  COUNT(*)                                              AS anonymous_total,
  SUM(CASE WHEN p.currentStreak  > 0 THEN 1 ELSE 0 END) AS with_a_live_streak,
  SUM(CASE WHEN p.longestStreak  > 0 THEN 1 ELSE 0 END) AS with_any_streak_ever,
  SUM(CASE WHEN s.runs           > 0 THEN 1 ELSE 0 END) AS with_practice_history,
  SUM(CASE WHEN p.leaderboardOptIn = 1 THEN 1 ELSE 0 END) AS opted_in_to_the_board
FROM users u
LEFT JOIN userProfiles p ON p.id = u.id
LEFT JOIN (SELECT userId, COUNT(*) runs FROM sessionRecords GROUP BY userId) s
       ON s.userId = u.id
WHERE u.authProvider = 'anonymous';
```

**How much history is at stake, and how concentrated:**

```sql
SELECT COUNT(*) AS singers, SUM(runs) AS total_runs, MAX(runs) AS biggest_loss
FROM (
  SELECT s.userId, COUNT(*) runs
  FROM sessionRecords s
  JOIN users u ON u.id = s.userId AND u.authProvider = 'anonymous'
  GROUP BY s.userId
);
```

**Friendships that would be broken (and would leave ghosts):**

```sql
SELECT COUNT(*) AS follow_rows_touching_an_anonymous_singer
FROM follows f
WHERE f.userId IN (SELECT id FROM users WHERE authProvider = 'anonymous')
   OR f.followedUserId IN (SELECT id FROM users WHERE authProvider = 'anonymous');
```

**Dormant accounts** — a cutover costs nothing for anyone who never comes back:

```sql
SELECT
  SUM(CASE WHEN lastLoginAt >= date('now','-30 days') THEN 1 ELSE 0 END) AS active_30d,
  SUM(CASE WHEN lastLoginAt <  date('now','-90 days') THEN 1 ELSE 0 END) AS dormant_90d
FROM users WHERE authProvider = 'anonymous';
```

Read it as: **`with_practice_history` and `with_a_live_streak` are the people who
would notice.** If both are near zero, the cutover's data cost is near zero —
but §4 still applies, so it still needs the client fix.

---

## 7. The options

### A. Grandfather, open-ended (what the PR does now)

Nobody loses anything; the id-alone route closes for each account the first time
it signs in after the deploy.

**Cost:** trust-on-first-use. Someone who harvested an id from the leaderboard
before the deploy can bind their own secret to it before the owner next opens
the app, and keeps the account. The window stays open indefinitely for accounts
that never return.

### B. Hard cutover

Every existing anonymous id stops working.

**Cost:** everything in §3 — history, streak, profile, friends gone; ghosts left
on friends' boards; orphaned rows forever. **Plus** the client change in §4
without which nobody can get back in at all. Not shippable as it stands.

### C. Hard cutover + cleanup + client fix

B, but the migration also deletes the orphaned anonymous rows (no ghosts, no
litter), and the client learns to mint a fresh id on a refused 403, shipped
ahead of the worker.

**Cost:** the data is destroyed rather than stranded — irreversible. Two
coordinated deploys. Users on stale bundles are stuck until they update.

### D. Grandfather with an expiry — **recommended**

Keep the current clause, but only until a deadline the migration stamps. After
it, an unbound anonymous row is refused like any other.

**Cost:** one extra column and one comparison. Nobody is stranded today, the
TOFU window closes on a schedule instead of never, no ghosts, no client change
required. If you later decide the stragglers do not matter, the deadline passing
_is_ the cutover — and by then anyone active has already bound a secret.

Sketch:

```sql
-- 0030_device_secret_deadline.sql
ALTER TABLE users ADD COLUMN deviceSecretGrandfatherUntil TEXT;
UPDATE users
SET deviceSecretGrandfatherUntil = '2026-11-15T00:00:00.000Z'  -- 90 days
WHERE authProvider = 'anonymous' AND deviceSecretHash IS NULL;
```

and in `authorizeDeviceSecret`, the NULL-hash branch additionally requires the
deadline to be absent or in the future.

---

## 8. Recommendation

**D**, unless the blast-radius queries come back at or near zero for
`with_practice_history`, in which case **C** is honest and cheap — but C is
still two deploys and still needs the client fix, so D remains the lower-risk
path to the same end state.

**What would change this:** if `with_practice_history` is 0, there is nothing to
protect and the argument collapses to "pick whichever is less code" — which is
still D, because B and C both need a client change that D does not.

---

## 9. Re-running the evidence

The simulations were scratch files, deliberately not committed — they assert
almost nothing and exist to print numbers. To rebuild them:

- **Server side.** Copy the harness from
  `workers/db-worker/node-tests/device-secret-integration.test.ts`. Seed a user
  with history via raw SQL, apply migrations with `applyMigrations(sqlite)` from
  `node-tests/sqlite-d1.ts`, then drive `worker.fetch` and count what comes back
  through `/api/<entity>/count` and `/api/leaderboard?view=friends`.
  For the cutover, bind a secret the client does not hold — that produces the
  same 403 a no-grandfather rule would.
- **Client side.** Mock `@/lib/defaults` with an `API_BASE_URL`, stub `fetch` to
  answer 403 on `/api/auth/anonymous` (note: `postAuth` reads `res.text()`, not
  `res.json()`), call `requireAuth()`, and inspect `getDeviceId()` and
  `localStorage['mp:requiresLogin']`.

The permanent regression tests for the fix itself already live in
`workers/db-worker/node-tests/device-secret-integration.test.ts` and
`node-tests/authorize-device-secret.test.ts`, including the test named
_"is trust-on-first-use, and this is who wins the race"_, which asserts option
A's cost rather than hiding it.
