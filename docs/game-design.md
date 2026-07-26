# Break Glass — game design v2 (mechanics-first, 2026-07-25)

Rewritten after playtest feedback: the game cannot be "sing at a glass until
it breaks" — one verb, played once, forgotten. This doc is the mechanics
brainstorm + the Merc's Journey frame, developed for later implementation.
Meta systems (stars, energy) are DEFERRED — fun first, wrappers later.

## The core insight

The voice is a **continuous controller**, not a button: pitch (Y over time),
volume, glide speed, vibrato, onset. Every mechanic below weaponizes a
different vocal skill — which is simultaneously a replayable skill ladder
and literal vocal training (the MercuryPitch brand promise in disguise).

Engine status: pitch stream, resonance rise/decay, fatigue cracks,
per-singer calibration, epicness-scaled shatter all EXIST (`src/lib/glass/`).
Most mechanics below are new target functions + small state machines on top.

## Part 1 — Mechanics library (arcade encounters)

Grouped by the vocal skill they train:

### Accuracy & tracking
1. **Living targets** — the resonant note MOVES: drifts, wobbles, flees;
   chase it with glides. Ice's note sinks as it "melts". Static hold → action.
2. **Find the frequency** — several glasses on stage, one secretly resonant:
   sweep your voice like a dial until one rings. Discovery gameplay;
   teaches pitch exploration. (Both: target = f(t)/hidden — tiny engine change.)

### Agility & memory
3. **Unlock melodies** — the object hums a 3–5 note phrase; sing it back to
   arm the shatter (Simon-says). Vase's 2-note idea generalized.
4. **Voice corridor** — your pitch line threads gates / dodges hanging shards
   to reach the object (flappy-with-pitch). Pure agility.

### Power & control
5. **Overcharge** — at shatter-ready, keep holding to grow the burst
   multiplier; one drift dumps it (press-your-luck).
6. **Crescendo / whisper** — grow volume without pitch drift; or break the
   "sleeping" glass quietly (low-volume accuracy — hard and trainable).

### Composition (bosses)
7. **The Chandelier** — break N notes in sequence while earlier pieces
   re-anneal if you're slow (hunt + sequence + sustain in one fight).
8. **Merc duets** — call-and-response; later harmony (sing a third above).

## Part 2 — Merc's Journey (voice-platformer frame) — maff's direction

Merc (the mercury orb) travels through a cosmic world of **crystal/glass
platforms**, and the VOICE moves him:

- **Pitch = height.** Singing higher lifts Merc; lower notes let him sink;
  silence = gentle fall. Sustained accurate notes = stable hover/glide
  across gaps. (Novel vs. existing scream-games: they use VOLUME; we use
  PITCH ACCURACY — singing, not shouting.)
- **Platforms are notes.** Each platform rings at its own pitch; landing/
  staying on one means holding near its note. Melodic stairways = literal
  scales the player climbs (C-D-E-F...) — scale practice AS level design.
- **Task gates along the path:**
  - A glass WALL blocks the way → resonance-shatter it (mechanics #1/#5).
  - A chasm → sing the bridge's melody and steps crystallize one per note (#3).
  - A sleeping guardian → whisper-mode stealth section (#6).
  - A locked door → find-the-frequency among decoy panes (#2).
  - Boss arenas → Chandelier-class fights (#7).
- **Failure is thematic:** miss the task / drift too long and the crystal
  platform UNDER MERC cracks (same fatigue-crack visuals, inverted) and
  SHATTERS — Merc falls through in slow-mo → game-over screen built from
  the shatter cinematic itself. The game's signature moment used against you.
- **Checkpoints** at "tuning forks" (Merc re-tunes = calibration woven into
  fiction — recalibration IS a story beat, not a menu).
- **World theme:** Sing the Universe — climb from a bedroom's shelf of
  glasses up through cosmic stages (Orion platforms, pulsar rhythm sections,
  the black-hole B♭ finale). Ties into the existing brand set pieces.

## Part 3 — Product shape & build order

**Shape:** Journey = the campaign (Merc, platforms, gates, game-over);
Arcade = quick-play (today's level map: pick a material, break it, share).
Journey encounters ARE the Part-1 mechanics — one engine, two frames.

**Prototype order (each step playable):**
1. **Living target + find-the-frequency** in the current arcade shell —
   smallest change, transforms feel; validates "voice as action controller".
2. **Pitch-height control demo**: Merc dot riding the pitch line over 2–3
   platform notes → proves the platformer core in the existing renderer.
3. **Melody gate** (#3) as an arcade mode + journey gate.
4. **One journey slice**: 3 platforms → wall → shatter → gap-bridge →
   fail-state platform-shatter → game over. The vertical slice of Part 2.
5. Boss (#7), overcharge (#5), whisper (#6) as content afterward.

**Deferred meta:** stars, energy/paywall triggers, leaderboards — reattach
after the fun is proven. Monetization gate (locked earlier, unchanged):
free = 3 arcade materials + journey chapter 1; Pro = all materials,
full journey, bosses. Pro fail-states stay (Diamond/bosses can be lost).

## Input modes (Sing / Tap / Listen)

The adventure is playable three ways — voice (pitch), taps (rhythm game),
or hear-and-answer (ear training with contour gestures: swipe up/down for
slide direction, zigzag for vibrato). Same stages, one `InteractionDriver`
seam, modes never paywalled. Full spec: [input-modes.md](input-modes.md).

## Implementation notes

- Moving/hidden targets: `computeTarget` result becomes `targetMidi(t)`
  (function of rep-time) + a `revealed` flag; resonance code reads the
  instantaneous target — localized change in `resonance.ts`/`GlassApp`.
- Melody gates: sequence state machine over the existing note-lock events
  (`note-state-machine.ts` already yields stable-note events).
- Pitch-height: Merc sprite Y ∝ smoothed cents within a 2-octave window
  (one-euro filter already in `pitch-pipeline/`); platforms = target bands.
- Platform-shatter fail: reuse `GlassRenderer.shatter()` with camera on the
  platform; game-over overlay after `computeShatterTimeline`.
- All of it stays offline/on-device — no new backend.
