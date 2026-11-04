// ============================================================
// Lesson 11 lines tests — every line's notes, times and gears
// ============================================================
//
// WEB-SPEC, Tests 1 to 3 and 9: the cold open's sirens, 8.5 s, gliding at
// 1.7677 semitones a second with the 2-semitone jump from 1.697 s to
// 1.737 s and back from 6.763 s to 6.803 s; Step 1's notes; Step 2's slide
// at speed and slowed; Step 3's later switch and its one-gear slide; Step
// 4's five slides, their jumps and crossfades; Step 5's figure, its gear
// changing at exactly the three leaps across the seam; and Sing it's siren
// in one gear. The gear model: both gears share every point's time and
// pitch, their levels add to the line's at every point, a crossfade has a
// point every 10 ms, and Hide the switch holds both at half. Every line
// sits in the steps' window, and Sing it's siren inside every preset of its
// voice with at least 3 semitones to spare above, against the app's own
// VOCAL_RANGES (FACTS 62).

import { describe, expect, it } from 'vitest'
import { hz } from '@/features/lessons/kit/notes'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import type { VocalRangePreset } from '@/stores/settings-store'
import { VOCAL_RANGES } from '@/stores/settings-store'
import type { GearLine } from './lines'
import { figureDrawn, figureLine, figureNotes, gearContours, gearNote, gearNoteOf, gearPair, laterSlide, lineFrom, lineLength, N, oneGearSlide, singSirenLine, SIREN_RATE, sirenLine, SMOOTHER_SEC, smootherRun, smootherSeam, smootherSlide, spoken, STEPS_WINDOW, stretched, upHalf, } from './lines'

const VOICES: readonly Voice[] = ['lower', 'higher']

const PRESETS: Readonly<Record<Voice, readonly VocalRangePreset[]>> = {
  lower: ['tenor', 'baritone', 'bass'],
  higher: ['soprano', 'mezzo-soprano', 'alto'],
}

/** The line's note at `t`, from its points. */
function noteAt(line: GearLine, t: number): number {
  const i = line.findIndex((p) => p.t >= t - 1e-9)
  const b = line[i]
  if (Math.abs(b.t - t) < 1e-9 || i === 0) return b.midi
  const a = line[i - 1]
  return a.midi + ((b.midi - a.midi) * (t - a.t)) / (b.t - a.t)
}

/** The stretches where the share moves: each crossfade's first and last point. */
function crossfades(line: GearLine): { t0: number; t1: number }[] {
  const out: { t0: number; t1: number }[] = []
  let open: number | null = null
  for (let i = 1; i < line.length; i++) {
    const moving = line[i].share !== line[i - 1].share
    if (moving && open === null) open = line[i - 1].t
    if (!moving && open !== null) {
      out.push({ t0: open, t1: line[i - 1].t })
      open = null
    }
  }
  if (open !== null) out.push({ t0: open, t1: line[line.length - 1].t })
  return out
}

/** The line's share at `t`: its last point's at or before it. */
const shareAt = (line: GearLine, t: number): number =>
  [...line].reverse().find((p) => p.t <= t + 1e-9)?.share ?? NaN

const near = (a: number, b: number, digits = 3): void => {
  expect(a).toBeCloseTo(b, digits)
}

describe("the cold open's sirens (FACTS 75)", () => {
  it('runs 8.5 s, D4 up to B4 and back for Tavi, E3 up to C sharp 4 and back for Merc', () => {
    for (const [v, lo, hi] of [
      ['higher', N.D4, N.B4],
      ['lower', N.E3, N.Cs4],
    ] as const) {
      // Act
      const line = sirenLine(v)

      // Assert
      expect(lineLength(line)).toBeCloseTo(8.5, 9)
      expect(Math.min(...line.map((p) => p.midi))).toBe(lo)
      expect(Math.max(...line.map((p) => p.midi))).toBe(hi)
      expect([line[0].midi, line[line.length - 1].midi]).toEqual([lo, lo])
    }
  })

  it('glides at 1.7677 semitones a second, jumps 2 semitones from 1.697 s to 1.737 s, and back from 6.763 s to 6.803 s', () => {
    // Arrange
    const line = sirenLine('lower')

    const up = 3 / SIREN_RATE
    const down = 4.5 + 4 / SIREN_RATE

    // Act and assert: the glide, then the jump up, then the jump back down
    near(SIREN_RATE, 1.7677, 4)
    near(noteAt(line, 1) - N.E3, 1.7677)
    expect(
      [up, up + 0.04, down, down + 0.04].map((t) => +t.toFixed(3)),
    ).toEqual([1.697, 1.737, 6.763, 6.803])
    near(noteAt(line, up), N.G3, 9)
    near(noteAt(line, up + 0.04), N.A3, 9)
    near(noteAt(line, down), N.A3, 9)
    near(noteAt(line, down + 0.04), N.G3, 9)
    expect(noteAt(line, 4.25)).toBe(N.Cs4)
  })

  it('sings the lower gear below the switch and the upper above it, crossing over in each 40 ms jump', () => {
    // Act
    const line = sirenLine('higher')
    const fades = crossfades(line)

    // Assert
    expect(fades.map((f) => +(f.t1 - f.t0).toFixed(3))).toEqual([0.04, 0.04])
    near(fades[0].t0, 1.697)
    near(fades[1].t0, 6.763)
    expect([shareAt(line, 1), shareAt(line, 3)]).toEqual([1, 0])
  })
})

describe("the steps' lines", () => {
  it('gives Step 1 and the four words G sharp 3, or F sharp 4, for 2.0 s in one gear', () => {
    for (const [v, m] of [
      ['lower', N.Gs3],
      ['higher', N.Fs4],
    ] as const) {
      const lower = gearNote(v, 1)
      const upper = gearNote(v, 0)
      expect(gearNoteOf(v)).toBe(m)
      expect([lineLength(lower), lineLength(upper)]).toEqual([2, 2])
      expect(lower.every((p) => p.midi === m && p.share === 1)).toBe(true)
      expect(upper.every((p) => p.midi === m && p.share === 0)).toBe(true)
    }
  })

  it("puts 0.3 s of quiet between Register's two notes", () => {
    // Act
    const pair = gearPair('lower')

    // Assert
    expect(lineLength(pair)).toBeCloseTo(4.3, 9)
    expect(
      pair.filter((p) => p.t > 2 && p.t < 2.26).every((p) => p.level === 0),
    ).toBe(true)
    expect([shareAt(pair, 1), shareAt(pair, 3)]).toEqual([1, 0])
  })

  it("plays Step 2's slide in 4.0 s, and slowed in 8.0 s with its jump in 0.08 s, at the same pitches", () => {
    // Act
    const slide = upHalf('lower')
    const slow = stretched(slide, 2)
    const fades = crossfades(slow)

    // Assert
    expect([lineLength(slide), lineLength(slow)]).toEqual([4, 8])
    expect(slow.map((p) => p.midi)).toEqual(slide.map((p) => p.midi))
    expect(+(fades[0].t1 - fades[0].t0).toFixed(3)).toBe(0.08)
    expect([slide[0].midi, slide[slide.length - 1].midi]).toEqual([N.E3, N.Cs4])
  })

  it("switches Step 3's second slide later, from 2.829 s, and keeps its third in one gear at 2.25 semitones a second", () => {
    for (const v of VOICES) {
      // Act
      const later = laterSlide(v)
      const one = oneGearSlide(v)

      // Assert
      const at = crossfades(later)[0].t0
      near(at, 2.829)
      near(noteAt(later, at + 0.04) - noteAt(later, at), 2, 9)
      expect(lineLength(later)).toBeCloseTo(4, 9)
      expect(crossfades(one)).toEqual([])
      expect(one.every((p) => p.share === (v === 'lower' ? 1 : 0))).toBe(true)
      near(noteAt(one, 1) - noteAt(one, 0), 2.25)
    }
  })

  it("plays Step 4's five slides in 3.9 s each with 0.6 s between, 21.9 s in all", () => {
    for (const v of VOICES) {
      expect(lineLength(smootherSlide(v, 0))).toBeCloseTo(3.9, 9)
      expect(lineLength(smootherRun(v))).toBeCloseTo(21.9, 9)
      expect(SMOOTHER_SEC).toBeCloseTo(21.9, 9)
    }
  })

  it("narrows Step 4's jump from 2 to a quarter of a semitone round G sharp 3, each in 0.04 s, up and back at the same notes", () => {
    for (const [v, centre] of [
      ['lower', N.Gs3],
      ['higher', N.Fs4],
    ] as const) {
      const jumps = [0, 1, 2, 3, 4].map((k) => {
        const seam = smootherSeam(v, k)
        expect((seam.lo + seam.hi) / 2).toBe(centre)
        const line = smootherSlide(v, k)
        // the jump's 40 ms: the pitch leaves the seam's foot and lands on its head
        const up = line.find(
          (p) => Math.abs(p.midi - seam.lo) < 1e-9 && p.t > 0.5,
        )
        expect(up).toBeDefined()
        near(noteAt(line, (up?.t ?? 0) + 0.04), seam.hi, 6)
        return seam.hi - seam.lo
      })
      expect(jumps).toEqual([2, 1.5, 1, 0.5, 0.25])
    }
  })

  it("lengthens Step 4's crossfade from 40 to 120, 250, 400 and 600 ms, centred on each jump", () => {
    // Act
    const widths = [0, 1, 2, 3, 4].map((k) =>
      crossfades(smootherSlide('lower', k)).map(
        (f) => +(f.t1 - f.t0).toFixed(3),
      ),
    )

    // Assert: each slide crosses over twice, up and back
    expect(widths).toEqual([
      [0.04, 0.04],
      [0.12, 0.12],
      [0.25, 0.25],
      [0.4, 0.4],
      [0.6, 0.6],
    ])
  })

  it("plays Step 5's figure in 3.6 s, its gear changing at exactly the three leaps across the seam", () => {
    for (const v of VOICES) {
      // Act
      const flip = figureLine(v, 'flip')
      const fades = crossfades(flip)

      // Assert: G3 to C4, B3 to G3 and G3 to C4, at 0.4, 1.2 and 2.4 s
      expect(lineLength(flip)).toBeCloseTo(3.6, 9)
      expect(fades.map((f) => +((f.t0 + f.t1) / 2).toFixed(3))).toEqual([
        0.4, 1.2, 2.4,
      ])
      expect(fades.every((f) => +(f.t1 - f.t0).toFixed(3) === 0.04)).toBe(true)
    }
  })

  it("names the higher voice's figure ten semitones up: F4, A sharp 4, A4, F4, D4, F4, A sharp 4", () => {
    expect(figureNotes('higher').map(spoken)).toEqual([
      'F 4',
      'A sharp 4',
      'A 4',
      'F 4',
      'D 4',
      'F 4',
      'A sharp 4',
    ])
  })

  it('holds both gears at half the sound through Hide the switch, drawn 4 px wide', () => {
    expect(figureLine('lower', 'hide').every((p) => p.share === 0.5)).toBe(true)
    expect(
      figureDrawn('lower', 'hide')
        .filter((p) => p.midi !== null)
        .every((p) => p.share === 0.5),
    ).toBe(true)
  })

  it("sings Sing it's siren in one gear, E3 to C sharp 4 or E4 to C sharp 5, 8.5 s at 2.25 semitones a second", () => {
    for (const [v, lo, share] of [
      ['lower', N.E3, 1],
      ['higher', N.E4, 0],
    ] as const) {
      const line = singSirenLine(v)
      expect(lineLength(line)).toBeCloseTo(8.5, 9)
      expect(Math.max(...line.map((p) => p.midi))).toBe(lo + 9)
      expect(line.every((p) => p.share === share)).toBe(true)
      near(noteAt(line, 2) - noteAt(line, 1), 2.25)
    }
  })
})

describe('the gear model (FACTS 74)', () => {
  const every = (v: Voice): GearLine[] => [
    sirenLine(v),
    upHalf(v),
    laterSlide(v),
    oneGearSlide(v),
    gearPair(v),
    smootherRun(v),
    figureLine(v, 'flip'),
    figureLine(v, 'hide'),
    singSirenLine(v),
  ]

  it("gives both gears every point at one time and one pitch, their levels adding to the line's", () => {
    for (const v of VOICES)
      for (const line of every(v)) {
        // Act
        const { lower, upper } = gearContours(line)

        // Assert
        expect(lower.map((p) => [p.t, p.hz])).toEqual(
          upper.map((p) => [p.t, p.hz]),
        )
        line.forEach((p, i) =>
          expect((lower[i].level ?? 0) + (upper[i].level ?? 0)).toBeCloseTo(
            p.level,
            9,
          ),
        )
      }
  })

  it('writes a crossfade as a point every 10 ms', () => {
    for (const line of [sirenLine('lower'), smootherSlide('lower', 4)])
      for (const f of crossfades(line)) {
        const inside = line.filter(
          (p) => p.t >= f.t0 - 1e-9 && p.t <= f.t1 + 1e-9,
        )
        const gaps = inside.slice(1).map((p, i) => p.t - inside[i].t)
        expect(Math.max(...gaps)).toBeLessThanOrEqual(0.01 + 1e-6)
      }
  })

  it("keeps every line Merc sings inside the steps' window, C3 to E5", () => {
    for (const v of VOICES)
      for (const line of every(v).slice(0, 8))
        for (const p of line) {
          expect(p.midi).toBeGreaterThanOrEqual(STEPS_WINDOW.lo)
          expect(p.midi).toBeLessThanOrEqual(STEPS_WINDOW.hi)
        }
  })

  it("keeps Sing it's siren inside every preset of its voice, with at least 3 semitones to spare above", () => {
    for (const v of VOICES) {
      const notes = singSirenLine(v).map((p) => p.midi)
      for (const preset of PRESETS[v]) {
        const range = VOCAL_RANGES[preset]
        expect(Math.min(...notes), preset).toBeGreaterThanOrEqual(range.lowMidi)
        expect(
          range.highMidi - Math.max(...notes),
          preset,
        ).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('plays every fixed note at its frequency in FACTS 73', () => {
    const facts: Record<string, number> = {
      C3: 130.81,
      E3: 164.81,
      F3: 174.61,
      Fs3: 185.0,
      G3: 196.0,
      Gs3: 207.65,
      A3: 220.0,
      As3: 233.08,
      B3: 246.94,
      C4: 261.63,
      Cs4: 277.18,
      D4: 293.66,
      E4: 329.63,
      F4: 349.23,
      Fs4: 369.99,
      G4: 392.0,
      Gs4: 415.3,
      A4: 440.0,
      As4: 466.16,
      B4: 493.88,
      C5: 523.25,
      Cs5: 554.37,
      E5: 659.26,
    }
    for (const [name, f] of Object.entries(facts))
      expect(hz(N[name as keyof typeof N]), name).toBeCloseTo(f, 2)
  })
})

describe('a line carried on from where it stood', () => {
  it('starts at the point it stood on, mid-crossfade, and keeps the rest of the line in its times', () => {
    // Arrange
    const line = upHalf('lower')
    const t0 = 3 / SIREN_RATE + 0.015

    // Act
    const rest = lineFrom(line, t0)

    // Assert
    expect(rest[0].t).toBe(0)
    expect(rest[0].share).toBeCloseTo(0.625, 9)
    expect(rest[0].midi).toBeCloseTo(N.G3 + 0.75, 9)
    expect(lineLength(rest)).toBeCloseTo(lineLength(line) - t0, 9)
    expect(rest.slice(1)).toEqual(
      line.filter((p) => p.t > t0).map((p) => ({ ...p, t: p.t - t0 })),
    )
  })

  it('is the line itself from its start, and its last point alone from its end', () => {
    // Arrange
    const line = upHalf('higher')

    // Act
    const whole = lineFrom(line, 0)
    const after = lineFrom(line, 9)

    // Assert
    expect(whole).toBe(line)
    expect(after).toEqual([{ ...line[line.length - 1], t: 0 }])
  })
})
