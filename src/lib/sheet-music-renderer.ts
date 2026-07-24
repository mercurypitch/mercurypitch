// ============================================================
// Sheet Music Renderer — MelodyItem[] → VexFlow notation
//
// Renders a melody as proper multi-measure notation (barlines, key-aware
// accidentals, beams, ties across barlines) and returns a SheetLayout: a
// geometric map of every rendered note + stave so callers can overlay a
// playback cursor, hit-test clicks for seeking, and place new notes on the
// staff. The renderer never mutates the melody — editing is the caller's job.
// ============================================================

import { Accidental, Barline, Beam, Dot, Formatter, Renderer, Stave, StaveNote, StaveTie, Voice, } from 'vexflow'
import { KEY_SIGNATURES } from '@/lib/scale-data'
import type { MelodyItem } from '@/types'

// ---------------------------------------------------------------------------
// Duration quantisation
// ---------------------------------------------------------------------------

interface DurOpt {
  code: string
  dots: number
}

const DUR_BUCKETS: Array<DurOpt & { beats: number }> = [
  { code: 'w', beats: 4, dots: 0 },
  { code: 'h', beats: 2, dots: 0 },
  { code: 'q', beats: 1, dots: 0 },
  { code: '8', beats: 0.5, dots: 0 },
  { code: '16', beats: 0.25, dots: 0 },
  { code: '32', beats: 0.125, dots: 0 },
]

const EPS = 0.005
const MIN_DURATION = 0.125

/** Multiplier for a written duration with zero, one, or two augmentation dots. */
function dotMultiplier(dots: number): number {
  return 2 - 1 / 2 ** Math.max(0, dots)
}

function snapBeatValue(beats: number): number {
  return Math.max(0, Math.round(beats / MIN_DURATION) * MIN_DURATION)
}

/**
 * Split a beat length into standard written durations. Input is snapped to
 * the renderer's 1/32-note resolution so malformed or imported fractional
 * values cannot make the decomposition loop overshoot indefinitely.
 */
export function quantizeNotationDuration(beats: number): DurOpt[] {
  if (beats <= 0) return [{ code: '16', dots: 0 }]
  const results: DurOpt[] = []
  let remaining = Math.max(1, Math.round(beats / MIN_DURATION)) * MIN_DURATION
  while (remaining > EPS) {
    let best: DurOpt | null = null
    let bestBeats = 0
    for (const b of DUR_BUCKETS) {
      for (const d of [0, 1, 2]) {
        const value = b.beats * dotMultiplier(d)
        if (value <= remaining + EPS && value > bestBeats) {
          best = { code: b.code, dots: d }
          bestBeats = value
        }
      }
    }
    if (best === null) {
      best = { code: '32', dots: 0 }
      bestBeats = MIN_DURATION
    }
    results.push(best)
    remaining = Math.max(0, remaining - bestBeats)
  }
  return results.length > 0 ? results : [{ code: 'q', dots: 0 }]
}

export function notationDurationBeats(code: string, dots: number): number {
  const b = DUR_BUCKETS.find((d) => d.code === code)
  return (b?.beats ?? 1) * dotMultiplier(dots)
}

// ---------------------------------------------------------------------------
// MIDI → VexFlow key (key-aware sharp/flat spelling)
// ---------------------------------------------------------------------------

const SHARP_NAMES = [
  'c',
  'c#',
  'd',
  'd#',
  'e',
  'f',
  'f#',
  'g',
  'g#',
  'a',
  'a#',
  'b',
]
const FLAT_NAMES = [
  'c',
  'db',
  'd',
  'eb',
  'e',
  'f',
  'gb',
  'g',
  'ab',
  'a',
  'bb',
  'b',
]

/** VexFlow note key ("g#/4") spelled with flats or sharps per the key. */
function midiToVFKey(midi: number, useFlats: boolean): string {
  const rounded = Math.round(midi)
  const pc = ((rounded % 12) + 12) % 12
  const octave = Math.floor(rounded / 12) - 1
  const name = (useFlats ? FLAT_NAMES : SHARP_NAMES)[pc]
  return `${name}/${octave}`
}

// ---------------------------------------------------------------------------
// Key signature (reuses scale-data's KEY_SIGNATURES)
// ---------------------------------------------------------------------------

const RELATIVE_MAJOR: Record<string, string> = {
  A: 'C',
  E: 'G',
  B: 'D',
  'F#': 'A',
  'C#': 'E',
  'G#': 'B',
  D: 'F',
  G: 'Bb',
  C: 'Eb',
  F: 'Ab',
  Bb: 'Db',
  Eb: 'Gb',
}

const ENHARMONIC_MAJOR: Record<string, string> = {
  'A#': 'Bb',
  'D#': 'Eb',
  'G#': 'Ab',
  'C#': 'Db',
  Cb: 'B',
  'B#': 'C',
}

function normalizeKeyName(key: string): string {
  const ascii = key.trim().replace('♯', '#').replace('♭', 'b')
  if (ascii.length === 0) return 'C'
  return ascii.charAt(0).toUpperCase() + ascii.slice(1).toLowerCase()
}

/**
 * Return the actual VexFlow key name, not a string of accidental glyphs.
 * Minor scales inherit the signature of their relative major.
 */
export function notationKeySignature(key: string, scaleType: string): string {
  const normalized = normalizeKeyName(key)
  const isMinor = scaleType.toLowerCase().includes('minor')
  const relative = isMinor
    ? (RELATIVE_MAJOR[normalized] ?? normalized)
    : normalized
  const signature = ENHARMONIC_MAJOR[relative] ?? relative
  return KEY_SIGNATURES[signature] === undefined ? 'C' : signature
}

// ---------------------------------------------------------------------------
// Clef
// ---------------------------------------------------------------------------

function chooseClef(midis: number[]): 'treble' | 'bass' {
  if (midis.length === 0) return 'treble'
  // Median pitch (robust to a single high/low outlier that would otherwise
  // flip the whole piece and bury every other note in ledger lines).
  const sorted = [...midis].sort((a, b) => a - b)
  const mid = sorted[Math.floor(sorted.length / 2)]
  // Split at middle C (60): melodies centred below it read better in bass.
  return mid < 60 ? 'bass' : 'treble'
}

// ---------------------------------------------------------------------------
// Melody → note/rest cells, split at barlines with ties
// ---------------------------------------------------------------------------

interface Cell {
  /** null for a rest; one or more pitches for a note/chord */
  midis: number[] | null
  /** source MelodyItem ids, parallel to `midis`; null for a rest */
  melodyIds: number[] | null
  code: string
  dots: number
  beats: number
  startBeat: number
  /** tie this note into the next cell (same original note, split by a barline) */
  tieToNext: boolean
}

/**
 * Expand a melody into cells, breaking every note/rest at bar boundaries so
 * each measure sums to exactly `beatsPerBar`. Pieces of the same original note
 * are tied together.
 */
function melodyToMeasures(
  melody: MelodyItem[],
  beatsPerBar: number,
): { measures: Cell[][]; totalBeats: number } {
  const measures: Cell[][] = []
  if (!melody.length) return { measures, totalBeats: 0 }

  const sorted = [...melody].sort((a, b) => a.startBeat - b.startBeat)

  let curMeasure: Cell[] = []
  let measurePos = 0 // beats filled in the current measure
  let absBeat = 0

  const pushCell = (cell: Cell): void => {
    curMeasure.push(cell)
    measurePos += cell.beats
    absBeat += cell.beats
    if (measurePos >= beatsPerBar - EPS) {
      measures.push(curMeasure)
      curMeasure = []
      measurePos = 0
    }
  }

  /** Emit one note (or rest) of `totalBeats`, split across barlines + tied. */
  const emit = (
    midis: number[] | null,
    melodyIds: number[] | null,
    totalBeats: number,
    startAt: number,
  ): void => {
    let remaining = snapBeatValue(totalBeats)
    let pieceStart = startAt
    const pieces: Cell[] = []
    while (remaining > EPS) {
      const room = spaceLeft(measurePos, pieces, beatsPerBar)
      const take = Math.min(remaining, room)
      for (const d of quantizeNotationDuration(take)) {
        const beats = notationDurationBeats(d.code, d.dots)
        pieces.push({
          midis,
          melodyIds,
          code: d.code,
          dots: d.dots,
          beats,
          startBeat: pieceStart,
          tieToNext: false,
        })
        pieceStart += beats
      }
      remaining -= take
    }
    // Tie note pieces together (rests never tie).
    if (midis !== null) {
      for (let i = 0; i < pieces.length - 1; i++) pieces[i].tieToNext = true
    }
    for (const p of pieces) pushCell(p)
  }

  let cursor = 0
  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i]
    const itemStart = snapBeatValue(item.startBeat)
    const itemEnd = snapBeatValue(item.startBeat + item.duration)
    const gap = itemStart - cursor
    if (gap > 0.01) emit(null, null, gap, cursor)

    const chordItems = [item]
    if (item.isRest !== true) {
      while (i + 1 < sorted.length) {
        const next = sorted[i + 1]
        const sameRange =
          next.isRest !== true &&
          Math.abs(snapBeatValue(next.startBeat) - itemStart) < EPS &&
          Math.abs(snapBeatValue(next.startBeat + next.duration) - itemEnd) <
            EPS
        if (!sameRange) break
        chordItems.push(next)
        i++
      }
    }

    // Exact simultaneous notes become a chord. More complex overlapping
    // voices retain the earlier voice and render only the uncovered tail
    // rather than shifting material later and falsifying its beat position.
    const renderedStart = Math.max(cursor, itemStart)
    const renderedDuration = itemEnd - renderedStart
    if (renderedDuration > EPS) {
      emit(
        item.isRest === true
          ? null
          : chordItems.map((chordItem) => chordItem.note.midi),
        item.isRest === true
          ? null
          : chordItems.map((chordItem) => chordItem.id),
        renderedDuration,
        renderedStart,
      )
      cursor = itemEnd
    }
  }

  // Pad and flush the final (possibly incomplete) measure with rests.
  if (curMeasure.length > 0) {
    const fill = beatsPerBar - measurePos
    if (fill > EPS) {
      let start = absBeat
      for (const d of quantizeNotationDuration(fill)) {
        const beats = notationDurationBeats(d.code, d.dots)
        curMeasure.push({
          midis: null,
          melodyIds: null,
          code: d.code,
          dots: d.dots,
          beats,
          startBeat: start,
          tieToNext: false,
        })
        start += beats
      }
    }
    measures.push(curMeasure)
  }

  return { measures, totalBeats: cursor }
}

/** Beats left before the next barline, given cursor + already-queued pieces. */
function spaceLeft(
  measurePos: number,
  pieces: Cell[],
  beatsPerBar: number,
): number {
  const queued = pieces.reduce((a, c) => a + c.beats, 0)
  const filled = (measurePos + queued) % beatsPerBar
  const room = beatsPerBar - filled
  return room < EPS ? beatsPerBar : room
}

// ---------------------------------------------------------------------------
// Public layout types
// ---------------------------------------------------------------------------

/** Geometry + timing of one rendered note or rest. */
export interface SheetNoteBox {
  startBeat: number
  endBeat: number
  /** absolute x of the notehead centre (SVG px) */
  x: number
  /** absolute y of the (first) notehead centre (SVG px) */
  y: number
  width: number
  isRest: boolean
  midi: number | null
  /** source MelodyItem id (for seek/delete); null for synthesised rests */
  melodyId: number | null
  systemIndex: number
}

/** Geometry of one rendered system (a row of measures on one stave line). */
export interface SheetSystemBox {
  index: number
  startBeat: number
  endBeat: number
  /** left edge where notes begin (after clef/keysig), absolute px */
  noteStartX: number
  /** right edge where notes end, absolute px */
  noteEndX: number
  /** stave top / bottom y (for the cursor line span) */
  top: number
  bottom: number
  /** y of the top staff line + spacing between lines (for y↔pitch mapping) */
  lineTopY: number
  lineSpacing: number
  clef: 'treble' | 'bass'
}

export interface SheetLayout {
  width: number
  height: number
  notes: SheetNoteBox[]
  systems: SheetSystemBox[]
  clef: 'treble' | 'bass'
  beatsPerBar: number
  totalBeats: number
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface SheetMusicRenderInput {
  container: HTMLElement
  melody: MelodyItem[]
  key: string
  scaleType: string
  beatsPerBar?: number
  /** measures per system row (default 4) */
  measuresPerRow?: number
  /** total render width in px (default 960); the overlay maps 1:1 to this */
  width?: number
  /** Optional engraving palette. The defaults target the view's dark score. */
  palette?: Partial<SheetMusicPalette>
}

export interface SheetMusicPalette {
  /** Foreground notation: notes, stems, beams, ledger lines, rests and ties. */
  notation: string
  /** Musical structure: clef, key signature and time signature. */
  symbols: string
  /** Background structure: staff lines, barlines and measure numbers. */
  staff: string
}

const DEFAULT_W = 960
const MARGIN = 20
const ROW_H = 130
const TOP_PAD = 24
export const DEFAULT_SHEET_MUSIC_PALETTE: Readonly<SheetMusicPalette> = {
  notation: '#f4f8ff',
  symbols: '#c4d1e0',
  staff: '#71839a',
}

function makeStaveNote(
  cell: Cell,
  clef: 'treble' | 'bass',
  useFlats: boolean,
): StaveNote {
  const dur = `${cell.code}${cell.dots > 0 ? 'd'.repeat(cell.dots) : ''}`
  const note =
    cell.midis === null
      ? new StaveNote({ type: 'r', duration: dur, keys: ['b/4'] })
      : new StaveNote({
          keys: cell.midis.map((midi) => midiToVFKey(midi, useFlats)),
          duration: dur,
          clef,
          autoStem: true,
        })
  const keyCount = cell.midis?.length ?? 1
  for (let keyIndex = 0; keyIndex < keyCount; keyIndex++) {
    for (let dot = 0; dot < cell.dots; dot++) {
      note.addModifier(new Dot(), keyIndex)
    }
  }
  return note
}

export function renderSheetMusic(input: SheetMusicRenderInput): SheetLayout {
  const { container, melody, key, scaleType } = input
  const palette: SheetMusicPalette = {
    ...DEFAULT_SHEET_MUSIC_PALETTE,
    ...input.palette,
  }
  const notationStyle = {
    fillStyle: palette.notation,
    strokeStyle: palette.notation,
  }
  const symbolStyle = {
    fillStyle: palette.symbols,
    strokeStyle: palette.symbols,
  }
  const staffStyle = {
    fillStyle: palette.staff,
    strokeStyle: palette.staff,
  }
  const beatsPerBar = Math.max(1, Math.round(input.beatsPerBar ?? 4))
  const measuresPerRow = Math.max(1, Math.round(input.measuresPerRow ?? 4))
  const canvasW = Math.max(360, Math.round(input.width ?? DEFAULT_W))
  container.innerHTML = ''

  const empty: SheetLayout = {
    width: canvasW,
    height: 0,
    notes: [],
    systems: [],
    clef: 'treble',
    beatsPerBar,
    totalBeats: 0,
  }

  if (!melody.length) {
    return empty
  }

  const clef = chooseClef(melody.map((m) => m.note.midi))
  const keySig = notationKeySignature(key, scaleType)
  const useFlats = (KEY_SIGNATURES[keySig]?.flats ?? 0) > 0

  const { measures, totalBeats } = melodyToMeasures(melody, beatsPerBar)
  if (!measures.length) {
    return { ...empty, totalBeats }
  }

  const rows: Cell[][][] = []
  for (let i = 0; i < measures.length; i += measuresPerRow) {
    rows.push(measures.slice(i, i + measuresPerRow))
  }

  const renderer = new Renderer(
    container as HTMLDivElement,
    Renderer.Backends.SVG,
  )
  const totalH = rows.length * ROW_H + TOP_PAD + 20
  renderer.resize(canvasW, totalH)
  const ctx = renderer.getContext()

  // VexFlow has black defaults for stems and #444 ledger lines. Set an
  // explicit engraving palette on each element below so every primitive has
  // the same foreground hierarchy on the permanently dark score surface.
  ctx.setFillStyle(palette.notation)
  ctx.setStrokeStyle(palette.notation)

  const rowWidth = canvasW - MARGIN * 2
  const signature = KEY_SIGNATURES[keySig]
  const accidentalCount = (signature?.sharps ?? 0) + (signature?.flats ?? 0)
  const keySigW = accidentalCount === 0 ? 0 : accidentalCount * 10 + 8

  const noteBoxes: SheetNoteBox[] = []
  const systemBoxes: SheetSystemBox[] = []

  // Cross-measure ties collected as we go, drawn after all notes exist.
  const tiePairs: Array<{
    from: StaveNote
    to: StaveNote
    fromIndex: number
    toIndex: number
    sameRow: boolean
  }> = []
  const pendingTies = new Map<
    number,
    {
      note: StaveNote
      noteIndex: number
      systemIndex: number
    }
  >()

  const beams: Beam[] = []
  let measureBeatCursor = 0

  for (let r = 0; r < rows.length; r++) {
    const rowMeasures = rows[r]
    const y = r * ROW_H + TOP_PAD
    const prefixW = 20 + keySigW + (r === 0 ? 28 : 0)
    const perMeasure = (rowWidth - prefixW) / rowMeasures.length

    let x = MARGIN
    const rowStartBeat = measureBeatCursor
    let rowNoteStartX = MARGIN
    let rowNoteEndX = MARGIN
    let rowTop = y
    let rowBottom = y + 80
    let rowLineTopY = y
    let rowLineSpacing = 10
    const systemIndex = r

    for (let m = 0; m < rowMeasures.length; m++) {
      const cells = rowMeasures[m]
      const isRowHead = m === 0
      const width = isRowHead ? perMeasure + prefixW : perMeasure

      const stave = new Stave(x, y, width)
      if (isRowHead) {
        stave.addClef(clef)
        if (keySig !== 'C') stave.addKeySignature(keySig)
        if (r === 0) stave.addTimeSignature(`${beatsPerBar}/4`)
        // Measure number at the start of each system (Guitar-Pro style).
        stave.setMeasure(r * measuresPerRow + 1)
      }
      if (r === rows.length - 1 && m === rowMeasures.length - 1) {
        stave.setEndBarType(Barline.type.END)
      }
      stave.setStyle(staffStyle)
      for (const modifier of stave.getModifiers()) {
        modifier.setStyle(
          modifier.getCategory() === 'Barline' ? staffStyle : symbolStyle,
        )
      }
      stave.setContext(ctx)

      const measureBeats = cells.reduce((a, c) => a + c.beats, 0)
      const notes = cells.map((c) => makeStaveNote(c, clef, useFlats))

      const voice = new Voice({
        numBeats: Math.max(1, Math.round(measureBeats)),
        beatValue: 4,
      })
      voice.setStrict(false)
      voice.addTickables(notes)
      Accidental.applyAccidentals([voice], keySig)

      // Beam runs of eighths/shorter within the measure.
      try {
        const generatedBeams = Beam.generateBeams(notes)
        for (const beam of generatedBeams) beam.setStyle(notationStyle)
        beams.push(...generatedBeams)
      } catch {
        // Beaming is cosmetic; ignore failures on odd groupings.
      }
      // StaveNote.setStyle reaches noteheads, stems, flags and modifiers.
      // Ledger lines are drawn outside that child tree and need their own ink.
      // Apply both after accidental + beam generation because those steps may
      // add or rebuild child elements.
      for (const note of notes) {
        note.setStyle(notationStyle)
        note.setLedgerLineStyle(notationStyle)
      }

      stave.drawWithStyle()
      const noteStartX = stave.getNoteStartX()
      const noteEndX = stave.getNoteEndX()
      new Formatter()
        .joinVoices([voice])
        .format([voice], Math.max(40, noteEndX - noteStartX - 10))
      voice.draw(ctx, stave)

      // Record geometry.
      if (m === 0) {
        rowNoteStartX = noteStartX
        rowLineTopY = stave.getYForLine(0)
        rowLineSpacing = stave.getSpacingBetweenLines()
        rowTop = stave.getYForLine(0) - rowLineSpacing
        rowBottom = stave.getYForLine(4) + rowLineSpacing
      }
      rowNoteEndX = noteEndX

      // Per-note boxes + tie linkage. `pendingTie` intentionally spans
      // measures and systems; notes are only tied when they came from the
      // same source MelodyItem.
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i]
        const sn = notes[i]
        let nx = x + width / 2
        let ny = (rowTop + rowBottom) / 2
        let nw = 10
        try {
          nx = sn.getAbsoluteX()
          const ys = sn.getYs?.()
          if (ys !== undefined && ys.length > 0) ny = ys[0]
          const bb = sn.getBoundingBox?.()
          if (bb !== undefined) nw = bb.getW()
        } catch {
          // fall back to measure-centred estimate
        }
        if (cell.midis === null || cell.melodyIds === null) {
          noteBoxes.push({
            startBeat: cell.startBeat,
            endBeat: cell.startBeat + cell.beats,
            x: nx,
            y: ny,
            width: nw,
            isRest: true,
            midi: null,
            melodyId: null,
            systemIndex,
          })
          continue
        }

        const noteYs = sn.getYs()
        for (let noteIndex = 0; noteIndex < cell.midis.length; noteIndex++) {
          const melodyId = cell.melodyIds[noteIndex] ?? null
          noteBoxes.push({
            startBeat: cell.startBeat,
            endBeat: cell.startBeat + cell.beats,
            x: nx,
            y: noteYs[noteIndex] ?? ny,
            width: nw,
            isRest: false,
            midi: cell.midis[noteIndex],
            melodyId,
            systemIndex,
          })
          if (melodyId === null) continue
          const pending = pendingTies.get(melodyId)
          if (pending !== undefined) {
            tiePairs.push({
              from: pending.note,
              to: sn,
              fromIndex: pending.noteIndex,
              toIndex: noteIndex,
              sameRow: pending.systemIndex === systemIndex,
            })
          }
          if (cell.tieToNext) {
            pendingTies.set(melodyId, { note: sn, noteIndex, systemIndex })
          } else {
            pendingTies.delete(melodyId)
          }
        }
      }

      x += width
      measureBeatCursor += measureBeats
    }

    systemBoxes.push({
      index: systemIndex,
      startBeat: rowStartBeat,
      endBeat: measureBeatCursor,
      noteStartX: rowNoteStartX,
      noteEndX: rowNoteEndX,
      top: rowTop,
      bottom: rowBottom,
      lineTopY: rowLineTopY,
      lineSpacing: rowLineSpacing,
      clef,
    })
  }

  // Draw beams + ties. At a system break VexFlow draws two partial ties so
  // the continuation remains explicit instead of silently disappearing.
  for (const b of beams) b.setContext(ctx).draw()
  const drawTie = (tie: StaveTie): void => {
    tie.setStyle(notationStyle).setContext(ctx).draw()
  }
  for (const t of tiePairs) {
    try {
      if (t.sameRow) {
        drawTie(
          new StaveTie({
            firstNote: t.from,
            lastNote: t.to,
            firstIndexes: [t.fromIndex],
            lastIndexes: [t.toIndex],
          }),
        )
      } else {
        drawTie(
          new StaveTie({
            firstNote: t.from,
            firstIndexes: [t.fromIndex],
          }),
        )
        drawTie(new StaveTie({ lastNote: t.to, lastIndexes: [t.toIndex] }))
      }
    } catch {
      // ignore tie draw failures (edge cases at line breaks)
    }
  }

  const svg = container.querySelector('svg')
  if (svg) {
    svg.style.display = 'block'
  }

  return {
    width: canvasW,
    height: totalH,
    notes: noteBoxes,
    systems: systemBoxes,
    clef,
    beatsPerBar,
    totalBeats,
  }
}

// ---------------------------------------------------------------------------
// Layout helpers for the interactive overlay (cursor / seek / note entry)
// ---------------------------------------------------------------------------

/** Position of the playback cursor at a given beat. */
export interface CursorPos {
  x: number
  top: number
  bottom: number
}

/** Interpolate a cursor position (x plus staff top/bottom) for `beat`. */
export function beatToCursor(
  layout: SheetLayout,
  beat: number,
): CursorPos | null {
  if (layout.systems.length === 0) return null
  const sys = layout.systems.find(
    (s) => beat >= s.startBeat - EPS && beat < s.endBeat - EPS,
  )
  const fallback =
    beat < (layout.systems[0]?.startBeat ?? 0)
      ? layout.systems[0]
      : layout.systems[layout.systems.length - 1]
  const system: SheetSystemBox = sys ?? fallback

  // Piecewise-linear over this system's note boxes (lands on noteheads).
  const boxes = layout.notes
    .filter((n) => n.systemIndex === system.index)
    .sort((a, b) => a.startBeat - b.startBeat)

  const clamped = Math.max(system.startBeat, Math.min(beat, system.endBeat))
  let x = system.noteStartX
  if (boxes.length === 0) {
    const frac =
      (clamped - system.startBeat) /
      Math.max(EPS, system.endBeat - system.startBeat)
    x = system.noteStartX + frac * (system.noteEndX - system.noteStartX)
  } else {
    // Build breakpoints: system start → each note x → system end.
    const pts: Array<{ beat: number; x: number }> = [
      { beat: system.startBeat, x: system.noteStartX },
    ]
    for (const b of boxes) pts.push({ beat: b.startBeat, x: b.x })
    pts.push({ beat: system.endBeat, x: system.noteEndX })
    x = interpolate(pts, clamped)
  }
  return { x, top: system.top, bottom: system.bottom }
}

function interpolate(
  pts: Array<{ beat: number; x: number }>,
  beat: number,
): number {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    if (beat >= a.beat && beat <= b.beat) {
      const span = b.beat - a.beat
      if (span < EPS) return a.x
      return a.x + ((beat - a.beat) / span) * (b.x - a.x)
    }
  }
  return pts[pts.length - 1].x
}

/**
 * Which note box (if any) sits under an SVG-space point.
 * With `yTol` the notehead's pitch must also be within `yTol` px — used for
 * editing so a click at a different pitch places a note rather than seeking.
 * Without it, any click in the note's column (whole staff height) matches —
 * used for click-to-seek in read-only views.
 */
export function noteBoxAt(
  layout: SheetLayout,
  px: number,
  py: number,
  yTol?: number,
): SheetNoteBox | null {
  let best: SheetNoteBox | null = null
  let bestScore = Infinity
  for (const n of layout.notes) {
    if (n.isRest) continue
    const sys = layout.systems[n.systemIndex] as SheetSystemBox | undefined
    if (sys === undefined) continue
    if (py < sys.top - 8 || py > sys.bottom + 8) continue
    const dx = Math.abs(px - n.x)
    if (dx >= Math.max(14, n.width)) continue
    if (yTol !== undefined && Math.abs(py - n.y) > yTol) continue
    const score = yTol !== undefined ? dx + Math.abs(py - n.y) : dx
    if (score < bestScore) {
      best = n
      bestScore = score
    }
  }
  return best
}

const LETTER_SEMITONE = [0, 2, 4, 5, 7, 9, 11] // C D E F G A B

/**
 * Map an SVG-space click within a system to a natural-pitch MIDI number based
 * on staff position (diatonic). Callers typically snap the result to a scale.
 */
export function staffYToMidi(system: SheetSystemBox, y: number): number {
  const halfSpace = system.lineSpacing / 2
  const stepsFromTop = Math.round((y - system.lineTopY) / halfSpace)
  // Top staff line: treble = F5, bass = A3.
  const topLetter = system.clef === 'treble' ? 3 : 5 // index into C D E F G A B
  const topOctave = system.clef === 'treble' ? 5 : 3
  const topAbs = topOctave * 7 + topLetter
  const abs = topAbs - stepsFromTop
  const letter = ((abs % 7) + 7) % 7
  const octave = Math.floor(abs / 7)
  return (octave + 1) * 12 + LETTER_SEMITONE[letter]
}

/** Which system row contains an SVG-space y (for click placement). */
export function systemAtY(
  layout: SheetLayout,
  y: number,
): SheetSystemBox | null {
  for (const s of layout.systems) {
    if (y >= s.top - ROW_H / 2 && y <= s.bottom + ROW_H / 2) return s
  }
  return layout.systems[layout.systems.length - 1] ?? null
}

/**
 * Map an SVG-space x within a system to a beat position, interpolating
 * between the actual rendered notehead positions (the inverse of
 * beatToCursor's piecewise mapping). Falls back to a linear mapping over
 * the system when it holds no note boxes.
 */
export function xToBeat(
  layout: SheetLayout,
  system: SheetSystemBox,
  x: number,
): number {
  const boxes = layout.notes
    .filter((n) => n.systemIndex === system.index)
    .sort((a, b) => a.startBeat - b.startBeat)

  const pts: Array<{ beat: number; x: number }> = [
    { beat: system.startBeat, x: system.noteStartX },
  ]
  // Keep x strictly increasing so the inverse is well-defined (formatter
  // quirks can nudge a notehead a hair left of its predecessor).
  for (const b of boxes) {
    if (b.x > pts[pts.length - 1].x) pts.push({ beat: b.startBeat, x: b.x })
  }
  const last = pts[pts.length - 1]
  pts.push({
    beat: system.endBeat,
    x: Math.max(system.noteEndX, last.x + EPS),
  })

  if (x <= pts[0].x) return system.startBeat
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    if (x >= a.x && x <= b.x) {
      const span = b.x - a.x
      if (span < EPS) return a.beat
      return a.beat + ((x - a.x) / span) * (b.beat - a.beat)
    }
  }
  return system.endBeat
}
