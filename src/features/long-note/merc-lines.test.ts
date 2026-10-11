import { describe, expect, it } from 'vitest'
import type { LongNoteMoment } from './merc-lines'
import { createMercLineSelector, fillNote, MERC_LINES, offMoment, } from './merc-lines'

const texts = (moment: LongNoteMoment): string[] =>
  MERC_LINES[moment].map((line) => line.text)

describe('merc-lines', () => {
  it('fills the target note into every placeholder', () => {
    expect(fillNote('Find {note} again. Back to {note}.', 'A3')).toBe(
      'Find A3 again. Back to A3.',
    )
  })

  it('never repeats a line twice in a row for a moment', () => {
    // Always asks for the first slot, the case that would repeat if the
    // previous line were not taken out of the pool.
    const selector = createMercLineSelector(() => 0)
    const moments = Object.keys(MERC_LINES) as LongNoteMoment[]
    for (const moment of moments) {
      if (MERC_LINES[moment].length < 2) continue
      let previous = selector.next(moment, 'A3')
      for (let i = 0; i < 6; i++) {
        const line = selector.next(moment, 'A3')
        expect(line).not.toBe(previous)
        previous = line
      }
    }
  })

  it('survives a broken random source', () => {
    const selector = createMercLineSelector(() => Number.NaN)
    expect(selector.next('lock', 'C4')).toBe(
      fillNote(MERC_LINES.lock[0].text, 'C4'),
    )
  })

  it('keeps every line short and free of words that judge the singer', () => {
    const banned = /\b(wrong|failed|fail|bad|terrible|calm)\b/i
    for (const lines of Object.values(MERC_LINES)) {
      expect(lines.length).toBeGreaterThan(0)
      for (const line of lines) {
        expect(line.text).not.toMatch(banned)
        expect(line.text).not.toContain('—')
        expect(line.text.length).toBeLessThanOrEqual(60)
      }
    }
  })

  it('gives every line a unique id', () => {
    const ids = Object.values(MERC_LINES).flatMap((lines) =>
      lines.map((line) => line.id),
    )
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('says what the voice is doing and which way to move, in plain words', () => {
    for (const text of texts('driftSharp')) {
      expect(text).toMatch(/sharp/i)
      expect(text).toMatch(/down/i)
    }
    for (const text of texts('driftFlat')) {
      expect(text).toMatch(/flat/i)
      expect(text).toMatch(/up|lift/i)
    }
    for (const text of [...texts('lock'), ...texts('break')]) {
      expect(text).toContain('{note}')
    }
    expect(
      texts('break').every((text) => text.startsWith('Off the note')),
    ).toBe(true)
    expect(texts('steady').every((text) => /steady/i.test(text))).toBe(true)
  })

  it('keeps Merc warm without the flourish', () => {
    // Owner, 11 Oct: "That's the one" and "the light loves that" were too
    // much, and so were the glass, the pouring and the glow.
    const flourish =
      /the one|loves|glass|pour|glow|well lit|lovely|keep it coming/i
    for (const lines of Object.values(MERC_LINES)) {
      for (const line of lines) expect(line.text).not.toMatch(flourish)
    }
  })

  it('calls a voice off the band sharp, flat, or off the note', () => {
    expect(offMoment(31)).toBe('driftSharp')
    expect(offMoment(94)).toBe('driftSharp')
    expect(offMoment(-31)).toBe('driftFlat')
    expect(offMoment(-94)).toBe('driftFlat')
    // The engine clamps readings to 100 cents: near it is another note.
    expect(offMoment(95)).toBe('break')
    expect(offMoment(-100)).toBe('break')
  })
})
