// Reward regressions — grade capture time, preserve bests and migrate portrait ownership.

import { describe, expect, it } from 'vitest'
import type { ChallengeDefinition, LevelDefinition, PitchAccuracyGradingPolicy, PitchObservation, SingingQualityResult, } from '../contracts'
import type { ChallengeProgress } from './challenge'
import { readProgress } from './progress'
import { applyEncounterRewards, createSingingQualityAttempt, mergeRewardProgress, qualityResultMatchesPolicy, readRewardProgress, } from './rewards'

const hold = {
  requiredSeconds: 0.4,
  toleranceCents: 75,
  confidenceFloor: 0.6,
  dropoutGraceSeconds: 0.1,
  decayPerSecond: 0.5,
  maximumSampleGapSeconds: 0.11,
  maximumSampleAgeMs: 120,
}

const HOLD_CHALLENGE: ChallengeDefinition = {
  kind: 'hold',
  step: { target: 'comfortable', hold },
}

const PAIR_CHALLENGE: ChallengeDefinition = {
  kind: 'ordered-pair',
  steps: [
    { target: 'low', hold },
    { target: 'high', hold },
  ],
  wrongOrder: 'reset',
}

const WAVE_CHALLENGE: ChallengeDefinition = {
  kind: 'settle-wave',
  step: { target: 'comfortable', hold },
  wave: {
    requiredCycles: 2,
    minimumExcursionCents: 100,
    maximumExcursionCents: 400,
    minimumCycleSeconds: 0.8,
    maximumCycleSeconds: 3,
    minimumWaveSeconds: 1.8,
    maximumCentsPerSecond: 900,
    smoothingSeconds: 0.08,
  },
}

const POLICY: PitchAccuracyGradingPolicy = {
  kind: 'pitch-accuracy-v1',
  encounterId: 'pilot/final',
  policyRevision: 2,
  challengeRevision: 3,
  minimumReliableSeconds: 0.5,
  threeStarMaxMeanCents: 35,
  twoStarMaxMeanCents: 75,
  maximumErrorCents: 600,
}

const LEVEL: LevelDefinition = {
  id: 'reward-pilot',
  title: 'Reward pilot',
  authored: {
    levelId: 'reward-pilot',
    layoutId: 'gallery',
    contentRevision: 4,
  },
  spawn: {
    position: { x: 0, y: 0, z: 0 },
    facingYaw: 0,
    checkpointId: 'arrival',
  },
  platforms: [],
  checkpoints: [
    {
      id: 'arrival',
      position: { x: 0, y: 0, z: 0 },
      facingYaw: 0,
      radius: 0.5,
    },
  ],
  breakables: [
    {
      id: 'pilot/optional',
      label: 'Optional glass',
      position: { x: 0, y: 0, z: 0 },
      anchor: { x: 0, y: 0, z: 0 },
      variant: 'glass',
      optional: true,
      challenge: HOLD_CHALLENGE,
    },
    {
      id: 'pilot/final',
      label: 'Final glass',
      position: { x: 0, y: 0, z: 0 },
      anchor: { x: 0, y: 0, z: 0 },
      variant: 'glass',
      optional: false,
      challenge: HOLD_CHALLENGE,
    },
  ],
  exit: {
    minX: 0,
    maxX: 1,
    minZ: 0,
    maxZ: 1,
    top: 0,
    requiresCompleted: ['pilot/final'],
  },
  fallBelow: -2,
  rewards: {
    revision: 1,
    discoveries: [
      {
        encounterId: 'pilot/optional',
        coinIds: ['archive-mark', 'archive-light'],
      },
    ],
    grading: [POLICY],
    portrait: {
      portraitId: 'awakened-muse',
      legendId: 'she-who-woke-glass',
      title: 'She Who Woke the Glass',
      collectionIndex: 1,
      imageAssetId: 'painting-portrait-v5',
      awardAfterEncounterId: 'pilot/final',
      representationStatus: 'approved',
    },
  },
}

function frame(
  sequence: number,
  captureSeconds: number,
  midi: number | null = 60,
  confidence = 0.9,
  ageMs = 0,
): { observation: PitchObservation; nowMs: number } {
  const capturedAtMs = captureSeconds * 1000
  return {
    observation: {
      sequence,
      captureSeconds,
      capturedAtMs,
      midi,
      confidence,
    },
    nowMs: capturedAtMs + ageMs,
  }
}

function progress(
  definition: ChallengeDefinition,
  stepIndex = 0,
): ChallengeProgress {
  switch (definition.kind) {
    case 'hold':
      return {
        kind: 'hold',
        stepIndex: 0,
        stepCount: 1,
        stepCharge: 0,
        charge: 0,
        target: 'comfortable',
        targetMidi: 60,
      }
    case 'ordered-pair':
      return {
        kind: 'ordered-pair',
        stepIndex,
        stepCount: 2,
        stepCharge: 0,
        charge: stepIndex / 2,
        target: stepIndex === 0 ? 'low' : 'high',
        targetMidi: stepIndex === 0 ? 57 : 60,
      }
    default:
      throw new Error('Fixture supports explicit-target grading only')
  }
}

function observe(
  definition: ChallengeDefinition,
  samples: readonly ReturnType<typeof frame>[],
) {
  const attempt = createSingingQualityAttempt(LEVEL, definition, POLICY)
  if (attempt === undefined) throw new Error('Expected a supported attempt')
  for (const sample of samples)
    attempt.observe(sample.observation, sample.nowMs, progress(definition))
  return attempt.finish()
}

function quality(
  grade: SingingQualityResult['grade'],
  meanAbsoluteCents: number | undefined,
  policyRevision = 2,
): SingingQualityResult {
  return {
    encounterId: POLICY.encounterId,
    grade,
    policyRevision,
    challengeRevision: 3,
    contentRevision: 4,
    evidenceVersion: 'pitch-accuracy-v1',
    reliableSeconds: 0.8,
    ...(meanAbsoluteCents === undefined ? {} : { meanAbsoluteCents }),
  }
}

describe('singing-quality grading', () => {
  it('distinguishes saved results from earlier grading revisions', () => {
    expect(qualityResultMatchesPolicy(quality(3, 21), POLICY)).toBe(true)
    expect(qualityResultMatchesPolicy(quality(3, 21, 1), POLICY)).toBe(false)
    expect(
      qualityResultMatchesPolicy(
        { ...quality(3, 21), challengeRevision: 2 },
        POLICY,
      ),
    ).toBe(false)
  })

  it('leaves challenge kinds outside the explicit v1 policy ungraded', () => {
    expect(
      createSingingQualityAttempt(LEVEL, WAVE_CHALLENGE, POLICY),
    ).toBeUndefined()
  })

  it('uses capture duration and ignores duplicate callback delivery', () => {
    const samples = Array.from({ length: 7 }, (_, index) =>
      frame(index, index / 10),
    )
    const baseline = observe(HOLD_CHALLENGE, samples)
    const attempt = createSingingQualityAttempt(LEVEL, HOLD_CHALLENGE, POLICY)
    if (attempt === undefined) throw new Error('Expected a supported attempt')
    for (const sample of samples) {
      attempt.observe(
        sample.observation,
        sample.nowMs,
        progress(HOLD_CHALLENGE),
      )
      attempt.observe(
        sample.observation,
        sample.nowMs + 5,
        progress(HOLD_CHALLENGE),
      )
    }

    expect(baseline).toMatchObject({ grade: 3, reliableSeconds: 0.6 })
    expect(attempt.finish()).toEqual(baseline)
  })

  it('does not bridge stale, weak, unvoiced or widely gapped frames', () => {
    const samples = [
      frame(0, 0),
      frame(1, 0.1, 60, 0.9, 130),
      frame(2, 0.2),
      frame(3, 0.3, 60, 0.5),
      frame(4, 0.4),
      frame(5, 0.5, null),
      frame(6, 0.6),
      frame(7, 0.8),
      frame(8, 0.9),
    ]

    expect(observe(HOLD_CHALLENGE, samples)).toMatchObject({
      grade: 'not-graded',
      reliableSeconds: 0.1,
    })
  })

  it('returns ungraded when reliable voiced evidence is insufficient', () => {
    expect(observe(HOLD_CHALLENGE, [frame(0, 0), frame(1, 0.1)])).toMatchObject(
      {
        grade: 'not-graded',
        reliableSeconds: 0.1,
        meanAbsoluteCents: 0,
      },
    )
  })

  it('counts confident out-of-tolerance wandering before a perfect finish', () => {
    const samples = Array.from({ length: 13 }, (_, index) =>
      frame(index, index / 10, index <= 5 ? 63 : 60),
    )

    expect(observe(HOLD_CHALLENGE, samples)).toMatchObject({
      grade: 1,
      reliableSeconds: 1.2,
      meanAbsoluteCents: 137.5,
    })
  })

  it('does not credit the interval across an ordered-pair target boundary', () => {
    const attempt = createSingingQualityAttempt(LEVEL, PAIR_CHALLENGE, POLICY)
    if (attempt === undefined) throw new Error('Expected a supported attempt')
    for (const sample of [frame(0, 0, 57), frame(1, 0.1, 57)])
      attempt.observe(
        sample.observation,
        sample.nowMs,
        progress(PAIR_CHALLENGE, 0),
      )
    for (const sample of [frame(2, 0.2), frame(3, 0.3)])
      attempt.observe(
        sample.observation,
        sample.nowMs,
        progress(PAIR_CHALLENGE, 1),
      )

    expect(attempt.finish()).toMatchObject({
      grade: 'not-graded',
      reliableSeconds: 0.2,
    })
  })

  it('clears the full attempt after a wrong-order reset', () => {
    const attempt = createSingingQualityAttempt(LEVEL, HOLD_CHALLENGE, POLICY)
    if (attempt === undefined) throw new Error('Expected a supported attempt')
    for (const sample of [frame(0, 0, 63), frame(1, 0.1, 63)])
      attempt.observe(
        sample.observation,
        sample.nowMs,
        progress(HOLD_CHALLENGE),
      )
    attempt.reset()
    for (const sample of Array.from({ length: 7 }, (_, index) =>
      frame(index + 2, 0.2 + index / 10),
    ))
      attempt.observe(
        sample.observation,
        sample.nowMs,
        progress(HOLD_CHALLENGE),
      )

    expect(attempt.finish()).toMatchObject({ grade: 3, reliableSeconds: 0.6 })
  })
})

describe('durable rewards', () => {
  it('grants finite discovery coins once across repeat application', () => {
    const empty = readRewardProgress(LEVEL, undefined, new Set())
    const once = applyEncounterRewards(LEVEL, empty, 'pilot/optional')
    const twice = applyEncounterRewards(LEVEL, once, 'pilot/optional')

    expect(twice.discoveredEncounterIds).toEqual(['pilot/optional'])
    expect(twice.collectedCoinIds).toEqual(['archive-mark', 'archive-light'])
  })

  it('keeps the best result and its policy revision across replays', () => {
    const best = applyEncounterRewards(
      LEVEL,
      readRewardProgress(LEVEL, undefined, new Set()),
      POLICY.encounterId,
      quality(3, 20, 1),
    )
    const replay = applyEncounterRewards(
      LEVEL,
      readRewardProgress(LEVEL, undefined, new Set()),
      POLICY.encounterId,
      quality(1, 180, 2),
    )

    expect(mergeRewardProgress(LEVEL, best, replay).qualityResults).toEqual([
      quality(3, 20, 1),
    ])
  })

  it('migrates a completed version-one save to the portrait without inventing stars', () => {
    const migrated = readProgress(LEVEL, {
      version: 1,
      levelId: LEVEL.id,
      checkpointId: 'arrival',
      completedBreakableIds: ['pilot/final'],
      finished: true,
    })

    expect(migrated).toMatchObject({ version: 2, finished: true })
    expect(migrated.rewards?.collectedPortraitIds).toEqual(['awakened-muse'])
    expect(migrated.rewards?.qualityResults).toEqual([])
  })
})
