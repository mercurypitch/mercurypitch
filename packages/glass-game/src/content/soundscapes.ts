// Museum soundscape regions — presentation-only music and ambience selection.
import type { Vec3 } from '../contracts'
import type { MuseumAudioScene } from '../host'

export function museumSoundscape(
  levelId: string,
  position: Vec3,
  previous: MuseumAudioScene = 'museum',
): MuseumAudioScene {
  if (levelId !== 'glassworks') return 'museum'
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
