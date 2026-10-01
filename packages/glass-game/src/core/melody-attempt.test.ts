// Melody attempt regressions — calibration, save isolation and core-owned completion.

import { describe, expect, it } from 'vitest'
import { glassMelody } from '../content/melodies'
import type { BreakableDefinition, HoldDefinition, LevelDefinition, MelodyAttemptIdentity, PitchObservation, SavedProgress, } from '../contracts'
import { createGlassGame } from './game'
import { resolveMelodyAttempt } from './melody-attempt'
import { sampleMelodyAtTime } from './melody-contour'
import { mergeSavedProgress, readProgress } from './progress'
import { resolveReplayProfile } from './replay-profile'
import { beginReplayAttempt, readReplayProgress, saveReplayAttempt, } from './replay-progress'

const HOLD: HoldDefinition = {
  requiredSeconds: 0.1,
  toleranceCents: 85,
  confidenceFloor: 0.5,
  dropoutGraceSeconds: 0.2,
  decayPerSecond: 0.25,
  maximumSampleGapSeconds: 0.1,
  maximumSampleAgeMs: 150,
}

const STATIONS = [
  ['station-home', 'sunlit-steps-home'],
  ['station-two', 'sunlit-steps-two'],
  ['station-four', 'sunlit-steps-four'],
  ['station-back-two', 'sunlit-steps-back-two'],
  ['station-return', 'sunlit-steps-return'],
] as const
const FINALE = 'whole-song'

function encounter(
  id: string,
  index: number,
  anchorId: string,
): BreakableDefinition {
  return {
    id,
    label: id,
    position: { x: 0, y: 0, z: 0 },
    anchor: { x: 0, y: 0, z: 0 },
    variant: 'frosted-scroll-wall',
    optional: false,
    requiresCompleted: index === 0 ? [] : [STATIONS[index - 1]![0]],
    challenge: {
      kind: 'melody-anchor',
      lessonId: 'thawing-song',
      anchorId,
      reference: 'anchor-tone',
      step: { hold: HOLD },
    },
  }
}

function level(): LevelDefinition {
  const stations = STATIONS.map(([encounterId, anchorId]) => ({
    encounterId,
    anchorId,
  }))
  return {
    id: 'thawing-song-test',
    title: 'The Thawing Song test',
    authored: {
      levelId: 'thawing-song-test',
      layoutId: 'thawing-song-test-layout',
      contentRevision: 3,
    },
    melodyLesson: {
      id: 'thawing-song',
      revision: 1,
      melody: glassMelody('sunlit-steps'),
      comfortableOffsetSemitones: 2,
      defaultPace: 1.25,
      allowedPaces: [0.8, 1, 1.25],
      allowedRange: { minimumMidi: 36, maximumMidi: 84 },
      judgePolicy: {
        dropoutGraceSeconds: 0.4,
        minimumAnchorEvidenceSeconds: 0.12,
      },
      referenceProfileId: 'merc-sunlit-steps-v1',
      stations,
      finaleEncounterId: FINALE,
    },
    spawn: {
      position: { x: 0, y: 0, z: 0 },
      facingYaw: 0,
      checkpointId: 'arrival',
    },
    platforms: [
      {
        id: 'court',
        minX: -2,
        maxX: 2,
        minZ: -2,
        maxZ: 2,
        top: 0,
        thickness: 0.3,
        kind: 'deck',
        material: 'stone',
      },
    ],
    checkpoints: [
      {
        id: 'arrival',
        position: { x: 0, y: 0, z: 0 },
        radius: 0.3,
        facingYaw: 0,
      },
    ],
    breakables: [
      ...STATIONS.map(([id, anchorId], index) =>
        encounter(id, index, anchorId),
      ),
      {
        id: FINALE,
        label: 'Whole song',
        position: { x: 0, y: 0, z: 0 },
        anchor: { x: 0, y: 0, z: 0 },
        variant: 'portrait-awakened-muse',
        optional: false,
        requiresCompleted: STATIONS.map(([id]) => id),
        challenge: {
          kind: 'melody-contour',
          lessonId: 'thawing-song',
          reference: 'whole-melody',
        },
      },
    ],
    exit: {
      minX: -1,
      maxX: 1,
      minZ: 1.5,
      maxZ: 1.6,
      top: 0,
      requiresCompleted: [FINALE],
    },
    fallBelow: -2,
  }
}

function identity(
  source: LevelDefinition,
  attemptId: string,
): MelodyAttemptIdentity {
  return resolveMelodyAttempt(source, {
    attemptId,
    comfortableMidi: 57,
  }).identity
}

function save(
  source: LevelDefinition,
  attempt: MelodyAttemptIdentity,
  completedBreakableIds: string[],
): SavedProgress {
  return {
    version: 3,
    levelId: source.id,
    checkpointId: 'arrival',
    completedBreakableIds,
    finished: false,
    melodyAttempt: attempt,
  }
}

function frame(
  sequence: number,
  midi: number | null,
  capturedAtMs = sequence * 25,
): PitchObservation {
  return {
    sequence,
    captureSeconds: sequence * 0.025,
    capturedAtMs,
    midi,
    confidence: midi === null ? 0 : 0.95,
  }
}

describe('melody attempt resolution', () => {
  it('centres the reviewed contour on comfortable minus two with lesson defaults', () => {
    const resolved = resolveMelodyAttempt(level(), {
      attemptId: 'attempt-a',
      comfortableMidi: 57,
    })

    expect(resolved.identity).toMatchObject({
      comfortableMidi: 57,
      rootMidi: 55,
      pace: 1.25,
      transposeSemitones: 0,
      lessonId: 'thawing-song',
      melodyId: 'sunlit-steps',
    })
    expect(resolved.melody.anchors.map((anchor) => anchor.midi)).toEqual([
      55, 57, 59, 57, 55,
    ])
  })

  it('rejects unsupported pace, fractional transposition and any out-of-range note', () => {
    const source = level()
    expect(() =>
      resolveMelodyAttempt(source, {
        attemptId: 'bad-pace',
        comfortableMidi: 57,
        pace: 0.9,
      }),
    ).toThrow(/pace/)
    expect(() =>
      resolveMelodyAttempt(source, {
        attemptId: 'bad-transpose',
        comfortableMidi: 57,
        transposeSemitones: 0.5,
      }),
    ).toThrow(/whole number/)
    expect(() =>
      resolveMelodyAttempt(source, {
        attemptId: 'out-of-range',
        comfortableMidi: 37,
      }),
    ).toThrow(/allowed range/)
  })

  it('rejects reordered, repeated or mismatched station truth', () => {
    const reordered = level()
    reordered.melodyLesson = {
      ...reordered.melodyLesson!,
      stations: [
        reordered.melodyLesson!.stations[1]!,
        reordered.melodyLesson!.stations[0]!,
        ...reordered.melodyLesson!.stations.slice(2),
      ],
    }
    expect(() =>
      resolveMelodyAttempt(reordered, {
        attemptId: 'reordered',
        comfortableMidi: 57,
      }),
    ).toThrow(/anchor order/)

    const mismatched = level()
    mismatched.breakables[0]!.challenge = {
      ...mismatched.breakables[0]!.challenge,
      kind: 'melody-anchor',
      lessonId: 'another-lesson',
      anchorId: STATIONS[0][1],
      reference: 'anchor-tone',
      step: { hold: HOLD },
    }
    expect(() =>
      resolveMelodyAttempt(mismatched, {
        attemptId: 'mismatch',
        comfortableMidi: 57,
      }),
    ).toThrow(/does not match/)
  })

  it('uses the replay tier for correction timing without rewriting melody evidence', () => {
    const source = level()
    const encounters = Object.fromEntries(
      source.breakables.map((item) => [item.id, {}]),
    )
    const resolved = [1, 2, 3].map((tier) =>
      resolveReplayProfile(source, {
        id: `melody-replay-${tier}`,
        revision: 1,
        tier: tier as 1 | 2 | 3,
        title: 'Melody replay',
        description: 'A melody attempt.',
        encounters,
      }),
    )
    expect(
      resolved.map(
        (item) => item.level.melodyLesson!.judgePolicy.mismatchGraceSeconds,
      ),
    ).toEqual([1.2, 0.75, 0.45])
    expect(
      resolved.map(
        (item) => item.level.melodyLesson!.judgePolicy.dropoutGraceSeconds,
      ),
    ).toEqual([0.8, 0.4, 0.4])
    for (const item of resolved)
      expect(item.level.melodyLesson!.judgePolicy).toMatchObject({
        minimumAnchorEvidenceSeconds: 0.12,
      })
    expect(
      new Set(resolved.map((item) => item.identity.challengeSignature)),
    ).toHaveLength(3)

    expect(() =>
      resolveReplayProfile(source, {
        id: 'melody-replay-invalid',
        revision: 1,
        tier: 1,
        title: 'Melody replay',
        description: 'A melody attempt.',
        encounters: {
          ...encounters,
          [source.breakables[0]!.id]: { holdSeconds: 1 },
        },
      }),
    ).toThrow(/profile tier/)
  })
})

describe('melody attempt progress', () => {
  it('moves a stale melody replay clear to history while retaining its collection reward', () => {
    const source = level()
    source.rewards = {
      revision: 1,
      discoveries: [],
      grading: [],
      portrait: {
        portraitId: 'thawing-test-portrait',
        legendId: 'thawing-test-legend',
        title: 'Thawing test portrait',
        collectionIndex: 1,
        imageAssetId: 'thawing-test-image',
        awardAfterEncounterId: FINALE,
        representationStatus: 'review',
      },
    }
    const replayProfile = {
      id: 'melody-one-star',
      revision: 1,
      tier: 1 as const,
      title: 'Melody replay',
      description: 'A melody attempt.',
      encounters: Object.fromEntries(
        source.breakables.map((item) => [item.id, {}]),
      ),
    }
    const resolved = resolveReplayProfile(source, replayProfile)
    let state = beginReplayAttempt(
      readReplayProgress(source, [resolved], null),
      resolved,
      false,
    )
    const attempt = resolveMelodyAttempt(resolved.level, {
      attemptId: 'completed-replay',
      comfortableMidi: 57,
    })
    state = saveReplayAttempt(
      state,
      resolved,
      {
        ...readProgress(resolved.level, null),
        completedBreakableIds: resolved.level.breakables.map((item) => item.id),
        finished: true,
        melodyAttempt: attempt.identity,
      },
      100,
    )
    expect(state.clears).toHaveLength(1)
    expect(state.collection.collectedPortraitIds).toEqual([
      'thawing-test-portrait',
    ])

    for (const change of ['version', 'unversioned-anchor'] as const) {
      const changed = level()
      changed.rewards = source.rewards
      const lesson = changed.melodyLesson!
      changed.melodyLesson = {
        ...lesson,
        melody: {
          ...lesson.melody,
          ...(change === 'version'
            ? { version: lesson.melody.version + 1 }
            : {
                phrases: lesson.melody.phrases.map((phrase, phraseIndex) => ({
                  ...phrase,
                  anchors: phrase.anchors.map((anchor, anchorIndex) =>
                    phraseIndex === 0 && anchorIndex === 0
                      ? {
                          ...anchor,
                          offsetSemitones: anchor.offsetSemitones + 1,
                        }
                      : anchor,
                  ),
                })),
              }),
        },
      }
      const changedReplay = resolveReplayProfile(changed, replayProfile)
      const restored = readReplayProgress(changed, [changedReplay], state)
      expect(restored.clears, change).toEqual([])
      expect(restored.historicalClears, change).toHaveLength(1)
      expect(restored.collection.collectedPortraitIds, change).toEqual([
        'thawing-test-portrait',
      ])
    }
  })

  it('invalidates saved route evidence when correction policy changes but keeps earned rewards', () => {
    const source = level()
    source.rewards = {
      revision: 1,
      discoveries: [],
      grading: [],
      portrait: {
        portraitId: 'thawing-test-portrait',
        legendId: 'thawing-test-legend',
        title: 'Thawing test portrait',
        collectionIndex: 1,
        imageAssetId: 'thawing-test-image',
        awardAfterEncounterId: FINALE,
        representationStatus: 'review',
      },
    }
    const stored = save(source, identity(source, 'policy-change'), [
      STATIONS[0][0],
    ])
    stored.rewards = {
      version: 1,
      discoveredEncounterIds: [],
      collectedCoinIds: [],
      qualityResults: [],
      collectedPortraitIds: ['thawing-test-portrait'],
    }
    const changed = level()
    changed.rewards = source.rewards
    changed.melodyLesson = {
      ...changed.melodyLesson!,
      judgePolicy: {
        ...changed.melodyLesson!.judgePolicy,
        mismatchGraceSeconds: 0.75,
      },
    }

    const restored = readProgress(changed, stored)
    expect(restored.melodyAttempt).toBeUndefined()
    expect(restored.completedBreakableIds).toEqual([])
    expect(restored.rewards?.collectedPortraitIds).toEqual([
      'thawing-test-portrait',
    ])
  })

  it('does not restore melody evidence without an exact v3 identity', () => {
    const source = level()
    const raw = {
      version: 2,
      levelId: source.id,
      checkpointId: 'arrival',
      completedBreakableIds: [STATIONS[0][0]],
    }
    expect(readProgress(source, raw).completedBreakableIds).toEqual([])

    const tampered = save(source, identity(source, 'attempt-a'), [
      STATIONS[0][0],
    ])
    tampered.melodyAttempt = {
      ...tampered.melodyAttempt!,
      rootMidi: 56,
    }
    expect(readProgress(source, tampered).completedBreakableIds).toEqual([])
    expect(readProgress(source, tampered).melodyAttempt).toBeUndefined()

    for (const patch of [
      { pace: 0.9 },
      { rootMidi: 56 },
      { contentRevision: 2 },
      { lessonRevision: 2 },
    ]) {
      const changed = save(source, identity(source, 'attempt-changed'), [
        STATIONS[0][0],
      ])
      changed.melodyAttempt = { ...changed.melodyAttempt!, ...patch }
      expect(readProgress(source, changed).completedBreakableIds).toEqual([])
      expect(readProgress(source, changed).melodyAttempt).toBeUndefined()
    }
  })

  it('unions matching attempts but never carries route evidence into a new attempt', () => {
    const source = level()
    const first = identity(source, 'attempt-a')
    const matching = mergeSavedProgress(
      source,
      save(source, first, [STATIONS[0][0]]),
      save(source, first, [STATIONS[0][0], STATIONS[1][0]]),
    )
    expect(matching.completedBreakableIds).toEqual([
      STATIONS[0][0],
      STATIONS[1][0],
    ])

    const replacement = identity(source, 'attempt-b')
    const isolated = mergeSavedProgress(
      source,
      save(source, first, [STATIONS[0][0], STATIONS[1][0]]),
      save(source, replacement, [STATIONS[0][0]]),
    )
    expect(isolated.melodyAttempt?.attemptId).toBe('attempt-b')
    expect(isolated.completedBreakableIds).toEqual([STATIONS[0][0]])
  })
})

describe('melody game lifecycle', () => {
  it('saves configuration before evidence, resolves anchor pitch and freezes after success', () => {
    const source = level()
    const game = createGlassGame(source)
    const configured = game.configureMelodyAttempt({
      attemptId: 'attempt-a',
      comfortableMidi: 57,
    })
    expect(configured).toMatchObject({ ok: true, changed: true })
    expect(game.saveProgress()).toMatchObject({
      version: 3,
      completedBreakableIds: [],
      melodyAttempt: { attemptId: 'attempt-a', rootMidi: 55 },
    })
    expect(
      game.configureMelodyAttempt({
        attemptId: 'attempt-a',
        comfortableMidi: 57,
      }),
    ).toMatchObject({ ok: true, changed: false })

    expect(game.beginEncounter(STATIONS[0][0])).toBe(true)
    expect(game.snapshot().activeEncounter).toMatchObject({
      targetKind: 'melody-anchor',
      target: STATIONS[0][1],
      targetMidi: 55,
    })
    expect(
      game.configureMelodyAttempt({
        attemptId: 'attempt-a',
        comfortableMidi: 57,
      }),
    ).toEqual({ ok: false, reason: 'frozen' })
    const events = []
    for (let index = 0; index < 8; index++)
      events.push(...game.feedPitch(frame(index, 55), index * 25))
    expect(events).toContainEqual({
      type: 'break',
      id: STATIONS[0][0],
      outcome: 'celebration',
    })
    expect(
      game.configureMelodyAttempt({
        attemptId: 'attempt-b',
        comfortableMidi: 59,
      }),
    ).toEqual({ ok: false, reason: 'frozen' })

    const restored = createGlassGame(source, game.saveProgress())
    expect(restored.snapshot().melodyAttempt).toMatchObject({
      attemptId: 'attempt-a',
      rootMidi: 55,
    })
    expect(restored.snapshot().completedBreakableIds).toContain(STATIONS[0][0])
  })

  it('cancels partial evidence, preserves the route and restarts with a fresh judge', () => {
    const source = level()
    const attempt = identity(source, 'attempt-retry')
    const game = createGlassGame(
      source,
      save(source, attempt, [STATIONS[0][0]]),
    )
    expect(game.beginEncounter(STATIONS[1][0])).toBe(true)
    for (let index = 0; index < 3; index++)
      game.feedPitch(frame(index, 57), index * 25)
    expect(game.snapshot().activeEncounter?.charge).toBeGreaterThan(0)

    game.cancelEncounter()
    expect(game.snapshot().activeEncounter).toBeNull()
    expect(game.snapshot().completedBreakableIds).toEqual([STATIONS[0][0]])
    expect(game.beginEncounter(STATIONS[1][0])).toBe(true)
    expect(game.snapshot().activeEncounter).toMatchObject({
      target: STATIONS[1][1],
      charge: 0,
    })
  })

  it('rejects invalid configuration without replacing the current attempt', () => {
    const game = createGlassGame(level())
    expect(game.beginEncounter(STATIONS[0][0])).toBe(false)
    expect(
      game.configureMelodyAttempt({
        attemptId: 'invalid-pace',
        comfortableMidi: 57,
        pace: 0.9,
      }),
    ).toEqual({ ok: false, reason: 'invalid' })
    expect(game.snapshot().melodyAttempt).toBeNull()
    expect(
      game.configureMelodyAttempt({
        attemptId: 'attempt-before-evidence',
        comfortableMidi: 57,
      }),
    ).toMatchObject({ ok: true, changed: true })
    expect(
      game.configureMelodyAttempt({
        attemptId: 'replacement-before-evidence',
        comfortableMidi: 59,
        pace: 1,
      }),
    ).toMatchObject({
      ok: true,
      changed: true,
      attempt: { attemptId: 'replacement-before-evidence', rootMidi: 57 },
    })
  })

  it.each([
    {
      name: 'stale matching contour',
      sing: (
        game: ReturnType<typeof createGlassGame>,
        attempt: ReturnType<typeof resolveMelodyAttempt>,
      ) => {
        for (let index = 0; index < 220; index++) {
          const elapsed = index * 0.025
          const midi = sampleMelodyAtTime(
            attempt.melody,
            Math.min(attempt.melody.durationSeconds - 1e-8, elapsed),
          ).midi
          game.feedPitch(
            frame(index, midi, elapsed * 1000 - 500),
            elapsed * 1000,
          )
        }
      },
    },
    {
      name: 'null silence',
      sing: (game: ReturnType<typeof createGlassGame>) => {
        for (let index = 0; index < 220; index++)
          game.feedPitch(frame(index, null), index * 25)
      },
    },
    {
      name: 'skipped middle anchors',
      sing: (game: ReturnType<typeof createGlassGame>) => {
        for (let index = 0; index < 24; index++)
          game.feedPitch(frame(index, 55), index * 25)
        for (let index = 24; index < 220; index++)
          game.feedPitch(frame(index, 59), index * 25)
      },
    },
    {
      name: 'reused earlier station hold',
      sing: (game: ReturnType<typeof createGlassGame>) => {
        for (let index = 0; index < 8; index++)
          game.feedPitch(frame(index, 55), index * 25)
      },
    },
  ])('keeps the finale incomplete for $name', ({ sing }) => {
    const source = level()
    const attempt = resolveMelodyAttempt(source, {
      attemptId: 'attempt-negative',
      comfortableMidi: 57,
    })
    const game = createGlassGame(
      source,
      save(
        source,
        attempt.identity,
        STATIONS.map(([id]) => id),
      ),
    )
    expect(game.beginEncounter(FINALE)).toBe(true)
    sing(game, attempt)
    expect(game.snapshot().completedBreakableIds).not.toContain(FINALE)
    expect(game.snapshot().activeEncounter).toMatchObject({
      targetKind: 'melody-contour',
      melodyJudge: { complete: false },
    })
  })

  it('keeps a constant tonic incomplete and lets only the judged whole contour break the finale', () => {
    const source = level()
    const attempt = resolveMelodyAttempt(source, {
      attemptId: 'attempt-finale',
      comfortableMidi: 57,
    })
    const completedStations = STATIONS.map(([id]) => id)
    const constant = createGlassGame(
      source,
      save(source, attempt.identity, completedStations),
    )
    expect(constant.beginEncounter(FINALE)).toBe(true)
    for (let index = 0; index < 220; index++)
      constant.feedPitch(frame(index, 55), index * 25)
    expect(constant.snapshot().activeEncounter).toMatchObject({
      targetKind: 'melody-contour',
      melodyJudge: { complete: false },
    })
    expect(constant.snapshot().completedBreakableIds).not.toContain(FINALE)

    const game = createGlassGame(
      source,
      save(source, attempt.identity, completedStations),
    )
    expect(game.beginEncounter(FINALE)).toBe(true)
    const events = []
    let sequence = 0
    for (
      let elapsed = 0;
      elapsed <= attempt.melody.durationSeconds + 1;
      elapsed += 0.025
    ) {
      const target = sampleMelodyAtTime(
        attempt.melody,
        Math.min(attempt.melody.durationSeconds - 1e-8, elapsed),
      ).midi
      events.push(
        ...game.feedPitch(
          {
            sequence,
            captureSeconds: elapsed,
            capturedAtMs: elapsed * 1000,
            midi: target,
            confidence: 0.95,
          },
          elapsed * 1000,
        ),
      )
      sequence++
      if (events.some((event) => event.type === 'break')) break
    }
    expect(events).toContainEqual({
      type: 'break',
      id: FINALE,
      outcome: 'exit-opened',
    })
    expect(game.snapshot().completedBreakableIds).toContain(FINALE)
  })
})
