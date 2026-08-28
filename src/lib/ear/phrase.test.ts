import { describe, expect, it } from 'vitest'
import { ECHO_BANK } from './banks'
import { degreeSemitone, judgePhrase, largestLeap, phraseMidis, randomPhrase, solfegeOf, } from './phrase'

describe('phrase — degrees, judging, drawing', () => {
  it('maps degrees to major-scale semitones, 8 being the octave', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(degreeSemitone)).toEqual([
      0, 2, 4, 5, 7, 9, 11, 12,
    ])
    expect(degreeSemitone(0)).toBe(0)
    expect(degreeSemitone(9)).toBe(12)
    expect(phraseMidis(60, [1, 3, 5, 8])).toEqual([60, 64, 67, 72])
  })

  it('says a phrase in solfège', () => {
    expect(solfegeOf([1, 2, 3, 8])).toBe('Do Re Mi Do′')
    expect(largestLeap([1, 3, 8, 5])).toBe(5)
    expect(largestLeap([4])).toBe(0)
  })

  it('judges note by note, in order, and names the first slip', () => {
    expect(judgePhrase([1, 2, 3], [1, 2, 3])).toEqual({
      correct: true,
      perNote: [true, true, true],
      firstMiss: null,
    })
    expect(judgePhrase([1, 2, 3], [1, 5, 3])).toEqual({
      correct: false,
      perNote: [true, false, true],
      firstMiss: 1,
    })
    // Short answers are missing their tail; long ones fail at the extra.
    expect(judgePhrase([1, 2, 3], [1, 2])).toMatchObject({
      correct: false,
      perNote: [true, true, false],
      firstMiss: 2,
    })
    expect(judgePhrase([1, 2], [1, 2, 3])).toMatchObject({
      correct: false,
      firstMiss: 2,
    })
  })

  it('draws a diatonic walk of the asked length inside the octave', () => {
    let seed = 7
    const random = () => {
      seed = (seed * 48271) % 2147483647
      return seed / 2147483647
    }
    for (let length = 1; length <= 16; length++) {
      const phrase = randomPhrase(length, random)
      expect(phrase).toHaveLength(length)
      expect([1, 3, 5]).toContain(phrase[0])
      for (const degree of phrase) {
        expect(degree).toBeGreaterThanOrEqual(1)
        expect(degree).toBeLessThanOrEqual(8)
      }
      expect(largestLeap(phrase)).toBeLessThanOrEqual(4)
      for (let i = 1; i < phrase.length; i++) {
        expect(phrase[i]).not.toBe(phrase[i - 1])
      }
    }
  })

  it('reflects a step that would leave the octave', () => {
    // random → 0 picks the start 1 and the step −4 every time.
    expect(randomPhrase(4, () => 0)).toEqual([1, 5, 1, 5])
    // random → just under 1 picks the start 5 and the step +4.
    expect(randomPhrase(3, () => 0.999)).toEqual([5, 1, 5])
    expect(randomPhrase(0.2, () => 0)).toEqual([1])
  })
})

describe('ECHO_BANK', () => {
  it('holds singable phrases of three to six degrees, seeds rising with leaps and length', () => {
    const ids = new Set(ECHO_BANK.map((item) => item.itemId))
    expect(ids.size).toBe(ECHO_BANK.length)
    expect(ECHO_BANK.length).toBeGreaterThanOrEqual(12)
    for (const item of ECHO_BANK) {
      expect(item.payload.length).toBeGreaterThanOrEqual(3)
      expect(item.payload.length).toBeLessThanOrEqual(6)
      for (const degree of item.payload) {
        expect(Number.isInteger(degree)).toBe(true)
        expect(degree).toBeGreaterThanOrEqual(1)
        expect(degree).toBeLessThanOrEqual(8)
      }
      expect(item.name).toBe(solfegeOf(item.payload))
      expect(item.seed).toBeGreaterThanOrEqual(900)
    }
    const first = ECHO_BANK[0]
    const last = ECHO_BANK[ECHO_BANK.length - 1]
    expect(last.seed).toBeGreaterThan(first.seed)
    expect(last.payload.length + largestLeap(last.payload)).toBeGreaterThan(
      first.payload.length + largestLeap(first.payload),
    )
  })
})
