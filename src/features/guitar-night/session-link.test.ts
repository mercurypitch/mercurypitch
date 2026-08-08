// Session-link tests keep the score and backing axes from overwriting each other.
// ============================================================

import { describe, expect, it } from 'vitest'
import { readGuitarNightScore, readGuitarNightSession, withGuitarNightScore, withGuitarNightSession, } from './session-link'

const BASE = 'https://mercurypitch.local/guitar-night'

describe('guitar night session links', () => {
  it('reads each axis from its own parameter', () => {
    expect(readGuitarNightSession('?session=uvr-1&song=gsong-1')).toBe('uvr-1')
    expect(readGuitarNightScore('?session=uvr-1&song=gsong-1')).toBe('gsong-1')
    expect(readGuitarNightSession('?song=gsong-1')).toBeNull()
    expect(readGuitarNightScore('?session=uvr-1')).toBeNull()
  })

  it('rejects blank and oversized identifiers on both axes', () => {
    const oversized = 'x'.repeat(257)
    expect(readGuitarNightSession('?session=%20')).toBeNull()
    expect(readGuitarNightScore(`?song=${oversized}`)).toBeNull()
    expect(withGuitarNightScore(`${BASE}?song=gsong-1`, oversized)).toBe(
      '/guitar-night',
    )
  })

  it('writes one axis while preserving the other', () => {
    expect(withGuitarNightScore(`${BASE}?session=uvr-1`, 'gsong-1')).toBe(
      '/guitar-night?session=uvr-1&song=gsong-1',
    )
    expect(withGuitarNightSession(`${BASE}?song=gsong-1`, 'uvr-1')).toBe(
      '/guitar-night?song=gsong-1&session=uvr-1',
    )
  })

  it('clearing one axis leaves the other selection intact', () => {
    expect(
      withGuitarNightScore(`${BASE}?session=uvr-1&song=gsong-1`, null),
    ).toBe('/guitar-night?session=uvr-1')
    expect(
      withGuitarNightSession(`${BASE}?session=uvr-1&song=gsong-1`, null),
    ).toBe('/guitar-night?song=gsong-1')
  })
})
