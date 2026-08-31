// Guitar score debug — why each authored note did or did not score, unabridged.
// ============================================================
//
// The live engine is deliberately evidence-honest: it withholds claims it
// cannot support, and it excludes targets it has no fair way to judge rather
// than inventing misses. That is right for a player and useless for a
// diagnosis, because "skipped" and "missed" and "the attack was never heard"
// all look the same from the outside.
//
// This module reads the same two artefacts the engine read — the pinned target
// frames and the take's input evidence — and answers the only question that
// matters while debugging: for THIS note, what was actually heard, how far off
// was it, and which of the four failure classes is this?
//
// It is a development surface. It never feeds scoring, never persists, and it
// deliberately reports raw numbers the production path would withhold.

import type { GuitarLiveScoreDebugSnapshot, GuitarLiveScoreSkipReason, } from './guitar-live-score'
import type { GuitarTakeEvent, GuitarTakeSnapshot, } from './guitar-take-recorder'

/**
 * How far either side of a target the diagnosis looks for an explanation.
 * Wider than the match tolerance on purpose: an uncompensated route delay is
 * exactly the case where the right note sits just outside the window, and a
 * search that stops at the window can never say so.
 */
export const GUITAR_SCORE_DEBUG_SEARCH_MULTIPLE = 4

/** Fewest offset samples before a suggested route delay is worth showing. */
export const GUITAR_SCORE_DEBUG_MIN_OFFSET_SAMPLES = 4

export type GuitarScoreDebugDiagnosis =
  /** Scored. */
  | 'matched'
  /** The engine excluded this target before any evidence was consulted. */
  | 'excluded'
  /** Nothing was struck anywhere near this note. */
  | 'no-attack-nearby'
  /** A strike was heard at the right time but no pitch was ever attached. */
  | 'attack-without-pitch'
  /** The right note was named, too faintly for the scoring floor. */
  | 'clarity-below-floor'
  /** The right pitch class, in the wrong octave — the classic low-string error. */
  | 'octave-off'
  /** A different note was played. */
  | 'wrong-pitch'
  /** The right note, clear enough, but outside the match window. */
  | 'outside-timing-window'
  /** The right note, in window — already spent proving a different target. */
  | 'event-consumed-elsewhere'
  /** Not judged yet. */
  | 'pending'

export interface GuitarScoreDebugCandidate {
  eventId: string
  frame: number
  /** Signed: negative means the player was early. */
  offsetMs: number
  midi: number | null
  /** Signed semitone distance from the target, null when no pitch attached. */
  semitoneDelta: number | null
  clarity: number | null
  level: number
  kind: GuitarTakeEvent['kind']
}

export interface GuitarScoreDebugRow {
  targetId: string
  midi: number
  startBeat: number
  onsetFrame: number
  onsetSeconds: number
  outcome: 'hit' | 'miss' | 'skipped' | 'pending'
  skipReason: GuitarLiveScoreSkipReason | null
  diagnosis: GuitarScoreDebugDiagnosis
  matchedEventId: string | null
  timingOffsetMs: number | null
  /** The best available explanation for a non-hit; null when nothing was near. */
  nearest: GuitarScoreDebugCandidate | null
}

export interface GuitarScoreDebugPlayedEvent {
  eventId: string
  kind: GuitarTakeEvent['kind']
  /**
   * Which clock stamped this event. `audio-worklet` is sample-exact off the
   * audio thread; `frame-loop` is the coarse main-thread fallback taken when
   * the worklet fails to load, and it silently costs every timing claim its
   * precision. Worth exporting: the two are indistinguishable downstream.
   */
  clockKind: GuitarTakeEvent['clock']['kind']
  frame: number
  rawFrame: number
  seconds: number
  midi: number | null
  noteName: string | null
  clarity: number | null
  level: number
  /** Set when the engine spent this event proving a target. */
  matchedTargetId: string | null
}

export interface GuitarScoreDebugSummary {
  targetCount: number
  judged: number
  hit: number
  missed: number
  skipped: number
  pending: number
  attackCount: number
  attacksWithPitch: number
  /** Legato and detector flutter. These cannot score, and they fill the page. */
  pitchChangeCount: number
  /** Events the overlay has seen across the whole run, not just the page. */
  observedEventCount: number
  /** Events the recorder evicted from its bounded page. */
  droppedEventCount: number
  /** Recorder pages the engine never saw. Each skips the targets it spans. */
  detectedGapCount: number
  medianClarity: number | null
  /** The deepest note the score asks for; the analyser must reach below it. */
  lowestTargetMidi: number | null
  skipReasons: Readonly<Record<GuitarLiveScoreSkipReason, number>>
  diagnoses: Readonly<Record<GuitarScoreDebugDiagnosis, number>>
  /**
   * Median (heard - authored) over every pitch-compatible candidate. This is
   * the uncompensated route delay, measured from the player's own take rather
   * than assumed. Null until enough samples exist to mean anything.
   */
  suggestedLatencyOffsetMs: number | null
  suggestedLatencySamples: number
  /** Median absolute deviation of those offsets: how consistent the delay is. */
  offsetSpreadMs: number | null
  /**
   * False when the spread makes the median meaningless. On dense material
   * almost every target finds SOME same-pitch strike inside the search window,
   * so the estimate fits noise; saying so is better than printing a number.
   */
  latencyEstimateReliable: boolean
}

/** The route's own account of how it timed and compensated this take. */
export interface GuitarScoreDebugClock {
  timingSource: GuitarTakeSnapshot['clock']['attack']['timingSource'] | null
  precision: GuitarTakeSnapshot['clock']['attack']['precision'] | null
  latencyMs: number | null
  latencyProvenance: GuitarTakeSnapshot['clock']['latency']['provenance'] | null
  /** Set when the sample-exact path was not the one that timed the attacks. */
  coarseFallback: boolean
}

export interface GuitarScoreDebugModel {
  sampleRate: number
  clock: GuitarScoreDebugClock
  /** Whether pitch changes could prove a target on this run. */
  matchPitchChanges: boolean
  /** How early a strike may land, as the run was actually configured. */
  toleranceMs: number
  /** How late it may land. Asymmetric on the acoustic routes. */
  lateToleranceMs: number
  searchWindowMs: number
  minimumPitchClarity: number
  inputKind: GuitarLiveScoreDebugSnapshot['inputKind']
  throughFrame: number
  throughSeconds: number
  durationSeconds: number
  midiRange: { low: number; high: number }
  rows: readonly GuitarScoreDebugRow[]
  played: readonly GuitarScoreDebugPlayedEvent[]
  summary: GuitarScoreDebugSummary
}

const NOTE_NAMES: readonly string[] = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
]

function noteLabel(midi: number): string {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12] ?? '?'
  return `${name}${Math.floor(midi / 12) - 1}`
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle] ?? null
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
}

function round(value: number, places = 1): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

function emptySkipReasons(): Record<GuitarLiveScoreSkipReason, number> {
  return {
    'polyphonic-onset': 0,
    'unheard-voice': 0,
    'fast-passage': 0,
    'input-clipping': 0,
    'input-noisy': 0,
    'input-uncertain': 0,
    'event-gap': 0,
  }
}

function emptyDiagnoses(): Record<GuitarScoreDebugDiagnosis, number> {
  return {
    matched: 0,
    excluded: 0,
    'no-attack-nearby': 0,
    'attack-without-pitch': 0,
    'clarity-below-floor': 0,
    'octave-off': 0,
    'wrong-pitch': 0,
    'outside-timing-window': 0,
    'event-consumed-elsewhere': 0,
    pending: 0,
  }
}

/**
 * Rank one strike as an explanation for one target. Lower is a better
 * explanation, and the order is the order a human would read them in: the
 * right note beats the right pitch class beats any note at all.
 */
function candidateRank(
  event: GuitarTakeEvent,
  targetMidi: number,
  minimumClarity: number,
  clarityApplies: boolean,
): number {
  const pitch = event.pitch
  if (pitch === null) return 4
  const clarityOk = !clarityApplies || pitch.clarity >= minimumClarity
  if (pitch.midi === targetMidi) return clarityOk ? 0 : 1
  if ((((pitch.midi - targetMidi) % 12) + 12) % 12 === 0) return 2
  return 3
}

function toCandidate(
  event: GuitarTakeEvent,
  targetMidi: number,
  targetFrame: number,
  sampleRate: number,
): GuitarScoreDebugCandidate {
  const pitch = event.pitch
  return {
    eventId: event.id,
    frame: event.compensatedTransportFrame,
    offsetMs: round(
      ((event.compensatedTransportFrame - targetFrame) / sampleRate) * 1000,
    ),
    midi: pitch?.midi ?? null,
    semitoneDelta: pitch === null ? null : pitch.midi - targetMidi,
    clarity: pitch === null ? null : round(pitch.clarity, 3),
    level: round(event.level, 3),
    kind: event.kind,
  }
}

/**
 * Build the diagnosis for one run. Pure: the same snapshot and take always
 * produce the same model, so a fixture can pin a regression.
 */
export function buildGuitarScoreDebugModel(
  snapshot: GuitarLiveScoreDebugSnapshot,
  take: GuitarTakeSnapshot | null,
  /**
   * Every event seen across the run. The recorder's page is bounded, and on a
   * dense passage it fills with pitch-change frames, so reading `take.events`
   * alone shows a keyhole rather than the take.
   */
  observedEvents?: readonly GuitarTakeEvent[],
): GuitarScoreDebugModel {
  const sampleRate = snapshot.sampleRate
  const toleranceMs = round((snapshot.toleranceFrames / sampleRate) * 1000)
  const lateToleranceMs = round(
    (snapshot.lateToleranceFrames / sampleRate) * 1000,
  )
  const searchFrames =
    Math.max(snapshot.toleranceFrames, snapshot.lateToleranceFrames) *
    GUITAR_SCORE_DEBUG_SEARCH_MULTIPLE
  const clarityApplies = snapshot.inputKind !== 'midi'
  const events = observedEvents ?? take?.events ?? []
  // Candidates are whatever this run allowed to score. Diagnosing a miss
  // against evidence the engine was never going to look at reads as a bug in
  // the matcher when it is really a bug in what counts as evidence.
  // Sorted, because the window bounds below are found by bisection. Arrival
  // order is very nearly frame order already, but attacks come off the worklet
  // and pitch changes off the frame loop, so the two can interleave by a few
  // frames and a bisection over an almost-sorted list is quietly wrong.
  const attacks = events
    .filter(
      (event) =>
        event.kind === 'attack' ||
        (snapshot.matchPitchChanges && event.kind === 'pitch-change'),
    )
    .slice()
    .sort(
      (left, right) =>
        left.compensatedTransportFrame - right.compensatedTransportFrame,
    )

  /** First attack at or after `frame`. */
  const firstAttackFrom = (frame: number): number => {
    let low = 0
    let high = attacks.length
    while (low < high) {
      const mid = (low + high) >> 1
      const event = attacks[mid]
      if (event !== undefined && event.compensatedTransportFrame < frame) {
        low = mid + 1
      } else {
        high = mid
      }
    }
    return low
  }

  const judgmentByTarget = new Map(
    snapshot.judgments.map((judgment) => [judgment.targetId, judgment]),
  )
  const consumedEventIds = new Set<string>()
  const targetByEventId = new Map<string, string>()
  const eventById = new Map(events.map((event) => [event.id, event]))
  // Offsets the ENGINE committed to: inside its own window, one event to one
  // target. The wide re-search below cannot be used for this — it ranges four
  // times as far and reuses one event across every target it fits, so its
  // spread describes the search, not the route. Measured on a real take, the
  // re-search reported -317 ms +/-390 and refused to answer, while the engine's
  // own hits on the same take gave +137 ms with a 47 ms IQR.
  //
  // Worklet attacks only. A pitch change is stamped on the animation frame that
  // noticed it, so its time carries the frame loop's jitter on top of the route
  // delay this is trying to isolate.
  const committedOffsetSamples: number[] = []
  for (const judgment of snapshot.judgments) {
    if (judgment.outcome === 'hit') {
      consumedEventIds.add(judgment.eventId)
      targetByEventId.set(judgment.eventId, judgment.targetId)
      if (eventById.get(judgment.eventId)?.clock.kind === 'audio-worklet') {
        committedOffsetSamples.push(
          Math.round((judgment.timingOffsetMs / 1000) * sampleRate),
        )
      }
    }
  }

  const offsetSamples: number[] = []
  const rows: GuitarScoreDebugRow[] = []
  const skipReasons = emptySkipReasons()
  const diagnoses = emptyDiagnoses()
  let hit = 0
  let missed = 0
  let skipped = 0
  let pending = 0

  for (const target of snapshot.targets) {
    const judgment = judgmentByTarget.get(target.id)
    const onsetSeconds = target.onsetFrame / sampleRate

    // The best explanation among strikes near this note, ranked by how well
    // the pitch fits and then by how close in time it landed.
    let best: GuitarTakeEvent | null = null
    let bestRank = Number.POSITIVE_INFINITY
    let bestDistance = Number.POSITIVE_INFINITY
    let bestOffset = 0
    // Only the strikes inside this target's search window, found by bisecting
    // the sorted list. Scanning every strike for every target made this
    // O(targets x attacks): on a 292-note score with 223 strikes that is 65k
    // ranked comparisons, and the development overlay that calls this rebuilds
    // on every animation frame.
    for (
      let index = firstAttackFrom(target.onsetFrame - searchFrames);
      index < attacks.length;
      index += 1
    ) {
      const event = attacks[index]
      if (event === undefined) break
      const offset = event.compensatedTransportFrame - target.onsetFrame
      if (offset > searchFrames) break
      const distance = Math.abs(offset)
      const rank = candidateRank(
        event,
        target.midi,
        snapshot.minimumPitchClarity,
        clarityApplies,
      )
      if (rank < bestRank || (rank === bestRank && distance < bestDistance)) {
        best = event
        bestRank = rank
        bestDistance = distance
        bestOffset = offset
      }
    }
    // Pitch-compatible strikes are the only honest evidence of route delay:
    // a wrong note tells us nothing about when the right one would have been.
    if (best !== null && bestRank <= 2) {
      offsetSamples.push(best.compensatedTransportFrame - target.onsetFrame)
    }

    const nearest =
      best === null
        ? null
        : toCandidate(best, target.midi, target.onsetFrame, sampleRate)

    let outcome: GuitarScoreDebugRow['outcome']
    let diagnosis: GuitarScoreDebugDiagnosis
    if (judgment === undefined) {
      outcome = 'pending'
      diagnosis = 'pending'
      pending += 1
    } else if (judgment.outcome === 'skipped') {
      outcome = 'skipped'
      diagnosis = 'excluded'
      skipped += 1
      skipReasons[judgment.skipReason] += 1
    } else if (judgment.outcome === 'hit') {
      outcome = 'hit'
      diagnosis = 'matched'
      hit += 1
    } else {
      outcome = 'miss'
      missed += 1
      if (best === null) diagnosis = 'no-attack-nearby'
      else if (bestRank === 4) diagnosis = 'attack-without-pitch'
      else if (bestRank === 3) diagnosis = 'wrong-pitch'
      else if (bestRank === 2) diagnosis = 'octave-off'
      else if (bestRank === 1) diagnosis = 'clarity-below-floor'
      else if (
        bestOffset < -snapshot.toleranceFrames ||
        bestOffset > snapshot.lateToleranceFrames
      )
        diagnosis = 'outside-timing-window'
      else if (consumedEventIds.has(best.id))
        diagnosis = 'event-consumed-elsewhere'
      else diagnosis = 'outside-timing-window'
    }
    diagnoses[diagnosis] += 1

    rows.push({
      targetId: target.id,
      midi: target.midi,
      startBeat: target.startBeat,
      onsetFrame: target.onsetFrame,
      onsetSeconds: round(onsetSeconds, 3),
      outcome,
      skipReason:
        judgment !== undefined && judgment.outcome === 'skipped'
          ? judgment.skipReason
          : target.skipReason,
      diagnosis,
      matchedEventId:
        judgment !== undefined && judgment.outcome === 'hit'
          ? judgment.eventId
          : null,
      timingOffsetMs:
        judgment !== undefined && judgment.outcome === 'hit'
          ? judgment.timingOffsetMs
          : null,
      nearest,
    })
  }

  const played: GuitarScoreDebugPlayedEvent[] = events.map((event) => ({
    eventId: event.id,
    kind: event.kind,
    clockKind: event.clock.kind,
    frame: event.compensatedTransportFrame,
    rawFrame: event.rawTransportFrame,
    seconds: round(event.compensatedTransportFrame / sampleRate, 3),
    midi: event.pitch?.midi ?? null,
    noteName: event.pitch === null ? null : noteLabel(event.pitch.midi),
    clarity: event.pitch === null ? null : round(event.pitch.clarity, 3),
    level: round(event.level, 3),
    matchedTargetId: targetByEventId.get(event.id) ?? null,
  }))

  const clarities = attacks
    .map((event) => event.pitch?.clarity)
    .filter((clarity): clarity is number => clarity !== undefined)
  // Prefer what the engine actually matched; fall back to the re-search only
  // when too little was matched to say anything, which is the case a fresh or
  // badly misaligned run is in.
  const estimateSamples =
    committedOffsetSamples.length >= GUITAR_SCORE_DEBUG_MIN_OFFSET_SAMPLES
      ? committedOffsetSamples
      : offsetSamples
  const centre = median(estimateSamples)
  const spread =
    centre === null
      ? null
      : median(estimateSamples.map((offset) => Math.abs(offset - centre)))
  const enoughSamples =
    estimateSamples.length >= GUITAR_SCORE_DEBUG_MIN_OFFSET_SAMPLES
  const spreadMs = spread === null ? null : round((spread / sampleRate) * 1000)
  const centreMs = centre === null ? null : round((centre / sampleRate) * 1000)
  // A route delay is a constant. If the spread is as large as the median, the
  // pairs are arbitrary and the median is describing the score, not the route.
  const reliable =
    enoughSamples &&
    centreMs !== null &&
    spreadMs !== null &&
    spreadMs <= Math.max(30, Math.abs(centreMs) * 0.5)

  const targetMidis = snapshot.targets.map((target) => target.midi)
  const playedMidis = played
    .map((event) => event.midi)
    .filter((midi): midi is number => midi !== null)
  const allMidis = [...targetMidis, ...playedMidis]

  return {
    sampleRate,
    clock: {
      timingSource: take?.clock.attack.timingSource ?? null,
      precision: take?.clock.attack.precision ?? null,
      latencyMs:
        take === null ? null : round(take.clock.latency.seconds * 1000),
      latencyProvenance: take?.clock.latency.provenance ?? null,
      coarseFallback: take?.clock.attack.precision === 'coarse-frame-loop',
    },
    matchPitchChanges: snapshot.matchPitchChanges,
    toleranceMs,
    lateToleranceMs,
    searchWindowMs: round((searchFrames / sampleRate) * 1000),
    minimumPitchClarity: snapshot.minimumPitchClarity,
    inputKind: snapshot.inputKind,
    throughFrame: snapshot.throughFrame,
    throughSeconds: round(Math.max(0, snapshot.throughFrame) / sampleRate, 3),
    durationSeconds: round(snapshot.durationFrames / sampleRate, 3),
    midiRange: {
      low: allMidis.length === 0 ? 40 : Math.min(...allMidis) - 2,
      high: allMidis.length === 0 ? 64 : Math.max(...allMidis) + 2,
    },
    rows,
    played,
    summary: {
      targetCount: snapshot.targets.length,
      judged: hit + missed,
      hit,
      missed,
      skipped,
      pending,
      attackCount: events.filter((event) => event.kind === 'attack').length,
      attacksWithPitch: events.filter(
        (event) => event.kind === 'attack' && event.pitch !== null,
      ).length,
      pitchChangeCount: events.filter((event) => event.kind === 'pitch-change')
        .length,
      observedEventCount: events.length,
      droppedEventCount: take?.droppedEventCount ?? 0,
      detectedGapCount: snapshot.detectedGapCount,
      medianClarity:
        clarities.length === 0 ? null : round(median(clarities) ?? 0, 3),
      lowestTargetMidi:
        targetMidis.length === 0 ? null : Math.min(...targetMidis),
      skipReasons,
      diagnoses,
      suggestedLatencyOffsetMs: enoughSamples ? centreMs : null,
      suggestedLatencySamples: estimateSamples.length,
      offsetSpreadMs: enoughSamples ? spreadMs : null,
      latencyEstimateReliable: reliable,
    },
  }
}

/** Plain-language reason, for the row inspector. */
export function describeGuitarScoreDiagnosis(row: GuitarScoreDebugRow): string {
  switch (row.diagnosis) {
    case 'matched':
      return `Scored${row.timingOffsetMs === null ? '' : ` at ${row.timingOffsetMs > 0 ? '+' : ''}${row.timingOffsetMs} ms`}`
    case 'excluded':
      switch (row.skipReason) {
        case 'polyphonic-onset':
          return 'Excluded: another note starts on this exact onset, and a mono detector cannot prove either'
        case 'fast-passage':
          return 'Excluded: a neighbouring note is closer than the pitch-attachment window'
        case 'input-clipping':
          return 'Excluded: the input was clipping'
        case 'input-noisy':
          return 'Excluded: the room was nearly as loud as the guitar'
        case 'input-uncertain':
          return 'Excluded: pitch was not stable enough to name'
        case 'unheard-voice':
          return 'Another voice of this chord was scored; one detector hears one pitch'
        case 'event-gap':
          return 'Excluded: a recorder page went missing across this note'
        default:
          return 'Excluded'
      }
    case 'no-attack-nearby':
      return 'No strike was heard anywhere near this note'
    case 'attack-without-pitch':
      return 'A strike was heard on time, but no pitch was ever attached to it'
    case 'clarity-below-floor':
      return `Right note, too faint to score: clarity ${row.nearest?.clarity ?? '?'} is under the floor`
    case 'octave-off':
      return `Right pitch class, wrong octave: heard ${row.nearest?.semitoneDelta ?? '?'} semitones away`
    case 'wrong-pitch':
      return `A different note was played: ${row.nearest?.semitoneDelta ?? '?'} semitones away`
    case 'outside-timing-window':
      return `Right note, outside the window: ${row.nearest?.offsetMs ?? '?'} ms off`
    case 'event-consumed-elsewhere':
      return 'The matching strike had already been spent proving another note'
    case 'pending':
      return 'Not judged yet'
  }
}
