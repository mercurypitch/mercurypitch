// ============================================================
// Voice Mirror — "Sing the Universe" target melodies (spec v2).
//
// Short melodies sonified from real astronomical data, scored by
// the same octave-folded match engine as Task C. Each melody is
// stored as semitone offsets from a root; the root is chosen at
// runtime so the melody sits inside the singer's detected range.
// Pure data + math — no DOM, no audio.
// ============================================================

export interface CosmicNote {
  /** Semitone offset from the melody root. */
  offset: number
  /** Relative duration (1 = one beat). */
  beats: number
}

export interface CosmicMelody {
  id: string
  name: string
  /** One-line "what you are singing". */
  blurb: string
  /** Where the data comes from. */
  source: string
  /** Pins the root to a pitch class 0–11 (e.g. 10 = A#/B♭) when the note
   *  itself is the point, as with the Perseus B♭. */
  rootPitchClass?: number
  notes: CosmicNote[]
}

export const COSMIC_MELODIES: CosmicMelody[] = [
  {
    id: 'orion',
    name: 'Orion Rising',
    blurb:
      "Orion's belt and shoulders, sung by declination — one semitone per degree of sky.",
    source: 'Star positions: ESA Gaia / Hipparcos',
    // Declination (degrees): Mintaka −0.30, Alnilam −1.20, Alnitak −1.94,
    // Bellatrix +6.35, Betelgeuse +7.41 → rounded to semitone offsets.
    notes: [
      { offset: 0, beats: 1 }, // Mintaka
      { offset: -1, beats: 1 }, // Alnilam
      { offset: -2, beats: 1 }, // Alnitak
      { offset: 6, beats: 1 }, // Bellatrix
      { offset: 7, beats: 2 }, // Betelgeuse
    ],
  },
  {
    id: 'pulsar-clock',
    name: 'Pulsar Clock',
    blurb:
      'Five famous pulsars — each spin frequency octave-shifted into your voice.',
    source: 'Spin rates: ATNF pulsar catalogue',
    // Spin frequency (Hz), octave-folded to one register, nearest semitone,
    // written relative to the Crab pulsar:
    //   Crab 29.6 Hz → A# · Vela 11.19 Hz → F (−5) · PSR B1919+21
    //   0.748 Hz → G (−3) · PSR B1937+21 641.9 Hz → E (−6) ·
    //   Geminga 4.22 Hz → C# (−9).
    notes: [
      { offset: 0, beats: 1 }, // Crab
      { offset: -5, beats: 1 }, // Vela
      { offset: -3, beats: 1 }, // PSR B1919+21 (the first pulsar found)
      { offset: -6, beats: 1 }, // PSR B1937+21 (millisecond pulsar)
      { offset: -9, beats: 2 }, // Geminga
    ],
  },
  {
    id: 'perseus',
    name: 'The Perseus Note',
    blurb:
      'The deepest note observed in the universe: the Perseus cluster black hole hums a B♭ — hold it, 57 octaves up.',
    source: 'NASA Chandra X-ray Observatory (2003)',
    rootPitchClass: 10, // it has to be a B♭
    notes: [{ offset: 0, beats: 4 }],
  },
]

/**
 * Choose concrete MIDI notes for a melody inside the singer's range: the
 * root centers the melody on the range center (snapped to rootPitchClass
 * when pinned), and any note that still falls outside is octave-folded in,
 * then clamped for ranges narrower than an octave. Match scoring is
 * octave-folded anyway (§4.2) — this fitting is about playing reference
 * tones the singer can comfortably imitate.
 */
export function fitMelodyToRange(
  melody: CosmicMelody,
  lowMidi: number,
  highMidi: number,
): number[] {
  const center = (lowMidi + highMidi) / 2
  const meanOffset =
    melody.notes.reduce((sum, n) => sum + n.offset, 0) / melody.notes.length
  let root = Math.round(center - meanOffset)

  if (melody.rootPitchClass !== undefined) {
    const currentClass = ((root % 12) + 12) % 12
    const up = (melody.rootPitchClass - currentClass + 12) % 12
    root += up <= 6 ? up : up - 12
  }

  return melody.notes.map((note) => {
    let midi = root + note.offset
    while (midi > highMidi) midi -= 12
    while (midi < lowMidi) midi += 12
    return Math.min(highMidi, Math.max(lowMidi, midi))
  })
}
