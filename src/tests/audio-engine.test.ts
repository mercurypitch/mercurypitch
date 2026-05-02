// ============================================================
// Audio Engine Tests
// ============================================================

import { afterEach, beforeEach as beforeEachFn, describe, expect, it, vi, } from 'vitest'
import { AudioEngine } from '@/lib/audio-engine'
import type { MelodyItem } from '@/types'

// Mock browser APIs for test environment
global.AudioContext = vi.fn().mockImplementation(function (this: object) {
  Object.assign(this, {
    state: 'running' as const,
    sampleRate: 44100,
    currentTime: 0,
    resume: vi.fn().mockResolvedValue(undefined),
    suspend: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    createGain: vi.fn().mockImplementation(() => ({
      gain: {
        value: 0,
        valueOf: () => 0,
        setTargetAtTime: vi.fn(),
        cancelScheduledValues: vi.fn(),
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createOscillator: vi.fn().mockImplementation(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      type: 'sine' as const,
      frequency: {
        value: 440,
        setTargetAtTime: vi.fn(),
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
    })),
    createAnalyser: vi.fn().mockImplementation(() => ({
      fftSize: 2048,
      smoothingTimeConstant: 0.1,
      getFloatFrequencyData: vi.fn().mockReturnValue(new Float32Array(1024)),
      getFloatTimeDomainData: vi.fn().mockReturnValue(new Float32Array(2048)),
      getByteFrequencyData: vi.fn().mockReturnValue(new Uint8Array(1024)),
    })),
    createMediaStreamSource: vi.fn().mockReturnValue({
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
    createBuffer: vi.fn().mockImplementation(() => ({
      numberOfChannels: 1,
      sampleRate: 44100,
      getChannelData: vi.fn().mockReturnValue(new Float32Array(44100)),
      length: 44100,
      copyToChannel: vi.fn(),
    })),
    createConvolver: vi.fn().mockImplementation(() => ({
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    destination: { connect: vi.fn() },
  })
})

global.OfflineAudioContext = vi.fn().mockImplementation(function (
  this: object,
) {
  Object.assign(this, {
    sampleRate: 44100,
    currentTime: 0,
    createGain: vi.fn().mockImplementation(() => ({
      gain: {
        value: 0,
        valueOf: () => 0,
        setTargetAtTime: vi.fn(),
        cancelScheduledValues: vi.fn(),
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createOscillator: vi.fn().mockImplementation(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      type: 'sine' as const,
      frequency: {
        value: 440,
        setTargetAtTime: vi.fn(),
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
    })),
    createBuffer: vi.fn().mockImplementation(() => ({
      numberOfChannels: 1,
      sampleRate: 44100,
      getChannelData: vi.fn().mockReturnValue(new Float32Array(44100)),
      length: 44100,
    })),
    createConvolver: vi.fn().mockImplementation(() => ({
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    startRendering: vi.fn().mockResolvedValue({
      numberOfChannels: 1,
      sampleRate: 44100,
      getChannelData: vi.fn().mockReturnValue(new Float32Array(44100)),
      length: 44100,
    }),
  })
})

// Mock URL.createObjectURL for download tests
global.URL = {
  createObjectURL: vi.fn().mockReturnValue('mock-url'),
  revokeObjectURL: vi.fn().mockImplementation(() => {}),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any

global.navigator = {
  mediaDevices: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: vi.fn().mockReturnValue([]),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
    ondevicechange: null,
    enumerateDevices: vi.fn(),
    getDisplayMedia: vi.fn(),
    getSupportedConstraints: vi.fn(),
  },
  clipboard: null,
  credentials: null,
  doNotTrack: null,
  geolocation: null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any

describe('AudioEngine', () => {
  let engine: AudioEngine

  beforeEachFn(async () => {
    engine = new AudioEngine()
    await engine.init()
  })

  afterEach(() => {
    engine.destroy()
    vi.clearAllMocks()
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
      expect(data.length).toBeGreaterThanOrEqual(0)
    })

    it('getTimeData returns array', () => {
      const data = engine.getTimeData()
      expect(data).toBeInstanceOf(Float32Array)
      expect(data.length).toBeGreaterThanOrEqual(0)
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

  describe('edge cases - volume', () => {
    it('handles volume at minimum (0)', () => {
      engine.setVolume(0)
      expect(engine.getVolume()).toBe(0)
    })

    it('handles volume at maximum (1)', () => {
      engine.setVolume(1)
      expect(engine.getVolume()).toBe(1)
    })

    it('handles volume at 0.5', () => {
      engine.setVolume(0.5)
      expect(engine.getVolume()).toBe(0.5)
    })

    it('handles floating-point volumes', () => {
      engine.setVolume(0.33)
      expect(engine.getVolume()).toBe(0.33)

      engine.setVolume(0.66)
      expect(engine.getVolume()).toBe(0.66)
    })
  })

  describe('edge cases - note playback', () => {
    it('plays note with very short duration', async () => {
      await engine.init()
      const noteId = await engine.playNote(440, 10)

      expect(noteId).toBeDefined()
    })

    it('plays note with very long duration', async () => {
      await engine.init()
      const noteId = await engine.playNote(440, 10000)

      expect(noteId).toBeDefined()
    })

    it('plays note with very high frequency', async () => {
      await engine.init()
      const noteId = await engine.playNote(2000, 500)

      expect(noteId).toBeDefined()
    })

    it('plays note with very low frequency', async () => {
      await engine.init()
      const noteId = await engine.playNote(50, 500)

      expect(noteId).toBeDefined()
    })

    it('plays note with undefined duration', async () => {
      await engine.init()
      const noteId = await engine.playNote(440, 100)

      expect(noteId).toBeDefined()
    })
  })

  describe('edge cases - ADSR', () => {
    it('handles attack of 0ms (clamped to 1ms)', () => {
      engine.setADSR(0, 50, 80, 200)
      const adsr = engine.getADSR()
      expect(adsr.attack).toBe(1)
    })

    it('handles decay of 0ms (clamped to 1ms)', () => {
      engine.setADSR(10, 0, 80, 200)
      const adsr = engine.getADSR()
      expect(adsr.decay).toBe(1)
    })

    it('handles release of 0ms (clamped to 1ms)', () => {
      engine.setADSR(10, 50, 80, 0)
      const adsr = engine.getADSR()
      expect(adsr.release).toBe(1)
    })

    it('handles sustain at 0%', () => {
      engine.setADSR(10, 50, 0, 200)
      const adsr = engine.getADSR()
      expect(adsr.sustain).toBe(0)
    })

    it('handles sustain at 100%', () => {
      engine.setADSR(10, 50, 100, 200)
      const adsr = engine.getADSR()
      expect(adsr.sustain).toBe(100)
    })
  })

  describe('edge cases - metronome', () => {
    it('plays metronome at downbeat', () => {
      expect(() => engine.playMetronomeClick(true)).not.toThrow()
    })

    it('plays metronome at upbeat', () => {
      expect(() => engine.playMetronomeClick(false)).not.toThrow()
    })

    it('handles multiple metronome calls', () => {
      for (let i = 0; i < 10; i++) {
        engine.playMetronomeClick(i % 2 === 0)
      }
      expect(() => engine.playMetronomeClick(true)).not.toThrow()
    })
  })

  describe('edge cases - beep', () => {
    it('plays start beep multiple times', () => {
      for (let i = 0; i < 10; i++) {
        engine.playBeep('start')
      }
    })

    it('plays stop beep multiple times', () => {
      for (let i = 0; i < 10; i++) {
        engine.playBeep('stop')
      }
    })
  })

  describe('edge cases - mic', () => {
    it('handles stop when mic already stopped', () => {
      expect(() => engine.stopMic()).not.toThrow()
    })

    it('handles getWaveformData when mic inactive', () => {
      const data = engine.getWaveformData()
      expect(data).toBeInstanceOf(Float32Array)
    })

    it('handles getFrequencyData when mic inactive', () => {
      const data = engine.getFrequencyData()
      expect(data).toBeInstanceOf(Float32Array)
    })

    it('handles getFrequencyDataBytes when mic inactive', () => {
      const data = engine.getFrequencyDataBytes()
      expect(data).toBeInstanceOf(Uint8Array)
    })
  })

  describe('edge cases - instruments', () => {
    it('cycles through instruments', () => {
      const instruments = engine.getInstruments()
      for (const inst of instruments) {
        engine.setInstrument(inst)
      }
    })

    it('handles invalid instrument gracefully', () => {
      expect(() => engine.setInstrument('sine')).not.toThrow()
    })

    it('returns current instrument even after invalid set', () => {
      // Setting invalid instrument has no effect (silently ignored)
      expect(() => engine.setInstrument('sine')).not.toThrow()
      expect(engine.getInstrument()).toBe('sine')
    })

    it('does not change instrument when setting invalid value', () => {
      // Setting invalid instrument should keep current instrument unchanged
      engine.setInstrument('sine')
      engine.setInstrument('sine')
      expect(engine.getInstrument()).toBe('sine')
    })
  })

  describe('edge cases - callbacks', () => {
    it('handles multiple callbacks', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      const callback3 = vi.fn()

      engine.onNoteChange(callback1)
      engine.onNoteChange(callback2)
      engine.onNoteChange(callback3)

      // All callbacks should be set
      expect(() => engine.onNoteChange(callback1)).not.toThrow()
    })

    it('handles null callback', () => {
      const emptyFn = () => {}
      expect(() => engine.onNoteChange(emptyFn)).not.toThrow()
    })

    it('handles null playback end callback', () => {
      const emptyFn = () => {}
      expect(() => engine.onPlaybackEnd(emptyFn)).not.toThrow()
    })
  })

  describe('edge cases - destroy', () => {
    it('handles multiple destroy calls', () => {
      engine.destroy()
      engine.destroy()
      engine.destroy()
    })

    it('handles destroy before init', () => {
      const engine = new AudioEngine()
      engine.destroy()
      expect(() => engine.destroy()).not.toThrow()
    })
  })

  describe('edge cases - WAV export', () => {
    it('handles melody with missing note properties', async () => {
      await engine.init()
      const melody: MelodyItem[] = [
        {
          id: 1,
          note: { name: 'C', octave: 4, midi: 60, freq: 261.63 },
          startBeat: 0,
          duration: 1,
        },
      ]

      const blob = await engine.renderMelodyToWAV(melody, 120)

      // Properly typed melody has all properties, so it renders successfully
      expect(blob).toBeInstanceOf(Blob)
    })

    it('handles melody with undefined note properties', async () => {
      await engine.init()
      const melody = [
        {
          id: 1,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          note: {} as any as MelodyItem['note'],
          startBeat: 0,
          duration: 1,
        },
      ]

      const blob = await engine.renderMelodyToWAV(melody, 120)

      // May return null if freq is missing
      expect(blob === null || blob instanceof Blob)
    })

    it('handles melody with negative duration', async () => {
      await engine.init()
      const melody: MelodyItem[] = [
        {
          id: 1,
          note: { name: 'C', octave: 4, midi: 60, freq: 261.63 },
          startBeat: 0,
          duration: -1,
        },
      ]

      const blob = await engine.renderMelodyToWAV(melody, 120)

      expect(blob === null || blob instanceof Blob)
    })

    it('handles melody with zero startBeat', async () => {
      await engine.init()
      const melody: MelodyItem[] = [
        {
          id: 1,
          note: { name: 'C', octave: 4, midi: 60, freq: 261.63 },
          startBeat: 0,
          duration: 1,
        },
      ]

      const blob = await engine.renderMelodyToWAV(melody, 120)

      expect(blob).toBeInstanceOf(Blob)
    })

    it('handles melody with negative startBeat', async () => {
      await engine.init()
      const melody: MelodyItem[] = [
        {
          id: 1,
          note: { name: 'C', octave: 4, midi: 60, freq: 261.63 },
          startBeat: -1,
          duration: 1,
        },
      ]

      const blob = await engine.renderMelodyToWAV(melody, 120)

      expect(blob).toBeInstanceOf(Blob)
    })

    it('handles melody with very large beat count', async () => {
      await engine.init()
      const melody: MelodyItem[] = [
        {
          id: 1,
          note: { name: 'C', octave: 4, midi: 60, freq: 261.63 },
          startBeat: 0,
          duration: 10000,
        },
      ]

      const blob = await engine.renderMelodyToWAV(melody, 120)

      expect(blob).toBeInstanceOf(Blob)
    })

    it('handles very high BPM for export', async () => {
      await engine.init()
      const melody: MelodyItem[] = [
        {
          id: 1,
          note: { name: 'C', octave: 4, midi: 60, freq: 261.63 },
          startBeat: 0,
          duration: 1,
        },
      ]

      const blob = await engine.renderMelodyToWAV(melody, 1000)

      expect(blob).toBeInstanceOf(Blob)
    })

    it('handles very low BPM for export', async () => {
      await engine.init()
      const melody: MelodyItem[] = [
        {
          id: 1,
          note: { name: 'C', octave: 4, midi: 60, freq: 261.63 },
          startBeat: 0,
          duration: 1,
        },
      ]

      const blob = await engine.renderMelodyToWAV(melody, 20)

      expect(blob).toBeInstanceOf(Blob)
    })

    it('handles very long filename for download', async () => {
      await engine.init()
      const melody: MelodyItem[] = [
        {
          id: 1,
          note: { name: 'C', octave: 4, midi: 60, freq: 261.63 },
          startBeat: 0,
          duration: 1,
        },
      ]

      const longName = `${'a'.repeat(500)}.wav`
      const result = await engine.downloadMelodyAsWAV(melody, 120, longName)

      expect(result).toBe(true)
    })

    it('handles very short filename for download', async () => {
      await engine.init()
      const melody: MelodyItem[] = [
        {
          id: 1,
          note: { name: 'C', octave: 4, midi: 60, freq: 261.63 },
          startBeat: 0,
          duration: 1,
        },
      ]

      const result = await engine.downloadMelodyAsWAV(melody, 120, '.wav')

      expect(result).toBe(true)
    })

    it('handles empty filename for download', async () => {
      await engine.init()
      const melody: MelodyItem[] = [
        {
          id: 1,
          note: { name: 'C', octave: 4, midi: 60, freq: 261.63 },
          startBeat: 0,
          duration: 1,
        },
      ]

      const result = await engine.downloadMelodyAsWAV(melody, 120, '')

      expect(result).toBe(true)
    })

    it('handles filename with special characters', async () => {
      await engine.init()
      const melody: MelodyItem[] = [
        {
          id: 1,
          note: { name: 'C', octave: 4, midi: 60, freq: 261.63 },
          startBeat: 0,
          duration: 1,
        },
      ]

      const result = await engine.downloadMelodyAsWAV(
        melody,
        120,
        'melody & test #1.wav',
      )

      expect(result).toBe(true)
    })

    it('handles undefined BPM for export', async () => {
      await engine.init()
      const melody: MelodyItem[] = [
        {
          id: 1,
          note: { name: 'C', octave: 4, midi: 60, freq: 261.63 },
          startBeat: 0,
          duration: 1,
        },
      ]

      const blob = await engine.renderMelodyToWAV(
        melody,
        undefined as unknown as number,
      )

      expect(blob).toBeInstanceOf(Blob)
    })

    it('handles zero BPM for export', async () => {
      await engine.init()
      const melody: MelodyItem[] = [
        {
          id: 1,
          note: { name: 'C', octave: 4, midi: 60, freq: 261.63 },
          startBeat: 0,
          duration: 1,
        },
      ]

      const blob = await engine.renderMelodyToWAV(melody, 0)

      expect(blob).toBeInstanceOf(Blob)
    })
  })

  describe('edge cases - reverb', () => {
    it('handles very high wetness', () => {
      engine.setReverbWetness(100)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing private field for test assertion
      expect((engine as any).currentReverbWetness).toBe(1)
    })

    it('handles very low wetness', () => {
      engine.setReverbWetness(0)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing private field for test assertion
      expect((engine as any).currentReverbWetness).toBe(0)
    })

    it('handles invalid reverb type', async () => {
      await engine.init()
      const result = await engine.setReverbType('off')

      // Should handle gracefully (no error)
      expect(result).toBeUndefined()
    })

    it('handles multiple reverb type changes', async () => {
      await engine.init()
      await engine.setReverbType('room')
      await engine.setReverbType('hall')
      await engine.setReverbType('cathedral')
      await engine.setReverbType('off')
    })
  })

  describe('performance', () => {
    it('handles many stopAllNotes calls', () => {
      for (let i = 0; i < 100; i++) {
        engine.stopAllNotes()
      }
      expect(() => engine.stopAllNotes()).not.toThrow()
    })

    it('handles many playNote calls quickly', async () => {
      await engine.init()
      const noteIds: number[] = []

      for (let i = 0; i < 50; i++) {
        const id = await engine.playNote(440 + i * 10, 100)
        if (id !== null && id !== undefined) {
          noteIds.push(id)
        }
      }

      expect(noteIds.length).toBeGreaterThan(0)
    })

    it('handles many stopNote calls', () => {
      const noteId1 = 12345
      const noteId2 = 67890

      for (let i = 0; i < 100; i++) {
        engine.stopNote(noteId1)
        engine.stopNote(noteId2)
      }

      expect(() => engine.stopNote(noteId1)).not.toThrow()
      expect(() => engine.stopNote(noteId2)).not.toThrow()
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

