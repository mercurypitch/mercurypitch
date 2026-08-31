// ============================================================
// Drum pattern format — a readable sixteenth grid that becomes a real session
// ============================================================
//
// Patterns are authored as one string per voice so a groove reads like a drum
// machine on the page and diffs a line at a time. Parsing is total: an unknown
// symbol is reported rather than thrown, because a catalog typo must not take
// the room down. `drum-pattern-library.test.ts` is what makes a typo fail.
//
// The grid is deliberately straight. Swing, micro-timing and ghost shaping are
// the feel engine's job (see ../groove/groove-humanize.ts), so a jazz pattern
// authored on straight eighths still swings when the room asks it to.

import type { DrumVoiceId } from '@/lib/drum-voices'
import type { MidiSong, MidiSongPercussionHit, MidiSongPercussionTrack, } from '@/lib/midi-song'
import type { HumanizeStyle } from '../groove/groove-humanize'
import type { DrumSessionDocument } from '../session/drum-session'
import { drumSessionStateFromSong } from '../session/drum-session'

export type DrumPatternStyle = HumanizeStyle

export const DRUM_PATTERN_STEPS_PER_BAR = 16
export const DRUM_PATTERN_STEP_BEATS = 0.25

/**
 * Grid symbols. Three dynamics is the whole vocabulary: anything finer is a
 * performance detail the humanizer owns, not something a pattern should pin.
 */
export const DRUM_PATTERN_SYMBOL_VELOCITIES: Readonly<Record<string, number>> =
  Object.freeze({
    X: 114,
    x: 88,
    o: 42,
  })

const REST_SYMBOLS = new Set(['-', '.', ' '])
/** Bar dividers are decoration for the human reading the string. */
const DIVIDER_SYMBOLS = new Set(['|'])

/**
 * The one GM key each voice is written back to. Every entry round-trips through
 * `drumVoiceForMidi`, which `drum-pattern.test.ts` pins.
 */
export const DRUM_PATTERN_GM_KEYS: Readonly<Record<DrumVoiceId, number>> =
  Object.freeze({
    kick: 36,
    snare: 38,
    sidestick: 37,
    clap: 39,
    'hh-closed': 42,
    'hh-pedal': 44,
    'hh-open': 46,
    'tom-low': 45,
    'tom-mid': 47,
    'tom-high': 48,
    crash: 49,
    ride: 51,
  })

export interface DrumPatternProvenance {
  /** Shown beside the pattern. Names a person or a corpus, never a vibe. */
  readonly attribution: string
  /** SPDX identifier, or `original` for grooves written for this app. */
  readonly license: string
}

export interface DrumPattern {
  readonly id: string
  readonly name: string
  readonly style: DrumPatternStyle
  /** One sentence a drummer would recognise, not marketing copy. */
  readonly description: string
  readonly bars: number
  readonly tempoBpm: number
  /** Inclusive tempo window this groove still reads as itself. */
  readonly tempoRange: readonly [number, number]
  readonly lanes: Readonly<Partial<Record<DrumVoiceId, string>>>
  readonly provenance: DrumPatternProvenance
}

export interface DrumPatternCell {
  readonly step: number
  readonly velocity: number
}

export interface DrumPatternLaneReading {
  readonly cells: readonly DrumPatternCell[]
  /** Symbols outside the vocabulary, in the order met. Empty when clean. */
  readonly invalidSymbols: readonly string[]
  /** Playable positions after dividers and padding are discarded. */
  readonly stepCount: number
}

export interface DrumPatternIssue {
  readonly voice: DrumVoiceId
  readonly kind: 'invalid-symbol' | 'length-mismatch'
  readonly detail: string
}

/**
 * Reads one lane. Dividers are dropped before indexing, so `|` never shifts the
 * grid, and a trailing short lane simply stops early rather than wrapping.
 */
export function parseDrumPatternLane(lane: string): DrumPatternLaneReading {
  const cells: DrumPatternCell[] = []
  const invalidSymbols: string[] = []
  let step = 0
  for (const symbol of lane) {
    if (DIVIDER_SYMBOLS.has(symbol)) continue
    if (REST_SYMBOLS.has(symbol)) {
      step += 1
      continue
    }
    const velocity = DRUM_PATTERN_SYMBOL_VELOCITIES[symbol]
    if (velocity === undefined) {
      invalidSymbols.push(symbol)
      step += 1
      continue
    }
    cells.push({ step, velocity })
    step += 1
  }
  return { cells, invalidSymbols, stepCount: step }
}

/** Structural problems a catalog entry must not ship with. */
export function drumPatternIssues(
  pattern: DrumPattern,
): readonly DrumPatternIssue[] {
  const expected = pattern.bars * DRUM_PATTERN_STEPS_PER_BAR
  const issues: DrumPatternIssue[] = []
  for (const [voice, lane] of Object.entries(pattern.lanes)) {
    if (lane === undefined) continue
    const reading = parseDrumPatternLane(lane)
    if (reading.invalidSymbols.length > 0) {
      issues.push({
        voice: voice as DrumVoiceId,
        kind: 'invalid-symbol',
        detail: [...new Set(reading.invalidSymbols)].join(''),
      })
    }
    if (reading.stepCount !== expected) {
      issues.push({
        voice: voice as DrumVoiceId,
        kind: 'length-mismatch',
        detail: `${reading.stepCount} of ${expected}`,
      })
    }
  }
  return issues
}

export function drumPatternDurationBeats(pattern: DrumPattern): number {
  return pattern.bars * DRUM_PATTERN_STEPS_PER_BAR * DRUM_PATTERN_STEP_BEATS
}

function laneWrittenDuration(voice: DrumVoiceId): number {
  // Sustaining metals hold their written value; drums are struck and released.
  return voice === 'crash' || voice === 'ride' || voice === 'hh-open'
    ? 0.5
    : 0.25
}

/**
 * Flattens the grid into ordered percussion hits. Ordering is stable across
 * runs (beat, then voice name) so a pattern always produces the same document.
 */
export function drumPatternHits(
  pattern: DrumPattern,
): readonly MidiSongPercussionHit[] {
  const hits: MidiSongPercussionHit[] = []
  const voices = Object.keys(pattern.lanes).sort() as DrumVoiceId[]
  for (const voice of voices) {
    const lane = pattern.lanes[voice]
    if (lane === undefined) continue
    const gmKey = DRUM_PATTERN_GM_KEYS[voice]
    const written = laneWrittenDuration(voice)
    for (const [index, cell] of parseDrumPatternLane(lane).cells.entries()) {
      hits.push({
        id: `${voice}-${String(index + 1).padStart(2, '0')}`,
        gmKey,
        velocity: cell.velocity,
        startBeat: cell.step * DRUM_PATTERN_STEP_BEATS,
        writtenDuration: written,
      })
    }
  }
  return hits.sort(
    (left, right) =>
      left.startBeat - right.startBeat ||
      (left.id ?? '').localeCompare(right.id ?? ''),
  )
}

export interface DrumPatternGridHit {
  readonly gmKey: number
  readonly stepIndex: number
  readonly velocity: number
  readonly writtenDuration: number
}

/**
 * The same grid expressed for the groove editor's step model. `stepLimit` clips
 * a two-bar pattern onto a one-bar draft rather than failing the whole load —
 * the picker names the bar count so the trim is never a surprise.
 */
export function drumPatternGridHits(
  pattern: DrumPattern,
  stepLimit?: number,
): readonly DrumPatternGridHit[] {
  const limit =
    stepLimit !== undefined && Number.isFinite(stepLimit) && stepLimit > 0
      ? Math.floor(stepLimit)
      : Number.POSITIVE_INFINITY
  const grid: DrumPatternGridHit[] = []
  const voices = Object.keys(pattern.lanes).sort() as DrumVoiceId[]
  for (const voice of voices) {
    const lane = pattern.lanes[voice]
    if (lane === undefined) continue
    for (const cell of parseDrumPatternLane(lane).cells) {
      if (cell.step >= limit) continue
      grid.push({
        gmKey: DRUM_PATTERN_GM_KEYS[voice],
        stepIndex: cell.step,
        velocity: cell.velocity,
        writtenDuration: laneWrittenDuration(voice),
      })
    }
  }
  return grid.sort(
    (left, right) =>
      left.stepIndex - right.stepIndex || left.gmKey - right.gmKey,
  )
}

export function drumPatternSong(pattern: DrumPattern): MidiSong {
  const hits = drumPatternHits(pattern)
  const track: MidiSongPercussionTrack = {
    id: pattern.id,
    kind: 'percussion',
    name: pattern.name,
    instrumentName: 'General MIDI Drum Kit',
    noteCount: hits.length,
    notes: [],
    percussionHits: [...hits],
    droppedHitCount: 0,
  }
  return {
    bpm: pattern.tempoBpm,
    tempoChanges: [{ beat: 0, usPerBeat: 60_000_000 / pattern.tempoBpm }],
    timeSignatures: [{ beat: 0, numerator: 4, denominator: 4 }],
    tracks: [track],
  }
}

/**
 * Builds the canonical document the scheduler, Score, Seat and Coach all read.
 * Returns null for a pattern with no playable hit rather than inventing one.
 */
export function createDrumPatternDocument(
  pattern: DrumPattern,
): DrumSessionDocument | null {
  const state = drumSessionStateFromSong({
    song: drumPatternSong(pattern),
    title: pattern.name,
    fileName: `${pattern.id}.pattern`,
    sourceFormat: 'prepared',
  })
  return state.status === 'ready' ? state.document : null
}
