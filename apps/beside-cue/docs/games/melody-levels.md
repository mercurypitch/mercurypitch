# Melody levels — design spec (2026-08-29)

Decided with maff after the Chapter 1 playtest. Supersedes the abstract
note-jump level layout as the main lane; the mechanics library and world
primitives from [game-design.md](game-design.md) stay the toolbox.

## Decisions (locked)

- **Songs ARE the levels.** A level is a composed sequence of melody
  phrases and encounters, defined as data. The Journey world/story is the
  wrapper; Chapter 1 stays playable and gets recomposed onto melodies
  later using the same system.
- **Failure exists at every tier but is a per-level tunable.** Easy
  levels: wide tolerances, sink grace, catchable falls — easy to pass,
  hard to fail. Medium/hard: tighter feel, true voids. All of it comes
  from one config overlay, nothing hardcoded.
- **Songbook rule (copyright):** public-domain compositions and our own
  originals only, in our own arrangements. No post-1920s popular melodies
  without a license — a MIDI re-creation still infringes the composition
  right, and short recognizable hooks are the _most_ protected part.
  PD catalog gives us famous hooks anyway: Ode to Joy, Für Elise,
  Beethoven's 5th, In the Hall of the Mountain King, Habanera, the
  folk/children's canon. AI-generated audio is out for melody data
  (regurgitation risk, no ownership); melodies we compose in-repo are
  human-authored and owned.
- **V1 = sing mechanics + playability behind the InteractionDriver seam;
  tap driver lands right after.** V2 = art pass. V3 = 3D/effects if time.

## 1. Feel and physics fixes (ship first, independent)

The playtest killers, all tunable in `journey-config.ts`:

- **Release-glide filter** — a voice stopping is tracked ~200 ms into its
  collapse, dragging Merc below his platform before silence registers.
  Fix: keep a short pitch history; when silence lands, restore Merc's
  height to the median pitch over the window _before_ the release tail
  (`voice.releaseSpanMs` ending `voice.releaseTailMs` before the cut).
  Lift only — never push down.
- **Rest snap-up** — the rest search accepts platforms up to
  `land.restSnapUpUnits` (~0.25) above Merc, so silence pops him back
  onto the slab he slid under.
- **Sink-then-fall** — silence over a void first sinks slowly
  (`fall.sinkSpeed`) for `fall.sinkGraceMs`; any voiced note recovers.
  Only after the grace does the fatal fall start.
- **Catchable falls** — while `fall.catchable` and Merc is still on
  screen, a voiced note catches him mid-fall. Hard tiers can disable.
- **Direction chevrons** — pulsing up/down chevrons at Merc's position
  when the objective note is more than `hud.arrowSemis` away, while
  sinking, and while falling. Never shown for the hidden door (no
  spoilers) or the whisper passage (loudness, not pitch).

## 2. Level format (the spine)

```ts
interface MelodyDef {
  id: string
  name: string
  /** Semitones relative to the tonic, in singing order. */
  degrees: number[]
  /** Note lengths in beats (platform width; rhythm layer later). */
  durations: number[]
  /** Karaoke syllable per note (optional). */
  syllables?: string[]
  bpm?: number
}

type Segment =
  | { type: 'melody'; melody: string | MelodyDef; mode?: 'free' | 'rhythm' }
  | {
      type: 'encounter'
      kind:
        | 'gate'
        | 'wall'
        | 'bridge'
        | 'whisper'
        | 'hidden'
        | 'boss' /* kind-specific params */
    }
  | { type: 'rest'; width?: number }

interface LevelDef {
  id: string
  title: string
  /** Deep-partial overlay of JOURNEY_CONFIG — the difficulty profile. */
  feel?: unknown
  /** Play mode: 'flow' (voice is position) or 'platformer' (keys walk,
   * the voice is the jump — apex = the sung note's height). */
  control?: 'flow' | 'platformer'
  segments: Segment[]
}
```

- `compileLevel(level, groundMidi)` replaces the hardcoded `buildWorld()`
  layout: melody notes become land-platforms at degree heights (width
  from duration), syllables render under slabs, encounters map to the
  existing pane/zone/boss primitives, checkpoints at phrase boundaries.
- **Transposition:** tonic = the player's calibrated ground note, shifted
  so the melody's range fits; the pitch window derives from the melody's
  min/max instead of the fixed −3..+9.
- Bundled in `src/games/glass/levels/`; JSON-serializable so a remote
  (Cloudflare) songbook later is a fetch, not a refactor. This data
  format IS the level editor for V1.

### Play modes (2026-08-29, maff's direction)

Levels declare a control scheme; both run in the same stage engine:

- **Flow** — the original: the voice IS Merc's height, silence rests.
- **Platformer** — arrow keys / touch pads walk; the voice is the jump.
  The jump's apex is the sung note's height, so a higher note is a
  higher, longer leap, and the note that exactly reaches the next
  platform is that platform's own note — intervals become distances,
  melodies stay the path. Standing on a platform lights it (the sung
  jump was the skill); a big leap that lands AHEAD advances through the
  skipped land nodes, but panes still gate. Tryout level: **Jump
  Trials** on the games list; tunables in `JOURNEY_CONFIG.control`.

## 3. Educated playability

- **Note ribbon:** the upcoming melody drawn as a flowing contour through
  the world; platforms sit on it; syllables karaoke-style; note names
  above (exists); per-note guide hum (exists) plus a phrase-replay
  control.
- **Beginner mode is tempo-free:** the dwell system already lets a
  learner take each note as slowly as they need. Rhythm is a later
  difficulty layer and the heart of tap mode.
- Optional low-volume key-anchor drone behind the singing — OFF by
  default until a real-device echo-cancellation test (speaker bleed can
  confuse the tracker). Full musical backing belongs to tap mode, where
  the mic is off.

## 4. Driver seam

Extract sing input into `drivers/sing.ts` behind the `InteractionDriver`
interface from [input-modes.md](input-modes.md) — no behavior change —
then the tap driver (beat clock, tap-to-hop, haptics, latency
calibration) drops in after V1 core.

## 5. V1 songbook

1. **Ode to Joy** — five-note range; gate pane on the dominant between
   phrases.
2. **Twinkle Twinkle** — the sixth leap + repeat-notes.
3. **Frère Jacques** — faster contour, round structure.

Next candidates: Für Elise (semitone-neighbor control), In the Hall of
the Mountain King (accelerating chase/boss), Habanera (chromatic
descent), plus maff's original melodies as data.

## 6. Testing

- `compileLevel` is pure → vitest units: segment layout, transposition,
  window fit, feel overlay merge.
- Synthetic-voice E2E per level: happy-path sing-through; glide-release
  regression (sing, release with a downward tail → snap-up rest, not a
  fall); sink-recovery; mid-fall catch.

## Out of scope for this pass

Art pass (V2), 3D (V3), backing tracks (pending device test), listen
mode, editor UI, remote songbook fetch, VO wiring.
