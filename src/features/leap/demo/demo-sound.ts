// ============================================================
// The Leap demo's sound: Merc's call, then Merc singing the leap
// ============================================================
//
// Both through the room's own voices: his call (and, after take 1's miss,
// both notes) through the room's RoundVoice (his sampled voice on the
// phone, the synth "ooh" elsewhere), the leap through the demo kit's
// soundtrack (demo-kit/demo-sound.ts) with the vibrato the frames carry,
// so the voice heard is the voice the engine was fed. Leap has no Hear
// button, so the kit's opening note stays silent: his call is the cue.
//
// Everything is scheduled on the take's clock, at its own place on it
// (CALL_AT, and the answer the script dates from the miss), and stops with
// it on Skip, on the way out and when the app goes to the background.

import type { DemoSoundtrack } from '@/components/demo-kit/demo-sound'
import { createDemoSoundtrack, outputLatency, } from '@/components/demo-kit/demo-sound'
import type { RoundVoice } from '@/components/room-kit/round-voice'
import type { LeapDemoTake } from './demo-script'
import { DEMO_VIBRATO } from './demo-script'

export type LeapDemoSound = DemoSoundtrack<LeapDemoTake>

export function createDemoSound(
  ctx: AudioContext,
  minLead: number,
  voice: RoundVoice,
): LeapDemoSound {
  const leap = createDemoSoundtrack<LeapDemoTake>(ctx, minLead, DEMO_VIBRATO)
  const latency = outputLatency(ctx)
  const merc: { stop(): void }[] = []
  let stopped = false
  return {
    lead: leap.lead,
    tone: () => undefined,
    sing: (take, midi) => {
      if (stopped) return
      // The take's clock reads zero `lead` from now, at the speaker.
      const zero = ctx.currentTime + leap.lead - latency
      merc.push(voice.sing(ctx, take.call, zero))
      if (take.answer.length > 0) merc.push(voice.sing(ctx, take.answer, zero))
      leap.sing(take, midi)
    },
    stop: () => {
      if (stopped) return
      stopped = true
      for (const sung of merc) sung.stop()
      leap.stop()
    },
  }
}
