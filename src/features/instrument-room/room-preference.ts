// ============================================================
// Instrument room door — which room the Piano and Guitar tabs open
// ============================================================
//
// Piano and Guitar each have two rooms now: the standalone Night page and the
// in-app workspace the tab has always opened. Drum Night never had this
// problem — it only ever had the one room — so this is the first time the app
// has had to ask which one somebody meant.
//
// It asks once, on the first press of the tab, and then remembers. The answer
// is a preference, not a mode: it is the tab's destination from then on, and
// Settings can change it back at any time.
//
// 'ask' is the default and the state the door renders for. It is deliberately
// a third value rather than `remembered: boolean` alongside a choice —
// unticking "remember this" has to leave NOTHING behind, and a nullable
// choice makes "asked and declined to commit" indistinguishable from "never
// asked" for the code that has to tell them apart.

import { createPersistedSignal } from '@/lib/storage'

export type RoomChoice = 'ask' | 'night' | 'workspace'
export type RoomInstrument = 'piano' | 'guitar'

const isChoice = (value: unknown): value is RoomChoice =>
  value === 'ask' || value === 'night' || value === 'workspace'

/**
 * Synced, not device-local: the prefix puts these in the settings sync (see
 * src/db/services/settings-service.ts), so choosing Night on the laptop means
 * the tablet opens Night too. It is a statement about which room someone
 * wants, and that does not change per device.
 */
export const [pianoRoomChoice, setPianoRoomChoice] =
  createPersistedSignal<RoomChoice>('pitchperfect_room_piano', 'ask', {
    validator: isChoice,
  })

export const [guitarRoomChoice, setGuitarRoomChoice] =
  createPersistedSignal<RoomChoice>('pitchperfect_room_guitar', 'ask', {
    validator: isChoice,
  })

export function roomChoice(instrument: RoomInstrument): RoomChoice {
  return instrument === 'piano' ? pianoRoomChoice() : guitarRoomChoice()
}

export function setRoomChoice(
  instrument: RoomInstrument,
  choice: RoomChoice,
): void {
  if (instrument === 'piano') setPianoRoomChoice(choice)
  else setGuitarRoomChoice(choice)
}

export const ROOM_INSTRUMENTS: readonly RoomInstrument[] = ['piano', 'guitar']

export const ROOM_LABEL: Record<RoomInstrument, string> = {
  piano: 'Piano',
  guitar: 'Guitar',
}
