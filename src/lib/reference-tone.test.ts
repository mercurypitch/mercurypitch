// ============================================================
// Reference tone — stopping a note that is still sounding
// ============================================================
//
// The onboarding's sound lane stops a reference note the moment another
// sound starts or a take is about to record. The stop has to follow the
// house release (.claude/memory/audio-pop-free-playback.md): anchor the
// gain, decay with setTargetAtTime, and stop the oscillator only after the
// tail. A cut at full level is a pop on a PA.

import { describe, expect, it, vi } from 'vitest'
import { startReferenceTone } from './reference-tone'

interface FakeParam {
  value: number
  setValueAtTime: ReturnType<typeof vi.fn>
  linearRampToValueAtTime: ReturnType<typeof vi.fn>
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn>
  setTargetAtTime: ReturnType<typeof vi.fn>
  cancelScheduledValues: ReturnType<typeof vi.fn>
}

const fakeParam = (value = 0): FakeParam => ({
  value,
  setValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
  setTargetAtTime: vi.fn(),
  cancelScheduledValues: vi.fn(),
})

function fakeContext() {
  const gains: Array<{ gain: FakeParam }> = []
  const oscillators: Array<{
    stop: ReturnType<typeof vi.fn>
    onended: (() => void) | null
  }> = []
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() })
  const ctx = {
    currentTime: 10,
    state: 'running',
    destination: node(),
    resume: vi.fn(async () => {}),
    createGain: vi.fn(() => {
      const g = { ...node(), gain: fakeParam(0.25) }
      gains.push(g)
      return g
    }),
    createOscillator: vi.fn(() => {
      const o = {
        ...node(),
        frequency: fakeParam(),
        setPeriodicWave: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as (() => void) | null,
      }
      oscillators.push(o)
      return o
    }),
    createBiquadFilter: vi.fn(() => ({
      ...node(),
      frequency: fakeParam(),
      Q: fakeParam(),
      type: 'lowpass',
    })),
    createPeriodicWave: vi.fn(() => ({})),
  }
  return { ctx, gains, oscillators }
}

describe('startReferenceTone', () => {
  it('releases a stopped note with the house decay and stops it after the tail', () => {
    // Arrange
    const { ctx, gains, oscillators } = fakeContext()
    const tone = startReferenceTone(ctx as unknown as AudioContext, 57, 3)
    ctx.currentTime = 11

    // Act
    tone.stop()

    // Assert: anchored where it is, decaying with a 36 ms time constant
    // (a 180 ms release), and the oscillator outlives the decay.
    const gain = gains[0]!.gain
    expect(gain.cancelScheduledValues).toHaveBeenLastCalledWith(11)
    expect(gain.setTargetAtTime).toHaveBeenCalledWith(0, 11, 0.036)
    expect(gain.linearRampToValueAtTime).not.toHaveBeenCalledWith(
      0,
      expect.anything(),
    )
    const lastStop = oscillators[0]!.stop.mock.calls.at(-1)?.[0] as number
    expect(lastStop).toBeCloseTo(11 + 0.18 + 0.06, 5)
  })

  it('reports its end when it is stopped early', async () => {
    // Arrange
    const { ctx } = fakeContext()
    const tone = startReferenceTone(ctx as unknown as AudioContext, 57, 3)
    const ended = vi.fn()
    void tone.done.then(ended)

    // Act
    tone.stop()
    await Promise.resolve()

    // Assert
    expect(ended).toHaveBeenCalledOnce()
  })

  it('reports its end when the note runs out by itself', async () => {
    // Arrange
    const { ctx, oscillators } = fakeContext()
    const tone = startReferenceTone(ctx as unknown as AudioContext, 57, 1)
    const ended = vi.fn()
    void tone.done.then(ended)

    // Act
    oscillators[0]!.onended?.()
    await Promise.resolve()

    // Assert
    expect(ended).toHaveBeenCalledOnce()
  })
})
