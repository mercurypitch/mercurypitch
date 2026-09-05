import { describe, expect, it, vi } from 'vitest'
import { createStrummer } from './guitar-chords'

const voices: Array<{
  kind: 'guitar' | 'bass'
  freq: number
  startAt: number | undefined
  gain: {
    gain: {
      setValueAtTime: ReturnType<typeof vi.fn>
      linearRampToValueAtTime: ReturnType<typeof vi.fn>
    }
    connect: ReturnType<typeof vi.fn>
  }
  dispose: ReturnType<typeof vi.fn>
}> = []

vi.mock('@/lib/guitar/guitar-synth', () => ({
  createGuitarVoice: vi.fn(
    (
      _ctx: unknown,
      freq: number,
      _ms: number,
      _variant: string,
      startAt?: number,
    ) => {
      const voice = {
        kind: 'guitar' as const,
        freq,
        startAt,
        gain: {
          gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
        },
        dispose: vi.fn(),
      }
      voices.push(voice)
      return voice
    },
  ),
  createBassVoice: vi.fn(
    (_ctx: unknown, freq: number, _ms: number, startAt?: number) => {
      const voice = {
        kind: 'bass' as const,
        freq,
        startAt,
        gain: {
          gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
        },
        dispose: vi.fn(),
      }
      voices.push(voice)
      return voice
    },
  ),
}))

function fakeContext() {
  const master = {
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
      setTargetAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
  return {
    ctx: {
      currentTime: 2,
      destination: {},
      createGain: vi.fn(() => master),
    } as unknown as AudioContext,
    master,
  }
}

describe('guitar-chords', () => {
  it('strums a chord low string first on the clock, the lowest note on the bass voice, through one master gain', () => {
    vi.useFakeTimers()
    voices.length = 0
    const { ctx, master } = fakeContext()
    const strummer = createStrummer(ctx, 0.5)
    expect(master.gain.setValueAtTime).toHaveBeenCalledWith(0.5, 2)
    expect(master.connect).toHaveBeenCalledWith(ctx.destination)

    strummer.strum([36, 60, 64, 67], 3, 0.9)
    expect(voices.map((v) => v.kind)).toEqual([
      'bass',
      'guitar',
      'guitar',
      'guitar',
    ])
    expect(voices[0].startAt).toBeCloseTo(3)
    expect(voices[1].startAt).toBeCloseTo(3.018)
    expect(voices[3].startAt).toBeCloseTo(3.054)
    expect(voices[1].freq).toBeCloseTo(261.63, 1)
    for (const voice of voices) {
      expect(voice.gain.connect).toHaveBeenCalledWith(master)
      expect(voice.gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        0.0001,
        expect.closeTo((voice.startAt ?? 0) + 0.9 + 0.09, 3),
      )
    }
    // Each voice is disposed once its release has passed.
    vi.advanceTimersByTime(3000)
    for (const voice of voices) expect(voice.dispose).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('cancel silences the master, disposes every voice and strums nothing more', () => {
    vi.useFakeTimers()
    voices.length = 0
    const { ctx, master } = fakeContext()
    const strummer = createStrummer(ctx, 1)
    strummer.strum([60, 64], 3, 1)
    strummer.cancel()
    strummer.cancel()
    expect(master.gain.cancelScheduledValues).toHaveBeenCalledTimes(1)
    // Anchor, then decay: a step to zero was a click on every Stop. The
    // graph comes down once the tail is inaudible.
    expect(master.gain.setValueAtTime).toHaveBeenLastCalledWith(
      master.gain.value,
      2,
    )
    expect(master.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 2, 0.012)
    expect(master.disconnect).not.toHaveBeenCalled()
    vi.advanceTimersByTime(80)
    expect(master.disconnect).toHaveBeenCalledTimes(1)
    for (const voice of voices) expect(voice.dispose).toHaveBeenCalledTimes(1)
    strummer.strum([60], 4, 1)
    expect(voices).toHaveLength(2)
    vi.advanceTimersByTime(5000)
    for (const voice of voices) expect(voice.dispose).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
