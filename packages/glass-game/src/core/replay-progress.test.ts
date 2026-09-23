// Replay persistence regressions — difficulty changes never borrow earlier broken exhibits.

import { describe, expect, it } from 'vitest'
import { MUSEUM_CAMPAIGN } from '../content/campaign'
import { GLASSWORKS_JOURNEY } from '../content/glassworks-journey'
import { replayProfilesForLevel } from '../content/replay-profiles'
import type { SavedProgress } from '../contracts'
import { readProgress } from './progress'
import { resolveReplayProfile } from './replay-profile'
import { beginReplayAttempt, canEnterReplay, highestReplayTier, readReplayProgress, saveReplayAttempt, } from './replay-progress'

const level = GLASSWORKS_JOURNEY
const profiles = replayProfilesForLevel(level).map((profile) =>
  resolveReplayProfile(level, profile),
)
const easy = profiles[0]!
const hard = profiles[2]!
const blank = () => readReplayProgress(level, profiles, undefined)
const complete = (profile = easy): SavedProgress => ({
  ...readProgress(profile.level, undefined),
  completedBreakableIds: profile.level.breakables
    .filter((item) => !item.optional)
    .map((item) => item.id),
  finished: true,
})

describe('authored replay goals', () => {
  it('resolves every current gallery without changing its paths or capture reliability', () => {
    for (const chapter of MUSEUM_CAMPAIGN) {
      expect(replayProfilesForLevel(chapter.level)).toHaveLength(
        chapter.id === 'first-light' ? 0 : 3,
      )
      for (const profile of replayProfilesForLevel(chapter.level)) {
        const resolved = resolveReplayProfile(chapter.level, profile)
        expect(resolved.level.platforms).toBe(chapter.level.platforms)
        expect(resolved.level.spawn).toBe(chapter.level.spawn)
        expect(resolved.level.breakables.map((item) => item.id)).toEqual(
          chapter.level.breakables.map((item) => item.id),
        )
        for (const [index, exhibit] of resolved.level.breakables.entries()) {
          const original = chapter.level.breakables[index]!
          if (exhibit.optional) expect(exhibit).toBe(original)
          const nextSteps =
            exhibit.challenge.kind === 'ordered-pair'
              ? exhibit.challenge.steps
              : [exhibit.challenge.step]
          const oldSteps =
            original.challenge.kind === 'ordered-pair'
              ? original.challenge.steps
              : [original.challenge.step]
          nextSteps.forEach((step, stepIndex) => {
            const previous = oldSteps[stepIndex]!
            expect(step.target).toBe(previous.target)
            expect(step.hold.confidenceFloor).toBe(
              previous.hold.confidenceFloor,
            )
            expect(step.hold.maximumSampleAgeMs).toBe(
              previous.hold.maximumSampleAgeMs,
            )
            expect(step.hold.maximumSampleGapSeconds).toBe(
              previous.hold.maximumSampleGapSeconds,
            )
          })
        }
      }
    }
  })

  it('rejects missing, unknown and impossible authored goals', () => {
    expect(() =>
      resolveReplayProfile(level, { ...easy.profile, encounters: {} }),
    ).toThrow('missing required')
    expect(() =>
      resolveReplayProfile(level, {
        ...easy.profile,
        encounters: { ...easy.profile.encounters, missing: {} },
      }),
    ).toThrow('unknown')
    expect(() =>
      resolveReplayProfile(level, {
        ...easy.profile,
        encounters: {
          ...easy.profile.encounters,
          'portrait-finale': { holdSeconds: Infinity },
        },
      }),
    ).toThrow('finite')
    expect(() =>
      resolveReplayProfile(level, {
        ...easy.profile,
        encounters: {
          ...easy.profile.encounters,
          'portrait-finale': { waveCycles: 3 },
        },
      }),
    ).toThrow('Wave goals')
  })
})

describe('isolated replay attempts', () => {
  it('locks harder tiers until a full first clear and never borrows easy breaks', () => {
    expect(canEnterReplay(blank(), hard)).toBe(false)
    expect(() => beginReplayAttempt(blank(), hard, false)).toThrow(
      'first visit',
    )
    let state = beginReplayAttempt(blank(), easy, false)
    state = saveReplayAttempt(state, easy, complete(), 100)
    expect(highestReplayTier(state)).toBe(1)
    state = beginReplayAttempt(state, hard, false)
    const hardAttempt = state.attempts.find(
      (item) => item.identity.profileId === hard.profile.id,
    )!
    expect(hardAttempt.progress.completedBreakableIds).toEqual([])
    expect(hardAttempt.progress.finished).toBe(false)
    expect(highestReplayTier(state)).toBe(1)
    const reloaded = readReplayProgress(
      level,
      profiles,
      JSON.parse(JSON.stringify(state)),
    )
    expect(reloaded).toEqual(state)
  })

  it('requires every main encounter and the exit, but not optional discoveries', () => {
    let state = beginReplayAttempt(blank(), easy, false)
    const exitWithoutExhibits = { ...complete(), completedBreakableIds: [] }
    state = saveReplayAttempt(state, easy, exitWithoutExhibits, 100)
    expect(state.clears).toEqual([])
    state = saveReplayAttempt(
      state,
      easy,
      { ...complete(), finished: false },
      200,
    )
    expect(state.clears).toEqual([])
    state = saveReplayAttempt(state, easy, complete(), 300)
    state = saveReplayAttempt(state, easy, complete(), 400)
    expect(state.clears).toHaveLength(1)
    expect(state.clears[0]!.completedAt).toBe(300)
  })

  it('keeps different partial checkpoints separate and preserves collections when restarting', () => {
    let state = beginReplayAttempt(blank(), easy, false)
    state = saveReplayAttempt(state, easy, complete(), 100)
    state = beginReplayAttempt(state, hard, false)
    const first = hard.level.breakables.find(
      (item) => !item.optional && (item.requiresCompleted?.length ?? 0) === 0,
    )!.id
    const optional = hard.level.breakables.find(
      (item) =>
        item.optional === true &&
        item.requiresCompleted?.every((id) => id === first) === true,
    )!.id
    const partial = {
      ...readProgress(hard.level, undefined),
      completedBreakableIds: [first, optional],
      rewards: { ...state.collection, discoveredEncounterIds: [optional] },
    }
    state = saveReplayAttempt(state, hard, partial, 200)
    state = beginReplayAttempt(state, easy, true)
    expect(
      state.attempts.find(
        (item) => item.identity.profileId === hard.profile.id,
      )!.progress.completedBreakableIds,
    ).toContain(first)
    expect(
      state.attempts.find(
        (item) => item.identity.profileId === easy.profile.id,
      )!.progress.completedBreakableIds,
    ).toEqual([])
    expect(state.collection.discoveredEncounterIds).toContain(optional)
    expect(state.clears).toHaveLength(1)
  })

  it('preserves historical accuracy without inventing difficulty stars', () => {
    const portrait = level.rewards!.portrait!
    const legacy = complete()
    legacy.rewards = {
      version: 1,
      discoveredEncounterIds: [],
      collectedCoinIds: [],
      collectedPortraitIds: [portrait.portraitId],
      qualityResults: [
        {
          encounterId: portrait.awardAfterEncounterId,
          grade: 3,
          challengeRevision: 1,
          policyRevision: 1,
          contentRevision: 3,
          evidenceVersion: 'pitch-accuracy-v1',
          reliableSeconds: 1.2,
          meanAbsoluteCents: 10,
        },
      ],
    }
    const state = readReplayProgress(level, profiles, undefined, legacy)
    expect(state.legacyCompleted).toBe(true)
    expect(canEnterReplay(state, hard)).toBe(true)
    expect(highestReplayTier(state)).toBe(0)
    expect(state.collection.qualityResults[0]!.grade).toBe(3)
    expect(state.collection.collectedPortraitIds).toEqual([portrait.portraitId])
  })

  it('invalidates incompatible attempt parameters even when an author forgets to bump revision', () => {
    let state = beginReplayAttempt(blank(), easy, false)
    state = saveReplayAttempt(state, easy, complete(), 100)
    const changed = resolveReplayProfile(level, {
      ...easy.profile,
      encounters: {
        ...easy.profile.encounters,
        'portrait-finale': { holdSeconds: 4 },
      },
    })
    const loaded = readReplayProgress(level, [changed], state)
    expect(loaded.attempts).toEqual([])
    expect(loaded.clears).toEqual([])
    expect(loaded.historicalClears).toEqual(state.clears)
    expect(highestReplayTier(loaded)).toBe(0)
  })

  it('does not accept forged tier values, partial clear evidence or cross-level saves', () => {
    let state = beginReplayAttempt(blank(), easy, false)
    state = saveReplayAttempt(state, easy, complete(), 100)
    expect(
      readReplayProgress(level, profiles, {
        ...state,
        clears: [{ ...state.clears[0], tier: 3 }],
      }).clears,
    ).toEqual([])
    expect(
      readReplayProgress(level, profiles, {
        ...state,
        clears: [{ ...state.clears[0], requiredEncounterIds: [] }],
      }).clears,
    ).toEqual([])
    expect(() =>
      saveReplayAttempt(state, easy, { ...complete(), levelId: 'other' }, 300),
    ).toThrow('belong')
  })
})
