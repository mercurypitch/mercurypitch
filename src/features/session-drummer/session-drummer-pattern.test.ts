import { describe, expect, it } from 'vitest'
import { DRUM_PATTERNS } from '@/features/drum-night/patterns/drum-pattern-library'
import { arrangeDrummerPhrase, DEFAULT_DRUMMER_SETTINGS, normalizeDrummerSettings, surpriseDrummer, } from './session-drummer-pattern'
import { drummerMeterReason } from './session-drummer-pattern'

describe('session drummer phrases', () => {
  it('allows common time but explains unsupported and changing score meters', () => {
    expect(drummerMeterReason()).toBeNull()
    expect(drummerMeterReason([{ numerator: 4, denominator: 4 }])).toBeNull()
    expect(
      drummerMeterReason([
        { numerator: 4, denominator: 4 },
        { numerator: 6, denominator: 8 },
      ]),
    ).toContain('6/8')
    expect(drummerMeterReason([{ numerator: 3, denominator: 4 }])).toContain(
      '4/4 score',
    )
  })
  it('bounds corrupt saved values and makes the fill interval fit the phrase', () => {
    expect(
      normalizeDrummerSettings({
        bars: 2,
        fillEvery: 8,
        level: Infinity,
        tempoBpm: NaN,
        patternId: 'gone',
      }),
    ).toEqual({ ...DEFAULT_DRUMMER_SETTINGS, bars: 2, fillEvery: 2 })
    expect(normalizeDrummerSettings({ level: 50, tempoBpm: 2 }).level).toBe(2)
  })
  it.each(DRUM_PATTERNS.map((pattern) => [pattern.id]))(
    'repeats %s into a bounded 16-bar phrase with valid GM hits',
    (patternId) => {
      const hits = arrangeDrummerPhrase({
        ...DEFAULT_DRUMMER_SETTINGS,
        patternId,
        bars: 16,
      })
      expect(hits.length).toBeGreaterThan(40)
      expect(
        hits.every(
          (hit) =>
            hit.beat >= 0 &&
            hit.beat < 64 &&
            hit.velocity > 0 &&
            hit.velocity <= 127,
        ),
      ).toBe(true)
      expect(new Set(hits.map((hit) => `${hit.beat}:${hit.gmKey}`)).size).toBe(
        hits.length,
      )
    },
  )
  it('replaces the hands in fill windows and marks the next downbeat once', () => {
    const hits = arrangeDrummerPhrase(DEFAULT_DRUMMER_SETTINGS)
    expect(
      hits
        .filter((hit) => hit.beat >= 15 && hit.beat < 16 && hit.gmKey !== 36)
        .map((hit) => hit.gmKey),
    ).toEqual([38, 48, 47, 45])
    expect(
      hits.filter((hit) => hit.beat === 16 && hit.gmKey === 49),
    ).toHaveLength(1)
    expect(
      arrangeDrummerPhrase({ ...DEFAULT_DRUMMER_SETTINGS, fillEvery: 0 }).some(
        (hit) => hit.gmKey === 45,
      ),
    ).toBe(false)
  })
  it('surprises without repeating the selected beat or changing the selected kit', () => {
    const next = surpriseDrummer(
      { ...DEFAULT_DRUMMER_SETTINGS, kitId: 'crocell' },
      () => 0,
    )
    expect(next.patternId).not.toBe(DEFAULT_DRUMMER_SETTINGS.patternId)
    expect(next.kitId).toBe('crocell')
    expect(next.tempoBpm).toBe(
      DRUM_PATTERNS.find((pattern) => pattern.id === next.patternId)?.tempoBpm,
    )
  })
})
