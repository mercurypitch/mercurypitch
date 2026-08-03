# Account adoption — moving a device's practice onto the account

**Date**: 2026-08-03 · **Status**: proposed, decisions locked (§8). Phase 0 is a
bug fix that must ship with v0.8; phases 1-3 are post-release.

Signing in to an account that was made on **another device** leaves the practice
done on this one attached to an identity nobody is signed in as. PR #399 shipped
a notice that says so honestly and offers a mailto so the owner can move it by
hand (`src/features/account/local-progress-notice.ts`). This plan replaces the
mailto with a button.

The scope is exactly one direction: **this device's local practice → the account
the singer just proved they own.** Nothing ever flows the other way, and two real
accounts are never merged.

---

## 1. The shape of the problem — and why it is not a "copy"

The device's anonymous identity is **a real `users` row** with
`authProvider = 'anonymous'`, keyed on the device id (`handleAnonymous`,
`workers/db-worker/src/auth.ts:844`). Every scored run already writes a
`sessionRecords` row under it, because `saveSessionRecord` is a cloud write and
`requireAuth` provisions the anonymous identity on first write.

So the practice is not orphaned data needing duplication. It is **rows owned by
user A that should be owned by user B**. Most of the job is
`UPDATE … SET userId = :target WHERE userId = :source`.

Three sign-in flows exist and only one is broken:

| Flow | What the worker does | Anything stranded? |
|---|---|---|
| Register with password (`deviceId` sent) | Upgrades the anonymous row **in place** (`auth.ts:886`) | No — same id throughout |
| Google, first time (`deviceId` sent) | Upgrades the anonymous row **in place** (`auth.ts:993`) | No |
| **Log in to an existing account** | `handleLogin` doesn't take `deviceId` at all (`auth.ts:936`); Google paths 1-2 match on `providerId`/email before ever looking at the device | **Yes — this is the whole problem** |

That is why the notice's trigger is exactly `deviceId !== accountId`.

---

## 2. What actually happens today (measured)

Sign-in does not wipe the device. It splits what the singer sees in three:

**Still visible, unaffected** — plain localStorage/Dexie, never user-scoped:
exercise history and best-score pills (`mercurypitch_exercise_history`), session
history (`pitchperfect_session_history`, explicitly excluded from sync), analysis
trends, adaptive difficulty, the melody library, UVR stem sessions, karaoke
playlists.

**Goes blank** — cloud rows owned by the anonymous id: the activity calendar and
heatmap (they read `sessionRecords` — `practice-activity.ts`), the streak (a
column on `userProfiles`), badges, achievements, challenge progress, league
standing, leaderboard rank.

**Silently overwritten** — the Ascent. See §3.

### 2.1 The notice's own numbers are slightly generous

`summarizeLocalProgress()` counts `exerciseHistory().length`,
`getSessionHistory().length` and Ascent days — all three read localStorage. The
first two **are still on screen** after sign-in. What the account lost is the
`sessionRecords` copy behind them, not the list itself.

**Done (phase 0).** The notice now says the counted practice is "still on this
device, and still on screen", and names what genuinely starts empty — the
account's own record: streak, badges, achievements, practice calendar. It no
longer says or implies the Ascent stayed behind, because after the §3 fix it
does not.

---

## 3. The one bug that must ship fixed with v0.8

`pullCloudSettings` (`src/db/services/settings-service.ts:161`) merges
`mp_path_progress` only when `mp_sync_owner` is unset or matches the signed-in
id. That guard is right for shared computers, but the owner key is claimed by
**every** successful pull — including pulls made while merely anonymous, where
`me` is the device id:

```
if (me !== '') claimMergeOwner(me)     // settings-service.ts:200
```

Any device that ever provisioned an anonymous identity therefore has
`mp_sync_owner` = device id. Signing in to a foreign account gives
`mayMerge = false`, and the non-merge path runs `applyPersistedValue(row.key,
row.value)` — which writes localStorage. So:

- Account has its own Ascent → **the device's Ascent is overwritten locally**,
  and does not come back on sign-out. The notice's promise is false for this key.
- Account has no Ascent row → local survives but is never uploaded (the backfill
  at `settings-service.ts:188` is also gated on `mayMerge`).

**No user has been hurt yet.** Verified: `src/features/path/` does not exist in
`v0.7.22` (2026-07-21), the newest release tag — prod has never had the Ascent,
so no prod device holds `mp_path_progress`. That removes the data-repair job, not
the fix: v0.8 is the release that ships the Ascent, so the bug goes live with it.

**Fix (shipped, phase 0):** claim the merge owner only for a non-anonymous
identity (`hasUpgradedAccount()`). Small, self-contained, and needed by phase 1
anyway — after an adoption the device's copy genuinely does belong to the
account, and something has to say so.

Half a fix on its own, though: every device that has already run the old claim
is still carrying `mp_sync_owner` = its own id, and that stamp would block the
merge for the rest of that device's life. So the pull also **forgets** a stamp
equal to `getDeviceId()`, and only from inside an anonymous session — the one
place the value is unambiguous. An upgraded device cannot reach that line: once
its identity became an account the server refuses it anonymous re-auth (403),
`hasValidToken()` is false after sign-out, and the pull returns early. Without
the session check the rule would be wrong in exactly the case it must not be:
an account registered in place has `accountId === deviceId`, and reading that
stamp as unset would hand the next singer their climb.

**Consequence worth knowing:** with this in, the Ascent is the one thing that
already crosses over — a climb made signed out is unioned into the account on
sign-in. The notice copy (§2.1) was changed to stop implying otherwise.

Worth noting for §8's "one direction only": the adopt endpoint is one-way by
construction, but the **settings sync is not** — `applyPersistedValue` writes
cloud values down onto the device. That is correct for preferences and is
precisely the clobber above for progress. Only `mp_path_progress` is progress
today; anything added to `MERGE_ON_PULL` later inherits this hazard.

---

## 4. What moves, and how

"Additive, never destructive, nothing double-unlocked" means something different
per table, so every one is classified. Source of truth: `USER_OWNED_TABLES`
(`auth.ts:1400`).

### Move — append-only logs, collision impossible

`sessionRecords`, `userActivity`, `voiceprints`, `leaguePointEvents`,
`userSurveyResponses`

Each row is a distinct event with its own PK. `UPDATE … SET userId = :target
WHERE userId = :source` is exactly additive. `leaguePointEvents` carries
`sourceId` for its own idempotency (migration 0006), unaffected by the move.

### Union by key — insert only what the account lacks

`userBadges` (per `badgeId`), `follows` (per pair)

```sql
INSERT INTO userBadges (id, createdAt, updatedAt, userId, badgeId, earnedAt)
SELECT lower(hex(randomblob(16))), s.createdAt, :now, :target, s.badgeId, s.earnedAt
  FROM userBadges s
 WHERE s.userId = :source
   AND NOT EXISTS (SELECT 1 FROM userBadges t
                    WHERE t.userId = :target AND t.badgeId = s.badgeId);
```

Where both sides hold the badge, keep the **earlier** `earnedAt` — they earned it
when they earned it, not when they signed in. There is deliberately no
`UNIQUE(userId, badgeId)` in the schema, so the guard lives in the statement;
adding the index is hardening (§9). `follows` already has
`idx_follows_pair UNIQUE`, so `INSERT OR IGNORE` suffices.

### Reconcile by best value — one row per (user, thing)

`challengeProgress` (per `challengeId`), `userAchievements` (per `achievementId`)

Target has no row → move it. Both have one → keep the better half of each column,
never subtract:

| Column | Rule |
|---|---|
| `bestScore`, `progress` | `MAX` |
| `attempts` | **sum** — both really happened |
| `completed` / `unlocked` | `OR` |
| `completedAt` / `unlockedAt` | earliest non-null |
| `currentScore` | the more recently updated row's value |

### Scalar reconcile — the streak

`MAX(currentStreak)` alone is wrong: a streak is only *current* if
`lastPracticeDate` is today or yesterday.

```
longestStreak     = MAX(a, b)                       -- historical fact, always safe
currentStreak     = both sides live (lastPracticeDate within 1 day) → MAX
                    otherwise → the live side's value; neither live → 0
lastPracticeDate  = MAX(a, b)
previousStreak    = MAX(a, b)
streakFreezes     = MIN(MAX(a, b), MAX_FREEZES)     -- max, never sum
lastFreezeUsedDate, lastRepairDate, streakResetDate
                  = the LATER of the two            -- never gifts a free repair
joinDate          = the EARLIER of the two          -- they started when they started
```

`REPAIR_COOLDOWN_DAYS` is 30 (`streak-service.ts`), so taking the *earlier*
repair date would hand out a free streak repair on every adoption.

`displayName`, `avatarUrl`, `bio` are never touched — the account keeps its own.

### Derived, so free

`badge-grant-engine.ts` computes badges and achievements from real stats and is
idempotent by design. Run it once after the merge as a safety net: anything the
union missed gets granted from the now-larger `sessionRecords` set. Moving the
rows first is still worth it, purely to preserve the true `earnedAt`.

### Refused, not merged — money

`creditLedger`, `entitlements`

**An anonymous identity cannot hold either.** This is structural, not policy:

- `POST /api/billing/checkout` 403s `auth.provider === 'anonymous'`
  (`billing.ts:205`), so no purchase or donation webhook can ever name one.
- The only other ledger write is the `uvr-job` debit, and it is a conditional
  insert gated on `SUM(delta) >= cost` (`billing.ts:732`) — a zero balance can
  never produce a row.
- `entitlements` are mirrored from the same webhooks.

So the adopt endpoint does not move them; it **asserts they are empty and fails
loudly if not**, because a non-empty ledger on an anonymous id means one of those
invariants broke and that is worth a 500 rather than a silent transfer.

### Removed, not re-attributed — public shares

`sharedMelodies`, `sharedSessions`

**There are two unrelated sharing systems, and only one of them is at issue.**

1. **Content links** — `src/lib/share-codec.ts`: a melody, exercise or routine
   is base64url-encoded whole into `#/share/<payload>`, optionally shortened to
   `#/s/<id>` by the KV-backed `src/share-handler.ts`. No D1 row, no user id, no
   account. Sending a friend a routine already works for everyone and is
   untouched by any of this.
2. **Community board rows** — `sharedMelodies` / `sharedSessions` in D1,
   `access: 'shared'` (`tables.ts:98-99`). These are the public feed.

Anonymous users can post to the board today: `access: 'shared'` permits writes
from any authenticated caller and `handleCreate` stamps
`body.userId = auth.userId` (`index.ts:363`). That is the spam surface — a
listed post with no account behind it and nobody to hold to it.

**Rule: posting to the board requires a real account.** Refuse the write with a
403 when `auth.provider === 'anonymous'`, in the same shape billing already uses
(`billing.ts:205`), and point the message at the two things that do work without
one: make an account, or send a content link.

**Shipped** (phase 0b) as a `requiresAccount` flag on the table definition rather
than a name check, so the rule lives with the registry and a new `shared` table
that forgets it fails a test. `blockedForAnonymous` (tables.ts) gates `create`
and `update`; **delete is deliberately not gated**, so a legacy post stays
removable by the singer who made it. Client-side, `canPostToCommunity()`
(share-service.ts) is the same rule, so the share button says what it did —
"Saved to your shelf … create an account to list it on the Community board" —
instead of swallowing a 403. The local shelf and the copied link still work,
which is the whole point of keeping the two systems separate.

A gentler alternative — silently clamping `isPublic = 0` — is worse here. A
board row nobody can read is a confusing half-state ("I shared it and nothing
happened"), because a non-public row is 404 to everyone but its owner on both
the list query (`scopeRead`, `index.ts:208`) and a fetch by id
(`index.ts:324`). Unlisted board reads are a real feature (and the primitive a
classroom mode would want — one student, one teacher), but they are not on this
path and should not gate the spam fix.

For adoption itself: in the batch, **delete** the source's board rows and list
them in the confirm manifest — "2 public posts will be taken down, re-share them
from your account". Leaving them would strand public content on a profile that
is about to be deleted. Once the 403 lands this set can only be legacy, and the
code path goes quiet on its own.

### Never moved

`userSettings` — preferences; the account's win by design. The one
progress-shaped key inside it (`mp_path_progress`) is handled client-side (§6),
where `mergePathProgress` already exists and already unions correctly.

`passwordResets`, `emailVerifications` — credentials, meaningless for an
anonymous source.

`leagueMembership` — `UNIQUE(userId, weekStart)`, and two memberships for one
week can't merge (different cohorts). Move only weeks the target has no row for;
on a collision the target's cohort stands and only the points move (those are
`leaguePointEvents`, already handled). Recompute standings after.

---

## 5. The endpoint

### 5.1 Why the device id can't be the credential

You're right that the mailto is the only place we hand it to a human — but it is
not a secret anywhere else either. `userProfiles.id` **is** the user id,
`userProfiles` is `access: 'owner'` with public reads (`tables.ts:70`), and it is
not in `USER_SCOPED_ENTITIES` (`hybrid-adapter.ts:52`). Every user id is
effectively public.

So `POST /api/auth/adopt { sourceUserId }` authenticated only as the target would
let anyone claim any anonymous identity. Not for the credits (there are none),
but for the practice history, voiceprints and survey answers — someone else's
singing, moved into a stranger's account. **The client must prove it holds the
source identity.**

### 5.2 Stash the anonymous token

The anonymous JWT sits in `mp:authToken` right up to the moment sign-in
overwrites it. Capture it first:

- `postAuth()` (`auth-service.ts:133`) — before `setAuthToken(auth.token)`, when
  the outgoing token's `provider === 'anonymous'` and its `sub` differs from
  `auth.userId`.
- `googleSignInUrl()` (`auth-service.ts:334`) — before the full-page redirect.
  The return trip lands in `consumeGoogleRedirect`, by which point the token is
  already replaced. Use `localStorage`, not `sessionStorage`: it is a
  cross-origin round trip and a mobile browser may discard the tab.

Store under `mp:adoptableToken`, send it nowhere but `/api/auth/adopt`, clear it
on success, on decline, and once its 30-day `exp` (`TOKEN_TTL_SECONDS`,
`auth.ts:103`) has passed.

### 5.3 `POST /api/auth/adopt`

```
Authorization: Bearer <target token>
{ "sourceToken": "<the stashed anonymous JWT>", "confirm": true }
```

Fail-closed rules:

1. Both tokens verify via `getAuth` / `verifyJwt` (which already checks
   `tokenVersion`, so a logged-out source is dead).
2. `source.provider === 'anonymous'`. **Never merge two real accounts.**
3. `source !== target`.
4. `users.adoptedBy` on the source is NULL — the idempotency key.
5. `creditLedger` / `entitlements` empty for the source, else 500.
6. Rate-limited through the existing `checkRateLimit` (`auth.ts:486`).

A `GET` (or `confirm: false`) returns the **manifest without applying anything**,
so the dialog lists real counts rather than guesses. Same handler, same rules,
no writes.

Response: `{ ok: true, moved: { sessions: 13, badges: 2, ascentDays: 11, … },
removed: { shares: 0 } }` — a real receipt.

### 5.4 Consuming the source: tombstone the user, delete the profile

One correction to "delete the retired source profile, yes": these are two
different rows, and they want opposite treatment.

- **`userProfiles`** — delete. It is the ghost Community author, and the streak
  it carries has already been reconciled onto the account.
- **`users`** — do **not** delete; set `adoptedBy` / `adoptedAt`. Deleting it
  would let `handleAnonymous` re-create a fresh anonymous identity under the same
  device id (`findUserById` returns null → `createUser`), which quietly undoes
  the "requires login" state.

With the tombstone, `handleAnonymous` refuses the adopted id with the existing
403 `Account requires login` shape (`auth.ts:850`), the client sets
`mp:requiresLogin`, and a signed-out device behaves exactly as it already does
after registering — inert, local data intact, no cloud identity. No device-id
rotation needed.

**This is what "signing out means no achievements" looks like**, and you're right
that it has to be in the dialog before anyone presses the button.

Migration `0012_users_adopted.sql`:

```sql
ALTER TABLE users ADD COLUMN adoptedBy TEXT;
ALTER TABLE users ADD COLUMN adoptedAt TEXT;
```

Numbered migrations live in `workers/db-worker/migrations/` and run via
`wrangler d1 migrations apply`.

### 5.5 Atomicity

One `env.DB.batch()`, the same tool `handleDeleteMe` uses (`auth.ts:1470`). Every
move/union above is expressible as SQL, so no read-modify-write round trips —
except the streak reconcile, which reads both `userProfiles` rows first, computes
in JS, and contributes a single `UPDATE`. Set `adoptedBy` last, in the same batch.

---

## 6. The client side

| Key | Action |
|---|---|
| `mp_path_progress` | `mergePathProgress(local, cloud)` — the union exists and is tested. Then push, and set `mp_sync_owner` to the account. |
| `mercurypitch_exercise_history` | Nothing. Never synced, still on screen, now backed by moved `sessionRecords`. |
| `pitchperfect_session_history` | Nothing — `EXCLUDED_KEYS`, device telemetry. |
| `mp_practice_ms_<date>`, `mp_streak_counted_<date>` | Nothing. Per-day and device-local by design (`practice-minutes.ts`); today's progress toward the 5-minute goal is genuinely this device's. |
| `mp_daily_routine*` | Nothing — today's routine, not history. |
| `mercurypitch.voiceprints.v1` | Retag via the existing `adoptDeviceVoiceprints()`. |
| `mercurypitch.localProgressNotice.v1` | Mark seen for this account. |

Then bump `authVersion` / `sessionRecordVersion` so the activity calendar, streak
card and badge grid re-read instead of showing pre-merge emptiness until reload.

Signing in on a **second** device later works unchanged: adoption is per-device,
the second device's own practice merges the same way, and the streak rules stay
correct because `longestStreak` is a MAX and `currentStreak` is gated on
`lastPracticeDate`.

---

## 7. UI — the confirm manifest

Evolve the shipped `LocalProgressNotice` rather than add a surface. It is already
mounted beside `<AuthModal />` in `App.tsx` — deliberately outside it, because
Google sign-in is a full-page redirect — which is where an adopt offer has to
live too. Reuse `ConfirmDialog` + `useFocusTrap` for the manifest.

Nothing moves without an explicit yes, and the dialog shows the server's real
counts (§5.3), not the client's guesses:

```
Move your practice to <email>?

Moves to your account
  13 exercises            (12–28 July)
  4 practice sessions
  11 days of The Ascent
  2 badges
  a 4-day streak

Stays on this device
  your melody library, karaoke stems, saved songs

Before you do
  · Signing out will no longer show this practice — from then on
    it belongs to the account.
  · This cannot be undone.

        [ Leave it on this device ]   [ Move it ]
```

Dates on the practice line are load-bearing, not decoration — see §7.1. Default
focus goes on **Leave it on this device**; the destructive option is never
pre-selected. Fold the voiceprint prompt into the same dialog so there is one
offer rather than two (§9 phase 3).

The mailto stays as the fallback for the cases the automatic route refuses: no
stashed token (older build, or storage cleared), source already adopted, or the
source is a real account.

### 7.1 What the device can and cannot know

Worth being precise, because it decides how much machinery this deserves.

**What we can prove.** Two things, both cryptographic: whoever is at the
keyboard holds a valid token for the anonymous identity (§5.2), and they have
just authenticated as the account (password, or Google). Both are real proofs of
*possession*.

**What we cannot prove, ever.** That the human who did the practice is the human
who just signed in. There is no signal for it. The practice was done by "whoever
used this browser"; the sign-in was done by "whoever knows these credentials".
Usually the same person. The device holds no evidence either way, and no amount
of prompting produces any — a stranger can click "yes, this is mine" as easily as
the owner can.

**Which means the risk is not the one it first looks like.** Physical access to
an unlocked browser profile *already* grants reading the practice, the melody
library, the stems, and the microphone. Adoption does not create that access. It
adds exactly one new power: **transfer** — moving the cloud half somewhere the
original singer cannot reach.

So the question is not "how do we verify identity" (unanswerable) but "how much
does a wrong answer cost". Three things bound it, and the first is already true
of the design:

1. **The local half is never deleted.** §6 merges and marks; it removes nothing.
   A wrongful adoption costs the original singer their badges, streak, activity
   calendar and league points — not their exercise history, melodies, stems,
   trends or saved songs, which stay on the device for whoever uses it next.
2. **The manifest names dates.** "13 exercises, 12-28 July" is recognisable as
   not-yours in a way a bare count is not. This is the single cheapest thing
   that helps, and it costs one line of copy.
3. **The move is auditable.** `adoptedBy` / `adoptedAt` on the tombstone, plus
   the manifest counts recorded alongside, make a support-desk reversal
   possible. Without them a wrong move is not just irreversible in the product,
   it is un-investigable. Recommend a small `adoptions` row (source, target,
   timestamp, counts JSON) rather than widening `users`.

**The manual alternative is not safer, only slower.** An email saying "please
move device X to account Y" gives us exactly the same proof the button does —
none. We would be making the identical trust call by hand, at support cost, for
every singer. Its only real protection is friction: a housemate who would idly
click a button will not usually write an email. That is worth something, and it
is worth less than the number of genuine users who give up at "email us".

**Recommendation:** ship the button. Confirm explicitly, name the dates, delete
nothing local, record the audit row. Treat a wrong move as a support case, not
as something the client should have prevented — because it cannot.

This is the same call owner decision D2 already made for voiceprints
(`voiceprint-service.ts:290`), so the two surfaces stay consistent.

---

## 8. Decisions — locked 2026-08-03

1. **Credits and entitlements: never moved, in either direction.** Confirmed
   structurally impossible on an anonymous identity (§4); the endpoint asserts it
   rather than trusting it.
2. **Direction: local → account only.** Two real accounts are never merged; the
   endpoint refuses a non-anonymous source. "I made two accounts by mistake"
   stays a mailto.
3. **Public shares: not re-attributed.** Posting to the Community board becomes
   account-only (spam accountability — a listed post needs a display name
   someone owns). Content links (`share-codec.ts`) are a different system
   entirely and stay open to everyone, account or not. The source's existing
   board rows are removed in the adopt batch and listed in the manifest, to be
   re-published from the account.
4. **Source `userProfiles` deleted, source `users` tombstoned** (§5.4) — not both
   deleted, for the reason given there.
5. **Always confirmed, never automatic**, with a full manifest and a
   non-destructive default.

Context, not a decision: achievements, badges, streak and session history
*already* follow a signed-in account across devices — they are D1 rows. What does
not cross devices is the library and stems (`docs/plans/device-sync.md`), so a
future "sync" subscription would be selling that, not this.

---

## 9. Phasing

**Phase 0 — with v0.8. DONE.**
- Fix §3: don't claim `mp_sync_owner` for an anonymous identity, and forget the
  stamps the old claim already left. `settings-service.ts`; four regression
  tests in `settings-sync-merge.test.ts`, written red — one of them reproduced
  the loss exactly (the signed-out day was gone from the merged climb).
- Notice copy per §2.1. `LocalProgressNotice.tsx`.

**Phase 0b — sharing, shippable independently. DONE.**
- 403 anonymous writes to `sharedMelodies` / `sharedSessions`, with a message
  naming the two paths that do work. `requiresAccount` +
  `blockedForAnonymous` (tables.ts), `canPostToCommunity` (share-service.ts),
  `tables.test.ts`. See §4, and the wider sharing design in
  `<user-dotfiles>/personal/mercurypitch/sharing-model.md`.
- Not done there, deliberately: the share affordances still do not say *which*
  kind of sharing they do before the press, and progress sharing is undecided
  (friends-only vs global). Both are in the sharing doc, neither blocks v0.8.

**Phase 1 — the re-parent**
- Migration 0012, `POST /api/auth/adopt` (+ manifest GET), token stashing, the
  Move and Union classes, `handleAnonymous` refusal, the grant-engine re-run.
- Notice gains its manifest dialog; mailto becomes the fallback.

**Phase 2 — the reconciles**
- Streak/profile scalars, `challengeProgress` / `userAchievements`, league weeks,
  share removal.

**Phase 3 — one prompt**
- Fold voiceprint adoption into the same dialog; retire the second notice.

**Hardening, any time**
- `UNIQUE(userId, badgeId)` on `userBadges`, `UNIQUE(userId, achievementId)` on
  `userAchievements`. The union guards work without them; the index is what makes
  a double unlock *impossible* rather than merely avoided.
- ~~`docs/agent/INDEX.md` §2 guardrail 6 and its §5 how-to row still document
  `scripts/migrate-*.sql` + `workers/db-worker/schema.sql`.~~ Fixed in this
  branch, along with the matching lines in `MISTAKES.md` and `QUESTIONNAIRE.md`
  Q8.

---

## 10. Testing

Pure functions first — the risky parts are all decision rules:

- Streak reconcile: a table of (device streak, account streak, both
  `lastPracticeDate`s) → expected fields. Must include a stale device streak that
  must **not** become current, freezes capping at 2, and the later repair date
  winning.
- Union rules: a badge held by both keeps the earlier `earnedAt`; a challenge
  held by both sums `attempts` and maxes `bestScore`.
- `isAdoptable`: anonymous only, not self, not already adopted.

Worker integration against local D1 (`pnpm dev:db` + `.dev.vars`):

- Full adopt over a seeded source; assert every table's row counts.
- **Second adopt with the same source token → 409, and nothing changes.** This is
  the "cannot be double-unlocked" guarantee and deserves its own test.
- Post-adopt `POST /api/auth/anonymous` with the device id → 403 (the tombstone;
  fails if `users` was deleted instead).
- A real account's token as the source → 403.
- A source token whose `tokenVersion` was bumped by logout → 401.
- A source carrying a `creditLedger` row → 500, nothing moved.
- Manifest GET returns counts and writes nothing.
