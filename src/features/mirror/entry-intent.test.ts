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

  it.each(['/mirror', '/mirror/', '/', '/tone-deaf-test'])(
    'does not present %s as a dedicated vocal-range result',
    (pathname) => {
      expect(mirrorEntryIntent(pathname)).toBe('voice-mirror')
    },
  )
})
