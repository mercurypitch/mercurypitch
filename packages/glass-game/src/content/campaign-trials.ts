// Island trials — optional routes kept outside the museum's main chapter order.
import type { GalleryChapter } from './campaign'
import { CLOUDWAY_CRYSTAL_PROMENADE_MECHANICS_PREVIEW } from './cloudway-laboratory'
import { CLOUDWAY_CURRENT_TRIAL } from './cloudway-layouts'
import { CLOUDWAY_THAWING_SONG } from './cloudway-thawing-song'
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
  {
    id: 'twin-island-promenade',
    islandId: 'twin-galleries-landmass',
    islandTitle: 'Twin Galleries Island',
    chapter: {
      id: 'crystal-promenade-trial',
      chapter: 'Crystal Promenade',
      lesson: 'Listen, leap, discover',
      description:
        'Follow the branching promenade through scroll bridges, quick crystals and singing ice gates.',
      imageAsset: 'painting-interval-v6',
      level: CLOUDWAY_CRYSTAL_PROMENADE_MECHANICS_PREVIEW,
    },
  },
  {
    id: 'conservatory-thawing-song',
    islandId: 'resonance-conservatory-landmass',
    islandTitle: 'Conservatory Island',
    chapter: {
      id: 'thawing-song-trial',
      chapter: 'The Thawing Song',
      lesson: 'A melody opens the way',
      description:
        'Gather a five-note melody, melt the ice and sing the complete phrase at the portrait pavilion.',
      imageAsset: 'painting-listening-garden-v7',
      level: CLOUDWAY_THAWING_SONG,
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
