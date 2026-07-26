# Break Glass — three ways to play (input modes)

Planned 2026-07-25 (maff's direction): the adventure must be playable by
people who don't sing (yet). Every stage supports three input modes — the
same world, three musicianship skills. Never label modes easier/harder;
label them by the skill they train:

| Mode | Skill trained | Input |
|---|---|---|
| **Sing** | Pitch production | Voice (current game) |
| **Tap** | Rhythm & timing | Taps on the beat |
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

Stages stay single-source (platform/pane/bridge layout). Each mode is an
`InteractionDriver` that consumes stage data + raw input and emits the same
world events the sing driver emits today:

```ts
interface InteractionDriver {
  mode: 'sing' | 'tap' | 'listen'
  attach(stage: StageData, world: WorldEvents): void  // land(node), charge(pane, amt), stumble(node), answer(q, ok)
  dispose(): void
}
```

World state, camera, Merc rendering, glass integrity, void/fall, retry,
scoring — all shared. Stars unify as accuracy% per mode.

## Phasing

- **A. Driver seam:** refactor JourneyPrototype's sing logic into
  `drivers/sing.ts` behind the interface (no behavior change).
- **B. Tap driver:** beat clock + tap windows + pulse rendering + haptics +
  latency calibration screen.
- **C. Listen driver:** question engine + gesture recognizer + answer UI.
- **D. Mode select on level entry** + per-mode bests; Merc VO lines per
  mode (extend the voiceover manifest with tap/listen guide lines).

Config: all timing windows, intervals, BPM ranges, and gesture thresholds
join `journey-config.ts` under `tap:` and `listen:` sections when built.
