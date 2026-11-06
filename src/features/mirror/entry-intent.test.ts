import { describe, expect, it } from 'vitest'
import { mirrorEntryIntent } from './entry-intent'

describe('mirrorEntryIntent', () => {
  it.each([
    '/vocal-range-test',
    '/vocal-range-test/',
    '/vocal-range-test.html',
  ])('recognizes the dedicated vocal-range entry at %s', (pathname) => {
    expect(mirrorEntryIntent(pathname)).toBe('vocal-range')
  })

  // Each search landing that opens this room has a door of its own: they
  // fell through to the Mirror's, and three pages read as one.
  it.each([
    '/voice-type-test',
    '/voice-type-test/',
    '/voice-type-test.html',
  ])('recognizes the voice-type test at %s', (pathname) => {
    expect(mirrorEntryIntent(pathname)).toBe('voice-type')
  })

  it.each([
    '/which-singer-has-my-vocal-range',
    '/which-singer-has-my-vocal-range/',
    '/which-singer-has-my-vocal-range.html',
  ])('recognizes the singer match at %s', (pathname) => {
    expect(mirrorEntryIntent(pathname)).toBe('singer-match')
  })

  it.each(['/mirror', '/mirror/', '/', '/tone-deaf-test'])(
    'does not present %s as a dedicated vocal-range result',
    (pathname) => {
      expect(mirrorEntryIntent(pathname)).toBe('voice-mirror')
    },
  )

  // Free Sing is unlinked from the landing on purpose, so its URL is the only
  // way in. If this stops resolving, the mode becomes unreachable rather than
  // merely hidden — and nothing on screen would say so.
  it.each(['/free-sing', '/free-sing/', '/free-sing.html'])(
    'recognizes the unlinked free-sing entry at %s',
    (pathname) => {
      expect(mirrorEntryIntent(pathname)).toBe('free-sing')
    },
  )
})
