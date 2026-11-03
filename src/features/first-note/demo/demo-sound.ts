// ============================================================
// The First note demo's sound: the band leads in, then the voice
// ============================================================
//
// The band is the bundled clip of the song's own lead-in (demo-band.ts),
// started at INTRO_AT on the take's clock, so the countdown, which runs on
// the same clock, counts the beats the band plays. Merc sings the note
// after take 1's miss through the room's RoundVoice (his sampled voice on
// the phone, the synth "ooh" elsewhere), and the voice through the demo
// kit's soundtrack (demo-kit/demo-sound.ts) with the vibrato the frames
// carry, so the voice heard is the voice the engine was fed. The demo plays
// no opening note: the band is the cue, as a run's is.
//
// Everything is scheduled on the take's clock and stops with it on Skip,
// on the way out and when the app goes to the background. With no clip
// (it would not load), the takes play without their band.

import type { DemoSoundtrack } from '@/components/demo-kit/demo-sound'
import { createDemoSoundtrack, outputLatency, } from '@/components/demo-kit/demo-sound'
import type { RoundVoice } from '@/components/room-kit/round-voice'
import { playBand } from './demo-band'
import type { FirstNoteDemoTake } from './demo-script'
import { DEMO_VIBRATO } from './demo-script'

export type FirstNoteDemoSound = DemoSoundtrack<FirstNoteDemoTake>

export function createDemoSound(
  ctx: AudioContext,
  minLead: number,
  voice: RoundVoice,
  band: AudioBuffer | null,
): FirstNoteDemoSound {
  const singer = createDemoSoundtrack<FirstNoteDemoTake>(
    ctx,
    minLead,
    DEMO_VIBRATO,
  )
  const latency = outputLatency(ctx)
  const playing: { stop(): void }[] = []
  let stopped = false
  return {
    lead: singer.lead,
    tone: () => undefined,
    sing: (take, midi) => {
      if (stopped) return
      // The take's clock reads zero `lead` from now, at the speaker.
      const zero = ctx.currentTime + singer.lead - latency
      if (band !== null) playing.push(playBand(ctx, band, zero + take.introAt))
      if (take.answer.length > 0) {
        playing.push(voice.sing(ctx, take.answer, zero))
      }
      singer.sing(take, midi)
    },
    stop: () => {
      if (stopped) return
      stopped = true
      for (const sound of playing) sound.stop()
      singer.stop()
    },
  }
}
