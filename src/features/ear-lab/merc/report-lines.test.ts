// The native Ear Report's words (report-lines.ts): Merc's line from the
// numbers, counts in words, the Index's caption, and which items a wide
// bank's map draws.

import { describe, expect, it } from 'vitest'
import type { ConfusionMatrix, TopConfusion } from '@/lib/ear/confusion-report'
import { buildConfusionMatrix } from '@/lib/ear/confusion-report'
import type { CalibrationRunEntry } from '@/stores/ear-lab-store'
import { dateLabel } from '../instruments'
import type { ConfusionSection } from '../report-data'
import { CONFUSION_SECTIONS, roundDomain } from '../report-data'
import { countWord, MAP_MAX_ITEMS, mapLabels, reportLine, sealsCaption, timesWord, worstMixUp, } from './report-lines'

function section(drillId: string): ConfusionSection {
  const found = CONFUSION_SECTIONS.find((s) => s.drillId === drillId)
  if (found === undefined) throw new Error(`no section ${drillId}`)
  return found
}

const HOME = section('home')
const LEAP = section('leap')
const CONTOUR = section('contour')

function seal(index: number, at: number): CalibrationRunEntry {
  return { at, index, parts: {}, readings: [] }
}

function mixUp(
  expected: string,
  answered: string,
  count: number,
): TopConfusion {
  return { expected, answered, count, rate: null }
}

const SEP_1 = Date.UTC(2026, 8, 1, 12)
const SEP_22 = Date.UTC(2026, 8, 22, 12)

describe('counts in words', () => {
  it('says once, twice, then the number', () => {
    expect(timesWord(1)).toBe('once')
    expect(timesWord(2)).toBe('twice')
    expect(timesWord(7)).toBe('7 times')
  })

  it('writes a count in words to twelve, in digits after', () => {
    expect(countWord(0)).toBe('no')
    expect(countWord(3)).toBe('three')
    expect(countWord(12)).toBe('twelve')
    expect(countWord(14)).toBe('14')
  })
})

describe("the Index's caption", () => {
  it('counts the seals in the range', () => {
    expect(sealsCaption(3, '12w')).toBe(
      'Three seals in twelve weeks. Only a calibration moves it.',
    )
    expect(sealsCaption(1, '4w')).toBe(
      'One seal in four weeks. Only a calibration moves it.',
    )
    expect(sealsCaption(5, 'all')).toBe(
      'Five seals so far. Only a calibration moves it.',
    )
  })

  it('says when the range holds none', () => {
    expect(sealsCaption(0, '4w')).toBe(
      'No seals in the last four weeks. Only a calibration moves it.',
    )
  })
})

describe("a map's items", () => {
  it('draws every item of a bank that fits', () => {
    const matrix = buildConfusionMatrix({}, HOME.labels)
    expect(HOME.labels.length).toBeLessThanOrEqual(MAP_MAX_ITEMS)
    expect(mapLabels(matrix)).toEqual(HOME.labels)
  })

  it('draws only the items with a mix-up either way from a wide bank', () => {
    expect(LEAP.labels.length).toBeGreaterThan(MAP_MAX_ITEMS)
    const matrix = buildConfusionMatrix(
      { 'leap:m3>leap:M3': 4, 'leap:P5>leap:P4': 1 },
      LEAP.labels,
    )
    expect(mapLabels(matrix)).toEqual([
      'leap:m3',
      'leap:M3',
      'leap:P4',
      'leap:P5',
    ])
  })

  it('keeps two items, in bank order, when one alone is involved', () => {
    const matrix: ConfusionMatrix = buildConfusionMatrix({}, LEAP.labels)
    const at = LEAP.labels.indexOf('leap:P8')
    matrix.cells[at][at] = 2
    expect(mapLabels(matrix)).toEqual(['leap:M7', 'leap:P8'])
  })
})

describe("Merc's line", () => {
  it('finds the mix-up that slips most across the drills', () => {
    const worst = worstMixUp([
      { section: HOME, top: [mixUp('deg-4', 'deg-3', 7)] },
      { section: CONTOUR, top: [mixUp('same', 'up', 4)] },
      { section: LEAP, top: [] },
    ])
    expect(worst?.section.drillId).toBe('home')
    expect(worst?.confusion.count).toBe(7)
    expect(worstMixUp([{ section: LEAP, top: [] }])).toBeNull()
  })

  it('invites the first calibration when nothing is sealed', () => {
    expect(reportLine([], null)).toBe(
      'Nothing sealed yet. One calibration and this page starts to draw.',
    )
    expect(
      reportLine([], { section: HOME, confusion: mixUp('deg-4', 'deg-3', 2) }),
    ).toBe('Nothing sealed yet. Fa slips to Mi the most.')
  })

  it('says the first seal, then how the Index moved since the one before', () => {
    expect(reportLine([seal(212, SEP_1)], null)).toBe(
      'Sealed at 212. No mix-ups so far.',
    )
    const since = dateLabel(SEP_1)
    expect(reportLine([seal(243, SEP_22), seal(212, SEP_1)], null)).toBe(
      `Up 31 since ${since}. No mix-ups so far.`,
    )
    expect(reportLine([seal(200, SEP_22), seal(212, SEP_1)], null)).toBe(
      `Down 12 since ${since}. No mix-ups so far.`,
    )
    expect(
      reportLine([seal(212, SEP_22), seal(212, SEP_1)], {
        section: LEAP,
        confusion: mixUp('leap:m3', 'leap:M3', 3),
      }),
    ).toBe(`Level with ${since}. Minor 3rd slips to Major 3rd the most.`)
  })

  it('names a direction as a word, capitalised', () => {
    expect(
      reportLine([seal(212, SEP_1)], {
        section: CONTOUR,
        confusion: mixUp('same', 'up', 4),
      }),
    ).toBe('Sealed at 212. Same slips to Up the most.')
  })
})

describe("a trace's axis", () => {
  it('widens a fitted domain to a round step', () => {
    expect(roundDomain([186, 247])).toEqual([180, 250])
    expect(roundDomain([15.1, 27.9])).toEqual([10, 30])
    expect(roundDomain([24.2, 49.8])).toEqual([20, 50])
    expect(roundDomain([8.85, 16.55])).toEqual([8, 17])
  })

  it('leaves a domain with no span as it is', () => {
    expect(roundDomain([12, 12])).toEqual([12, 12])
  })
})
