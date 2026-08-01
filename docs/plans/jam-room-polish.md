# Jam room: polish + a reason to be there

**Status:** phases 0 and 1 are implemented on
`feat/jam-tab-polish-transparency-55a592` (PR #388); phases 2-6 are unbuilt.

The Jam tab has a working multiplayer spine and almost nothing to do with it.
This plan is about the second half.

## 1. What the room already is

Worth stating precisely, because most of the plan below is reuse rather than
new engineering.

**Transport** — `workers/jam-worker` is a Durable Object that does signaling
only: WebSocket relay, `MAX_PEERS = 12`, host election. All room data rides a
WebRTC mesh DataChannel (`src/lib/jam/service.ts`). Message kinds today
(`src/lib/jam/types.ts`): `pitch`, `melody`, `playback`, `chat`, `video-state`.
Adding a kind is three edits: the union in `types.ts`, the router in
`service.ts`, a callback in `jam-store.ts`.

**Already working, and better than it looks**

| Thing | Where |
|---|---|
| Shared piano roll, every peer's pitch trail in their own colour | `JamExerciseCanvas.tsx` |
| Live scoreboard, +/-50 cents hit rate, sorted | `JamExerciseCanvas.tsx:drawScoreboard` |
| Host transport: play/pause/stop/seek, 4-beat count-in, loop, BPM | `jam-store.ts` |
| Multi-peer scrolling pitch monitor | `JamSharedPitchCanvas.tsx` |
| Chat, camera tiles, peer latency, per-room backdrops | `JamChatWidget`, `JamCameraWidget`, `JamPage` |
| Past-run heatmap | `JamActivityHeatmap.tsx` |

**The honest constraint.** Real-time *audio* ensemble over the internet is a
physics problem, not an engineering one: past roughly 30 ms of round trip,
playing together stops working. A 12-peer mesh of live mics is worse. So the
room should not pretend to be a band rehearsal. It should be a **shared
practice room** — turn-taking, simultaneous-but-independent, and scoring.
Every mode below is designed to hold up under 150 ms of jitter. This is a
design constraint, not a limitation to be fixed later.

## 2. What is actually wrong

1. **There is nothing to do.** The exercise picker lists `melody-store`
   melodies and nothing else. None of the 18 exercises, no weekly challenge,
   no Ascent week, no songs. You create a room and stare at a C major scale.
2. **Nothing counts.** `jamExerciseHistory` is sessionStorage and dies with
   the tab. It never reaches `recordExerciseResult`, so a jam feeds no streak,
   no Ascent progress, no weakness analysis, no badge, no leaderboard.
   Practising with a friend is worth *less* than practising alone.
3. **The scoreboard is not the same for everyone.** Each client scores every
   peer from its own `jamPitchHistory`, mapping samples to beats by wall-clock
   age (`Date.now() - s.timestamp`). Different jitter, different scoreboard.
   Two people in one room can each believe they won.
4. **Vocal only.** `useGuitarPracticeController`, the alphaTab import path, the
   3D tab renderer and the `falling-notes` piano engine are all absent. A
   singer cannot jam with a guitarist, which is the word "jam".
5. **The room is invisible.** No presence on Home, Community or Challenges.
   A multiplayer feature nobody can see is a ghost town by construction.
6. **The lobby is a form.** A name field and a Create Room button, with no
   statement of what happens next.

## 3. Phase 0 — room glass (implemented)

The canvas painted an opaque `#0d1117` base over a generated rehearsal-room
photo, so the backdrop only ever showed at the page margins.

- `jamRoomAlpha` in `jam-store.ts`, persisted to `pitchperfect_jam_alpha`,
  default `0.3` (70% transparent), clamped `0.05..1`, deliberately not reset
  by `cleanupJam`.
- `JamPage` writes it to `--jam-alpha`; `JamPage.module.css` rebinds the theme
  `--bg-*` tokens to it, plus `--jam-glass` (flat panels) and `--jam-float`
  (chat/camera/heatmap, which carry running text and keep more body). Every
  surface that already said `var(--bg-primary)` turned translucent for free.
- Both canvases dropped their opaque base fill; their containers carry the
  glass and a 3 px backdrop blur so note heads stay legible over photo detail.
- Header slider next to the mic/camera controls. The invite modal opts out —
  a dialog you copy a room code out of must not go see-through.

## 4. Phase 1 — a reason to press Create Room (implemented)

Cheapest phase, largest effect. No protocol change: `selectJamExercise`
already broadcasts a whole `MelodyData`, so a built target reaches peers
exactly as a saved melody does.

**`src/lib/jam/jam-catalog.ts`** is the adapter. The picker now shelves four
sources instead of listing one:

- **This week's challenge** — `weekly-service.getActiveWeekly()`, fetched
  when the room goes live. `targetItems` is already `MelodyItem[]`.
- **Your Ascent week** — `activePathWeek()` (added to `path-progress.ts`),
  whose `exercises` run through the same drill table.
- **Exercises** — twelve of the eighteen.
- **Your melodies** — the original shelf, unchanged.

Drill notes are written at octave 4 and transposed into the host's vocal
range on build, which makes the octave the host's call for everyone — the
same deal the room already has for BPM. The **weekly is deliberately not
transposed**: a shared board only means something if everyone sang the same
notes.

Six exercises are excluded, and the module says so in
`JAM_EXCLUDED_EXERCISES` rather than leaving them quietly missing: `vibrato`
and `dynamic-swell` score a rate and an envelope rather than a pitch target
and need their own canvas lane; `warmup` and `routine-runner` are coached
multi-block flows; `call-response` and `mirror-melody` need a phrase played
to the room first, which is a room mode (phase 4), not a target.

Two bits of header and lobby debt went with it: the header dropped its
duplicate room-code copy (the invite modal has had both copies all along)
while keeping the code visible because people read it aloud, and the lobby
now states what the room is and what can be run in it.

Covered by `src/tests/jam-catalog.test.ts` — transposition per range, beat
layout, the `"G44"` bare-note-name trap, weekly pass-through, and the
exclusion list.

## 5. Phase 2 — one shared truth

The correctness phase, and a prerequisite for anything competitive.

- **Room beats, not wall clock.** `service.ts` already measures RTT per peer
  for the latency display. Use it to estimate a clock offset and stamp each
  pitch sample with a *room beat* instead of `Date.now()`. Every peer then
  scores the same sample against the same target.
- **Score with the real engine.** Keep the rolling +/-50-cent count as the live
  HUD, but compute the run's final score with `exercise-scoring-utils`, the
  same code the solo exercises use — so a jam score and a solo score mean the
  same thing.
- **Write only your own result.** The DO is an unauthenticated relay; peer
  payloads are untrusted input. Each client persists its *own* score via
  `recordExerciseResult` and never a peer's. Peer scores stay display-only.

That last point is what makes phase 3 safe.

## 6. Phase 3 — make it count

Once phase 2 lands, wiring is small:

- Jam runs feed `exercise-history-store`, and therefore streaks, Ascent
  progress, `practice-intelligence/weakness-analyzer` and badges.
- A jam attempt at the weekly challenge posts to the real weekly board through
  `challenge-attempt.ts` / `weekly-attempt.ts`.
- A jam slice on the leaderboard via `leaderboard-service`.
- A **"jammed with"** badge line — the one achievement that is only reachable
  with another person in the room.

## 7. Phase 4 — modes worth having

One host-chosen mode per room, broadcast on the existing `melody`/`playback`
channel pattern. Ranked by how much each one justifies a second person being
present.

**Harmony Stack** — each peer is assigned a scale degree (root / third /
fifth), the logic `chord-stacker` already owns. Three target lanes on the
canvas; the scoreboard shows chord lock — how in tune the *stack* is, not the
individuals. Nobody can do this alone, ever, and it survives latency because
each peer sings to the same click and only the scoreboard combines. This is
the strongest argument for the whole feature.

**Relay** — the melody splits into phrases, one per peer, in a round. The
canvas colours whose bar is coming and hands off. Turn-taking is inherently
latency-proof, it scales from 2 to 12, and it is fun in a way solo practice
cannot be. Uses the existing protocol unchanged.

**Call & Response** — one peer sings a phrase live; the live pitch pipeline
captures the contour; everyone else echoes it and is scored against the
*human* phrase via the `shazam/melody-matcher` DTW scorer. The `call-response`
exercise and the matcher both already exist. Most musical of the four.

**Duel** — two peers, same target, best of three, winner to the leaderboard.
Least novel, most shareable.

## 8. Phase 5 — the other instruments

The largest lift; do it last.

- `instrument: 'vocal' | 'guitar' | 'piano'` on `JamPeer`, broadcast at join.
- Guitar peers detect through `useGuitarPracticeController`; piano peers can
  use MIDI, which `falling-notes-store` already models (`inputMode:
  'mic' | 'midi'`). The shared canvas draws one lane per instrument.
- **Cheaper first step, most of the value:** *jam over a backing track*. Both
  peers load the same demo song or stem-mixer session locally and the host
  syncs transport — `playback` messages already carry beats, so this is close
  to free and turns the room into a karaoke room for two.

## 9. Phase 6 — presence, or nobody comes

- "Rooms live now" on Home and Community. Needs a small addition to the
  jam-worker: a listing DO or KV of open rooms. **Opt-in only** — a room is
  private unless the host publishes it, and only a display name and peer count
  are ever listed.
- Ambient feel, all from data the room already has: a stage-light pulse on the
  loudest singer (`jamGetInputLevel`), a "singing now" ring on peer badges
  (pitch clarity), reaction pings over the chat channel.

## 10. Order, and why

Phase 1 first — the room is empty and that is the whole problem. **Done.**
Phase 2 next, because a competitive room with a disagreeing scoreboard is
worse than no competitive room. 3 and 4 can go in parallel once 2 lands. 5
and 6 are real projects and should be re-scoped after 1-4 are in front of
users.

Risks worth naming up front: mesh cost at 12 peers is 66 connections and the
pitch rate (20 Hz per peer) should be measured before the peer cap is raised;
the DO relay has no payload auth, so nothing score-bearing may ever be
accepted from a peer; and the "shared practice room, not a live band" framing
needs to be in the copy, or the first review will be about audio latency.
