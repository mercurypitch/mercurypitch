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

/**
 * The voice between Bass and Baritone. A range that shares as many
 * semitones with each and sits as near the middle of each (E2 to G4 is one)
 * is this voice, not whichever of the two the catalogue lists first.
 */
export const BASS_BARITONE = 'Bass-baritone'

/** A voice type the Mirror can name: one band, or the Bass/Baritone tie. */
export type VoiceTypeName = VoiceTypeBandId | typeof BASS_BARITONE

/**
 * The band behind a voice type's name, for what only a band has: the
 * twins' roster, a range preset. A bass-baritone draws on Bass, where the
 * tie went before it had its own name, so every twin stays who it was. Null
 * for a name no band carries.
 */
export function voiceTypeBand(name: string | null): VoiceTypeBandId | null {
  if (name === BASS_BARITONE) return 'Bass'
  return VOICE_TYPE_BANDS.find((band) => band.id === name)?.id ?? null
}

/**
 * The voice type a range overlaps most: the band sharing the most semitones
 * with it, a tie going to the band whose middle is nearest. A range that
 * ties Bass and Baritone on both reads Bass-baritone; any other full tie
 * goes to the band listed first. A hint, never a verdict.
 */
export function voiceTypeHint(
  lowMidi: number,
  highMidi: number,
): VoiceTypeName | null {
  const center = (lowMidi + highMidi) / 2
  let best: VoiceTypeBandId[] = []
  let bestOverlap = 0
  let bestCenterDist = Infinity
  for (const band of VOICE_TYPE_BANDS) {
    const overlap =
      Math.min(highMidi, band.highMidi) - Math.max(lowMidi, band.lowMidi)
    if (overlap <= 0) continue
    const centerDist = Math.abs((band.lowMidi + band.highMidi) / 2 - center)
    if (
      overlap > bestOverlap ||
      (overlap === bestOverlap && centerDist < bestCenterDist)
    ) {
      best = [band.id]
      bestOverlap = overlap
      bestCenterDist = centerDist
    } else if (overlap === bestOverlap && centerDist === bestCenterDist) {
      best.push(band.id)
    }
  }
  if (best.includes('Bass') && best.includes('Baritone')) return BASS_BARITONE
  return best[0] ?? null
}

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
    id: 'paul-robeson',
    name: 'Paul Robeson',
    band: 'Bass',
    imageSrc: '/legends/paul-robeson.webp',
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
    id: 'nusrat-fateh-ali-khan',
    name: 'Nusrat Fateh Ali Khan',
    band: 'Tenor',
    imageSrc: '/legends/nusrat-fateh-ali-khan.webp',
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
    id: 'umm-kulthum',
    name: 'Umm Kulthum',
    band: 'Alto',
    imageSrc: '/legends/umm-kulthum.webp',
  },
  {
    id: 'miriam-makeba',
    name: 'Miriam Makeba',
    band: 'Alto',
    imageSrc: '/legends/miriam-makeba.webp',
  },
  {
    id: 'billie-holiday',
    name: 'Billie Holiday',
    band: 'Alto',
    imageSrc: '/legends/billie-holiday.webp',
  },
  {
    id: 'patti-smith',
    name: 'Patti Smith',
    band: 'Alto',
    imageSrc: '/legends/patti-smith.webp',
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
    id: 'edith-piaf',
    name: 'Édith Piaf',
    band: 'Mezzo-soprano',
    imageSrc: '/legends/edith-piaf.webp',
  },
  {
    id: 'lady-gaga',
    name: 'Lady Gaga',
    band: 'Mezzo-soprano',
    imageSrc: '/legends/lady-gaga.webp',
  },
  {
    id: 'pj-harvey',
    name: 'PJ Harvey',
    band: 'Mezzo-soprano',
    imageSrc: '/legends/pj-harvey.webp',
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
  {
    id: 'dolly-parton',
    name: 'Dolly Parton',
    band: 'Soprano',
    imageSrc: '/legends/dolly-parton.webp',
  },
] as const satisfies readonly VoiceLegend[]
