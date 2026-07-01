import { describe, expect, it } from 'vitest'
import type { CompactMelodyItem, MelodyShareData } from '@/lib/share-codec'
import { decodeSharePayload, encodeExerciseForShare, encodeMelodyForShare, encodeRoutineForShare, generateMelodyItemsFromCompact, generateShareFullUrl, generateShareHashUrl, } from '@/lib/share-codec'
import type { MelodyItem } from '@/types'

function makeNote(
  midi: number,
  startBeat: number,
  duration: number,
): MelodyItem {
  return {
    id: 1,
    note: { midi, name: 'C', octave: 4, freq: 261.63 },
    startBeat,
    duration,
  } as MelodyItem
}

describe('encodeMelodyForShare / decodeSharePayload round-trip', () => {
  it('round-trips a simple melody', () => {
    const items = [makeNote(60, 0, 1), makeNote(64, 1, 1), makeNote(67, 2, 2)]
    const encoded = encodeMelodyForShare(items, 120, 'C', 'major', 4, 'My Song')

    const payload = decodeSharePayload(encoded)
    expect(payload).not.toBeNull()
    expect(payload?.t).toBe('melody')
    expect(payload?.v).toBe(1)
    const data = payload?.d as MelodyShareData
    expect(data.n).toBe('My Song')
    expect(data.b).toBe(120)
    expect(data.k).toBe('C')
    expect(data.s).toBe('major')
    expect(data.i.length).toBe(3)
  })

  it('encodes rest notes with the -1 midi sentinel and a 3-element tuple', () => {
    const restItem = {
      id: 1,
      isRest: true,
      startBeat: 0,
      duration: 2,
    } as MelodyItem
    const encoded = encodeMelodyForShare([restItem], 120)
    const payload = decodeSharePayload(encoded)
    const data = payload?.d as MelodyShareData
    expect(data.i[0]).toEqual([-1, 0, 2])
  })

  it('omits default/undefined optional fields to keep tuples short', () => {
    // Default velocity (100), no effect, no slide/vibrato/lyric.
    const items = [makeNote(60, 0, 1)]
    const encoded = encodeMelodyForShare(items, 120)
    const data = decodeSharePayload(encoded)?.d as MelodyShareData
    expect(data.i[0]).toEqual([60, 0, 1]) // trimmed to 3 elements
  })

  it('keeps a non-default velocity but trims later omitted fields', () => {
    const item = makeNote(60, 0, 1)
    item.velocity = 80
    const encoded = encodeMelodyForShare([item], 120)
    const data = decodeSharePayload(encoded)?.d as MelodyShareData
    expect(data.i[0]).toEqual([60, 0, 1, 80])
  })

  it('rounds startBeat/duration to one decimal place', () => {
    const items = [makeNote(60, 1.23456, 0.98765)]
    const encoded = encodeMelodyForShare(items, 120)
    const data = decodeSharePayload(encoded)?.d as MelodyShareData
    expect(data.i[0][1]).toBe(1.2)
    expect(data.i[0][2]).toBe(1)
  })

  it('omits an empty/undefined key or scale type instead of storing empty strings', () => {
    const encoded = encodeMelodyForShare([makeNote(60, 0, 1)], 120, '', '')
    const data = decodeSharePayload(encoded)?.d as MelodyShareData
    expect(data.k).toBeUndefined()
    expect(data.s).toBeUndefined()
  })
})

describe('encodeExerciseForShare / decodeSharePayload', () => {
  it('round-trips an exercise share', () => {
    const encoded = encodeExerciseForShare(
      'long-note',
      ['C4', 'E4'],
      3,
      60,
      'Long Note Practice',
    )
    const payload = decodeSharePayload(encoded)
    expect(payload?.t).toBe('exercise')
    expect(payload?.n).toBe('Long Note Practice')
    expect(payload?.d).toEqual({
      e: 'long-note',
      tn: ['C4', 'E4'],
      df: 3,
      dr: 60,
    })
  })

  it('omits an empty target-notes array', () => {
    const encoded = encodeExerciseForShare('siren', [])
    const payload = decodeSharePayload(encoded)
    expect((payload?.d as { tn?: string[] }).tn).toBeUndefined()
  })
})

describe('encodeRoutineForShare / decodeSharePayload', () => {
  it('round-trips a routine template', () => {
    const encoded = encodeRoutineForShare({
      id: 'r1',
      name: 'Morning Warmup',
      description: 'A gentle start',
      segments: [
        { type: 'warmup', durationSec: 60, config: { note: 'C4' } },
        { type: 'cooldown', durationSec: 30, config: {} },
      ],
    })
    const payload = decodeSharePayload(encoded)
    expect(payload?.t).toBe('routine')
    expect(payload?.d).toEqual({
      id: 'r1',
      n: 'Morning Warmup',
      desc: 'A gentle start',
      seg: [
        { k: 'warmup', d: 60, c: { note: 'C4' } },
        { k: 'cooldown', d: 30, c: {} },
      ],
    })
  })
})

describe('decodeSharePayload — rejects malformed input', () => {
  it('returns null for garbage base64url', () => {
    expect(decodeSharePayload('not-valid-base64!!!')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(decodeSharePayload('')).toBeNull()
  })

  it('returns null for a payload with the wrong version', () => {
    const encoded = encodeExerciseForShare('siren')
    const raw = JSON.parse(
      Buffer.from(
        encoded.replace(/-/g, '+').replace(/_/g, '/') +
          '='.repeat((4 - (encoded.length % 4)) % 4),
        'base64',
      ).toString('utf-8'),
    )
    raw.v = 2
    const reEncoded = Buffer.from(JSON.stringify(raw))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    expect(decodeSharePayload(reEncoded)).toBeNull()
  })

  it('returns null for melody data missing required fields', () => {
    const raw = { v: 1, t: 'melody', d: { n: 'x' } } // missing b, i
    const encoded = Buffer.from(JSON.stringify(raw))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    expect(decodeSharePayload(encoded)).toBeNull()
  })

  it('returns null for an unknown share type', () => {
    const raw = { v: 1, t: 'not-a-type', d: {} }
    const encoded = Buffer.from(JSON.stringify(raw))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    expect(decodeSharePayload(encoded)).toBeNull()
  })

  it('returns null when d is not an object', () => {
    const raw = { v: 1, t: 'exercise', d: 'nope' }
    const encoded = Buffer.from(JSON.stringify(raw))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    expect(decodeSharePayload(encoded)).toBeNull()
  })
})

describe('generateMelodyItemsFromCompact', () => {
  it('reconstructs a full tuple with all optional fields', () => {
    const tuple: CompactMelodyItem = [60, 1, 2, 90, 'vibrato', 3, 0.5, 'la la']
    const [item] = generateMelodyItemsFromCompact([tuple])
    expect(item.note.midi).toBe(60)
    expect(item.startBeat).toBe(1)
    expect(item.duration).toBe(2)
    expect(item.velocity).toBe(90)
    expect(item.effectType).toBe('vibrato')
    expect(item.slideInterval).toBe(3)
    expect(item.vibratoAmplitude).toBe(0.5)
    expect(item.lyricText).toBe('la la')
  })

  it('defaults velocity to 100 for a short (3-element) tuple', () => {
    const tuple: CompactMelodyItem = [60, 0, 1]
    const [item] = generateMelodyItemsFromCompact([tuple])
    expect(item.velocity).toBe(100)
    expect(item.effectType).toBeUndefined()
    expect(item.lyricText).toBeUndefined()
  })

  it('reconstructs a rest item from the -1 sentinel', () => {
    const tuple: CompactMelodyItem = [-1, 0, 2]
    const [item] = generateMelodyItemsFromCompact([tuple])
    expect(item.isRest).toBe(true)
    expect(item.startBeat).toBe(0)
    expect(item.duration).toBe(2)
  })

  it('filters out an out-of-range MIDI value instead of throwing', () => {
    const items = generateMelodyItemsFromCompact([
      [20, 0, 1], // below 21 — invalid
      [60, 1, 1], // valid
      [109, 2, 1], // above 108 — invalid
    ])
    expect(items.length).toBe(1)
    expect(items[0].note.midi).toBe(60)
  })

  it('filters out a negative startBeat or non-positive duration', () => {
    const items = generateMelodyItemsFromCompact([
      [60, -1, 1],
      [60, 0, 0],
      [60, 0, -1],
      [60, 1, 1], // only this one is valid
    ])
    expect(items.length).toBe(1)
    expect(items[0].startBeat).toBe(1)
  })

  it('falls back to defaults when an optional field has the wrong runtime type', () => {
    // velocity slot holds a string instead of a number — type guard should
    // reject it and fall back to the default rather than propagating garbage.
    const tuple = [60, 0, 1, 'not-a-number'] as unknown as CompactMelodyItem
    const [item] = generateMelodyItemsFromCompact([tuple])
    expect(item.velocity).toBe(100)
  })

  it('assigns sequential 1-based ids in input order', () => {
    const items = generateMelodyItemsFromCompact([
      [60, 0, 1],
      [62, 1, 1],
      [64, 2, 1],
    ])
    expect(items.map((i) => i.id)).toEqual([1, 2, 3])
  })

  it('returns an empty array for an empty input', () => {
    expect(generateMelodyItemsFromCompact([])).toEqual([])
  })
})

describe('generateShareHashUrl / generateShareFullUrl', () => {
  it('builds a hash-only URL', () => {
    expect(generateShareHashUrl('abc123')).toBe('#/share/abc123')
  })

  it('builds a full URL using window.location when available', () => {
    const url = generateShareFullUrl('abc123')
    expect(url).toContain('#/share/abc123')
  })
})
