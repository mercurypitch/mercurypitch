// ============================================================
// Recording note audition contracts — timing, routing, and lifecycle
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGuitarVoice } from './guitar-synth'
import { createRecordingNotePlayer } from './recording-note-player'

vi.mock('./guitar-synth', () => ({ createGuitarVoice: vi.fn() }))

function gainNode() {
  return {
    gain: {
      value: 0,
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}

function setup() {
  const start = Date.now()
  const finalGain = gainNode()
  const destination = gainNode()
  const context = {
    get currentTime() {
      return 10 + (Date.now() - start) / 1000
    },
    state: 'running',
    createGain: vi.fn(() => finalGain),
    resume: vi.fn(() => Promise.resolve()),
    close: vi.fn(),
  }
  const voices: {
    gain: ReturnType<typeof gainNode>
    oscillators: {
      onended: (() => void) | null
      stop: ReturnType<typeof vi.fn>
    }[]
    dispose: ReturnType<typeof vi.fn>
  }[] = []
  vi.mocked(createGuitarVoice).mockImplementation(() => {
    const voice = {
      gain: gainNode(),
      oscillators: [{ onended: null, stop: vi.fn() }],
      dispose: vi.fn(),
    }
    voices.push(voice)
    return voice as unknown as ReturnType<typeof createGuitarVoice>
  })
  return {
    context,
    finalGain,
    destination,
    voices,
    audioGraph: {
      context: context as unknown as AudioContext,
      destination: destination as unknown as AudioNode,
    },
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('recording note player', () => {
  it('releases chord voices independently and resumes only those still held at a seek', async () => {
    const graph = setup()
    const player = createRecordingNotePlayer({
      audioGraph: graph.audioGraph,
      notes: [
        { midi: 40, startSeconds: 0, endSeconds: 3 },
        { midi: 47, startSeconds: 0, endSeconds: 1 },
        { midi: 52, startSeconds: 0, endSeconds: 2 },
      ],
      durationSeconds: 4,
    })
    await player.play()
    expect(graph.voices).toHaveLength(3)
    expect(
      graph.voices.map(
        (voice) => voice.gain.gain.setTargetAtTime.mock.calls[0][1],
      ),
    ).toEqual([13, 11, 12])
    player.pause()
    player.seek(1.5)
    await vi.advanceTimersByTimeAsync(240)
    vi.mocked(createGuitarVoice).mockClear()
    await player.play()
    expect(createGuitarVoice).toHaveBeenCalledTimes(2)
    expect(
      vi.mocked(createGuitarVoice).mock.calls.map((call) => call[2]),
    ).toEqual([1500, 500])
    player.dispose()
  })
  it('opens the voice after uncached synthesis advances the audio clock', async () => {
    const graph = setup()
    const createVoice = vi.mocked(createGuitarVoice).getMockImplementation()!
    vi.mocked(createGuitarVoice).mockImplementation((...args) => {
      // Rendering an uncached pluck is synchronous JS, while the audio thread
      // keeps advancing. Static fake contexts used to conceal this ordering.
      vi.setSystemTime(Date.now() + 20)
      return createVoice(...args)
    })
    const player = createRecordingNotePlayer({
      audioGraph: graph.audioGraph,
      notes: [{ midi: 57, startSeconds: 0, endSeconds: 3 }],
      durationSeconds: 3,
    })
    expect(await player.play()).toBe(true)
    const voice = graph.voices[0]
    const lastFloor = Math.max(
      ...voice.gain.gain.setValueAtTime.mock.calls.map((call) =>
        Number(call[1]),
      ),
    )
    const attackEnd = Number(
      voice.gain.gain.exponentialRampToValueAtTime.mock.calls[0][1],
    )
    expect(attackEnd).toBeGreaterThan(lastFloor)
    expect(attackEnd).toBeCloseTo(graph.context.currentTime + 0.005)
    expect(voice.gain.gain.setTargetAtTime).toHaveBeenCalledWith(0, 13, 0.012)
    player.dispose()
  })

  it('seeks before Play and while paused without allocating audio or changing exact timing', async () => {
    const graph = setup()
    const player = createRecordingNotePlayer({
      audioGraph: graph.audioGraph,
      notes: [{ midi: 69, startSeconds: 1, endSeconds: 4 }],
      durationSeconds: 5,
    })
    player.seek(2.173)
    expect(player.currentTime).toBe(2.173)
    expect(player.playing).toBe(false)
    expect(graph.context.createGain).not.toHaveBeenCalled()
    await player.play()
    expect(createGuitarVoice).toHaveBeenLastCalledWith(
      graph.audioGraph.context,
      440,
      expect.closeTo(1827),
      'electric',
      10,
      'shared',
    )
    player.pause()
    player.seek(3.125)
    expect(player.currentTime).toBe(3.125)
    await vi.advanceTimersByTimeAsync(240)
    expect(graph.context.createGain).toHaveBeenCalledOnce()
    await player.play()
    expect(createGuitarVoice).toHaveBeenLastCalledWith(
      graph.audioGraph.context,
      440,
      875,
      'electric',
      10.24,
      'shared',
    )
    player.dispose()
  })

  it('coalesces live scrubs behind the old output release and stops a pending restart', async () => {
    const graph = setup()
    const player = createRecordingNotePlayer({
      audioGraph: graph.audioGraph,
      notes: [{ midi: 69, startSeconds: 0, endSeconds: 4 }],
      durationSeconds: 5,
    })
    await player.play()
    player.seek(1.1)
    player.seek(2.2)
    player.seek(3.3)
    expect(player.playing).toBe(true)
    expect(player.currentTime).toBe(3.3)
    expect(graph.context.createGain).toHaveBeenCalledOnce()
    expect(graph.voices[0].dispose).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(240)
    expect(graph.context.createGain).toHaveBeenCalledTimes(2)
    expect(graph.voices[0].dispose).toHaveBeenCalledOnce()
    expect(player.currentTime).toBeCloseTo(3.3)
    player.seek(1)
    player.stop()
    await vi.advanceTimersByTimeAsync(240)
    expect(graph.context.createGain).toHaveBeenCalledTimes(2)
    expect(player.currentTime).toBe(0)
    expect(player.playing).toBe(false)
    player.dispose()
  })

  it('clamps valid seeks, ignores non-finite positions, and parks exactly at the end', async () => {
    const graph = setup()
    const onEnded = vi.fn()
    const player = createRecordingNotePlayer({
      audioGraph: graph.audioGraph,
      notes: [{ midi: 69, startSeconds: 0, endSeconds: 2 }],
      durationSeconds: 2,
      onEnded,
    })
    player.seek(-5)
    expect(player.currentTime).toBe(0)
    await player.play()
    player.seek(100)
    expect(player.currentTime).toBe(2)
    expect(player.playing).toBe(false)
    expect(onEnded).toHaveBeenCalledOnce()
    player.seek(NaN)
    player.seek(Infinity)
    expect(player.currentTime).toBe(2)
    await vi.advanceTimersByTimeAsync(240)
    await player.play()
    expect(player.currentTime).toBe(0)
    player.dispose()
  })

  it('stays inert until Play and schedules exact fractional times with bounded lookahead', async () => {
    const graph = setup()
    const player = createRecordingNotePlayer({
      audioGraph: graph.audioGraph,
      notes: [
        { midi: 69, startSeconds: 0.137, endSeconds: 0.56 },
        { midi: 28, startSeconds: 0.037, endSeconds: 0.417 },
        { midi: 72, startSeconds: 8, endSeconds: 9 },
      ],
      durationSeconds: 10,
    })
    expect(graph.context.createGain).not.toHaveBeenCalled()
    expect(createGuitarVoice).not.toHaveBeenCalled()
    expect(player.duration).toBe(10)
    expect(player.currentTime).toBe(0)
    await expect(player.play()).resolves.toBe(true)
    expect(createGuitarVoice).toHaveBeenCalledTimes(1)
    expect(createGuitarVoice).toHaveBeenLastCalledWith(
      graph.audioGraph.context,
      440 * 2 ** ((28 - 69) / 12),
      expect.closeTo(380),
      'electric',
      10.037,
      'shared',
    )
    expect(graph.voices[0].gain.connect).toHaveBeenCalledWith(graph.finalGain)
    expect(graph.finalGain.connect).toHaveBeenCalledWith(graph.destination)
    expect(
      graph.finalGain.gain.exponentialRampToValueAtTime,
    ).toHaveBeenCalledWith(1, 10.09)
    await vi.advanceTimersByTimeAsync(24)
    expect(createGuitarVoice).toHaveBeenCalledTimes(2)
    expect(createGuitarVoice).toHaveBeenLastCalledWith(
      graph.audioGraph.context,
      440,
      expect.closeTo(423),
      'electric',
      10.137,
      'shared',
    )
    expect(player.currentTime).toBeCloseTo(0.024)
    expect(graph.voices[0].gain.gain.setTargetAtTime).toHaveBeenCalledWith(
      0,
      10.417,
      0.012,
    )
    expect(graph.voices[0].oscillators[0].stop).toHaveBeenCalledWith(
      expect.closeTo(10.537),
    )
    player.dispose()
  })

  it('sums clean voices into one processor with the final envelope downstream', async () => {
    const graph = setup()
    const input = gainNode()
    const output = gainNode()
    const processing = {
      input: input as unknown as AudioNode,
      output: output as unknown as AudioNode,
      dispose: vi.fn(),
    }
    const createProcessing = vi.fn(() => processing)
    const player = createRecordingNotePlayer({
      audioGraph: graph.audioGraph,
      createProcessing,
      notes: [40, 45, 52].map((midi) => ({
        midi,
        startSeconds: 0,
        endSeconds: 1,
      })),
      durationSeconds: 1,
    })
    expect(createProcessing).not.toHaveBeenCalled()
    await player.play()
    expect(createProcessing).toHaveBeenCalledExactlyOnceWith(
      graph.audioGraph.context,
    )
    expect(output.connect).toHaveBeenCalledExactlyOnceWith(graph.finalGain)
    for (const voice of graph.voices) {
      expect(voice.gain.connect).toHaveBeenCalledExactlyOnceWith(input)
    }
    player.stop()
    expect(player.playing).toBe(false)
    expect(player.currentTime).toBe(0)
    expect(graph.finalGain.gain.setTargetAtTime).toHaveBeenCalledWith(
      0,
      10,
      0.036,
    )
    expect(processing.dispose).not.toHaveBeenCalled()
    expect(graph.voices[0].dispose).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(239)
    expect(processing.dispose).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(processing.dispose).toHaveBeenCalledOnce()
    expect(graph.voices[0].dispose).toHaveBeenCalledOnce()
    expect(graph.finalGain.disconnect).toHaveBeenCalledOnce()
    expect(graph.context.close).not.toHaveBeenCalled()
    player.dispose()
  })

  it('keeps the paused timeline, waits for the old tail, and restrikes held notes on resume', async () => {
    const graph = setup()
    const player = createRecordingNotePlayer({
      audioGraph: graph.audioGraph,
      notes: [
        { midi: 60, startSeconds: 0, endSeconds: 0.1 },
        { midi: 69, startSeconds: 0.12, endSeconds: 1.12 },
      ],
      durationSeconds: 1.5,
    })
    await player.play()
    await vi.advanceTimersByTimeAsync(300)
    player.pause()
    expect(player.currentTime).toBeCloseTo(0.3)
    const oldCount = graph.voices.length
    const resume = player.play()
    await vi.advanceTimersByTimeAsync(239)
    expect(graph.voices).toHaveLength(oldCount)
    expect(player.currentTime).toBeCloseTo(0.3)
    await vi.advanceTimersByTimeAsync(1)
    await expect(resume).resolves.toBe(true)
    expect(graph.voices).toHaveLength(oldCount + 1)
    expect(createGuitarVoice).toHaveBeenLastCalledWith(
      graph.audioGraph.context,
      440,
      expect.closeTo(820),
      'electric',
      expect.closeTo(10.54),
      'shared',
    )
    expect(player.currentTime).toBeCloseTo(0.3)
    await vi.advanceTimersByTimeAsync(50)
    expect(player.currentTime).toBeCloseTo(0.35)
    player.dispose()
  })

  it('ends once at the take duration and an explicit replay restarts from zero', async () => {
    const graph = setup()
    const onEnded = vi.fn()
    const player = createRecordingNotePlayer({
      audioGraph: graph.audioGraph,
      notes: [{ midi: 69, startSeconds: 0, endSeconds: 100 }],
      durationSeconds: 0.2,
      onEnded,
    })
    await player.play()
    expect(graph.voices[0].gain.gain.setTargetAtTime).toHaveBeenCalledWith(
      0,
      10.2,
      0.012,
    )
    await vi.advanceTimersByTimeAsync(216)
    expect(player.playing).toBe(false)
    expect(player.currentTime).toBe(0.2)
    expect(onEnded).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1000)
    expect(onEnded).toHaveBeenCalledOnce()
    await expect(player.play()).resolves.toBe(true)
    expect(player.currentTime).toBe(0)
    expect(graph.voices).toHaveLength(2)
    player.dispose()
  })

  it('cancels a pending context resume and a pending restart without allocating more graphs', async () => {
    const graph = setup()
    let resumeContext!: () => void
    graph.context.state = 'suspended'
    graph.context.resume.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resumeContext = resolve
        }),
    )
    const player = createRecordingNotePlayer({
      audioGraph: graph.audioGraph,
      notes: [{ midi: 69, startSeconds: 0, endSeconds: 1 }],
      durationSeconds: 1,
    })
    const pending = player.play()
    player.pause()
    graph.context.state = 'running'
    resumeContext()
    await expect(pending).resolves.toBe(false)
    expect(graph.context.createGain).not.toHaveBeenCalled()
    await player.play()
    player.pause()
    const restart = player.play()
    player.stop()
    await vi.advanceTimersByTimeAsync(240)
    await expect(restart).resolves.toBe(false)
    expect(graph.context.createGain).toHaveBeenCalledOnce()
    expect(player.currentTime).toBe(0)
    expect(player.playing).toBe(false)
    player.dispose()
    await expect(player.play()).resolves.toBe(false)
  })

  it('disposes after the audible tail and permanently prevents pending playback', async () => {
    const graph = setup()
    const player = createRecordingNotePlayer({
      audioGraph: graph.audioGraph,
      notes: [{ midi: 69, startSeconds: 0, endSeconds: 5 }],
      durationSeconds: 5,
    })
    await player.play()
    player.dispose()
    expect(graph.voices[0].dispose).not.toHaveBeenCalled()
    expect(player.playing).toBe(false)
    await expect(player.play()).resolves.toBe(false)
    await vi.advanceTimersByTimeAsync(240)
    expect(graph.voices[0].dispose).toHaveBeenCalledOnce()
    expect(graph.context.close).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('ignores malformed pitches/times without restricting audition to guitar fingerings', async () => {
    const graph = setup()
    const notes = [
      { midi: 0, startSeconds: 0, endSeconds: 0.1 },
      { midi: 127, startSeconds: 0, endSeconds: 0.1 },
      ...[-1, 128, NaN, Infinity, 69.5].map((midi) => ({
        midi,
        startSeconds: 0,
        endSeconds: 0.1,
      })),
      ...[-1, Infinity, NaN, 2].map((startSeconds) => ({
        midi: 69,
        startSeconds,
        endSeconds: 3,
      })),
      ...[0, -1, Infinity, NaN].map((endSeconds) => ({
        midi: 69,
        startSeconds: 0,
        endSeconds,
      })),
    ]
    const player = createRecordingNotePlayer({
      audioGraph: graph.audioGraph,
      notes,
      durationSeconds: 1,
    })
    await expect(player.play()).resolves.toBe(true)
    expect(createGuitarVoice).toHaveBeenCalledTimes(2)
    player.dispose()
    const empty = createRecordingNotePlayer({
      audioGraph: graph.audioGraph,
      notes,
      durationSeconds: Infinity,
    })
    expect(empty.duration).toBe(0)
    await expect(empty.play()).resolves.toBe(false)
    empty.dispose()
  })

  it('reports a processor failure instead of silently bypassing the requested sound', async () => {
    const graph = setup()
    const error = new Error('Cabinet failed')
    const onError = vi.fn()
    const player = createRecordingNotePlayer({
      audioGraph: graph.audioGraph,
      notes: [{ midi: 69, startSeconds: 0, endSeconds: 1 }],
      durationSeconds: 1,
      createProcessing: () => {
        throw error
      },
      onError,
    })
    await expect(player.play()).resolves.toBe(false)
    expect(createGuitarVoice).not.toHaveBeenCalled()
    expect(graph.finalGain.disconnect).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledExactlyOnceWith(error)
    expect(player.playing).toBe(false)
    player.dispose()
  })

  it('bounds simultaneous voices and releases them when malformed density exceeds the limit', async () => {
    const graph = setup()
    const onError = vi.fn()
    const player = createRecordingNotePlayer({
      audioGraph: graph.audioGraph,
      notes: Array.from({ length: 1000 }, () => ({
        midi: 69,
        startSeconds: 0,
        endSeconds: 1,
      })),
      durationSeconds: 1,
      onError,
    })
    await expect(player.play()).resolves.toBe(false)
    expect(graph.voices).toHaveLength(32)
    expect(onError).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(240)
    expect(
      graph.voices.every((voice) => voice.dispose.mock.calls.length === 1),
    ).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
    player.dispose()
  })
})
