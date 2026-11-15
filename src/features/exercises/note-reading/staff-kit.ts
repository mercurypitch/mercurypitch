// ============================================================
// Read the Note's one door to the lessons' staff
// ============================================================
//
// The drill reads the staff as Lesson 15 teaches it, so it borrows the
// lessons' own arithmetic and outlines rather than keeping a second copy:
// where a note sits and what a reader calls the place
// (kit/staff-places.ts), how a note is spelled (kit/notes.ts), and the
// clefs and the notehead (kit/glyphs.ts, kit/staff-glyphs.ts). Every one of
// those is pure: no page, no sound.
//
// They come through this one file so that the drill's debt to another
// feature is written in one place, and moving the kit's staff below the
// features one day is a change to this file alone.

export { G_CLEF_PATH } from '@/features/lessons/kit/glyphs'
export type { Letter, Spelled } from '@/features/lessons/kit/notes'
export {
  F_CLEF_PATH,
  NOTEHEAD_PATH,
  NOTO_GLYPHS,
} from '@/features/lessons/kit/staff-glyphs'
export type { Clef } from '@/features/lessons/kit/staff-places'
export {
  ledgersOf,
  midiOf,
  noteAt,
  placeWords,
} from '@/features/lessons/kit/staff-places'
