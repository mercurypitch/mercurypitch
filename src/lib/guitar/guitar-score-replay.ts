// Replay an exported take through the real engine.
// ============================================================
//
// The debug overlay's own model answers "was there evidence near this note",
// and it answers it with a deliberately wide search — four times the engine's
// window — because its job is to explain a miss, not to award a hit. Reading
// recovery estimates off it overstates them, which is exactly what happened
// once already.
//
// This runs the engine instead. Same predicates, same consumption, same
// windows; only the options under test change. A claim about what a policy
// would have scored on a real take is then a measurement rather than an
// argument, and any two policies can be diffed target by target.
//
// Development tooling. Nothing in the app imports it.

import type { CreateGuitarLiveScoreEngineOptions, GuitarLiveScoreDisplay, GuitarLiveScoreJudgment, } from './guitar-live-score'
import { createGuitarLiveScoreEngine } from './guitar-live-score'
import type { GuitarTakeEvent, GuitarTakeSnapshot, } from './guitar-take-recorder'

/** The shape the overlay's "Download take JSON" button writes. */
export interface GuitarScoreExport {
  model: {
    sampleRate: number
    inputKind: CreateGuitarLiveScoreEngineOptions['inputKind']
    throughFrame: number
    rows: readonly {
      targetId: string
      midi: number
      startBeat: number
      onsetFrame: number
      onsetSeconds: number
    }[]
    played: readonly {
      eventId: string
      kind: GuitarTakeEvent['kind']
      clockKind: string
      frame: number
      rawFrame: number
      seconds: number
      midi: number | null
      noteName: string | null
      clarity: number | null
      level: number
    }[]
  }
}

export interface GuitarScoreReplayResult {
  display: GuitarLiveScoreDisplay
  judgments: readonly GuitarLiveScoreJudgment[]
  hit: number
  miss: number
  skipped: number
  judged: number
  /** Hits over judged targets, the cumulative figure the sheet reports. */
  hitShare: number
  skipReasons: Readonly<Record<string, number>>
  /** Hits and misses on targets the old policy would have excluded outright. */
  reclaimed: Readonly<Record<string, number>>
}

/**
 * Beat to seconds, recovered from the export.
 *
 * The authored beat grid is not in the file, but every target carries both its
 * beat and the second it was pinned to, which is the same mapping the engine
 * used. Interpolating between the two nearest known beats reproduces it exactly
 * at every target and stays sane at the range edges, without assuming a tempo.
 */
function beatMapper(
  rows: GuitarScoreExport['model']['rows'],
): (beat: number) => number {
  const points = [
    ...new Map(rows.map((row) => [row.startBeat, row.onsetSeconds])).entries(),
  ].sort((left, right) => left[0] - right[0])
  if (points.length === 0) return (beat) => beat
  const first = points[0]
  const last = points[points.length - 1]
  if (first === undefined || last === undefined) return (beat) => beat
  const slope =
    points.length < 2 || last[0] === first[0]
      ? (first[1] ?? 0) / Math.max(1e-9, first[0])
      : (last[1] - first[1]) / (last[0] - first[0])
  return (beat) => {
    if (beat <= first[0]) return first[1] + (beat - first[0]) * slope
    if (beat >= last[0]) return last[1] + (beat - last[0]) * slope
    let low = 0
    let high = points.length - 1
    while (high - low > 1) {
      const middle = (low + high) >> 1
      const point = points[middle]
      if (point === undefined) break
      if (point[0] <= beat) low = middle
      else high = middle
    }
    const left = points[low]
    const right = points[high]
    if (left === undefined || right === undefined) return beat * slope
    if (right[0] === left[0]) return left[1]
    const ratio = (beat - left[0]) / (right[0] - left[0])
    return left[1] + ratio * (right[1] - left[1])
  }
}

function replayTake(exported: GuitarScoreExport): GuitarTakeSnapshot {
  const { model } = exported
  const rate = model.sampleRate
  const events: GuitarTakeEvent[] = model.played.map((played) => ({
    id: played.eventId,
    kind: played.kind,
    source: model.inputKind,
    voiceId: null,
    at: played.frame / rate,
    capturedAt: played.rawFrame / rate,
    level: played.level,
    clock:
      played.clockKind === 'audio-worklet'
        ? { kind: 'audio-worklet', atFrame: played.rawFrame, sampleRate: rate }
        : {
            kind: 'frame-loop',
            observedAt: played.rawFrame / rate,
            windowStartAt: played.rawFrame / rate,
            sampleRate: rate,
            windowFrames: 0,
          },
    pitch:
      played.midi === null
        ? null
        : {
            midi: played.midi,
            noteName: played.noteName ?? `MIDI ${played.midi}`,
            cents: 0,
            clarity: played.clarity ?? 0,
          },
    rawTransportFrame: played.rawFrame,
    compensatedTransportFrame: played.frame,
  }))
  return {
    id: 'replay',
    lifecycle: 'recording',
    input: {
      kind: model.inputKind,
      requestedDeviceId: null,
      activeDeviceId: null,
      activeDeviceLabel: null,
    },
    clock: {
      startedAtFrame: 0,
      sampleRate: rate,
      attack: { timingSource: 'audio-clock', precision: 'sample-exact' },
      latency: {
        seconds: 0,
        frames: 0,
        provenance: 'none',
        uncertaintySeconds: null,
      },
    },
    events,
    durationFrames: null,
    filteredBeforeStart: 0,
    filteredAfterEnd: 0,
    rejectedAfterEnd: 0,
    retractedAfterEnd: 0,
    truncated: false,
    droppedEventCount: 0,
    // Health is not in the export, so a replay cannot reproduce a health skip.
    // Reporting 'good' keeps that honest: the run says what the policy did,
    // not what the room was doing.
    inputHealth: {
      readings: 1,
      states: {
        silent: 0,
        quiet: 0,
        good: 1,
        hot: 0,
        clipping: 0,
        noisy: 0,
        uncertain: 0,
      },
    },
  }
}

export function replayGuitarScoreExport(
  exported: GuitarScoreExport,
  overrides: Partial<CreateGuitarLiveScoreEngineOptions> = {},
): GuitarScoreReplayResult {
  const { model } = exported
  const beats = model.rows.map((row) => row.startBeat)
  const engine = createGuitarLiveScoreEngine({
    source: {
      referenceId: 'replay',
      trackId: 'replay',
      range: {
        startBeat: Math.min(...beats, 0),
        endBeat: Math.max(...beats, 1) + 1,
      },
    },
    sampleRate: model.sampleRate,
    beatToSeconds: beatMapper(model.rows),
    targets: model.rows.map((row) => ({
      id: row.targetId,
      midi: row.midi,
      startBeat: row.startBeat,
    })),
    inputKind: model.inputKind,
    debug: true,
    ...overrides,
  })
  const display = engine.sample(
    replayTake(exported),
    model.throughFrame,
    'good',
  )
  const judgments = engine.debugSnapshot()?.judgments ?? []
  const skipReasons: Record<string, number> = {}
  const reclaimed: Record<string, number> = {}
  let hit = 0
  let miss = 0
  let skipped = 0
  for (const judgment of judgments) {
    if (judgment.outcome === 'hit') hit += 1
    else if (judgment.outcome === 'miss') miss += 1
    else skipped += 1
    if (judgment.skipReason !== null) {
      skipReasons[judgment.skipReason] =
        (skipReasons[judgment.skipReason] ?? 0) + 1
    }
    if (judgment.outcome !== 'skipped' && judgment.reclaimedFrom !== null) {
      const key = `${judgment.reclaimedFrom}:${judgment.outcome}`
      reclaimed[key] = (reclaimed[key] ?? 0) + 1
    }
  }
  const judged = hit + miss
  return {
    display,
    judgments,
    hit,
    miss,
    skipped,
    judged,
    hitShare: judged === 0 ? 0 : hit / judged,
    skipReasons,
    reclaimed,
  }
}

/** Targets that changed verdict between two policies, old outcome first. */
export function diffGuitarScoreReplays(
  before: GuitarScoreReplayResult,
  after: GuitarScoreReplayResult,
): readonly {
  targetId: string
  from: GuitarLiveScoreJudgment['outcome']
  to: GuitarLiveScoreJudgment['outcome']
}[] {
  const previous = new Map(
    before.judgments.map((judgment) => [judgment.targetId, judgment.outcome]),
  )
  const changes: {
    targetId: string
    from: GuitarLiveScoreJudgment['outcome']
    to: GuitarLiveScoreJudgment['outcome']
  }[] = []
  for (const judgment of after.judgments) {
    const from = previous.get(judgment.targetId)
    if (from === undefined || from === judgment.outcome) continue
    changes.push({ targetId: judgment.targetId, from, to: judgment.outcome })
  }
  return changes
}
