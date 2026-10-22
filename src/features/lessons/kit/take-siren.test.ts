// ============================================================
// Siren reading tests — where a sung siren sat, on synthetic frames
// ============================================================
//
// Lesson 7's checkpoint reads one gentle siren (its WEB-SPEC, Toys 4 and
// Tests 6). The frames are what the F0 stream hands over, one every 16 ms
// (the detector's hop), silent until the voice starts; a glide is even in
// semitones, as a siren is drawn. Every case is the WEB-SPEC's: the attack
// off the raw frames, Voice Mirror's own range reader on what is left, the
// middle half of what it held, or its centre under three semitones, and
// never a span or an end of the siren named.

import { describe, expect, it } from 'vitest'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import type { F0Frame } from '@/lib/mirror/metrics'
import { DEFAULT_HOP_SEC } from '@/lib/mirror/metrics'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { sharpOf, signName } from './notes'
import { readSiren, SIREN_NONE_LINE, SIREN_UNSTEADY_LINE, sirenBand, sirenLine, } from './take'

const HOP = DEFAULT_HOP_SEC

/** A stretch of a take: a held note, a glide between two, or silence. */
type Part =
  | { readonly hold: number; readonly midi: number }
  | { readonly glide: number; readonly from: number; readonly to: number }
  | { readonly rest: number }

const hzOf = (midi: number): number => 440 * 2 ** ((midi - 69) / 12)

/** The raw frames of a take made of `parts`, after `wait` seconds of silence. */
function take(parts: readonly Part[], wait = 0.5): F0Frame[] {
  const frames: F0Frame[] = []
  let t = 0
  for (; t < wait - 1e-9; t += HOP) frames.push({ t, f0: 0, conf: 0 })
  for (const p of parts) {
    const len = 'hold' in p ? p.hold : 'glide' in p ? p.glide : p.rest
    const steps = Math.round(len / HOP)
    for (let i = 0; i < steps; i++, t += HOP) {
      if ('rest' in p) {
        frames.push({ t, f0: 0, conf: 0 })
        continue
      }
      const midi = 'hold' in p ? p.midi : p.from + ((p.to - p.from) * i) / steps
      frames.push({ t, f0: hzOf(midi), conf: 0.95 })
    }
  }
  return frames
}

const E3 = 52
const E4 = 64
const A3 = 57

/** A siren from `low` up to `high` and back, `each` seconds a way. */
const siren = (low: number, high: number, each: number): Part[] => [
  { glide: each, from: low, to: high },
  { glide: each, from: high, to: low },
]

describe('readSiren', () => {
  it('reads 0.5 s on E3 and a glide to E4 and back as about G3 to C♯4', () => {
    // Act
    const r = readSiren(take([{ hold: 0.5, midi: E3 }, ...siren(E3, E4, 3)]))

    // Assert
    expect(r.kind).toBe('half')
    expect(r.band).toEqual({ low: 55, high: 61 })
    expect(r.line).toBe(
      'The lit band is the middle half of your siren: about G3 to C♯4.',
    )
    expect(r.spoken).toBe(
      'The lit band is the middle half of your siren: about G3 to C sharp 4.',
    )
  })

  it('reads the same glide with no time on E3 as about G♯3 to C♯4: the attack leaves E3 short', () => {
    // Act
    const r = readSiren(take(siren(E3, E4, 3)))

    // Assert
    expect(r.band).toEqual({ low: 56, high: 61 })
    expect(r.line).toBe(
      'The lit band is the middle half of your siren: about G♯3 to C♯4.',
    )
  })

  it('reads a steady A3 for 3 s as its one note', () => {
    // Act
    const r = readSiren(take([{ hold: 3, midi: A3 }]))

    // Assert
    expect(r.kind).toBe('centre')
    expect(r.line).toBe('The lit band is the middle of your siren: about A3.')
  })

  it('reads C3, a glide to G4 over 4 s and 0.5 s there as about F3 to D4', () => {
    // Act
    const r = readSiren(
      take([
        { hold: 0.5, midi: 48 },
        { glide: 4, from: 48, to: 67 },
        { hold: 0.5, midi: 67 },
      ]),
    )

    // Assert
    expect(r.line).toBe(
      'The lit band is the middle half of your siren: about F3 to D4.',
    )
  })

  it('leaves the band where it was after a 0.1 s octave jump inside the glide', () => {
    // Arrange: the same siren, a tenth of a second of it read an octave up
    const clean = take([{ hold: 0.5, midi: E3 }, ...siren(E3, E4, 3)])
    const jumped = clean.map((f) =>
      f.t >= 2.5 && f.t < 2.6 ? { ...f, f0: f.f0 * 2 } : f,
    )

    // Act
    const r = readSiren(jumped)

    // Assert
    expect(r.band).toEqual(readSiren(clean).band)
  })

  it('calls 0.8 s of voice not steady, with no "Try again" of its own', () => {
    // Act
    const r = readSiren(take([{ hold: 0.8, midi: A3 }]))

    // Assert
    expect([r.kind, r.heard, r.band]).toEqual(['unsteady', true, null])
    expect(r.line).toBe(SIREN_UNSTEADY_LINE)
    expect(r.line).not.toMatch(/try again/i)
  })

  it('says it did not hear the start when no voice came', () => {
    // Act
    const r = readSiren(take([{ rest: 6 }], 0))

    // Assert
    expect([r.kind, r.heard, r.band]).toEqual(['none', false, null])
    expect(r.line).toBe(SIREN_NONE_LINE)
    expect(r.line).toBe(
      "We didn't hear you start that time. Hum “ng” as the ring turns.",
    )
  })

  it('reads spans of 1 and 2 semitones as one note, the centre', () => {
    // Arrange
    const one = take([
      { hold: 0.8, midi: A3 },
      { hold: 0.5, midi: A3 + 1 },
      { hold: 0.5, midi: A3 },
    ])
    const two = take([
      { hold: 0.8, midi: A3 },
      { glide: 0.6, from: A3, to: A3 + 2 },
      { hold: 0.4, midi: A3 + 2 },
      { glide: 0.6, from: A3 + 2, to: A3 },
    ])

    // Act
    const lines = [readSiren(one), readSiren(two)].map((r) => r.line)

    // Assert
    expect(lines).toEqual([
      'The lit band is the middle of your siren: about A♯3.',
      'The lit band is the middle of your siren: about A♯3.',
    ])
  })

  it('takes the attack off the raw frames before the range reader sees them', () => {
    // Arrange: 0.25 s on C3 would hold its own bin, were it not the attack
    const frames = take([
      { hold: 0.25, midi: 48 },
      { hold: 3, midi: A3 },
    ])

    // Act
    const r = readSiren(frames)

    // Assert: the C3 went with the attack, so only A3 is held
    expect(r.band).toEqual({ low: A3, high: A3 })
  })
})

describe('sirenBand', () => {
  it('is the centre under three semitones and names neither end from three up', () => {
    for (let low = 36; low <= 72; low++) {
      for (let span = 0; span <= 40; span++) {
        const high = low + span
        const band = sirenBand(low, high)
        if (span < 3) {
          expect(band).toEqual({
            low: Math.round((low + high) / 2),
            high: Math.round((low + high) / 2),
          })
        } else {
          expect(band.low).toBeGreaterThan(low)
          expect(band.high).toBeLessThan(high)
          expect(band.low).toBeLessThanOrEqual(band.high)
        }
      }
    }
  })

  it("spells every note as the app does: midiToNoteNameOctave's sharps", () => {
    for (let m = 36; m <= 84; m++)
      expect(signName(sharpOf(m)).replace('♯', '#')).toBe(
        midiToNoteNameOctave(m),
      )
  })
})

describe("the siren's lines", () => {
  it('pass the guided-voice claims check, as a finding', () => {
    // Arrange: every template, with notes in both forms
    const lines = [
      SIREN_NONE_LINE,
      SIREN_UNSTEADY_LINE,
      sirenLine({ low: 55, high: 61 }),
      sirenLine({ low: 57, high: 57 }),
      readSiren(take([{ hold: 0.5, midi: E3 }, ...siren(E3, E4, 3)])).spoken,
    ]

    for (const text of lines) {
      // Act
      const result = validateGuidedDynamicClaim({ surface: 'finding', text })

      // Assert
      expect(result.violations, text).toEqual([])
    }
  })

  it('name no span and no end: no "semitones", "range", "lowest" or "highest"', () => {
    const lines = [
      sirenLine({ low: 55, high: 61 }),
      sirenLine({ low: 57, high: 57 }),
    ]
    for (const line of lines)
      expect(line).not.toMatch(/semitone|range|lowest|highest|reach/i)
  })
})
