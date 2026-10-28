// ============================================================
// The Lip roll demo's sound: the count-in's note, then Merc's buzz
// ============================================================
//
// The glide rooms' demo sound (room-kit glide/glide-demo-sound.ts): each
// take opens with the wave's root, as the room's count-in plays it, then
// Merc's buzz along the take. The buzz is the open "ooh" with a lip
// trill's 25 Hz flutter on it (demo-voice.ts LIP_FLUTTER), on the pitch
// the frames carry, so the voice heard is the voice the engine was fed. A
// trill has no vibrato of its own, so the buzz has none.

import type { DemoSoundtrack } from '@/components/demo-kit/demo-sound'
import type { GlideDemoVoice } from '@/components/room-kit/glide/glide-demo-sound'
import { createGlideDemoSound } from '@/components/room-kit/glide/glide-demo-sound'
import { LIP_FLUTTER } from '@/lib/demo-voice'
import type { LipDemoTake } from './demo-script'

export type LipDemoSound = DemoSoundtrack<LipDemoTake>

/** Merc's buzz. */
const BUZZ: GlideDemoVoice = {
  vibrato: undefined,
  timbre: 'ooh',
  flutter: LIP_FLUTTER,
}

export function createDemoSound(
  ctx: AudioContext,
  minLead: number,
): LipDemoSound {
  return createGlideDemoSound<LipDemoTake>(ctx, minLead, BUZZ)
}
