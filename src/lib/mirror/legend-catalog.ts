// ============================================================
// Voice Mirror — canonical legend catalogue and broad voice bands.
// ============================================================
//
// The six bands are familiar discovery categories, not scientific claims
// about an individual legend's exact range. Legends are deliberately placed
// only in a broad band: the constellation UI must not imply precise
// per-celebrity coordinates that MercuryPitch has not measured.

/** The broad voice categories used to organise the legend constellation. */
export type VoiceTypeBandId =
  | 'Bass'
  | 'Baritone'
  | 'Tenor'
  | 'Alto'
  | 'Mezzo-soprano'
  | 'Soprano'

/** One approximate classical voice band used for category-level positioning. */
export interface VoiceTypeBand {
  readonly id: VoiceTypeBandId
  readonly label: string
  readonly lowMidi: number
  readonly highMidi: number
  readonly rangeLabel: string
}

/** A legend that can be revealed by a persisted Voice Mirror match. */
export interface VoiceLegend {
  readonly id: string
  readonly name: string
  readonly band: VoiceTypeBandId
  readonly imageSrc: string
}

/**
 * Ordered low to high for a stable map layout. These ranges mirror the broad
 * classification bands used by Voice Mirror; they are intentionally
 * approximate and overlap.
 */
export const VOICE_TYPE_BANDS = [
  {
    id: 'Bass',
    label: 'Bass',
    lowMidi: 40,
    highMidi: 64,
    rangeLabel: 'E2–E4',
  },
  {
    id: 'Baritone',
    label: 'Baritone',
    lowMidi: 43,
    highMidi: 67,
    rangeLabel: 'G2–G4',
  },
  {
    id: 'Tenor',
    label: 'Tenor',
    lowMidi: 48,
    highMidi: 72,
    rangeLabel: 'C3–C5',
  },
  {
    id: 'Alto',
    label: 'Alto',
    lowMidi: 53,
    highMidi: 77,
    rangeLabel: 'F3–F5',
  },
  {
    id: 'Mezzo-soprano',
    label: 'Mezzo-soprano',
    lowMidi: 57,
    highMidi: 81,
    rangeLabel: 'A3–A5',
  },
  {
    id: 'Soprano',
    label: 'Soprano',
    lowMidi: 60,
    highMidi: 84,
    rangeLabel: 'C4–C6',
  },
] as const satisfies readonly VoiceTypeBand[]

/** The complete Voice Mirror legend roster, grouped in map display order. */
export const VOICE_LEGENDS = [
  {
    id: 'johnny-cash',
    name: 'Johnny Cash',
    band: 'Bass',
    imageSrc: '/legends/johnny-cash.webp',
  },
  {
    id: 'barry-white',
    name: 'Barry White',
    band: 'Bass',
    imageSrc: '/legends/barry-white.webp',
  },
  {
    id: 'louis-armstrong',
    name: 'Louis Armstrong',
    band: 'Bass',
    imageSrc: '/legends/louis-armstrong.webp',
  },
  {
    id: 'elvis-presley',
    name: 'Elvis Presley',
    band: 'Baritone',
    imageSrc: '/legends/elvis.webp',
  },
  {
    id: 'frank-sinatra',
    name: 'Frank Sinatra',
    band: 'Baritone',
    imageSrc: '/legends/sinatra.webp',
  },
  {
    id: 'kurt-cobain',
    name: 'Kurt Cobain',
    band: 'Baritone',
    imageSrc: '/legends/kurt-cobain.webp',
  },
  {
    id: 'david-bowie',
    name: 'David Bowie',
    band: 'Baritone',
    imageSrc: '/legends/david-bowie.webp',
  },
  {
    id: 'freddie-mercury',
    name: 'Freddie Mercury',
    band: 'Tenor',
    imageSrc: '/legends/freddie.webp',
  },
  {
    id: 'bruce-dickinson',
    name: 'Bruce Dickinson',
    band: 'Tenor',
    imageSrc: '/legends/bruce-dickinson.webp',
  },
  {
    id: 'michael-jackson',
    name: 'Michael Jackson',
    band: 'Tenor',
    imageSrc: '/legends/michael-jackson.webp',
  },
  {
    id: 'prince',
    name: 'Prince',
    band: 'Tenor',
    imageSrc: '/legends/prince.webp',
  },
  {
    id: 'luciano-pavarotti',
    name: 'Luciano Pavarotti',
    band: 'Tenor',
    imageSrc: '/legends/pavarotti.webp',
  },
  {
    id: 'amy-winehouse',
    name: 'Amy Winehouse',
    band: 'Alto',
    imageSrc: '/legends/amy-winehouse.webp',
  },
  {
    id: 'cher',
    name: 'Cher',
    band: 'Alto',
    imageSrc: '/legends/cher.webp',
  },
  {
    id: 'nina-simone',
    name: 'Nina Simone',
    band: 'Alto',
    imageSrc: '/legends/nina-simone.webp',
  },
  {
    id: 'adele',
    name: 'Adele',
    band: 'Mezzo-soprano',
    imageSrc: '/legends/adele.webp',
  },
  {
    id: 'whitney-houston',
    name: 'Whitney Houston',
    band: 'Mezzo-soprano',
    imageSrc: '/legends/whitney-houston.webp',
  },
  {
    id: 'aretha-franklin',
    name: 'Aretha Franklin',
    band: 'Mezzo-soprano',
    imageSrc: '/legends/aretha-franklin.webp',
  },
  {
    id: 'mariah-carey',
    name: 'Mariah Carey',
    band: 'Soprano',
    imageSrc: '/legends/mariah-carey.webp',
  },
  {
    id: 'celine-dion',
    name: 'Celine Dion',
    band: 'Soprano',
    imageSrc: '/legends/celine-dion.webp',
  },
  {
    id: 'ariana-grande',
    name: 'Ariana Grande',
    band: 'Soprano',
    imageSrc: '/legends/ariana-grande.webp',
  },
] as const satisfies readonly VoiceLegend[]
