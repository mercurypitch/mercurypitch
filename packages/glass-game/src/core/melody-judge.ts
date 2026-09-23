// ============================================================
// Live melody judge — bounded forward contour alignment on the capture clock.
// ============================================================
//
// Render frames and reference playback never enter this module. Progress comes
// only from fresh, ordered PitchObservations and locally reachable curve points.

import type { PitchObservation } from '../contracts'
import type { CompiledMelody, CompiledMelodyAnchor, CompiledMelodyPhrase, CompiledMelodySegment, MelodyContourPoint, } from './melody-contour'
import { sampleMelodyAtTime } from './melody-contour'

export interface MelodyJudgePolicy {
  landingToleranceCents: number
  glideToleranceCents: number
  confidenceFloor: number
  maximumSampleAgeMs: number
  maximumSampleGapSeconds: number
  dropoutGraceSeconds: number
  mismatchGraceSeconds: number
  acquisitionSeconds: number
  minimumPace: number
  maximumPace: number
  alignmentResolutionSeconds: number
  maximumAlignmentWindowSeconds: number
  directionThresholdCents: number
}

export const DEFAULT_MELODY_JUDGE_POLICY: MelodyJudgePolicy = {
  landingToleranceCents: 60,
  glideToleranceCents: 70,
  confidenceFloor: 0.5,
  maximumSampleAgeMs: 150,
  maximumSampleGapSeconds: 0.1,
  dropoutGraceSeconds: 0.18,
  mismatchGraceSeconds: 0.45,
  acquisitionSeconds: 0.12,
  minimumPace: 0.65,
  maximumPace: 1.6,
  alignmentResolutionSeconds: 0.01,
  maximumAlignmentWindowSeconds: 0.8,
  directionThresholdCents: 18,
}

export type MelodyJudgePhase = 'acquiring' | 'following' | 'breath' | 'complete'

export type MelodyJudgeFeedback =
  | 'find-start'
  | 'on-track'
  | 'high'
  | 'low'
  | 'dropout'
  | 'stale'
  | 'retry'
  | 'breathe'
  | 'complete'

export type MelodyJudgeEvent =
  | {
      type: 'anchor-complete'
      phraseId: string
      anchorId: string
    }
  | { type: 'phrase-complete'; phraseId: string }
  | { type: 'breath'; afterPhraseId: string; nextPhraseId: string }
  | { type: 'complete' }

export interface MelodyJudgeSnapshot {
  phase: MelodyJudgePhase
  feedback: MelodyJudgeFeedback
  progress: number
  phraseIndex: number
  phraseCount: number
  currentPhraseId: string
  targetMidi: number
  pitchErrorCents: number | null
  coveredAnchorIds: readonly string[]
  completedPhraseIds: readonly string[]
  retryCount: number
  complete: boolean
}

export interface MelodyJudge {
  feed(frame: PitchObservation, nowMs: number): readonly MelodyJudgeEvent[]
  /** Absolute foreground clock shared by capture callbacks and presentation. */
  advanceTo(nowMs: number): void
  snapshot(): MelodyJudgeSnapshot
}

interface AlignmentCandidate {
  timeSeconds: number
  errorCents: number
}

type Interruption = { kind: 'mismatch'; startedCaptureSeconds: number } | null

const EPSILON = 1e-9

function finite(value: number): boolean {
  return Number.isFinite(value)
}

function validatePolicy(policy: MelodyJudgePolicy): void {
  const positive: Array<[string, number]> = [
    ['landingToleranceCents', policy.landingToleranceCents],
    ['glideToleranceCents', policy.glideToleranceCents],
    ['maximumSampleAgeMs', policy.maximumSampleAgeMs],
    ['maximumSampleGapSeconds', policy.maximumSampleGapSeconds],
    ['dropoutGraceSeconds', policy.dropoutGraceSeconds],
    ['mismatchGraceSeconds', policy.mismatchGraceSeconds],
    ['acquisitionSeconds', policy.acquisitionSeconds],
    ['minimumPace', policy.minimumPace],
    ['maximumPace', policy.maximumPace],
    ['alignmentResolutionSeconds', policy.alignmentResolutionSeconds],
    ['maximumAlignmentWindowSeconds', policy.maximumAlignmentWindowSeconds],
  ]
  for (const [name, value] of positive) {
    if (!finite(value) || value <= 0)
      throw new Error(`Melody judge ${name} must be finite and positive.`)
  }
  if (
    !finite(policy.confidenceFloor) ||
    policy.confidenceFloor < 0 ||
    policy.confidenceFloor > 1
  )
    throw new Error('Melody judge confidenceFloor must be within [0, 1].')
  if (
    !finite(policy.directionThresholdCents) ||
    policy.directionThresholdCents < 0
  )
    throw new Error(
      'Melody judge directionThresholdCents must be finite and non-negative.',
    )
  if (policy.minimumPace > policy.maximumPace)
    throw new Error('Melody judge pace range is inverted.')
  if (policy.dropoutGraceSeconds < policy.maximumSampleGapSeconds)
    throw new Error(
      'Melody judge dropout grace must cover the maximum sample gap.',
    )
  if (policy.maximumAlignmentWindowSeconds < policy.alignmentResolutionSeconds)
    throw new Error(
      'Melody judge alignment window must cover at least one resolution step.',
    )
}

function pointTolerance(
  point: MelodyContourPoint,
  policy: MelodyJudgePolicy,
): number {
  return point.kind === 'landing'
    ? policy.landingToleranceCents
    : policy.glideToleranceCents
}

function pitchFeedback(errorCents: number): MelodyJudgeFeedback {
  if (errorCents > 0) return 'high'
  if (errorCents < 0) return 'low'
  return 'on-track'
}

/**
 * Judge one compiled melody. Discarding this object is the attempt reset; prior
 * completed phrases are retained internally only while this attempt is alive.
 */
export function createMelodyJudge(
  melody: CompiledMelody,
  overrides: Partial<MelodyJudgePolicy> = {},
): MelodyJudge {
  if (melody.phrases.length === 0 || melody.anchors.length === 0)
    throw new Error('Melody judge requires a compiled melody with anchors.')
  const policy = { ...DEFAULT_MELODY_JUDGE_POLICY, ...overrides }
  validatePolicy(policy)

  let sequence = -Infinity
  let captureSeconds = -Infinity
  let advancedAtMs = -Infinity
  let latestFreshCapturedAtMs = -Infinity
  let phraseIndex = 0
  let phase: MelodyJudgePhase = 'acquiring'
  let feedback: MelodyJudgeFeedback = 'find-start'
  let pitchErrorCents: number | null = null
  let candidates: number[] = []
  let confirmedPhase = melody.phrases[0].phaseStart
  let acquisitionAnchor = melody.phrases[0].anchors[0]
  let acquisitionTime = melody.phrases[0].startSeconds
  let acquisitionLastCapture: number | null = null
  let acquisitionAccumulated = 0
  let lastGoodCapture: number | null = null
  let lastGoodMidi: number | null = null
  let interruption: Interruption = null
  let retryCount = 0
  let complete = false
  const coveredAnchors = new Set<string>()
  const completedPhrases = new Set<string>()
  const handledSeparations = new Set<string>()

  const currentPhrase = (): CompiledMelodyPhrase => melody.phrases[phraseIndex]

  const judgePoint = (
    timeSeconds: number,
    phrase: CompiledMelodyPhrase = currentPhrase(),
  ): MelodyContourPoint =>
    sampleMelodyAtTime(
      melody,
      Math.min(timeSeconds, phrase.endSeconds - EPSILON),
    )

  const targetAt = (timeSeconds: number): number => {
    const point = judgePoint(timeSeconds)
    if (point.midi === null)
      throw new Error('Melody judge target fell inside a silent segment.')
    return point.midi
  }

  const clearAcquisition = (): void => {
    acquisitionLastCapture = null
    acquisitionAccumulated = 0
  }

  const beginAcquisition = (
    anchor: CompiledMelodyAnchor,
    timeSeconds: number,
    nextPhase: MelodyJudgePhase = 'acquiring',
  ): void => {
    phase = nextPhase
    acquisitionAnchor = anchor
    acquisitionTime = timeSeconds
    clearAcquisition()
    candidates = []
    lastGoodCapture = null
    lastGoodMidi = null
    interruption = null
    pitchErrorCents = null
    feedback = nextPhase === 'breath' ? 'breathe' : 'find-start'
  }

  const resetCurrentPhrase = (): void => {
    const phrase = currentPhrase()
    for (const anchor of phrase.anchors) coveredAnchors.delete(anchor.id)
    for (const segment of phrase.segments) handledSeparations.delete(segment.id)
    confirmedPhase = phrase.phaseStart
    retryCount++
    beginAcquisition(phrase.anchors[0], phrase.startSeconds)
    feedback = 'retry'
  }

  const advanceTo = (nowMs: number): void => {
    if (!finite(nowMs) || nowMs < advancedAtMs) return
    advancedAtMs = nowMs
    if (complete || phase === 'breath' || latestFreshCapturedAtMs === -Infinity)
      return
    const silenceMs = nowMs - latestFreshCapturedAtMs
    if (
      silenceMs >
      policy.maximumSampleAgeMs + policy.dropoutGraceSeconds * 1000
    )
      resetCurrentPhrase()
  }

  const feedbackAgainst = (midi: number, targetMidi: number): void => {
    pitchErrorCents = (midi - targetMidi) * 100
    feedback = pitchFeedback(pitchErrorCents)
  }

  const freshVoiced = (
    frame: PitchObservation,
    nowMs: number,
  ): frame is PitchObservation & { midi: number } => {
    const age = nowMs - frame.capturedAtMs
    if (
      !finite(frame.capturedAtMs) ||
      !finite(age) ||
      age < -5 ||
      age > policy.maximumSampleAgeMs
    ) {
      feedback = 'stale'
      pitchErrorCents = null
      return false
    }
    latestFreshCapturedAtMs = frame.capturedAtMs
    if (
      frame.midi === null ||
      !finite(frame.midi) ||
      !finite(frame.confidence) ||
      frame.confidence < policy.confidenceFloor
    ) {
      feedback = 'dropout'
      pitchErrorCents = null
      return false
    }
    return true
  }

  const directionCompatible = (
    nextPoint: MelodyContourPoint,
    midi: number,
  ): boolean => {
    if (lastGoodMidi === null || nextPoint.midi === null) return true
    const segment = melody.segments.find(
      (candidate) => candidate.id === nextPoint.segmentId,
    )
    if (
      segment?.kind !== 'glide' ||
      segment.fromMidi === null ||
      segment.toMidi === null
    )
      return true
    const sungDelta = (midi - lastGoodMidi) * 100
    const targetDelta = (segment.toMidi - segment.fromMidi) * 100
    if (
      Math.abs(sungDelta) < policy.directionThresholdCents ||
      Math.abs(targetDelta) < policy.directionThresholdCents
    )
      return true
    return Math.sign(sungDelta) === Math.sign(targetDelta)
  }

  const reachableFromPrior = (
    timeSeconds: number,
    elapsed: number,
    point: MelodyContourPoint,
    midi: number,
  ): boolean =>
    candidates.some((priorTime) => {
      const advance = timeSeconds - priorTime
      return (
        advance + EPSILON >= elapsed * policy.minimumPace &&
        advance <= elapsed * policy.maximumPace + EPSILON &&
        directionCompatible(point, midi)
      )
    })

  const candidateGrid = (minimum: number, maximum: number): number[] => {
    const phrase = currentPhrase()
    const lastPitchedTime = phrase.endSeconds - EPSILON
    const low = Math.max(phrase.startSeconds, minimum)
    const high = Math.min(lastPitchedTime, maximum)
    if (high + EPSILON < low) return []
    const resolution = policy.alignmentResolutionSeconds
    const values = new Set<number>([low, high])
    const firstStep = Math.ceil((low - EPSILON) / resolution) * resolution
    for (let value = firstStep; value <= high + EPSILON; value += resolution)
      values.add(Math.min(high, value))
    return [...values].sort((left, right) => left - right)
  }

  const trimAlignmentWindow = (
    matching: AlignmentCandidate[],
    elapsed: number,
  ): number[] => {
    if (matching.length === 0) return []
    matching.sort((left, right) => left.timeSeconds - right.timeSeconds)
    const span = matching.at(-1)!.timeSeconds - matching[0].timeSeconds
    if (span <= policy.maximumAlignmentWindowSeconds + EPSILON)
      return matching.map((candidate) => candidate.timeSeconds)
    const priorMiddle =
      candidates.reduce((sum, value) => sum + value, 0) / candidates.length
    const nominal = priorMiddle + elapsed
    const best = [...matching].sort(
      (left, right) =>
        left.errorCents - right.errorCents ||
        Math.abs(left.timeSeconds - nominal) -
          Math.abs(right.timeSeconds - nominal),
    )[0]
    const halfWindow = policy.maximumAlignmentWindowSeconds / 2
    return matching
      .filter(
        (candidate) =>
          Math.abs(candidate.timeSeconds - best.timeSeconds) <=
          halfWindow + EPSILON,
      )
      .map((candidate) => candidate.timeSeconds)
  }

  const alignForward = (midi: number, elapsed: number): number[] => {
    const minimum = Math.min(...candidates) + elapsed * policy.minimumPace
    const maximum = Math.max(...candidates) + elapsed * policy.maximumPace
    const matching: AlignmentCandidate[] = []
    for (const timeSeconds of candidateGrid(minimum, maximum)) {
      const point = judgePoint(timeSeconds)
      if (
        point.midi === null ||
        !reachableFromPrior(timeSeconds, elapsed, point, midi)
      )
        continue
      const errorCents = Math.abs(midi - point.midi) * 100
      if (errorCents <= pointTolerance(point, policy) + EPSILON)
        matching.push({ timeSeconds, errorCents })
    }
    return trimAlignmentWindow(matching, elapsed)
  }

  const matchingCurrentCandidates = (midi: number): number[] =>
    candidates.filter((timeSeconds) => {
      const point = judgePoint(timeSeconds)
      return (
        point.midi !== null &&
        Math.abs(midi - point.midi) * 100 <=
          pointTolerance(point, policy) + EPSILON
      )
    })

  const coverReachedAnchors = (
    events: MelodyJudgeEvent[],
    furthestTime: number,
  ): void => {
    const phrase = currentPhrase()
    for (const anchor of phrase.anchors) {
      if (
        coveredAnchors.has(anchor.id) ||
        furthestTime + policy.alignmentResolutionSeconds / 2 <
          anchor.completedAtSeconds
      )
        continue
      coveredAnchors.add(anchor.id)
      events.push({
        type: 'anchor-complete',
        phraseId: phrase.id,
        anchorId: anchor.id,
      })
    }
  }

  const separationReached = (
    furthestTime: number,
  ): CompiledMelodySegment | undefined =>
    currentPhrase().segments.find(
      (segment) =>
        segment.kind === 'separate-note' &&
        !handledSeparations.has(segment.id) &&
        furthestTime + policy.alignmentResolutionSeconds / 2 >=
          segment.startSeconds,
    )

  const finishPhrase = (events: MelodyJudgeEvent[]): void => {
    const phrase = currentPhrase()
    if (!completedPhrases.has(phrase.id)) {
      completedPhrases.add(phrase.id)
      events.push({ type: 'phrase-complete', phraseId: phrase.id })
    }
    if (phraseIndex === melody.phrases.length - 1) {
      complete = true
      phase = 'complete'
      feedback = 'complete'
      pitchErrorCents = 0
      confirmedPhase = 1
      events.push({ type: 'complete' })
      return
    }
    const afterPhraseId = phrase.id
    phraseIndex++
    const nextPhrase = currentPhrase()
    confirmedPhase = nextPhrase.phaseStart
    beginAcquisition(nextPhrase.anchors[0], nextPhrase.startSeconds, 'breath')
    events.push({
      type: 'breath',
      afterPhraseId,
      nextPhraseId: nextPhrase.id,
    })
  }

  const updateProgress = (): MelodyJudgeEvent[] => {
    const events: MelodyJudgeEvent[] = []
    const phrase = currentPhrase()
    const furthestTime = Math.max(...candidates)
    confirmedPhase = Math.max(confirmedPhase, judgePoint(furthestTime).phase)
    coverReachedAnchors(events, furthestTime)
    const separation = separationReached(furthestTime)
    if (separation !== undefined) {
      handledSeparations.add(separation.id)
      const nextAnchor = phrase.anchors.find(
        (anchor) => anchor.id === separation.toAnchorId,
      )
      if (!nextAnchor)
        throw new Error(
          `Separate-note segment ${separation.id} lost its anchor.`,
        )
      confirmedPhase = separation.phaseEnd
      beginAcquisition(nextAnchor, separation.endSeconds)
      return events
    }
    if (
      furthestTime + policy.alignmentResolutionSeconds / 2 >=
      phrase.endSeconds
    )
      finishPhrase(events)
    return events
  }

  const startFollowing = (
    frame: PitchObservation & { midi: number },
  ): MelodyJudgeEvent[] => {
    const phrase = currentPhrase()
    const landing = phrase.segments.find(
      (segment) =>
        segment.kind === 'landing' &&
        segment.fromAnchorId === acquisitionAnchor.id &&
        segment.startSeconds === acquisitionTime,
    )
    if (!landing)
      throw new Error(
        `Acquisition anchor ${acquisitionAnchor.id} lost its landing.`,
      )
    const minimum = Math.min(
      landing.endSeconds - EPSILON,
      acquisitionTime + acquisitionAccumulated * policy.minimumPace,
    )
    const maximum = Math.min(
      landing.endSeconds - EPSILON,
      acquisitionTime + acquisitionAccumulated * policy.maximumPace,
    )
    const seeded = candidateGrid(minimum, maximum).filter(
      (timeSeconds) =>
        Math.abs(frame.midi - targetAt(timeSeconds)) * 100 <=
        policy.landingToleranceCents + EPSILON,
    )
    candidates = seeded.length > 0 ? seeded : [acquisitionTime]
    phase = 'following'
    feedback = 'on-track'
    pitchErrorCents = 0
    lastGoodCapture = frame.captureSeconds
    lastGoodMidi = frame.midi
    interruption = null
    return updateProgress()
  }

  const acquire = (
    frame: PitchObservation & { midi: number },
  ): MelodyJudgeEvent[] => {
    if (phase === 'breath') {
      phase = 'acquiring'
      feedback = 'find-start'
    }
    const targetMidi = acquisitionAnchor.midi
    const errorCents = (frame.midi - targetMidi) * 100
    pitchErrorCents = errorCents
    if (Math.abs(errorCents) > policy.landingToleranceCents + EPSILON) {
      clearAcquisition()
      feedback = pitchFeedback(errorCents)
      return []
    }
    feedback = 'on-track'
    if (acquisitionLastCapture === null) {
      acquisitionLastCapture = frame.captureSeconds
      acquisitionAccumulated = 0
      return []
    }
    const elapsed = frame.captureSeconds - acquisitionLastCapture
    acquisitionLastCapture = frame.captureSeconds
    if (elapsed > policy.maximumSampleGapSeconds + EPSILON) {
      acquisitionAccumulated = 0
      return []
    }
    acquisitionAccumulated += elapsed
    if (acquisitionAccumulated + EPSILON < policy.acquisitionSeconds) return []
    return startFollowing(frame)
  }

  const handleDropout = (frame: PitchObservation): void => {
    if (phase === 'breath') return
    if (phase === 'acquiring') {
      if (
        acquisitionLastCapture !== null &&
        frame.captureSeconds - acquisitionLastCapture >
          policy.dropoutGraceSeconds + EPSILON
      )
        clearAcquisition()
      return
    }
    if (
      phase === 'following' &&
      lastGoodCapture !== null &&
      frame.captureSeconds - lastGoodCapture >
        policy.dropoutGraceSeconds + EPSILON
    )
      resetCurrentPhrase()
  }

  const follow = (
    frame: PitchObservation & { midi: number },
  ): MelodyJudgeEvent[] => {
    if (lastGoodCapture === null || candidates.length === 0) {
      resetCurrentPhrase()
      return acquire(frame)
    }
    if (interruption?.kind === 'mismatch') {
      const elapsedSinceGood = frame.captureSeconds - lastGoodCapture
      if (elapsedSinceGood <= policy.maximumSampleGapSeconds + EPSILON) {
        const recovered = alignForward(frame.midi, elapsedSinceGood)
        if (recovered.length > 0) {
          candidates = recovered
          lastGoodCapture = frame.captureSeconds
          lastGoodMidi = frame.midi
          interruption = null
          feedback = 'on-track'
          pitchErrorCents = 0
          return updateProgress()
        }
      }
      const matching = matchingCurrentCandidates(frame.midi)
      if (matching.length > 0) {
        candidates = matching
        lastGoodCapture = frame.captureSeconds
        lastGoodMidi = frame.midi
        interruption = null
        feedback = 'on-track'
        pitchErrorCents = 0
        return []
      }
      feedbackAgainst(frame.midi, targetAt(Math.max(...candidates)))
      if (
        frame.captureSeconds - interruption.startedCaptureSeconds >
        policy.mismatchGraceSeconds + EPSILON
      ) {
        resetCurrentPhrase()
        return acquire(frame)
      }
      return []
    }
    const elapsed = frame.captureSeconds - lastGoodCapture
    if (elapsed > policy.dropoutGraceSeconds + EPSILON) {
      resetCurrentPhrase()
      return acquire(frame)
    }
    const aligned = alignForward(frame.midi, elapsed)
    if (aligned.length === 0) {
      interruption = {
        kind: 'mismatch',
        startedCaptureSeconds: frame.captureSeconds,
      }
      feedbackAgainst(frame.midi, targetAt(Math.max(...candidates)))
      return []
    }
    candidates = aligned
    lastGoodCapture = frame.captureSeconds
    lastGoodMidi = frame.midi
    interruption = null
    const point = judgePoint(Math.max(...candidates))
    feedbackAgainst(frame.midi, point.midi!)
    if (Math.abs(pitchErrorCents!) <= pointTolerance(point, policy))
      feedback = 'on-track'
    return updateProgress()
  }

  return {
    feed(frame, nowMs) {
      if (complete) return []
      if (
        !finite(nowMs) ||
        nowMs < advancedAtMs ||
        !finite(frame.sequence) ||
        !finite(frame.captureSeconds) ||
        frame.sequence <= sequence ||
        frame.captureSeconds <= captureSeconds
      )
        return []
      advanceTo(nowMs)
      sequence = frame.sequence
      captureSeconds = frame.captureSeconds
      if (!freshVoiced(frame, nowMs)) {
        handleDropout(frame)
        return []
      }
      if (phase === 'acquiring' || phase === 'breath') return acquire(frame)
      return follow(frame)
    },
    advanceTo,
    snapshot() {
      const phrase = currentPhrase()
      const targetMidi =
        phase === 'acquiring' || phase === 'breath'
          ? acquisitionAnchor.midi
          : complete
            ? melody.anchors.at(-1)!.midi
            : targetAt(
                candidates.length > 0
                  ? Math.max(...candidates)
                  : phrase.startSeconds,
              )
      return {
        phase,
        feedback,
        progress: complete ? 1 : Math.max(0, Math.min(1, confirmedPhase)),
        phraseIndex,
        phraseCount: melody.phrases.length,
        currentPhraseId: phrase.id,
        targetMidi,
        pitchErrorCents,
        coveredAnchorIds: [...coveredAnchors],
        completedPhraseIds: [...completedPhrases],
        retryCount,
        complete,
      }
    },
  }
}
