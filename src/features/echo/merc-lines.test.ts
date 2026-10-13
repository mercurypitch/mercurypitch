// ============================================================
// Merc's lines for Echo: the table, its placeholders and the selector
// ============================================================

import { describe, expect, it } from 'vitest'
import type { EchoMoment } from './merc-lines'
import { createEchoLines, ECHO_LINES, fillFields, nthNote } from './merc-lines'

const ALL = Object.values(ECHO_LINES).flat()

describe("Echo's lines", () => {
  it('gives every moment a line, each with an id of its own', () => {
    expect(Object.values(ECHO_LINES).every((lines) => lines.length > 0)).toBe(
      true,
    )
    const ids = ALL.map((line) => line.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps to the owner\'s words: no em dash, no "calm", "practice" with a c', () => {
    const offending = ALL.filter(
      (line) =>
        line.text.includes('\u2014') ||
        /\bcalm/iu.test(line.text) ||
        /practise/iu.test(line.text),
    )

    expect(offending).toEqual([])
  })

  it('uses only the placeholders the room fills in', () => {
    const known = new Set([
      'note',
      'nth',
      'sung',
      'target',
      'landed',
      'count',
      'total',
      'level',
    ])
    const used = ALL.flatMap((line) =>
      [...line.text.matchAll(/\{(\w+)\}/gu)].map((match) => match[1]),
    )

    expect(used.filter((name) => !known.has(name))).toEqual([])
  })

  it('fills each placeholder it is given and leaves the rest as they are', () => {
    expect(
      fillFields('{landed} of {count}. {nth} {unknown}', {
        landed: 2,
        count: 4,
        nth: 'third',
      }),
    ).toBe('2 of 4. third {unknown}')
  })

  it('names a note by its place in the phrase', () => {
    expect([0, 1, 2, 3, 4].map(nthNote)).toEqual([
      'first',
      'second',
      'third',
      'fourth',
      'fifth',
    ])
    expect(nthNote(7)).toBe('number 8')
  })
})

describe('the line selector', () => {
  it('never says the same line twice running for a moment', () => {
    const lines = createEchoLines(() => 0)
    const said = Array.from({ length: 4 }, () =>
      lines.next('phraseAll', { count: 3 }),
    )

    for (let i = 1; i < said.length; i++) {
      expect(said[i]).not.toBe(said[i - 1])
    }
  })

  it('fills the line it picks', () => {
    const lines = createEchoLines(() => 0)

    expect(
      lines.next('newBest', { level: 'Singer', landed: 18, total: 20 }),
    ).toBe('New best at Singer: 18 of 20.')
    expect(lines.next('found', { note: 'A3' })).toMatch(/A3/u)
  })

  it.each(Object.keys(ECHO_LINES) as EchoMoment[])(
    'leaves no placeholder unfilled in %s when every field is given',
    (moment) => {
      const text = createEchoLines(() => 0.5).next(moment, {
        note: 'C4',
        nth: 'second',
        sung: 'D4',
        target: 'E4',
        landed: 3,
        count: 4,
        total: 20,
        level: 'Singer',
      })

      expect(text).not.toMatch(/\{\w+\}/u)
    },
  )
})
