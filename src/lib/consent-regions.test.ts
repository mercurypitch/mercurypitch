// ============================================================
// consent-regions tests — which addresses count as in the consent regions
// ============================================================

import { describe, expect, it } from 'vitest'
import { isRestrictedCountry } from './consent-regions'

describe('isRestrictedCountry', () => {
  it('counts the EEA, the UK, Switzerland and the EU territories with codes of their own', () => {
    for (const country of ['DE', 'GB', 'CH', 'NO', 'AX']) {
      expect(isRestrictedCountry(country)).toBe(true)
    }
  })

  it('counts no country outside them', () => {
    for (const country of ['US', 'JP']) {
      expect(isRestrictedCountry(country)).toBe(false)
    }
  })

  it('counts an address with no country, or an unknown one, as in them', () => {
    for (const country of [undefined, null, '', 'XX', 'T1']) {
      expect(isRestrictedCountry(country)).toBe(true)
    }
  })
})
