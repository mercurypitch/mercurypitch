// ============================================================
// lrc-compare — measuring one mapping against another
// ============================================================

import { describe, expect, it } from 'vitest'
import { compareLrcText, normalizeToken, parseEnhancedLrc, shareWithin, } from '@/lib/lrc-compare'

const REFERENCE = [
  '[00:10.00]one [00:11.00]two [00:12.00]three',
  '[00:20.00]four [00:21.00]five',
].join('\n')

describe('parseEnhancedLrc', () => {
  it('reads each word with the timestamp in front of it', () => {
    const [line] = parseEnhancedLrc('[00:10.00]one [00:11.50]two')
    expect(line.words.map((w) => [w.value, w.time])).toEqual([
      ['one', 10],
      ['two', 11.5],
    ])
    expect(line.normalized).toBe('one two')
  })

  it('skips lines with no timestamps at all', () => {
    expect(parseEnhancedLrc('[ti:Josephine]\nplain text\n')).toEqual([])
  })

  it('drops a stamp with no word after it', () => {
    // A trailing stamp marks a line end, not a word, and counting it would
    // shift every later word's index against the other file.
    const [line] = parseEnhancedLrc('[00:10.00]one [00:11.00]')
    expect(line.words).toHaveLength(1)
  })
})

describe('normalizeToken', () => {
  it('ignores case and punctuation, so spellings match', () => {
    expect(normalizeToken("Don't,")).toBe(normalizeToken('dont'))
    expect(normalizeToken('—')).toBe('')
  })
})

describe('compareLrcText', () => {
  it('is all zeroes against itself', () => {
    const result = compareLrcText(REFERENCE, REFERENCE)
    expect(result.comparedWords).toBe(5)
    expect(result.maxAbsolute).toBe(0)
    expect(result.mismatchedLines).toEqual([])
    expect(result.lines.every((l) => l.status === 'compared')).toBe(true)
  })

  it('reports a uniform lateness as bias, not as error scatter', () => {
    // The signature of an uncalibrated reaction time: every word off by the
    // same amount. Bias catches it; a mean absolute alone would not say
    // whether it is fixable with one number.
    const late = REFERENCE.replace(
      /\[00:(\d+)\.00\]/g,
      (_m, s) => `[00:${String(Number(s) + 1).padStart(2, '0')}.00]`,
    )
    const result = compareLrcText(REFERENCE, late)
    expect(result.medianBias).toBe(1)
    expect(result.meanAbsolute).toBe(1)
    expect(result.p95Absolute).toBe(1)
  })

  it('signs the delta so late and early are distinguishable', () => {
    const early =
      '[00:09.50]one [00:11.00]two [00:12.00]three\n[00:20.00]four [00:21.00]five'
    const result = compareLrcText(REFERENCE, early)
    expect(result.lines[0].words[0].delta).toBe(-0.5)
    expect(result.lines[0].words[0].reference).toBe(10)
    expect(result.lines[0].words[0].candidate).toBe(9.5)
  })

  it('reports a line whose words differ instead of realigning it', () => {
    // Guessing an alignment across different lyrics would invent agreement.
    const different =
      '[00:10.00]completely [00:11.00]other [00:12.00]words\n[00:20.00]four [00:21.00]five'
    const result = compareLrcText(REFERENCE, different)
    expect(result.mismatchedLines).toEqual([1])
    expect(result.lines[0].status).toBe('text-mismatch')
    expect(result.lines[0].words).toEqual([])
    // The line that does match is still compared.
    expect(result.comparedWords).toBe(2)
  })

  it('reports a word missing from one side by position', () => {
    const short = '[00:10.00]one [00:11.00]two\n[00:20.00]four [00:21.00]five'
    const result = compareLrcText(REFERENCE, short)
    // Line 1's text differs once a word is gone, so the whole line is out.
    expect(result.mismatchedLines).toEqual([1])
  })

  it('counts a line present in only one file as mismatched', () => {
    const extra = `${REFERENCE}\n[00:30.00]six`
    expect(compareLrcText(REFERENCE, extra).mismatchedLines).toEqual([3])
  })

  it('summarises each line so a single bad line is findable', () => {
    const drifted =
      '[00:10.00]one [00:11.00]two [00:12.00]three\n[00:20.40]four [00:21.40]five'
    const result = compareLrcText(REFERENCE, drifted)
    expect(result.lines[0].meanAbsolute).toBe(0)
    expect(result.lines[1].meanAbsolute).toBeCloseTo(0.4, 6)
    expect(result.lines[1].medianBias).toBeCloseTo(0.4, 6)
  })

  it('handles two empty files without dividing by zero', () => {
    const result = compareLrcText('', '')
    expect(result.comparedWords).toBe(0)
    expect(result.meanAbsolute).toBe(0)
    expect(result.medianAbsolute).toBe(0)
    expect(result.maxAbsolute).toBe(0)
  })
})

describe('shareWithin', () => {
  it('is the fraction of words inside the tolerance', () => {
    expect(shareWithin([0, 0.05, 0.2, -0.3], 0.1)).toBe(0.5)
  })

  it('counts a word exactly on the tolerance as inside it', () => {
    expect(shareWithin([0.1, -0.1], 0.1)).toBe(1)
  })

  it('is zero for nothing to compare, not NaN', () => {
    expect(shareWithin([], 0.1)).toBe(0)
  })
})
