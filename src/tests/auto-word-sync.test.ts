// ============================================================
// autoSyncWordTimings — which lines auto-sync is allowed to touch
// ============================================================
//
// `@/lib/word-sync` is tested for the arithmetic of one line. This covers the
// judgement around it, which matters more: auto-sync replaces the saved
// lyrics outright, so a line wrongly judged eligible does not degrade a
// mapping, it overwrites a hand-made one.

import { describe, expect, it } from 'vitest'
import { autoSyncWordTimings } from '@/features/stem-mixer/auto-word-sync'
import type { CanonicalLrcEntry } from '@/features/stem-mixer/types'

function line(lrcIndex: number, time: number, text: string): CanonicalLrcEntry {
  return {
    type: 'line',
    lrcIndex,
    canonicalIndex: lrcIndex,
    time,
    text,
    words: text.split(/\s+/).filter((word) => word.length > 0),
  }
}

function rest(canonicalIndex: number, time: number): CanonicalLrcEntry {
  return {
    type: 'rest',
    lrcIndex: -1,
    canonicalIndex,
    time,
    text: '~Rest~',
    words: [],
  }
}

const ONSETS = [1, 3, 5, 7, 9, 11]

describe('autoSyncWordTimings', () => {
  it('times every word of every eligible line', () => {
    const result = autoSyncWordTimings({
      canonical: [line(0, 1, 'hold on'), line(1, 5, 'soul mate')],
      duration: 20,
      onsets: ONSETS,
    })
    expect(result.linesSynced).toBe(2)
    expect(result.wordTimings[0]).toHaveLength(2)
    expect(result.wordTimings[1]).toHaveLength(2)
  })

  it('keys the result by LRC index, not canonical index', () => {
    // A rest occupies a canonical slot but no line in the file. Keying by the
    // wrong one puts every timing after the rest on the wrong words.
    const result = autoSyncWordTimings({
      canonical: [
        line(0, 1, 'hold on'),
        rest(1, 3),
        { ...line(1, 5, 'soul mate'), canonicalIndex: 2 },
      ],
      duration: 20,
      onsets: ONSETS,
    })
    expect(Object.keys(result.wordTimings).sort()).toEqual(['0', '1'])
  })

  it('gives a line before a rest the whole gap to spread over', () => {
    // Rests are filtered out before spans are measured, so the line runs to
    // the next sung line rather than being cut off at the rest row.
    const result = autoSyncWordTimings({
      canonical: [
        line(0, 1, 'hold on now'),
        rest(1, 3),
        { ...line(1, 15, 'soul mate'), canonicalIndex: 2 },
      ],
      duration: 20,
      onsets: [],
    })
    const times = result.wordTimings[0]
    expect(times[times.length - 1]).toBeGreaterThan(3)
  })

  it('skips a line with no span to lay words over', () => {
    // Two stamps on the same second: nothing singable fits between them.
    const result = autoSyncWordTimings({
      canonical: [line(0, 1, 'hold on'), line(1, 1.05, 'soul mate')],
      duration: 20,
      onsets: ONSETS,
    })
    expect(result.wordTimings[0]).toBeUndefined()
    expect(result.linesSynced).toBe(1)
  })

  it('skips a line with no words', () => {
    const result = autoSyncWordTimings({
      canonical: [line(0, 1, ''), line(1, 5, 'soul mate')],
      duration: 20,
      onsets: ONSETS,
    })
    expect(result.wordTimings[0]).toBeUndefined()
    expect(result.linesSynced).toBe(1)
  })

  it('has nothing to sync against plain-text lyrics', () => {
    // No canonical list means no line starts, and word times invented from
    // nothing would be worse than none.
    expect(
      autoSyncWordTimings({ canonical: [], duration: 20, onsets: ONSETS }),
    ).toEqual({ wordTimings: {}, linesSynced: 0 })
  })

  it('does nothing before the duration is known', () => {
    // Audio metadata can still be loading; a zero duration would collapse
    // every line onto the start of the song.
    expect(
      autoSyncWordTimings({
        canonical: [line(0, 1, 'hold on')],
        duration: 0,
        onsets: ONSETS,
      }).linesSynced,
    ).toBe(0)
  })

  it('never runs the last line past the end of the song', () => {
    const result = autoSyncWordTimings({
      canonical: [line(0, 8, 'hold on tight')],
      duration: 10,
      onsets: [],
    })
    for (const time of result.wordTimings[0]) {
      expect(time).toBeLessThanOrEqual(10)
    }
  })

  it('still works with no onsets detected at all', () => {
    // A quiet or badly separated stem yields none. Even spacing is a worse
    // mapping than snapped onsets, but it is a mapping.
    const result = autoSyncWordTimings({
      canonical: [line(0, 1, 'hold on')],
      duration: 10,
      onsets: [],
    })
    expect(result.linesSynced).toBe(1)
    expect(result.wordTimings[0]).toHaveLength(2)
  })
})
