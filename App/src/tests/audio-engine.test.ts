// ============================================================
// Audio Engine Tests
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'
import { AudioEngine } from '@/lib/audio-engine'

describe('AudioEngine', () => {
  let engine: AudioEngine

  beforeEach(async () => {
    engine = new AudioEngine()
    await engine.init()
  })

  describe('initialization', () => {
    it('creates engine and initializes audio context', async () => {
      const ctx = engine.getAudioContext()
      expect(ctx).not.toBeNull()
    })

    it('returns correct sample rate', () => {
      expect(engine.getSampleRate()).toBe(44100)
    })

    it('can be initialized multiple times without error', async () => {
      await engine.init() // Should be no-op
      await engine.init()
      // No error means success
    })
  })

  describe('volume control', () => {
    it('has default volume of 0.8', () => {
      expect(engine.getVolume()).toBeCloseTo(0.8, 1)
    })

    it('sets volume within valid range', () => {
      engine.setVolume(0.5)
      expect(engine.getVolume()).toBeCloseTo(0.5)

      engine.setVolume(1.0)
      expect(engine.getVolume()).toBe(1.0)

      engine.setVolume(0.0)
      expect(engine.getVolume()).toBe(0.0)
    })

    it('clamps volume to valid range', () => {
      engine.setVolume(-0.5)
      expect(engine.getVolume()).toBe(0)

      engine.setVolume(1.5)
      expect(engine.getVolume()).toBe(1)
    })
  })

  describe('microphone', () => {
    it('reports inactive initially', () => {
      expect(engine.isMicActive()).toBe(false)
    })

    it('can stop mic when not active', () => {
      engine.stopMic() // Should not error
      expect(engine.isMicActive()).toBe(false)
    })

    it('getFrequencyData returns array', () => {
      const data = engine.getFrequencyData()
      expect(data).toBeInstanceOf(Float32Array)
      expect(data.length).toBeGreaterThan(0)
    })

    it('getTimeData returns array', () => {
      const data = engine.getTimeData()
      expect(data).toBeInstanceOf(Float32Array)
      expect(data.length).toBeGreaterThan(0)
    })
  })

  describe('tone generation', () => {
    it('reports not playing initially', () => {
      expect(engine.isTonePlaying()).toBe(false)
    })

    it('can play and stop tone', () => {
      engine.playTone(440, 100)
      // Small delay to allow audio to start
      // In test environment, AudioContext is mocked

      engine.stopTone()
      expect(engine.isTonePlaying()).toBe(false)
    })

    it('can change tone frequency', () => {
      engine.playTone(440, 1000)
      engine.setToneFrequency(880)
      // Should not error

      engine.stopTone()
    })
  })

  describe('note playback', () => {
    it('can play a note', () => {
      engine.playNote(440, 100)
      // Should not error
    })

    it('can play a note with effect', () => {
      engine.playNote(440, 200, 'vibrato')
      // Should not error
    })

    it('can play notes with different effects', () => {
      engine.playNote(440, 100, 'slide-up')
      engine.playNote(523, 100, 'slide-down')
      engine.playNote(659, 100, 'ease-in')
      engine.playNote(784, 100, 'ease-out')
    })
  })

  describe('beep sounds', () => {
    it('can play start beep', () => {
      engine.playBeep('start')
      // Should not error
    })

    it('can play stop beep', () => {
      engine.playBeep('stop')
      // Should not error
    })
  })

  describe('resume', () => {
    it('can resume audio context', async () => {
      await engine.resume()
      // Should not error
    })
  })

  describe('destroy', () => {
    it('cleans up without error', () => {
      engine.destroy()
      // Should not error
    })
  })

  describe('callbacks', () => {
    it('can set onNoteChange callback', () => {
      engine.onNoteChange((_note, _index) => {
        // Callback should be callable
      })
    })

    it('can set onPlaybackEnd callback', () => {
      engine.onPlaybackEnd(() => {
        // Callback should be callable
      })
    })
  })

  // GH #130: Editor playback notes must stop when stopAllNotes() is called
  describe('editor playback (GH #130)', () => {
    it('playNote returns a voice that can be stopped with stopAllNotes', async () => {
      // GH #130: stopAllNotes() must silence all active notes immediately
      await engine.resume()
      const noteId = await engine.playNote(440, 5000)
      expect(noteId).toBeDefined()
      // stopAllNotes should not throw
      engine.stopAllNotes()
    })

    it('stopAllNotes handles empty voices gracefully', () => {
      // GH #130: stopAllNotes must not crash when no notes are playing
      engine.stopAllNotes()
      // No error means success
    })
  })
})

describe('AudioEngine without init', () => {
  it('handles operations before init', () => {
    const engine = new AudioEngine()

    // These should not crash
    engine.playTone(440)
    engine.stopTone()
    engine.setVolume(0.5)

    expect(engine.getVolume()).toBeCloseTo(0.5)
  })
})
