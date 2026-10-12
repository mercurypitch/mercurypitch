// ============================================================
// The Long note demo's sound: the note, then Merc singing it
// ============================================================
//
// The demo kit's sound (demo-kit/demo-sound.ts) with the vibrato Long note's
// frames carry, so the voice heard is the voice the engine was fed.

import type { DemoSoundtrack } from '@/components/demo-kit/demo-sound'
import { createDemoSoundtrack } from '@/components/demo-kit/demo-sound'
import type { DemoTake } from './demo-script'
import { DEMO_VIBRATO } from './demo-script'

export type LongNoteDemoSound = DemoSoundtrack<DemoTake>

export function createDemoSound(
  ctx: AudioContext,
  minLead: number,
): LongNoteDemoSound {
  return createDemoSoundtrack(ctx, minLead, DEMO_VIBRATO)
}
