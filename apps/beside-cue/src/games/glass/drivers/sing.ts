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

/** Every driver holds the microphone under its own consumer id. The
 *  stages open a new driver under the same mic id before the old one
 *  has let go (a second tap during the permission prompt, a switch),
 *  and MicManager counts consumers by id: a late release from the old
 *  driver used to delete the new driver's hold, and the manager's
 *  linger then tore the live stream down two seconds later. */
let instances = 0

export const createSingDriver = (micId: string): InteractionDriver => {
  const consumer = `${micId}#${(instances += 1)}`
  const lease = acquireSharedAudioContext(`sing-driver:${consumer}`)
  let f0: F0Stream | null = null
  /** stop() has run -- possibly while start() was still waiting on the
   *  permission prompt, in which case start() hands back what it was
   *  given instead of wiring up a stream nobody will ever stop. */
  let stopped = false
  /** The mic reference this driver holds; released exactly once. */
  let holding = false

  const letGo = (): void => {
    if (!holding) return
    holding = false
    micManager.release(consumer)
  }

  return {
    async start(): Promise<void> {
      if (stopped) return
      const audioContext = lease.ensure()
      if (audioContext === null) {
        lease.release()
        throw audioUnavailable()
      }
      const unlocked = lease.unlock()
      let stream: MediaStream
      try {
        stream = await micManager.acquire(consumer)
        holding = true
        await unlocked
      } catch (err) {
        // A driver that never came up gets no stop(): the stage drops it
        // and shows the error. So the mic and the lease go back from here,
        // or the shared context is never parked again.
        letGo()
        lease.release()
        throw err
      }
      if (stopped) {
        letGo()
        return
      }
      f0 = createF0Stream(audioContext, stream)
      f0.startTask()
    },

    stop(): void {
      if (stopped) return
      stopped = true
      f0?.dispose()
      f0 = null
      letGo()
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
