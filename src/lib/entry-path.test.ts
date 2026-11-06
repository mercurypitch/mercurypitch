// ============================================================
// Entry path: one document, every spelling of its address
// ============================================================

import { describe, expect, it } from 'vitest'
import { entryPath } from './entry-path'

describe('entryPath', () => {
  it.each([
    '/voice-type-test',
    '/voice-type-test/',
    '/voice-type-test//',
    '/voice-type-test.html',
    '/voice-type-test.html/',
  ])('reads %s as /voice-type-test', (pathname) => {
    expect(entryPath(pathname)).toBe('/voice-type-test')
  })

  // The home document keeps its slash: an empty path names nothing.
  it.each(['/', '//'])('keeps %s as the home document', (pathname) => {
    expect(entryPath(pathname)).toBe('/')
  })

  it('leaves a slash inside the path where it is', () => {
    expect(entryPath('/exercises/speed-scales/')).toBe(
      '/exercises/speed-scales',
    )
  })
})
