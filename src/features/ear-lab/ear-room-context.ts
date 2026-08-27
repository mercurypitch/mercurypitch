// ============================================================
// What the room lends the drills inside it: its rack, and its sound.
//
// Its own module so a panel the shell renders (the tap check) and a
// drill the shell wraps (the Grid) can both read it without importing
// the shell.
// ============================================================

import { createContext, useContext } from 'solid-js'
import type { ClickVoice } from './click-synth'
import { EAR_VOLUME, earClickVoice } from './ear-sound'

export type RackPanel =
  | 'today'
  | 'instruments'
  | 'room'
  | 'readiness'
  | 'rulers'

export interface EarRoomApi {
  /** Open a rack panel — a drill can send the player to the room's sound. */
  openPanel: (panel: RackPanel) => void
  /** The bench's level, 0-1, on top of the app's own volume. */
  volume: () => number
  clickVoice: () => ClickVoice
}

export const EarRoomContext = createContext<EarRoomApi>({
  openPanel: () => undefined,
  volume: () => EAR_VOLUME.defaultValue,
  clickVoice: earClickVoice,
})

export function useEarRoom(): EarRoomApi {
  return useContext(EarRoomContext)
}
