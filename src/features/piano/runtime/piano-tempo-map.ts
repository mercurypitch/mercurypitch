// ============================================================
// Piano tempo map — compiled beat/time authority for performance runtimes
// ============================================================
//
// MIDI tempo events are discrete changes in score time. Compilation resolves
// ordering and duplicate boundaries once, then beat/time queries use binary
// search instead of integrating the map on every animation or scheduler tick.

export const DEFAULT_PIANO_TEMPO_BPM = 120

export interface PianoTempoMapEvent {
  readonly beat: number
  readonly bpm: number
}

export interface CompiledPianoTempoPoint extends PianoTempoMapEvent {
  /** Authored score seconds elapsed when this tempo becomes active. */
  readonly authoredSeconds: number
}

export interface CompiledPianoTempoMap {
  readonly initialTempoBpm: number
  readonly points: readonly CompiledPianoTempoPoint[]
}

interface OrderedTempoEvent extends PianoTempoMapEvent {
  readonly sourceOrder: number
}

function isValidEvent(event: PianoTempoMapEvent): boolean {
  return (
    Number.isFinite(event.beat) &&
    event.beat >= 0 &&
    Number.isFinite(event.bpm) &&
    event.bpm > 0
  )
}

function pointIndexAtOrBefore(
  points: readonly CompiledPianoTempoPoint[],
  key: number,
  value: (point: CompiledPianoTempoPoint) => number,
): number {
  let low = 0
  let high = points.length
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2)
    if (value(points[middle]) <= key) low = middle + 1
    else high = middle
  }
  return Math.max(0, low - 1)
}

/**
 * Compile ordered tempo events into immutable integration points.
 *
 * Equal-beat events resolve in input order (the last event wins), allowing a
 * caller with richer source coordinates to canonicalize those coordinates
 * before compilation. Invalid events are ignored and beat zero always has an
 * explicit authority, using 120 BPM when the source does not provide one.
 */
export function compilePianoTempoMap(
  events: readonly PianoTempoMapEvent[],
): CompiledPianoTempoMap {
  const ordered: OrderedTempoEvent[] = events
    .map((event, sourceOrder) => ({ ...event, sourceOrder }))
    .filter(isValidEvent)
    .sort(
      (left, right) =>
        left.beat - right.beat || left.sourceOrder - right.sourceOrder,
    )

  const resolved: PianoTempoMapEvent[] = []
  for (const event of ordered) {
    const previous = resolved[resolved.length - 1]
    if (previous?.beat === event.beat) {
      resolved[resolved.length - 1] = { beat: event.beat, bpm: event.bpm }
    } else {
      resolved.push({ beat: event.beat, bpm: event.bpm })
    }
  }
  if (resolved[0]?.beat !== 0) {
    resolved.unshift({ beat: 0, bpm: DEFAULT_PIANO_TEMPO_BPM })
  }

  const canonical: PianoTempoMapEvent[] = []
  for (const event of resolved) {
    if (canonical[canonical.length - 1]?.bpm === event.bpm) continue
    canonical.push(event)
  }

  const points: CompiledPianoTempoPoint[] = []
  for (const event of canonical) {
    const previous = points[points.length - 1]
    const authoredSeconds =
      previous === undefined
        ? 0
        : previous.authoredSeconds +
          ((event.beat - previous.beat) * 60) / previous.bpm
    points.push(
      Object.freeze({
        beat: event.beat,
        bpm: event.bpm,
        authoredSeconds,
      }),
    )
  }

  const frozenPoints = Object.freeze(points)
  return Object.freeze({
    initialTempoBpm: frozenPoints[0].bpm,
    points: frozenPoints,
  })
}

/** Convert an absolute score beat to authored seconds from beat zero. */
export function pianoTempoBeatToSeconds(
  tempoMap: CompiledPianoTempoMap,
  beat: number,
): number {
  const safeBeat = Number.isFinite(beat) ? Math.max(0, beat) : 0
  const index = pointIndexAtOrBefore(
    tempoMap.points,
    safeBeat,
    (point) => point.beat,
  )
  const point = tempoMap.points[index]
  return point.authoredSeconds + ((safeBeat - point.beat) * 60) / point.bpm
}

/** Convert authored seconds from beat zero back to an absolute score beat. */
export function pianoTempoSecondsToBeat(
  tempoMap: CompiledPianoTempoMap,
  seconds: number,
): number {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  const index = pointIndexAtOrBefore(
    tempoMap.points,
    safeSeconds,
    (point) => point.authoredSeconds,
  )
  const point = tempoMap.points[index]
  return point.beat + ((safeSeconds - point.authoredSeconds) * point.bpm) / 60
}

/** Return the authored BPM active at an absolute score beat. */
export function pianoTempoBpmAtBeat(
  tempoMap: CompiledPianoTempoMap,
  beat: number,
): number {
  const safeBeat = Number.isFinite(beat) ? Math.max(0, beat) : 0
  const index = pointIndexAtOrBefore(
    tempoMap.points,
    safeBeat,
    (point) => point.beat,
  )
  return tempoMap.points[index].bpm
}
