> Ported from the standalone Break Glass branch (feat/shipaton-glass-game).
> The game now lives in apps/beside-cue/src/games/glass; file paths below
> that mention src/features/glass refer to the original branch layout.

# Break Glass — three ways to play (input modes)

Planned 2026-07-25 (maff's direction): the adventure must be playable by
people who don't sing (yet). Every stage supports three input modes — the
same world, three musicianship skills. Never label modes easier/harder;
label them by the skill they train:

| Mode       | Skill trained              | Input                            |
| ---------- | -------------------------- | -------------------------------- |
| **Sing**   | Pitch production           | Voice (current game)             |
| **Tap**    | Rhythm & timing            | Taps on the beat                 |
| **Listen** | Ear / pitch discrimination | Hear → tap or gesture the answer |

Mode is chosen on level entry ("How do you play today?") with a persistent
default; switching is always allowed between runs. All three modes count
toward the same progression. Accessibility is never paywalled — modes are
available to free users (also the Peace Prize / social-good story).

## Tap mode — the rhythm game

Each stage gets a tempo (BPM + metronome pulse; platforms glow on the beat).

- **Traversal:** platforms pulse; tap ON the beat to hop Merc to the next
  platform. Off-beat = stumble (no progress); repeated misses on glass
  crack it, same rules as resting too long.
- **Bridge steps:** rhythm echo — the step plays a short pattern
  (ta · ta-ta), player taps it back to crystallize the step. (The rhythm
  twin of the melody echo.)
- **Gate/wall panes:** a tick pattern approaches the pane (simplified
  rhythm-lane); each correctly timed tap adds resonance, misses decay it.
- **Feel:** haptics on every beat (Capacitor haptics already wired) +
  tap flash. Timing window ±90 ms (configurable), judged against the
  AudioContext clock.
- **Latency calibration:** one-time tap-to-the-beat screen stores a per-
  device audio-input offset (WebView audio latency on Android demands it).

## Listen mode — ear training + gestures

Merc plays sounds; the player answers by tapping or gesturing.

- **Traversal:** the next platform's note plays against a decoy —
  "which platform matches what you heard?" Tap the right one to hop.
  Difficulty scales the interval down: octave → fifth → third → semitone.
  V1 SHIPPED (2026-08-30) — see Phasing C.
- **Contour gestures:** a phrase plays and the player answers with a
  gesture: swipe **up** (slide rose), swipe **down** (slide fell),
  **zigzag** (vibrato), **long-press** (steady note). Recognizer is
  simple geometry: dy sign, direction reversals count, hold duration.
- **Bridge:** hear the 3-note phrase, then tap the three steps in the
  heard order (melodic memory).
- **Gate/wall:** interval questions charge the pane — each correct answer
  adds resonance, wrong answers decay it; a streak triggers the burst.
- This is the listening half of the MercuryPitch brand (the real
  "tone-deaf test" the web playbook said doesn't exist yet — here it is,
  as a game).

## Engine seam (how this stays one game)

Stages stay single-source (platform/pane/bridge layout). Each input mode
is an `InteractionDriver` — the shape that SHIPPED (2026-08-30,
`src/games/glass/drivers/types.ts`, sing implementation in
`drivers/sing.ts`, stage engine consumes only the interface) is
input-normalizing rather than world-event-emitting — the runtime keeps
the game rules, the driver owns the hardware:

```ts
interface InteractionDriver {
  start(): Promise<void> // acquire hardware (throws when unavailable)
  stop(): void
  latestPitch(): PitchSample | null // continuous channel, polled per tick
  latestLevel(): number // input level (whisper mechanic)
  drainIntents(): DiscreteIntent[] // queued taps/answers, AUDIO-clock stamped
  ctx(): AudioContext | null // shared clock + game sound output
}
```

Discrete intents carry `AudioContext.currentTime` timestamps (the
conductor rule) so the tap judge never depends on frame time.

World state, camera, Merc rendering, glass integrity, void/fall, retry,
scoring — all shared. Stars unify as accuracy% per mode.

## Phasing

- **A. Driver seam:** refactor JourneyPrototype's sing logic into
  `drivers/sing.ts` behind the interface (no behavior change). DONE
  (2026-08-30) — mic/F0 lifecycle, voiced gating, and level reads all
  live in the driver; the engine holds one `driver` handle.
- **B. Tap driver:** beat clock + tap windows + pulse rendering + haptics +
  latency calibration screen. V1 SHIPPED (2026-08-30):
  `drivers/tap.ts` (no mic; pointer/space taps queued on the audio
  clock), `compileLevel` mode `'rhythm'` (near-adjacent slabs — geometry
  IS the beat axis; encounters become rests), runtime rhythm branch
  (road scrolls at `MelodyDef.bpm` or `tap.bpmDefault`, count-in ticks,
  x-window judgment, hit hums the note + haptic tick, missed slabs light
  late so the song never stalls), approach-ring pulse rendering, "Tap
  the line" on every songbook card. The ground note comes from the last
  sing calibration (persisted). The tap tuner SHIPPED (2026-08-30):
  "Tap timing — Tune it by tapping" on the games list plays
  `tap.calBeats` metronome ticks on the audio clock; taps anywhere on
  the card are stamped with `AudioContext.currentTime`, and the median
  signed tap-vs-nearest-tick offset (wild taps dropped, minimum-count
  guard, clamped — `tap-latency.ts`, pure + tested) persists per device
  and overrides `tap.inputLatencyMs` in the rhythm judge. Fail state
  SHIPPED too: `tap.maxMisses` per level ends the run ("The beat ran
  ahead."), and a rhythm retry rebuilds the road with a fresh count-in.
- **C. Listen driver:** question engine + gesture recognizer + answer UI.
  Traversal V1 SHIPPED (2026-08-30): "Hear the line" on every songbook
  card compiles the level in mode `'listen'` (encounters become rests)
  and reuses the tap driver — no mic, taps carry client coords. The
  game hums the next note (`listen.promptSeconds`, plays even with
  sounds off — it IS the question); the active slab and one decoy (the
  nearest other slab within `listen.decoyMaxSemis`, min one semitone
  apart) render identically as dashed outlines with a question mark —
  no visual giveaway, and unlit note-name labels stay hidden. Tap the
  heard slab: Merc hops, the note lights and rings. Tap the decoy: a
  shake, then the prompt replays. Tap elsewhere: throttled replay
  (`listen.replayGapMs`). Merc walks himself to the last lit slab, so
  the road keeps its geography. Still open from C: pane questions
  charging gates, contour gestures, the 3-note bridge memory.
- **D. Mode select on level entry** + per-mode bests; Merc VO lines per
  mode (extend the voiceover manifest with tap/listen guide lines).

Config: all timing windows, intervals, BPM ranges, and gesture thresholds
join `journey-config.ts` under `tap:` and `listen:` sections when built.
