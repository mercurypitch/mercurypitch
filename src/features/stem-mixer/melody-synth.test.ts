// ============================================================
// melody-synth & useMelodyAuditionSynth unit tests
// ============================================================

import { createRoot, createSignal } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { createMelodySynth, useMelodyAuditionSynth } from './melody-synth'

describe('useMelodyAuditionSynth', () => {
  it('initializes with melodyAudio false and toggles state and tracks active notes during playback', async () => {
    await new Promise<void>((resolve) => {
      createRoot(async (dispose) => {
        const [playing, setPlaying] = createSignal(false)
        const [elapsed, setElapsed] = createSignal(0)
        const [notes] = createSignal([
          { startSec: 1, endSec: 3, midi: 60 },
          { startSec: 4, endSec: 6, midi: 64 },
        ])

        const synth = useMelodyAuditionSynth({
          playing,
          elapsed,
          notes,
        })

        expect(synth.melodyAudio()).toBe(false)
        synth.toggleMelodyAudio()
        expect(synth.melodyAudio()).toBe(true)

        // Start playing
        setPlaying(true)
        await Promise.resolve()
        setElapsed(0.5) // before first note
        await Promise.resolve()
        setElapsed(2.0) // inside first note (MIDI 60)
        await Promise.resolve()
        setElapsed(3.5) // gap between notes
        await Promise.resolve()
        setElapsed(5.0) // inside second note (MIDI 64)
        await Promise.resolve()

        // Pause playback
        setPlaying(false)
        await Promise.resolve()

        // Disable melody audio
        synth.toggleMelodyAudio()
        expect(synth.melodyAudio()).toBe(false)

        dispose()
        resolve()
      })
    })
  })

  it('createMelodySynth handles resume, note setting, pitch glide, and safe dispose without errors', () => {
    const synth = createMelodySynth()
    expect(() => synth.resume()).not.toThrow()
    expect(() => synth.setNote(60)).not.toThrow()
    expect(() => synth.setNote(64)).not.toThrow() // glide to new pitch
    expect(() => synth.setNote(null)).not.toThrow() // fadeout
    expect(() => synth.dispose()).not.toThrow()
  })
})
