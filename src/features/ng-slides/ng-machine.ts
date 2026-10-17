// ============================================================
// Ng slides' states: from the intro to the result
// ============================================================
//
//   intro     the bridge unlit, Merc on the pier, his line, the mic
//   starting  the mic opens (inside the singer's tap)
//   settle    no voiceprint and no note kept: the singer hums an easy note
//   run       the count-in and the five slides, the bridge scrolling
//   result    the whole bridge, lit as the slides lit it
//   blocked   the mic would not open
//
// The glide rooms' machine (room-kit glide/glide-room-machine.ts), under
// Ng slides' names: Lip roll's is the same one (lip-machine.ts).

import type { GlideRoomBlock, GlideRoomDemoPhase, GlideRoomEvent, GlideRoomPhase, GlideRoomState, } from '@/components/room-kit/glide/glide-room-machine'
import { glideMicState, glideRoomReducer, initialGlideRoomState, } from '@/components/room-kit/glide/glide-room-machine'

export { isRunPhase } from '@/components/room-kit/glide/glide-room-machine'

export type NgPhase = GlideRoomPhase
export type NgBlock = GlideRoomBlock
/** The phases the demo puts the room in: its start, and a slide. */
export type NgDemoPhase = GlideRoomDemoPhase
export type NgState = GlideRoomState
export type NgEvent = GlideRoomEvent

/** The mic's state in a phase; `sliding`: a slide is being sung. */
export const ngMicState = glideMicState
export const initialNgState = initialGlideRoomState
export const ngReducer = glideRoomReducer
