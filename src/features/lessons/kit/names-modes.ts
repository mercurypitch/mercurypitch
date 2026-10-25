// ============================================================
// Names modes — what a names switch offers, and the sung names it shows
// ============================================================
//
// The modes and syllables behind every lesson's names switch, in one place
// (Lesson 10's spec needs 5): Lesson 4 offers Letters, Numbers and
// Do-re-mi; Lessons 6, 10 and 12 drop the degree numbers. The store and
// the toggle are already generic (`createModeStore` and `bindModeToggle`,
// kit/names.ts); this is only what they hold. The minor syllables are
// do-based (MASTER-PLAN, decision 12): do stays home, and a minor third is
// one changed syllable, mi to me. Ear Lab sings minor the same way
// (`src/lib/ear/wild.ts`), though it writes "Sol" where the lessons write
// "so".

/** Lesson 4's names switch: the letters, the scale's degree numbers, or do-re-mi. */
export type NamesMode = 'letters' | 'numbers' | 'solfege'

export const NAMES_MODES: readonly NamesMode[] = [
  'letters',
  'numbers',
  'solfege',
]

/** The names switch with no degree numbers: Lessons 6, 10 and 12. */
export type LettersSolfegeMode = Exclude<NamesMode, 'numbers'>

export const LETTERS_SOLFEGE_MODES: readonly LettersSolfegeMode[] = [
  'letters',
  'solfege',
]

/** The major scale's sung names, do to do (Lesson 4's FACTS 19 and 20: so, as the CURRICULUM card writes it). */
export const MAJOR_SOLFEGE: readonly string[] = [
  'do',
  're',
  'mi',
  'fa',
  'so',
  'la',
  'ti',
  'do',
]

/** The natural minor scale's, do to do: mi, la and ti each a semitone lower, me, le and te. */
export const MINOR_SOLFEGE: readonly string[] = [
  'do',
  're',
  'me',
  'fa',
  'so',
  'le',
  'te',
  'do',
]
