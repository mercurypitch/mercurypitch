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
