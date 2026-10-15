// ============================================================
// The Lip roll demo's sound: the count-in's note, then Merc's buzz
// ============================================================
//
// Each take opens as a run does: the wave's root, as the room's count-in
// plays it (room-kit room-tones.ts: the Hear button's tone,
// COUNT_IN_TONE_SEC), then Merc's buzz along the take, through the demo
// kit's soundtrack (demo-kit/demo-sound.ts): the open "ooh" with a lip
// trill's 25 Hz flutter on it (demo-audio.ts LIP_FLUTTER), on the pitch the
// frames carry, so the voice heard is the voice the engine was fed. A
// trill has no vibrato of its own, so the buzz has none. Skip, the way out
// and the app going to the background stop both at once. The kit's
// opening note stays silent: each take's count-in plays the root itself.
//
// The buzz is synthesised: nothing loads, so the demo has nothing to wait
// for before it starts (the kit's `ready`).

import type { DemoSoundtrack } from '@/components/demo-kit/demo-sound'
import { createDemoSoundtrack, outputLatency, } from '@/components/demo-kit/demo-sound'
import { roomOutput } from '@/components/room-kit/room-output'
import { LIP_FLUTTER } from '@/lib/demo-audio'
import type { ReferenceTone } from '@/lib/reference-tone'
import { startReferenceTone } from '@/lib/reference-tone'
import { COUNT_IN_TONE_SEC } from '../lip-run'
import type { LipDemoTake } from './demo-script'

export type LipDemoSound = DemoSoundtrack<LipDemoTake>

export function createDemoSound(
  ctx: AudioContext,
  minLead: number,
): LipDemoSound {
  const buzz = createDemoSoundtrack<LipDemoTake>(
    ctx,
    minLead,
    undefined,
    'ooh',
    LIP_FLUTTER,
  )
  const latency = outputLatency(ctx)
  const tones = new Set<ReferenceTone>()
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let stopped = false
  return {
    lead: buzz.lead,
    tone: () => undefined,
    sing: (take, midi) => {
      if (stopped) return
      // Heard as the take's clock reads zero, as the room's count-in is.
      const wait = Math.max(0, buzz.lead - latency) * 1000
      const id = setTimeout(() => {
        timers.delete(id)
        if (stopped) return
        const tone = startReferenceTone(
          ctx,
          take.root,
          COUNT_IN_TONE_SEC,
          roomOutput(ctx),
        )
        tones.add(tone)
        void tone.done.then(() => tones.delete(tone))
      }, wait)
      timers.add(id)
      buzz.sing(take, midi)
    },
    stop: () => {
      if (stopped) return
      stopped = true
      for (const id of timers) clearTimeout(id)
      timers.clear()
      for (const tone of tones) tone.stop()
      tones.clear()
      buzz.stop()
    },
  }
}
