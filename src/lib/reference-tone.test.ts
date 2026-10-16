// ============================================================
// Reference tone — stopping a note that is still sounding
// ============================================================
//
// The onboarding's sound lane stops a reference note the moment another
// sound starts or a take is about to record. The stop has to follow the
// house release (.claude/memory/audio-pop-free-playback.md): anchor the
// gain, decay with setTargetAtTime, and stop the oscillator only after the
// tail. A cut at full level is a pop on a PA.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { lowNoteOctaveLevel, normalizedFundamental, } from './low-note-reinforcement'
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
  const gains: Array<{
    gain: FakeParam
    connect: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
  }> = []
  const oscillators: Array<{
    type?: string
    frequency: FakeParam
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
    connect: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
    onended: (() => void) | null
  }> = []
  const filters: Array<{ disconnect: ReturnType<typeof vi.fn> }> = []
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
    createBiquadFilter: vi.fn(() => {
      const f = {
        ...node(),
        frequency: fakeParam(),
        Q: fakeParam(),
        type: 'lowpass',
      }
      filters.push(f)
      return f
    }),
    createPeriodicWave: vi.fn(() => ({})),
  }
  return { ctx, gains, oscillators, filters }
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

  describe('on a clock that never moves', () => {
    // An iOS context left 'interrupted' or 'suspended' freezes currentTime.
    // A note scheduled on it has not sounded yet; it will when the clock
    // resumes. Its wall-clock fallback reports the end, and that must not
    // leave the note armed: two notes would start together on resume, or a
    // stale note would ring into a take (review of PR 977).
    afterEach(() => vi.useRealTimers())

    it('cancels the unplayed note when the wall-clock fallback runs out', async () => {
      // Arrange
      vi.useFakeTimers()
      const { ctx, oscillators } = fakeContext()
      ctx.state = 'interrupted'
      const tone = startReferenceTone(ctx as unknown as AudioContext, 57, 1)
      const ended = vi.fn()
      void tone.done.then(ended)

      // Act
      await vi.advanceTimersByTimeAsync(1500)

      // Assert: stopped at or before its own start, so it never plays.
      expect(ended).toHaveBeenCalledOnce()
      const stops = oscillators[0]!.stop.mock.calls.map(([at]) => at as number)
      expect(stops).toHaveLength(2)
      expect(stops.at(-1)).toBeLessThanOrEqual(10)
    })

    it('leaves a note cancelled by its fallback cancelled when stopped again', async () => {
      // Arrange
      vi.useFakeTimers()
      const { ctx, oscillators } = fakeContext()
      ctx.state = 'suspended'
      const tone = startReferenceTone(ctx as unknown as AudioContext, 57, 1)
      await vi.advanceTimersByTimeAsync(1500)
      const stopsBefore = oscillators[0]!.stop.mock.calls.length

      // Act
      tone.stop()

      // Assert: the fallback already cancelled it, and a later stop does
      // not schedule the note again.
      expect(stopsBefore).toBe(2)
      expect(oscillators[0]!.stop).toHaveBeenCalledTimes(2)
    })

    it('never anchors the release on a level the frozen clock never rendered', () => {
      // Arrange: an unrendered gain reads its default, louder than the
      // note's peak. Anchoring there would be a click on resume.
      const { ctx, gains } = fakeContext()
      ctx.state = 'suspended'
      const tone = startReferenceTone(ctx as unknown as AudioContext, 57, 3)
      gains[0]!.gain.value = 1

      // Act
      tone.stop()

      // Assert
      const anchors = gains[0]!.gain.setValueAtTime.mock.calls
        .slice(-1)
        .map(([level]) => level as number)
      expect(anchors[0]).toBe(0)
      expect(gains[0]!.gain.setTargetAtTime).not.toHaveBeenCalled()
    })
  })
})

describe('startReferenceTone, asked to carry a low note', () => {
  // The premium rooms ask for the classic engine's help on a small speaker:
  // below C3 a sine an octave up fades in, at the engine's level relative to
  // the note's fundamental, under the note's own filter and envelope.
  const PIANO_PARTIALS = [0, 1, 0.55, 0.32, 0.2, 0.12, 0.07, 0.04]
  const D2 = 38
  const D2_HZ = 440 * 2 ** ((D2 - 69) / 12)

  it("adds a sine an octave up under the note, at the engine's level", () => {
    // Arrange
    const { ctx, gains, oscillators, filters } = fakeContext()

    // Act
    startReferenceTone(ctx as unknown as AudioContext, D2, 1.1, undefined, {
      lowNoteOctave: true,
    })

    // Assert
    expect(oscillators).toHaveLength(2)
    const [note, octave] = oscillators
    expect(octave!.type).toBe('sine')
    expect(octave!.frequency.value).toBeCloseTo(D2_HZ * 2, 6)
    const level = gains.find((g) =>
      octave!.connect.mock.calls.some(([to]) => to === g),
    )
    expect(level).toBeDefined()
    expect(level!.gain.value).toBeCloseTo(
      lowNoteOctaveLevel(D2_HZ) * normalizedFundamental(PIANO_PARTIALS),
      9,
    )
    // Through the note's own filter, so its envelope shapes both.
    expect(level!.connect).toHaveBeenCalledWith(filters[0])
    expect(note!.connect).toHaveBeenCalledWith(filters[0])
    // Starts and ends with the note.
    expect(octave!.start).toHaveBeenCalledWith(10)
    expect(octave!.stop.mock.calls).toEqual(note!.stop.mock.calls)
  })

  it('stops with the note when the note is stopped early', () => {
    // Arrange
    const { ctx, oscillators } = fakeContext()
    const tone = startReferenceTone(
      ctx as unknown as AudioContext,
      D2,
      3,
      undefined,
      { lowNoteOctave: true },
    )
    ctx.currentTime = 11

    // Act
    tone.stop()

    // Assert
    const [note, octave] = oscillators
    expect(octave!.stop.mock.calls).toEqual(note!.stop.mock.calls)
  })

  it('leaves nothing connected once the note has ended', () => {
    // Arrange
    const { ctx, gains, oscillators } = fakeContext()
    startReferenceTone(ctx as unknown as AudioContext, D2, 1.1, undefined, {
      lowNoteOctave: true,
    })

    // Act
    oscillators[0]!.onended?.()

    // Assert
    for (const osc of oscillators) expect(osc.disconnect).toHaveBeenCalled()
    for (const gain of gains) expect(gain.disconnect).toHaveBeenCalled()
  })

  it('adds nothing at C3 and above, or when not asked', () => {
    const at = (midi: number, lowNoteOctave?: boolean): number => {
      const { ctx, oscillators } = fakeContext()
      startReferenceTone(ctx as unknown as AudioContext, midi, 1.1, undefined, {
        lowNoteOctave,
      })
      return oscillators.length
    }
    expect(at(48, true)).toBe(1)
    expect(at(60, true)).toBe(1)
    expect(at(D2, false)).toBe(1)
    expect(at(D2)).toBe(1)
  })
})
