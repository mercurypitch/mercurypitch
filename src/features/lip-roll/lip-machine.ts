// ============================================================
// Lip roll's states: from the intro to the result
// ============================================================
//
//   intro     the bay unlit, Merc buzzing at the first root, his line, the mic
//   starting  the mic opens (inside the singer's tap)
//   settle    no voiceprint and no note kept: the singer sings an easy note
//   run       the count-in and the three waves, the bay scrolling
//   result    the whole bay, lit as the waves lit it
//   blocked   the mic would not open
//
// The glide rooms' machine (room-kit glide/glide-room-machine.ts), under
// Lip roll's names: Ng slides' is the same one (ng-machine.ts).

import type { GlideRoomBlock, GlideRoomDemoPhase, GlideRoomEvent, GlideRoomPhase, GlideRoomState, } from '@/components/room-kit/glide/glide-room-machine'
import { glideMicState, glideRoomReducer, initialGlideRoomState, } from '@/components/room-kit/glide/glide-room-machine'

export { isRunPhase } from '@/components/room-kit/glide/glide-room-machine'

export type LipPhase = GlideRoomPhase
export type LipBlock = GlideRoomBlock
/** The phases the demo puts the room in: its start, and a wave. */
export type LipDemoPhase = GlideRoomDemoPhase
export type LipState = GlideRoomState
export type LipEvent = GlideRoomEvent

/** The mic's state in a phase; `riding`: a wave is being ridden. */
export const lipMicState = glideMicState
export const initialLipState = initialGlideRoomState
export const lipReducer = glideRoomReducer
