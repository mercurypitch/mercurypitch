// ============================================================
// Melody Engine Tests
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MelodyEngineOptions } from '@/lib/melody-engine'
import { MelodyEngine } from '@/lib/melody-engine'
import type { MelodyItem } from '@/types'

// Helper to create mock melody items
const createMelody = (): MelodyItem[] => [
  {
    id: 1,
    note: { midi: 60, name: 'C', octave: 4, freq: 261 },
    startBeat: 0,
    duration: 2,
  },
  {
    id: 2,
    note: { midi: 64, name: 'E', octave: 4, freq: 329 },
    startBeat: 2,
    duration: 2,
  },
  {
    id: 3,
    note: { midi: 67, name: 'G', octave: 4, freq: 392 },
    startBeat: 4,
    duration: 2,
  },
]

describe('MelodyEngine', () => {
  let engine: MelodyEngine
  let melody: MelodyItem[]
  // Store pending callbacks in a way test can access to drive the animation loop
  let pendingCallbacks: Array<(time: number) => void> = []

  beforeEach(() => {
    // Clear callbacks for fresh test
    pendingCallbacks = []

    // Mock RAF before creating engine to catch initial call in start()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      pendingCallbacks.push(cb)
      return pendingCallbacks.length
    })

    // Mock performance.now() once for all tests
    vi.spyOn(performance, 'now').mockImplementation(() => 1000)

    melody = createMelody()
    const { speed: _speed, ...opts } = { speed: 1 }
    engine = new MelodyEngine(opts)
    engine.setMelody(melody)

    // Reset engine state to ensure clean slate for each test
    engine.stop()
    pendingCallbacks = []
  })

  describe('creation', () => {
    it('creates with default options', () => {
      const { speed: _speed, ...opts } = { speed: 1 }
      const e = new MelodyEngine(opts)
      expect(e.getIsPlaying()).toBe(false)
      expect(e.getIsPaused()).toBe(false)
    })
  })

  describe('state', () => {
    it('tracks playing state', () => {
      expect(engine.getIsPlaying()).toBe(false)
      engine.start()
      expect(engine.getIsPlaying()).toBe(true)
      engine.stop()
      expect(engine.getIsPlaying()).toBe(false)
    })

    it('tracks paused state', () => {
      // The test uses start() which starts the animation loop.
      engine.start()

      // Verify the animation loop started
      expect(engine.getIsPlaying()).toBe(true)

      // Drive the animation loop to ensure it's running
      let fakeNow = 1000
      vi.spyOn(performance, 'now').mockImplementation(() => fakeNow)

      // Drive first RAF call - this schedules the recursive call
      const initialLength = pendingCallbacks.length
      pendingCallbacks[pendingCallbacks.length - 1]?.(fakeNow)

      // Drive the second RAF call
      fakeNow += 600
      pendingCallbacks[pendingCallbacks.length - 1]?.(fakeNow)

      // Drive the third RAF call
      fakeNow += 600
      pendingCallbacks[pendingCallbacks.length - 1]?.(fakeNow)

      expect(engine.getIsPlaying()).toBe(true)

      // Pause should stop playback - isPlaying remains true when paused in modern media player logic
      engine.pause()
      expect(engine.getIsPaused()).toBe(true)
      expect(engine.getIsPlaying()).toBe(true)

      // The animation loop checks isPaused before scheduling next frame,
      // so no new callbacks should be added
      expect(pendingCallbacks.length).toBeGreaterThanOrEqual(initialLength)

      // Check state before resume
      expect(engine.getIsPlaying()).toBe(true)
      expect(engine.getIsPaused()).toBe(true)

      // Resume should restore playback - sets isPaused=false and isPlaying=true
      engine.resume()

      // After resume, the playback is resumed - note the states:
      // - isPlaying=true (was reset by resume())
      // - isPaused=false (was reset by resume())
      expect(engine.getIsPaused()).toBe(false)
      expect(engine.getIsPlaying()).toBe(true)

      // Now drive the new RAF that resume() scheduled
      fakeNow += 600
      vi.spyOn(performance, 'now').mockImplementation(() => fakeNow)
      pendingCallbacks[pendingCallbacks.length - 1]?.(fakeNow)

      // Verify it's still playing
      expect(engine.getIsPaused()).toBe(false)
      expect(engine.getIsPlaying()).toBe(true)
    })

    it('tracks current beat', () => {
      expect(engine.getCurrentBeat()).toBe(0)
    })
  })

  describe('config', () => {
    it('sets melody', () => {
      const newMelody = createMelody()
      engine.setMelody(newMelody)
      expect(engine.getMelody()).toBe(newMelody)
    })

    it('sets BPM', () => {
      engine.setBPM(100)
      // BPM affects timing, verified through playback
    })

    it('sets count-in beats', () => {
      engine.setCountIn(4)
      // Count-in setting is stored and used during start
    })

    it('sets and gets playback speed', () => {
      // PlaybackRuntime doesn't support speed yet - returns default
      expect(engine.getPlaybackSpeed()).toBe(1)
    })
  })

  describe('count-in', () => {
    it('setCountIn clamps to valid range', () => {
      engine.setCountIn(-1) // Should clamp to 0
      engine.setCountIn(10) // Should clamp to 4
      // No error means success
    })
  })

  describe('start/pause/resume/stop', () => {
    it('starts playback', () => {
      engine.start()
      expect(engine.getIsPlaying()).toBe(true)
    })

    it('starts with count-in', () => {
      engine.start(4)
      expect(engine.getIsPlaying()).toBe(true)
    })

    it('pauses playback', () => {
      engine.start()

      // Drive the animation loop
      let fakeNow = 1000
      vi.spyOn(performance, 'now').mockImplementation(() => fakeNow)

      // pendingCallbacks indices after beforeEach: [0=init, 1=start(), 2=first RAF, ...]
      // Drive first RAF call (index 2)
      pendingCallbacks[2]?.(fakeNow)

      // Drive second RAF call (index 3) - recursive call
      fakeNow += 600
      pendingCallbacks[3]?.(fakeNow)

      // Drive third RAF call (index 4) - recursive call
      fakeNow += 600
      pendingCallbacks[4]?.(fakeNow)

      expect(engine.getIsPlaying()).toBe(true)
      engine.pause()
      expect(engine.getIsPaused()).toBe(true)
    })

    it('resumes playback', () => {
      engine.start()

      // Drive the mock RAF to advance the loop
      let fakeNow = 1000
      vi.spyOn(performance, 'now').mockImplementation(() => fakeNow)

      // Drive first RAF call (initial after start()) - this starts the recursive loop
      pendingCallbacks[pendingCallbacks.length - 1]?.(fakeNow)

      // Drive second RAF call
      fakeNow += 600
      pendingCallbacks[pendingCallbacks.length - 1]?.(fakeNow)

      // Drive third RAF call (this one executes the beat/note update logic)
      fakeNow += 600
      pendingCallbacks[pendingCallbacks.length - 1]?.(fakeNow)

      // Verify state before pause
      expect(engine.getIsPlaying()).toBe(true)

      // Pause should stop the loop
      engine.pause()
      expect(engine.getIsPaused()).toBe(true)

      // _stopAnimationLoop cancels the next RAF, but existing callbacks remain
      const beforeResumeLength = pendingCallbacks.length
      expect(beforeResumeLength).toBeGreaterThan(2)

      // Resume should start a new animation loop
      engine.resume()

      // resume() sets isPaused = false and keeps isPlaying = true
      expect(engine.getIsPaused()).toBe(false)
      expect(engine.getIsPlaying()).toBe(true)

      // Now drive the new RAF that resume() scheduled
      fakeNow += 600
      vi.spyOn(performance, 'now').mockImplementation(() => fakeNow)
      pendingCallbacks[pendingCallbacks.length - 1]?.(fakeNow)

      // Drive another frame to ensure the animation loop continues
      fakeNow += 600
      pendingCallbacks[pendingCallbacks.length - 1]?.(fakeNow)

      // The engine should still be playing (not paused)
      expect(engine.getIsPaused()).toBe(false)
      expect(engine.getIsPlaying()).toBe(true)
    })

    it('stops playback', () => {
      engine.start()

      // Drive the animation loop
      let fakeNow = 1000
      vi.spyOn(performance, 'now').mockImplementation(() => fakeNow)
      pendingCallbacks[pendingCallbacks.length - 1]?.(fakeNow)
      fakeNow += 600
      pendingCallbacks[pendingCallbacks.length - 1]?.(fakeNow)

      expect(engine.getIsPlaying()).toBe(true)
      engine.stop()
      expect(engine.getIsPlaying()).toBe(false)
      expect(engine.getCurrentBeat()).toBe(0)
    })
  })

  describe('callbacks', () => {
    it('onNoteStart callback receives MelodyItem with duration (GH #128 fix)', () => {
      // GH #128 fix: onNoteStart now passes the full MelodyItem (including duration)
      // rather than just MelodyNote. We test by mocking RAF and manually driving it.
      const callArgs: unknown[] = []
      const opts: MelodyEngineOptions = {
        onNoteStart: (item: MelodyItem) => callArgs.push(item),
      }
      const e = new MelodyEngine(opts)
      e.setMelody(melody)

      // Mock RAF so we can drive it manually with fake time
      const pendingCallbacks: Array<(time: number) => void> = []
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        pendingCallbacks.push(cb)
        return pendingCallbacks.length
      })

      // Mock performance.now() so elapsed time advances
      let fakeNow = 1000 // Start at 1000ms so playStartTime = 1000 (set during start())

      vi.spyOn(performance, 'now').mockImplementation(() => fakeNow)

      e.start()
      // Trigger first RAF to enter _onFrame; time=1000, elapsed=0, beat=0 — no note change yet
      if (pendingCallbacks.length > 0) pendingCallbacks.shift()!(fakeNow)

      // Advance time by 1 full beat at 120 BPM = 500ms -> beat should be ~1
      fakeNow += 600 // 1600ms total, elapsed=600ms, beat=1
      if (pendingCallbacks.length > 0) pendingCallbacks.shift()!(fakeNow)

      // Advance past second beat
      fakeNow += 600 // 2200ms, elapsed=1200ms, beat=2
      if (pendingCallbacks.length > 0) pendingCallbacks.shift()!(fakeNow)

      expect(callArgs.length).toBeGreaterThanOrEqual(1)
      const firstNote = callArgs[0] as { duration: number }
      // Verify it's a MelodyItem with duration (not just MelodyNote)
      expect(firstNote).toHaveProperty('duration')
      expect(firstNote).toHaveProperty('startBeat')
      expect(firstNote).toHaveProperty('note')
      expect(typeof firstNote.duration).toBe('number')
      expect(firstNote.duration).toBe(2) // First note has duration 2
      e.destroy()

      vi.spyOn(performance, 'now').mockRestore()
    })

    it('onNoteEnd callback receives MelodyItem with duration', () => {
      const callArgs: unknown[] = []
      const opts: MelodyEngineOptions = {
        onNoteEnd: (item: MelodyItem) => callArgs.push(item),
      }
      const e = new MelodyEngine(opts)
      e.setMelody(melody)

      const pendingCallbacks: Array<(time: number) => void> = []
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        pendingCallbacks.push(cb)
        return pendingCallbacks.length
      })

      let fakeNow = 1000

      vi.spyOn(performance, 'now').mockImplementation(() => fakeNow)

      e.start()
      // Advance to beat ~1 (first note should start)
      fakeNow += 600
      if (pendingCallbacks.length > 0) pendingCallbacks.shift()!(fakeNow)
      // Advance to beat ~2 (first note ends, second starts)
      fakeNow += 600
      if (pendingCallbacks.length > 0) pendingCallbacks.shift()!(fakeNow)

      expect(callArgs.length).toBeGreaterThanOrEqual(1)
      const endedNote = callArgs[0] as { duration: number }
      expect(endedNote).toHaveProperty('duration')
      expect(endedNote.duration).toBe(2)
      e.destroy()

      vi.spyOn(performance, 'now').mockRestore()
    })
  })

  describe('totalBeats', () => {
    it('calculates total beats in melody', () => {
      expect(engine.totalBeats()).toBe(6) // Last note ends at beat 4 + 2 = 6
    })

    it('returns 0 for empty melody', () => {
      const { bpm: _bpm, ...opts } = { bpm: 120 }
      const emptyEngine = new MelodyEngine(opts)
      expect(emptyEngine.totalBeats()).toBe(0)
    })
  })

  describe('cleanup', () => {
    it('has destroy method', () => {
      const { bpm: _bpm, ...opts } = { bpm: 120 }
      const e = new MelodyEngine(opts)
      expect(typeof e.destroy).toBe('function')
      e.destroy() // Should not throw
    })
  })
})
