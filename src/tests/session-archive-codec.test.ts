// Focused safety tests for the bounded session archive codec.

import { strToU8, zipSync } from 'fflate'
import { describe, expect, it, vi } from 'vitest'
import { isSafeSessionArchivePath, parseKaraokeArchiveManifest, parseSessionArchivePayload, readSessionArchiveEntries, SessionArchiveError, } from '@/db/services/session-archive-codec'

const sessionPayload = () => ({
  version: 1,
  session: {
    sessionId: 'old-session',
    status: 'completed',
    progress: 100,
    createdAt: 123,
    originalFile: {
      name: '../unsafe/song.flac',
      size: 4,
      mimeType: 'audio/flac',
    },
    outputs: { vocal: 'private-object-url' },
    apiSessionId: 'private-capability',
    splitApiSessionId: 'private-split-capability',
    groupId: 'old-group',
    mode: 'legacy-field',
  },
  lyrics: null,
  transcription: [{ text: 'hello', timestamp: [0, 1] }],
  pitchAnalysis: null,
})

describe('session archive codec', () => {
  it('rejects traversal and absolute archive paths', () => {
    expect(isSafeSessionArchivePath('sessions/one/session.json')).toBe(true)
    expect(isSafeSessionArchivePath('../session.json')).toBe(false)
    expect(isSafeSessionArchivePath('/session.json')).toBe(false)
    expect(isSafeSessionArchivePath('C:/session.json')).toBe(false)
  })

  it('allowlists imported session fields and sanitizes filenames', () => {
    const parsed = parseSessionArchivePayload(sessionPayload())
    expect(parsed.session.originalFile?.name).toBe('song.flac')
    expect(parsed.session).not.toHaveProperty('outputs')
    expect(parsed.session).not.toHaveProperty('apiSessionId')
    expect(parsed.session).not.toHaveProperty('splitApiSessionId')
    expect(parsed.session).not.toHaveProperty('groupId')
    expect(parsed.session).not.toHaveProperty('mode')
    expect(parsed.transcription).toEqual([{ text: 'hello', timestamp: [0, 1] }])
  })

  it('streams recognized entries in order and skips unrelated files', async () => {
    const archive = new Blob([
      zipSync({
        'sessions/one/session.json': strToU8(JSON.stringify(sessionPayload())),
        'sessions/one/stem_drums.flac': new Uint8Array([1, 2, 3]),
        'sessions/one/README.txt': strToU8('not selected'),
        'karaoke.json': strToU8(
          JSON.stringify({ version: 1, groups: [], playlists: [] }),
        ),
      }),
    ])
    const entries: string[] = []
    await readSessionArchiveEntries(archive, {
      onEntry: async (entry) => {
        await Promise.resolve()
        entries.push(`${entry.kind}:${entry.path}:${entry.size}`)
      },
    })
    expect(entries).toHaveLength(3)
    expect(entries[0]).toMatch(/^json:sessions\/one\/session\.json:\d+$/)
    expect(entries[1]).toBe('audio:sessions/one/stem_drums.flac:3')
    expect(entries[2]).toBe('json:karaoke.json:40')
  })

  it('does not inflate entries rejected by the selector', async () => {
    const onEntry = vi.fn()
    await readSessionArchiveEntries(
      new Blob([
        zipSync({
          'session.json': strToU8(JSON.stringify(sessionPayload())),
          'stem_vocal.wav': new Uint8Array([1, 2, 3]),
        }),
      ]),
      {
        select: (entry) => entry.kind === 'json',
        onEntry,
      },
    )
    expect(onEntry).toHaveBeenCalledTimes(1)
  })

  it('validates karaoke references without persisting database metadata', () => {
    const parsed = parseKaraokeArchiveManifest({
      version: 1,
      groups: [{ id: 'band', name: 'Band', sessionIds: ['song'] }],
      playlists: [
        {
          id: 'set',
          name: 'Set',
          createdAt: 'ignored',
          updatedAt: 'ignored',
          items: [
            {
              id: 'turn',
              kind: 'session',
              refId: 'song',
              singerName: 'Singer',
              vocalVolume: 0.75,
            },
          ],
        },
      ],
    })
    expect(parsed.playlists[0].items[0].vocalVolume).toBe(0.75)
    expect(parsed.playlists[0]).not.toHaveProperty('createdAt')
  })

  it('rejects malformed persisted analysis payloads', () => {
    const payload = sessionPayload()
    payload.transcription = [
      { text: 'reversed', timestamp: [2, 1] },
    ] as typeof payload.transcription
    expect(() => parseSessionArchivePayload(payload)).toThrow(
      SessionArchiveError,
    )
  })

  it('validates bounded melody fingerprints in session manifests', () => {
    const fingerprint = {
      melodyId: 'stem:old-session',
      name: 'Song',
      pitchSequence: [60, 64],
      ioiSequence: [0.5],
      durations: [0.4, 0.4],
      durationSec: 1,
      noteCount: 2,
      chromaSequence: [0, 4],
      intervalSequence: [4],
      bpm: 120,
      key: 'C',
    }
    expect(
      parseSessionArchivePayload({ ...sessionPayload(), fingerprint })
        .fingerprint,
    ).toEqual(fingerprint)
    expect(() =>
      parseSessionArchivePayload({
        ...sessionPayload(),
        fingerprint: { ...fingerprint, noteCount: 3 },
      }),
    ).toThrow(SessionArchiveError)
  })
})
