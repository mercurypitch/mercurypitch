// ============================================================
// Guitar Night percussion window — bounded one-shot stage references
// ============================================================
//
// A full imported drum track can contain tens of thousands of attacks. Compile
// it once, then expose only the nearby one-shots a compact stage preview can
// render without scanning or mounting the whole song on every clock tick.

import type { MidiSongPercussionHit } from '@/lib/midi-song'
import { TAB_PLAYHEAD_RATIO } from './tab-window'

export const MAX_PERCUSSION_WINDOW_HITS = 192

export interface PercussionWindowIndex {
  readonly hits: readonly MidiSongPercussionHit[]
  readonly startBeats: readonly number[]
}

export interface PercussionWindowQuery {
  readonly hits: readonly MidiSongPercussionHit[]
  readonly sourceHitCount: number
  readonly omittedHitCount: number
}

function lowerBound(values: readonly number[], target: number): number {
  let low = 0
  let high = values.length
  while (low < high) {
    const middle = (low + high) >> 1
    if ((values[middle] ?? Number.POSITIVE_INFINITY) < target) {
      low = middle + 1
    } else {
      high = middle
    }
  }
  return low
}

function upperBound(values: readonly number[], target: number): number {
  let low = 0
  let high = values.length
  while (low < high) {
    const middle = (low + high) >> 1
    if ((values[middle] ?? Number.POSITIVE_INFINITY) <= target) {
      low = middle + 1
    } else {
      high = middle
    }
  }
  return low
}

/** Sort once without mutating the canonical imported track or hit objects. */
export function buildPercussionWindowIndex(
  hits: readonly MidiSongPercussionHit[],
): PercussionWindowIndex {
  const sorted = hits
    .filter((hit) => Number.isFinite(hit.startBeat))
    .slice()
    .sort((left, right) => left.startBeat - right.startBeat)
  return {
    hits: sorted,
    startBeats: sorted.map((hit) => hit.startBeat),
  }
}

/** Query the same ahead/behind window as moving Tab, with a hard DOM ceiling. */
export function queryPercussionWindow(
  index: PercussionWindowIndex,
  playheadBeat: number,
  windowBeats: number,
  maxHits = MAX_PERCUSSION_WINDOW_HITS,
): PercussionWindowQuery {
  const window = Math.max(1, Number.isFinite(windowBeats) ? windowBeats : 1)
  const head = Number.isFinite(playheadBeat) ? playheadBeat : 0
  const start = head - window * TAB_PLAYHEAD_RATIO
  const end = start + window
  const startIndex = lowerBound(index.startBeats, start)
  const endIndex = upperBound(index.startBeats, end)
  const sourceHitCount = Math.max(0, endIndex - startIndex)
  const safeLimit = Number.isFinite(maxHits)
    ? Math.max(0, Math.floor(maxHits))
    : MAX_PERCUSSION_WINDOW_HITS
  const visibleEnd = Math.min(endIndex, startIndex + safeLimit)

  return {
    hits: index.hits.slice(startIndex, visibleEnd),
    sourceHitCount,
    omittedHitCount: Math.max(0, sourceHitCount - safeLimit),
  }
}
