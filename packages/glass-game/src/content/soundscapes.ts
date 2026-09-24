// Museum soundscape regions — presentation-only music and ambience selection.
import type { Bounds3, LevelDefinition, Vec3 } from '../contracts'
import type { MuseumAudioScene } from '../host'

const AUTHORED_REGION_HYSTERESIS = 0.3

function contains(bounds: Bounds3, position: Vec3, margin = 0): boolean {
  return (
    position.x >= bounds.minX - margin &&
    position.x <= bounds.maxX + margin &&
    position.y >= bounds.minY - margin &&
    position.y <= bounds.maxY + margin &&
    position.z >= bounds.minZ - margin &&
    position.z <= bounds.maxZ + margin
  )
}

export function museumSoundscape(
  level: LevelDefinition,
  position: Vec3,
  previous: MuseumAudioScene = 'museum',
): MuseumAudioScene {
  if (level.presentation !== undefined) {
    const regions = level.presentation.audioRegions
    if (
      regions.some(
        (region) =>
          region.sceneId === previous &&
          contains(region.bounds, position, AUTHORED_REGION_HYSTERESIS),
      )
    )
      return previous
    return (
      regions.find((region) => contains(region.bounds, position))?.sceneId ??
      'museum'
    )
  }
  if (level.id !== 'glassworks') return 'museum'
  // A small overlap prevents repeated crossfades along a region boundary.
  if (position.x > (previous === 'garden' ? 7.6 : 8.1)) return 'garden'
  const margin = previous === 'gallery' ? 0.25 : 0
  if (
    position.x >= 3.7 - margin &&
    position.x <= 7.3 + margin &&
    position.z <= 3.8 + margin
  )
    return 'gallery'
  return 'museum'
}
