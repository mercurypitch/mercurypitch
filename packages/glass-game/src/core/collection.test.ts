// Collection evidence — old gallery ownership survives, but coins and difficulty cannot be invented.
import { describe, expect, it } from 'vitest'
import { MUSEUM_CAMPAIGN } from '../content/campaign'
import { replayProfilesForLevel } from '../content/replay-profiles'
import { collectionBadges, collectionEntry } from './collection'
import { readProgress } from './progress'
import { resolveReplayProfile } from './replay-profile'
import { beginReplayAttempt, readReplayProgress, saveReplayAttempt, } from './replay-progress'
import { applyEncounterRewards, emptyRewardProgress } from './rewards'

const galleries = MUSEUM_CAMPAIGN.filter(
  (item) => item.level.rewards?.portrait !== undefined,
)

describe('current museum collection', () => {
  it('has three distinct original portraits and recovers old v2 completions without inventing rewards', () => {
    expect(galleries).toHaveLength(3)
    expect(
      new Set(
        galleries.map((item) => item.level.rewards!.portrait!.imageAssetId),
      ).size,
    ).toBe(3)
    const entries = galleries.map(({ level }) => {
      const profiles = replayProfilesForLevel(level).map((item) =>
        resolveReplayProfile(level, item),
      )
      const old = {
        ...readProgress(level, null),
        completedBreakableIds: level.breakables
          .filter((item) => !item.optional)
          .map((item) => item.id),
        finished: true,
      }
      delete old.rewards
      const saved = readReplayProgress(level, profiles, null, old)
      const entry = collectionEntry(level, saved)!
      expect(entry.summary.portrait?.collected).toBe(true)
      expect(entry.summary.coinsFound).toBe(0)
      expect(entry.summary.qualityResults).toEqual([])
      expect(entry.stars).toBe(0)
      return entry
    })
    expect(
      collectionBadges(entries)
        .filter((item) => item.earned)
        .map((item) => item.id),
    ).toEqual(['first-museum-portrait', 'museum-first-three-portraits'])
  })

  it('keeps finite discoveries and ownership across fresh visits without farming or cross-level leakage', () => {
    const level = galleries[1]!.level
    const profiles = replayProfilesForLevel(level).map((item) =>
      resolveReplayProfile(level, item),
    )
    const profile = profiles[0]!
    let state = beginReplayAttempt(
      readReplayProgress(level, profiles, null),
      profile,
      true,
    )
    let rewards = emptyRewardProgress()
    for (const encounter of level.breakables) {
      rewards = applyEncounterRewards(level, rewards, encounter.id)
      rewards = applyEncounterRewards(level, rewards, encounter.id)
    }
    state = saveReplayAttempt(
      state,
      profile,
      {
        ...readProgress(level, null),
        rewards,
        completedBreakableIds: level.breakables.map((item) => item.id),
        finished: true,
      },
      100,
    )
    const earned = collectionEntry(level, state)!
    expect(earned.summary.coinsFound).toBe(3)
    expect(earned.summary.discoveriesFound).toBe(3)
    expect(earned.summary.portrait?.collected).toBe(true)
    expect(earned.stars).toBe(1)
    state = beginReplayAttempt(state, profile, true)
    expect(collectionEntry(level, state)).toEqual(earned)
    expect(state.attempts[0]?.progress.completedBreakableIds).toEqual([])
    expect(collectionEntry(galleries[2]!.level, state)).toBeUndefined()
    const other = readReplayProgress(
      galleries[2]!.level,
      [],
      state,
      state.attempts[0]?.progress,
    )
    expect(
      collectionEntry(galleries[2]!.level, other)?.summary.portrait?.collected,
    ).toBe(false)
    expect(
      collectionBadges([earned])
        .filter((item) => item.earned)
        .map((item) => item.id),
    ).toEqual(['first-museum-portrait', 'museum-curious-listener'])
  })

  it('does not mistake old portrait accuracy or duplicate portrait entries for new badges', () => {
    const level = galleries[0]!.level
    const progress = readReplayProgress(level, [], null)
    const entry = collectionEntry(level, progress)!
    entry.summary.portrait!.collected = true
    expect(
      collectionBadges([entry, entry, entry]).find(
        (item) => item.id === 'museum-first-three-portraits',
      )?.earned,
    ).toBe(false)
    expect(
      collectionBadges([entry]).find(
        (item) => item.id === 'museum-three-star-voice',
      )?.earned,
    ).toBe(false)
    expect(collectionBadges([]).every((item) => !item.earned)).toBe(true)
  })
})
