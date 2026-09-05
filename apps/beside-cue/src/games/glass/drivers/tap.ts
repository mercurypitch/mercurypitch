// The tap driver: rhythm play with no microphone. It leases the app's
// shared AudioContext (audio/shared-audio-context.ts) purely as the
// conductor clock — and for game sound output — and queues pointer/key
// taps as discrete intents stamped with that clock. The runtime drains
// and judges them; the driver stays dumb hardware.
//
// Sharing the clock is what makes the judging honest: a tap stamped here
// is compared against a note the stage scheduled, and two contexts would
// have measured that gap with two different stopwatches.

import { acquireSharedAudioContext } from '@/audio/shared-audio-context'
import type { DiscreteIntent, InteractionDriver } from './types'

export const createTapDriver = (): InteractionDriver => {
  const lease = acquireSharedAudioContext('tap-driver')
  let queue: DiscreteIntent[] = []
  /** stop() has run -- possibly while start() was still waiting on the
   *  resume, in which case the listeners must not go on at all. */
  let stopped = false

  const isUiTarget = (e: Event): boolean =>
    e.target instanceof Element && e.target.closest('button') !== null

  const onPointer = (e: PointerEvent): void => {
    if (isUiTarget(e)) return // buttons stay buttons, not beats
    queue.push({
      type: 'tap',
      tAudio: lease.peek()?.currentTime ?? 0,
      x: e.clientX,
      y: e.clientY,
    })
  }
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== ' ' && e.key !== 'Enter') return
    if (isUiTarget(e)) return
    e.preventDefault()
    queue.push({ type: 'tap', tAudio: lease.peek()?.currentTime ?? 0 })
  }

  return {
    async start(): Promise<void> {
      // Reached before the await so the resume rides the starting tap.
      lease.ensure()
      try {
        await lease.unlock()
      } catch (err) {
        // Nobody calls stop() on a driver that never came up.
        lease.release()
        throw err
      }
      if (stopped) return
      window.addEventListener('pointerdown', onPointer)
      window.addEventListener('keydown', onKey)
    },

    stop(): void {
      stopped = true
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
      queue = []
      // Never close: the context is the app's, not this driver's.
      lease.release()
    },

    latestPitch(): null {
      return null // taps carry no pitch; the melody plays itself
    },

    latestLevel(): number {
      return 0
    },

    drainIntents(): DiscreteIntent[] {
      const out = queue
      queue = []
      return out
    },

    ctx(): AudioContext | null {
      return lease.peek()
    },
  }
}
