import { describe, expect, it } from 'vitest'
import { autoTimeLineWords, countSyllables, estimateWordDuration, layoutLineWords, snapToOnsets, } from '@/lib/word-sync'

describe('countSyllables', () => {
  it('counts vowel groups', () => {
    expect(countSyllables('amigos')).toBe(3)
    expect(countSyllables('no')).toBe(1)
    expect(countSyllables('beautiful')).toBe(3)
  })

  it('drops trailing silent e', () => {
    expect(countSyllables('home')).toBe(1)
    expect(countSyllables('care')).toBe(1)
  })

  it('never returns less than 1 (punctuation, digits)', () => {
    expect(countSyllables('—')).toBe(1)
    expect(countSyllables('42')).toBe(1)
  })
})

describe('estimateWordDuration', () => {
  it('grows with syllables and stays within bounds', () => {
    expect(estimateWordDuration('no')).toBeLessThan(
      estimateWordDuration('amigos'),
    )
    expect(estimateWordDuration('a')).toBeGreaterThanOrEqual(0.3)
    expect(
      estimateWordDuration('supercalifragilisticexpialidocious'),
    ).toBeLessThanOrEqual(2.2)
  })
})

describe('layoutLineWords', () => {
  it('starts at vocalStart and is monotonic', () => {
    const t = layoutLineWords(['one', 'two', 'three'], 10, 13)
    expect(t[0]).toBe(10)
    expect(t[1]).toBeGreaterThan(t[0])
    expect(t[2]).toBeGreaterThan(t[1])
    expect(t[2]).toBeLessThan(13)
  })

  it('gives multi-syllable words more room', () => {
    const t = layoutLineWords(['amigos', 'no'], 0, 4)
    // "amigos" (3 syl) occupies 3/4 of the span before "no" starts
    expect(t[1]).toBeCloseTo(3, 1)
  })
})

describe('snapToOnsets', () => {
  it('snaps within tolerance and keeps order', () => {
    const snapped = snapToOnsets([1.0, 2.0, 3.0], [1.1, 2.9], 0, 5)
    expect(snapped[0]).toBe(1.1)
    expect(snapped[1]).toBe(2.0) // no onset near — layout kept
    expect(snapped[2]).toBe(2.9)
  })

  it('never goes backwards even with clustered onsets', () => {
    const snapped = snapToOnsets([1.0, 1.05, 1.1], [1.02], 0, 5)
    for (let i = 1; i < snapped.length; i++) {
      expect(snapped[i]).toBeGreaterThan(snapped[i - 1])
    }
  })

  it('stays inside the line span', () => {
    const snapped = snapToOnsets([4.9, 4.95], [], 4, 5)
    expect(snapped.every((t) => t >= 4 && t < 5)).toBe(true)
  })
})

describe('autoTimeLineWords', () => {
  it('skips an instrumental lead-in by starting at the first onset', () => {
    // Line spans 10-20 but singing only starts at 14
    const onsets = [14.0, 14.6, 15.3, 16.1]
    const t = autoTimeLineWords(['sing', 'it', 'out', 'loud'], 10, 20, onsets)
    expect(t[0]).toBeGreaterThanOrEqual(13.9)
    expect(t[t.length - 1]).toBeLessThan(20)
  })

  it('handles no onsets with a plain weighted layout', () => {
    const t = autoTimeLineWords(['a', 'b', 'c'], 0, 3, [])
    expect(t).toHaveLength(3)
    expect(t[0]).toBe(0)
    expect(t[2]).toBeGreaterThan(t[1])
  })

  it('returns empty for empty words', () => {
    expect(autoTimeLineWords([], 0, 3, [1])).toEqual([])
  })
})
