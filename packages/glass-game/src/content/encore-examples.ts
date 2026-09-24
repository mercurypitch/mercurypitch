// Merc encore examples — original D2 performances, distinct from the range-adapted singing guide.
import type { GlassMelodyId } from './melodies'

export interface MercEncoreExample {
  assetId: string
  words: string
  rootMidi: number
  melodyVersion: number
  pace: number
}

export const MERC_ENCORE_EXAMPLES: Readonly<
  Partial<Record<GlassMelodyId, MercEncoreExample>>
> = {
  'first-arc': {
    assetId: 'merc-encore-light-v5',
    words: 'Let light sing',
    rootMidi: 50,
    melodyVersion: 1,
    pace: 1,
  },
  'sunlit-steps': {
    assetId: 'merc-encore-home-v5',
    words: 'Two small lights come home',
    rootMidi: 50,
    melodyVersion: 1,
    pace: 1,
  },
}
