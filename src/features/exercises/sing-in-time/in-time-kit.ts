// ============================================================
// Sing It in Time's one door to the lessons' in-time code
// ============================================================
//
// Lesson 18's page already reads a tune sung in time and keeps the beat on
// the audio clock, so the drill borrows its parts rather than keeping a
// second copy of any: the anchor on the singer's first note and the values
// its reader listens with (kit/read-in-time.ts), the beat clock that books
// every click ahead and says when each beat is heard
// (kit/beat-clock-core.ts, the clock without the page's sound or frame loop
// around it), the metronome's swing on the beat (kit/metronome-arm.ts) and
// the engraving's measures for a head, a stem and a beam
// (kit/rhythm-glyphs.ts). The staff's own parts come through Read the
// Note's door (note-reading/staff-kit.ts). Every one of those is pure: no
// page, no sound.
//
// They come through this one file so that the drill's debt to another
// feature is written in one place.

export type {
  Bar,
  ClockEnv,
  Hit,
  OutputStamp,
  Run,
  RunOptions,
  Spot,
} from '@/features/lessons/kit/beat-clock-core'
export { bars, createBeatClock } from '@/features/lessons/kit/beat-clock-core'
export { angleAtBeats } from '@/features/lessons/kit/metronome-arm'
export type {
  InTimeOptions,
  WrittenNote,
} from '@/features/lessons/kit/read-in-time'
export {
  ANCHOR_LATE_BEATS,
  ANCHOR_RUN_SEC,
  anchorOf,
  firstRunAt,
  HEARD_SEC,
  MAX_HOP,
  NEIGHBOURS,
  ON_NOTE_CENTS,
  OWN_ATTACK_SEC,
  OWN_VOICE_SEC,
  WINDOW_BEATS,
} from '@/features/lessons/kit/read-in-time'
export { metrics, stemEnd, stemX } from '@/features/lessons/kit/rhythm-glyphs'
