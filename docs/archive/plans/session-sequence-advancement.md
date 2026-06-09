# Plan — Unified session-sequence advancement

## Goal

A single, predictable advancement path for "play through a session of N
melody/rest/scale items in order", reachable from every entry point:

| Entry point | UI | Code path today |
| --- | --- | --- |
| **A. "Play All in sequence"** (Library `Play All`, Sidebar Library Modal `Play`, Playlist `Play All`, Session Library Modal `Play`) | `window.__pp.playSessionSequence(ids)` | `useSessionSequencer.playSessionSequence` |
| **B. "Start template"** from `SessionBrowser` | `onStartSession(template)` in `App.tsx` | sets `userSession` → `handlePlay` |
| **C. Practice tab `Play`** with an active session loaded in the editor / sidebar | `handlePlay` directly | `usePlaybackController.handlePlay` |
| **D. Practice tab `Play`** with **no** session — just a single melody | `handlePlay` directly | `usePlaybackController.handlePlay` |

All four must end up advancing items via the **same** mechanism:

```
playbackRuntime.complete event
  └─ App.tsx complete handler
      └─ if sessionMode  → handleSessionItemComplete()
                            └─ advanceSessionItem()    (practice-session-store)
                            └─ loadNextSessionItem()   (sequencer)
                                  ├─ rest → synthetic rest melody, start(0)
                                  ├─ scale → buildScaleMelody, start(countIn)
                                  └─ melody/preset → buildSessionItemMelody, start(countIn)
```

D **must not** enter session mode at all.

---

## Audit of the current uncommitted diff

The latest changes (`useSessionSequencer.ts`, `usePlaybackController.ts`,
`session-store.ts`) introduced fixes but also several regressions. Each
one needs to be addressed before the unified plan below works end-to-end.

### Bug 1 — Pause/Resume now restarts the session

`usePlaybackController.handlePlay` (the `playMode === 'practice'` branch)
now **unconditionally**:

1. Builds the *first* item's melody, and
2. Calls `melodyStore.setMelody(...)` + `setPlaybackDisplayMelody(...)` +
   resets `forcedDurationBeats`.

The only thing it guards is `startPracticeSession(session)` (behind
`!sessionMode()`). Re-priming `melodyStore` and `forcedDurationBeats` on
every Play means **Pause → Play** will reset the per-item runtime back
to item 0.

Fix: gate the per-item priming behind `if (!sessionMode())` as well —
**all** the "first-item" work belongs only on the initial entry into the
session, not on Resume.

### Bug 2 — Stale `practiceSession` when reusing `sessionMode`

`handlePlay` skips `startPracticeSession(activeSession)` when
`sessionMode()` is already `true`. But `sessionMode()` can persist
across sessions (the previous Stop didn't reset it). Starting a *new*
session via `playSessionSequence(...)` while `sessionMode === true`
will:

- skip `startPracticeSession(newSession)`,
- still re-prime melody #0 of the **stored** `userSession()`,

…leaving `practiceSession()` and `userSession()` out of sync — the
runtime plays one session's items but `advanceSessionItem` walks the
other's list.

Fix: re-seed when **either** `!sessionMode()` **or** the `practiceSession()`
identity differs from `userSession()`:

```ts
const needSeed = !sessionMode() || practiceSession()?.id !== activeSession.id
if (needSeed) {
  setSessionMode(true)
  setSessionActive(true)
  startPracticeSession(activeSession)
  setSessionItemIndex(0)
  setSessionItemRepeat(0)
}
```

### Bug 3 — Single-melody Practice gets force-promoted to session mode

`handlePlay` checks `if (playMode() === 'practice')` and immediately
follows with `if (activeSession && activeSession.items.length > 0)`. In
the typical "single melody loaded into the editor" flow `userSession()`
is still populated (from a previous session edit), so this branch
fires, sets `setSessionMode(true)`, and replaces the user's melody with
the first item of the leftover session.

Fix: only enter session priming when the caller actually wants session
playback. Three fix options, ranked by preference:

1. **Caller-driven (preferred)**: `handlePlay({ session?: PlaybackSession | null })`
   — `playSessionSequence` and `onStartSession` pass the session;
   non-session callers pass `null`.
2. **Mode-gated**: introduce `setSessionMode(true)` *before* calling
   `handlePlay` from the session entry points and gate the priming on
   `if (sessionMode())` here. The current diff has this inverted — the
   guard reads `if (!sessionMode())` to *avoid re-seeding*, which is
   correct semantics for resume but wrong for initial entry.
3. **Differentiate**: keep `sessionMode` for resume-state and add a
   transient `setPendingSessionStart(true)` that `handlePlay` consumes.

Any of the three works; option 1 (parameterised) is the cleanest and
removes most of the implicit-state coupling.

### Bug 4 — Path A (`window.__pp.playSessionSequence(ids)`) ignores `ids`

`useSessionSequencer.playSessionSequence(_melodyIds)` underscores the
parameter and uses `userSession()` instead. Library / Playlist / Sidebar
Modal call sites compute a list of melody ids from the user's selection
and pass them in — those ids are silently dropped. The user sees a
session that is whatever happened to be in `userSession()` last.

Fix: when `_melodyIds` is non-empty, build a transient `PlaybackSession`
from those ids (each id → a `melody` `SessionItem`), set it as
`userSession()` (or pass it directly via the parameterised `handlePlay`),
**then** start. Do not silently fall back to a stale session.

### Bug 5 — `templateToSession` added in `session-store.ts` but unused

The new `templateToSession()` helper has no callers. The
`SessionBrowser` template flow (path B) is a candidate but currently
goes through `App.tsx`'s `onStartSession`. If we keep this helper, wire
it in path B and document where it converts. If we don't, delete it
before merge — dead code masks the intent of the refactor.

### Bug 6 — Removed `startPracticeSession`/`practiceSession` imports leave `playSessionSequence` unable to verify state

The diff removed `practiceSession`, `startPracticeSession` from
`useSessionSequencer.ts` imports. With Bug 2's identity-based reseed in
mind we *want* to read `practiceSession()` in `handlePlay`. Re-add the
import where needed.

### Bug 7 — Initial rest is now playable, but does it actually play?

The diff adds rest-item handling to `handlePlay` (synthetic rest melody
of `restBeats`). Good for visualisation, but verify:

- The runtime's `complete` for a rest still routes through
  `handleSessionItemComplete`. ✅ (sessionMode is true.)
- `App.tsx`'s `noteStart` handler honours `isRest` and suppresses
  audio. (Pre-existing path used by `loadNextSessionItem` for mid-list
  rests — confirm initial rest uses the same id range / flag path.)
- `playbackRuntime.start(countIn())` vs. `start(0)` — initial rest
  should fire with `countIn() === 0` so it doesn't introduce a leading
  metronome to a silent gap. The diff sets `forcedDurationBeats =
  restBeats` but leaves `start()`'s count-in argument up to the
  pre-existing `handlePlay` body — confirm it propagates `0` for rests.

---

## Unified design (target state)

### Single state-machine source of truth

`practice-session-store` already owns:

- `sessionMode` (in/out of a session)
- `sessionActive` (currently mid-session)
- `practiceSession` (the immutable plan being walked)
- `sessionItemIndex` + `sessionItemRepeat` (cursor)
- `advanceSessionItem()` (cursor mutation, handles per-item repeats)

This is the right primitive. **Every** entry point should produce a
`PlaybackSession` and call **one** start function, then leave
advancement to the runtime/`handleSessionItemComplete` loop. No
component should poke `sessionItemIndex` directly.

### One start function

```ts
// in useSessionSequencer or playback controller
function startSessionPlayback(session: PlaybackSession): void {
  closeSidebar()
  setActiveTab('practice')
  setPlayMode('practice')

  // Reset cursor & history for a fresh session
  startPracticeSession(session)            // sets practiceSession + clears results
  setSessionItemIndex(0)
  setSessionItemRepeat(0)
  setSessionMode(true)
  setSessionActive(true)
  setUserSession(session)                  // single source of truth for UI

  // Load item 0 (handles rest/scale/melody/preset)
  loadNextSessionItem()                    // already exists, supports all kinds

  // start() is invoked by loadNextSessionItem via setTimeout(... countIn())
}
```

`handlePlay` then becomes mode-pure:

```ts
function handlePlay(): void {
  if (sessionMode() && sessionActive()) {
    // Resume — DO NOT re-prime. PlaybackRuntime resumes from currentBeat.
    playbackRuntime.start(0)
    return
  }
  // Single-melody / scale / repeat — original simple path.
  playbackRuntime.setMelody(melodyStore.items())
  playbackRuntime.start(countIn())
}
```

### Mapping each entry point

| Path | Becomes |
| --- | --- |
| **A. `playSessionSequence(ids)`** | Build a `PlaybackSession` from `ids` (one `melody` `SessionItem` per id, optional default rest between, configurable later) → `startSessionPlayback(session)`. |
| **B. `SessionBrowser.onStartSession(template)`** | `templateToSession(template)` → `startSessionPlayback(session)`. (This is where the new `templateToSession` helper lands.) |
| **C. Practice tab `Play` with an active session in editor** | `startSessionPlayback(userSession())`. The practice tab's Play button decides between C and D by checking whether `userSession()` has multiple items / a non-trivial timeline. |
| **D. Practice tab `Play` with single melody** | `handlePlay()` (does NOT touch session state). |

The C/D dispatch lives in the practice tab Play button click handler,
not inside `handlePlay`. This gets rid of the "Practice mode silently
hijacks `userSession`" footgun (Bug 3).

### `complete` handler in `App.tsx`

After the cleanup the path-A "external sequence" branch (`sessionMelodyIds`
+ `playNextInSessionSequence`) is **dead** — every entry point now goes
through `sessionMode`. Delete:

- `sessionMelodyIds`, `sessionCurrentMelodyIndex`, `sessionSummary?` (keep summary, it's reused),
- `playNextInSessionSequence`, `loadAndPlayMelodyForSession` (replace with `startSessionPlayback`),
- the leading `if (ids.length > 0 ...)` block in the `complete` handler.

The complete handler shrinks to:

```ts
playbackRuntime.on('complete', () => {
  practiceEngine.onPlaybackComplete()
  if (sessionMode() && playMode() === 'practice') {
    handleSessionItemComplete(); return
  }
  if (playMode() === 'repeat') {
    handleRepeatModeComplete(); return
  }
  void handleStop()
})
```

### `handleStop` resets session mode

`handleStop` currently leaves `sessionMode === true` (per the diff
comment: "handleStop never reset sessionMode back to false"). Centralise
the cleanup:

```ts
async function handleStop(): Promise<SessionResult | null> {
  …existing teardown…
  setSessionMode(false)
  setSessionActive(false)
  // practiceSession is intentionally retained so the summary screen
  // can read it; clear when starting the next session.
}
```

This makes Bug 1 / Bug 2 collapse: `handlePlay` no longer needs the
`!sessionMode()` guards because Stop guarantees a clean slate, and a
genuine Resume keeps `sessionMode === true` so it stays in the
"resume" branch.

---

## Phased step-by-step

1. **Centralise stop.** Add session-state cleanup to `handleStop`.
2. **Introduce `startSessionPlayback(session)`** in `useSessionSequencer`.
   Internally calls `loadNextSessionItem()` for item 0 (which already
   knows how to handle rest/scale/melody/preset).
3. **Rewrite `handlePlay`** to be mode-pure:
   - if `sessionMode() && sessionActive()` → resume runtime;
   - else → simple non-session start.
   Remove all the `playMode === 'practice'` per-item priming
   currently in `handlePlay`.
4. **Rewire `playSessionSequence(ids)`** to build a transient session
   from `ids` and call `startSessionPlayback`.
5. **Rewire `App.tsx`'s `onStartSession(template)`** to use
   `templateToSession(template)` → `startSessionPlayback(session)`.
6. **Practice tab Play button**: dispatch C/D explicitly based on the
   loaded session shape — `userSession().items.length > 1`
   → `startSessionPlayback`; otherwise `handlePlay`.
7. **Delete dead path** in `App.tsx`:
   `sessionMelodyIds` / `sessionCurrentMelodyIndex` /
   `playNextInSessionSequence` / `loadAndPlayMelodyForSession`. Keep the
   `sessionSummary` UI; it's still emitted by `handleSessionItemComplete`.
8. **Verify rest-item audio gate**. Confirm `App.tsx`'s `noteStart`
   handler suppresses audio for `id <= -200000` (the synthetic rest id
   range), or — better — for any `MelodyItem` with `isRest === true`.
   Make this consistent so initial-rest and mid-session-rest behave
   identically.
9. **Tests**:
   - E2E: each of A/B/C/D plays through 3-item sessions
     (melody/rest/melody) with playhead advancing past the rest.
   - E2E: pause mid-item-2, resume, expect runtime to continue from the
     current beat without re-seeding to item 0.
   - Unit: `advanceSessionItem` returns `null` only at end (already
     covered) — keep the existing test green.

## Acceptance criteria

- Path A (Library/Playlist/Sidebar `Play All`) plays the **selected ids**,
  not whatever was in `userSession()` previously.
- Path B (`SessionBrowser` template) plays the template's items in
  order, including rests, without restarting on the next runtime
  `complete`.
- Path C (Practice + session loaded) advances item by item and reaches
  the final summary toast.
- Path D (Practice + single melody) plays the single melody and stops
  without flipping into session mode.
- Pause → Play resumes from the current item/beat for all of
  A/B/C; D resumes per the existing single-melody behaviour.
- Stop in any state cleanly resets `sessionMode`, `sessionActive`,
  `sessionItemIndex`, `sessionItemRepeat`. A subsequent Play starts a
  fresh session from item 0.
- `templateToSession` is either used (path B) or removed.

---

## Status update — partial execution

The plan was partially executed in this iteration. Summary:

### Audit of prior work
- ✅ EngineContext effective-BPM (`bpm × playbackSpeed`) **was** wired correctly — verified in `App/src/contexts/EngineContext.tsx`.
- ✅ `handleStop` already calls `setSessionMode(false)` (Bug 1 partial fix from a prior pass — no change needed).
- ✅ `pendingSessionStart` flag and gate in `handlePlay` introduced (this pass).
- ✅ `playSessionSequence(ids)` now actually uses the `ids` argument — builds a transient `PlaybackSession` and calls `setActiveUserSession` (Bug 4 fixed).
- ✅ `handlePracticePlay` in `App.tsx` now sets `pendingSessionStart` only when the loaded `userSession()` is multi-item or contains non-melody items (Bug 3 mitigated).
- ✅ `onStartSession` in `App.tsx` already used `templateToSession` (Bug 5 already addressed).

### Deferred (low risk, can be done next pass)
- `sessionMelodyIds` parallel path inside `useSessionSequencer` — still present but unused now that `playSessionSequence` builds sessions directly. Safe to delete in a follow-up.
- Rest-item audio gate — verified in `App.tsx:480` (`if ((item as { isRest?: boolean }).isRest === true) return`) — already correct.
- Type/lint cleanup deferred per user direction.

### Files touched (this pass)
- `App/src/stores/practice-session-store.ts` — added `pendingSessionStart` signal.
- `App/src/features/playback/usePlaybackController.ts` — gate, transient session builder, explicit set of session-mode state.
- `App/src/App.tsx` — imports + `handlePracticePlay` heuristic.
