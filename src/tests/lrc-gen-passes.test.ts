import { describe, expect, it } from 'vitest'
import { activeLineAt, countWordPassLines, isMappableLine, lineEndTime, lineWordCount, needsWordPass, nextWordPassLine, normalizePass, PRE_ROLL_SEC, preRollTarget, previewWordAt, seedWordPassTimings, wordPassLinesBefore, } from '@/features/stem-mixer/lrc-gen-passes'

const LINES = [
  'Hello darkness my old friend', // 0 — 5 words
  '', // 1 — blank
  'Stay', // 2 — single word
  '~Rest~', // 3 — synthetic countdown
  'I have come to talk', // 4 — 5 words
]

describe('isMappableLine', () => {
  it('rejects blanks and rest markers', () => {
    expect(isMappableLine('Hello')).toBe(true)
    expect(isMappableLine('')).toBe(false)
    expect(isMappableLine('   ')).toBe(false)
    expect(isMappableLine('~Rest~')).toBe(false)
    expect(isMappableLine(undefined)).toBe(false)
  })
})

describe('lineWordCount', () => {
  it('counts words in a mappable line', () => {
    expect(lineWordCount('Hello darkness my old friend')).toBe(5)
  })

  it('collapses runs of whitespace', () => {
    expect(lineWordCount('  two   words  ')).toBe(2)
  })

  it('is zero for unmappable rows', () => {
    expect(lineWordCount('~Rest~')).toBe(0)
    expect(lineWordCount('')).toBe(0)
  })
})

describe('needsWordPass', () => {
  it('skips single-word lines — the line start already determines them', () => {
    expect(needsWordPass('Stay')).toBe(false)
    expect(needsWordPass('Stay here')).toBe(true)
  })

  it('skips rests and blanks', () => {
    expect(needsWordPass('~Rest~')).toBe(false)
    expect(needsWordPass('')).toBe(false)
  })
})

describe('nextWordPassLine', () => {
  it('finds the first line with words to place', () => {
    expect(nextWordPassLine(LINES, 0)).toBe(0)
  })

  it('skips blanks, rests and single-word lines', () => {
    expect(nextWordPassLine(LINES, 1)).toBe(4)
  })

  it('returns the length when nothing is left', () => {
    expect(nextWordPassLine(LINES, 5)).toBe(LINES.length)
    expect(nextWordPassLine(['Stay', ''], 0)).toBe(2)
  })

  it('clamps a negative start', () => {
    expect(nextWordPassLine(LINES, -3)).toBe(0)
  })
})

describe('word-pass progress', () => {
  it('counts only the lines pass 2 stops on', () => {
    expect(countWordPassLines(LINES)).toBe(2)
  })

  it('counts how many are behind the cursor', () => {
    expect(wordPassLinesBefore(LINES, 0)).toBe(0)
    expect(wordPassLinesBefore(LINES, 4)).toBe(1)
    expect(wordPassLinesBefore(LINES, LINES.length)).toBe(2)
  })
})

describe('seedWordPassTimings', () => {
  it('anchors word 0 of each mappable line to its frozen line start', () => {
    const seeded = seedWordPassTimings(
      LINES,
      [1.5, undefined, 9, undefined, 12],
      {},
    )
    expect(seeded[0]).toEqual([1.5])
    expect(seeded[2]).toEqual([9])
    expect(seeded[4]).toEqual([12])
  })

  it('keeps words already mapped and only re-anchors word 0', () => {
    const seeded = seedWordPassTimings(
      LINES,
      [1.5, undefined, undefined, undefined, undefined],
      { 0: [99, 2, 2.4] },
    )
    expect(seeded[0]).toEqual([1.5, 2, 2.4])
  })

  it('leaves unmappable rows and untimed lines alone', () => {
    const seeded = seedWordPassTimings(LINES, [], {})
    expect(seeded[1]).toBeUndefined()
    expect(seeded[3]).toBeUndefined()
  })

  it('does not mutate the input map', () => {
    const original = { 0: [5] }
    seedWordPassTimings(LINES, [1.5], original)
    expect(original[0]).toEqual([5])
  })
})

describe('preRollTarget', () => {
  it('backs up by the run-in', () => {
    expect(preRollTarget(10)).toBe(10 - PRE_ROLL_SEC)
  })

  it('never seeks before the start of the song', () => {
    expect(preRollTarget(0.4)).toBe(0)
  })
})

describe('lineEndTime', () => {
  it('ends a line where the next mappable line begins', () => {
    // Line 1 is blank and skipped; line 2 is the next mappable one.
    const lineTimes = [1, undefined, 8, undefined, 20]
    expect(lineEndTime(LINES, lineTimes, {}, 0)).toBe(8)
  })

  it('falls back to a bounded span when the next line is not mapped yet', () => {
    // Ragged mid-pass state: the next mappable line has no time, so its start
    // cannot bound this one. Reaching past it to line 4 would stretch the
    // preview across the unmapped line, so a fixed span wins.
    const lineTimes = [1, undefined, undefined, undefined, 20]
    expect(lineEndTime(LINES, lineTimes, {}, 0)).toBe(1 + 3)
  })

  it('falls back to the last mapped word plus a span', () => {
    expect(lineEndTime(LINES, [1], { 0: [1, 2, 3.5] }, 0)).toBe(3.5 + 3)
  })

  it('returns null when the line has no timing at all', () => {
    expect(lineEndTime(LINES, [], {}, 0)).toBeNull()
  })
})

describe('previewWordAt', () => {
  const starts = [10, 11, 12]

  it('shows nothing before the first word', () => {
    expect(previewWordAt(starts, undefined, 14, 9.5)).toBeNull()
  })

  it('sweeps a word from its start to the next word start', () => {
    const hit = previewWordAt(starts, undefined, 14, 10.5)
    expect(hit?.wordIdx).toBe(0)
    expect(hit?.progress).toBeCloseTo(0.5, 5)
  })

  it('respects a recorded end time over the next start', () => {
    // Word 0 ends at 10.5 even though word 1 starts at 11 — a held note
    // followed by a rest should finish sweeping, not smear across the gap.
    const hit = previewWordAt(starts, [10.5], 14, 10.5)
    expect(hit?.wordIdx).toBe(0)
    expect(hit?.progress).toBe(1)
  })

  it('uses the line end for the last word', () => {
    const hit = previewWordAt(starts, undefined, 14, 13)
    expect(hit?.wordIdx).toBe(2)
    expect(hit?.progress).toBeCloseTo(0.5, 5)
  })

  it('clamps progress into 0..1', () => {
    expect(previewWordAt(starts, undefined, 14, 99)?.progress).toBe(1)
  })

  it('tolerates sparse word arrays', () => {
    const sparse: number[] = []
    sparse[0] = 10
    sparse[2] = 12
    const hit = previewWordAt(sparse, undefined, 14, 12.5)
    expect(hit?.wordIdx).toBe(2)
  })

  it('returns null when the line has no word timings', () => {
    expect(previewWordAt(undefined, undefined, 14, 12)).toBeNull()
  })
})

describe('normalizePass', () => {
  it('passes the three modes through', () => {
    expect(normalizePass('all')).toBe('all')
    expect(normalizePass('lines')).toBe('lines')
    expect(normalizePass('words')).toBe('words')
  })

  it('decodes the numeric passes written by the first split', () => {
    expect(normalizePass(1)).toBe('lines')
    expect(normalizePass(2)).toBe('words')
  })

  it('falls back to the all-in-one flow, never to a split pass', () => {
    // A session saved before the split has no pass field at all. Resuming it
    // into 'lines' would silently stop every tap from placing words.
    expect(normalizePass(undefined)).toBe('all')
    expect(normalizePass(null)).toBe('all')
    expect(normalizePass('garbage')).toBe('all')
    expect(normalizePass(7)).toBe('all')
  })
})

describe('activeLineAt', () => {
  const times = [10, undefined, 20, undefined, 30]

  it('returns -1 before the first mapped line', () => {
    expect(activeLineAt(LINES, times, 0)).toBe(-1)
    expect(activeLineAt(LINES, times, 9.99)).toBe(-1)
  })

  it('lights the line whose start has passed', () => {
    expect(activeLineAt(LINES, times, 10)).toBe(0)
    expect(activeLineAt(LINES, times, 19.9)).toBe(0)
    expect(activeLineAt(LINES, times, 20)).toBe(2)
    expect(activeLineAt(LINES, times, 31)).toBe(4)
  })

  it('keeps a line lit through the gap after it', () => {
    // Matches the runtime renderer: nothing goes dark between lines.
    expect(activeLineAt(LINES, times, 25)).toBe(2)
  })

  it('never lands on a blank or a rest', () => {
    const dense = [10, 12, 20, 22, 30]
    expect(activeLineAt(LINES, dense, 12.5)).toBe(0)
    expect(activeLineAt(LINES, dense, 23)).toBe(2)
  })

  it('survives out-of-order times instead of blanking', () => {
    // Redoing line 0 late leaves the array non-monotonic; an early exit on the
    // first future start would return -1 for the whole rest of the song.
    const messy = [99, undefined, 20, undefined, 30]
    expect(activeLineAt(LINES, messy, 31)).toBe(4)
    expect(activeLineAt(LINES, messy, 100)).toBe(0)
  })

  it('ignores unmapped lines', () => {
    expect(activeLineAt(LINES, [undefined, undefined, undefined], 50)).toBe(-1)
  })
})
