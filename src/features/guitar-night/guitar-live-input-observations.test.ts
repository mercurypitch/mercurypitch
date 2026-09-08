// Observation isolation protects raw audio evidence from failing or mutating display subscribers.
import { createRoot } from 'solid-js'
import { describe, expect, it } from 'vitest'
import type { GuitarInputCapture } from '@/lib/guitar/input-events'
import type { GuitarLiveInputObservation } from './guitar-live-input-observations'
import { createGuitarLiveInputObservations } from './guitar-live-input-observations'

describe('live input observation isolation', () => {
  it('copies and freezes nested evidence while continuing after a subscriber mutates it', () =>
    createRoot((dispose) => {
      const bus = createGuitarLiveInputObservations()
      const evidence: GuitarInputCapture = {
        kind: 'attack',
        source: 'interface',
        voiceId: null,
        level: 0.2,
        clock: { kind: 'audio-worklet', atFrame: 4800, sampleRate: 48000 },
        pitch: { midi: 64, noteName: 'E4', cents: 0, clarity: 0.9 },
      }
      const received: GuitarLiveInputObservation[] = []
      bus.subscribe((observation) => {
        if (
          observation.type === 'capture' &&
          observation.capture.pitch !== null
        )
          observation.capture.pitch.midi = 1
      })
      bus.subscribe((observation) => received.push(observation))
      bus.start(
        { sampleRate: 48000, currentTime: 0 } as AudioContext,
        'interface',
      )
      bus.capture(evidence)
      expect(evidence.pitch?.midi).toBe(64)
      expect(received.at(-1)).toMatchObject({
        type: 'capture',
        capture: { pitch: { midi: 64 } },
      })
      const last = received.at(-1)
      if (last?.type !== 'capture')
        throw new Error('Expected capture observation')
      expect(last.capture).not.toBe(evidence)
      expect(last.capture.clock).not.toBe(evidence.clock)
      expect(Object.isFrozen(last)).toBe(true)
      expect(Object.isFrozen(last.capture.clock)).toBe(true)
      bus.dispose()
      const length = received.length
      bus.capture(evidence)
      expect(received).toHaveLength(length)
      expect(bus.route()).toBeNull()
      dispose()
    }))
})
