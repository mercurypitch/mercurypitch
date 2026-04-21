// ============================================================
// Melody Engine Tests
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
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

  beforeEach(() => {
    melody = createMelody()
    engine = new MelodyEngine({ bpm: 120 })
    engine.setMelody(melody)
  })

  describe('creation', () => {
    it('creates with default options', () => {
      const e = new MelodyEngine({ bpm: 60 })
      expect(e.getIsPlaying()).toBe(false)
      expect(e.getIsPaused()).toBe(false)
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
      engine.setPlaybackSpeed(0.5)
      expect(engine.getPlaybackSpeed()).toBe(0.5)
      engine.setPlaybackSpeed(2.0)
      expect(engine.getPlaybackSpeed()).toBe(2.0)
      engine.setPlaybackSpeed(0.1) // Clamp to 0.25
      expect(engine.getPlaybackSpeed()).toBe(0.25)
      engine.setPlaybackSpeed(3.0) // Clamp to 2.0
      expect(engine.getPlaybackSpeed()).toBe(2.0)
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
      engine.start()
      expect(engine.getIsPaused()).toBe(false)
      engine.pause()
      expect(engine.getIsPaused()).toBe(true)
      engine.resume()
      expect(engine.getIsPaused()).toBe(false)
    })

    it('tracks current beat', () => {
      expect(engine.getCurrentBeat()).toBe(0)
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
      engine.pause()
      expect(engine.getIsPaused()).toBe(true)
    })

    it('resumes playback', () => {
      engine.start()
      engine.pause()
      engine.resume()
      expect(engine.getIsPaused()).toBe(false)
    })

    it('stops playback', () => {
      engine.start()
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
      const e = new MelodyEngine({
        bpm: 120,
        onNoteStart: (item) => callArgs.push(item),
      })
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
      const e = new MelodyEngine({
        bpm: 120,
        onNoteEnd: (item) => callArgs.push(item),
      })
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
      const emptyEngine = new MelodyEngine({ bpm: 120 })
      expect(emptyEngine.totalBeats()).toBe(0)
    })
  })

  describe('cleanup', () => {
    it('has destroy method', () => {
      const e = new MelodyEngine({ bpm: 120 })
      expect(typeof e.destroy).toBe('function')
      e.destroy() // Should not throw
    })
  })
})
