// Coda Echo authoring — original short words and melody choices for existing gallery portraits.
import type { GlassMelodyId } from './melodies'

export interface GalleryEncore {
  id: string
  revision: number
  title: string
  words: string
  melodyId: GlassMelodyId
  portraitAssetId: string
  sealTitle: string
}

export const GALLERY_ENCORES: Readonly<
  Record<string, GalleryEncore | undefined>
> = {
  'glassworks-journey': {
    id: 'first-light-echo',
    revision: 1,
    title: 'A little light',
    words: 'Let it shine',
    melodyId: 'first-arc',
    portraitAssetId: 'painting-portrait-v5',
    sealTitle: 'First light echo',
  },
  'glassworks-twin-galleries': {
    id: 'two-lights-echo',
    revision: 1,
    title: 'Two little lights',
    words: 'Tiny sparks can glow',
    melodyId: 'sunlit-steps',
    portraitAssetId: 'painting-interval-v6',
    sealTitle: 'Two lights echo',
  },
  'glassworks-resonance-conservatory': {
    id: 'garden-light-echo',
    revision: 1,
    title: 'The garden answers',
    words: 'Let it shine',
    melodyId: 'first-arc',
    portraitAssetId: 'painting-wave-keeper-v7',
    sealTitle: 'Garden echo',
  },
}
