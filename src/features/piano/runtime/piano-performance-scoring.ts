// ============================================================
// Piano performance scoring — pure onset judgments for one score lane
// ============================================================
//
// The engine consumes transport samples but never advances a clock. Normalized
// input voice starts are the evidence: sustained or already-held keys cannot
// score a later note. Callers announce every pause, seek, rate change, and
// source swap so stale input and skipped timeline spans stay outside scoring.

import type { PianoInputSnapshot, PianoInputVoice, } from '@/features/piano/input/piano-input-state'
import type { PianoPerformanceNote, PianoPerformancePhase, } from './piano-performance-contract'

export type PianoPerformanceTiming = 'perfect' | 'great' | 'good' | 'miss'

export type PianoPerformancePitchAccuracy =
  | 'perfect'
  | 'excellent'
  | 'good'
  | 'okay'
  | 'off'

export type PianoPerformanceScoringDiscontinuity =
  | 'pause'
  | 'resume'
  | 'seek'
  | 'stop'
  | 'rate-change'
  | 'loop'
  | 'clock-jump'
  | 'source-replacement'
  | 'reset'

export interface PianoPerformanceScoringSource {
  readonly sourceId: string
  readonly notes: readonly PianoPerformanceNote[]
  /**
   * Unscaled elapsed score time at a beat. Integrate the complete tempo map;
   * playbackRate on each sample converts this score time into real time.
   */
  readonly scoreTimeAtBeatMs: (beat: number) => number
}

export interface PianoPerformanceScoringPosition {
  readonly playheadBeat: number
  readonly input: PianoInputSnapshot
}

export interface PianoPerformanceScoringSample extends PianoPerformanceScoringPosition {
  readonly phase: PianoPerformancePhase
  /** Monotonic time in the same time base as PianoInputVoice.startedAtMs. */
  readonly sampledAtMs: number
  /**
   * Full performed/authored rate, including base-tempo override and speed.
   * One performs the authored tempo map; 0.5 takes twice its authored time.
   */
  readonly playbackRate: number
}

export interface PianoPerformanceScoringDiscontinuityEvent extends PianoPerformanceScoringPosition {
  readonly reason: Exclude<
    PianoPerformanceScoringDiscontinuity,
    'clock-jump' | 'source-replacement' | 'reset'
  >
}

export interface PianoPerformanceJudgment {
  readonly noteId: string | number
  /** Stable index in the filtered score lane, including duplicate note IDs. */
  readonly noteIndex: number
  readonly midi: number
  readonly noteName: string
  readonly outcome: 'hit' | 'miss'
  readonly timing: PianoPerformanceTiming
  readonly pitchAccuracy: PianoPerformancePitchAccuracy
  readonly score: number
  /** Negative is early and positive is late. Null means no matching onset. */
  readonly timingDeltaMs: number | null
  readonly inputVoiceId: string | null
  readonly judgedAtMs: number
}

export interface PianoPerformanceScoringState {
  readonly revision: number
  readonly sourceId: string
  readonly score: number
  /** Mean combined timing/pitch score across judged notes, in percent. */
  readonly accuracyPercent: number
  /** Current consecutive-hit count. */
  readonly combo: number
  /** Best consecutive-hit count in this run. */
  readonly streak: number
  readonly hits: number
  readonly misses: number
  readonly judgedNotes: number
  readonly pendingNotes: number
  readonly skippedNotes: number
  readonly totalNotes: number
  readonly complete: boolean
  /** Newest completed judgments, capped to keep reactive snapshots bounded. */
  readonly judgments: readonly PianoPerformanceJudgment[]
}

export interface PianoPerformanceScoringUpdate {
  readonly state: PianoPerformanceScoringState
  readonly judgments: readonly PianoPerformanceJudgment[]
  readonly discontinuity: PianoPerformanceScoringDiscontinuity | null
}

export interface PianoPerformanceScoringEngineOptions {
  /** Allowed wall/score-clock disagreement before a sample is treated as a jump. */
  readonly discontinuityToleranceMs?: number
}

export interface PianoPerformanceScoringEngine {
  snapshot(): PianoPerformanceScoringState
  sample(sample: PianoPerformanceScoringSample): PianoPerformanceScoringUpdate
  discontinue(
    event: PianoPerformanceScoringDiscontinuityEvent,
  ): PianoPerformanceScoringUpdate
  replaceSource(
    source: PianoPerformanceScoringSource,
    position: PianoPerformanceScoringPosition,
  ): PianoPerformanceScoringUpdate
  reset(
    position: PianoPerformanceScoringPosition,
  ): PianoPerformanceScoringUpdate
}

export const PIANO_PERFORMANCE_TIMING_WINDOWS_MS = Object.freeze({
  perfect: 30,
  great: 75,
  good: 150,
})

export const PIANO_PERFORMANCE_SCORING_WEIGHTS = Object.freeze({
  timing: 0.6,
  pitch: 0.4,
})

/**
 * Maximum judgment history retained in a scoring snapshot. A sample update's
 * `judgments` array remains the complete batch produced by that sample.
 */
export const PIANO_PERFORMANCE_JUDGMENT_HISTORY_LIMIT = 256

const DEFAULT_DISCONTINUITY_TOLERANCE_MS = 250
const RATE_EPSILON = 0.000_001

type TargetStatus = 'pending' | 'hit' | 'miss' | 'skipped'

interface ScoreTarget {
  readonly note: Readonly<PianoPerformanceNote>
  readonly noteIndex: number
  readonly scoreTimeMs: number
  status: TargetStatus
}

interface PlayingSampleAnchor {
  readonly playheadBeat: number
  readonly scoreTimeMs: number
  readonly sampledAtMs: number
  readonly playbackRate: number
}

function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) ? value : null
}

function playableScoreNote(note: PianoPerformanceNote): boolean {
  return (
    note.isBacking !== true &&
    Number.isFinite(note.startBeat) &&
    Number.isInteger(note.midi) &&
    note.midi >= 0 &&
    note.midi <= 127
  )
}

function classifyTiming(
  deltaMs: number,
): Exclude<PianoPerformanceTiming, 'miss'> {
  const absoluteDeltaMs = Math.abs(deltaMs)
  if (absoluteDeltaMs <= PIANO_PERFORMANCE_TIMING_WINDOWS_MS.perfect) {
    return 'perfect'
  }
  if (absoluteDeltaMs <= PIANO_PERFORMANCE_TIMING_WINDOWS_MS.great) {
    return 'great'
  }
  return 'good'
}

function timingScore(timing: Exclude<PianoPerformanceTiming, 'miss'>): number {
  if (timing === 'perfect') return 100
  if (timing === 'great') return 75
  return 50
}

function hitScore(timing: Exclude<PianoPerformanceTiming, 'miss'>): number {
  return Math.round(
    timingScore(timing) * PIANO_PERFORMANCE_SCORING_WEIGHTS.timing +
      100 * PIANO_PERFORMANCE_SCORING_WEIGHTS.pitch,
  )
}

function lowerBound<T>(
  values: readonly T[],
  target: number,
  valueOf: (value: T) => number,
): number {
  let low = 0
  let high = values.length
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2)
    if (valueOf(values[middle]) < target) low = middle + 1
    else high = middle
  }
  return low
}

function frozenUpdate(
  state: PianoPerformanceScoringState,
  judgments: readonly PianoPerformanceJudgment[] = [],
  discontinuity: PianoPerformanceScoringDiscontinuity | null = null,
): PianoPerformanceScoringUpdate {
  return Object.freeze({
    state,
    judgments: Object.freeze([...judgments]),
    discontinuity,
  })
}

/**
 * Create a mutable, framework-free scoring session. The returned snapshots and
 * updates are immutable values suitable for any route's reactive adapter.
 */
export function createPianoPerformanceScoringEngine(
  initialSource: PianoPerformanceScoringSource,
  initialPosition: PianoPerformanceScoringPosition,
  options: PianoPerformanceScoringEngineOptions = {},
): PianoPerformanceScoringEngine {
  const discontinuityToleranceMs = Math.max(
    PIANO_PERFORMANCE_TIMING_WINDOWS_MS.good,
    Number.isFinite(options.discontinuityToleranceMs)
      ? (options.discontinuityToleranceMs ?? DEFAULT_DISCONTINUITY_TOLERANCE_MS)
      : DEFAULT_DISCONTINUITY_TOLERANCE_MS,
  )

  let sourceId = initialSource.sourceId
  let scoreTimeAtBeatMs = initialSource.scoreTimeAtBeatMs
  let targets: ScoreTarget[] = []
  let targetsByMidi = new Map<number, ScoreTarget[]>()
  let expiryCursor = 0
  let seenVoiceIds = new Set<string>()
  let lastPlayingSample: PlayingSampleAnchor | null = null
  let score = 0
  let combo = 0
  let streak = 0
  let hits = 0
  let misses = 0
  let pendingNotes = 0
  let skippedNotes = 0
  let retainedJudgments: PianoPerformanceJudgment[] = []
  let revision = 0
  let currentState: PianoPerformanceScoringState

  const safeScoreTimeAtBeatMs = (beat: number): number | null => {
    if (!Number.isFinite(beat)) return null
    try {
      return finiteOrNull(scoreTimeAtBeatMs(beat))
    } catch {
      return null
    }
  }

  const indexTargets = (source: PianoPerformanceScoringSource): void => {
    sourceId = source.sourceId
    scoreTimeAtBeatMs = source.scoreTimeAtBeatMs
    const indexedTargets: ScoreTarget[] = []
    let scoreLaneIndex = 0
    for (const candidate of source.notes) {
      if (!playableScoreNote(candidate)) continue
      let mappedTime: number | null
      try {
        mappedTime = finiteOrNull(scoreTimeAtBeatMs(candidate.startBeat))
      } catch {
        mappedTime = null
      }
      if (mappedTime !== null) {
        indexedTargets.push({
          note: Object.freeze({ ...candidate }),
          noteIndex: scoreLaneIndex,
          scoreTimeMs: mappedTime,
          status: 'pending',
        })
      }
      scoreLaneIndex += 1
    }
    targets = indexedTargets.sort(
      (left, right) =>
        left.scoreTimeMs - right.scoreTimeMs ||
        left.noteIndex - right.noteIndex,
    )

    targetsByMidi = new Map()
    for (const target of targets) {
      const pitchTargets = targetsByMidi.get(target.note.midi) ?? []
      pitchTargets.push(target)
      targetsByMidi.set(target.note.midi, pitchTargets)
    }
  }

  const synchronizeInput = (input: PianoInputSnapshot): void => {
    for (const voice of input.soundingNotes) seenVoiceIds.add(voice.id)
  }

  const resetInputEvidence = (input: PianoInputSnapshot): void => {
    seenVoiceIds = new Set(input.soundingNotes.map((voice) => voice.id))
  }

  const resetMetrics = (): void => {
    score = 0
    combo = 0
    streak = 0
    hits = 0
    misses = 0
    retainedJudgments = []
  }

  const setTargetStatus = (
    target: ScoreTarget,
    nextStatus: TargetStatus,
  ): boolean => {
    const previousStatus = target.status
    if (previousStatus === nextStatus) return false
    if (previousStatus === 'pending') pendingNotes -= 1
    else if (previousStatus === 'skipped') skippedNotes -= 1
    if (nextStatus === 'pending') pendingNotes += 1
    else if (nextStatus === 'skipped') skippedNotes += 1
    target.status = nextStatus
    return true
  }

  const retainJudgment = (judgment: PianoPerformanceJudgment): void => {
    retainedJudgments.push(judgment)
    const overflow =
      retainedJudgments.length - PIANO_PERFORMANCE_JUDGMENT_HISTORY_LIMIT
    if (overflow > 0) retainedJudgments.splice(0, overflow)
  }

  const reconcilePosition = (playheadBeat: number): boolean => {
    let changed = false
    for (const target of targets) {
      if (target.status === 'hit' || target.status === 'miss') continue
      const nextStatus =
        target.note.startBeat < playheadBeat ? 'skipped' : 'pending'
      changed = setTargetStatus(target, nextStatus) || changed
    }

    const scoreTimeMs = safeScoreTimeAtBeatMs(playheadBeat)
    expiryCursor =
      scoreTimeMs === null
        ? 0
        : lowerBound(targets, scoreTimeMs, (target) => target.scoreTimeMs)
    return changed
  }

  const buildState = (incrementRevision: boolean): void => {
    if (incrementRevision) revision += 1
    const judgedNotes = hits + misses
    currentState = Object.freeze({
      revision,
      sourceId,
      score,
      accuracyPercent: judgedNotes === 0 ? 0 : Math.round(score / judgedNotes),
      combo,
      streak,
      hits,
      misses,
      judgedNotes,
      pendingNotes,
      skippedNotes,
      totalNotes: targets.length,
      complete: targets.length > 0 && pendingNotes === 0,
      judgments: Object.freeze([...retainedJudgments]),
    })
  }

  const resetRun = (position: PianoPerformanceScoringPosition): void => {
    resetMetrics()
    for (const target of targets) target.status = 'pending'
    pendingNotes = targets.length
    skippedNotes = 0
    reconcilePosition(position.playheadBeat)
    resetInputEvidence(position.input)
    lastPlayingSample = null
  }

  const newVoices = (input: PianoInputSnapshot): PianoInputVoice[] => {
    const voices = input.soundingNotes
      .filter((voice) => !seenVoiceIds.has(voice.id))
      .filter((voice) => Number.isFinite(voice.startedAtMs))
      .sort(
        (left, right) =>
          left.startedAtMs - right.startedAtMs ||
          left.id.localeCompare(right.id),
      )
    synchronizeInput(input)
    return voices
  }

  const judgmentForHit = (
    target: ScoreTarget,
    voice: PianoInputVoice,
    deltaMs: number,
    sampledAtMs: number,
  ): PianoPerformanceJudgment => {
    const timing = classifyTiming(deltaMs)
    return Object.freeze({
      noteId: target.note.id,
      noteIndex: target.noteIndex,
      midi: target.note.midi,
      noteName: target.note.name,
      outcome: 'hit',
      timing,
      pitchAccuracy: 'perfect',
      score: hitScore(timing),
      timingDeltaMs: deltaMs,
      inputVoiceId: voice.id,
      judgedAtMs: sampledAtMs,
    })
  }

  const judgmentForMiss = (
    target: ScoreTarget,
    sampledAtMs: number,
  ): PianoPerformanceJudgment =>
    Object.freeze({
      noteId: target.note.id,
      noteIndex: target.noteIndex,
      midi: target.note.midi,
      noteName: target.note.name,
      outcome: 'miss',
      timing: 'miss',
      pitchAccuracy: 'off',
      score: 0,
      timingDeltaMs: null,
      inputVoiceId: null,
      judgedAtMs: sampledAtMs,
    })

  const recordHit = (
    target: ScoreTarget,
    voice: PianoInputVoice,
    deltaMs: number,
    sampledAtMs: number,
  ): PianoPerformanceJudgment => {
    setTargetStatus(target, 'hit')
    const judgment = judgmentForHit(target, voice, deltaMs, sampledAtMs)
    retainJudgment(judgment)
    score += judgment.score
    hits += 1
    combo += 1
    streak = Math.max(streak, combo)
    return judgment
  }

  const recordMiss = (
    target: ScoreTarget,
    sampledAtMs: number,
  ): PianoPerformanceJudgment => {
    setTargetStatus(target, 'miss')
    const judgment = judgmentForMiss(target, sampledAtMs)
    retainJudgment(judgment)
    misses += 1
    combo = 0
    return judgment
  }

  const voiceScoreTimeMs = (
    voice: PianoInputVoice,
    anchor: PlayingSampleAnchor,
  ): number =>
    anchor.scoreTimeMs +
    (voice.startedAtMs - anchor.sampledAtMs) * anchor.playbackRate

  const matchVoice = (
    voice: PianoInputVoice,
    anchor: PlayingSampleAnchor,
  ): { target: ScoreTarget; deltaMs: number } | null => {
    const pitchTargets = targetsByMidi.get(voice.midi)
    if (pitchTargets === undefined) return null

    const estimatedVoiceScoreTimeMs = voiceScoreTimeMs(voice, anchor)
    const scoreWindowMs =
      PIANO_PERFORMANCE_TIMING_WINDOWS_MS.good * anchor.playbackRate
    const firstCandidate = lowerBound(
      pitchTargets,
      estimatedVoiceScoreTimeMs - scoreWindowMs,
      (target) => target.scoreTimeMs,
    )

    let bestTarget: ScoreTarget | null = null
    let bestDeltaMs = Number.POSITIVE_INFINITY
    for (let index = firstCandidate; index < pitchTargets.length; index += 1) {
      const candidate = pitchTargets[index]
      if (candidate.scoreTimeMs > estimatedVoiceScoreTimeMs + scoreWindowMs) {
        break
      }
      if (candidate.status !== 'pending') continue
      const deltaMs =
        (estimatedVoiceScoreTimeMs - candidate.scoreTimeMs) /
        anchor.playbackRate
      if (
        Math.abs(deltaMs) < Math.abs(bestDeltaMs) ||
        (Math.abs(deltaMs) === Math.abs(bestDeltaMs) &&
          bestTarget !== null &&
          candidate.noteIndex < bestTarget.noteIndex)
      ) {
        bestTarget = candidate
        bestDeltaMs = deltaMs
      }
    }

    return bestTarget === null
      ? null
      : { target: bestTarget, deltaMs: bestDeltaMs }
  }

  const expiredTargetsAt = (
    currentScoreTimeMs: number,
    playbackRate: number,
    judgedAtMs: number,
  ): PianoPerformanceJudgment[] => {
    const expiredBeforeScoreTimeMs =
      currentScoreTimeMs -
      PIANO_PERFORMANCE_TIMING_WINDOWS_MS.good * playbackRate
    const produced: PianoPerformanceJudgment[] = []
    while (
      expiryCursor < targets.length &&
      targets[expiryCursor].scoreTimeMs < expiredBeforeScoreTimeMs
    ) {
      const target = targets[expiryCursor]
      expiryCursor += 1
      if (target.status === 'pending') {
        produced.push(recordMiss(target, judgedAtMs))
      }
    }
    return produced
  }

  const finalizePendingTargets = (
    judgedAtMs: number,
  ): PianoPerformanceJudgment[] => {
    const produced: PianoPerformanceJudgment[] = []
    for (const target of targets) {
      if (target.status === 'pending') {
        produced.push(recordMiss(target, judgedAtMs))
      }
    }
    expiryCursor = targets.length
    return produced
  }

  const automaticDiscontinuity = (anchor: PlayingSampleAnchor): boolean => {
    const previous = lastPlayingSample
    if (previous === null) return false
    if (
      anchor.sampledAtMs < previous.sampledAtMs ||
      anchor.playheadBeat < previous.playheadBeat ||
      Math.abs(anchor.playbackRate - previous.playbackRate) > RATE_EPSILON
    ) {
      return true
    }

    const observedElapsedMs = anchor.sampledAtMs - previous.sampledAtMs
    const expectedElapsedMs =
      (anchor.scoreTimeMs - previous.scoreTimeMs) / anchor.playbackRate
    return (
      expectedElapsedMs < 0 ||
      Math.abs(observedElapsedMs - expectedElapsedMs) > discontinuityToleranceMs
    )
  }

  const applyDiscontinuity = (
    reason: PianoPerformanceScoringDiscontinuity,
    position: PianoPerformanceScoringPosition,
  ): PianoPerformanceScoringUpdate => {
    let changed = false
    if (reason === 'seek' || reason === 'loop' || reason === 'clock-jump') {
      changed = reconcilePosition(position.playheadBeat) || changed
      if (combo !== 0) {
        combo = 0
        changed = true
      }
    } else if (reason === 'stop' && combo !== 0) {
      combo = 0
      changed = true
    }
    resetInputEvidence(position.input)
    lastPlayingSample = null
    if (changed) buildState(true)
    return frozenUpdate(currentState, [], reason)
  }

  indexTargets(initialSource)
  resetRun(initialPosition)
  buildState(false)

  return {
    snapshot: () => currentState,
    sample(sample) {
      if (sample.phase === 'complete') {
        lastPlayingSample = null
        const sampledAtMs = Number.isFinite(sample.sampledAtMs)
          ? sample.sampledAtMs
          : 0
        const scoreTimeMs = safeScoreTimeAtBeatMs(sample.playheadBeat)
        const produced: PianoPerformanceJudgment[] = []
        if (
          scoreTimeMs !== null &&
          Number.isFinite(sample.sampledAtMs) &&
          Number.isFinite(sample.playbackRate) &&
          sample.playbackRate > 0
        ) {
          const anchor: PlayingSampleAnchor = {
            playheadBeat: sample.playheadBeat,
            scoreTimeMs,
            sampledAtMs,
            playbackRate: sample.playbackRate,
          }
          for (const voice of newVoices(sample.input)) {
            produced.push(
              ...expiredTargetsAt(
                voiceScoreTimeMs(voice, anchor),
                anchor.playbackRate,
                voice.startedAtMs,
              ),
            )
            const match = matchVoice(voice, anchor)
            if (match !== null) {
              produced.push(
                recordHit(match.target, voice, match.deltaMs, sampledAtMs),
              )
            }
          }
        } else {
          synchronizeInput(sample.input)
        }
        produced.push(...finalizePendingTargets(sampledAtMs))
        if (produced.length > 0) buildState(true)
        return frozenUpdate(currentState, produced)
      }
      if (sample.phase !== 'playing') {
        synchronizeInput(sample.input)
        lastPlayingSample = null
        return frozenUpdate(currentState)
      }

      const scoreTimeMs = safeScoreTimeAtBeatMs(sample.playheadBeat)
      if (
        scoreTimeMs === null ||
        !Number.isFinite(sample.sampledAtMs) ||
        !Number.isFinite(sample.playbackRate) ||
        sample.playbackRate <= 0
      ) {
        return applyDiscontinuity('clock-jump', sample)
      }

      const anchor: PlayingSampleAnchor = {
        playheadBeat: sample.playheadBeat,
        scoreTimeMs,
        sampledAtMs: sample.sampledAtMs,
        playbackRate: sample.playbackRate,
      }
      if (automaticDiscontinuity(anchor)) {
        return applyDiscontinuity('clock-jump', sample)
      }

      const produced: PianoPerformanceJudgment[] = []
      for (const voice of newVoices(sample.input)) {
        produced.push(
          ...expiredTargetsAt(
            voiceScoreTimeMs(voice, anchor),
            anchor.playbackRate,
            voice.startedAtMs,
          ),
        )
        const match = matchVoice(voice, anchor)
        if (match === null) continue
        produced.push(
          recordHit(match.target, voice, match.deltaMs, sample.sampledAtMs),
        )
      }
      produced.push(
        ...expiredTargetsAt(
          anchor.scoreTimeMs,
          anchor.playbackRate,
          sample.sampledAtMs,
        ),
      )
      lastPlayingSample = anchor

      if (produced.length > 0) buildState(true)
      return frozenUpdate(currentState, produced)
    },
    discontinue(event) {
      return applyDiscontinuity(event.reason, event)
    },
    replaceSource(source, position) {
      indexTargets(source)
      resetRun(position)
      buildState(true)
      return frozenUpdate(currentState, [], 'source-replacement')
    },
    reset(position) {
      resetRun(position)
      buildState(true)
      return frozenUpdate(currentState, [], 'reset')
    },
  }
}
