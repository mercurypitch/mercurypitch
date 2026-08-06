// Guitar Night song-port tests protect independent URL axes and honest backing plans.
// ============================================================

import { describe, expect, it } from 'vitest'
import { readGuitarNightSession, withGuitarNightSession, } from '@/features/guitar-night/session-link'
import { planGuitarNightBacking, resolveGuitarNightDefaultMix, } from '@/features/guitar-night/song-port'

describe('Guitar Night session links', () => {
  it('sets a backing session without changing the score reference', () => {
    expect(
      withGuitarNightSession(
        'https://mercurypitch.com/guitar-night?song=score-7&room=velvet',
        'uvr-session-12',
      ),
    ).toBe('/guitar-night?song=score-7&room=velvet&session=uvr-session-12')
  })

  it('clears only the backing session', () => {
    expect(
      withGuitarNightSession(
        'https://mercurypitch.com/guitar-night?song=score-7&session=old',
        null,
      ),
    ).toBe('/guitar-night?song=score-7')
  })

  it('rejects empty and unbounded session ids', () => {
    expect(readGuitarNightSession('?session=%20')).toBeNull()
    expect(readGuitarNightSession(`?session=${'s'.repeat(257)}`)).toBeNull()
  })
})

describe('planGuitarNightBacking', () => {
  it('uses individual band parts and leaves guitar out of the default mix', () => {
    const plan = planGuitarNightBacking([
      'vocal',
      'instrumental',
      'drums',
      'bass',
      'guitar',
      'other',
    ])

    expect(plan).toEqual({
      kind: 'parts',
      requested: ['vocal', 'drums', 'bass', 'guitar', 'other'],
    })
  })

  it('uses the mixed instrumental when no distinct guitar part exists', () => {
    expect(planGuitarNightBacking(['vocal', 'instrumental'])).toEqual({
      kind: 'mixed-instrumental',
      requested: ['vocal', 'instrumental'],
    })
  })

  it('does not claim guitar removal for an unusable lone guitar part', () => {
    expect(planGuitarNightBacking(['vocal', 'instrumental', 'guitar'])).toEqual(
      {
        kind: 'mixed-instrumental',
        requested: ['vocal', 'instrumental'],
      },
    )
  })

  it('prefers usable guitar-free band parts over a mixed instrumental', () => {
    expect(
      planGuitarNightBacking(['vocal', 'instrumental', 'drums', 'bass']),
    ).toEqual({
      kind: 'parts',
      requested: ['vocal', 'drums', 'bass'],
    })
  })
})

describe('resolveGuitarNightDefaultMix', () => {
  it('mutes guitar only when the hydrated lease includes another band part', () => {
    expect(
      resolveGuitarNightDefaultMix(['vocal', 'drums', 'bass', 'guitar']),
    ).toEqual({
      kind: 'parts',
      audible: ['vocal', 'drums', 'bass'],
      muted: ['guitar'],
    })
  })

  it('uses an actually hydrated instrumental without claiming guitar removal', () => {
    expect(resolveGuitarNightDefaultMix(['vocal', 'instrumental'])).toEqual({
      kind: 'mixed-instrumental',
      audible: ['vocal', 'instrumental'],
      muted: [],
    })
  })

  it('stages usable band parts honestly when no guitar stem exists', () => {
    expect(resolveGuitarNightDefaultMix(['vocal', 'drums', 'bass'])).toEqual({
      kind: 'parts',
      audible: ['vocal', 'drums', 'bass'],
      muted: [],
    })
  })

  it('rejects a partial lease that cannot provide accompaniment', () => {
    expect(resolveGuitarNightDefaultMix(['vocal', 'guitar'])).toBeNull()
    expect(resolveGuitarNightDefaultMix(['vocal'])).toBeNull()
  })
})
