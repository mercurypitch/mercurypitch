# Sheet Music: Grand Staff & Tuplet Support

## Context

The sheet-music view (`src/lib/sheet-music-renderer.ts` + 
`src/components/SheetMusicView.tsx`, PR #240) renders `MelodyItem[]` as
standard notation via VexFlow 5 and returns a `SheetLayout` geometry map that
the component uses for the playback cursor, click-to-seek/scrub, and note
entry. Two known limitations, flagged in review as non-blocking follow-ups:

1. **Single clef only.** `chooseClef()` picks treble *or* bass from the median
   pitch, so wide-range melodies (piano MIDI imports especially) bury their
   extremes in ledger lines.
2. **Straight rhythms only.** `quantizeDuration()` greedily fills a span with
   whole/half/quarter/8th/16th/32nd values plus dots. Triplet input (beats in
   exact 1/3 multiples, common in imported MIDI) gets misquantized into dotted
   approximations that drift against the true onsets.

Both changes are renderer-internal: `SheetMusicView`'s API and the overlay
contract (`SheetLayout.notes` / `.systems`, `beatToCursor`, `noteBoxAt`,
`xToBeat`, `staffYToMidi`, `systemAtY`) stay source-compatible, with one
extension noted below. Ship as two independent PRs.

---

## PR A — Grand staff (braced treble + bass)

### Trigger

Auto-detect in `renderSheetMusic()`:

```
grandStaff = (minMidi <= 55 /* G3 */ && maxMidi >= 67 /* G4 */)
          || (maxMidi - minMidi > 22)
```

i.e. the melody straddles middle C by a comfortable margin on both sides, or
spans more than ~2 octaves. Single-staff rendering stays the default and is
byte-for-byte unchanged when the trigger doesn't fire. (An explicit
`staffMode?: 'auto' | 'single' | 'grand'` prop can ride along for free; UI
toggle deferred.)

### Rendering

- Per measure, build **two** `Stave`s: treble at `y`, bass at
  `y + GRAND_STAFF_GAP` (~80px). Row head gets a `StaveConnector` `BRACE`
  plus `SINGLE_LEFT`; the final measure keeps the existing END barline on
  both staves via `SINGLE_RIGHT` connectors per measure.
- Row height becomes layout-dependent: `rowH = grand ? ~230 : 130`. Stop
  hardcoding `ROW_H` in `systemAtY()` — store the effective row height on
  `SheetLayout` (or derive the hit band from each system's `top`/`bottom`).
- **Staff assignment with hysteresis**: assign each `Cell` to treble when
  `midi >= 60`, bass when `< 60`, but keep runs sticky — only switch staves
  when the new note is more than ±2 semitones across the split. Prevents
  zig-zag engraving on lines that hover around middle C.
- **Two voices per measure**, one per staff. The staff *not* sounding a cell
  carries an equal-duration invisible filler (VexFlow `GhostNote`, or a rest
  styled `transparent`) so both voices tick in lockstep, then:

  ```ts
  new Formatter()
    .joinVoices([trebleVoice])
    .joinVoices([bassVoice])
    .format([trebleVoice, bassVoice], width)
  ```

  which vertically aligns the note columns across the pair.
- Beams (`Beam.generateBeams`) and ties run per staff, real notes only —
  ghost fillers are excluded from beam candidates and from `SheetLayout.notes`.
  Cross-staff beaming is explicitly out of scope.

### Layout contract extension

```ts
interface SheetSystemBox {
  // existing fields keep meaning: top/bottom now span the whole brace,
  // lineTopY/lineSpacing/clef describe the PRIMARY (treble) staff.
  staves?: Array<{
    clef: 'treble' | 'bass'
    lineTopY: number
    lineSpacing: number
    top: number
    bottom: number
  }>
}
```

- `beatToCursor` needs no change — the cursor already spans
  `system.top..system.bottom`, which now covers both staves and the gap.
- `staffYToMidi(system, y)`: when `staves` is present, map through the
  sub-staff whose band is nearest `y`. Note entry then works on either staff
  naturally (click low → bass pitches).
- `noteBoxAt` already works per note box; each box keeps its own `y`, so
  seek and right-click-delete are unaffected.

### Tests

- Trigger matrix: bass-only, treble-only, straddling, >22-semitone span.
- Hysteresis: alternating B3/D4 line stays on one staff; a real hand-over
  (C3 run → C5 run) switches once.
- Geometry round-trip on both staves: `staffYToMidi` inverse-maps rendered
  notehead `y`s back to their midi within a semitone.
- Render smoke: two-octave scale renders without VexFlow throwing; every
  measure's voices tick-complete.

---

## PR B — Triplets (and the tuplet groundwork)

### Detection

Runs per measure *before* duration quantization, so restructure
`melodyToMeasures()` into two passes:

1. **Collect** raw per-measure events (midi, melodyId, startBeat, beats) —
   still splitting notes at barlines and synthesizing gap rests, but without
   calling `quantizeDuration` yet.
2. **Classify** each beat window of the measure:
   - onsets/durations all ≈ multiples of **1/3** beat (within `EPS`) and not
     all multiples of 1/4 → **eighth-note triplet** window (3 cells/beat);
   - multiples of **1/6** → **sixteenth triplets** (6 cells/beat, grouped 3+3);
   - otherwise → straight, quantized exactly as today.

   MIDI import produces exact tick fractions, so equality-within-EPS is
   reliable; no fuzzy swing inference is attempted (a humanized-but-straight
   performance must stay straight — that's a test fixture, not a stretch goal).

Quintuplets/septuplets: same window mechanism, deferred until something
produces them.

### Representation & rendering

```ts
interface Cell {
  // ...existing...
  tuplet?: { num: 3; in: 2; group: number } // numNotes / notesOccupied / group id
}
```

- Tuplet cells carry nominal codes (`'8'` for 1/3-beat, `'16'` for 1/6) while
  `beats`/`startBeat` keep the true fractional values — so `beatToCursor`,
  seek and the note-box overlay need **zero** changes.
- Per measure, group cells by `tuplet.group` → 
  `new Tuplet(groupNotes, { numNotes: 3, notesOccupied: 2 })`, drawn after
  the voice. Exclude tuplet notes from `Beam.generateBeams` and beam each
  all-eighth-or-shorter group manually so the bracket/beam don't fight.
- Rests are legal inside a group (note–rest–note triplet works).
- **Ties across a tuplet boundary are disallowed in v1**: if a note would tie
  into or out of a window, the window falls back to straight quantization.
- Note entry stays on the 0.5/1 grid; placing a straight note inside a
  triplet region simply re-classifies that window as straight on redraw
  (documented behavior, not a bug).

### Validation spike (first commit of the PR)

VexFlow 5 tuplet tick-scaling interacts with `Voice`/`Formatter` order —
verify with a throwaway fixture that `voice.setStrict(false)` +
`Tuplet` attached *before* `format()` produces aligned columns and correct
widths. If VF5 needs strict tick math instead, wire
`Voice.setMode(Voice.Mode.SOFT)` accordingly before building the real pass.

### Tests

- Pure detector: full-bar eighth triplets; one triplet beat inside a straight
  bar; 16th triplets; straight-but-dense input stays straight; barline-split
  note falling back to straight.
- Cell invariants: every measure still sums to `beatsPerBar` in true beats;
  group ids never span measures.
- Render smoke on the fixtures + cursor interpolation across a triplet beat
  (breakpoints hit the true 1/3 onsets).

---

## Order & effort

**A then B**, independently mergeable. A is layout-heavy (~1–2 days incl.
tests), B is data-model-heavy (~1–2 days, mostly the two-pass
`melodyToMeasures` refactor, which also leaves the code in better shape for
future tuplet kinds). Neither touches stores, playback, or the
`SheetMusicView` props.
