// ============================================================
// Apply-phrase pool — short public-domain melodies for the daily session
// ============================================================
//
// The daily session ends with an "apply" slot: sing a short, recognisable
// phrase (call-response / sight-singing) instead of an abstract drill. Every
// phrase here is public domain (traditional, or a composer long past life+70),
// expressed as note names in a comfortable middle register — the exercise
// engine handles timing and can transpose into the singer's range.
//
// Grows over time (see the Sing-the-Legend content plan). Data, not code.

export interface ApplyPhrase {
  id: string
  /** Display name shown on the session card. */
  name: string
  /** Melody as note names (e.g. 'C4'); the exercise supplies the rhythm. */
  notes: string[]
}

export const APPLY_PHRASES: ApplyPhrase[] = [
  {
    id: 'ode-to-joy',
    name: 'Ode to Joy',
    notes: ['E4', 'E4', 'F4', 'G4', 'G4', 'F4', 'E4', 'D4'],
  },
  {
    id: 'twinkle',
    name: 'Twinkle, Twinkle',
    notes: ['C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4'],
  },
  {
    id: 'mary-lamb',
    name: 'Mary Had a Little Lamb',
    notes: ['E4', 'D4', 'C4', 'D4', 'E4', 'E4', 'E4'],
  },
  {
    id: 'amazing-grace',
    name: 'Amazing Grace',
    notes: ['G3', 'C4', 'E4', 'C4', 'E4', 'D4', 'C4'],
  },
  {
    id: 'when-the-saints',
    name: 'When the Saints Go Marching In',
    notes: ['C4', 'E4', 'F4', 'G4', 'C4', 'E4', 'F4', 'G4'],
  },
  {
    id: 'frere-jacques',
    name: 'Frère Jacques',
    notes: ['C4', 'D4', 'E4', 'C4', 'C4', 'D4', 'E4', 'C4'],
  },
  {
    id: 'auld-lang-syne',
    name: 'Auld Lang Syne',
    notes: ['C4', 'F4', 'F4', 'F4', 'A4', 'G4', 'F4', 'G4'],
  },
  {
    id: 'oh-susanna',
    name: 'Oh! Susanna',
    notes: ['C4', 'D4', 'E4', 'G4', 'G4', 'A4', 'G4', 'E4'],
  },
  {
    id: 'london-bridge',
    name: 'London Bridge',
    notes: ['G4', 'A4', 'G4', 'F4', 'E4', 'F4', 'G4'],
  },
  {
    id: 'camptown-races',
    name: 'Camptown Races',
    notes: ['G4', 'G4', 'E4', 'G4', 'A4', 'G4', 'E4'],
  },
]

/** Pick a phrase deterministically for a given day index (stable across reloads). */
export function pickApplyPhrase(dayIndex: number): ApplyPhrase {
  const i =
    ((Math.trunc(dayIndex) % APPLY_PHRASES.length) + APPLY_PHRASES.length) %
    APPLY_PHRASES.length
  return APPLY_PHRASES[i]!
}
