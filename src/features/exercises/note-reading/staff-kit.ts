// ============================================================
// The drills' one door to the lessons' staff
// ============================================================
//
// Read the Note and Sing It in Time read the staff as Lesson 15 teaches it,
// so they borrow the lessons' own arithmetic and outlines rather than
// keeping a second copy: where a note sits and what a reader calls the
// place, and the syllable a note takes in its key (kit/staff-places.ts),
// how a note is spelled (kit/notes.ts), where a key signature's signs sit
// and what a reader calls them (kit/staff-key.ts), and the clefs, the
// notehead and the sharp and flat (kit/glyphs.ts, kit/staff-glyphs.ts).
// Every one of those is pure: no page, no sound.
//
// They come through this one file so that the drills' debt to another
// feature is written in one place, and moving the kit's staff below the
// features one day is a change to this file alone.

export { G_CLEF_PATH } from '@/features/lessons/kit/glyphs'
export type { Letter, Spelled } from '@/features/lessons/kit/notes'
export {
  F_CLEF_PATH,
  FLAT_PATH,
  NOTEHEAD_PATH,
  NOTO_GLYPHS,
  SHARP_PATH,
} from '@/features/lessons/kit/staff-glyphs'
export type { KeySig } from '@/features/lessons/kit/staff-key'
export { keyAlter, keyPlaces, keyWords } from '@/features/lessons/kit/staff-key'
export type { Clef } from '@/features/lessons/kit/staff-places'
export {
  diatonicOf,
  isLine,
  ledgersOf,
  midiOf,
  noteAt,
  placeOf,
  placeWords,
  spelledAt,
  syllableOf,
} from '@/features/lessons/kit/staff-places'
