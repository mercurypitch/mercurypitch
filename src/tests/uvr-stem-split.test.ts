// ============================================================
// Stem split requests — which stems a second pass yields, and the
// request that asks for them.
// ============================================================
// The contract these lock down: guitar is only reachable via the 6-stem
// model, piano rides along on the same compute and is dropped rather than
// shipped, and a dropped stem's audio survives in the residual instead of
// vanishing.

import { describe, expect, it } from 'vitest'
import type { UvrStemName } from '@/lib/uvr-api'
import { buildStemSplitRequest, getUvrModel, splitStemsFor, UVR_DEFAULT_MULTI_STEM_MODEL, UVR_MODELS, UVR_MULTI_STEM_MODELS, } from '@/lib/uvr-api'

describe('multi-stem model catalogue', () => {
  it('offers guitar only through the 6-stem model', () => {
    const withGuitar = UVR_MODELS.filter((m) => m.stems.includes('guitar'))
    expect(withGuitar.map((m) => m.name)).toEqual(['demucs-6s'])
  })

  it('defaults to the model that can produce guitar', () => {
    const model = getUvrModel(UVR_DEFAULT_MULTI_STEM_MODEL)
    expect(model?.stems).toContain('guitar')
  })

  it('lists every multi-stem tier in the picker', () => {
    expect(UVR_MULTI_STEM_MODELS.map((m) => m.name)).toEqual([
      'demucs',
      'demucs-ft',
      'demucs-6s',
    ])
  })

  it('keeps "rough" and "dropped" as separate concepts', () => {
    // Turning piano on later must be a one-line change that leaves the
    // quality label intact — so the two lists are not the same field.
    const sixStem = getUvrModel('demucs-6s')
    expect(sixStem?.experimentalStems).toContain('piano')
    expect(sixStem?.defaultDropStems).toContain('piano')
  })

  it('never drops a stem a model does not produce', () => {
    for (const model of UVR_MODELS) {
      for (const stem of model.defaultDropStems ?? []) {
        expect(model.stems).toContain(stem)
      }
      for (const stem of model.experimentalStems ?? []) {
        expect(model.stems).toContain(stem)
      }
    }
  })
})

describe('splitStemsFor', () => {
  it('yields drums, bass and guitar — not piano, not the source', () => {
    expect(splitStemsFor('demucs-6s', 'instrumental')).toEqual([
      'drums',
      'bass',
      'guitar',
      'other',
    ])
  })

  it('yields the rhythm section for the 4-stem tiers', () => {
    expect(splitStemsFor('demucs-ft', 'instrumental')).toEqual([
      'drums',
      'bass',
      'other',
    ])
  })

  it('never returns the vocal stem (a split of an instrumental has none)', () => {
    for (const model of UVR_MULTI_STEM_MODELS) {
      expect(splitStemsFor(model.name, 'instrumental')).not.toContain('vocal')
    }
  })

  it('excludes whatever stem is being split', () => {
    expect(splitStemsFor('demucs-6s', 'other')).not.toContain('other')
  })

  it('returns nothing for an unknown model rather than guessing', () => {
    expect(splitStemsFor('nope')).toEqual([])
  })
})

describe('buildStemSplitRequest', () => {
  it('asks for a reconciled second pass over the instrumental', () => {
    const req = buildStemSplitRequest()
    expect(req.model).toBe('demucs-6s')
    expect(req.source_stem).toBe('instrumental')
    // Reconciliation is what makes the parts sum back to the instrumental.
    expect(req.reconcile_residual).toBe(true)
    expect(req.residual_stem).toBe('other')
  })

  it('drops the near-silent vocal and the piano by default', () => {
    expect(buildStemSplitRequest().drop_stems).toEqual(['vocal', 'piano'])
  })

  it('requests exactly the stems it will keep', () => {
    const req = buildStemSplitRequest()
    expect(req.stems).toEqual(['drums', 'bass', 'guitar', 'other'])
    const dropped = new Set(req.drop_stems)
    for (const stem of req.stems ?? []) {
      expect(dropped.has(stem as UvrStemName)).toBe(false)
    }
  })

  it('drops only the vocal for models with no rough stems', () => {
    expect(buildStemSplitRequest({ model: 'demucs-ft' }).drop_stems).toEqual([
      'vocal',
    ])
  })

  it('can keep everything the model produces (piano, later)', () => {
    const req = buildStemSplitRequest({ dropStems: [] })
    expect(req.drop_stems).toEqual([])
    // The point of the future switch-on: piano becomes requestable without
    // touching anything but the drop list.
    expect(splitStemsFor('demucs-6s')).not.toContain('piano')
    expect(getUvrModel('demucs-6s')?.stems).toContain('piano')
  })

  it('de-duplicates an explicit drop list', () => {
    const req = buildStemSplitRequest({ dropStems: ['piano', 'piano'] })
    expect(req.drop_stems).toEqual(['piano'])
  })

  it('passes the server tier through when given', () => {
    expect(buildStemSplitRequest({ provider: 'runpod' }).provider).toBe(
      'runpod',
    )
    expect(buildStemSplitRequest().provider).toBeUndefined()
  })

  it('refuses to drop the stem that absorbs the residual', () => {
    // Dropping the residual would discard every unplaced sample silently.
    expect(() =>
      buildStemSplitRequest({ dropStems: ['vocal', 'other'] }),
    ).toThrow(/cannot also be dropped/)
  })

  it('refuses models that cannot split into parts', () => {
    expect(() => buildStemSplitRequest({ model: 'roformer' })).toThrow(
      /does not produce multiple stems/,
    )
    expect(() => buildStemSplitRequest({ model: 'nope' })).toThrow(
      /Unknown UVR model/,
    )
  })
})
