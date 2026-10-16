// ============================================================
// The Ng slides demo's sound: the count-in's note, then Merc's hum
// ============================================================
//
// Each take opens as a run does: the slide's root, as the room's count-in
// plays it (bridge-tones.ts: the Hear button's tone, COUNT_IN_TONE_SEC),
// then Merc's hum along the take, through the demo kit's soundtrack
// (demo-kit/demo-sound.ts) with the `hum` timbre and the vibrato the
// frames carry, so the voice heard is the voice the engine was fed. Skip,
// the way out and the app going to the background stop both at once. The
// kit's opening note stays silent: each take's count-in plays the root
// itself.
//
// The hum is synthesised: nothing loads, so the demo has nothing to wait
// for before it starts (the kit's `ready`).

import type { DemoSoundtrack } from '@/components/demo-kit/demo-sound'
import { createDemoSoundtrack, outputLatency, } from '@/components/demo-kit/demo-sound'
import { roomOutput } from '@/components/room-kit/room-output'
import type { ReferenceTone } from '@/lib/reference-tone'
import { startReferenceTone } from '@/lib/reference-tone'
import { COUNT_IN_TONE_SEC } from '../ng-run'
import type { NgDemoTake } from './demo-script'
import { DEMO_VIBRATO } from './demo-script'

export type NgDemoSound = DemoSoundtrack<NgDemoTake>

export function createDemoSound(
  ctx: AudioContext,
  minLead: number,
): NgDemoSound {
  const hum = createDemoSoundtrack<NgDemoTake>(
    ctx,
    minLead,
    DEMO_VIBRATO,
    'hum',
  )
  const latency = outputLatency(ctx)
  const tones = new Set<ReferenceTone>()
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let stopped = false
  return {
    lead: hum.lead,
    tone: () => undefined,
    sing: (take, midi) => {
      if (stopped) return
      // Heard as the take's clock reads zero, as the room's count-in is.
      const wait = Math.max(0, hum.lead - latency) * 1000
      const id = setTimeout(() => {
        timers.delete(id)
        if (stopped) return
        const tone = startReferenceTone(
          ctx,
          take.root,
          COUNT_IN_TONE_SEC,
          roomOutput(ctx),
          { lowNoteOctave: true },
        )
        tones.add(tone)
        void tone.done.then(() => tones.delete(tone))
      }, wait)
      timers.add(id)
      hum.sing(take, midi)
    },
    stop: () => {
      if (stopped) return
      stopped = true
      for (const id of timers) clearTimeout(id)
      timers.clear()
      for (const tone of tones) tone.stop()
      tones.clear()
      hum.stop()
    },
  }
}
