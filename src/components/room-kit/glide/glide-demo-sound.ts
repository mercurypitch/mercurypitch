// ============================================================
// A glide room's demo sound: the count-in's note, then Merc's voice
// ============================================================
//
// Each take opens as a run does: the arch's root, as the room's count-in
// plays it (room-kit room-tones.ts: the Hear button's tone,
// COUNT_IN_TONE_SEC), then Merc's voice along the take, through the demo
// kit's soundtrack (demo-kit/demo-sound.ts), on the pitch the frames
// carry, so the voice heard is the voice the engine was fed. Skip, the way
// out and the app going to the background stop both at once. The kit's
// opening note stays silent: each take's count-in plays the root itself.
//
// The voice is synthesised: nothing loads, so the demo has nothing to wait
// for before it starts (the kit's `ready`). A room brings only its voice
// (GlideDemoVoice): Lip roll's buzz, Ng slides' hum.

import type { DemoSoundtrack, SungDemoTake, } from '@/components/demo-kit/demo-sound'
import { createDemoSoundtrack, outputLatency, } from '@/components/demo-kit/demo-sound'
import { startRoomTone } from '@/components/room-kit/room-tones'
import type { VoiceContourOptions } from '@/lib/demo-voice'
import type { ReferenceTone } from '@/lib/reference-tone'
import { COUNT_IN_TONE_SEC } from './glide-room-contract'

/** Merc's voice in a room's demo: as the demo kit's soundtrack sings it. */
export interface GlideDemoVoice {
  /** The vibrato the frames carry, or none (a trill has none of its own). */
  readonly vibrato: VoiceContourOptions['vibrato']
  readonly timbre: VoiceContourOptions['timbre']
  /** A lip buzz's flutter on the loudness, or none. */
  readonly flutter?: VoiceContourOptions['flutter']
}

/** A demo take, as the sound reads it: its voice, and its arch's root. */
export interface GlideDemoSoundTake extends SungDemoTake {
  /** The root the take's count-in plays, MIDI. */
  readonly root: number
}

export function createGlideDemoSound<Take extends GlideDemoSoundTake>(
  ctx: AudioContext,
  minLead: number,
  voice: GlideDemoVoice,
): DemoSoundtrack<Take> {
  const merc = createDemoSoundtrack<Take>(
    ctx,
    minLead,
    voice.vibrato,
    voice.timbre,
    voice.flutter,
  )
  const latency = outputLatency(ctx)
  const tones = new Set<ReferenceTone>()
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let stopped = false
  return {
    lead: merc.lead,
    tone: () => undefined,
    sing: (take, midi) => {
      if (stopped) return
      // Heard as the take's clock reads zero, as the room's count-in is.
      const wait = Math.max(0, merc.lead - latency) * 1000
      const id = setTimeout(() => {
        timers.delete(id)
        if (stopped) return
        // None behind Control Center: the clock stays parked (room-tones.ts).
        const tone = startRoomTone(ctx, take.root, COUNT_IN_TONE_SEC)
        if (tone === null) return
        tones.add(tone)
        void tone.done.then(() => tones.delete(tone))
      }, wait)
      timers.add(id)
      merc.sing(take, midi)
    },
    stop: () => {
      if (stopped) return
      stopped = true
      for (const id of timers) clearTimeout(id)
      timers.clear()
      for (const tone of tones) tone.stop()
      tones.clear()
      merc.stop()
    },
  }
}
