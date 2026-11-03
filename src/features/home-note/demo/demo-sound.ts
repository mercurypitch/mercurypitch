// ============================================================
// The Home note demo's sound: the band, then the voice finding home
// ============================================================
//
// Through the room's own voices: the band's organ for the intro and for
// home's chord at the outcome (home-note-band.ts), Merc singing home over
// it after take 1's miss through the room's RoundVoice (his sampled voice
// on the phone, the synth "ooh" elsewhere), and the voice through the demo
// kit's soundtrack (demo-kit/demo-sound.ts) with the vibrato the frames
// carry, so the voice heard is the voice the engine was fed. The demo
// plays no opening note: the band's intro is the cue, as a run's is.
//
// Everything is scheduled on the take's clock, at its own place on it
// (INTRO_AT, and the outcome the script dates home's chord from), and
// stops with it on Skip, on the way out and when the app goes to the
// background.

import type { DemoSoundtrack } from '@/components/demo-kit/demo-sound'
import { createDemoSoundtrack, outputLatency, } from '@/components/demo-kit/demo-sound'
import type { RoundVoice } from '@/components/room-kit/round-voice'
import type { BandSound } from '../home-note-band'
import { playChord } from '../home-note-band'
import { voiceChord } from '../home-note-round'
import { CHORD_SECONDS, RESOLVE_SECONDS } from '../home-note-rules'
import type { HomeNoteDemoTake } from './demo-script'
import { DEMO_VIBRATO } from './demo-script'

export type HomeNoteDemoSound = DemoSoundtrack<HomeNoteDemoTake>

export function createDemoSound(
  ctx: AudioContext,
  minLead: number,
  voice: RoundVoice,
): HomeNoteDemoSound {
  const singer = createDemoSoundtrack<HomeNoteDemoTake>(
    ctx,
    minLead,
    DEMO_VIBRATO,
  )
  const latency = outputLatency(ctx)
  const playing: BandSound[] = []
  const merc: { stop(): void }[] = []
  let stopped = false
  return {
    lead: singer.lead,
    tone: () => undefined,
    sing: (take, midi) => {
      if (stopped) return
      // The take's clock reads zero `lead` from now, at the speaker.
      const zero = ctx.currentTime + singer.lead - latency
      const { home } = take.round
      take.rules.intro.forEach((chord, i) => {
        playing.push(
          playChord(
            ctx,
            voiceChord(home, chord),
            zero + take.introAt + i * CHORD_SECONDS,
            CHORD_SECONDS,
          ),
        )
      })
      // Home's chord at the outcome: under the voice, or under Merc.
      playing.push(
        playChord(
          ctx,
          voiceChord(home, 'I'),
          zero + take.resolveAt,
          RESOLVE_SECONDS,
        ),
      )
      if (take.answer.length > 0) merc.push(voice.sing(ctx, take.answer, zero))
      singer.sing(take, midi)
    },
    stop: () => {
      if (stopped) return
      stopped = true
      for (const sound of playing) sound.stop()
      for (const sung of merc) sung.stop()
      singer.stop()
    },
  }
}
