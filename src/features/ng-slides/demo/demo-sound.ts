// ============================================================
// The Ng slides demo's sound: the count-in's note, then Merc's hum
// ============================================================
//
// The glide rooms' demo sound (room-kit glide/glide-demo-sound.ts): each
// take opens with the slide's root, as the room's count-in plays it, then
// Merc's hum along the take, with the `hum` timbre and the vibrato the
// frames carry, so the voice heard is the voice the engine was fed.

import type { DemoSoundtrack } from '@/components/demo-kit/demo-sound'
import type { GlideDemoVoice } from '@/components/room-kit/glide/glide-demo-sound'
import { createGlideDemoSound } from '@/components/room-kit/glide/glide-demo-sound'
import type { NgDemoTake } from './demo-script'
import { DEMO_VIBRATO } from './demo-script'

export type NgDemoSound = DemoSoundtrack<NgDemoTake>

/** Merc's hum. */
const HUM: GlideDemoVoice = { vibrato: DEMO_VIBRATO, timbre: 'hum' }

export function createDemoSound(
  ctx: AudioContext,
  minLead: number,
): NgDemoSound {
  return createGlideDemoSound<NgDemoTake>(ctx, minLead, HUM)
}
