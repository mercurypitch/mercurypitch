// ============================================================
// Drum Night score — whole-song index with bounded local queries
// ============================================================
//
// The canonical song remains complete. Each percussion track receives a
// reusable binary-search index, then score windows and coaching ranges merge
// only the requested hits into a bounded result. A dense opening can therefore
// never hide a valid late phrase or create an unbounded DOM.

import type { MidiBar, MidiTimeSignature } from '@/lib/midi-bars'
import { barIndexAtBeat, buildBars, normalizeTimeSignatures, } from '@/lib/midi-bars'
import type { MidiSongPercussionHit } from '@/lib/midi-song'
import { generalMidiPercussionName } from '@/lib/percussion'
import type { DrumSessionDocument } from './drum-session'

export const MAX_DRUM_SCORE_EVENTS = 2048
export const MAX_DRUM_SEMANTIC_EVENTS = 100
export const MAX_DRUM_GROOVE_STEPS = 4096

export type DrumVoiceFamily =
  | 'kick'
  | 'snare'
  | 'hi-hat'
  | 'tom'
  | 'cymbal'
  | 'auxiliary'

export type DrumSeatAnchor =
  | 'kick'
  | 'snare'
  | 'hi-hat'
  | 'tom-left'
  | 'tom-centre'
  | 'tom-right'
  | 'ride'
  | 'crash'
  | 'auxiliary'

export type DrumNotehead = 'normal' | 'cross' | 'diamond'

export interface DrumScoreVoice {
  readonly id: string
  readonly gmKey: number
  readonly label: string
  readonly shortLabel: string
  readonly family: DrumVoiceFamily
  readonly seatAnchor: DrumSeatAnchor
  /** Percussion staff steps, where zero is the middle line. */
  readonly staffStep: number
  readonly notehead: DrumNotehead
  readonly stemDirection: 'up' | 'down'
}

export interface DrumScoreEvent {
  readonly id: string
  readonly trackId: string
  readonly trackName: string
  readonly hit: MidiSongPercussionHit
  readonly voice: DrumScoreVoice
  readonly barIndex: number
  readonly beatInBar: number
}

export interface DrumScoreDocument {
  readonly title: string
  /** Opening tempo. Later authored tempo changes remain on canonicalSong. */
  readonly bpm: number
  readonly tempoChangeCount: number
  readonly timeSignatures: readonly MidiTimeSignature[]
  readonly bars: readonly MidiBar[]
  readonly voices: readonly DrumScoreVoice[]
  /** All safely mapped canonical hits, including out-of-range source rows. */
  readonly hitCount: number
  /** Hits directly queryable inside the bounded bar map. */
  readonly queryableHitCount: number
  /** Hits beyond the maximum authored bar coverage; never folded into bar 4096. */
  readonly outOfRangeHitCount: number
  readonly droppedHitCount: number
  /** Exact last authored attack plus written duration, in quarter-note beats. */
  readonly durationBeats: number
  /** End of the bounded bar index, in quarter-note beats. */
  readonly coverageEndBeat: number
}

interface IndexedHitReference {
  readonly hit: MidiSongPercussionHit
  readonly sourceIndex: number
}

export interface DrumScoreTrackIndex {
  readonly trackOrder: number
  readonly trackId: string
  readonly trackName: string
  readonly hits: readonly IndexedHitReference[]
  readonly startBeats: readonly number[]
  readonly queryableEndIndex: number
}

export interface DrumScoreIndex {
  readonly score: DrumScoreDocument
  readonly tracks: readonly DrumScoreTrackIndex[]
  readonly barStartBeats: readonly number[]
}

export interface DrumScoreEventQuery {
  readonly startBeat: number
  readonly endBeat: number
  readonly sourceEventCount: number
  readonly events: readonly DrumScoreEvent[]
  readonly omittedEventCount: number
}

export interface DrumScoreWindow extends DrumScoreEventQuery {
  readonly startBarIndex: number
  readonly endBarIndex: number
  readonly bars: readonly MidiBar[]
  readonly semanticEvents: readonly DrumScoreEvent[]
  readonly semanticOmittedCount: number
}

export interface DrumGrooveHit {
  readonly event: DrumScoreEvent
  readonly gridBeat: number
  readonly offsetBeats: number
}

export interface DrumGrooveStep {
  readonly index: number
  readonly beat: number
  readonly hits: readonly DrumGrooveHit[]
  readonly peakVelocity: number
}

export interface DrumGrooveProjection {
  readonly startBeat: number
  readonly endBeat: number
  readonly subdivisionBeats: number
  readonly steps: readonly DrumGrooveStep[]
  readonly offGridHitCount: number
  readonly omittedHitCount: number
  /** True when the requested range exceeded the bounded groove grid. */
  readonly rangeTruncated: boolean
}

interface MergeCursor {
  readonly track: DrumScoreTrackIndex
  readonly endIndex: number
  position: number
}

function isOneOf(gmKey: number, values: readonly number[]): boolean {
  return values.includes(gmKey)
}

function shortVoiceLabel(gmKey: number, family: DrumVoiceFamily): string {
  if (family === 'hi-hat') return 'HH'
  if (family === 'kick') return 'K'
  if (family === 'snare') return 'SN'
  if (family === 'tom') return `T${gmKey}`
  if (family === 'cymbal') return isOneOf(gmKey, [49, 55, 57]) ? 'CR' : 'CYM'
  return `P${gmKey}`
}

/** Stable notation and seat placement for one bounded GM articulation. */
export function drumScoreVoiceForGmKey(gmKey: number): DrumScoreVoice {
  let family: DrumVoiceFamily = 'auxiliary'
  let seatAnchor: DrumSeatAnchor = 'auxiliary'
  let staffStep = 3
  let notehead: DrumNotehead = 'diamond'

  if (isOneOf(gmKey, [35, 36])) {
    family = 'kick'
    seatAnchor = 'kick'
    staffStep = -4
    notehead = 'normal'
  } else if (isOneOf(gmKey, [37, 38, 39, 40])) {
    family = 'snare'
    seatAnchor = 'snare'
    staffStep = 0
    notehead = gmKey === 37 ? 'cross' : 'normal'
  } else if (isOneOf(gmKey, [42, 44, 46])) {
    family = 'hi-hat'
    seatAnchor = 'hi-hat'
    staffStep = 5
    notehead = 'cross'
  } else if (isOneOf(gmKey, [41, 43, 45, 47, 48, 50])) {
    family = 'tom'
    notehead = 'normal'
    if (gmKey <= 43) {
      seatAnchor = 'tom-right'
      staffStep = -2
    } else if (gmKey <= 47) {
      seatAnchor = 'tom-centre'
      staffStep = 1
    } else {
      seatAnchor = 'tom-left'
      staffStep = 3
    }
  } else if (isOneOf(gmKey, [49, 51, 52, 53, 55, 57, 59])) {
    family = 'cymbal'
    seatAnchor = isOneOf(gmKey, [49, 55, 57]) ? 'crash' : 'ride'
    staffStep = seatAnchor === 'crash' ? 6 : 4
    notehead = 'cross'
  }

  return {
    id: `gm-${gmKey}`,
    gmKey,
    label: generalMidiPercussionName(gmKey),
    shortLabel: shortVoiceLabel(gmKey, family),
    family,
    seatAnchor,
    staffStep,
    notehead,
    stemDirection: staffStep >= 0 ? 'down' : 'up',
  }
}

function scoreSpan(document: DrumSessionDocument): number {
  return Math.max(0.25, document.durationBeats + 0.25)
}

function lowerBound(values: readonly number[], target: number): number {
  let low = 0
  let high = values.length
  while (low < high) {
    const mid = (low + high) >> 1
    if ((values[mid] ?? Number.POSITIVE_INFINITY) < target) low = mid + 1
    else high = mid
  }
  return low
}

function upperBound(values: readonly number[], target: number): number {
  let low = 0
  let high = values.length
  while (low < high) {
    const mid = (low + high) >> 1
    if ((values[mid] ?? Number.POSITIVE_INFINITY) <= target) low = mid + 1
    else high = mid
  }
  return low
}

function countTempoChanges(document: DrumSessionDocument): number {
  return (document.canonicalSong.tempoChanges ?? []).filter(
    (change) =>
      Number.isFinite(change.beat) &&
      change.beat > 0 &&
      Number.isFinite(change.usPerBeat) &&
      change.usPerBeat > 0,
  ).length
}

/** Project whole-song metadata without truncating canonical hit identity. */
export function projectDrumScore(
  document: DrumSessionDocument,
): DrumScoreDocument {
  const bars = buildBars(
    scoreSpan(document),
    document.canonicalSong.timeSignatures,
  )
  const finalBar = bars.at(-1)
  const coverageEndBeat =
    finalBar === undefined ? 0 : finalBar.startBeat + finalBar.beats
  const voiceByKey = new Map<number, DrumScoreVoice>()
  let queryableHitCount = 0
  let outOfRangeHitCount = 0

  for (const track of document.percussionTracks) {
    for (const hit of track.percussionHits) {
      if (hit.startBeat >= coverageEndBeat) {
        outOfRangeHitCount += 1
        continue
      }
      queryableHitCount += 1
      if (!voiceByKey.has(hit.gmKey)) {
        voiceByKey.set(hit.gmKey, drumScoreVoiceForGmKey(hit.gmKey))
      }
    }
  }

  return {
    title: document.title,
    bpm: document.canonicalSong.bpm,
    tempoChangeCount: countTempoChanges(document),
    timeSignatures: normalizeTimeSignatures(
      document.canonicalSong.timeSignatures,
    ),
    bars,
    voices: [...voiceByKey.values()].sort(
      (left, right) =>
        right.staffStep - left.staffStep || left.gmKey - right.gmKey,
    ),
    hitCount: document.hitCount,
    queryableHitCount,
    outOfRangeHitCount,
    droppedHitCount: document.droppedHitCount,
    durationBeats: document.durationBeats,
    coverageEndBeat,
  }
}

function compareHitReferences(
  left: IndexedHitReference,
  right: IndexedHitReference,
): number {
  return (
    left.hit.startBeat - right.hit.startBeat ||
    left.sourceIndex - right.sourceIndex
  )
}

/** Build reusable per-track binary-search indexes over the complete song. */
export function createDrumScoreIndex(
  document: DrumSessionDocument,
): DrumScoreIndex {
  const score = projectDrumScore(document)
  const tracks = document.percussionTracks.map(
    (track, trackOrder): DrumScoreTrackIndex => {
      const hits = track.percussionHits
        .map((hit, sourceIndex) => ({ hit, sourceIndex }))
        .sort(compareHitReferences)
      const startBeats = hits.map((reference) => reference.hit.startBeat)
      return {
        trackOrder,
        trackId: track.id,
        trackName: track.name,
        hits,
        startBeats,
        queryableEndIndex: lowerBound(startBeats, score.coverageEndBeat),
      }
    },
  )
  return {
    score,
    tracks,
    barStartBeats: score.bars.map((bar) => bar.startBeat),
  }
}

function currentReference(cursor: MergeCursor): IndexedHitReference | null {
  return cursor.track.hits[cursor.position] ?? null
}

function compareCursors(left: MergeCursor, right: MergeCursor): number {
  const leftReference = currentReference(left)
  const rightReference = currentReference(right)
  if (leftReference === null) return 1
  if (rightReference === null) return -1
  return (
    leftReference.hit.startBeat - rightReference.hit.startBeat ||
    left.track.trackOrder - right.track.trackOrder ||
    leftReference.sourceIndex - rightReference.sourceIndex ||
    left.track.trackId.localeCompare(right.track.trackId)
  )
}

function pushCursor(heap: MergeCursor[], cursor: MergeCursor): void {
  heap.push(cursor)
  let index = heap.length - 1
  while (index > 0) {
    const parent = (index - 1) >> 1
    const parentCursor = heap[parent]
    const value = heap[index]
    if (
      parentCursor === undefined ||
      value === undefined ||
      compareCursors(parentCursor, value) <= 0
    ) {
      return
    }
    heap[parent] = value
    heap[index] = parentCursor
    index = parent
  }
}

function popCursor(heap: MergeCursor[]): MergeCursor | null {
  const first = heap[0]
  const last = heap.pop()
  if (first === undefined) return null
  if (heap.length === 0 || last === undefined) return first
  heap[0] = last
  let index = 0
  while (true) {
    const left = index * 2 + 1
    const right = left + 1
    let smallest = index
    const leftCursor = heap[left]
    const smallestCursor = heap[smallest]
    if (
      leftCursor !== undefined &&
      smallestCursor !== undefined &&
      compareCursors(leftCursor, smallestCursor) < 0
    ) {
      smallest = left
    }
    const rightCursor = heap[right]
    const nextSmallest = heap[smallest]
    if (
      rightCursor !== undefined &&
      nextSmallest !== undefined &&
      compareCursors(rightCursor, nextSmallest) < 0
    ) {
      smallest = right
    }
    if (smallest === index) return first
    const value = heap[index]
    const replacement = heap[smallest]
    if (value === undefined || replacement === undefined) return first
    heap[index] = replacement
    heap[smallest] = value
    index = smallest
  }
}

function scoreEvent(
  score: DrumScoreDocument,
  track: DrumScoreTrackIndex,
  reference: IndexedHitReference,
): DrumScoreEvent | null {
  const barIndex = barIndexAtBeat(score.bars, reference.hit.startBeat)
  const bar = score.bars[barIndex]
  if (bar === undefined || reference.hit.startBeat >= score.coverageEndBeat) {
    return null
  }
  return {
    id: reference.hit.id ?? `${track.trackId}-hit-${reference.sourceIndex}`,
    trackId: track.trackId,
    trackName: track.trackName,
    hit: reference.hit,
    voice: drumScoreVoiceForGmKey(reference.hit.gmKey),
    barIndex,
    beatInBar: reference.hit.startBeat - bar.startBeat,
  }
}

/** Binary-search every track, then merge only one bounded requested range. */
export function queryDrumScoreRange(
  index: DrumScoreIndex,
  options: {
    readonly startBeat: number
    readonly endBeat: number
    readonly inclusiveEnd?: boolean
    readonly maximumEvents?: number
  },
): DrumScoreEventQuery {
  const startBeat = Number.isFinite(options.startBeat)
    ? Math.max(0, options.startBeat)
    : 0
  const requestedEnd = Number.isFinite(options.endBeat)
    ? Math.max(startBeat, options.endBeat)
    : startBeat
  const endBeat = requestedEnd
  const maximumEvents = Math.min(
    MAX_DRUM_SCORE_EVENTS,
    Math.max(0, Math.floor(options.maximumEvents ?? MAX_DRUM_SCORE_EVENTS)),
  )
  const heap: MergeCursor[] = []
  let sourceEventCount = 0

  for (const track of index.tracks) {
    const sourceStartIndex = lowerBound(track.startBeats, startBeat)
    const requestedEndIndex =
      options.inclusiveEnd === true
        ? upperBound(track.startBeats, endBeat)
        : lowerBound(track.startBeats, endBeat)
    sourceEventCount += Math.max(0, requestedEndIndex - sourceStartIndex)
    const startIndex = Math.min(track.queryableEndIndex, sourceStartIndex)
    const endIndex = Math.min(track.queryableEndIndex, requestedEndIndex)
    if (startIndex < endIndex) {
      pushCursor(heap, { track, position: startIndex, endIndex })
    }
  }

  const events: DrumScoreEvent[] = []
  while (heap.length > 0 && events.length < maximumEvents) {
    const cursor = popCursor(heap)
    if (cursor === null) break
    const reference = currentReference(cursor)
    if (reference !== null) {
      const event = scoreEvent(index.score, cursor.track, reference)
      if (event !== null) events.push(event)
    }
    cursor.position += 1
    if (cursor.position < cursor.endIndex) pushCursor(heap, cursor)
  }

  return {
    startBeat,
    endBeat,
    sourceEventCount,
    events,
    omittedEventCount: Math.max(0, sourceEventCount - events.length),
  }
}

/** Events at the playhead, found by per-track binary search and bounded merge. */
export function drumScoreEventsNearBeat(
  index: DrumScoreIndex,
  beat: number,
  toleranceBeats = 0.06,
): DrumScoreEventQuery {
  const safeBeat = Number.isFinite(beat) ? Math.max(0, beat) : 0
  const tolerance = Number.isFinite(toleranceBeats)
    ? Math.max(0, toleranceBeats)
    : 0
  return queryDrumScoreRange(index, {
    startBeat: Math.max(0, safeBeat - tolerance),
    endBeat: safeBeat + tolerance,
    inclusiveEnd: true,
  })
}

/** First queryable event strictly after the playhead, across every track. */
export function drumScoreNextEvent(
  index: DrumScoreIndex,
  beat: number,
): DrumScoreEvent | null {
  const safeBeat = Number.isFinite(beat) ? Math.max(0, beat) : 0
  let selected:
    | { readonly track: DrumScoreTrackIndex; readonly position: number }
    | undefined
  for (const track of index.tracks) {
    const position = upperBound(track.startBeats, safeBeat)
    if (position >= track.queryableEndIndex) continue
    if (selected === undefined) {
      selected = { track, position }
      continue
    }
    const candidate: MergeCursor = {
      track,
      position,
      endIndex: position + 1,
    }
    const current: MergeCursor = {
      track: selected.track,
      position: selected.position,
      endIndex: selected.position + 1,
    }
    if (compareCursors(candidate, current) < 0) selected = { track, position }
  }
  if (selected === undefined) return null
  const reference = selected.track.hits[selected.position]
  return reference === undefined
    ? null
    : scoreEvent(index.score, selected.track, reference)
}

/** Return a stable two- or four-bar page with locally bounded event lists. */
export function drumScoreWindow(
  index: DrumScoreIndex,
  beat: number,
  options: {
    readonly barCount?: 2 | 4
    readonly semanticLimit?: number
  } = {},
): DrumScoreWindow {
  const score = index.score
  const barCount = options.barCount ?? 4
  const semanticLimit = Math.min(
    MAX_DRUM_SEMANTIC_EVENTS,
    Math.max(0, Math.floor(options.semanticLimit ?? MAX_DRUM_SEMANTIC_EVENTS)),
  )
  const currentBar = barIndexAtBeat(score.bars, beat)
  const pageStart = Math.floor(currentBar / barCount) * barCount
  const startBarIndex = Math.min(pageStart, Math.max(0, score.bars.length - 1))
  const bars = score.bars.slice(startBarIndex, startBarIndex + barCount)
  const firstBar = bars[0]
  const lastBar = bars.at(-1)
  const startBeat = firstBar?.startBeat ?? 0
  const endBeat =
    lastBar === undefined
      ? startBeat
      : lastBar.startBeat + Math.max(0, lastBar.beats)
  const query = queryDrumScoreRange(index, { startBeat, endBeat })
  const semanticEvents = query.events.slice(0, semanticLimit)

  return {
    ...query,
    startBarIndex,
    endBarIndex: startBarIndex + Math.max(0, bars.length - 1),
    bars,
    semanticEvents,
    semanticOmittedCount: Math.max(
      0,
      query.events.length - semanticEvents.length,
    ),
  }
}

/** Map authored beat time onto equal-width written bars for the full score. */
export function drumScoreBeatX(
  score: DrumScoreDocument,
  beat: number,
  barWidth: number,
  left: number,
): number {
  const safeBeat = Number.isFinite(beat) ? Math.max(0, beat) : 0
  const barIndex = barIndexAtBeat(score.bars, safeBeat)
  const bar = score.bars[barIndex] ?? score.bars[0]
  if (bar === undefined) return left
  const progress = Math.min(
    1,
    Math.max(0, (safeBeat - bar.startBeat) / Math.max(0.001, bar.beats)),
  )
  return left + bar.index * barWidth + progress * barWidth
}

/** Map a beat inside a bounded score page, using page-local bar positions. */
export function drumScoreWindowBeatX(
  window: DrumScoreWindow,
  beat: number,
  barWidth: number,
  left: number,
): number {
  if (window.bars.length === 0) return left
  const safeBeat = Number.isFinite(beat)
    ? Math.min(window.endBeat, Math.max(window.startBeat, beat))
    : window.startBeat
  const localBarIndex = barIndexAtBeat(window.bars, safeBeat)
  const bar = window.bars[localBarIndex] ?? window.bars[0]
  if (bar === undefined) return left
  const progress = Math.min(
    1,
    Math.max(0, (safeBeat - bar.startBeat) / Math.max(0.001, bar.beats)),
  )
  return left + localBarIndex * barWidth + progress * barWidth
}

/** Quantise one requested range while retaining its authored offsets. */
export function projectDrumGroove(
  document: DrumSessionDocument,
  options: {
    readonly startBeat?: number
    readonly endBeat?: number
    readonly subdivisionBeats?: number
  } = {},
): DrumGrooveProjection {
  const index = createDrumScoreIndex(document)
  const score = index.score
  const subdivisionBeats =
    Number.isFinite(options.subdivisionBeats) &&
    (options.subdivisionBeats ?? 0) > 0
      ? options.subdivisionBeats!
      : 0.25
  const startBeat = Math.max(0, options.startBeat ?? 0)
  const requestedEndBeat = Math.max(
    startBeat,
    Math.min(score.durationBeats, options.endBeat ?? score.durationBeats),
  )
  const maximumEndBeat = startBeat + subdivisionBeats * MAX_DRUM_GROOVE_STEPS
  const endBeat = Math.min(requestedEndBeat, maximumEndBeat)
  const rangeTruncated = endBeat < requestedEndBeat
  const stepCount = Math.ceil((endBeat - startBeat) / subdivisionBeats)
  const stepHits = Array.from({ length: stepCount }, (): DrumGrooveHit[] => [])
  let offGridHitCount = 0
  const query = queryDrumScoreRange(index, { startBeat, endBeat })

  if (stepHits.length > 0) {
    for (const event of query.events) {
      const relative = event.hit.startBeat - startBeat
      const stepIndex = Math.min(
        stepHits.length - 1,
        Math.max(0, Math.round(relative / subdivisionBeats)),
      )
      const gridBeat = startBeat + stepIndex * subdivisionBeats
      const offsetBeats = event.hit.startBeat - gridBeat
      if (Math.abs(offsetBeats) > 1e-6) offGridHitCount += 1
      stepHits[stepIndex]?.push({ event, gridBeat, offsetBeats })
    }
  }

  return {
    startBeat,
    endBeat,
    subdivisionBeats,
    steps: stepHits.map((hits, stepIndex) => ({
      index: stepIndex,
      beat: startBeat + stepIndex * subdivisionBeats,
      hits,
      peakVelocity: hits.reduce(
        (peak, hit) => Math.max(peak, hit.event.hit.velocity),
        0,
      ),
    })),
    offGridHitCount,
    omittedHitCount: query.omittedEventCount,
    rangeTruncated,
  }
}
