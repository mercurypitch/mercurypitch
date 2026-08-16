import { describe, expect, it } from 'vitest'
import { releaseLine, shouldAnnounce } from './whats-new-release'

describe('releaseLine', () => {
  it('reduces a version to the line it belongs to', () => {
    expect(releaseLine('0.9.0')).toBe('0.9')
    expect(releaseLine('0.9.7')).toBe('0.9')
    expect(releaseLine('1.0.0')).toBe('1.0')
    expect(releaseLine('10.11.12')).toBe('10.11')
  })

  it('tolerates the shapes a version string actually arrives in', () => {
    expect(releaseLine(' 0.9.0 ')).toBe('0.9')
    expect(releaseLine('0.9.0-beta.2')).toBe('0.9')
  })

  it('returns null rather than guessing at nonsense', () => {
    expect(releaseLine('')).toBeNull()
    expect(releaseLine('dev')).toBeNull()
    expect(releaseLine('v0.9.0')).toBeNull()
  })
})

describe('shouldAnnounce', () => {
  it('announces a new release line to a returning visitor', () => {
    expect(
      shouldAnnounce({ current: '0.9.0', seen: '0.8', returning: true }),
    ).toBe(true)
  })

  it('stays quiet for a patch inside a line already announced', () => {
    expect(
      shouldAnnounce({ current: '0.9.4', seen: '0.9', returning: true }),
    ).toBe(false)
  })

  // The whole point of announcing per line: a patch must not interrupt, or
  // people learn to dismiss the panel and miss the release that matters.
  it('announces once across a line, however many patches ship', () => {
    const seen = '0.9'
    for (const current of ['0.9.1', '0.9.2', '0.9.9']) {
      expect(shouldAnnounce({ current, seen, returning: true }), current).toBe(
        false,
      )
    }
    expect(shouldAnnounce({ current: '0.10.0', seen, returning: true })).toBe(
      true,
    )
  })

  it('says nothing to a first-ever visitor — everything is new to them', () => {
    expect(
      shouldAnnounce({ current: '0.9.0', seen: null, returning: false }),
    ).toBe(false)
  })

  it('announces to a returning visitor who has never been told', () => {
    expect(
      shouldAnnounce({ current: '0.9.0', seen: null, returning: true }),
    ).toBe(true)
  })

  it('says nothing when the version cannot be read', () => {
    expect(
      shouldAnnounce({ current: 'dev', seen: '0.8', returning: true }),
    ).toBe(false)
  })
})
