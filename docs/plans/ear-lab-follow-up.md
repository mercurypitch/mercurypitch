# The Ear Lab — the rest of the catalogue

Follow-up to PR #404 (merged 2026-08-28). One branch, one PR, one commit per
item, stacked; a second PR only for code that does not touch the Ear Lab.
Founder decisions, taken 2026-08-28 before the work started:

| Decision                  | Taken                                                                                                                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| In The Wild               | The user's own UVR-separated songs. Three item types: Bassline (root motion), Home in the Wild (the degree a vocal lands on), Echo in the Wild (a vocal phrase back). Own rating tracks, never the Column. |
| The mixing desk           | Colour, Weight, Critique — on the user's separated song when one exists, on the house loop otherwise. Rendered offline in the browser; no bundled audio.                                                   |
| The Ear Path              | A milestone path inside the bench. Orbs mark progress and point at the next drill; nothing is locked.                                                                                                      |
| Echo and Span answer mode | Tap and play first; sing mode follows in the same PR, on the existing pitch pipeline (a windowed phrase scorer on the count-in grid — not a new tracker).                                                  |
| Order                     | Free — the seams first, the catalogue next, the two big sections after, the path once there are milestones to mark, the polish last.                                                                       |

## Naming, settled

`src/lib/ear/drills.ts` is the catalogue and wins over the rhythm spec's
working names:

- **Pulse** (`pulse`, Time) is rhythm dictation — clap it back. The rhythm
  spec's "Echo — clap it back" is this drill.
- **Echo** (`echo`, Shape) is melodic dictation — tap, play or sing the phrase
  back. **Span** (`span`, Shape) is Echo with the phrase growing one note at a
  time; its reading is notes held.
- The rhythm spec's "Pulse — hold the beat" is not a drill: the readiness
  panel's Tap check already is that measurement in miniature, and Drift
  covers tempo perception.

## The order, and what each commit carries

1. **This plan.**
2. **Pulse.** Three to six onsets on one click voice after a four-click
   count-in; the player taps them back on the `TapPad`. `PULSE_TIMING` in
   `timing.ts`; a bank of patterns at frozen difficulty (onset count × the
   finest subdivision); an onset is met when a tap lands inside the item's
   tolerance tier, in order — an extra tap or a missed onset fails the item.
   Reading on the bench: the finest subdivision cleared at 75%, shown as a
   note value (Elo-derived tier). Instrument: Contour's drum with the onsets
   as ticks and the taps drawn under them at the reveal. Round trip comes off
   every tap through `createTapLedger`; "unmeasured" disables Calibration for
   it, practice stays open and is marked raw. Joins `SPRINT_DRILL_IDS`,
   `VIEW_FOR_DRILL`, the instrument row, the tour, the audit, the testing doc.
3. **Echo and Span.** A cadence plants the key, a phrase sounds, the player
   answers on a degree keyboard (seven pads, octave-aware) or the on-screen
   keys; each note must match in order. Echo: phrases of 3–6 notes from a
   bank at frozen difficulty (length × largest leap), Elo. Span: one drill on
   `useThresholdRun` with the catalogue's linear staircase on length
   (`start 3, min 2, max 16, harderIs 'higher'`), the phrase drawn fresh each
   trial. Instrument: a chain of beads on the drum, one per note, lit as they
   sound and coloured at the reveal.
4. **Beat Hunt and Drift.** Threshold drills on `useThresholdRun`. Beat Hunt:
   two dyads, one detuned by the staircase's level in cents — which is out of
   tune (2AFC); instrument: two pendulums drifting out of phase, the beat
   rate shown only at the reveal. Drift: a click train that changes tempo by
   the level in percent (or does not) — did it drift, up or down (3 choices);
   instrument: a metronome column that leans at the reveal.
5. **Gravity and The Pull.** `use-home-controller` grows a degree set: the
   diatonic seven (Home) or the chromatic twelve (Gravity, rated under
   `gravity`, 12 pads). The Pull: two degrees sound over the planted key —
   which wants to move more; the answer is the tendency table (7→1, 4→3,
   6→5, 2→1 outrank the stable 1, 3, 5), pairs drawn from a bank of the
   distinct comparisons, Elo with a 1/2 guess floor.
6. **Cadence and Bassline.** Cadence: a progression from
   `src/lib/guitar/chord-progression.ts` voiced on the guitar synth in a roved
   key — name it in Roman numerals (4 pads drawn from the eight
   progressions). Bassline: root motion only — a bass line of four roots over
   a held tonic; answer the degrees in order on the seven pads (a bank of
   motions at frozen difficulty). Instruments: a gear train for the
   progression, the pendulum jar's scale for the bass roots.
7. **Subdivide.** A drum pattern on `drum-voices.ts` in 3/4, 4/4, 5/4, 6/8 or
   7/8 with the accent on one — name the metre (4 pads per item) or, in the
   odd metres, tap where beat one falls. Elo; instrument: the lattice with
   the accent lamp.
8. **Sing mode for Echo and Span.** `src/lib/ear/phrase-score.ts`: the
   expected notes have scheduled windows on the count-in grid; the median f0
   of voiced frames in each window (from `createF0Stream`, the way Home
   listens) names the sung note; a note counts when it is within 60 cents of
   the target, in order. Rated under `echo-sing` / `span-sing` with no guess
   floor, item difficulties untouched — the same separation Home keeps
   between ear and voice.
9. **In The Wild — the Field Book.** A bench section listing the user's
   UVR sessions (vocal + instrumental; the bass part when a stem split has
   run). On first open a song is read once: the vocal stem through
   `detectNotes` (`midi-generator.ts`), the key through `detectKeyFromNotes`,
   the instrumental through `computeNNLSChroma` + `detectChords`; the items
   are cached per session. Bassline in the Wild: consecutive chord roots →
   "the root moved from I to ?"; Home in the Wild: a sustained vocal note →
   the excerpt ending on it → "which degree did the voice land on?"; Echo in
   the Wild: a vocal phrase of 3–6 detected notes → tap or play (or sing) it
   back. Rated under `wild-bassline` / `wild-home` / `wild-echo`; the items
   are the user's own songs, so no item difficulties are refined and nothing
   marks the Column. Empty state points at Karaoke Night's upload.
10. **The mixing desk.** Source: the user's separated song (vocal +
    instrumental summed) when a session exists, else the house loop — a
    drum-machine pattern, guitar-synth chords and a bass line rendered once
    on an `OfflineAudioContext`. Each trial renders the excerpt through the
    fault under test, offline. Colour (threshold, dB): which octave band was
    boosted — six bands, the boost shrinking by the catalogue's staircase.
    Weight (threshold, dB): two renders, which carries the heavier low end
    (low shelf below 120 Hz, 2AFC). Critique (Elo): name the fault — mud
    (250 Hz), box (500 Hz), harsh (3 kHz), sibilance (8 kHz), pumping
    (compressor), narrow (mid only) — from a bank at frozen strengths.
    Readings sit on the desk's own plate; the Index is unchanged by them.
11. **The Ear Path.** A going train of orbs on the bench: first reading,
    first Calibration seal, each faculty's first calibrated reading, the
    first rhythm take, the first Field Book take, the first desk reading,
    thirty days of regulation. Lit from the store; the next dark orb links
    to its drill. No drill is ever locked.
12. **Polish.** `ear-lab.html` entry page with its own card
    (`scripts/generate-ear-lab-og.mjs` → `public/ear-lab-og.png`, the
    entry-page test's list extended), and the tab icon — the Regulator's
    pendulum jar in place of the thermometer.

Every commit: unit tests for the engine and the stage, the testing doc's
section, the audit script walking the new stage on phone and desktop, the
tour where a new section appears, `pnpm check`, `pnpm run pr:validate`, the
agent index regenerated.

## Invariants the follow-up must not touch

From the handoff (§4 of `docs/plans/ear-lab-handoff-2026-08-09.md`): no
percent on screen; only Calibration marks the column; mic answers never
update item difficulties; difficulties freeze at 200 attempts; pacing lives
in `timing.ts`; Stop cancels the run; Ear Lab drills stay out of
`ExerciseType`. New here: the Field Book and the desk read on their own
plates and never move the Index.

## Log

| Date       | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-28 | Item 1 — the four supporter rooms published to dev from the `v6` pack (`sync-dev.mjs --apply --publish`, 12 variants verified, receipt `receipts/dev-2026-08-27T23-34-25-373Z.json`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-08-28 | Item 2 — Pulse: `PULSE_BANK` (12 patterns), `PULSE_TIMING`, `lib/ear/rhythm-take.ts` (finest grid → tolerance, the take judged in order, the rung the rating clears), `RhythmDrum`, `PulseDrill`; in the sprint, the strip, the audit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-08-28 | Item 3 — Echo and Span: `lib/ear/phrase.ts` (degrees, the judge, the random walk), `ECHO_BANK` (14 phrases), `ECHO_TIMING` / `SPAN_TIMING`, `BeadChain`, the `PhraseConsole` ladder (`answerConsole` on `IdentificationDrillView`), `EchoDrill` on the controller, `SpanDrill` on the staircase; in the sprint, the strip, the audit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-08-28 | Item 4 — Beat Hunt and Drift: `lib/ear/beat.ts` (detune, beat rate, drift onsets, the three ways), `dyad-synth.ts` (two sines at a random relative phase, so loudness is no clue), `BeatPendulums`, `MetronomeColumn`, both drills on the staircase; in the sprint, the strip, the audit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-08-28 | Item 5 — Gravity and The Pull: `DegreeSet` in `item-bank.ts` (`HOME_SET`, `GRAVITY_SET`, `degreeLabel`), the Home controller, detector and drill parameterised on it, `GravityDrill` as Home over the twelve; `lib/ear/tendency.ts` (the table, `PULL_BANK`), `PullBeam`, `PullDrill`; the Function readout finds Home by view (it was `INSTRUMENTS[1]`, which Beat Hunt had taken).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-08-28 | Item 6 — Cadence and Bassline: `lib/ear/progressions.ts` (numerals, close voicings, `CADENCE_BANK` from the guitar room's eight, `BASSLINE_BANK` of twelve four-root lines), `guitar-chords.ts` (a strummer on the Karplus-Strong voices through one master gain), `ProgressionTrain`, `CadenceDrill` with four pads drawn per round, `BasslineDrill` on the ladder in numerals (`PhraseConsole` takes `degrees` and `words`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-08-28 | Item 7 — Subdivide: `lib/ear/metre.ts` (five metres, two patterns each, the accent on one), `MetreLattice`, `SubdivideDrill` on the kit voices with four metre pads drawn per round; naming the metre only — the "tap where beat one falls" alternative is not built.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-08-28 | Item 8 — Sing mode for Echo and Span: `lib/ear/phrase-score.ts` (note windows on the phrase's own grid, the median f0 of the confident frames names each note, within 60 cents, in order), `use-sing-capture.ts` (the mic through `micManager` + `createF0Stream`, the way Home listens), an Answer-by toggle on both idle consoles with a fallback to the ladder when the mic is refused; the engines take a rating track per run (`echo-sing` with no guess floor and items untouched; `span-sing` for practice only — Calibration always taps).                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-08-28 | Item 9 — The Field Book: `lib/ear/wild.ts` (items from notes, chords and key, named in the song's own mode; the three wild drills borrow Home, Echo and Bassline's engines under their own ids), `wild-analysis.ts` (the vocal through `detectNotes`, the key through `detectKeyFromNotes`, chords through STFT → NNLS chroma → `detectChords` on the bass part or the instrumental, decimated to 11 kHz), `wild-player.ts` + `wild-playback.ts` (stem excerpts under one fading gain, the song's tonic triad as the plant), `wild-store.ts`, `FieldBookCard` on the bench, `FieldBookView` with Home, Echo and Bassline in the Wild. Decision taken here: In The Wild stays a bench faculty (the sixth dial reads the Field Book's mean) but leaves the Column's composite — `FACULTY_WEIGHTS` drops `wild`, so the Column no longer reports it missing; that is what "never the Column" has to mean for a dial that already existed. |
| 2026-08-28 | Item 10 — The mixing desk: `lib/ear/desk.ts` (six bands, six faults, the desk's drills — Colour on the catalogue's settings under `desk-colour`, Weight and Critique the desk's own), `desk-render.ts` (the house loop and the user's song rendered once on an `OfflineAudioContext`, each trial's slice through a peaking boost, a low shelf, a pumping compressor or a fold to mono, loudness-matched where two are compared), `desk-store.ts`, `MixingDesk`, `ColourDrill`, `WeightDrill`, `CritiqueDrill`, `DeskView`; the desk is a strip tile; the catalogue's `colour` stays unrecorded so the Column's estimate never sees the desk.                                                                                                                                                                                                                                                                                           |
