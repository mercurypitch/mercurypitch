// ============================================================
// TV stage lyric wrap tests — two rows, the floor, and the fill across a break
// ============================================================
//
// Measured with a fake whose widths follow the font size, every character
// half the size wide, as a real font's widths do: so shrinking a line makes
// it narrower, and a wrap can be checked honestly. At 1080 lines a row is
// 1728 px wide, which holds 48 characters at 72 px and 108 at the 32 px
// floor.

import { describe, expect, it } from 'vitest'
import type { LyricRow, LyricWrap, MeasureAt } from '@/lib/tv-stage/lyric-wrap'
import { ELLIPSIS, LYRIC_ROWS, lyricRowsInView, pieceFill, wrapLyricLine, } from '@/lib/tv-stage/lyric-wrap'

const measureAt: MeasureAt = (px) => (text) =>
  Array.from(text).length * px * 0.5

const LIMITS = { width: 1728, largest: 72, floor: 32 }

/** `count` words of `letters` letters each: 'aaaa', 'bbbb' and on. */
function words(count: number, letters = 4): string[] {
  return Array.from({ length: count }, (_, index) =>
    String.fromCharCode(97 + (index % 26)).repeat(letters),
  )
}

const rowWords = (row: LyricRow): string[] => row.pieces.map((p) => p.text)

const wordsIn = (wrap: LyricWrap): string[] => wrap.rows.flatMap(rowWords)

describe('a line that fits', () => {
  it('stays on one row at the full size', () => {
    const line = words(8) // 39 characters

    const wrap = wrapLyricLine(line, measureAt, LIMITS)

    expect(wrap.px).toBe(72)
    expect(wrap.rows).toHaveLength(1)
    expect(rowWords(wrap.rows[0])).toEqual(line)
  })
})

describe('a long line', () => {
  it('wraps onto two rows at the full size, rather than shrink', () => {
    const line = words(14) // 69 characters: 34.5 em, wider than 24 em

    const wrap = wrapLyricLine(line, measureAt, LIMITS)

    expect(wrap.px).toBe(72)
    expect(wrap.rows).toHaveLength(2)
    expect(wordsIn(wrap)).toEqual(line)
    for (const row of wrap.rows) expect(row.width).toBeLessThanOrEqual(1728)
  })

  it('takes the largest size two rows hold, when two at the full size do not', () => {
    const line = words(26) // 129 characters

    const wrap = wrapLyricLine(line, measureAt, LIMITS)
    const larger = wrapLyricLine(line, measureAt, {
      ...LIMITS,
      largest: wrap.px + 1,
      floor: wrap.px + 1,
    })

    expect(wrap.rows).toHaveLength(2)
    expect(wrap.px).toBeLessThan(72)
    expect(wrap.px).toBeGreaterThan(32)
    expect(larger.rows.length).toBeGreaterThan(LYRIC_ROWS)
  })

  it('lays each row’s words a space apart, from the row’s left edge', () => {
    const wrap = wrapLyricLine(words(14), measureAt, LIMITS)
    const space = measureAt(72)(' ')

    const [first, second] = wrap.rows[1].pieces

    expect(wrap.rows[1].pieces[0].x).toBe(0)
    expect(second.x).toBe(first.width + space)
    expect(wrap.rows[1].width).toBe(
      wrap.rows[1].pieces.reduce((sum, p) => sum + p.width, 0) +
        space * (wrap.rows[1].pieces.length - 1),
    )
  })
})

describe('a line too long for two rows at the floor', () => {
  const line = words(80) // 399 characters: four rows at the floor
  const wrap = wrapLyricLine(line, measureAt, LIMITS)
  const sungUpTo =
    (row: number) =>
    (word: number): number => {
      const begun = wrap.rows[row].pieces[0].word
      if (word < begun) return 1
      return word === begun ? 0.5 : 0
    }

  it('keeps the floor, on as many rows as it takes', () => {
    expect(wrap.px).toBe(32)
    expect(wrap.rows.length).toBeGreaterThan(LYRIC_ROWS)
    expect(wordsIn(wrap)).toEqual(line)
  })

  it('leaves room at every row’s end for the ellipsis', () => {
    // Words of three letters fill a row to 107 of its 108 characters, so a
    // row that kept no room would have none for the ellipsis's two.
    const tight = wrapLyricLine(words(110, 3), measureAt, LIMITS)

    expect(tight.rows.length).toBeGreaterThan(LYRIC_ROWS)
    for (const row of tight.rows) {
      expect(row.width + tight.space + tight.ellipsis).toBeLessThanOrEqual(1728)
    }
    expect(tight.ellipsis).toBe(measureAt(32)(ELLIPSIS))
  })

  it('shows its first two rows, and more to come, before a word is sung', () => {
    const view = lyricRowsInView(wrap, () => 0)

    expect(view.rows).toEqual(wrap.rows.slice(0, 2))
    expect(view.more).toBe(true)
  })

  it('moves down a row once the singer starts the next one', () => {
    const view = lyricRowsInView(wrap, sungUpTo(1))

    expect(view.rows).toEqual(wrap.rows.slice(1, 3))
    expect(view.more).toBe(wrap.rows.length > 3)
  })

  it('ends on its last two rows, with nothing more to come', () => {
    const view = lyricRowsInView(wrap, () => 1)

    expect(view.rows).toEqual(wrap.rows.slice(-2))
    expect(view.more).toBe(false)
  })
})

describe('a word wider than a row', () => {
  // Sixty characters at 72 px is 2160 px: a line of Chinese or Japanese has
  // no spaces, so it arrives as one word.
  const word = 'あいうえおかきくけこ'.repeat(6)

  it('breaks between its characters, the first part filling a row', () => {
    const wrap = wrapLyricLine([word], measureAt, LIMITS)

    expect(wrap.px).toBe(72)
    expect(wrap.rows.map((row) => row.pieces[0].text.length)).toEqual([48, 12])
    expect(wordsIn(wrap).join('')).toBe(word)
  })

  it('carries its fill across the break', () => {
    const wrap = wrapLyricLine([word], measureAt, LIMITS)
    const [first, second] = wrap.rows.map((row) => row.pieces[0])

    // Nine tenths of 2160 px is 1944: the first row's 1728 and half of the
    // second's 432.
    expect(pieceFill(first, 0.9)).toBe(1)
    expect(pieceFill(second, 0.9)).toBeCloseTo(0.5)
    expect(pieceFill(second, 0.7)).toBe(0)
    expect(pieceFill(first, 0.4)).toBeCloseTo((0.4 * 2160) / 1728)
  })

  it('never parts a letter from its accent', () => {
    // é as a letter and a mark: two characters to the fake, one to a reader.
    // Rows 828 px wide (900, less the ellipsis's room) hold 23 characters at
    // 72 px, an odd number, so a cut by character would strand a mark.
    const accented = 'é'.repeat(60)

    const wrap = wrapLyricLine([accented], measureAt, {
      width: 900,
      largest: 72,
      floor: 72,
    })

    expect(wrap.rows.length).toBeGreaterThan(LYRIC_ROWS)
    for (const row of wrap.rows) {
      expect(row.pieces[0].text.startsWith('́')).toBe(false)
    }
    expect(wordsIn(wrap).join('')).toBe(accented)
  })
})

describe('a whole word', () => {
  it('fills as its word fills', () => {
    const wrap = wrapLyricLine(['slow'], measureAt, LIMITS)
    const piece = wrap.rows[0].pieces[0]

    expect(pieceFill(piece, 0)).toBe(0)
    expect(pieceFill(piece, 0.25)).toBe(0.25)
    expect(pieceFill(piece, 1)).toBe(1)
  })
})
