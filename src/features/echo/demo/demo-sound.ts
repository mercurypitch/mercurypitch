// ============================================================
// The Echo demo's sound: Merc's call, then Merc singing it back
// ============================================================
//
// Both through the room's own voices: the call through the room's
// CallVoice (merc-call.ts, the synth "ooh" today, Merc's recorded voice
// when it lands), the echo through the demo kit's soundtrack
// (demo-kit/demo-sound.ts) with the vibrato the frames carry, so the voice
// heard is the voice the engine was fed. Echo has no Hear button, so the
// kit's opening note stays silent: the call is the cue.
//
// The call is scheduled on the same clock as the echo, at its own place on
// the take's clock (CALL_AT), and stops with it on Skip, on the way out and
// when the app goes to the background.

import type { DemoSoundtrack } from '@/components/demo-kit/demo-sound'
import { createDemoSoundtrack, outputLatency, } from '@/components/demo-kit/demo-sound'
import type { CallSchedule, CallVoice } from '../merc-call'
import type { EchoDemoTake } from './demo-script'
import { CALL_AT, DEMO_VIBRATO } from './demo-script'

export type EchoDemoSound = DemoSoundtrack<EchoDemoTake>

export function createDemoSound(
  ctx: AudioContext,
  minLead: number,
  callVoice: CallVoice,
): EchoDemoSound {
  const echo = createDemoSoundtrack<EchoDemoTake>(ctx, minLead, DEMO_VIBRATO)
  const latency = outputLatency(ctx)
  const calls: CallSchedule[] = []
  let stopped = false
  return {
    lead: echo.lead,
    tone: () => undefined,
    sing: (take, midi) => {
      if (stopped) return
      // Heard when the take's clock reads CALL_AT, as the echo is at zero.
      const at = ctx.currentTime + echo.lead - latency + CALL_AT
      calls.push(callVoice.sing(ctx, take.phrase.notes, at))
      echo.sing(take, midi)
    },
    stop: () => {
      if (stopped) return
      stopped = true
      for (const call of calls) call.stop()
      echo.stop()
    },
  }
}
