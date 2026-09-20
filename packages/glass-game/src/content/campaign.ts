// Museum campaign — ordered, independently saved galleries shared by every host.
import type { LevelDefinition } from '../contracts'
import { GLASS_ENCLOSED_CHAMBER } from './enclosed-chamber'
import { GLASSWORKS_JOURNEY } from './glassworks-journey'
import { RESONANCE_CONSERVATORY } from './resonance-conservatory'
import { TWIN_GALLERIES } from './twin-galleries'

export interface GalleryChapter {
  id: string
  chapter: string
  lesson: string
  description: string
  imageAsset: string
  level: LevelDefinition
}

export const MUSEUM_CAMPAIGN: readonly GalleryChapter[] = [
  {
    id: 'first-light',
    chapter: 'Prologue',
    lesson: 'Find your note',
    description:
      'A little light, a little movement, and your first beautiful break.',
    imageAsset: 'painting-garden-v5',
    level: GLASS_ENCLOSED_CHAMBER,
  },
  {
    id: 'glassworks',
    chapter: 'Gallery 01',
    lesson: 'Let it resonate',
    description:
      'Wander through the garden, archive and portrait salon with one steady note.',
    imageAsset: 'painting-archive-v5',
    level: GLASSWORKS_JOURNEY,
  },
  {
    id: 'twin-galleries',
    chapter: 'Gallery 02',
    lesson: 'Lower, higher, together',
    description:
      'Two colours of light, two comfortable notes, and a little conversation between them.',
    imageAsset: 'painting-interval-v6',
    level: TWIN_GALLERIES,
  },
  {
    id: 'resonance-conservatory',
    chapter: 'Gallery 03',
    lesson: 'Stillness into gentle waves',
    description:
      'Find your familiar note, then let it sway through the fern house, listening court and orchid gallery.',
    imageAsset: 'painting-listening-garden-v7',
    level: RESONANCE_CONSERVATORY,
  },
]
