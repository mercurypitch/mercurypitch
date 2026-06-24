// ============================================================
// Guitar Synth Tests — Karplus-Strong + bass
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assignGuitarString, clearPluckCache, createBassVoice, createGuitarVoice, GUITAR_TUNING, melodyToGuitarNotes, renderPluckWaveform, } from '@/lib/guitar/guitar-synth'

// ── Shared AudioContext mock builder ───────────────────────────

function mockAudioContext() {
  return {
    sampleRate: 44100,
    currentTime: 0,
    destination: { connect: vi.fn() },
    createGain: vi.fn().mockImplementation(() => ({
      gain: {
        value: 0,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        setTargetAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createBiquadFilter: vi.fn().mockImplementation(() => ({
      type: 'lowpass' as const,
      frequency: { value: 1000, setValueAtTime: vi.fn() },
      Q: { value: 0.5, setValueAtTime: vi.fn() },
      gain: { value: 0, setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createWaveShaper: vi.fn().mockImplementation(() => ({
      curve: null,
      oversample: 'none',
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createBuffer: vi
      .fn()
      .mockImplementation((channels: number, length: number) => {
        const data = new Float32Array(length)
        return {
          numberOfChannels: channels,
          sampleRate: 44100,
          length,
          getChannelData: vi.fn().mockReturnValue(data),
        }
      }),
    createBufferSource: vi.fn().mockImplementation(() => ({
      buffer: null,
      onended: null,
      start: vi.fn(),
      stop: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
  }
}

beforeEach(() => {
  clearPluckCache()
})

// ── Karplus-Strong waveform rendering ──────────────────────────

const ACOUSTIC_PARAMS = {
  damping: 0.995,
  brightness: 0.6,
  pickPosition: 0.18,
  decaySeconds: 2.2,
  level: 0.6,
}

/** Find the autocorrelation-peak lag of a signal segment. */
function dominantPeriod(
  data: Float32Array,
  start: number,
  windowLen: number,
  minLag: number,
  maxLag: number,
): number {
  let bestLag = minLag
  let bestCorr = -Infinity
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0
    for (let i = start; i < start + windowLen; i++) {
      corr += data[i] * data[i + lag]
    }
    if (corr > bestCorr) {
      bestCorr = corr
      bestLag = lag
    }
  }
  return bestLag
}

describe('renderPluckWaveform', () => {
  it('produces a waveform with the requested fundamental period', () => {
    const sampleRate = 44100
    const freq = 220
    const data = renderPluckWaveform(sampleRate, freq, ACOUSTIC_PARAMS)
    // Measure period after the attack transient has settled
    const expected = sampleRate / freq // ≈ 200.45 samples
    const period = dominantPeriod(
      data,
      4410,
      2048,
      Math.floor(expected * 0.75),
      Math.ceil(expected * 1.25),
    )
    expect(period).toBeGreaterThanOrEqual(Math.floor(expected) - 2)
    expect(period).toBeLessThanOrEqual(Math.ceil(expected) + 2)
  })

  it('stays in tune for low bass frequencies', () => {
    const sampleRate = 44100
    const freq = 55
    const data = renderPluckWaveform(sampleRate, freq, {
      ...ACOUSTIC_PARAMS,
      brightness: 0.3,
    })
    const expected = sampleRate / freq // ≈ 801.8 samples
    const period = dominantPeriod(
      data,
      8820,
      4096,
      Math.floor(expected * 0.9),
      Math.ceil(expected * 1.1),
    )
    expect(Math.abs(period - expected)).toBeLessThanOrEqual(4)
  })

  it('decays naturally over time', () => {
    const data = renderPluckWaveform(44100, 220, ACOUSTIC_PARAMS)
    const rms = (start: number, len: number) => {
      let sum = 0
      for (let i = start; i < start + len; i++) sum += data[i] * data[i]
      return Math.sqrt(sum / len)
    }
    const early = rms(0, 4410)
    const late = rms(data.length - 4410, 4410)
    expect(early).toBeGreaterThan(late * 3)
  })

  it('normalizes the peak to the requested level', () => {
    const data = renderPluckWaveform(44100, 220, ACOUSTIC_PARAMS)
    let peak = 0
    for (const v of data) peak = Math.max(peak, Math.abs(v))
    expect(peak).toBeCloseTo(ACOUSTIC_PARAMS.level, 5)
  })

  it('renders a buffer covering the requested decay time', () => {
    const data = renderPluckWaveform(44100, 220, ACOUSTIC_PARAMS)
    expect(data.length).toBe(Math.floor(2.2 * 44100))
  })

  it('handles high frequencies without blowing up', () => {
    const data = renderPluckWaveform(44100, 1318.5, ACOUSTIC_PARAMS)
    for (const v of data) {
      expect(Number.isFinite(v)).toBe(true)
      expect(Math.abs(v)).toBeLessThanOrEqual(1)
    }
  })
})

// ── Guitar voice ───────────────────────────────────────────────

describe('createGuitarVoice', () => {
  it('creates a voice with the expected interface', () => {
    const ctx = mockAudioContext() as unknown as BaseAudioContext
    const voice = createGuitarVoice(ctx, 220, 500, 'acoustic')

    expect(voice).toBeDefined()
    expect(voice.gain).toBeDefined()
    expect(voice.oscillators.length).toBe(1)
    expect(voice.hasCustomEnvelope).toBe(true)
    expect(typeof voice.dispose).toBe('function')
  })

  it('renders the pluck into a buffer source', () => {
    const ctx = mockAudioContext() as unknown as BaseAudioContext
    createGuitarVoice(ctx, 220, 500, 'acoustic')
    expect(ctx.createBuffer).toHaveBeenCalled()
    expect(ctx.createBufferSource).toHaveBeenCalled()
  })

  it('caches rendered buffers for repeated notes', () => {
    const ctx = mockAudioContext() as unknown as BaseAudioContext
    createGuitarVoice(ctx, 220, 500, 'acoustic')
    createGuitarVoice(ctx, 220, 500, 'acoustic')
    expect(vi.mocked(ctx.createBuffer)).toHaveBeenCalledTimes(1)
  })

  it('renders separate buffers per variant', () => {
    const ctx = mockAudioContext() as unknown as BaseAudioContext
    createGuitarVoice(ctx, 220, 500, 'acoustic')
    createGuitarVoice(ctx, 220, 500, 'electric')
    expect(vi.mocked(ctx.createBuffer)).toHaveBeenCalledTimes(2)
  })

  it('starts the buffer source immediately', () => {
    const ctx = mockAudioContext() as unknown as BaseAudioContext
    const voice = createGuitarVoice(ctx, 220, 500, 'acoustic')
    expect(voice.oscillators[0].start).toHaveBeenCalled()
  })

  it('acoustic variant creates body resonance filters', () => {
    const ctx = mockAudioContext() as unknown as BaseAudioContext
    createGuitarVoice(ctx, 220, 500, 'acoustic')
    expect(vi.mocked(ctx.createBiquadFilter).mock.calls.length).toBe(2)
    expect(ctx.createWaveShaper).not.toHaveBeenCalled()
  })

  it('electric variant creates overdrive waveshaper and cab filter', () => {
    const ctx = mockAudioContext() as unknown as BaseAudioContext
    createGuitarVoice(ctx, 220, 500, 'electric')
    expect(ctx.createWaveShaper).toHaveBeenCalledTimes(1)
    expect(vi.mocked(ctx.createBiquadFilter).mock.calls.length).toBe(2)
  })

  it('dispose stops the source and disconnects nodes', () => {
    const ctx = mockAudioContext() as unknown as BaseAudioContext
    const voice = createGuitarVoice(ctx, 220, 500, 'acoustic')
    const src = voice.oscillators[0]
    voice.dispose()
    expect(src.stop).toHaveBeenCalled()
    expect(src.disconnect).toHaveBeenCalled()
    expect(voice.gain.disconnect).toHaveBeenCalled()
  })

  it('handles low frequencies within guitar range (E2 = 82Hz)', () => {
    const ctx = mockAudioContext() as unknown as BaseAudioContext
    const voice = createGuitarVoice(ctx, 82.41, 1000, 'acoustic')
    expect(voice.gain).toBeDefined()
  })

  it('handles high frequencies within guitar range (E6 ≈ 1319Hz)', () => {
    const ctx = mockAudioContext() as unknown as BaseAudioContext
    const voice = createGuitarVoice(ctx, 1318.5, 1000, 'acoustic')
    expect(voice.gain).toBeDefined()
  })

  it('handles zero duration without throwing', () => {
    const ctx = mockAudioContext() as unknown as BaseAudioContext
    const voice = createGuitarVoice(ctx, 220, 0, 'acoustic')
    expect(voice.gain).toBeDefined()
  })
})

// ── Bass voice ─────────────────────────────────────────────────

describe('createBassVoice', () => {
  it('creates a voice with the expected interface', () => {
    const ctx = mockAudioContext() as unknown as BaseAudioContext
    const voice = createBassVoice(ctx, 55, 800)

    expect(voice).toBeDefined()
    expect(voice.gain).toBeDefined()
    expect(voice.oscillators.length).toBe(1)
    expect(voice.hasCustomEnvelope).toBe(true)
    expect(typeof voice.dispose).toBe('function')
  })

  it('renders the pluck into a buffer source', () => {
    const ctx = mockAudioContext() as unknown as BaseAudioContext
    createBassVoice(ctx, 55, 500)
    expect(ctx.createBuffer).toHaveBeenCalled()
    expect(ctx.createBufferSource).toHaveBeenCalled()
  })

  it('applies a tone lowpass filter', () => {
    const ctx = mockAudioContext() as unknown as BaseAudioContext
    createBassVoice(ctx, 55, 500)
    expect(ctx.createBiquadFilter).toHaveBeenCalledTimes(1)
  })

  it('handles low bass frequencies (E1 = 41Hz)', () => {
    const ctx = mockAudioContext() as unknown as BaseAudioContext
    const voice = createBassVoice(ctx, 41.2, 1000)
    expect(voice.gain).toBeDefined()
  })

  it('handles mid-bass frequencies (C3 = 131Hz)', () => {
    const ctx = mockAudioContext() as unknown as BaseAudioContext
    const voice = createBassVoice(ctx, 130.8, 1000)
    expect(voice.gain).toBeDefined()
  })

  it('dispose stops the source and disconnects nodes', () => {
    const ctx = mockAudioContext() as unknown as BaseAudioContext
    const voice = createBassVoice(ctx, 55, 500)
    voice.dispose()
    expect(voice.oscillators[0].stop).toHaveBeenCalled()
    expect(voice.gain.disconnect).toHaveBeenCalled()
  })
})

// ── Guitar tuning ──────────────────────────────────────────────

describe('GUITAR_TUNING', () => {
  it('has 6 strings', () => {
    const keys = Object.keys(GUITAR_TUNING)
    expect(keys).toHaveLength(6)
  })

  it('contains standard guitar string names', () => {
    expect(GUITAR_TUNING).toHaveProperty('E2')
    expect(GUITAR_TUNING).toHaveProperty('A2')
    expect(GUITAR_TUNING).toHaveProperty('D3')
    expect(GUITAR_TUNING).toHaveProperty('G3')
    expect(GUITAR_TUNING).toHaveProperty('B3')
    expect(GUITAR_TUNING).toHaveProperty('E4')
  })

  it('has frequencies within standard guitar range', () => {
    for (const freq of Object.values(GUITAR_TUNING)) {
      expect(freq).toBeGreaterThan(75)
      expect(freq).toBeLessThan(350)
    }
  })
})

// ── String assignment ──────────────────────────────────────────
// Convention: string index 0 = high e, 5 = low E (matches STRING_LABELS
// and the falling-notes canvas lanes).

describe('assignGuitarString', () => {
  it('assigns open low E (MIDI 40) to string index 5', () => {
    const result = assignGuitarString(40)
    expect(result.stringIndex).toBe(5)
    expect(result.fret).toBe(0)
  })

  it('assigns open A (MIDI 45) to string index 4', () => {
    const result = assignGuitarString(45)
    expect(result.stringIndex).toBe(4)
    expect(result.fret).toBe(0)
  })

  it('assigns open high e (MIDI 64) to string index 0', () => {
    const result = assignGuitarString(64)
    expect(result.stringIndex).toBe(0)
    expect(result.fret).toBe(0)
  })

  it('assigns fretted notes to the lowest-fret-position string', () => {
    // MIDI 48 = C3, playable on low E (5) fret 8 or A string (4) fret 3
    const result = assignGuitarString(48)
    expect(result.stringIndex).toBe(4)
    expect(result.fret).toBe(3)
  })

  it('assigns high notes to the high e string', () => {
    // MIDI 72 = C5
    const result = assignGuitarString(72)
    expect(result.stringIndex).toBe(0)
    expect(result.fret).toBe(8)
  })

  it('clamps notes below guitar range onto the open low E string', () => {
    // MIDI 36 = C2, below low E (40)
    const result = assignGuitarString(36)
    expect(result.stringIndex).toBe(5)
    expect(result.fret).toBe(0)
  })

  it('clamps notes above guitar range onto the high e string', () => {
    // MIDI 100 is above fret 24 on high e (64 + 24 = 88)
    const result = assignGuitarString(100)
    expect(result.stringIndex).toBe(0)
    expect(result.fret).toBe(24)
  })

  it('returns fret within 0-24 for common guitar notes', () => {
    for (let midi = 40; midi <= 88; midi++) {
      const result = assignGuitarString(midi)
      expect(result.fret).toBeGreaterThanOrEqual(0)
      expect(result.fret).toBeLessThanOrEqual(24)
    }
  })

  it('prefers lower-fret positions on lower strings', () => {
    // MIDI 52 = E3: D string (index 3) fret 2 beats G string fret 12
    const result = assignGuitarString(52)
    expect(result.fret).toBeLessThan(3)
  })
})

// ── Melody to guitar notes ─────────────────────────────────────

describe('melodyToGuitarNotes', () => {
  it('maps melody items to guitar notes with string assignments', () => {
    const items = [
      { midi: 60, startBeat: 0, duration: 1 },
      { midi: 64, startBeat: 1, duration: 1 },
    ]
    const notes = melodyToGuitarNotes(items)
    expect(notes).toHaveLength(2)
    expect(notes[0].midi).toBe(60)
    expect(notes[0].stringIndex).toBeGreaterThanOrEqual(0)
    expect(notes[0].fret).toBeGreaterThanOrEqual(0)
    expect(notes[0].startBeat).toBe(0)
    expect(notes[0].duration).toBe(1)
    expect(notes[0].targetFreq).toBeGreaterThan(0)
  })

  it('generates note names from MIDI', () => {
    const items = [{ midi: 60, startBeat: 0, duration: 1 }]
    const notes = melodyToGuitarNotes(items)
    expect(notes[0].noteName).toBe('C4')
  })

  it('uses provided note name when given', () => {
    const items = [
      { midi: 60, noteName: 'CustomName', startBeat: 0, duration: 1 },
    ]
    const notes = melodyToGuitarNotes(items)
    expect(notes[0].noteName).toBe('CustomName')
  })

  it('uses provided targetFreq when given', () => {
    const items = [{ midi: 60, targetFreq: 999, startBeat: 0, duration: 1 }]
    const notes = melodyToGuitarNotes(items)
    expect(notes[0].targetFreq).toBe(999)
  })

  it('computes targetFreq from MIDI when not provided', () => {
    const items = [{ midi: 69, startBeat: 0, duration: 1 }] // A4 = 440 Hz
    const notes = melodyToGuitarNotes(items)
    expect(notes[0].targetFreq).toBeCloseTo(440, 0)
  })

  it('returns empty array for empty input', () => {
    const notes = melodyToGuitarNotes([])
    expect(notes).toHaveLength(0)
  })
})
