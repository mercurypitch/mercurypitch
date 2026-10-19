// ============================================================
// Lesson 2 ear game rounds tests — steps inside the octave, kind feedback
// ============================================================

import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@/features/lessons/kit/dom'
import { answerOf, NEW_GAME, nextStep, scoreAnswer, stepWords, TRICKY, } from './ear-game-rounds'

/** The words without their markup: what a sighted reader sees. */
const seen = (html: string): string =>
  html.replace(/<span class="sr">[^<]*<\/span>/g, '').replace(/<[^>]+>/g, '')

describe('nextStep', () => {
  it('plays a semitone or a tone between A3 and A4, rising unless Up and down is on', () => {
    const random = mulberry32(7)
    const steps = Array.from({ length: 400 }, () => nextStep(random, false))
    for (const s of steps) {
      expect(Math.abs(s.to - s.from)).toBe(s.size)
      expect(Math.min(s.from, s.to)).toBeGreaterThanOrEqual(57)
      expect(Math.max(s.from, s.to)).toBeLessThanOrEqual(69)
      expect(s.to).toBeGreaterThan(s.from)
    }
    expect(new Set(steps.map((s) => s.size))).toEqual(new Set([1, 2]))
  })

  it('mixes in falling steps with Up and down, as Leap does', () => {
    const random = mulberry32(11)
    const steps = Array.from({ length: 200 }, () => nextStep(random, true))
    expect(steps.some((s) => s.to < s.from)).toBe(true)
    expect(steps.some((s) => s.to > s.from)).toBe(true)
  })

  it('replays the same rounds from the same seed', () => {
    const a = mulberry32(3)
    const b = mulberry32(3)
    expect(Array.from({ length: 10 }, () => nextStep(a, true))).toEqual(
      Array.from({ length: 10 }, () => nextStep(b, true)),
    )
  })
})

describe('stepWords', () => {
  it('names the keys and the sound, and the key between in the page spelling', () => {
    const ef = { from: 64, to: 65, size: 1 as const }
    const cd = { from: 60, to: 62, size: 2 as const }
    expect(answerOf(ef)).toBe('semitone')
    expect(answerOf(cd)).toBe('tone')
    expect(seen(stepWords(ef, 'sharps'))).toBe(
      'E to F: a semitone, no key between them',
    )
    expect(seen(stepWords(cd, 'sharps'))).toBe(
      'C to D: a tone, with C♯ between',
    )
    expect(seen(stepWords(cd, 'flats'))).toBe('C to D: a tone, with D♭ between')
    expect(seen(stepWords(cd, 'both'))).toBe(
      'C to D: a tone, with C♯/D♭ between',
    )
  })

  it('speaks every sign it prints', () => {
    const html = stepWords({ from: 62, to: 60, size: 2 }, 'both')
    expect(html).toContain(
      '<span aria-hidden="true">♯</span><span class="sr"> sharp</span>',
    )
    expect(html).toContain(
      '<span aria-hidden="true">♭</span><span class="sr"> flat</span>',
    )
    expect(seen(html)).toBe('D to C: a tone, with C♯/D♭ between')
  })
})

describe('scoreAnswer', () => {
  it('counts what was heard, and says the tricky line once, after two misses in a row', () => {
    let score = NEW_GAME
    const said: boolean[] = []
    for (const correct of [true, false, false, false, true, false, false]) {
      const next = scoreAnswer(score, correct)
      score = next.score
      said.push(next.tricky)
    }
    expect(said).toEqual([false, false, true, false, false, false, false])
    expect(score.heard).toBe(2)
    expect(TRICKY).toBe("If that felt tricky, good: that's learning.")
  })
})
