// ============================================================
// melody-synth & useMelodyAuditionSynth unit tests
// ============================================================

import { createRoot, createSignal } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { createMelodySynth, useMelodyAuditionSynth } from './melody-synth'

describe('useMelodyAuditionSynth', () => {
  it('initializes with melodyAudio false and toggles state', () => {
    createRoot((dispose) => {
      const [playing] = createSignal(false)
      const [elapsed] = createSignal(0)
      const [notes] = createSignal([{ startSec: 1, endSec: 3, midi: 60 }])

      const synth = useMelodyAuditionSynth({
        playing,
        elapsed,
        notes,
      })

      expect(synth.melodyAudio()).toBe(false)
      synth.toggleMelodyAudio()
      expect(synth.melodyAudio()).toBe(true)
      synth.toggleMelodyAudio()
      expect(synth.melodyAudio()).toBe(false)

      dispose()
    })
  })

  it('createMelodySynth handles safe dispose without errors', () => {
    const synth = createMelodySynth()
    expect(() => synth.setNote(60)).not.toThrow()
    expect(() => synth.setNote(null)).not.toThrow()
    expect(() => synth.dispose()).not.toThrow()
  })
})
