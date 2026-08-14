# Audit follow-ups — the decisions needed

Companion to [BUGS.md](BUGS.md). PR #516 fixed 19 of the 46 candidates. This
lists what is left and, for each item, **the decision only you can make** — the
places where the right fix depends on product intent rather than on reading more
code.

Ordered by what it costs to get wrong, not by severity label.

---

## 1. Anonymous account takeover

### What exists now

Every visitor gets a random UUID stored locally. It does two jobs at once:

```ts
// workers/db-worker/src/auth.ts — handleAnonymous
const id = body.deviceId // the UUID from the browser
const existing = await findUserById(env.DB, id)
if (existing) {
  if (existing.authProvider !== 'anonymous') return 403
  return issueSession(env, existing, respond) // a session, on the id alone
}
```

That UUID is **both** the public identity (`users.id`, `userProfiles.id`) **and**
the only thing needed to sign in as that person. Knowing it is being them.

The design is deliberate and reasonable — it is what lets somebody practise for a
week before signing up without losing anything. The design is not the problem.
The problem is that the same value is **published**.

### Why it is a problem

`GET /api/leaderboard` requires no auth (rate-limited only) and its projection
emits `userId` for every entry (`index.ts:985`). So:

1. `curl https://api/api/leaderboard` — no credentials
2. collect the `userId` values
3. `POST /api/auth/anonymous {deviceId: <that value>}`
4. a valid session for that account

Nothing is brute-forced. The UUID is unguessable, which is exactly why it works
as a credential — but it is not guessed, it is read off the leaderboard.

The `authProvider !== 'anonymous'` check limits this to accounts that have not
signed up. That is both the good news and the bad news: those are the people on
the board before they committed to an account, and the ones with no recovery
path. An attacker gets their practice history, streaks, scores, profile, and
write access as them. Not payment details.

### The options

**A — opaque public handle.** Emit `HMAC(userId, SERVER_SECRET)` truncated
instead of the raw id. Deterministic, so "is this row me?" still works;
irreversible, so it cannot be replayed. `follow`/`unfollow` take a raw id today,
so the server must map handle to id on the way in, and
`CommunityLeaderboard.tsx:957` compares `row.userId === getUserId()` and would
compare handles. About half a day, no migration.

_Limit:_ a plaster. The id is still a password, you have only stopped printing it
on one surface. Any future endpoint that leaks an id reopens it.

**B — separate the credential from the identifier.** `users.id` stays public and
meaningless. Anonymous accounts get a distinct secret, generated server-side on
first contact, returned once, stored client-side. `/api/auth/anonymous` then
requires `{userId, secret}` — exactly like a password, auto-generated and never
shown. Two to three days including the transition.

_Why it is right:_ it fixes the class. Afterwards, leaking an id anywhere is
harmless, which is how it should be, and it is how every other auth method in the
worker already works.

_The transition problem:_ existing anonymous users hold only a deviceId, and you
cannot retroactively give them a secret they already have. Either grandfather
(accept deviceId-only for accounts created before the cutoff, mint a secret on
their next visit) or hard-cut (dormant accounts lose their history). Grandfather
leaves the hole open for accounts that never return, which is why it pairs with A
— once ids are no longer published, the exposure decays.

**C — second factor on resurrection.** There is no good candidate. Anything the
server already receives (User-Agent, IP) is forgeable or legitimately changes,
and anything new stored client-side is B with extra steps and no migration story.
Drop it.

### Recommendation

**A now, B next, grandfathered.** A removes the harvesting step this week at low
risk; B removes the underlying flaw. With A deployed, B's grandfather window is
safe because ids are no longer being published.

---

## 2. Following without consent

### What exists now

Two paths create a follow row, and they disagree.

**Friend code — consensual.** `handleFriendRedeem` inserts **both** directions in
one batch. You had to be given the code, so consent is implied and the
relationship is mutual. This is the intended design.

**Generic CRUD — not consensual.** `follow-service.ts:111` does
`repo.create({ userId: getUserId(), followedUserId: userId })`, i.e. a plain
`POST /api/follows`. The worker forces `body.userId = auth.userId`, so a follow
cannot be forged _from_ someone else — but `followedUserId` is unvalidated. One
row, one direction, no consent.

### What that leaks

The friends leaderboard scopes on

```sql
s."userId" IN (SELECT "followedUserId" FROM "follows" WHERE "userId" = ?)
```

One direction is enough. And the friends view is exactly where streaks and scores
are **not** zeroed — strangers get `streak: 0`, friends get the real numbers. So A
inserts a row pointing at B and reads B's streak and score aggregates, including
for a B with `leaderboardOptIn = 0` who agreed to nothing.

Compounds with §1: today the id can be read off the public board, then followed.
Fixing §1 makes targeting harder; it does not make this correct.

### The fix — follow requests, the Duolingo model

The design the friend-code path already implements, applied everywhere:

1. add `status` to `follows`: `pending` | `accepted`
2. `POST /api/follows` may only create `pending` — enforced server-side
3. a new endpoint lets the **target** accept, which creates the reciprocal row
4. friend-code redeem keeps writing both rows straight to `accepted` — the code
   is the consent
5. the friends view requires `status = 'accepted'`

**Migration:** existing rows cannot be told apart by origin, but they can by
shape. A reciprocal pair is consensual; a lone row is not. Mark mutual pairs
`accepted` and lone rows `pending`. Correct for friend-code pairs, and it
quarantines exactly the unilateral ones.

_Tradeoff:_ anyone relying on a one-way follow loses visibility until the other
side accepts. That is the correct outcome for something never consented to, but
it will produce "where did my friend go?" questions — worth a release note.

---

## 3. Streaks count UTC days, the rest of the app counts local days

### What exists now

Two functions compute "what day is it", and they disagree.

Streaks, `src/db/services/streak-service.ts:81`:

```ts
export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10) // UTC
}
```

The practice heatmap, `src/features/practice-intelligence/practice-activity.ts:31`:

```ts
export function localDayKey(iso: string): string {
  // toISOString() would bucket a 23:30 run into tomorrow for anyone east
  // of UTC, and yesterday's late practice into the wrong square.
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
```

The codebase already documents this bug, in the comment of the function that got
it right. The streak never got the same treatment.

### What breaks

At UTC+2 the calendars diverge between 00:00 and 02:00 local:

- Monday 20:00 local → 18:00 UTC Monday → counts as **Monday**
- Tuesday 01:00 local → 23:00 UTC Monday → counts as **Monday**

Both land on Monday. Tuesday gets no credit, and unless they practise again after
02:00 the streak breaks — after practising on two consecutive days as they
experienced them.

Mirror case at UTC−7: an 18:00 Monday session is 01:00 UTC Tuesday, so an evening
session credits tomorrow. And throughout, the heatmap and the streak disagree on
screen, because one is local and the other UTC.

### The decision

Local is obviously right — it is what a person means by "day" and `localDayKey`
already exists. The catch is that streak state is **stored**, so changing the key
re-buckets history: some users gain a day, some lose one, and a lost streak is
disproportionately upsetting.

- switch cleanly — simple, some users lose a streak on deploy day
- switch with a one-time grace rule that can only add, never remove: if the old
  UTC calculation gave a longer current streak, keep it. About 20 lines, runs once
- leave it and make the heatmap UTC too — consistent, and consistently wrong for
  everyone not near Greenwich

**Recommendation: switch to local with the grace rule.** Nobody should be punished
for a bug that was ours.

---

## 4. Stems and melodies — two unrelated problems

These share only a property of the audit: both are confirmed real, and for both
the hunt's suggested fix would break something else. They are otherwise unrelated.

### 4a. The extra stem's object URL

**This cannot lose a stem.** It is a memory bug. Stems live in IndexedDB; the
object URL is a temporary in-memory handle to a copy. Leaking the handle wastes
RAM and leaves the stored stem untouched.

`StemMixer.tsx:1724` mints a URL that pins the decoded WAV. Add drums, bass,
guitar and piano to a 4-minute song and a few hundred MB stay pinned for the life
of the tab.

**Why the suggested fix is wrong:** "revoke as soon as `decodeAudioData`
resolves" — but the URL is stored on the track and re-fetched later by
`useStemMixerAudioController.ts:588` (`loadOne(t.url)`) and `:1284`. Revoking
early breaks stem playback after a reload, which is worse than the leak.

**The decision — who owns the lifetime:**

- revoke when the stem is removed or the mixer unmounts. Reload path unchanged,
  small, low risk. **Recommended.**
- revoke immediately after decode and change the reload paths to go back to
  IndexedDB. Less memory, more moving parts, touches playback.

**On server-side stem loss specifically:** the one real data-loss path the audit
found here is already fixed in #516 — `pruneOrphanedCompletedSessions` deleted
completed separations when the stem read merely _failed_, with a mutation-verified
test. All six `*Strict` readers are hardened too, including
`deleteImportedUvrSessionDataStrict`, which could commit a rollback that had not
happened. The client storage layer was covered thoroughly; the server-side
separation and R2 retrieval path was only sampled and deserves its own pass.

### 4b. Deleting a melody leaves session items pointing at nothing

`deleteMelody` removes the melody and filters `playlists[].melodyKeys`. It does
**not** touch `library.sessions`. Session items with `type: 'melody'` keep a
`melodyId` pointing at the deleted melody, and keep their original label, so the
UI looks intact.

What the user gets on playback (`session-builder.ts:71`): the lookup fails and
the builder falls through to its fallback — **a single C4 note**. No error, no
warning. The session quietly becomes wrong, which is the worst part.

**Why the suggested fix is wrong:** "drop the session items" — but `restoreMelody`
sits directly below `deleteMelody` and exists for undo. Dropping the items means
undo restores a melody into sessions that no longer reference it. The undo
becomes a lie.

**The right shape:** destroy nothing on delete. Mark the reference unavailable,
render it as such (greyed, "melody deleted"), and refuse to substitute a silent
C4. Undo then genuinely restores.

**The larger question:** melodies stored server-side for account holders,
premium and supporters changes this problem's shape. Deletion becomes a sync
question — deleted on device A, still referenced by a session synced from device
B — and a missing reference becomes a routine state rather than an error. Worth
designing the missing-reference handling once, with sync in mind, rather than
patching local delete now and redoing it later.

---

## 5. Filters must obey the same mask as responses

### The mechanism

The worker exposes a generic CRUD layer: `GET /api/<table>` with filters like
`?where[kind]=donation`. Each table declares an access level plus two optional
column lists:

- `publicCols` — an allowlist. Only these leave. Fails closed, so a new column is
  invisible until someone adds it. Right for profiles.
- `privateCols` — a denylist. Everything leaves except these. Fails open, so a new
  column is public by default. Right for config tables the pricing page reads.

`maskPublicRow` applies these to the **response**.

### The hole

Masking the response is half the door. **A filter is also a read.** Nothing
stopped a caller filtering on a masked column, and whether a row comes back
answers the question the mask refused:

```
GET /api/pricingPlans?where[stripePriceId]=price_live_abc123
  row returned  → that price id exists
  empty         → it does not
```

`pricingPlans` declares `privateCols: ['stripePriceId']` precisely so live Stripe
configuration never leaves. The projection honoured that; the filter did not, and
`/count` made it cheaper still — one integer per guess, unauthenticated.

To be clear about what this is **not**: values were always bound as SQL
parameters and column names identifier-validated. Never injection. Information
disclosure, one bit at a time.

### Fixed in #516

Non-admin filters on `privateCols` return 400. Scoped there deliberately:
`privateCols` is documented admin-only, so refusing cannot break a legitimate
caller; only `pricingPlans` declares any; it rejects rather than silently
ignoring (which would widen results while looking successful); and the error does
not echo the guess back, which would rebuild the oracle inside the refusal.

### What is left

The same hole exists for `publicCols` tables. A blanket rule would also block a
user filtering **their own** rows — on a `user`-access table `scopeRead` already
restricts results to the caller, so filtering by a non-public column reveals
nothing about anyone else and is a legitimate query.

**The decision:** restrict `where[]` to `publicCols` **only on `public`-access
tables**, leaving `user`-scoped tables alone. About five lines plus tests. Before
shipping, grep the client's `where[...]` usage — it all goes through
`server-adapter.ts:180`, so it is enumerable — in case any call filters a public
table on a non-public column and would start 400-ing.

**This does not make public tables private.** Leaderboard config, pricing and
league rungs stay readable on purpose, so the client can render the rules it is
judged by. The change is narrower: the few columns already chosen to be withheld
should be withheld from filters too, not only from responses. If a column is fine
to publish, filtering on it is fine.

---

## 6. No decision needed — just work

These are unambiguous. Listed so nothing is lost, roughly in value order. None
was re-verified during the review pass, so treat the descriptions as leads.

**Worth doing next**

- `src/stores/drive-sync-store.ts:172` — Drive backup finds zero songs after any reload (`outputs` never rehydrated). If real, backup silently does nothing, which is the worst failure mode a backup can have.
- `src/lib/jam/jam-song-transfer.ts:238` — `sendInChunks` can wait forever on `bufferedamountlow` after the peer's channel dies.
- `src/db/services/settings-service.ts:241` — cloud settings sync silently drops annotations past the 8 KB ceiling.
- `src/components/PitchTestingTab.tsx:674` — detectors hardcode 44100 while the AudioContext may run at 48000. Note `src/tests/setup.ts` hardcodes `sampleRate = 44100`, so no test can currently observe a rate mismatch — fix the mock first or the fix is unverifiable.
- `workers/db-worker/src/billing.ts:925` — checkout grants credits without checking `payment_status`. Only reachable if a delayed payment method (SEPA) is ever enabled; cheap to harden now.

**Smaller**

- `src/lib/uvr-processing-pipeline.ts:162` — mutates the live session cache in place.
- `src/db/services/grant-flush.ts:253` — badge write not idempotent, so a retried flush duplicates rows.
- `src/components/PitchCanvas.tsx:2079` — a `createEffect` full redraw on top of the rAF loop, so every frame renders twice.
- `src/components/PitchCanvas.tsx:199` — `AudioEngine.init()` as a floating promise.
- `src/features/stem-mixer/useStemMixerLyricsController.ts:864` — a network outage reported as "no lyrics found".
- `src/components/panes/WaveformPane.tsx:63`, `src/workers/spectral.worker.ts:40` — both windowing/indexing errors in the `HistoryCanvas` family; worth doing together.
- Worker hardening: `auth.ts:1361` and `index.ts:2133` both return 500 on malformed input where 400 is correct; `index.ts:236` binds an unvalidated `offset` as NaN.
- `auth.ts:2093` — device-link poll token compared with `!==`. The surrounding tests already assert response-equivalence, so the oracle is closed at the response level; constant-time comparison is still the right habit.
- Accessibility: `StemMixerTransport.tsx:603` is a click-only div with no role or keyboard handler.
- `src/features/editor/useEditorController.ts:35`, `src/lib/lyrics-service.ts:280`, `useStemMixerPitchAnalysisController.ts:242`, `useStemMixerCanvasController.ts:151`, `vocal-analyzer.ts:320`, `PitchCanvas.tsx:989`.

---

## 7. The structural items, which outlast any single bug

From [CODE-HEALTH.md](CODE-HEALTH.md) §8 and [TESTING.md](TESTING.md) §5. Not
bugs, but they are why the bugs above were findable only by reading.

1. **Kill the 22 import cycles.** Tractable, and the ones that cause real module-init-order bugs. Three are barrel-file artefacts.
2. **Extract geometry from the canvases.** `PitchCanvas.tsx` (cognitive complexity 255), `GuitarFretboardCanvas.tsx` (135), `OfflinePitchCanvas.tsx` (153). `HistoryCanvas` in #516 is the worked example: the bug was in the geometry, extracting it made it testable, and 5 of 7 new cases catch the old index.
3. **Repoint the copy-based tests at the real code.** `arc-physics.test.ts` (1458 lines asserting against a transcription of `PitchCanvas` that has already drifted) and `jam-canvas-math.test.ts`. The reasoning in them is good; it points at nothing.
4. **Fix `src/tests/setup.ts`.** `MockAnalyser` returns silence and `localStorage` is a plain object rather than a `Storage`, which silently voids the tests that depend on prototype spies. `URL.revokeObjectURL` is unstubbed, which is why no object-URL leak is observable anywhere in the suite.
5. **Delete the 43 assertions that cannot fail** (`expect(count).toBeGreaterThanOrEqual(0)`), all in `melody-library.spec.ts` and `sessions.spec.ts` — the same two files holding 189 of the 488 e2e hard waits.
6. **Port `auth.test.ts` onto the SQLite harness** already sitting unused in `workers/db-worker/node-tests/`.
7. **Add `pnpm arch` and `pnpm metrics:check` to `check:ci`.** #516 ships both; wiring them in is what makes the ratchet bite at the point of change.

---

## Summary of what I need from you

| #   | Decision                                                                          | Blocking                                   |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | Anonymous credential: A, B or C — and what happens to existing anonymous accounts | The only critical item                     |
| 2   | Follow requests with acceptance (Duolingo model)? — proposed, needs confirming    | Fixing the aggregate exposure              |
| 3   | Local-day streaks: accept the one-time re-bucket, or add a grace rule?            | Touching user-visible streak history       |
| 4a  | Extra-stem URL: revoke on removal/unmount (recommended) or re-fetch on demand?    | Memory only — cannot lose a stem           |
| 4b  | A session item whose melody was deleted: how should it read and behave?           | Today it silently plays a single C4 note   |
| 4c  | Server-side melody storage for accounts/premium — design before patching 4b?      | Changes 4b from an error into a sync state |
| 5   | Restrict `where[]` to `publicCols` on public tables only?                         | Five-line change, API policy               |

Everything in §6 and §7 can proceed without input.
