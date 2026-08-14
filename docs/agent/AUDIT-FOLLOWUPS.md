# Audit follow-ups — the decisions needed

Companion to [BUGS.md](BUGS.md). PR #516 fixed 19 of the 46 candidates. This
lists what is left and, for each item, **the decision only you can make** — the
places where the right fix depends on product intent rather than on reading more
code.

Ordered by what it costs to get wrong, not by severity label.

---

## 1. Anonymous account takeover — needs a decision before anything else

`workers/db-worker/src/auth.ts:1046-1073`, `workers/db-worker/src/index.ts:985`

**Confirmed, reproduced during the audit.** For an anonymous account the user id
**is** the `deviceId`, and `deviceId` is the only credential
`POST /api/auth/anonymous` accepts:

```ts
const id = body.deviceId
const existing = await findUserById(env.DB, id)
if (existing) {
  if (existing.authProvider !== 'anonymous') return respond({...}, {status: 403})
  return issueSession(env, existing, respond)   // a session, on the id alone
}
```

`GET /api/leaderboard` is unauthenticated — rate-limited and nothing else — and
its projection emits `userId` for every entry. Read the board, replay the ids,
receive a session for every account still on `authProvider: 'anonymous'`. Those
are exactly the users who appear before they ever sign up. The attacker then
holds their practice history, streaks and profile.

The `authProvider !== 'anonymous'` check bounds the blast radius to un-upgraded
accounts. It does not close the hole.

### The decision

| Option                                                                                                                                                    | What it costs                                                                                                                                                              | What it buys                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **A. Opaque public handle** — stop emitting raw ids in public projections; hand out `HMAC(userId, serverSecret)` truncated                                | Server must resolve handles back for `follow`/`unfollow`; `CommunityLeaderboard.tsx:957` compares `row.userId === getUserId()` and needs the handle instead. No migration. | Closes it for every public surface at once           |
| **B. Separate the credential from the identifier** — keep `users.id` public, give anonymous accounts a distinct secret issued once and stored client-side | A migration, plus a transition for existing anonymous users who have only their deviceId                                                                                   | The actually-correct model. An id is not a password. |
| **C. Second factor on resurrection** — keep the id, require something else the client already holds to re-issue a session                                 | Smallest change; needs a value that is genuinely client-held and not derivable                                                                                             | Narrows the window without a migration               |

**Recommendation: B, with A shipped first as mitigation.** A is deployable this
week and removes the harvesting step; B removes the class of bug. C is a
stopgap that leaves an id doing a password's job.

**What I need from you:** which of A/B/C, and — if B — what happens to existing
anonymous accounts. Silently orphaning them loses real practice history.

---

## 2. Unilateral follows expose private aggregates

`workers/db-worker/src/index.ts:904` — high, `likely`, **not re-verified**

The reported shape: `leaderboardOptIn` defaults to 0 (migration 0003, explicitly
because "nobody on it today was ever asked"), but the friends view scopes on
rows in `follows`, and a follow is unilateral. So A follows V without consent
and reads V's streak and score aggregates.

### The decision

Is following in this product **unilateral** (Twitter-style) or **mutual**
(Facebook-style)? The fix follows directly:

- Unilateral stays → the friends view must require a _mutual_ edge before showing aggregates, i.e. rows in `follows` in both directions.
- Mutual is intended → `handleFriendRedeem` already models consent; the friends view should use the same rule.

Either way this is a product answer, not a code answer. It also interacts with
item 1: closing the id leak makes targeted follows much harder, but does not
make them wrong.

---

## 3. UTC vs local dates for streaks

`src/db/services/streak-service.ts:81` — high, `likely`, **not re-verified**

Streaks, the daily goal and Ascent days key on UTC dates; the rest of the app
uses local dates. A singer in UTC+9 practising at 08:00 has every session land
on the previous UTC day.

### The decision

**What is a "day" for a streak?** Local midnight is what a user means and what
the rest of the app already uses. But changing the key **retroactively
re-buckets existing history**: some users gain a streak day, some lose one, and
a lost streak is the kind of thing people are genuinely upset by.

Options: switch and accept the one-time shift; switch with a grace pass that
never _breaks_ a streak on migration day; or leave it and make it consistent the
other way.

**Recommendation:** switch to local (`localDayKey` already exists) with a
migration-day grace rule that can only add, never remove. But the grace rule is
a product call.

---

## 4. Two where the hunt's suggested fix is wrong

Both are **confirmed real**. Applying the proposed remedy as written would
introduce a worse bug — the detail is in BUGS.md, summarised here because both
need a decision rather than a patch.

**`src/components/StemMixer.tsx:1724` — added stem's object URL never revoked.**
The proposed "revoke after `decodeAudioData`" breaks stem reloading: the URL is
stored on the track and re-fetched by
`useStemMixerAudioController.ts:588` and `:1284`. _Decision: should an extra stem
own its URL for the mixer's lifetime (revoke on removal/unmount) or be re-fetched
on demand (revoke immediately, change the reload path to go back to IndexedDB)?_

**`src/stores/melody-store.ts:1041` — deleting a melody leaves dangling ids.**
The proposed "drop the session items" breaks `restoreMelody`, the undo path
immediately below it. _Decision: what should a session item whose melody was
deleted look like — removed, or shown as unavailable and restorable with the
melody?_ The `missing: true` shape preserves undo.

---

## 5. The `publicCols` half of the query oracle

`workers/db-worker/src/index.ts:218` — the `privateCols` half is fixed in #516

A `where[col]` filter on a non-public column is still an oracle on tables that
declare `publicCols`. It was left open because a blanket rule would also block a
user filtering **their own** rows on a `user`-scoped table, where `scopeRead`
already restricts the result set and no oracle exists.

_Decision: restrict filters to `publicCols` only for `public`-access tables, and
leave `user`-scoped tables alone?_ That is my recommendation and it is a
five-line change, but it is a policy statement about the API.

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

| #   | Decision                                                                          | Blocking                                      |
| --- | --------------------------------------------------------------------------------- | --------------------------------------------- |
| 1   | Anonymous credential: A, B or C — and what happens to existing anonymous accounts | The only critical item                        |
| 2   | Is following unilateral or mutual?                                                | Fixing the aggregate exposure                 |
| 3   | Local-day streaks: accept the one-time re-bucket, or add a grace rule?            | Touching user-visible streak history          |
| 4   | Extra-stem URL lifetime; and what a session item with a deleted melody looks like | Two confirmed bugs whose obvious fix is wrong |
| 5   | Restrict `where[]` to `publicCols` on public tables only?                         | Five-line change, API policy                  |

Everything in §6 and §7 can proceed without input.
