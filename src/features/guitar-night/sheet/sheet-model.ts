// The sheet is a reading surface: bars laid a few to a horizontal system, systems
// stacked downwards, every visible part drawn on its own rows against the same
// bar lines. Everything in this file is pure — no DOM, no Solid, no renderer.
// That is deliberate: the layout is the contract two different painters (tab
// today, staff notation later) agree on, and it is what the tests pin down.
//
// One clock per sheet. Authored tracks from one score share a beat clock;
// measured stem lines run on the recording's own clock (60 bpm, one beat per
// second). Stacking the two would draw bar lines that mean different things in
// different rows, so a placement is built from lanes that already agree.

import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import type { InstrumentTuning, StringedInstrument, } from '@/lib/guitar/instrument-tuning'
import type { MidiBar, MidiTimeSignature } from '@/lib/midi-bars'
import { buildBars } from '@/lib/midi-bars'
import type { GuitarNightReferenceKind } from '../reference-port'

/**
 * One bar of the sheet, in beat time.
 *
 * Where the lines fall is not the sheet's business to decide: signatures come
 * off the file and `@/lib/midi-bars` turns them into bars, the same bars the
 * highway and the piano roll count. The sheet only has to draw them.
 */
export type SheetBar = MidiBar

/** A horizontal run of bars. Systems stack down the page; bars run across. */
export interface SheetSystem {
  index: number
  bars: readonly SheetBar[]
  startBeat: number
  beats: number
}

/**
 * One part on the sheet, already placed on the rows it will be drawn on. A lane
 * owns its tuning, so a bass lane and a seven-string lane can sit in the same
 * sheet without either being redrawn on the other's neck.
 */
export interface SheetLane {
  trackId: string
  trackName: string
  kind: GuitarNightReferenceKind
  instrument: StringedInstrument
  tuning: InstrumentTuning
  notes: readonly GuitarNote[]
  /** Notes this lane's neck could not reach, so they were not placed. */
  outOfRangeNotes: number
}

/**
 * A laid-out sheet. `notesBySystem[systemIndex][laneIndex]` is the slice of that
 * lane starting inside that system — built once, so drawing a frame never scans
 * a whole song.
 */
export interface SheetPlacement {
  systems: readonly SheetSystem[]
  lanes: readonly SheetLane[]
  notesBySystem: readonly (readonly (readonly GuitarNote[])[])[]
  totalBeats: number
  barsPerSystem: number
}

export interface SheetLayoutInput {
  lanes: readonly SheetLane[]
  /** Beats the sheet must cover. Defaults to the last note that ends. */
  totalBeats?: number
  timeSignatures?: readonly MidiTimeSignature[]
  barsPerSystem?: number
}

/** Where a beat falls on the sheet: which system, and how far across it. */
export interface SheetBeatPosition {
  systemIndex: number
  /** 0 at the system's first bar line, 1 at its last, never outside. */
  fraction: number
}

/** One clipped piece of a rehearsal loop on a single horizontal system. */
export interface SheetLoopFragment {
  systemIndex: number
  startFraction: number
  endFraction: number
  startsAtA: boolean
  endsAtB: boolean
}

/** A labelled loop boundary placed on one horizontal system. */
export interface SheetLoopMarker extends SheetBeatPosition {
  mark: 'A' | 'B'
}

/** The beat the last note of any lane finishes on, or 0 for an empty sheet. */
export function totalBeatsForLanes(lanes: readonly SheetLane[]): number {
  let end = 0
  for (const lane of lanes) {
    for (const note of lane.notes) {
      const noteEnd = note.startBeat + Math.max(0, note.duration)
      if (noteEnd > end) end = noteEnd
    }
  }
  return end
}

/**
 * Bar lines for a span of beats. A sheet always has at least one bar: an empty
 * score should read as an empty bar, not as a blank page.
 */
export function buildSheetBars(
  totalBeats: number,
  timeSignatures?: readonly MidiTimeSignature[],
): SheetBar[] {
  return buildBars(totalBeats, timeSignatures)
}

/** Cut a bar list into the horizontal rows the page scrolls through. */
export function groupIntoSystems(
  bars: readonly SheetBar[],
  barsPerSystem: number,
): SheetSystem[] {
  const perSystem = Math.max(1, Math.round(barsPerSystem))
  const systems: SheetSystem[] = []

  for (let start = 0; start < bars.length; start += perSystem) {
    const slice = bars.slice(start, start + perSystem)
    const first = slice[0]
    if (first === undefined) continue
    systems.push({
      index: systems.length,
      bars: slice,
      startBeat: first.startBeat,
      beats: slice.reduce((total, bar) => total + bar.beats, 0),
    })
  }

  return systems
}

export interface BarsPerSystemOptions {
  /** Narrowest a bar may be drawn before it stops being readable. */
  minBarWidth?: number
  maxBars?: number
}

/**
 * How many bars fit across a given width. Kept pure and separate from the view
 * so the count can be asserted without a layout engine.
 */
export function barsPerSystemForWidth(
  width: number,
  options: BarsPerSystemOptions = {},
): number {
  const minBarWidth = options.minBarWidth ?? 240
  const maxBars = Math.max(1, options.maxBars ?? 4)
  if (!Number.isFinite(width) || width <= 0) return 1
  return Math.min(maxBars, Math.max(1, Math.floor(width / minBarWidth)))
}

/** Lay the sheet out and index every lane's notes by the system they start in. */
export function buildSheetPlacement(input: SheetLayoutInput): SheetPlacement {
  const lanes = input.lanes
  const totalBeats = input.totalBeats ?? totalBeatsForLanes(lanes)
  const bars = buildSheetBars(totalBeats, input.timeSignatures)
  const barsPerSystem = Math.max(1, Math.round(input.barsPerSystem ?? 4))
  const systems = groupIntoSystems(bars, barsPerSystem)

  const notesBySystem: GuitarNote[][][] = systems.map(() => lanes.map(() => []))

  for (let laneIndex = 0; laneIndex < lanes.length; laneIndex += 1) {
    const lane = lanes[laneIndex]
    if (lane === undefined) continue
    for (const note of lane.notes) {
      const systemIndex = systemIndexForBeat(systems, note.startBeat)
      if (systemIndex === null) continue
      notesBySystem[systemIndex]?.[laneIndex]?.push(note)
    }
  }

  // Notes arrive in source order, which is usually but not always by time.
  // Sorting once here is what lets the painter walk a system straight through.
  for (const perLane of notesBySystem) {
    for (const notes of perLane) {
      notes.sort((left, right) => left.startBeat - right.startBeat)
    }
  }

  return { systems, lanes, notesBySystem, totalBeats, barsPerSystem }
}

/** The notes of one lane inside one system, or an empty list off the sheet. */
export function laneNotesInSystem(
  placement: SheetPlacement,
  systemIndex: number,
  laneIndex: number,
): readonly GuitarNote[] {
  return placement.notesBySystem[systemIndex]?.[laneIndex] ?? EMPTY_NOTES
}

/**
 * Where a beat sits on the sheet. Beats before the first bar clamp to its
 * start and beats past the last clamp to its end, so a playhead stays on the
 * page instead of vanishing when a recording runs long.
 */
export function locateBeat(
  placement: SheetPlacement,
  beat: number,
): SheetBeatPosition | null {
  const systems = placement.systems
  if (systems.length === 0) return null

  const first = systems[0]
  const last = systems[systems.length - 1]
  if (first === undefined || last === undefined) return null
  if (!Number.isFinite(beat) || beat <= first.startBeat) {
    return { systemIndex: 0, fraction: 0 }
  }
  const end = last.startBeat + last.beats
  if (beat >= end) return { systemIndex: last.index, fraction: 1 }

  const systemIndex = systemIndexForBeat(systems, beat) ?? last.index
  const system = systems[systemIndex]
  if (system === undefined || system.beats <= 0) {
    return { systemIndex, fraction: 0 }
  }
  return {
    systemIndex,
    fraction: clamp01((beat - system.startBeat) / system.beats),
  }
}

/**
 * Split a complete A/B range at system boundaries. A range ending exactly at
 * a new system belongs to the previous system's right edge, avoiding a stray
 * zero-width fragment at the start of the next row.
 */
export function sheetLoopFragments(
  placement: SheetPlacement,
  loopStart: number | null,
  loopEnd: number | null,
): SheetLoopFragment[] {
  if (
    loopStart === null ||
    loopEnd === null ||
    !Number.isFinite(loopStart) ||
    !Number.isFinite(loopEnd) ||
    loopEnd <= loopStart
  ) {
    return []
  }

  const fragments: SheetLoopFragment[] = []
  for (const system of placement.systems) {
    if (system.beats <= 0) continue
    const systemEnd = system.startBeat + system.beats
    const clippedStart = Math.max(loopStart, system.startBeat)
    const clippedEnd = Math.min(loopEnd, systemEnd)
    if (clippedEnd <= clippedStart) continue
    fragments.push({
      systemIndex: system.index,
      startFraction: beatFractionInSystem(system, clippedStart),
      endFraction: beatFractionInSystem(system, clippedEnd),
      startsAtA: loopStart >= system.startBeat && loopStart < systemEnd,
      endsAtB: loopEnd > system.startBeat && loopEnd <= systemEnd,
    })
  }
  return fragments
}

/** Place A/B labels consistently with the fragments they terminate. */
export function sheetLoopMarkers(
  placement: SheetPlacement,
  loopStart: number | null,
  loopEnd: number | null,
): SheetLoopMarker[] {
  const complete =
    loopStart !== null &&
    loopEnd !== null &&
    Number.isFinite(loopStart) &&
    Number.isFinite(loopEnd) &&
    loopEnd > loopStart
  if (complete) {
    const markers: SheetLoopMarker[] = []
    for (const fragment of sheetLoopFragments(placement, loopStart, loopEnd)) {
      if (fragment.startsAtA) {
        markers.push({
          mark: 'A',
          systemIndex: fragment.systemIndex,
          fraction: fragment.startFraction,
        })
      }
      if (fragment.endsAtB) {
        markers.push({
          mark: 'B',
          systemIndex: fragment.systemIndex,
          fraction: fragment.endFraction,
        })
      }
    }
    return markers
  }

  const markers: SheetLoopMarker[] = []
  const addMark = (mark: 'A' | 'B', beat: number | null) => {
    if (beat === null || !Number.isFinite(beat)) return
    const position = locateBeat(placement, beat)
    if (position !== null) markers.push({ mark, ...position })
  }
  addMark('A', loopStart)
  addMark('B', loopEnd)
  return markers
}

/** How far across a system a beat sits, for drawing inside one system only. */
export function beatFractionInSystem(
  system: SheetSystem,
  beat: number,
): number {
  if (system.beats <= 0) return 0
  return clamp01((beat - system.startBeat) / system.beats)
}

const EMPTY_NOTES: readonly GuitarNote[] = []

function systemIndexForBeat(
  systems: readonly SheetSystem[],
  beat: number,
): number | null {
  if (systems.length === 0) return null
  const safeBeat = Number.isFinite(beat) ? beat : 0
  if (safeBeat < 0) return 0

  // Binary search: a long score has thousands of notes and hundreds of systems,
  // and this runs once per note when the placement is built.
  let low = 0
  let high = systems.length - 1
  while (low <= high) {
    const middle = (low + high) >> 1
    const system = systems[middle]
    if (system === undefined) break
    if (safeBeat < system.startBeat) {
      high = middle - 1
    } else if (safeBeat >= system.startBeat + system.beats) {
      low = middle + 1
    } else {
      return middle
    }
  }
  return systems.length - 1
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}
