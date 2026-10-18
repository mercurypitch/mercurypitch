// Runner collectible presentation — one accepted C01 skin keeps authored reward identities intact.

import type { CompiledRunnerCourse } from './contracts'

export const RUNNER_COLLECTIBLE_ARTWORK = {
  assetId: 'runner-sun-seal-ring-v1',
  courseId: 'the-singing-current-trial-crystal-continuous-v1',
  pickupId: 'crystal-continuous-study-pearl-left-60',
} as const

export function runnerCollectibleArtworkPickup(
  course: Pick<CompiledRunnerCourse, 'id' | 'rewards'>,
) {
  return course.id === RUNNER_COLLECTIBLE_ARTWORK.courseId
    ? course.rewards.pickups.find(
        (pickup) => pickup.id === RUNNER_COLLECTIBLE_ARTWORK.pickupId,
      )
    : undefined
}
