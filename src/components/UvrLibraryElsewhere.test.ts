// ── UvrLibraryElsewhere duration label ────────────────────────────────
// A song half a second short of a minute rounded its seconds up to 60
// without carrying the minute, so 179.5 seconds read "2:60".

import { describe, expect, it } from 'vitest'
import type { SongManifest } from '@/db/entities'
import { durationLabel } from './UvrLibraryElsewhere'

function manifest(durationSec: number | null | undefined): SongManifest {
  return {
    id: 'manifest-1',
    createdAt: '2026-10-07T00:00:00.000Z',
    updatedAt: '2026-10-07T00:00:00.000Z',
    userId: 'user-1',
    fileHash: 'hash-1',
    title: 'Song',
    quality: 'lossless',
    durationSec,
  }
}

describe('durationLabel', () => {
  it.each([
    [179.5, '3:00'],
    [119.6, '2:00'],
    [59.6, '1:00'],
    [59.4, '0:59'],
  ])('labels a %s s song "%s"', (seconds, label) => {
    expect(durationLabel(manifest(seconds))).toBe(label)
  })

  it.each([undefined, null, 0])(
    'says nothing for a length of %s',
    (durationSec) => {
      expect(durationLabel(manifest(durationSec))).toBeNull()
    },
  )
})
