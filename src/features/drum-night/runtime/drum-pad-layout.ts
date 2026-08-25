// Drum Night pad layout — six immediate controls over the full GM kit.
// ============================================================

import { generalMidiPercussionName, GM_PERCUSSION_MAX, GM_PERCUSSION_MIN, normalizeGeneralMidiPercussionKey, } from '@/lib/percussion'

export type EssentialDrumPadId =
  | 'hi-hat'
  | 'snare'
  | 'kick'
  | 'tom'
  | 'ride'
  | 'crash'

/** Mixable authored-kit families; live input always stays on its own lane. */
export type DrumKitAuthoredFamily =
  | 'cymbals'
  | 'hats'
  | 'kick'
  | 'snare'
  | 'toms'

export const DRUM_KIT_AUTHORED_FAMILIES: readonly DrumKitAuthoredFamily[] =
  Object.freeze(['kick', 'snare', 'hats', 'toms', 'cymbals'])

export interface EssentialDrumPad {
  readonly id: EssentialDrumPadId
  readonly label: string
  readonly shortLabel: string
  readonly gmKey: number
  readonly keyboardCode: string
  readonly keyboardLabel: string
}

export interface GeneralMidiDrumArticulation {
  readonly gmKey: number
  readonly label: string
  readonly essentialPadId: EssentialDrumPadId | null
}

export const ESSENTIAL_DRUM_PADS: readonly EssentialDrumPad[] = Object.freeze([
  Object.freeze({
    id: 'hi-hat',
    label: 'Closed hi-hat',
    shortLabel: 'HH',
    gmKey: 42,
    keyboardCode: 'Digit1',
    keyboardLabel: '1',
  }),
  Object.freeze({
    id: 'snare',
    label: 'Acoustic snare',
    shortLabel: 'SN',
    gmKey: 38,
    keyboardCode: 'Digit2',
    keyboardLabel: '2',
  }),
  Object.freeze({
    id: 'kick',
    label: 'Bass drum',
    shortLabel: 'KICK',
    gmKey: 36,
    keyboardCode: 'Digit3',
    keyboardLabel: '3',
  }),
  Object.freeze({
    id: 'tom',
    label: 'Hi-mid tom',
    shortLabel: 'TOM',
    gmKey: 48,
    keyboardCode: 'Digit4',
    keyboardLabel: '4',
  }),
  Object.freeze({
    id: 'ride',
    label: 'Ride cymbal',
    shortLabel: 'RIDE',
    gmKey: 51,
    keyboardCode: 'Digit5',
    keyboardLabel: '5',
  }),
  Object.freeze({
    id: 'crash',
    label: 'Crash cymbal',
    shortLabel: 'CR',
    gmKey: 49,
    keyboardCode: 'Digit6',
    keyboardLabel: '6',
  }),
])

const PAD_BY_ID = new Map(
  ESSENTIAL_DRUM_PADS.map((pad) => [pad.id, pad] as const),
)
const PAD_BY_KEYBOARD_CODE = new Map(
  ESSENTIAL_DRUM_PADS.flatMap((pad) => [
    [pad.keyboardCode, pad] as const,
    [`Numpad${pad.keyboardLabel}`, pad] as const,
  ]),
)
const PAD_ID_BY_GM_KEY = new Map(
  ESSENTIAL_DRUM_PADS.map((pad) => [pad.gmKey, pad.id] as const),
)

/** Every bounded General MIDI drum key, including non-essential percussion. */
export const GENERAL_MIDI_DRUM_ARTICULATIONS: readonly GeneralMidiDrumArticulation[] =
  Object.freeze(
    Array.from(
      { length: GM_PERCUSSION_MAX - GM_PERCUSSION_MIN + 1 },
      (_, index) => {
        const gmKey = GM_PERCUSSION_MIN + index
        return Object.freeze({
          gmKey,
          label: generalMidiPercussionName(gmKey),
          essentialPadId: PAD_ID_BY_GM_KEY.get(gmKey) ?? null,
        })
      },
    ),
  )

export function essentialDrumPad(padId: EssentialDrumPadId): EssentialDrumPad {
  return PAD_BY_ID.get(padId)!
}

export function drumPadForKeyboardCode(code: string): EssentialDrumPad | null {
  return PAD_BY_KEYBOARD_CODE.get(code) ?? null
}

export function isGeneralMidiDrumKey(value: number): boolean {
  return normalizeGeneralMidiPercussionKey(value) !== null
}

/** Group only articulations the shared kit player can represent honestly. */
export function drumKitAuthoredFamily(
  gmKey: number,
): DrumKitAuthoredFamily | null {
  if (gmKey === 35 || gmKey === 36) return 'kick'
  if (gmKey >= 37 && gmKey <= 40) return 'snare'
  if (gmKey === 42 || gmKey === 44 || gmKey === 46) return 'hats'
  if (
    gmKey === 41 ||
    gmKey === 43 ||
    gmKey === 45 ||
    gmKey === 47 ||
    gmKey === 48 ||
    gmKey === 50
  ) {
    return 'toms'
  }
  if (
    gmKey === 49 ||
    gmKey === 51 ||
    gmKey === 52 ||
    gmKey === 53 ||
    gmKey === 55 ||
    gmKey === 57 ||
    gmKey === 59
  ) {
    return 'cymbals'
  }
  return null
}
