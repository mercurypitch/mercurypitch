// Merc encore bank tests — playback must match the compiled key, pace and melody version exactly.
import { describe, expect, it } from 'vitest'
import { compileMelody } from '../core/melody-contour'
import { MERC_ENCORE_VARIANTS, mercEncoreAvailability } from './encore-examples'
import { glassMelody } from './melodies'

describe('Merc encore examples', () => {
  it('selects the exact effective key and pace after transposition', () => {
    const contour = compileMelody(glassMelody('gallery-arch'), {
      rootMidi: 61,
      transposeSemitones: -2,
      pace: 1.25,
    })

    expect(mercEncoreAvailability('gallery-arch', contour)).toMatchObject({
      kind: 'voice',
      phrase: { words: 'Another beautiful mess' },
      variant: {
        assetId: 'merc-encore-gallery-arch-r59-p125-v6',
        assetPath: 'adventure-voice-v6/gallery-arch/r59-p125.mp3',
        rootMidi: 59,
        pace: 1.25,
      },
    })
  })

  it('ships only the 88 decoded variants whose lyrics passed recognition', () => {
    expect(MERC_ENCORE_VARIANTS).toHaveLength(88)
    expect(new Set(MERC_ENCORE_VARIANTS.map((item) => item.assetId)).size).toBe(
      88,
    )
    expect(
      MERC_ENCORE_VARIANTS.filter(
        (item) => item.melodyId === 'gallery-arch' && item.pace === 0.8,
      ),
    ).toEqual([])
    expect(
      MERC_ENCORE_VARIANTS.some(
        (item) =>
          item.melodyId === 'gallery-arch' &&
          item.rootMidi === 53 &&
          item.pace === 1.25,
      ),
    ).toBe(false)
  })

  it('uses an explicit guide fallback instead of a mismatched voice take', () => {
    expect(mercEncoreAvailability('first-arc', null)).toMatchObject({
      kind: 'guide',
      reason: 'find-note',
    })
    expect(
      mercEncoreAvailability(
        'first-arc',
        compileMelody(glassMelody('first-arc'), { rootMidi: 61 }),
      ),
    ).toMatchObject({ kind: 'guide', reason: 'key' })
    expect(
      mercEncoreAvailability(
        'gallery-arch',
        compileMelody(glassMelody('gallery-arch'), {
          rootMidi: 53,
          pace: 1.25,
        }),
      ),
    ).toMatchObject({ kind: 'guide', reason: 'unverified-voice' })
    expect(
      mercEncoreAvailability(
        'two-windows',
        compileMelody(glassMelody('two-windows'), { rootMidi: 50 }),
      ),
    ).toEqual({ kind: 'guide', reason: 'shape' })
  })
})
