// The library list, without the audio.
//
// These pin the two things a second device depends on: that a local
// session maps to a manifest a phone can render, and that "what is
// missing here" is decided by content hash rather than by session id --
// the same song separated on two machines is one song.

import { describe, expect, it } from 'vitest'
import type { SongManifest } from '@/db/entities'
import { manifestBytes, manifestFromSession, manifestsMissingHere, parseManifestStems, } from '@/db/services/song-manifest-service'
import type { UvrSession } from '@/stores/uvr-store'

const session = (over: Partial<UvrSession> = {}): UvrSession => ({
  sessionId: 'sess-1',
  status: 'completed',
  progress: 100,
  fileHash: 'hash-1',
  originalFile: { name: 'Ghosts.mp3', size: 5_000_000, mimeType: 'audio/mpeg' },
  stemMeta: {
    vocal: { duration: 227.4, size: 24_000_000 },
    instrumental: { duration: 227.4, size: 24_500_000 },
  },
  createdAt: 1,
  ...over,
})

const manifest = (over: Partial<SongManifest> = {}): SongManifest => ({
  id: 'm1',
  createdAt: '',
  updatedAt: '',
  userId: 'u1',
  fileHash: 'hash-1',
  title: 'Ghosts.mp3',
  quality: 'lossless',
  ...over,
})

describe('manifestFromSession', () => {
  it('describes a completed session without carrying any audio', () => {
    const result = manifestFromSession(session(), { userId: 'u1' })

    expect(result).not.toBeNull()
    expect(result?.fileHash).toBe('hash-1')
    expect(result?.title).toBe('Ghosts.mp3')
    expect(result?.durationSec).toBeCloseTo(227.4)
    expect(result?.quality).toBe('lossless')
    expect(parseManifestStems(result!)).toEqual({
      vocal: { bytes: 24_000_000 },
      instrumental: { bytes: 24_500_000 },
    })
    // Nothing resembling a blob, a URL or a path.
    expect(JSON.stringify(result)).not.toContain('blob:')
  })

  it('refuses a session with no content hash', () => {
    // Without it the same song on two devices is two songs, and neither
    // transport can tell whether it already has the file.
    expect(manifestFromSession(session({ fileHash: undefined }))).toBeNull()
    expect(manifestFromSession(session({ fileHash: '' }))).toBeNull()
  })

  it('refuses a session that has not finished separating', () => {
    expect(manifestFromSession(session({ status: 'processing' }))).toBeNull()
    expect(manifestFromSession(session({ status: 'error' }))).toBeNull()
  })

  it('never advertises the original file', () => {
    // A portable bundle omits it, so promising it here would describe a
    // download nobody can fulfil.
    const result = manifestFromSession(
      session({
        stemMeta: {
          vocal: { size: 10 },
          original: { size: 5_000_000 },
        },
      }),
      { userId: 'u1' },
    )
    expect(Object.keys(parseManifestStems(result!))).toEqual(['vocal'])
  })

  it('marks a song separated here as the real thing', () => {
    expect(manifestFromSession(session(), { userId: 'u1' })?.quality).toBe(
      'lossless',
    )
    expect(
      manifestFromSession(session(), { userId: 'u1', quality: 'portable-128' })
        ?.quality,
    ).toBe('portable-128')
  })
})

describe('manifestBytes', () => {
  it('adds up what a download would cost', () => {
    expect(
      manifestBytes(
        manifest({ stemsJson: '{"vocal":{"bytes":10},"inst":{"bytes":5}}' }),
      ),
    ).toBe(15)
  })

  it('says nothing rather than zero when sizes are unknown', () => {
    expect(manifestBytes(manifest())).toBeUndefined()
    expect(
      manifestBytes(manifest({ stemsJson: '{"vocal":{}}' })),
    ).toBeUndefined()
  })

  it('survives a manifest written by a newer client', () => {
    expect(parseManifestStems({ stemsJson: 'not json' })).toEqual({})
  })
})

describe('manifestsMissingHere', () => {
  it('subtracts by content hash, not by session id', () => {
    // Same song, separated independently on both devices: one song, and
    // nothing to offer to fetch.
    const missing = manifestsMissingHere(
      [manifest({ fileHash: 'hash-1' })],
      [session({ sessionId: 'a-different-session-id', fileHash: 'hash-1' })],
    )
    expect(missing).toEqual([])
  })

  it('lists what this device cannot play', () => {
    const missing = manifestsMissingHere(
      [
        manifest({ id: 'm1', fileHash: 'hash-1' }),
        manifest({ id: 'm2', fileHash: 'hash-2', title: 'Elsewhere.mp3' }),
      ],
      [session({ fileHash: 'hash-1' })],
    )
    expect(missing.map((m) => m.id)).toEqual(['m2'])
  })

  it('does not count a half-finished local session as having the song', () => {
    const missing = manifestsMissingHere(
      [manifest({ fileHash: 'hash-1' })],
      [session({ fileHash: 'hash-1', status: 'processing' })],
    )
    expect(missing).toHaveLength(1)
  })
})
