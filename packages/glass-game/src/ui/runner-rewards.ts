// Runner reward presentation separates collected route pickups from the lasting finale portrait.
import { galleryArtwork } from '../content/gallery-artworks'
import type { CompiledRunnerCourse } from '../runner/contracts'

export function runnerRewardSummary(
  course: CompiledRunnerCourse,
  collectedRewardIds: readonly string[],
) {
  const collected = new Set(collectedRewardIds)
  const portraitId = 'portrait-first-song-run'
  return {
    collectedPickups: course.rewards.pickups.filter((pickup) =>
      collected.has(pickup.id),
    ).length,
    availablePickups: course.rewards.pickups.length,
    portrait:
      course.rewards.finishRewardIds.includes(portraitId) &&
      collected.has(portraitId)
        ? galleryArtwork('portrait-painting-v5')
        : null,
  }
}
