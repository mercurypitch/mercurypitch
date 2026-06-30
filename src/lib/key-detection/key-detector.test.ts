import { describe, expect, it } from 'vitest'
import type { KeyNote } from './key-detector'
import { detectKeyFromNotes, detectRegionalKeys, pitchClassHistogram, } from './key-detector'

/** Build sequential notes from [midi, durationSec] pairs starting at `startSec`. */
function seq(pairs: [number, number][], startSec = 0): KeyNote[] {
  let t = startSec
  return pairs.map(([midi, dur]) => {
    const note = { midi, startSec: t, endSec: t + dur }
    t += dur
    return note
  })
}

describe('pitchClassHistogram', () => {
  it('weights pitch classes by duration and folds octaves', () => {
    const h = pitchClassHistogram([
      { midi: 60, startSec: 0, endSec: 2 }, // C, 2s
      { midi: 72, startSec: 2, endSec: 3 }, // C an octave up, 1s
      { midi: 67, startSec: 3, endSec: 4 }, // G, 1s
    ])
    expect(h[0]).toBeCloseTo(3, 6) // C: 2 + 1
    expect(h[7]).toBeCloseTo(1, 6) // G
    expect(h[1]).toBe(0)
  })
})

describe('detectKeyFromNotes', () => {
  it('detects C major from a tonic+dominant-heavy C major melody', () => {
    const notes = seq([
      [60, 2], // C
      [64, 1], // E
      [67, 2], // G
      [60, 2], // C
      [65, 1], // F
      [69, 1], // A
      [67, 1.5], // G
      [60, 2], // C
      [62, 1], // D
      [71, 0.5], // B
    ])
    const key = detectKeyFromNotes(notes)
    expect(key.keyName).toBe('C')
    expect(key.scaleType).toBe('major')
  })

  it('detects A minor from an A-minor melody', () => {
    const notes = seq([
      [57, 2], // A
      [60, 1], // C
      [64, 2], // E
      [57, 2], // A
      [62, 1], // D
      [65, 1], // F
      [55, 1.5], // G
      [57, 2], // A
      [59, 1], // B
    ])
    const key = detectKeyFromNotes(notes)
    expect(key.tonic).toBe(9) // A
    expect(key.scaleType).toBe('natural-minor')
  })

  it('returns zero confidence for no notes', () => {
    const key = detectKeyFromNotes([])
    expect(key.confidence).toBe(0)
  })
})

describe('detectRegionalKeys', () => {
  it('returns nothing for an empty note list', () => {
    expect(detectRegionalKeys([])).toEqual([])
  })

  it('segments a modulating song into multiple key regions', () => {
    // First ~12s clearly C major (naturals, strong C + F), then ~12s clearly
    // F# major (with F#/C#/G#, strong F#).
    const cMajor = seq(
      [
        [60, 1.5],
        [64, 1],
        [67, 1.5],
        [60, 1.5],
        [65, 1],
        [69, 1],
        [67, 1.5],
        [60, 1.5],
        [62, 1],
        [60, 1.5],
      ],
      0,
    )
    const fsMajor = seq(
      [
        [66, 1.5], // F#
        [70, 1], // A#
        [73, 1.5], // C#
        [66, 1.5], // F#
        [71, 1], // B
        [75, 1], // D#
        [73, 1.5], // C#
        [66, 1.5], // F#
        [68, 1], // G#
        [66, 1.5], // F#
      ],
      13,
    )
    const regions = detectRegionalKeys([...cMajor, ...fsMajor])
    expect(regions.length).toBeGreaterThanOrEqual(2)
    // Not all regions share a tonic.
    const tonics = new Set(regions.map((r) => r.tonic))
    expect(tonics.size).toBeGreaterThanOrEqual(2)
    // Regions are time-ordered and contiguous-ish.
    for (let i = 1; i < regions.length; i++) {
      expect(regions[i].startSec).toBeGreaterThanOrEqual(
        regions[i - 1].startSec,
      )
    }
  })
})
