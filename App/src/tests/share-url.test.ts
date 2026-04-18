// ============================================================
// Share URL Tests
// ============================================================

import { beforeEach,describe, expect, it } from 'vitest'
import { decodeMelodyFromURL, encodeMelodyToURL, generateShareURL, hasSharedPresetInURL } from '@/lib/share-url'
import type { MelodyItem } from '@/types'

describe('encodeMelodyToURL', () => {
  it('encodes single note correctly', () => {
    const melody: MelodyItem[] = [
      {
        note: { midi: 60, name: 'C', octave: 4, freq: 261 },
        startBeat: 0,
        duration: 2,
      },
    ]
    const result = encodeMelodyToURL(melody)
    expect(result).toContain('n=m60s0d2')
  })

  it('encodes multiple notes correctly', () => {
    const melody: MelodyItem[] = [
      {
        note: { midi: 60, name: 'C', octave: 4, freq: 261 },
        startBeat: 0,
        duration: 2,
      },
      {
        note: { midi: 64, name: 'E', octave: 4, freq: 329 },
        startBeat: 2,
        duration: 2,
      },
      {
        note: { midi: 67, name: 'G', octave: 4, freq: 392 },
        startBeat: 4,
        duration: 2,
      },
    ]
    const result = encodeMelodyToURL(melody)
    expect(result).toContain('m60s0d2')
    expect(result).toContain('m64s2d2')
    expect(result).toContain('m67s4d2')
  })

  it('includes optional parameters when provided', () => {
    const melody: MelodyItem[] = [
      {
        note: { midi: 60, name: 'C', octave: 4, freq: 261 },
        startBeat: 0,
        duration: 2,
      },
    ]
    const result = encodeMelodyToURL(melody, 120, 'C', 'major', 8)
    expect(result).toContain('bpm=120')
    expect(result).toContain('k=C')
    expect(result).toContain('s=major')
    expect(result).toContain('beats=8')
  })

  it('excludes optional parameters when not provided', () => {
    const melody: MelodyItem[] = [
      {
        note: { midi: 60, name: 'C', octave: 4, freq: 261 },
        startBeat: 0,
        duration: 2,
      },
    ]
    const result = encodeMelodyToURL(melody)
    expect(result).not.toContain('bpm=')
    expect(result).not.toContain('k=')
  })

  it('handles fractional beat positions', () => {
    const melody: MelodyItem[] = [
      {
        note: { midi: 60, name: 'C', octave: 4, freq: 261 },
        startBeat: 1.5,
        duration: 0.5,
      },
    ]
    const result = encodeMelodyToURL(melody)
    expect(result).toContain('m60s1.5d0.5')
  })

  it('handles empty melody', () => {
    const result = encodeMelodyToURL([])
    expect(result).toBe('n=')
  })
})

describe('decodeMelodyFromURL', () => {
  it('decodes single note correctly', () => {
    const params = new URLSearchParams('n=m60s0d2')
    const result = decodeMelodyFromURL(params)

    expect(result).not.toBeNull()
    expect(result!.melody.length).toBe(1)
    expect(result!.melody[0].note.midi).toBe(60)
    expect(result!.melody[0].startBeat).toBe(0)
    expect(result!.melody[0].duration).toBe(2)
  })

  it('decodes multiple notes correctly', () => {
    const params = new URLSearchParams('n=m60s0d2,m64s2d2,m67s4d2')
    const result = decodeMelodyFromURL(params)

    expect(result).not.toBeNull()
    expect(result!.melody.length).toBe(3)
    expect(result!.melody[0].note.midi).toBe(60)
    expect(result!.melody[1].note.midi).toBe(64)
    expect(result!.melody[2].note.midi).toBe(67)
  })

  it('decodes optional parameters', () => {
    const params = new URLSearchParams('n=m60s0d2&bpm=120&k=G&s=minor&beats=16')
    const result = decodeMelodyFromURL(params)

    expect(result).not.toBeNull()
    expect(result!.bpm).toBe(120)
    expect(result!.key).toBe('G')
    expect(result!.scaleType).toBe('minor')
    expect(result!.totalBeats).toBe(16)
  })

  it('returns null for empty n parameter', () => {
    const params = new URLSearchParams('')
    const result = decodeMelodyFromURL(params)
    expect(result).toBeNull()
  })

  it('validates MIDI range', () => {
    // MIDI 21 is A0 (lowest piano key), MIDI 108 is C8 (highest)
    const params = new URLSearchParams('n=m10s0d2,m60s2d2,m200s4d2')
    const result = decodeMelodyFromURL(params)

    // Should skip invalid MIDIs but include valid one
    expect(result).not.toBeNull()
    expect(result!.melody.length).toBe(1)
    expect(result!.melody[0].note.midi).toBe(60)
  })

  it('rejects malformed note data', () => {
    const params = new URLSearchParams('n=invalid,m60s0')
    const result = decodeMelodyFromURL(params)
    expect(result).toBeNull()
  })

  it('handles fractional beat positions', () => {
    const params = new URLSearchParams('n=m60s1.5d0.5')
    const result = decodeMelodyFromURL(params)

    expect(result).not.toBeNull()
    expect(result!.melody[0].startBeat).toBe(1.5)
    expect(result!.melody[0].duration).toBe(0.5)
  })
})

describe('generateShareURL', () => {
  it('generates URL with query parameters', () => {
    const melody: MelodyItem[] = [
      {
        note: { midi: 60, name: 'C', octave: 4, freq: 261 },
        startBeat: 0,
        duration: 2,
      },
    ]
    const url = generateShareURL(melody, 120, 'C', 'major', 8)

    expect(url).toMatch(/\?/)
    expect(url).toContain('n=m60s0d2')
    expect(url).toContain('bpm=120')
  })

  it('includes origin in URL', () => {
    const melody: MelodyItem[] = [
      {
        note: { midi: 60, name: 'C', octave: 4, freq: 261 },
        startBeat: 0,
        duration: 2,
      },
    ]
    const url = generateShareURL(melody)

    expect(url).toMatch(/^https?:\/\//)
  })
})

describe('hasSharedPresetInURL', () => {
  beforeEach(() => {
    // Clear URL between tests
    Object.defineProperty(window, 'location', {
      value: { search: '' },
      writable: true,
    })
  })

  it('returns true when n parameter exists', () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?n=m60s0d2' },
      writable: true,
    })
    expect(hasSharedPresetInURL()).toBe(true)
  })

  it('returns false when n parameter missing', () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?bpm=120' },
      writable: true,
    })
    expect(hasSharedPresetInURL()).toBe(false)
  })

  it('returns false when no query params', () => {
    Object.defineProperty(window, 'location', {
      value: { search: '' },
      writable: true,
    })
    expect(hasSharedPresetInURL()).toBe(false)
  })
})

describe('round-trip encoding/decoding', () => {
  it('preserves melody data through encode/decode cycle', () => {
    const original: MelodyItem[] = [
      {
        note: { midi: 60, name: 'C', octave: 4, freq: 261 },
        startBeat: 0,
        duration: 2,
      },
      {
        note: { midi: 64, name: 'E', octave: 4, freq: 329 },
        startBeat: 2,
        duration: 3,
      },
      {
        note: { midi: 67, name: 'G', octave: 4, freq: 392 },
        startBeat: 5,
        duration: 1,
      },
    ]

    const encoded = encodeMelodyToURL(original, 120, 'C', 'major', 10)
    const params = new URLSearchParams(encoded)
    const decoded = decodeMelodyFromURL(params)

    expect(decoded).not.toBeNull()
    expect(decoded!.melody.length).toBe(original.length)

    for (let i = 0; i < original.length; i++) {
      expect(decoded!.melody[i].note.midi).toBe(original[i].note.midi)
      expect(decoded!.melody[i].startBeat).toBe(original[i].startBeat)
      expect(decoded!.melody[i].duration).toBe(original[i].duration)
    }
  })

  it('preserves optional parameters through encode/decode', () => {
    const melody: MelodyItem[] = [
      {
        note: { midi: 60, name: 'C', octave: 4, freq: 261 },
        startBeat: 0,
        duration: 2,
      },
    ]

    const encoded = encodeMelodyToURL(melody, 140, 'D', 'harmonic-minor', 12)
    const params = new URLSearchParams(encoded)
    const decoded = decodeMelodyFromURL(params)

    expect(decoded!.bpm).toBe(140)
    expect(decoded!.key).toBe('D')
    expect(decoded!.scaleType).toBe('harmonic-minor')
    expect(decoded!.totalBeats).toBe(12)
  })
})
