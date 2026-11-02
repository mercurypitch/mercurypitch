import { describe, expect, it } from 'vitest'
import { seededRandom } from '@/lib/sequence/phrase-bank'
import type { NoteWindow } from '@/lib/sequence/sung-window'
import { SUNG_HIGH, SUNG_LOW } from '@/lib/sequence/sung-window'
import type { HarmonyLine } from './harmony-line'
import { degreeMidi, lineShape, planLines } from './harmony-line'
import { HARMONY_LEVELS, HARMONY_LINES } from './harmony-rules'

/** The major scale's pitch classes from a tonic. */
const inKey = (tonic: number, midi: number): boolean =>
  [0, 2, 4, 5, 7, 9, 11].includes((((midi - tonic) % 12) + 12) % 12)

/** Each note's step to the next, in the key's degrees. */
function degreesOf(line: HarmonyLine): number[] {
  const degree = (midi: number): number => {
    for (let d = -14; d <= 28; d++) {
      if (degreeMidi(line.tonic, d) === midi) return d
    }
    throw new Error(`${midi} is not in the key`)
  }
  return line.merc.map(degree)
}

const WINDOWS: NoteWindow[] = [
  { low: 53, high: 65 },
  { low: SUNG_LOW, high: 60 },
  { low: 62, high: SUNG_HIGH },
  { low: 57, high: 69 },
]

describe("Harmony's lines", () => {
  it("counts the key's degrees up and down the scale", () => {
    expect(degreeMidi(60, 0)).toBe(60)
    expect(degreeMidi(60, 2)).toBe(64)
    expect(degreeMidi(60, 7)).toBe(72)
    expect(degreeMidi(60, -1)).toBe(59)
    expect(degreeMidi(60, -3)).toBe(55)
  })

  it('gives the key its own thirds: G A B A under B C D C in C', () => {
    const c = 48
    const merc = [4, 5, 6, 5].map((d) => degreeMidi(c, d))
    const harmony = [6, 7, 8, 7].map((d) => degreeMidi(c, d))
    expect(merc).toEqual([55, 57, 59, 57])
    expect(harmony).toEqual([59, 60, 62, 60])
  })

  it('moves by step at Learning and Singer, with one leap at Professional', () => {
    const random = seededRandom(7)
    for (let i = 0; i < 200; i++) {
      const steps = lineShape(4, false, random)
      expect(steps).toHaveLength(4)
      for (let j = 1; j < steps.length; j++) {
        expect(Math.abs(steps[j] - steps[j - 1])).toBe(1)
      }
      const leaping = lineShape(5, true, random)
      const moves = leaping.slice(1).map((d, j) => Math.abs(d - leaping[j]))
      expect(moves.filter((m) => m > 1)).toHaveLength(1)
      expect(Math.max(...moves)).toBeLessThanOrEqual(3)
      expect(Math.max(...leaping) - Math.min(...leaping)).toBeLessThanOrEqual(7)
    }
  })

  it.each(['learning', 'singer', 'professional'] as const)(
    'plans six lines at %s, the harmony a third from Merc in his key and in the window',
    (level) => {
      const rules = HARMONY_LEVELS[level]
      for (const window of WINDOWS) {
        for (let seed = 1; seed <= 40; seed++) {
          const lines = planLines(
            HARMONY_LINES,
            window,
            rules,
            seededRandom(seed),
          )
          expect(lines).toHaveLength(HARMONY_LINES)
          expect(lines.filter((l) => l.below)).toHaveLength(rules.linesBelow)
          for (const line of lines) {
            expect(line.merc).toHaveLength(rules.notes)
            const degrees = degreesOf(line)
            line.merc.forEach((midi, i) => {
              expect(inKey(line.tonic, midi)).toBe(true)
              const third = line.below ? -2 : 2
              expect(line.harmony[i]).toBe(
                degreeMidi(line.tonic, degrees[i] + third),
              )
              const apart = Math.abs(line.harmony[i] - midi)
              expect([3, 4]).toContain(apart)
            })
            for (const midi of line.harmony) {
              expect(midi).toBeGreaterThanOrEqual(window.low)
              expect(midi).toBeLessThanOrEqual(window.high)
            }
          }
        }
      }
    },
  )

  it('never sings a line a third below before the third line', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const lines = planLines(
        HARMONY_LINES,
        { low: 53, high: 65 },
        HARMONY_LEVELS.professional,
        seededRandom(seed),
      )
      expect(lines[0].below).toBe(false)
      expect(lines[1].below).toBe(false)
    }
  })

  it('places a line in a narrow window about its middle, in the band', () => {
    const lines = planLines(
      HARMONY_LINES,
      { low: 60, high: 62 },
      HARMONY_LEVELS.professional,
      seededRandom(3),
    )
    for (const line of lines) {
      for (const midi of line.harmony) {
        expect(midi).toBeGreaterThanOrEqual(SUNG_LOW)
        expect(midi).toBeLessThanOrEqual(SUNG_HIGH + 7)
      }
    }
  })

  it('is the same run for the same seed', () => {
    const plan = () =>
      planLines(
        6,
        { low: 53, high: 65 },
        HARMONY_LEVELS.singer,
        seededRandom(11),
      )
    expect(plan()).toEqual(plan())
  })
})
