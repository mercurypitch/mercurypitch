// ============================================================
// TV stage lyric wrap — a long line on two rows, never under the floor
// ============================================================
//
// The line being sung is drawn big, 72 px at 1080 lines. A line too wide for
// the screen used to shrink until it fitted on one row, which took a long
// line under the size a room reads from the sofa (REQ-TV-022: no less than
// 32 px at 1080 lines). Now it wraps: onto two rows at the full size where
// they hold it, at the largest size that fits two rows where they do not,
// and never under the floor.
//
// Rows break between words. A word wider than a whole row breaks between
// its characters: a line of Chinese or Japanese has no spaces, so it
// arrives as one word. The fill runs on across every break, so the sung part
// reads as one sweep from the first row into the second.
//
// A line too long even for two rows at the floor keeps the floor and shows
// two of its rows at a time: the row being sung and the one after it, with an
// ellipsis at the end while more follows. The pair moves down a row when the
// singer starts the next one, so every word is on screen while it is sung,
// and the block is never taller than two rows.
//
// Pure: the caller measures (the renderer, with its canvas), so it is tested
// with a fake whose widths follow the font size.
//
// Tests: src/lib/tv-stage/lyric-wrap.test.ts.

/**
 * Measures text in the line's font at `px` pixels. The function it returns
 * is used up before the next size is asked for, so a canvas can set its font
 * once per size.
 */
export type MeasureAt = (px: number) => (text: string) => number

/** One word on one row: the whole word, or the part of it a break left. */
export interface LyricPiece {
  readonly text: string
  /** Which word of the line it is, or is part of. */
  readonly word: number
  /** Its left edge, from the row's left edge. */
  readonly x: number
  readonly width: number
  /** How far into its word it starts, and the whole word's width. */
  readonly offset: number
  readonly wordWidth: number
}

export interface LyricRow {
  readonly pieces: readonly LyricPiece[]
  readonly width: number
}

export interface LyricWrap {
  /** The size every row is drawn at, in pixels. */
  readonly px: number
  /** Every row the line takes: two at most, unless it overflows the floor. */
  readonly rows: readonly LyricRow[]
  /** A space at `px`: what sets the ellipsis off from the row it ends. */
  readonly space: number
  /** The ellipsis's width at `px`. */
  readonly ellipsis: number
}

export interface LyricWrapLimits {
  /** The widest a row may be. */
  readonly width: number
  /** The size the line is drawn at when two rows hold it, in whole pixels. */
  readonly largest: number
  /** The least size it may take, in whole pixels: the floor. */
  readonly floor: number
}

/** The rows on screen, and whether more of the line follows them. */
export interface LyricRowsInView {
  readonly rows: readonly LyricRow[]
  readonly more: boolean
}

/** The most rows a line is shown on at once. */
export const LYRIC_ROWS = 2

/** What ends the second row while more of its line follows out of view. */
export const ELLIPSIS = '…'

type Measure = (text: string) => number

/** A run of a word that is placed as one: the word, or a part of it. */
type Part = Omit<LyricPiece, 'x'>

/**
 * The characters a reader sees. The app splits words the same way
 * (splitGraphemes, word-letters.ts), but the stage keeps its own: a module
 * both import would go to a chunk the stage shares with the app, and load
 * at the stage's first paint (REQ-TV-027).
 */
function graphemes(text: string): string[] {
  if (typeof Intl.Segmenter !== 'function') return Array.from(text)
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  return Array.from(segmenter.segment(text), (part) => part.segment)
}

/** A word too wide for a row, cut between its characters into parts. */
function cutWord(word: string, measure: Measure, width: number): string[] {
  const parts: string[] = []
  let part = ''
  for (const character of graphemes(word)) {
    if (part !== '' && measure(part + character) > width) {
      parts.push(part)
      part = character
    } else {
      part += character
    }
  }
  if (part !== '') parts.push(part)
  return parts
}

function partsOf(
  words: readonly string[],
  measure: Measure,
  width: number,
): Part[] {
  const parts: Part[] = []
  words.forEach((word, index) => {
    const whole = measure(word)
    const texts = whole > width ? cutWord(word, measure, width) : [word]
    const widths = texts.length === 1 ? [whole] : texts.map(measure)
    const wordWidth = widths.reduce((sum, part) => sum + part, 0)
    let offset = 0
    texts.forEach((text, part) => {
      parts.push({ text, word: index, width: widths[part], offset, wordWidth })
      offset += widths[part]
    })
  })
  return parts
}

/** Parts laid along rows as far as each holds them, spaces between words. */
function rowsOf(
  parts: readonly Part[],
  space: number,
  width: number,
): LyricRow[] {
  const rows: LyricRow[] = []
  let pieces: LyricPiece[] = []
  let end = 0
  for (const part of parts) {
    const gap = pieces.at(-1)?.word === part.word ? 0 : space
    if (pieces.length > 0 && end + gap + part.width > width) {
      rows.push({ pieces, width: end })
      pieces = []
    }
    const x = pieces.length === 0 ? 0 : end + gap
    pieces.push({ ...part, x })
    end = x + part.width
  }
  if (pieces.length > 0) rows.push({ pieces, width: end })
  return rows
}

function rowsAt(
  words: readonly string[],
  measure: Measure,
  width: number,
): LyricRow[] {
  return rowsOf(partsOf(words, measure, width), measure(' '), width)
}

function finish(
  px: number,
  rows: readonly LyricRow[],
  measureAt: MeasureAt,
): LyricWrap {
  const measure = measureAt(px)
  return { px, rows, space: measure(' '), ellipsis: measure(ELLIPSIS) }
}

/**
 * The line at the floor, too long for two rows there: its rows leave room
 * at their ends for the ellipsis, since any but the last may carry it.
 */
function overflowing(
  words: readonly string[],
  measureAt: MeasureAt,
  limits: LyricWrapLimits,
): LyricWrap {
  const measure = measureAt(limits.floor)
  const space = measure(' ')
  const ellipsis = measure(ELLIPSIS)
  const rows = rowsAt(words, measure, limits.width - space - ellipsis)
  return { px: limits.floor, rows, space, ellipsis }
}

/**
 * The line's words on rows: at `largest` where two rows hold them, else at
 * the largest whole size that fits two rows, and never under `floor`. Past
 * that, at the floor on as many rows as it takes (see `lyricRowsInView`).
 */
export function wrapLyricLine(
  words: readonly string[],
  measureAt: MeasureAt,
  limits: LyricWrapLimits,
): LyricWrap {
  const fit = (px: number): LyricRow[] =>
    rowsAt(words, measureAt(px), limits.width)
  let high = Math.max(limits.floor, limits.largest)
  const full = fit(high)
  if (full.length <= LYRIC_ROWS) return finish(high, full, measureAt)
  let low = limits.floor
  let fitting = fit(low)
  if (fitting.length > LYRIC_ROWS) {
    return overflowing(words, measureAt, limits)
  }
  // A smaller size never takes more rows, so the largest that fits lies
  // between a size that fits (`low`) and one that does not (`high`).
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2)
    const rows = fit(middle)
    if (rows.length <= LYRIC_ROWS) {
      low = middle
      fitting = rows
    } else {
      high = middle
    }
  }
  return finish(low, fitting, measureAt)
}

/** How much of a piece is lit while its word is lit `fill` of the way. */
export function pieceFill(piece: LyricPiece, fill: number): number {
  if (piece.width <= 0) return fill >= 1 ? 1 : 0
  const lit = fill * piece.wordWidth - piece.offset
  return Math.min(1, Math.max(0, lit / piece.width))
}

/** The last row with a piece begun, or the first while none is. */
function rowBeingSung(
  rows: readonly LyricRow[],
  fill: (word: number) => number,
): number {
  for (let index = rows.length - 1; index > 0; index -= 1) {
    const begun = rows[index].pieces.some(
      (piece) => pieceFill(piece, fill(piece.word)) > 0,
    )
    if (begun) return index
  }
  return 0
}

/**
 * The rows to draw while `fill` says how far each word is sung: all of
 * them when there are two or fewer; past that, the row being sung and the
 * one after it, with `more` while rows follow those two.
 */
export function lyricRowsInView(
  wrap: LyricWrap,
  fill: (word: number) => number,
): LyricRowsInView {
  const count = wrap.rows.length
  if (count <= LYRIC_ROWS) return { rows: wrap.rows, more: false }
  const first = Math.min(rowBeingSung(wrap.rows, fill), count - LYRIC_ROWS)
  return {
    rows: wrap.rows.slice(first, first + LYRIC_ROWS),
    more: first + LYRIC_ROWS < count,
  }
}
