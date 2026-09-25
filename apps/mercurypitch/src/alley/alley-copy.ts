// ============================================================
// Every word the alley says, in one place
// ============================================================
//
// The owner's copy (S4 decision 6, 23 Sep 2026), kept apart from the markup
// so a line can be swapped without reading a component. The room NAMES are
// not here: they come from `src/features/rooms/room-names.ts`, the single
// place the header chip, the session pill and now the doors all read, so the
// three cannot disagree.
//
// Two rules the native copy tripwire (`scripts/probe-bundle.mjs`) enforces on
// everything below: "practice" is spelled with a c, and nothing here tells a
// singer what does NOT happen to their voice.

import type { DoorKey } from './alley-plate'

export const ALLEY_COPY = {
  /** First run only: the welcome's headline and its one supporting line. */
  headline: 'Pick a room. Make a sound.',
  subline: 'Six places to practice, all on your phone.',
  /** A return visit: the compact title in the headline's place. */
  returnTitle: 'Rooms',
  /** The mark's accessible name. */
  brand: 'MercuryPitch',
  /** The group the six doors are, for a screen reader. */
  doorsLabel: 'Rooms',
  /** The eyebrow a locked door wears when it is selected. */
  comingSoon: 'Coming soon',
  /** The capsule under an enterable door. */
  enter: 'Enter',
} as const

/** What each door is FOR — the activity, as the rail and the tabs say it. */
export const DOOR_ROOM_LABEL: Record<DoorKey, string> = {
  ear: 'Ear Lab',
  piano: 'Piano',
  drums: 'Drums',
  karaoke: 'Karaoke',
  sing: 'Sing',
  guitar: 'Guitar',
}

/** The one line under a door's name. */
export const DOOR_LINE: Record<DoorKey, string> = {
  sing: 'A live stage for your voice.',
  ear: 'Cents and milliseconds, never a percent.',
  piano: 'Falling notes. MIDI ready.',
  drums: 'Four kits. No kit needed.',
  guitar: 'Tuner, fretboard and tab.',
  karaoke: 'Sing your favorite songs.',
}

/**
 * The door's accessible name — the lab's string: "Sing, Retro Analog Studio.
 * A live stage for your voice." and, for a room that is not open yet,
 * "Piano, Nocturne Studio. Coming soon. Falling notes. MIDI ready."
 */
export function doorLabel(
  key: DoorKey,
  name: string,
  enterable: boolean,
): string {
  const soon = enterable ? '' : ` ${ALLEY_COPY.comingSoon}.`
  return `${DOOR_ROOM_LABEL[key]}, ${name}.${soon} ${DOOR_LINE[key]}`
}

/** The card's title line: "Sing · Retro Analog Studio". */
export function doorTitle(key: DoorKey, name: string): string {
  return `${DOOR_ROOM_LABEL[key]} · ${name}`
}
