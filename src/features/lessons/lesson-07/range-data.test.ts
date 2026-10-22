// ============================================================
// Lesson 7 data tests — every number the chart draws and Merc sings
// ============================================================
//
// The WEB-SPEC's Tests 1 to 5 and 9: "Twinkle" (FACTS 83), the windows and
// the column against the app's presets and its middle-half rule (FACTS 87,
// 35), Merc's siren (FACTS 82, 56), Step 3's slide (FACTS 84), the push
// curve and its words (FACTS 85), Step 5's singers and bands (FACTS 86),
// and every fixed sound at its frequency (FACTS 81).

import { describe, expect, it } from 'vitest'
import { hz } from '@/features/lessons/kit/notes'
import { middleHalf } from '@/lib/mirror/metrics'
import { VOCAL_RANGES } from '@/stores/settings-store'
import type { ChartVoice } from './range-data'
import { bandLabel, bandMiddle, BANDS, bandSaid, bandSpan, columnOf, pushFill, pushOf, pushReadout, pushWords, SINGERS, SIREN_SEC, SIREN_SLOW_SEC, sirenAt, sirenContour, sirenContourFrom, sirenEnds, sirenLine, sirenWhere, slideBounds, slidePlace, slideReadout, spoken, twinkle, TWINKLE_SEC, twinkleDo, TYPES_WINDOW, WINDOWS, } from './range-data'

const VOICES: readonly ChartVoice[] = ['lower', 'higher']
const GROUPS: Readonly<Record<ChartVoice, readonly string[]>> = {
  lower: ['bass', 'baritone', 'tenor'],
  higher: ['alto', 'mezzo-soprano', 'soprano'],
}
const presets = (v: ChartVoice) =>
  GROUPS[v].map((id) => VOCAL_RANGES[id as keyof typeof VOCAL_RANGES])

describe('"Twinkle"', () => {
  it('is fourteen notes in 8 s, spanning 9 semitones from E3 and from E4', () => {
    for (const v of VOICES) {
      // Act
      const notes = twinkle(twinkleDo(v))
      const midis = notes.map((n) => n.midi)

      // Assert
      expect(notes).toHaveLength(14)
      expect(TWINKLE_SEC).toBe(8)
      expect(Math.max(...midis) - Math.min(...midis)).toBe(9)
      expect(midis[0]).toBe(v === 'lower' ? 52 : 64)
    }
  })

  it('runs E3 E3 B3 B3 C♯4 C♯4 B3, A3 A3 G♯3 G♯3 F♯3 F♯3 E3, a minim ending each line', () => {
    // Act
    const notes = twinkle(52)

    // Assert
    expect(notes.map((n) => n.midi)).toEqual([
      52, 52, 59, 59, 61, 61, 59, 57, 57, 56, 56, 54, 54, 52,
    ])
    expect(notes.map((n) => n.dur)).toEqual([
      0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1,
    ])
    expect(notes.map((n) => n.t).at(-1)).toBe(7)
  })
})

describe('the windows and the column', () => {
  it("hold every preset of each voice's group, and nothing wider", () => {
    for (const v of VOICES) {
      const p = presets(v)
      expect(WINDOWS[v].lo).toBe(Math.min(...p.map((r) => r.lowMidi)))
      expect(WINDOWS[v].hi).toBe(Math.max(...p.map((r) => r.highMidi)))
    }
  })

  it('light the middle half of a two-octave column, by the Vocal Range Test’s rule', () => {
    for (const v of VOICES) {
      // Act
      const c = columnOf(v)

      // Assert
      expect(c.hi - c.lo).toBe(24)
      expect(c.lit).toEqual({
        lo: middleHalf(c.lo, c.hi).low,
        hi: middleHalf(c.lo, c.hi).high,
      })
      expect(c.lo).toBeGreaterThanOrEqual(WINDOWS[v].lo)
      expect(c.hi).toBeLessThanOrEqual(WINDOWS[v].hi)
    }
    expect(columnOf('lower')).toEqual({
      lo: 45,
      hi: 69,
      lit: { lo: 51, hi: 63 },
    })
  })

  it("show Step 5's singers and all six bands in one view, E2 to C6", () => {
    expect(TYPES_WINDOW).toEqual({ lo: 40, hi: 84 })
    for (const s of [...Object.values(SINGERS), ...BANDS]) {
      expect(s.lo).toBeGreaterThanOrEqual(TYPES_WINDOW.lo)
      expect(s.hi).toBeLessThanOrEqual(TYPES_WINDOW.hi)
    }
    for (const b of BANDS) {
      const preset = VOCAL_RANGES[b.id as keyof typeof VOCAL_RANGES]
      expect([b.lo, b.hi]).toEqual([preset.lowMidi, preset.highMidi])
    }
  })
})

describe("Merc's siren", () => {
  it('runs E3 to C♯4 and E4 to C♯5 in 6.0 s, even in semitones', () => {
    // Assert
    expect(sirenEnds('lower')).toEqual({ low: 52, high: 61 })
    expect(sirenEnds('higher')).toEqual({ low: 64, high: 73 })
    expect(SIREN_SEC).toBeCloseTo(6, 9)
    expect(SIREN_SLOW_SEC).toBeCloseTo(12, 9)
    // halfway up is halfway in semitones: even in semitones
    expect(sirenAt('lower', 1.4)).toBeCloseTo(56.5, 9)
    expect(sirenAt('lower', 3)).toBe(61)
    expect(sirenAt('lower', 6)).toBe(52)
  })

  it('glides exponentially in hertz, the same path at half speed for Slow', () => {
    // Act
    const once = sirenContour('lower')
    const slow = sirenContour('lower', 0.5)

    // Assert
    expect(once.map((p) => p.hz)).toEqual([hz(52), hz(61), hz(61), hz(52)])
    expect(once.map((p) => p.t.toFixed(9))).toEqual(
      [0, 2.8, 3.2, 6].map((t) => t.toFixed(9)),
    )
    expect(slow.at(-1)?.t).toBeCloseTo(12, 9)
  })

  it('carries on from where the line stands after Pause or the scrub bar', () => {
    // Act
    const whole = sirenContourFrom('lower', 0)
    const turning = sirenContourFrom('lower', 3, 0.5)
    const down = sirenContourFrom('lower', 4.6)

    // Assert
    expect(whole).toEqual(sirenContour('lower'))
    expect(turning.map((p) => p.hz)).toEqual([hz(61), hz(61), hz(52)])
    expect(turning.map((p) => p.t.toFixed(9))).toEqual(
      [0, 0.4, 6].map((t) => t.toFixed(9)),
    )
    expect(down[0].hz).toBeCloseTo(hz(sirenAt('lower', 4.6)), 9)
    expect(down.map((p) => p.t.toFixed(9))).toEqual(
      [0, 1.4].map((t) => t.toFixed(9)),
    )
  })

  it('stays inside the lit middle and inside every preset of its group', () => {
    for (const v of VOICES) {
      const { low, high } = sirenEnds(v)
      const { lit } = columnOf(v)
      expect(low).toBeGreaterThanOrEqual(lit.lo)
      expect(high).toBeLessThanOrEqual(lit.hi)
      for (const p of presets(v)) {
        expect(low).toBeGreaterThanOrEqual(p.lowMidi)
        expect(high).toBeLessThanOrEqual(p.highMidi)
      }
      for (const point of sirenLine(v)) {
        expect(point.midi).toBeGreaterThanOrEqual(low)
        expect(point.midi).toBeLessThanOrEqual(high)
      }
    }
  })

  it('says where it is in words, never in signs', () => {
    expect(sirenWhere('lower', 2.1)).toBe(
      '2.1 seconds of 6: going up, near B 3',
    )
    expect(sirenWhere('lower', 3)).toBe(
      '3.0 seconds of 6: turning round, near C sharp 4',
    )
    for (let t = 0; t <= 6; t += 0.1)
      expect(sirenWhere('higher', t)).not.toMatch(/[♯♭]/)
  })
})

describe("Step 3's slide", () => {
  it('runs do from the column’s bottom to 15 semitones up, so the tune stays in the column', () => {
    for (const v of VOICES) {
      const { min, max } = slideBounds(v)
      const c = columnOf(v)
      expect(min).toBe(c.lo)
      expect(max).toBe(c.lo + 15)
      expect(max + 9).toBe(c.hi)
    }
  })

  it('reads all of it in the lit middle from 1 down to 2 up, the top end at 3 up', () => {
    // Arrange
    const from = twinkleDo('lower')

    // Act
    const places = [-2, -1, 0, 1, 2, 3].map((m) =>
      slidePlace('lower', from + m),
    )

    // Assert
    expect(places).toEqual([
      'bottom',
      'middle',
      'middle',
      'middle',
      'middle',
      'top',
    ])
    expect(slideReadout('lower', from + 2)).toBe(
      'Moved up 2 semitones: all of it in the lit middle',
    )
    expect(slideReadout('lower', from + 3)).toBe(
      'Moved up 3 semitones: reaching into the dimmed top end',
    )
    expect(slideReadout('higher', twinkleDo('higher') - 1)).toBe(
      'Moved down 1 semitone: all of it in the lit middle',
    )
    expect(slideReadout('lower', from - 7)).toBe(
      'Moved down 7 semitones: reaching into the dimmed bottom end',
    )
  })
})

describe("Step 4's push curve", () => {
  it('is lowest at F3, a quarter of its top value at the bottom, its top value at the top', () => {
    // Assert
    expect(pushOf(8)).toBe(0)
    expect(pushOf(0)).toBeCloseTo(pushOf(24) / 4, 9)
    expect(pushOf(24)).toBe(1)
    for (let s = 9; s <= 24; s++)
      expect(pushOf(s)).toBeGreaterThan(pushOf(s - 1))
    expect(pushFill(8)).toBeCloseTo(0.12, 9)
    expect(pushFill(24)).toBeCloseTo(1, 9)
  })

  it("names every note of both columns in the curve's words, as FACTS 85 lists them", () => {
    // Arrange: FACTS 85's regions, by note, for the lower column
    const words: Record<string, string> = {}
    const c = columnOf('lower')
    for (let m = c.lo; m <= c.hi; m++) words[spoken(m)] = pushWords(m - c.lo)

    // Assert
    expect(words['F 3']).toBe("the least push, the curve's lowest point")
    for (const n of ['D sharp 3', 'E 3', 'F sharp 3', 'G 3'])
      expect(words[n]).toBe('nearly the least push')
    for (const n of [
      'A sharp 2',
      'B 2',
      'C 3',
      'C sharp 3',
      'D 3',
      'G sharp 3',
      'A 3',
      'A sharp 3',
      'B 3',
      'C 4',
    ])
      expect(words[n]).toBe('a little more push')
    for (const n of ['A 2', 'C sharp 4', 'D 4', 'D sharp 4', 'E 4', 'F 4'])
      expect(words[n]).toBe('more push')
    for (const n of ['F sharp 4', 'G 4', 'G sharp 4', 'A 4'])
      expect(words[n]).toBe('much more push')
    // the higher column, an octave up
    const h = columnOf('higher')
    for (let m = h.lo; m <= h.hi; m++)
      expect(pushWords(m - h.lo)).toBe(words[spoken(m - 12)])
  })

  it('reads the ends of the column for a screen reader, and puts no number or sign in it', () => {
    // Act
    const bottom = pushReadout('lower', 45)
    const top = pushReadout('lower', 69)
    const sharp = pushReadout('lower', 61)

    // Assert
    expect(bottom.spoken).toBe('A 2, the bottom of the column: more push')
    expect(top.text).toBe('A4: much more push')
    expect(top.spoken).toBe('A 4, the top of the column: much more push')
    expect(sharp.text).toBe('C♯4: more push')
    expect(sharp.spoken).toBe('C sharp 4: more push')
    for (let m = 45; m <= 69; m++) {
      const r = pushReadout('lower', m)
      expect(r.spoken).not.toMatch(/[♯♭]/)
      expect(r.text.replace(/^[A-G]♯?\d/, '')).not.toMatch(/\d/)
    }
  })
})

describe("Step 5's singers and bands", () => {
  it('give both singers A3 to C6, comfortable E4 to E5 and C4 to C5', () => {
    expect([SINGERS.a.lo, SINGERS.a.hi, SINGERS.b.lo, SINGERS.b.hi]).toEqual([
      57, 84, 57, 84,
    ])
    expect(SINGERS.a.lit).toEqual({ lo: 64, hi: 76 })
    expect(SINGERS.b.lit).toEqual({ lo: 60, hi: 72 })
    expect(SINGERS.a.probably).toBe('probably a soprano')
    expect(SINGERS.b.probably).toBe('probably a mezzo-soprano')
  })

  it('play each band’s middle note: E3, G3, C4, F4, A4 and C5', () => {
    expect(BANDS.map(bandMiddle).map(spoken)).toEqual([
      'E 3',
      'G 3',
      'C 4',
      'F 4',
      'A 4',
      'C 5',
    ])
  })

  it('name each band in words, its visible name first', () => {
    const tenor = BANDS[2]
    expect(bandLabel(tenor)).toBe(
      'Tenor, C 3 to C 5: play its middle note, C 4',
    )
    expect(bandSaid(tenor)).toBe('Tenor: C 3 to C 5')
    expect(bandSpan(tenor)).toBe('C3 to C5')
    for (const b of BANDS) expect(bandLabel(b).startsWith(b.name)).toBe(true)
  })
})

describe('every fixed sound', () => {
  it("sits at FACTS 81's frequencies", () => {
    // Arrange: FACTS 81, to the hundredth of a hertz
    const facts: Record<number, number> = {
      40: 82.41,
      43: 98.0,
      45: 110.0,
      48: 130.81,
      52: 164.81,
      54: 185.0,
      55: 196.0,
      56: 207.65,
      57: 220.0,
      59: 246.94,
      60: 261.63,
      61: 277.18,
      64: 329.63,
      65: 349.23,
      66: 369.99,
      68: 415.3,
      69: 440.0,
      71: 493.88,
      72: 523.25,
      73: 554.37,
      76: 659.26,
    }
    const used = new Set<number>([
      ...twinkle(52).map((n) => n.midi),
      ...twinkle(64).map((n) => n.midi),
      ...Object.values(sirenEnds('lower')),
      ...Object.values(sirenEnds('higher')),
      ...BANDS.map(bandMiddle),
    ])

    // Assert
    for (const m of used) {
      expect(facts[m], `MIDI ${m}`).toBeDefined()
      expect(hz(m)).toBeCloseTo(facts[m], 1)
    }
  })
})
