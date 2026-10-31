// ============================================================
// The Legend's lane — the line and the voice, in numbers
// ============================================================
//
// Where each note of the line sits on the room's stage, what it shows, and
// where the voice has been, for a stage of a given size. Pure, so the
// drawings (LegendLane.tsx, LegendTrace.tsx, LegendPoster.tsx) hold no
// maths, and the maths is tested without a frame.
//
// THE LANE (a take). The line runs right to left past a fixed now line, a
// glass note to each of its notes, on a row for each pitch it uses. A note
// ahead is glass; the one under the now line is lit; a passed note is lit
// when the web's own highlight cleared it and missed when it did not
// (challengeTargetHighlights, the stage's rule, so the lane and the score
// never disagree). The voice is the take's own points up to the now line.
//
// THE TRACE (a result). The whole line at once, each note lit or missed,
// with the voice over it: what the take was, in one look.
//
// THE POSTER (the door). The line before anyone sings it: a bead at each
// note's start on its row, one thread through them, held flat for as long
// as each note lasts.
//
// A state is never colour alone: the drawings put a check or a cross on a
// note that has one, and the words beside them say how many were lit.

import type { ResolvedZenTarget, ZenPitchPoint, ZenTargetHighlight, } from '@/features/zen/types'
import { midiToNoteNameOctave } from '@/lib/note-utils'

export interface StageBox {
  readonly width: number
  readonly height: number
}

/** What a note shows: ahead of the now line, under it, lit, missed. */
export type NoteLook = 'ahead' | 'now' | 'lit' | 'missed'

export interface StageNote {
  readonly id: string
  /** Left edge and width, px. */
  readonly x: number
  readonly width: number
  /** The row's centre, px. */
  readonly y: number
  readonly look: NoteLook
  /** 0..1, how near the voice is to the note under the now line. */
  readonly glow: number
  /** Its name, "G4". */
  readonly label: string
}

export interface StageRow {
  readonly y: number
  readonly label: string
}

export interface LaneView {
  readonly rows: readonly StageRow[]
  readonly notes: readonly StageNote[]
  /** The voice as path data, '' before any of it is heard. */
  readonly voice: string
  /** The voice's newest point, while it still sounds. */
  readonly tip: { readonly x: number; readonly y: number } | null
  readonly nowX: number
}

export interface TraceView {
  readonly rows: readonly StageRow[]
  readonly notes: readonly StageNote[]
  readonly voice: string
}

export interface PosterBead {
  readonly x: number
  readonly y: number
  readonly label: string
}

export interface PosterView {
  readonly rows: readonly StageRow[]
  readonly beads: readonly PosterBead[]
  readonly thread: string
  /** Where the thread starts and ends, for its light to run between. */
  readonly from: number
  readonly to: number
}

/** The stage's measures, px. */
export const LANE = {
  /** The now line, as a share of the stage's width. */
  nowShare: 0.44,
  /** How far a second of the line runs. */
  pxPerSec: 46,
  /** The most a semitone may take, so a narrow line is not stretched. */
  maxSemitonePx: 42,
  /** The space between two notes that follow each other. */
  gap: 6,
  /** Room above the highest row and below the lowest. */
  pad: 48,
  /** A tip older than this is not drawn: the voice has stopped. */
  tipSec: 0.15,
  /** A longer silence than this between two points lifts the pen. */
  breakSec: 0.15,
} as const

const r1 = (value: number): number => Math.round(value * 10) / 10

/** One y for every pitch the line uses, centred in the box. */
function pitchScale(
  midis: readonly number[],
  height: number,
  pad: number,
  maxSemitonePx: number,
): { y: (midi: number) => number; rows: StageRow[] } {
  const lo = Math.min(...midis)
  const hi = Math.max(...midis)
  const span = Math.max(1, hi - lo)
  const semitone = Math.max(
    0,
    Math.min(maxSemitonePx, (height - 2 * pad) / span),
  )
  const middle = (lo + hi) / 2
  const y = (midi: number): number => height / 2 + (middle - midi) * semitone
  const rows = [...new Set(midis.map((midi) => Math.round(midi)))]
    .sort((a, b) => b - a)
    .map((midi) => ({ y: r1(y(midi)), label: midiToNoteNameOctave(midi) }))
  return { y, rows }
}

/** The voice from `fromSec` to `toSec` as path data, the pen lifted at a gap. */
function voicePath(
  points: readonly ZenPitchPoint[],
  x: (sec: number) => number,
  y: (midi: number) => number,
  fromSec: number,
  toSec: number,
): string {
  let d = ''
  let pen = false
  let last = -Infinity
  for (const point of points) {
    if (point.timeSec < fromSec || point.timeSec > toSec) continue
    if (point.midi === null || !Number.isFinite(point.midi)) {
      pen = false
      continue
    }
    if (point.timeSec - last > LANE.breakSec) pen = false
    d += `${pen ? 'L' : 'M'}${r1(x(point.timeSec))} ${r1(y(point.midi))}`
    pen = true
    last = point.timeSec
  }
  return d
}

function lookOf(
  target: ResolvedZenTarget,
  highlight: ZenTargetHighlight | undefined,
  clock: number,
): NoteLook {
  if (highlight?.cleared === true) return 'lit'
  if (highlight?.missed === true) return 'missed'
  if (clock < target.startSec) return 'ahead'
  if (clock < target.endSec) return 'now'
  // Past its window with no word on it: the score has none for it either.
  return 'missed'
}

/** The take's stage at `clock` seconds into the line. */
export function laneView(
  targets: readonly ResolvedZenTarget[],
  points: readonly ZenPitchPoint[],
  highlights: ReadonlyMap<string, ZenTargetHighlight>,
  clock: number,
  box: StageBox,
): LaneView {
  const nowX = r1(box.width * LANE.nowShare)
  if (targets.length === 0) {
    return { rows: [], notes: [], voice: '', tip: null, nowX }
  }
  const { y, rows } = pitchScale(
    targets.map((target) => target.startMidi),
    box.height,
    LANE.pad,
    LANE.maxSemitonePx,
  )
  const x = (sec: number): number => nowX + (sec - clock) * LANE.pxPerSec
  const notes: StageNote[] = []
  for (const target of targets) {
    const left = x(target.startSec)
    const right = x(target.endSec) - LANE.gap
    if (right < -LANE.pxPerSec || left > box.width + LANE.pxPerSec) continue
    const highlight = highlights.get(target.id)
    notes.push({
      id: target.id,
      x: r1(left),
      width: r1(Math.max(LANE.gap, right - left)),
      y: r1(y(target.startMidi)),
      look: lookOf(target, highlight, clock),
      glow: highlight?.glow ?? 0,
      label: midiToNoteNameOctave(Math.round(target.startMidi)),
    })
  }
  const fromSec = clock - nowX / LANE.pxPerSec - 0.5
  const voice = voicePath(points, x, y, fromSec, clock)
  let tip: LaneView['tip'] = null
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const point = points[i]
    if (point.timeSec > clock) continue
    if (clock - point.timeSec > LANE.tipSec) break
    if (point.midi !== null && Number.isFinite(point.midi)) {
      tip = { x: r1(x(point.timeSec)), y: r1(y(point.midi)) }
    }
    break
  }
  return { rows, notes, voice, tip, nowX }
}

/** No note of the line has reached the now line yet: the count-in. */
export function inCountIn(
  targets: readonly ResolvedZenTarget[],
  clock: number,
): boolean {
  const first = targets[0]
  return first === undefined || clock < first.startSec
}

/** The whole take at once, for its result. */
export function traceView(
  targets: readonly ResolvedZenTarget[],
  points: readonly ZenPitchPoint[],
  highlights: ReadonlyMap<string, ZenTargetHighlight>,
  box: StageBox,
): TraceView {
  if (targets.length === 0) return { rows: [], notes: [], voice: '' }
  const pad = 8
  const { y, rows } = pitchScale(
    targets.map((target) => target.startMidi),
    box.height,
    pad,
    12,
  )
  const from = targets[0].startSec
  const to = targets[targets.length - 1].endSec
  const scale = (box.width - 2 * pad) / Math.max(0.001, to - from)
  const x = (sec: number): number => pad + (sec - from) * scale
  const notes = targets.map((target) => {
    const highlight = highlights.get(target.id)
    return {
      id: target.id,
      x: r1(x(target.startSec)),
      width: r1(Math.max(2, (target.endSec - target.startSec) * scale - 4)),
      y: r1(y(target.startMidi)),
      look:
        highlight?.cleared === true ? ('lit' as const) : ('missed' as const),
      glow: 0,
      label: midiToNoteNameOctave(Math.round(target.startMidi)),
    }
  })
  return { rows, notes, voice: voicePath(points, x, y, from - 0.2, to + 0.2) }
}

/** One note of the line as the door draws it, in beats. */
export interface PosterNote {
  readonly startBeat: number
  readonly durationBeats: number
  readonly midi: number
}

/** The line before anyone sings it, for the door. */
export function posterView(
  line: readonly PosterNote[],
  box: StageBox,
): PosterView {
  if (line.length === 0) {
    return { rows: [], beads: [], thread: '', from: 0, to: 0 }
  }
  const pad = 24
  const left = 64
  const right = box.width - 28
  const { y, rows } = pitchScale(
    line.map((note) => note.midi),
    box.height,
    pad,
    26,
  )
  const first = line[0].startBeat
  const last = line[line.length - 1]
  const beats = Math.max(0.001, last.startBeat + last.durationBeats - first)
  const perBeat = (right - left) / beats
  const x = (beat: number): number => left + (beat - first) * perBeat
  const step = Math.min(8, perBeat / 3)
  const beads = line.map((note) => ({
    x: r1(x(note.startBeat)),
    y: r1(y(note.midi)),
    label: midiToNoteNameOctave(Math.round(note.midi)),
  }))
  let thread = `M${beads[0].x} ${beads[0].y}`
  line.forEach((note, i) => {
    const end = x(note.startBeat + note.durationBeats)
    const next = line[i + 1]
    if (next === undefined) {
      thread += `H${r1(end)}`
      return
    }
    const from = Math.max(beads[i].x, end - step)
    const to = beads[i + 1]
    const mid = r1((from + to.x) / 2)
    thread += `H${r1(from)}C${mid} ${beads[i].y} ${mid} ${to.y} ${to.x} ${to.y}`
  })
  return { rows, beads, thread, from: left, to: right }
}

/** Why a missed note was missed, from what was sung in its window. */
export type MissSide = 'flat' | 'sharp' | 'unsung' | 'unsteady'

export interface Miss {
  readonly label: string
  readonly side: MissSide
}

/** How far off the middle of a note's singing must be to be called off. */
const OFF_SEMITONES = 0.3

/** The line's missed notes, in order, each with which way it went. */
export function missesOf(
  targets: readonly ResolvedZenTarget[],
  points: readonly ZenPitchPoint[],
  highlights: ReadonlyMap<string, ZenTargetHighlight>,
): Miss[] {
  const misses: Miss[] = []
  for (const target of targets) {
    if (highlights.get(target.id)?.missed !== true) continue
    const offsets = points
      .filter(
        (point) =>
          point.midi !== null &&
          Number.isFinite(point.midi) &&
          point.timeSec >= target.startSec &&
          point.timeSec < target.endSec,
      )
      .map((point) => (point.midi as number) - target.startMidi)
      .sort((a, b) => a - b)
    const label = midiToNoteNameOctave(Math.round(target.startMidi))
    if (offsets.length < 3) {
      misses.push({ label, side: 'unsung' })
      continue
    }
    const middle = offsets[Math.floor(offsets.length / 2)]
    const side: MissSide =
      middle <= -OFF_SEMITONES
        ? 'flat'
        : middle >= OFF_SEMITONES
          ? 'sharp'
          : 'unsteady'
    misses.push({ label, side })
  }
  return misses
}
