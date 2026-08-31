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

## Architecture — three layers and a runtime (2026-08-30, implemented)

What the player must sing is kept apart from how it is played, and from
where the input comes from:

1. **Level (content)** — `src/games/glass/levels/types.ts`. Degrees,
   durations, syllables, encounters. Pure JSON data; knows nothing about
   pixels, physics, or input. The data format is the editor; a remote
   songbook is a fetch, not a refactor.
2. **Mode (mechanics)** — how content becomes play: flow (voice is
   position), platformer (voice is the jump), later rhythm (beat-timed)
   and listen (ear-training questions, no stage).
   `compileLevel(level, { mode, groundMidi })`
   (`levels/compile.ts`, pure, unit-tested) is the bridge: one level
   compiles for any mode, only pacing geometry changes
   (`JOURNEY_CONFIG.melody`), and the pitch window derives from the
   melody's range.
3. **Driver (controller)** — where input comes from: voice pitch, taps,
   answer picks. Seam specced in [input-modes.md](input-modes.md);
   drivers emit normalized intents (continuous signals are polled,
   discrete events are queued with AUDIO-clock timestamps so the later
   beat judge never depends on frame time).
4. **Runtime** — the stage engine (`JourneyPrototype.tsx`) consumes
   compiled stage + mode rules + driver input and does the Merc math.
   Listen mode gets its own small runtime behind the same seams.

Named prior art, deliberately followed: osu!lazer's ruleset system (one
beatmap, many rulesets, an `IBeatmapConverter` per ruleset — our
`compileLevel`) and StepMania's one-song-many-charts model; from the
game-patterns canon: data-driven content, Command (driver intents),
State (the phase machine), Update Method (the tick), and the rhythm
conductor (audio clock as time authority). Deliberately NOT adopted:
ECS (a handful of entity kinds does not warrant it) and a Strategy
object for mode rules while only two stage modes exist — the paying
seams are data→stage and input→events; the tick keeps its two branches
until a third stage mode earns the abstraction.

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
- **Transposition (range fit, shipped 2026-08-30):** the song's range is
  CENTERED on the calibrated ground note (`melody.centerRange`): the
  melody's midpoint lands on the hummed note, so a 0..+9 tune becomes
  −5..+4 around the voice. A persistent "Songs sit: Lower / Centered /
  Higher" setting on the games list biases the shift by
  `melody.rangeBiasSemis` either way. The pitch window derives from the
  shifted range (always still containing the ground note). The guided
  range-finder (shipped 2026-08-30) sets the bias from a MEASURED range:
  "Find it by singing" on the games list asks for a comfortable note,
  then the lowest, then the highest — a steady-note detector locks each
  (hold `rangeFinder.holdMs` within `tolSemis`; silence between steps so
  one held note cannot lock twice; logic in `range-finder.ts`, pure and
  unit-tested) — and the bias becomes where the measured range's center
  sits relative to the comfortable hum (`computeRangeFit`, clamped to
  `rangeFinder.clampSemis`), through the same `rangeBias` seam. The fit
  persists with the raw range and shows as a "fitted +N" chip; the three
  presets still override it.
  The STARTING slab sits at the song's first note (not the hummed note),
  ready-lit and captioned "start" — Merc begins standing on the melody's
  opening pitch and steps forward into it; the hummed note anchors only
  the transposition.
- **Feel overlays (shipped 2026-08-30):** `applyFeel` (`levels/feel.ts`)
  merges `LevelDef.feel` — a deep-partial `JOURNEY_CONFIG` in widened
  types — over the defaults when the stage builds; untouched sections
  are shared by reference, arrays replace wholesale, and the defaults
  are never mutated. `compileLevel` takes the merged config too, so
  pacing geometry is per-level. In the songbook: Twinkle plays forgiving
  (wider band, longer sink grace), Frère tighter (quicker dwell, shorter
  grace, narrower tap window), Ode on plain defaults.
- Bundled in `src/games/glass/levels/`; JSON-serializable so a remote
  (Cloudflare) songbook later is a fetch, not a refactor. This data
  format IS the level editor for V1.

### Play modes (2026-08-29, maff's direction)

Levels declare a control scheme; both run in the same stage engine:

- **Flow** — the original: the voice IS Merc's height, silence rests.
- **Rhythm** (shipped 2026-08-30) — the tap driver's mode, no mic: the
  road scrolls at tempo, a tap as Merc crosses each slab lands the note
  and hums it — the taps perform the song. Encounters compile to rests;
  misses light late (V1 forgiving). Tunables in `JOURNEY_CONFIG.tap`.
- **Platformer** — arrow keys / touch pads walk; the voice is the jump.
  The jump's apex is the sung note's height, so a higher note is a
  higher, longer leap, and the note that exactly reaches the next
  platform is that platform's own note — intervals become distances,
  melodies stay the path. Standing on a platform lights it (the sung
  jump was the skill); a big leap that lands AHEAD advances through the
  skipped land nodes, but panes still gate — and an intact pane is a
  physical glass wall (`control.paneBlockUnits`): no jumping past a
  lock, walking or airborne, until it is sung open. Panes charge by
  PROXIMITY here (`control.paneChargeUnits`), not by node order — press
  near the glass and sing its note; once burst, an open wall no longer
  blocks progression or completion. Voice-driven vertical speed is
  capped (`control.liftMaxPerSec`) so a really high note is a big leap,
  not an instant one. Platforms are one-way
  FLOORS: a lower note can never sing Merc through the slab he stands
  on (walking off the edge is the only way down), landing catches any
  downward crossing of a top within `control.footUnits` of overhang,
  and the release-glide filter applies here too so a stopping voice
  cannot drag him past the settle range. The camera pans vertically
  (`control.camCenterY` / `camAirBand` / `camYLerp`): standing re-centers
  Merc with equal air above and below, airborne the view follows only
  near the screen edges — no per-jump yank — and the pan clamps between
  the baseline framing and centering the highest platform. Flow mode
  keeps its fixed window (the pitch ruler is the frame). Tryout level:
  **Jump Trials** on the games list; tunables in
  `JOURNEY_CONFIG.control`.

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
   phrases. SHIPPED (`levels/ode-to-joy.ts`): both phrases with solfege
   syllables, playable from the games list in both modes ("Sing the
   line" / "Jump the line"); E2E-cleared end to end in flow and
   smoke-tested in platformer.
2. **Twinkle Twinkle** — the big do→sol leap + repeat-notes. SHIPPED
   (`levels/twinkle-twinkle.ts`): verse–middle–verse with the English
   lyric as syllables.
3. **Frère Jacques** — faster contour, round structure. SHIPPED
   (`levels/frere-jacques.ts`): matines eighth-note run, and the first
   window that dips below the ground note (ding DANG dong at −5).

4. **Für Elise** — semitone-neighbor control. SHIPPED
   (`levels/fur-elise.ts`): the E–D# oscillation as mi–ri trills, the
   low arpeggio answer, tightened landing band via `feel`.
5. **In the Hall of the Mountain King** — the accelerating chase.
   SHIPPED (`levels/mountain-king.ts`): the theme three times with the
   note durations scaled 1 → 0.85 → 0.7 (geometry is time — the road
   itself accelerates), one air-relift, generous tap misses; per-level
   `melody.minWidth` keeps sub-beat slabs honest in rhythm play.
6. **Habanera** — the chromatic descent. SHIPPED
   (`levels/habanera.ts`): l'amour's half-step slide down, a gate on
   the dominant BELOW the ground note, the "prends garde" reprise.

Next: maff's original melodies as data.

## 6. Testing

- `compileLevel` is pure → vitest units: segment layout, transposition,
  window fit, feel overlay merge.
- Synthetic-voice E2E per level: happy-path sing-through; glide-release
  regression (sing, release with a downward tail → snap-up rest, not a
  fall); sink-recovery; mid-fall catch.

## 7. Art pass (2026-08-30, V2 started)

- **Melody ribbon** (`art.ribbon*`): the upcoming contour drawn as one
  flowing curve through the next platforms — the tune's shape visible
  before it is sung. Sung modes only; rhythm has the approach rings.
- **Beat pulse** (`art.beatPulse*`): in rhythm play every slab's top
  edge breathes with the beat once the road rolls.
- **Karaoke underline**: the active syllable carries an accent
  underline — the bouncing ball of this karaoke.
- **Stage themes** (`themes.ts` + `public/games/journey/themes/`):
  four looks over one game — Cosmos (painterly default), Neon (retro
  synthwave arcade), Daylight (clean light minimal), Inkwash (elegant
  sumi-e). Each theme is an asset directory (sky/nebula/dust parallax
  layers + stone/crystal tiles, generated: Gemini image gen for
  Daylight and Inkwash, GPT-5.6-sol imagegen for Neon; sources under
  `~/agent-out/beside-cue-games/2026-08-30/themes/`) plus a full draw
  palette (`StagePalette` — every meaningful stage color). Merc's own
  sprites never change; he is the brand. Picker: "Stage look" on the
  games list, persisted per device. Direction from 2026 mobile
  rhythm-game practice: clean-minimal readability, neon retro, and
  painterly atmospheric are the three winning families; the final
  default gets picked after device playtests.

## 8. Score and learning path (maff 2026-08-30; score V1 SHIPPED)

Passing a level should not mean "barely reached the end". Each run gets
a perfection score per mode, and clearing means landing in roughly the
70–80% band — that threshold is what turns the songbook into a
learning path later: the next song unlocks by demonstrated control,
not by crossing the finish line once.

Score V1 SHIPPED (`score.ts` pure + tested; engine collects a
`RunTally`): per-note quality 0..1 —

- **sung**: time-weighted mean cents-off while the note is held in
  band, mapped `centsPerfect`(10¢)=1 → `centsZero`(70¢)=0; falls cost
  `fallPenaltyPct` each;
- **rhythm**: `1 − |offset|/windowMs` per tap, misses score 0;
- **listen**: `1 − wrongPicks × listenWrongPenalty` per question.

Run score = mean × 100; pass band `passPct` 75, polished `greatPct`
90 (all in `journey-config.score`, feel-overridable). Folded from the
ear-training research: the card LEADS with a real unit ("about 14¢
off target", "median 21 ms off the beat", "9 of 11 first-try") — real
units stay comparable across months, and once difficulty adapts, a
percent alone stops meaning anything (the research's "never show a
number your own adaptation pins in place"). Per-song-per-mode bests
persist on device and show on the mode buttons. The card also carries
a simple shareable grade (maff 2026-08-31): gold >= greatPct, silver

> = passPct, bronze >= `bronzePct` (55) — the `.jp-grade` chip; below
> bronze the card just shows the units. NOT YET: gating (the
> learning path itself), stars, tempo credit for sung modes, and the
> Elo/threshold rulers for when levels stop being static.

## 9. Workshop verbs (2026-08-31, SHIPPED)

One new mechanic per song/world (maff's verb-rollout call, research
doc §8a). The first workshop, **The Glassworks** (`the-glassworks.ts`,
chip "Workshop", first card in the songbook), strings all three new
verbs into one short do-mi-sol melody so each is met once:

- **Resonance Ring** (pane `kind: 'ring'`): hold the pane's note to
  raise resonance to `ring.holdCap` (0.55) — past the cap only
  _vibrato_ pumps it the rest of the way (`ring.pumpMs`, strength from
  the detector; `pumpTolBonus` widens tolerance while ringing so the
  wave can't fall out). Teaches deliberate vibrato as a verb, not a
  penalty.
- **Steady Beam** (`BeamZone`): a light-bridge with no floor — while
  the voice holds the beam note in band, Merc is carried across; the
  band's drawn thickness tracks pitch variance (`beam.varThinCents`),
  wobble past `flakeCents` sheds glass flakes. Cents collected across
  the crossing score the node like any sung note. Platformer compiles
  it to a stone bridge; rhythm/listen to a rest.
- **Improv Atrium** (`AtriumZone`): no platforms — any _in-scale_ note
  (quantized within `atrium.snapSemis`, held `stableMs`) spawns an
  ephemeral glass step ahead of Merc (`stepTtlMs` 7000, `maxSteps` 14,
  oldest fades). **The steps ARE the floor**: Merc walks only as far as
  his furthest live step (`stepReachBack` behind its edge), and only
  while the voice is in key — silence or a stray tone stops him where
  he stands. The room draws every scale degree as a named rung and
  labels itself, so it reads as a keyboard rather than empty dashed
  space. Crossing scores as the in-key share of voiced time
  (`inKeyFullRatio` 0.7 already earns full marks — improv means some
  searching is free). Flow only — every other mode has a floor of its
  own and compiles the room to a rest.

All knobs in `journey-config` (`ring`, `beam`, `atrium`, `vibrato`).
The vibrato detector (`vibrato.ts`, pure + tested) needs fractional
pitch: this pass fixed the sing driver, which had been rounding
`latestPitch().midi` to whole semitones (`centsToMidi`) — that also
un-quantizes sung cents-scoring. 3D-next (research §8a): Standing
Wave Chamber + Detuned World are earmarked as the 3D showcase.

## Out of scope for this pass

3D (V3), backing tracks (pending device test), listen pane questions
and gestures (fan traversal shipped — input-modes.md), editor UI,
remote songbook fetch, VO wiring, score-based gating (§8's second
half).
