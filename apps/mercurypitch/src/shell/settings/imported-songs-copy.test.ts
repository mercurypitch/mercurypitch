// ============================================================
// The words for imported songs name the device in hand
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import { actAsIpad } from '@/tests/helpers/ipad-navigator'
import { importedSongsStorageLine, removeImportedQuestion, songsStuckLine, } from './imported-songs-copy'

describe('imported songs copy', () => {
  let restore: (() => void) | null = null
  afterEach(() => {
    restore?.()
    restore = null
  })

  it('says "this phone" on a phone', () => {
    expect(importedSongsStorageLine(0)).toBe('None on this phone')
    expect(songsStuckLine(1)).toBe(
      '1 song could not be removed. It is still on this phone.',
    )
  })

  it('says "this iPad" on an iPad', () => {
    restore = actAsIpad()

    expect(importedSongsStorageLine(0)).toBe('None on this iPad')
    expect(removeImportedQuestion(3).text).toBe(
      'Their voice and music leave this iPad. The originals are still in Files, and the example songs stay.',
    )
    expect(songsStuckLine(1)).toBe(
      '1 song could not be removed. It is still on this iPad.',
    )
    expect(songsStuckLine(2)).toBe(
      '2 songs could not be removed. They are still on this iPad.',
    )
  })
})
