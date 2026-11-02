// ============================================================
// The Harmony demo's sound: Merc's line, then the harmony sung back
// ============================================================
//
// Both through the room's own voices: his call (and, after take 1's miss,
// his note and the third from it) through the room's RoundVoice (his
// sampled voice on the phone, the synth "ooh" elsewhere), the harmony sung
// back through the demo kit's soundtrack (demo-kit/demo-sound.ts) with the
// vibrato the frames carry, so the voice heard is the voice the engine was
// fed. Harmony has no Hear button, so the kit's opening note stays silent:
// his call is the cue.
//
// Everything is scheduled on the take's clock, at its own place on it
// (CALL_AT, and the pair the script dates from the miss), and stops with
// it on Skip, on the way out and when the app goes to the background.

import type { DemoSoundtrack } from '@/components/demo-kit/demo-sound'
import { createDemoSoundtrack, outputLatency, } from '@/components/demo-kit/demo-sound'
import type { RoundVoice } from '@/components/room-kit/round-voice'
import type { HarmonyDemoTake } from './demo-script'
import { DEMO_VIBRATO } from './demo-script'

export type HarmonyDemoSound = DemoSoundtrack<HarmonyDemoTake>

export function createDemoSound(
  ctx: AudioContext,
  minLead: number,
  voice: RoundVoice,
): HarmonyDemoSound {
  const harmony = createDemoSoundtrack<HarmonyDemoTake>(
    ctx,
    minLead,
    DEMO_VIBRATO,
  )
  const latency = outputLatency(ctx)
  const merc: { stop(): void }[] = []
  let stopped = false
  return {
    lead: harmony.lead,
    tone: () => undefined,
    sing: (take, midi) => {
      if (stopped) return
      // The take's clock reads zero `lead` from now, at the speaker.
      const zero = ctx.currentTime + harmony.lead - latency
      merc.push(voice.sing(ctx, take.call, zero))
      if (take.answer.length > 0) merc.push(voice.sing(ctx, take.answer, zero))
      harmony.sing(take, midi)
    },
    stop: () => {
      if (stopped) return
      stopped = true
      for (const sung of merc) sung.stop()
      harmony.stop()
    },
  }
}
