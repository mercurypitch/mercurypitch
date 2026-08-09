// Room-band tests pin the click's beat map, especially when it repeats a span.
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuitarRoomBandBeatPhase } from './guitar-room-band'
import { createGuitarRoomBand, groupNotesByBeat, resolveBandLoop, } from './guitar-room-band'

const guitarVoices = vi.hoisted(() => ({
  createBassVoice: vi.fn(),
  createGuitarVoice: vi.fn(),
}))

vi.mock('@/lib/drum-voices', () => ({ triggerDrumVoice: vi.fn() }))
vi.mock('@/lib/guitar/guitar-synth', () => guitarVoices)

function fakeAudioNode() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}

function fakeAudioParam() {
  return {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  }
}

function fakeAudioContext(
  createdGains: Array<
    ReturnType<typeof fakeAudioNode> & {
      gain: ReturnType<typeof fakeAudioParam>
    }
  > = [],
): AudioContext {
  const startedAtMs = Date.now()
  return {
    get currentTime() {
      return 5 + (Date.now() - startedAtMs) / 1000
    },
    state: 'running',
    destination: fakeAudioNode(),
    createGain: () => {
      const gain = { ...fakeAudioNode(), gain: fakeAudioParam() }
      createdGains.push(gain)
      return gain
    },
    createDynamicsCompressor: () => ({
      ...fakeAudioNode(),
      threshold: fakeAudioParam(),
      knee: fakeAudioParam(),
      ratio: fakeAudioParam(),
      attack: fakeAudioParam(),
      release: fakeAudioParam(),
    }),
    close: vi.fn(async () => undefined),
  } as unknown as AudioContext
}

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('resolveBandLoop', () => {
  it('keeps a loop the exercise actually contains', () => {
    expect(resolveBandLoop({ start: 4, end: 8 }, 16)).toEqual({
      start: 4,
      end: 8,
    })
  })

  it('trims a loop that runs off the end of the exercise', () => {
    expect(resolveBandLoop({ start: 12, end: 40 }, 16)).toEqual({
      start: 12,
      end: 16,
    })
  })

  it('refuses a loop that starts past the exercise', () => {
    expect(resolveBandLoop({ start: 20, end: 24 }, 16)).toBeNull()
  })

  it('refuses a loop shorter than one beat, which the pulse cannot express', () => {
    expect(resolveBandLoop({ start: 4, end: 4.5 }, 16)).toBeNull()
  })

  it('is absent when nothing was asked for', () => {
    expect(resolveBandLoop(null, 16)).toBeNull()
    expect(resolveBandLoop(undefined, 16)).toBeNull()
  })
})

describe('groupNotesByBeat', () => {
  it('buckets a note by the beat it starts in, fraction and all', () => {
    const grouped = groupNotesByBeat([
      { midi: 40, startBeat: 0, durationBeats: 0.5 },
      { midi: 43, startBeat: 0.5, durationBeats: 0.5 },
      { midi: 45, startBeat: 2.75, durationBeats: 0.25 },
    ])
    expect(grouped.get(0)?.map((note) => note.midi)).toEqual([40, 43])
    expect(grouped.get(2)?.map((note) => note.midi)).toEqual([45])
    expect(grouped.get(1)).toBeUndefined()
  })

  it('drops a note with no position rather than sounding it on beat one', () => {
    const grouped = groupNotesByBeat([
      { midi: 40, startBeat: Number.NaN, durationBeats: 1 },
      { midi: 41, startBeat: -2, durationBeats: 1 },
    ])
    expect(grouped.size).toBe(0)
  })
})

describe('createGuitarRoomBand', () => {
  it('keeps 220 BPM and reports the authoritative audio time for each beat', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    const onBeat =
      vi.fn<
        (
          beatIndex: number,
          phase: GuitarRoomBandBeatPhase,
          scheduledAtSeconds?: number,
        ) => void
      >()
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      scheduleAheadSeconds: 2,
    })

    await band.start({
      tempoBpm: 220,
      countInBeats: 0,
      exerciseBeats: 2,
      feel: 'click',
      onBeat,
    })
    await vi.advanceTimersByTimeAsync(450)

    expect(onBeat).toHaveBeenCalledTimes(2)
    const firstAt = onBeat.mock.calls[0]?.[2]
    const secondAt = onBeat.mock.calls[1]?.[2]
    expect(firstAt).toBeCloseTo(5.09, 6)
    expect(secondAt).toBeCloseTo(5.09 + 60 / 220, 6)

    await band.dispose()
  })

  it('schedules every beat through an authored tempo map', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    const onBeat = vi.fn()
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      scheduleAheadSeconds: 4,
    })

    const result = await band.start({
      tempoBpm: 120,
      tempoChanges: [
        { beat: 0, usPerBeat: 500000 },
        { beat: 2, usPerBeat: 1000000 },
      ],
      countInBeats: 0,
      exerciseBeats: 4,
      feel: 'click',
      onBeat,
    })
    await vi.advanceTimersByTimeAsync(3200)

    expect(onBeat.mock.calls.map((call) => call[2])).toEqual([
      5.09, 5.59, 6.09, 7.09,
    ])
    expect(result.expectedHitTimesMs).toEqual([90, 590, 1090, 2090])

    await band.dispose()
  })

  it('starts from a parked authored beat without replaying the score prefix', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    const onBeat = vi.fn()
    const onComplete = vi.fn()
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      scheduleAheadSeconds: 4,
    })

    const result = await band.start({
      tempoBpm: 120,
      tempoChanges: [
        { beat: 0, usPerBeat: 500000 },
        { beat: 2, usPerBeat: 1000000 },
      ],
      countInBeats: 0,
      exerciseBeats: 4,
      durationBeats: 4,
      startBeat: 2,
      feel: 'click',
      onBeat,
      onComplete,
    })
    await vi.advanceTimersByTimeAsync(2_150)

    expect(onBeat.mock.calls.map((call) => call[0])).toEqual([2, 3])
    expect(onBeat.mock.calls.map((call) => call[2])).toEqual([5.09, 6.09])
    expect(result.expectedHitTimesMs).toEqual([90, 1090])
    expect(onComplete).toHaveBeenCalledOnce()

    await band.dispose()
  })

  it('starts between mapped beats without replaying past attacks', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    const onExerciseStart = vi.fn()
    const onBeat = vi.fn()
    const onComplete = vi.fn()
    guitarVoices.createGuitarVoice.mockImplementation(() => ({
      gain: { ...fakeAudioNode(), gain: fakeAudioParam() },
      oscillators: [],
      lfos: [],
      lfoGains: [],
      hasCustomEnvelope: true,
      dispose: vi.fn(),
    }))
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      scheduleAheadSeconds: 4,
    })

    const result = await band.start({
      tempoBpm: 120,
      tempoChanges: [
        { beat: 0, usPerBeat: 500000 },
        { beat: 2, usPerBeat: 1000000 },
      ],
      countInBeats: 0,
      exerciseBeats: 4,
      durationBeats: 4,
      startBeat: 2.4,
      feel: 'click',
      melody: [
        { midi: 63, startBeat: 2.25, durationBeats: 0.25 },
        { midi: 64, startBeat: 2.4, durationBeats: 0.25 },
        { midi: 65, startBeat: 2.75, durationBeats: 0.25 },
        { midi: 67, startBeat: 3, durationBeats: 0.5 },
      ],
      onExerciseStart,
      onBeat,
      onComplete,
    })

    await vi.advanceTimersByTimeAsync(80)
    expect(onExerciseStart).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(20)
    expect(onExerciseStart).toHaveBeenCalledWith(2.4, 5.09)
    expect(result.expectedHitTimesMs).toHaveLength(1)
    expect(result.expectedHitTimesMs[0]).toBeCloseTo(690, 6)
    const voiceStarts = guitarVoices.createGuitarVoice.mock.calls.map(
      (call) => call[4],
    )
    expect(voiceStarts).toHaveLength(3)
    expect(voiceStarts[0]).toBeCloseTo(5.09, 6)
    expect(voiceStarts[1]).toBeCloseTo(5.44, 6)
    expect(voiceStarts[2]).toBeCloseTo(5.69, 6)

    await vi.advanceTimersByTimeAsync(600)
    expect(onBeat).toHaveBeenCalledWith(3, 'exercise', expect.any(Number))
    expect(onBeat.mock.calls[0]?.[2]).toBeCloseTo(5.69, 6)
    expect(onComplete).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(onComplete).toHaveBeenCalledOnce()

    await band.dispose()
  })

  it('repeats mapped beat and note durations through a tempo-changing loop', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    const onBeat = vi.fn()
    guitarVoices.createGuitarVoice.mockImplementation(() => ({
      gain: { ...fakeAudioNode(), gain: fakeAudioParam() },
      oscillators: [],
      lfos: [],
      lfoGains: [],
      hasCustomEnvelope: true,
      dispose: vi.fn(),
    }))
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      scheduleAheadSeconds: 4,
    })

    await band.start({
      tempoBpm: 120,
      tempoChanges: [
        { beat: 0, usPerBeat: 500000 },
        { beat: 2, usPerBeat: 1000000 },
      ],
      countInBeats: 0,
      exerciseBeats: 4,
      loop: { start: 1, end: 3 },
      feel: 'click',
      melody: [
        { midi: 64, startBeat: 1, durationBeats: 1 },
        { midi: 65, startBeat: 2, durationBeats: 1 },
      ],
      onBeat,
    })
    await vi.advanceTimersByTimeAsync(3700)

    expect(onBeat.mock.calls.slice(0, 6).map((call) => call[0])).toEqual([
      0, 1, 2, 1, 2, 1,
    ])
    expect(onBeat.mock.calls.slice(0, 6).map((call) => call[2])).toEqual([
      5.09, 5.59, 6.09, 7.09, 7.59, 8.59,
    ])
    expect(
      guitarVoices.createGuitarVoice.mock.calls
        .slice(0, 4)
        .map((call) => [call[2], call[4]]),
    ).toEqual([
      [500, 5.59],
      [1000, 6.09],
      [500, 7.09],
      [1000, 7.59],
    ])

    await band.dispose()
  })

  it("completes once at the score's exact fractional duration", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const context = fakeAudioContext()
    const onComplete = vi.fn()
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      scheduleAheadSeconds: 4,
    })

    await band.start({
      tempoBpm: 120,
      countInBeats: 0,
      exerciseBeats: 4,
      durationBeats: 3.25,
      feel: 'click',
      onComplete,
    })
    await vi.advanceTimersByTimeAsync(1700)
    expect(onComplete).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(20)
    expect(onComplete).toHaveBeenCalledOnce()

    await band.dispose()
  })

  it('silences already scheduled guide and drum audio when stopped', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const gains: Array<
      ReturnType<typeof fakeAudioNode> & {
        gain: ReturnType<typeof fakeAudioParam>
      }
    > = []
    const context = fakeAudioContext(gains)
    const voiceGain = { ...fakeAudioNode(), gain: fakeAudioParam() }
    guitarVoices.createGuitarVoice.mockReturnValue({
      gain: voiceGain,
      oscillators: [],
      lfos: [],
      lfoGains: [],
      hasCustomEnvelope: true,
      dispose: vi.fn(),
    })
    const band = createGuitarRoomBand({
      contextFactory: () => context,
      activateContext: async () => undefined,
      scheduleAheadSeconds: 2,
    })

    await band.start({
      tempoBpm: 60,
      countInBeats: 0,
      exerciseBeats: 8,
      durationBeats: 8,
      feel: 'click',
      melody: [{ midi: 64, startBeat: 0, durationBeats: 8 }],
    })
    const guideGate = gains.at(-2)
    const drumsGate = gains.at(-1)
    expect(guideGate).toBeDefined()
    expect(drumsGate).toBeDefined()
    expect(voiceGain.connect).toHaveBeenCalledWith(guideGate)

    band.stop()

    expect(guideGate?.gain.setValueAtTime).toHaveBeenCalledWith(0, 5)
    expect(drumsGate?.gain.setValueAtTime).toHaveBeenCalledWith(0, 5)
    expect(guideGate?.disconnect).toHaveBeenCalledOnce()
    expect(drumsGate?.disconnect).toHaveBeenCalledOnce()
    await band.dispose()
  })
})
