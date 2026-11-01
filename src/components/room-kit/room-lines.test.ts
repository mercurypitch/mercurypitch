// ============================================================
// Merc's lines in a room: the pick and the fill every room shares
// ============================================================

import { describe, expect, it } from 'vitest'
import type { LineTable } from './room-lines'
import { createRoomLines, fillLine } from './room-lines'

type Moment = 'hello' | 'again' | 'only'

interface Fields {
  readonly note?: string
  readonly count?: number
}

const TABLE: LineTable<Moment> = {
  hello: [
    { id: 'a', text: 'A on {note}.' },
    { id: 'b', text: 'B: {count} of {count}.' },
    { id: 'c', text: 'C, {note} and {missing}.' },
  ],
  again: [
    { id: 'again-1', text: 'Again.' },
    { id: 'again-2', text: 'Once more.' },
  ],
  only: [{ id: 'only', text: 'The one line.' }],
}

/** A random source that hands out these samples, then repeats the last. */
const samples =
  (...values: number[]) =>
  (): number =>
    values.length > 1 ? (values.shift() as number) : values[0]

describe('fillLine', () => {
  it('fills every placeholder it is given, each time it appears', () => {
    expect(
      fillLine('{count} of {count} on {note}.', { note: 'A3', count: 4 }),
    ).toBe('4 of 4 on A3.')
  })

  it('leaves a placeholder it is not given as it is', () => {
    expect(fillLine('{note} and {top}.', { note: 'C4' })).toBe('C4 and {top}.')
    expect(fillLine('{note}.', {})).toBe('{note}.')
    expect(fillLine('{note}.', { note: undefined })).toBe('{note}.')
  })

  it('fills a zero and an empty string, which are values', () => {
    expect(fillLine('{count} of {note}', { count: 0, note: '' })).toBe('0 of ')
  })

  it('reads only the fields themselves, never what every object has', () => {
    expect(fillLine('{toString} {constructor}', { note: 'A3' })).toBe(
      '{toString} {constructor}',
    )
  })
})

describe('createRoomLines', () => {
  it('picks by the random sample from the lines not just said', () => {
    // 0.5 of three lines is the second; then 0.5 of the two left (the
    // second taken out) is the third.
    const lines = createRoomLines<Moment, Fields>(TABLE, () => 0.5)

    expect(lines.next('hello', { count: 2 })).toBe('B: 2 of 2.')
    expect(lines.next('hello', { note: 'G3' })).toBe('C, G3 and {missing}.')
  })

  it("hands a line's id with its words, for a room that says it aloud", () => {
    const lines = createRoomLines<Moment, Fields>(TABLE, () => 0.5)

    expect(lines.line('hello', { count: 2 })).toEqual({
      id: 'b',
      text: 'B: 2 of 2.',
    })
    // The same pick as next(), which shares its memory: the line just
    // said is left out.
    expect(lines.line('hello', { note: 'G3' })).toEqual({
      id: 'c',
      text: 'C, G3 and {missing}.',
    })
    expect(lines.next('hello', { count: 3 })).toBe('B: 3 of 3.')
  })

  it('never says the same line twice running for a moment', () => {
    const lines = createRoomLines<Moment, Fields>(TABLE, () => 0)
    const said = Array.from({ length: 8 }, () => lines.next('again'))

    expect(said).toEqual([
      'Again.',
      'Once more.',
      'Again.',
      'Once more.',
      'Again.',
      'Once more.',
      'Again.',
      'Once more.',
    ])
  })

  it('remembers the last line per moment, not across them', () => {
    const lines = createRoomLines<Moment, Fields>(TABLE, () => 0)

    expect(lines.next('again')).toBe('Again.')
    expect(lines.next('hello', { note: 'A3' })).toBe('A on A3.')
    // 'again' still remembers its own last line through the other moment.
    expect(lines.next('again')).toBe('Once more.')
    expect(lines.next('hello', { note: 'A3' })).toBe('B: {count} of {count}.')
  })

  it('says a moment with one line every time', () => {
    const lines = createRoomLines<Moment, Fields>(TABLE, () => 0.9)

    expect([lines.next('only'), lines.next('only')]).toEqual([
      'The one line.',
      'The one line.',
    ])
  })

  it('keeps each set of lines its own memory', () => {
    const first = createRoomLines<Moment, Fields>(TABLE, () => 0)
    const second = createRoomLines<Moment, Fields>(TABLE, () => 0)

    expect(first.next('again')).toBe('Again.')
    expect(second.next('again')).toBe('Again.')
  })

  it('takes the first line left for a broken random source', () => {
    for (const broken of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const lines = createRoomLines<Moment, Fields>(TABLE, () => broken)
      expect(lines.next('hello', { note: 'D4' })).toBe('A on D4.')
      expect(lines.next('hello', { count: 1 })).toBe('B: 1 of 1.')
    }
  })

  it('keeps a sample outside 0 to 1 on the lines it has', () => {
    const lines = createRoomLines<Moment, Fields>(TABLE, samples(-0.4, 1, 1.7))

    expect(lines.next('hello', { note: 'E2' })).toBe('A on E2.')
    expect(lines.next('hello', { note: 'E2' })).toBe('C, E2 and {missing}.')
    expect(lines.next('hello', { count: 3 })).toBe('B: 3 of 3.')
  })

  it('leaves every placeholder when no fields come with the moment', () => {
    const lines = createRoomLines<Moment, Fields>(TABLE, () => 0)

    expect(lines.next('hello')).toBe('A on {note}.')
  })
})
