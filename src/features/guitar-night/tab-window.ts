// Tab-window math keeps dense scores readable without changing the shared 3D camera.
// ============================================================

import type { GuitarNote } from '@/lib/guitar/guitar-synth'

/** Where the now-line sits, leaving a little played history behind it. */
export const TAB_PLAYHEAD_RATIO = 0.18
export const TAB_MIN_WINDOW_BEATS = 3.5
export const TAB_MAX_WINDOW_BEATS = 10
export const TAB_DEFAULT_ZOOM_MULTIPLIER = 1
export const TAB_MIN_ZOOM_MULTIPLIER = 0.75
export const TAB_MAX_ZOOM_MULTIPLIER = 1.8

const EMPTY_TAB_WINDOW_BEATS = 8
const DENSITY_BLOCK_BEATS = 4
const ONSET_TOLERANCE_BEATS = 0.0625
const TARGET_VISIBLE_ONSETS = 9
const TARGET_VISIBLE_SECONDS = 2.35

export interface TabWindowEntry {
  note: GuitarNote
  offsetPercent: number
  isActive: boolean
  isPast: boolean
}

export interface StageTabLoopMarker {
  mark: 'A' | 'B'
  offsetPercent: number
}

export interface StageTabLoopWindow {
  markers: readonly StageTabLoopMarker[]
  range: { leftPercent: number; widthPercent: number } | null
}

export interface StageTabWindowIndex {
  notes: readonly GuitarNote[]
  /** Segment-tree maxima let moving windows skip expired score regions. */
  maxEndTree: readonly number[]
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function fillTabWindowEndTree(
  notes: readonly GuitarNote[],
  tree: number[],
  node: number,
  left: number,
  right: number,
): number {
  if (left === right) {
    const note = notes[left]
    const endBeat =
      note === undefined ? -Infinity : note.startBeat + note.duration
    tree[node] = endBeat
    return endBeat
  }
  const middle = Math.floor((left + right) / 2)
  const endBeat = Math.max(
    fillTabWindowEndTree(notes, tree, node * 2, left, middle),
    fillTabWindowEndTree(notes, tree, node * 2 + 1, middle + 1, right),
  )
  tree[node] = endBeat
  return endBeat
}

/** Compile every rendered note, including backing, for the lightweight Tab lane. */
export function buildStageTabWindowIndex(
  notes: readonly GuitarNote[],
): StageTabWindowIndex {
  const sorted = [...notes].sort(
    (left, right) => left.startBeat - right.startBeat,
  )
  const maxEndTree = Array.from(
    { length: Math.max(1, sorted.length * 4) },
    () => -Infinity,
  )
  if (sorted.length > 0) {
    fillTabWindowEndTree(sorted, maxEndTree, 1, 0, sorted.length - 1)
  }
  return { notes: sorted, maxEndTree }
}

function percentile75(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.ceil(sorted.length * 0.75) - 1
  return sorted[Math.max(0, index)] ?? 0
}

/**
 * Pick one stable whole-score window. Tempo protects anticipation time while
 * distinct onset density prevents chords and stacked parts becoming a wall of
 * overlapping circles. The result never changes as the playhead advances.
 */
export function adaptiveTabWindowBeats(
  notes: readonly GuitarNote[],
  tempoBpm: number | null,
): number {
  const starts = notes
    .map((note) => note.startBeat)
    .filter((beat) => Number.isFinite(beat))
  if (starts.length === 0) return EMPTY_TAB_WINDOW_BEATS

  const firstBeat = starts.reduce(
    (earliest, beat) => Math.min(earliest, beat),
    Infinity,
  )
  const onsetBlocks = new Map<number, Set<number>>()
  for (const beat of starts) {
    const onset = Math.round(beat / ONSET_TOLERANCE_BEATS)
    const block = Math.floor((beat - firstBeat) / DENSITY_BLOCK_BEATS)
    const onsets = onsetBlocks.get(block) ?? new Set<number>()
    onsets.add(onset)
    onsetBlocks.set(block, onsets)
  }
  const onsetDensity = Math.max(
    0.25,
    percentile75(
      [...onsetBlocks.values()].map(
        (onsets) => onsets.size / DENSITY_BLOCK_BEATS,
      ),
    ),
  )
  const safeTempo = clamp(
    tempoBpm !== null && Number.isFinite(tempoBpm) ? tempoBpm : 120,
    40,
    240,
  )
  const timeWindow = clamp((safeTempo * TARGET_VISIBLE_SECONDS) / 60, 4, 9)
  const densityWindow = clamp(
    TARGET_VISIBLE_ONSETS / onsetDensity,
    TAB_MIN_WINDOW_BEATS,
    TAB_MAX_WINDOW_BEATS,
  )
  const blendedWindow = Math.sqrt(timeWindow * densityWindow)
  return (
    Math.round(
      clamp(blendedWindow, TAB_MIN_WINDOW_BEATS, TAB_MAX_WINDOW_BEATS) * 4,
    ) / 4
  )
}

export function clampTabZoomMultiplier(multiplier: number): number {
  const safe = Number.isFinite(multiplier)
    ? multiplier
    : TAB_DEFAULT_ZOOM_MULTIPLIER
  return clamp(
    // Preserve high-resolution wheel and pinch deltas. Rounding each event to
    // the range control's old 5% step made trackpad deltas disappear instead
    // of accumulating into a visible zoom change.
    Math.round(safe * 10_000) / 10_000,
    TAB_MIN_ZOOM_MULTIPLIER,
    TAB_MAX_ZOOM_MULTIPLIER,
  )
}

export function zoomedTabWindowBeats(
  adaptiveWindowBeats: number,
  zoomMultiplier: number,
): number {
  const safeWindow = Number.isFinite(adaptiveWindowBeats)
    ? adaptiveWindowBeats
    : EMPTY_TAB_WINDOW_BEATS
  return clamp(
    safeWindow / clampTabZoomMultiplier(zoomMultiplier),
    TAB_MIN_WINDOW_BEATS,
    TAB_MAX_WINDOW_BEATS,
  )
}

/** A restrained size lift makes closer spacing readable without scaling the room chrome. */
export function tabNoteScale(windowBeats: number): number {
  const safeWindow = clamp(
    Number.isFinite(windowBeats) ? windowBeats : EMPTY_TAB_WINDOW_BEATS,
    TAB_MIN_WINDOW_BEATS,
    TAB_MAX_WINDOW_BEATS,
  )
  return clamp(Math.sqrt(EMPTY_TAB_WINDOW_BEATS / safeWindow), 0.92, 1.24)
}

function tabWindowBounds(
  playheadBeat: number | null,
  windowBeats: number,
): { head: number; start: number; end: number; window: number } {
  const window = Math.max(
    1,
    Number.isFinite(windowBeats) ? windowBeats : EMPTY_TAB_WINDOW_BEATS,
  )
  const head = playheadBeat ?? 0
  const start = head - window * TAB_PLAYHEAD_RATIO
  return { head, start, end: start + window, window }
}

/**
 * Query stable source-note references so Solid can preserve note DOM nodes as
 * the playhead changes. Only membership changes at the moving window edges.
 */
export function tabWindowNotes(
  index: StageTabWindowIndex,
  playheadBeat: number | null,
  windowBeats = EMPTY_TAB_WINDOW_BEATS,
): GuitarNote[] {
  const { start, end } = tabWindowBounds(playheadBeat, windowBeats)
  const notes: GuitarNote[] = []
  if (index.notes.length === 0) return notes

  const visit = (node: number, left: number, right: number) => {
    if ((index.maxEndTree[node] ?? -Infinity) < start) return
    const first = index.notes[left]
    if (first === undefined || first.startBeat > end) return
    if (left !== right) {
      const middle = Math.floor((left + right) / 2)
      visit(node * 2, left, middle)
      visit(node * 2 + 1, middle + 1, right)
      return
    }
    if (first.startBeat + first.duration >= start) notes.push(first)
  }
  visit(1, 0, index.notes.length - 1)
  return notes
}

export function tabNoteOffsetPercent(
  noteStartBeat: number,
  playheadBeat: number | null,
  windowBeats: number,
): number {
  const { start, window } = tabWindowBounds(playheadBeat, windowBeats)
  return ((noteStartBeat - start) / window) * 100
}

/** Compatibility projection for callers that need computed note state. */
export function tabWindowEntries(
  index: StageTabWindowIndex,
  playheadBeat: number | null,
  windowBeats = EMPTY_TAB_WINDOW_BEATS,
): TabWindowEntry[] {
  const { head } = tabWindowBounds(playheadBeat, windowBeats)
  return tabWindowNotes(index, playheadBeat, windowBeats).map((note) => ({
    note,
    offsetPercent: tabNoteOffsetPercent(
      note.startBeat,
      playheadBeat,
      windowBeats,
    ),
    isActive:
      playheadBeat !== null &&
      note.startBeat <= playheadBeat &&
      note.startBeat + note.duration > playheadBeat,
    isPast: playheadBeat !== null && note.startBeat + note.duration <= head,
  }))
}

/** Place read-only A/B context on the exact moving beat window used by Tab. */
export function tabLoopWindow(
  loopStart: number | null,
  loopEnd: number | null,
  playheadBeat: number | null,
  windowBeats = EMPTY_TAB_WINDOW_BEATS,
): StageTabLoopWindow {
  const {
    start: windowStart,
    end: windowEnd,
    window,
  } = tabWindowBounds(playheadBeat, windowBeats)
  const marker = (
    mark: 'A' | 'B',
    beat: number | null,
  ): StageTabLoopMarker | null => {
    if (
      beat === null ||
      !Number.isFinite(beat) ||
      beat < windowStart ||
      beat > windowEnd
    ) {
      return null
    }
    return {
      mark,
      offsetPercent: ((beat - windowStart) / window) * 100,
    }
  }
  const markers = [marker('A', loopStart), marker('B', loopEnd)].filter(
    (value): value is StageTabLoopMarker => value !== null,
  )
  if (
    loopStart === null ||
    loopEnd === null ||
    !Number.isFinite(loopStart) ||
    !Number.isFinite(loopEnd) ||
    loopEnd <= loopStart ||
    loopEnd <= windowStart ||
    loopStart >= windowEnd
  ) {
    return { markers, range: null }
  }
  const clippedStart = Math.max(windowStart, loopStart)
  const clippedEnd = Math.min(windowEnd, loopEnd)
  const leftPercent = ((clippedStart - windowStart) / window) * 100
  return {
    markers,
    range: {
      leftPercent,
      widthPercent: ((clippedEnd - clippedStart) / window) * 100,
    },
  }
}
