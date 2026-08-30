// The tap driver: rhythm play with no microphone. Owns an AudioContext
// purely as the conductor clock (and for game sound output) and queues
// pointer/key taps as discrete intents stamped with the audio clock.
// The runtime drains and judges them; the driver stays dumb hardware.

import type { DiscreteIntent, InteractionDriver } from './types'

export const createTapDriver = (): InteractionDriver => {
  let audioContext: AudioContext | null = null
  let queue: DiscreteIntent[] = []

  const isUiTarget = (e: Event): boolean =>
    e.target instanceof Element && e.target.closest('button') !== null

  const onPointer = (e: PointerEvent): void => {
    if (isUiTarget(e)) return // buttons stay buttons, not beats
    queue.push({ type: 'tap', tAudio: audioContext?.currentTime ?? 0 })
  }
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== ' ' && e.key !== 'Enter') return
    if (isUiTarget(e)) return
    e.preventDefault()
    queue.push({ type: 'tap', tAudio: audioContext?.currentTime ?? 0 })
  }

  return {
    async start(): Promise<void> {
      audioContext = new AudioContext()
      await audioContext.resume()
      window.addEventListener('pointerdown', onPointer)
      window.addEventListener('keydown', onKey)
    },

    stop(): void {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
      queue = []
      void audioContext?.close()
      audioContext = null
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
      return audioContext
    },
  }
}
