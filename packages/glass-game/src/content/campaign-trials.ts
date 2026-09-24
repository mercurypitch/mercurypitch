// Island trials — optional routes kept outside the museum's main chapter order.
import type { GalleryChapter } from './campaign'
import { CLOUDWAY_CURRENT_TRIAL } from './cloudway-layouts'
import type { MuseumJourneyDefinition } from './museum-journey'

export interface IslandTrial {
  id: string
  islandId: string
  islandTitle: string
  chapter: GalleryChapter
}

export const MUSEUM_TRIALS: readonly IslandTrial[] = [
  {
    id: 'first-island-cloudway',
    islandId: 'first-light-landmass',
    islandTitle: 'First Light Island',
    chapter: {
      id: 'cloudway-glass-ribbon',
      chapter: 'Cloudway Trial',
      lesson: 'A little leap of faith',
      description:
        'Skim the frost, ride an opaline raft and cross the crackling ribbon. Rest and sing on the marble landings.',
      imageAsset: 'cloudway-ribbon-preview',
      level: CLOUDWAY_CURRENT_TRIAL,
    },
  },
]

export function islandChapterIds(
  definition: MuseumJourneyDefinition,
  islandId: string,
): readonly string[] {
  return [
    ...new Set(
      definition.stages
        .filter((stage) => stage.islandId === islandId)
        .flatMap((stage) => stage.chapterIds),
    ),
  ]
}
