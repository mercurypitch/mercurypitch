// ============================================================
// PlaybackRuntime Polyphonic Note Tracking Tests
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlaybackEvent } from '@/lib/playback-runtime'
import { PlaybackRuntime } from '@/lib/playback-runtime'
import type { MelodyItem } from '@/types'

/** Create a minimal MelodyItem for testing. */
function note(
  overrides: Partial<MelodyItem> & {
    id: number
    startBeat: number
    duration: number
  },
): MelodyItem {
  return {
    note: { name: 'C', octave: 4, midi: 60, freq: 261.63 },
    ...overrides,
  }
}

/** Minimal mock of AudioEngine for PlaybackRuntime tests. */
function mockAudioEngine() {
  return {
    getIsInitialized: vi.fn().mockReturnValue(true),
    init: vi.fn().mockResolvedValue(undefined),
    setInstrument: vi.fn(),
    getBPM: vi.fn().mockReturnValue(120),
    getBpm: vi.fn().mockReturnValue(120),
    stopAllNotes: vi.fn(),
    stopTone: vi.fn(),
    destroy: vi.fn(),
  }
}

describe('PlaybackRuntime — Polyphonic Note Tracking', () => {
  let runtime: PlaybackRuntime
  let audio: ReturnType<typeof mockAudioEngine>
  let events: PlaybackEvent[]
  let now: number
  let rafCallbacks: Map<number, () => void>
  let nextRafId: number

  beforeEach(() => {
    vi.restoreAllMocks()
    audio = mockAudioEngine()
    events = []
    now = 0
    rafCallbacks = new Map()
    nextRafId = 1

    // Set up fake timers BEFORE any runtime.start() call
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      const id = nextRafId++
      rafCallbacks.set(id, () => {
        rafCallbacks.delete(id)
        cb(now)
      })
      return id
    })

    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      rafCallbacks.delete(id)
    })

    vi.spyOn(performance, 'now').mockImplementation(() => now)

    runtime = new PlaybackRuntime({
      audioEngine: audio as unknown as PlaybackRuntime['audioEngine'],
      onEvent: (e) => events.push(e),
    })
  })

  /** Advance time by n frames (each ~16ms). */
  function tick(frames: number) {
    for (let i = 0; i < frames; i++) {
      now += 16
      const cbs = [...rafCallbacks.values()]
      for (const cb of cbs) cb()
    }
  }

  it('emits noteStart for all overlapping notes at the same beat (chord)', () => {
    const melody: MelodyItem[] = [
      note({
        id: 0,
        startBeat: 0,
        duration: 2,
        note: { name: 'C', octave: 4, midi: 60, freq: 261.63 },
      }),
      note({
        id: 1,
        startBeat: 0,
        duration: 2,
        note: { name: 'E', octave: 4, midi: 64, freq: 329.63 },
      }),
      note({
        id: 2,
        startBeat: 0,
        duration: 2,
        note: { name: 'G', octave: 4, midi: 67, freq: 392.0 },
      }),
    ]

    runtime.setMelody(melody)
    runtime.setDurationBeats(2)
    runtime.start(0)
    tick(5)

    const noteStarts = events.filter((e) => e.type === 'noteStart')
    expect(noteStarts.length).toBe(3)
    expect(noteStarts.map((e) => e.index).sort()).toEqual([0, 1, 2])
  })

  it('emits noteEnd for all notes when they finish simultaneously', () => {
    const melody: MelodyItem[] = [
      note({
        id: 0,
        startBeat: 0,
        duration: 1,
        note: { name: 'C', octave: 4, midi: 60, freq: 261.63 },
      }),
      note({
        id: 1,
        startBeat: 0,
        duration: 1,
        note: { name: 'E', octave: 4, midi: 64, freq: 329.63 },
      }),
    ]

    runtime.setMelody(melody)
    runtime.setDurationBeats(1)
    runtime.start(0)

    // 120 BPM = 500ms/beat. Notes duration=1 end at 500ms.
    // tick 5 frames (80ms) to confirm noteStarts fired
    tick(5)
    expect(events.filter((e) => e.type === 'noteStart').length).toBe(2)

    // tick 30 more frames (480ms) → total 560ms, past the 500ms boundary
    tick(30)

    const noteEnds = events.filter((e) => e.type === 'noteEnd')
    expect(noteEnds.length).toBe(2)
    expect(noteEnds.map((e) => e.index).sort()).toEqual([0, 1])
  })

  it('handles overlapping notes: one long note with nested short notes', () => {
    const melody: MelodyItem[] = [
      note({
        id: 0,
        startBeat: 0,
        duration: 4,
        note: { name: 'C', octave: 4, midi: 60, freq: 261.63 },
      }),
      note({
        id: 1,
        startBeat: 1,
        duration: 1,
        note: { name: 'E', octave: 4, midi: 64, freq: 329.63 },
      }),
      note({
        id: 2,
        startBeat: 2,
        duration: 1,
        note: { name: 'G', octave: 4, midi: 67, freq: 392.0 },
      }),
    ]

    runtime.setMelody(melody)
    runtime.setDurationBeats(4)
    runtime.start(0)
    tick(5)

    // Only the long C note should have started at beat 0
    const noteStarts = events.filter((e) => e.type === 'noteStart')
    expect(noteStarts.length).toBe(1)
    expect(noteStarts[0].index).toBe(0)
  })

  it('emits noteStart/noteEnd around beat boundaries correctly', () => {
    // Two notes: one spans beats 0-2, another spans beats 1-3
    // 120 BPM = 500ms/beat
    const melody: MelodyItem[] = [
      note({
        id: 0,
        startBeat: 0,
        duration: 2,
        note: { name: 'C', octave: 4, midi: 60, freq: 261.63 },
      }),
      note({
        id: 1,
        startBeat: 1,
        duration: 2,
        note: { name: 'E', octave: 4, midi: 64, freq: 329.63 },
      }),
    ]

    runtime.setMelody(melody)
    runtime.setDurationBeats(3)
    runtime.start(0)

    // Beat ~0.8: only note 0 active (25 * 16ms = 400ms)
    tick(25)
    expect(events.some((e) => e.type === 'noteStart' && e.index === 0)).toBe(
      true,
    )
    expect(events.some((e) => e.type === 'noteStart' && e.index === 1)).toBe(
      false,
    )

    // Beat ~1.8: both notes active (add 32 frames = 512ms, total 57)
    tick(32)
    expect(events.some((e) => e.type === 'noteStart' && e.index === 1)).toBe(
      true,
    )

    // Beat ~2.8: note 0 ended, note 1 still playing (add 32 frames)
    tick(32)
    expect(events.some((e) => e.type === 'noteEnd' && e.index === 0)).toBe(true)

    // Beat ~3.8: note 1 also ended (add 32 frames, total 121)
    tick(32)
    expect(events.some((e) => e.type === 'noteEnd' && e.index === 1)).toBe(true)
  })

  it('does not emit noteStart for rest items', () => {
    const melody: MelodyItem[] = [
      note({
        id: 0,
        startBeat: 0,
        duration: 2,
        note: { name: 'C', octave: 4, midi: 60, freq: 261.63 },
      }),
      {
        id: 1,
        startBeat: 0,
        duration: 2,
        note: { name: 'C', octave: 4, midi: 60, freq: 261.63 },
        isRest: true,
      },
    ]

    runtime.setMelody(melody)
    runtime.setDurationBeats(2)
    runtime.start(0)
    tick(5)

    const noteStarts = events.filter((e) => e.type === 'noteStart')
    expect(noteStarts.length).toBe(1)
    expect(noteStarts[0].index).toBe(0)
  })

  it('stops all notes and clears state on stop()', () => {
    const melody: MelodyItem[] = [
      note({
        id: 0,
        startBeat: 0,
        duration: 4,
        note: { name: 'C', octave: 4, midi: 60, freq: 261.63 },
      }),
      note({
        id: 1,
        startBeat: 0,
        duration: 4,
        note: { name: 'E', octave: 4, midi: 64, freq: 329.63 },
      }),
    ]

    runtime.setMelody(melody)
    runtime.setDurationBeats(4)
    runtime.start(0)
    tick(5)

    expect(events.some((e) => e.type === 'noteStart')).toBe(true)

    runtime.stop()

    expect(audio.stopAllNotes).toHaveBeenCalled()
    expect(runtime.getIsPlaying()).toBe(false)
    expect(runtime.getCurrentNoteIndex()).toBe(-1)
  })

  it('retriggers noteStart on resume after pause', () => {
    // Use a non-zero base time so pause()'s playStartTime > 0 guard passes.
    // In real browsers performance.now() is never 0; the guard exists to
    // skip pause when start() was never called (playStartTime stays 0).
    now = 100
    rafCallbacks.clear()
    nextRafId = 1

    const noteStartSpy = vi.fn()

    runtime = new PlaybackRuntime({
      audioEngine: audio as unknown as PlaybackRuntime['audioEngine'],
      onNoteStart: noteStartSpy,
    })

    const melody: MelodyItem[] = [
      note({
        id: 0,
        startBeat: 0,
        duration: 4,
        note: { name: 'C', octave: 4, midi: 60, freq: 261.63 },
      }),
    ]

    runtime.setMelody(melody)
    runtime.setDurationBeats(4)
    runtime.start(0)
    tick(5)

    expect(noteStartSpy).toHaveBeenCalledTimes(1)

    runtime.pause()
    noteStartSpy.mockClear()

    runtime.resume()
    tick(5)

    expect(noteStartSpy).toHaveBeenCalledTimes(1)
    expect(noteStartSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 0 }),
      0,
    )
  })
})

describe('PlaybackRuntime — frame-gap and transport-state regressions', () => {
  let runtime: PlaybackRuntime
  let audio: ReturnType<typeof mockAudioEngine>
  let events: PlaybackEvent[]
  let now: number
  let rafCallbacks: Map<number, () => void>
  let nextRafId: number

  beforeEach(() => {
    vi.restoreAllMocks()
    audio = mockAudioEngine()
    events = []
    now = 0
    rafCallbacks = new Map()
    nextRafId = 1
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      const id = nextRafId++
      rafCallbacks.set(id, () => {
        rafCallbacks.delete(id)
        cb(now)
      })
      return id
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      rafCallbacks.delete(id)
    })
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    runtime = new PlaybackRuntime({
      audioEngine: audio as unknown as PlaybackRuntime['audioEngine'],
      onEvent: (e) => events.push(e),
    })
  })

  /** Advance wall-clock by ms, then run pending animation frames once. */
  function frame(ms: number) {
    now += ms
    const cbs = [...rafCallbacks.values()]
    for (const cb of cbs) cb()
  }

  const starts = () => events.filter((e) => e.type === 'noteStart')

  /** Eight sixteenths in a row — shorter than a slow frame at 120 BPM. */
  function sixteenths(): MelodyItem[] {
    return Array.from({ length: 8 }, (_, i) =>
      note({ id: i, startBeat: i * 0.25, duration: 0.25 }),
    )
  }

  it('fires every short note even when frames are slower than the notes', () => {
    runtime.setMelody(sixteenths())
    runtime.setDurationBeats(2)
    runtime.start(0)
    // 120 BPM: a sixteenth lasts 125ms. 400ms frames skip whole notes
    // between samples — the back-fill must still fire each exactly once.
    frame(16)
    frame(400)
    frame(400)
    frame(400)

    const fired = starts().map((e) => e.index)
    expect([...new Set(fired)].length).toBe(fired.length) // no duplicates
    expect(fired.sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ])
  })

  it('replays every note after stop -> start (no stale skip state)', () => {
    runtime.setMelody(sixteenths())
    runtime.setDurationBeats(2)
    runtime.start(0)
    for (let i = 0; i < 70; i++) frame(16) // play to completion
    expect(starts().length).toBe(8)

    events.length = 0
    runtime.start(0)
    for (let i = 0; i < 70; i++) frame(16)
    expect(
      starts()
        .map((e) => e.index)
        .sort((a, b) => (a ?? 0) - (b ?? 0)),
    ).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it('start() on a paused runtime resumes instead of dying silently', () => {
    runtime.setMelody([
      note({ id: 0, startBeat: 0, duration: 1 }),
      note({ id: 1, startBeat: 2, duration: 1 }),
    ])
    runtime.setDurationBeats(4)
    runtime.start(0)
    frame(16)
    expect(starts().map((e) => e.index)).toEqual([0])

    runtime.pause()
    expect(runtime.getPlaybackState()).toBe('paused')

    // The dead state: UI calls start() (not resume) on a paused runtime.
    runtime.start(0)
    expect(runtime.getPlaybackState()).toBe('playing')

    // Advance past beat 2 — the second note must sound.
    for (let i = 0; i < 70; i++) frame(16)
    expect(starts().some((e) => e.index === 1)).toBe(true)
  })

  it('seeking forward does not burst-fire the skipped notes', () => {
    runtime.setMelody(
      Array.from({ length: 8 }, (_, i) =>
        note({ id: i, startBeat: i, duration: 0.5 }),
      ),
    )
    runtime.setDurationBeats(8)
    runtime.start(0)
    frame(16) // fires index 0
    runtime.seekTo(6)
    frame(16)
    frame(16)

    const fired = starts().map((e) => e.index)
    expect(fired).toContain(0)
    expect(fired).toContain(6)
    for (const skipped of [1, 2, 3, 4, 5]) {
      expect(fired).not.toContain(skipped)
    }
  })
})
