// The sing driver: mic + SwiftF0 behind the InteractionDriver seam.
// Exactly the lifecycle the stage engine used inline — acquire mic,
// resume an AudioContext, run the F0 stream — with the voiced gate
// (confidence, f0 > 0) applied here so the runtime only ever sees
// trustworthy pitch. No discrete intents: a voice is continuous.

import type { F0Stream } from '@irchiinnuss/pitch-engine'
import { CONF_MIN, createF0Stream, hzToCents, micManager, } from '@irchiinnuss/pitch-engine'
import type { DiscreteIntent, InteractionDriver, PitchSample } from './types'

export const createSingDriver = (micId: string): InteractionDriver => {
  let audioContext: AudioContext | null = null
  let f0: F0Stream | null = null

  return {
    async start(): Promise<void> {
      const stream = await micManager.acquire(micId)
      audioContext = new AudioContext()
      await audioContext.resume()
      f0 = createF0Stream(audioContext, stream)
      f0.startTask()
    },

    stop(): void {
      f0?.dispose()
      f0 = null
      micManager.release(micId)
      void audioContext?.close()
      audioContext = null
    },

    latestPitch(): PitchSample | null {
      const fr = f0?.latestSmoothed()
      if (!fr || fr.f0 <= 0 || fr.conf < CONF_MIN) return null
      return {
        midi: hzToCents(fr.f0) / 100,
        rms: fr.rms,
        conf: fr.conf,
        tAudio: audioContext?.currentTime ?? 0,
      }
    },

    latestLevel(): number {
      return f0?.latestSmoothed()?.rms ?? 0
    },

    drainIntents(): DiscreteIntent[] {
      return []
    },

    ctx(): AudioContext | null {
      return audioContext
    },
  }
}
