// Collectible identity tests — presentation selects one stable pickup without editing course progress.
import { expect, it } from 'vitest'
import { runnerCollectibleArtworkPickup } from './collectible-presentation'
import { SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY, SINGING_CURRENT_CRYSTAL_STUDY, } from './crystal-obstacle-study'
import { SINGING_CURRENT, SINGING_CURRENT_CONTINUOUS_TRIAL, } from './first-course'

it('selects the accepted first Crystal continuous pickup by stable identity, not array position', () => {
  const course = SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY
  const before = JSON.stringify(course)
  expect(runnerCollectibleArtworkPickup(course)).toBe(course.rewards.pickups[0])
  expect(
    runnerCollectibleArtworkPickup({
      ...course,
      rewards: {
        ...course.rewards,
        pickups: [...course.rewards.pickups].reverse(),
      },
    }),
  ).toBe(course.rewards.pickups[0])
  expect(JSON.stringify(course)).toBe(before)
  expect(
    runnerCollectibleArtworkPickup({
      ...course,
      rewards: { ...course.rewards, pickups: course.rewards.pickups.slice(1) },
    }),
  ).toBeUndefined()
  for (const other of [
    SINGING_CURRENT,
    SINGING_CURRENT_CONTINUOUS_TRIAL,
    SINGING_CURRENT_CRYSTAL_STUDY,
  ])
    expect(runnerCollectibleArtworkPickup(other)).toBeUndefined()
})
