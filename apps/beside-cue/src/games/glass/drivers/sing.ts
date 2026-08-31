// The sing driver: mic + SwiftF0 behind the InteractionDriver seam.
// Exactly the lifecycle the stage engine used inline — acquire mic,
// unlock the shared AudioContext, run the F0 stream — with the voiced
// gate (confidence, f0 > 0) applied here so the runtime only ever sees
// trustworthy pitch. No discrete intents: a voice is continuous.
//
// The context comes from the app's one shared clock (audio/
// shared-audio-context.ts), so pitch samples are stamped with the same
// currentTime the stage schedules its hums and notes against. It is
// reached BEFORE the mic await, because on iOS only the synchronous part
// of the tap handler can lift a suspended context, and the permission
// prompt in front of getUserMedia can take seconds.

import type { F0Stream } from '@irchiinnuss/pitch-engine'
import { CONF_MIN, createF0Stream, hzToCents, micManager, } from '@irchiinnuss/pitch-engine'
import { acquireSharedAudioContext } from '@/audio/shared-audio-context'
import type { DiscreteIntent, InteractionDriver, PitchSample } from './types'

/** Shaped like a MicError so micErrorLine() prints this sentence verbatim. */
const audioUnavailable = (): Error =>
  Object.assign(
    new Error('This device has no Web Audio, so pitch cannot be read.'),
    { kind: 'no-audio-context' },
  )

export const createSingDriver = (micId: string): InteractionDriver => {
  const lease = acquireSharedAudioContext(`sing-driver:${micId}`)
  let f0: F0Stream | null = null

  return {
    async start(): Promise<void> {
      const audioContext = lease.ensure()
      if (audioContext === null) throw audioUnavailable()
      const unlocked = lease.unlock()
      const stream = await micManager.acquire(micId)
      await unlocked
      f0 = createF0Stream(audioContext, stream)
      f0.startTask()
    },

    stop(): void {
      f0?.dispose()
      f0 = null
      micManager.release(micId)
      // Never close: the context is the app's, not this driver's.
      lease.release()
    },

    latestPitch(): PitchSample | null {
      const fr = f0?.latestSmoothed()
      if (!fr || fr.f0 <= 0 || fr.conf < CONF_MIN) return null
      return {
        midi: hzToCents(fr.f0) / 100,
        rms: fr.rms,
        conf: fr.conf,
        tAudio: lease.peek()?.currentTime ?? 0,
      }
    },

    latestLevel(): number {
      return f0?.latestSmoothed()?.rms ?? 0
    },

    drainIntents(): DiscreteIntent[] {
      return []
    },

    ctx(): AudioContext | null {
      return lease.peek()
    },
  }
}
