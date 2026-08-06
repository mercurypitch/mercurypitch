// ============================================================
// Karaoke Playlist — export → import round-trip
// ============================================================
//
// Covers IMPORT-1/2/3 in docs/specs/karaoke-playlist.ears.md: a playlist is
// exported to a real ZIP blob and re-imported; sessions, group membership,
// singers, order, shuffle and play-mode must all be recreated with new ids.
// Small in-memory audio blobs keep every exported session restorable while the
// suite exercises metadata and multi-stem round-trips without large fixtures.

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { describe, expect, it, vi } from 'vitest'
import { InMemoryAdapter } from './utils/in-memory-db'

const adapter = new InMemoryAdapter()
vi.mock('@/db', () => ({ getDb: async () => adapter }))

// jsdom's Blob has no arrayBuffer(); the import path reads the zip via it.
if (typeof Blob.prototype.arrayBuffer !== 'function') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(Blob.prototype as any).arrayBuffer = function (this: Blob) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(this)
    })
  }
}

import type { KaraokePlaylistRecord, SessionGroupRecord, UvrSessionLyrics, UvrSessionRecord, } from '@/db'
import { loadLyricsFromDb, loadLyricsFromDbStrict, saveLyricsToDb, } from '@/db/services/lyrics-db-service'
import { buildKaraokePlaylistZip, buildSessionZip, exportGroup, exportSession, getSafeSessionName, importSessionsFromZip, inspectSessionZip, isZipFile, sanitizeArchiveEntryName, } from '@/db/services/session-export-service'
import { savePitchAnalysisToDb } from '@/db/services/session-pitch-analysis-service'
import { deleteUvrSessionFromDb, getStemBlob, getStemFingerprintData, listStemTypes, saveStemBlob, saveStemFingerprintData, } from '@/db/services/uvr-service'
import { saveTranscriptionToDb } from '@/db/services/whisper-transcription-db-service'
import type { UvrSession } from '@/stores/app-store'
import { addSessionToGroup, createGroup, deleteUvrSession, getAllUvrSessions, getGroupsReactive, importUvrSession, } from '@/stores/app-store'
import { addItem, createPlaylist, getPlaylistsReactive, setPlaylistPlayMode, setPlaylistShuffleOrder, } from '@/stores/karaoke-playlist-store'

function makeSession(sessionId: string, name: string): UvrSession {
  return {
    sessionId,
    originalFile: { name, size: 1234, mimeType: 'audio/mpeg' },
    mode: 'local',
    status: 'completed',
    progress: 100,
    createdAt: Date.now(),
  } as unknown as UvrSession
}

async function seedCoreStem(sessionId: string): Promise<void> {
  await saveStemBlob(
    sessionId,
    'vocal',
    new Blob([`audio-vocal-${sessionId}`], { type: 'audio/wav' }),
    'vocal.wav',
  )
}

async function seedFullBandSession(
  sessionId: string,
  originalName = 'Full Band Song.wav',
): Promise<void> {
  importUvrSession({
    ...makeSession(sessionId, originalName),
    processingMode: 'server',
    provider: 'runpod',
    apiSessionId: `rp_standard_${sessionId}`,
    splitApiSessionId: `rp_split_${sessionId}`,
    bandSplit: true,
    stemMeta: {
      vocal: { duration: 101, size: 1001 },
      instrumental: { duration: 102, size: 1002 },
      drums: { duration: 103, size: 1003 },
      bass: { duration: 104, size: 1004 },
      guitar: { duration: 105, size: 1005 },
      piano: { duration: 106, size: 1006 },
      other: { duration: 107, size: 1007 },
    },
    outputs: {
      vocal: `blob:${sessionId}-vocal`,
      instrumental: `blob:${sessionId}-instrumental`,
    },
  })

  for (const stem of [
    'original',
    'vocal',
    'instrumental',
    'drums',
    'bass',
    'guitar',
    'piano',
    'other',
  ] as const) {
    await saveStemBlob(
      sessionId,
      stem,
      new Blob([`audio-${stem}`], { type: 'audio/wav' }),
      stem === 'original' ? originalName : `${stem}.wav`,
    )
  }
  await saveStemFingerprintData(sessionId, {
    melodyId: `stem:${sessionId}`,
    name: originalName,
    pitchSequence: [60, 64, 67],
    ioiSequence: [0.5, 0.5],
    durations: [0.4, 0.4, 0.4],
    durationSec: 1.4,
    noteCount: 3,
    firstNoteStartSec: 0.1,
    chromaSequence: [0, 4, 7],
    intervalSequence: [4, 3],
    bpm: 120,
    key: 'C',
  })
}

describe('karaoke playlist export → import round-trip', () => {
  it('IMPORT-1/2/3: recreates sessions, groups, singers, order and play-mode with remapped ids', async () => {
    // Three sessions: s1 + s2 in a group, s3 standalone.
    importUvrSession(makeSession('s1', 'Song One'))
    importUvrSession(makeSession('s2', 'Song Two'))
    importUvrSession(makeSession('s3', 'Solo Track'))
    await Promise.all([
      seedCoreStem('s1'),
      seedCoreStem('s2'),
      seedCoreStem('s3'),
    ])

    const group = await createGroup('The Band')
    await addSessionToGroup('s1', group.id)
    await addSessionToGroup('s2', group.id)

    const pl = await createPlaylist('Party Set')
    await addItem(pl.id, {
      kind: 'group',
      refId: group.id,
      singerName: 'Ann',
      shuffleWithinGroup: true,
      vocalVolume: 0.7,
    })
    await addItem(pl.id, { kind: 'session', refId: 's3', singerName: 'Bob' })
    await setPlaylistPlayMode(pl.id, 'roundRobin')
    await setPlaylistShuffleOrder(pl.id, true)

    // Snapshot ids to locate the freshly-imported entities afterwards.
    const beforePlaylistIds = new Set(getPlaylistsReactive().map((p) => p.id))
    const beforeGroupIds = new Set(getGroupsReactive().map((g) => g.id))
    const beforeSessionIds = new Set(
      getAllUvrSessions().map((s) => s.sessionId),
    )

    // Export → import.
    const blob = await buildKaraokePlaylistZip([pl.id])
    expect(blob).not.toBeNull()
    expect(await inspectSessionZip(blob!)).toMatchObject({
      sessionCount: 3,
      playlistCount: 1,
      groupCount: 1,
      hasKaraokeManifest: true,
      valid: true,
    })
    const count = await importSessionsFromZip(blob!)
    expect(count).toBe(3) // s1, s2 (via group) + s3 (standalone)

    // IMPORT-1: new sessions with the original titles.
    const newSessions = getAllUvrSessions().filter(
      (s) => !beforeSessionIds.has(s.sessionId),
    )
    expect(newSessions).toHaveLength(3)
    expect(new Set(newSessions.map((s) => s.originalFile?.name))).toEqual(
      new Set(['Song One', 'Song Two', 'Solo Track']),
    )

    // IMPORT-2: group recreated with the two remapped sessions.
    const newGroup = getGroupsReactive().find((g) => !beforeGroupIds.has(g.id))
    expect(newGroup).toBeDefined()
    expect(newGroup!.name).toBe('The Band')
    expect(newGroup!.sessionIds).toHaveLength(2)
    const groupSongNames = newGroup!.sessionIds.map(
      (sid) => newSessions.find((s) => s.sessionId === sid)?.originalFile?.name,
    )
    expect(new Set(groupSongNames)).toEqual(new Set(['Song One', 'Song Two']))

    // IMPORT-3: playlist recreated with order, singers, shuffle and play-mode.
    const newPl = getPlaylistsReactive().find(
      (p) => !beforePlaylistIds.has(p.id),
    )
    expect(newPl).toBeDefined()
    expect(newPl!.name).toBe('Party Set')
    expect(newPl!.playMode).toBe('roundRobin')
    expect(newPl!.shuffleOrder).toBe(true)
    expect(newPl!.items).toHaveLength(2)

    const groupItem = newPl!.items.find((it) => it.kind === 'group')
    expect(groupItem?.refId).toBe(newGroup!.id) // remapped to the new group
    expect(groupItem?.singerName).toBe('Ann')
    expect(groupItem?.shuffleWithinGroup).toBe(true)
    expect(groupItem?.vocalVolume).toBe(0.7)

    const sessionItem = newPl!.items.find((it) => it.kind === 'session')
    expect(sessionItem?.singerName).toBe('Bob')
    const soloSong = newSessions.find((s) => s.sessionId === sessionItem?.refId)
    expect(soloSong?.originalFile?.name).toBe('Solo Track')
  })

  it('IMPORT-7: exports group songs from canonical session membership when the group index is stale', async () => {
    const canonicalSessionId = 'canonical-group-member'
    const staleSessionId = 'stale-group-member'
    importUvrSession(makeSession(canonicalSessionId, 'Canonical Group Song'))
    importUvrSession(makeSession(staleSessionId, 'Unrelated Stale Song'))
    await seedCoreStem(canonicalSessionId)

    const group = await createGroup('Canonical Export Band')
    await addSessionToGroup(canonicalSessionId, group.id)

    // Simulate a legacy/interrupted denormalized index write. The session's
    // groupId remains the source of truth and must drive archive membership.
    const cachedGroup = getGroupsReactive().find(
      (candidate) => candidate.id === group.id,
    )!
    cachedGroup.sessionIds = [staleSessionId]

    const playlist = await createPlaylist('Canonical Membership Set')
    await addItem(playlist.id, { kind: 'group', refId: group.id })

    const archive = await buildKaraokePlaylistZip([playlist.id])
    expect(archive).not.toBeNull()
    const entries = unzipSync(new Uint8Array(await archive!.arrayBuffer()))
    const manifest = JSON.parse(strFromU8(entries['karaoke.json'])) as {
      groups: { id: string; sessionIds: string[] }[]
    }

    expect(
      manifest.groups.find((candidate) => candidate.id === group.id)
        ?.sessionIds,
    ).toEqual([canonicalSessionId])
    expect(
      Object.keys(entries).some((name) =>
        name.includes('Canonical_Group_Song'),
      ),
    ).toBe(true)
    expect(
      Object.keys(entries).some((name) =>
        name.includes('Unrelated_Stale_Song'),
      ),
    ).toBe(false)
  })
})

describe('isZipFile', () => {
  const make = (name: string, type: string) => new File([''], name, { type })

  it('detects ZIPs by extension regardless of MIME', () => {
    expect(isZipFile(make('MC_Session_song.zip', ''))).toBe(true)
    expect(isZipFile(make('EXPORT.ZIP', 'application/octet-stream'))).toBe(true)
  })

  it('detects ZIPs by MIME variants when the extension is missing', () => {
    expect(isZipFile(make('archive', 'application/zip'))).toBe(true)
    expect(isZipFile(make('archive', 'application/x-zip-compressed'))).toBe(
      true,
    )
  })

  it('rejects audio and other files', () => {
    expect(isZipFile(make('song.mp3', 'audio/mpeg'))).toBe(false)
    expect(isZipFile(make('song.wav', 'audio/wav'))).toBe(false)
    expect(isZipFile(make('zip-tips.txt', 'text/plain'))).toBe(false)
  })
})

describe('getSafeSessionName', () => {
  it('removes audio extensions and replaces unsafe filename characters', () => {
    expect(
      getSafeSessionName({
        sessionId: 'session-1',
        originalFile: { name: 'My Song (Live).MP3' },
      }),
    ).toBe('My_Song__Live_')
  })

  it('handles legacy underscore extensions and missing original files', () => {
    expect(
      getSafeSessionName({
        sessionId: 'session-2',
        originalFile: { name: 'Studio Take_wav' },
      }),
    ).toBe('Studio_Take')
    expect(getSafeSessionName({ sessionId: 'session-3' })).toBe('session-3')
    expect(
      getSafeSessionName({
        sessionId: 'session-4',
        originalFile: { name: '🎵.mp3' },
      }),
    ).toBe('session-4')
  })
})

describe('session archive stem selection', () => {
  it('exports every stored full-band stem by default while omitting transient server handles', async () => {
    const sessionId = 'full-band-default'
    await seedFullBandSession(sessionId)
    await saveLyricsToDb(sessionId, {
      text: 'A lyric line',
      format: 'lrc',
      filename: 'lyrics.lrc',
      wordTimings: { 0: [0.1, 0.4, 0.9] },
    })
    await saveTranscriptionToDb(sessionId, [
      { text: 'A lyric line', timestamp: [0, 1.25] },
    ])
    await savePitchAnalysisToDb(sessionId, {
      segmentedNotes: [],
      mergedNotes: [],
      pitchHistory: [],
    })

    const archive = await buildSessionZip(sessionId)
    const entries = unzipSync(new Uint8Array(await archive.arrayBuffer()))

    expect(Object.keys(entries).sort()).toEqual(
      [
        'original_Full Band Song.wav',
        'session.json',
        'stem_bass.wav',
        'stem_drums.wav',
        'stem_guitar.wav',
        'stem_instrumental.wav',
        'stem_other.wav',
        'stem_piano.wav',
        'stem_vocal.wav',
      ].sort(),
    )
    const payload = JSON.parse(strFromU8(entries['session.json'])) as {
      session: Record<string, unknown>
      lyrics: { text: string; wordTimings: Record<string, number[]> }
      transcription: { text: string; timestamp: [number, number] }[]
      pitchAnalysis: {
        segmentedNotes: unknown[]
        mergedNotes: unknown[]
        pitchHistory: unknown[]
      }
    }
    expect(payload.session).toMatchObject({
      sessionId,
      processingMode: 'server',
      provider: 'runpod',
      bandSplit: true,
    })
    expect(payload.session).not.toHaveProperty('outputs')
    expect(payload.session).not.toHaveProperty('apiSessionId')
    expect(payload.session).not.toHaveProperty('splitApiSessionId')
    expect(payload.lyrics).toMatchObject({ text: 'A lyric line' })
    expect(payload.transcription).toEqual([
      { text: 'A lyric line', timestamp: [0, 1.25] },
    ])
    expect(payload.pitchAnalysis).toEqual({
      segmentedNotes: [],
      mergedNotes: [],
      pitchHistory: [],
    })
    expect(payload).toMatchObject({
      fingerprint: {
        melodyId: `stem:${sessionId}`,
        pitchSequence: [60, 64, 67],
      },
    })
  })

  it('packages only the explicitly selected stems', async () => {
    const sessionId = 'full-band-selected'
    await seedFullBandSession(sessionId)
    const archive = await buildSessionZip(sessionId, undefined, [
      'vocal',
      'bass',
      'drums',
    ])
    const entries = unzipSync(new Uint8Array(await archive.arrayBuffer()))

    expect(Object.keys(entries).sort()).toEqual(
      [
        'original_Full Band Song.wav',
        'session.json',
        'stem_bass.wav',
        'stem_drums.wav',
        'stem_vocal.wav',
      ].sort(),
    )
  })

  it('round-trips only selected stem metadata without phantom controls', async () => {
    const sessionId = 'full-band-custom-round-trip'
    await seedFullBandSession(sessionId)
    const archive = await buildSessionZip(sessionId, undefined, [
      'vocal',
      'drums',
    ])
    const entries = unzipSync(new Uint8Array(await archive.arrayBuffer()))
    const payload = JSON.parse(strFromU8(entries['session.json'])) as {
      session: UvrSession
    }
    expect(Object.keys(payload.session.stemMeta ?? {}).sort()).toEqual([
      'drums',
      'vocal',
    ])

    const beforeIds = new Set(
      getAllUvrSessions().map((session) => session.sessionId),
    )
    expect(await importSessionsFromZip(archive)).toBe(1)
    const restored = getAllUvrSessions().find(
      (session) => !beforeIds.has(session.sessionId),
    )

    expect(Object.keys(restored?.stemMeta ?? {}).sort()).toEqual([
      'drums',
      'vocal',
    ])
    expect(restored?.stemMeta?.vocal?.duration).toBe(101)
    expect(restored?.stemMeta?.drums?.duration).toBe(103)
    expect(restored?.stemMeta).not.toHaveProperty('instrumental')
    expect(await listStemTypes(restored!.sessionId)).toEqual(
      expect.arrayContaining(['original', 'vocal', 'drums']),
    )
  })

  it('rejects a session archive with no restorable core stem', async () => {
    const sessionId = 'part-stem-only'
    importUvrSession(makeSession(sessionId, 'Part Stem Only.wav'))
    await saveStemBlob(
      sessionId,
      'drums',
      new Blob(['drums'], { type: 'audio/wav' }),
      'drums.wav',
    )

    await expect(buildSessionZip(sessionId)).rejects.toThrow(
      /requires a Vocal or Instrumental stem/i,
    )
  })

  it('skips unfinished or stemless members in a group batch export', async () => {
    const readySessionId = 'batch-ready-session'
    const unfinishedSessionId = 'batch-processing-session'
    importUvrSession(makeSession(readySessionId, 'Ready Session.wav'))
    importUvrSession({
      ...makeSession(unfinishedSessionId, 'Still Processing.wav'),
      status: 'processing',
      progress: 42,
    })
    await seedCoreStem(readySessionId)
    const group = await createGroup('Mixed Export Group')
    await addSessionToGroup(readySessionId, group.id)
    await addSessionToGroup(unfinishedSessionId, group.id)

    await expect(exportGroup(group.id)).resolves.toEqual({
      exportedSessions: 1,
      skippedSessions: 1,
    })
  })

  it('includes every stored part stem in a karaoke playlist archive', async () => {
    const sessionId = 'full-band-karaoke-export'
    await seedFullBandSession(sessionId)
    const playlist = await createPlaylist('Full Band Set')
    await addItem(playlist.id, { kind: 'session', refId: sessionId })

    const archive = await buildKaraokePlaylistZip([playlist.id])
    expect(archive).not.toBeNull()
    const entryNames = Object.keys(
      unzipSync(new Uint8Array(await archive!.arrayBuffer())),
    )

    for (const stem of [
      'vocal',
      'instrumental',
      'drums',
      'bass',
      'guitar',
      'piano',
      'other',
    ]) {
      expect(entryNames.some((name) => name.endsWith(`stem_${stem}.wav`))).toBe(
        true,
      )
    }
  })

  it('fails instead of claiming success when a selected stem is unavailable', async () => {
    const sessionId = 'missing-selected-stem'
    importUvrSession(makeSession(sessionId, 'Partial Session.wav'))
    await saveStemBlob(
      sessionId,
      'original',
      new Blob(['original'], { type: 'audio/wav' }),
      'Partial Session.wav',
    )
    await saveStemBlob(
      sessionId,
      'vocal',
      new Blob(['vocal'], { type: 'audio/wav' }),
      'vocal.wav',
    )

    await expect(
      buildSessionZip(sessionId, undefined, ['vocal', 'bass']),
    ).rejects.toThrow(/bass stem is no longer available/i)
  })

  it('discloses a missing original while still exporting valid selected stems', async () => {
    const sessionId = 'missing-original'
    importUvrSession(makeSession(sessionId, 'Missing Original.wav'))
    await saveStemBlob(
      sessionId,
      'vocal',
      new Blob(['vocal'], { type: 'audio/wav' }),
      'vocal.wav',
    )

    const archive = await buildSessionZip(sessionId, undefined, ['vocal'])
    const entries = unzipSync(new Uint8Array(await archive.arrayBuffer()))

    expect(entries).toHaveProperty('stem_vocal.wav')
    expect(strFromU8(entries['README_original_unavailable.txt'])).toMatch(
      /original upload was no longer stored/i,
    )

    const beforeIds = new Set(
      getAllUvrSessions().map((session) => session.sessionId),
    )
    expect(await importSessionsFromZip(archive)).toBe(1)
    const restored = getAllUvrSessions().find(
      (session) => !beforeIds.has(session.sessionId),
    )
    expect(restored?.originalFile).toMatchObject({
      name: 'Missing Original.wav',
      size: 0,
    })
    expect(await listStemTypes(restored!.sessionId)).toEqual(['vocal'])
  })

  it('round-trips part stems through IndexedDB without placing them in session outputs', async () => {
    const sessionId = 'full-band-round-trip'
    await seedFullBandSession(sessionId)
    const archive = await buildSessionZip(sessionId)
    const beforeIds = new Set(
      getAllUvrSessions().map((session) => session.sessionId),
    )

    expect(await importSessionsFromZip(archive)).toBe(1)
    const restored = getAllUvrSessions().find(
      (session) => !beforeIds.has(session.sessionId),
    )
    expect(restored).toBeDefined()
    // Imported audio stays in IndexedDB; the result view hydrates short-lived
    // object URLs only when the user opens it.
    expect(restored?.outputs).toBeUndefined()
    expect(restored).not.toHaveProperty('apiSessionId')
    expect(restored).not.toHaveProperty('splitApiSessionId')
    expect(await listStemTypes(restored!.sessionId)).toEqual(
      expect.arrayContaining([
        'original',
        'vocal',
        'instrumental',
        'drums',
        'bass',
        'guitar',
        'piano',
        'other',
      ]),
    )
    expect(await getStemFingerprintData(restored!.sessionId)).toMatchObject({
      melodyId: `stem:${restored!.sessionId}`,
      name: 'Full Band Song.wav',
      pitchSequence: [60, 64, 67],
    })
  })

  it('sanitizes original filenames before writing ZIP entry paths and metadata', async () => {
    const sessionId = 'unsafe-original-name'
    await seedFullBandSession(sessionId, '../../private/song.wav')

    const archive = await buildSessionZip(sessionId, undefined, ['vocal'])
    const entries = unzipSync(new Uint8Array(await archive.arrayBuffer()))
    const payload = JSON.parse(strFromU8(entries['session.json'])) as {
      session: { originalFile: { name: string } }
    }

    expect(entries).toHaveProperty('original_song.wav')
    expect(Object.keys(entries).every((name) => !name.includes('..'))).toBe(
      true,
    )
    expect(payload.session.originalFile.name).toBe('song.wav')
    expect(sanitizeArchiveEntryName('..\\private/../song.wav')).toBe('song.wav')
  })

  it('preserves non-WAV stem MIME types across export and import', async () => {
    const sessionId = 'flac-stem-round-trip'
    importUvrSession(makeSession(sessionId, 'FLAC Session.wav'))
    await saveStemBlob(
      sessionId,
      'original',
      new Blob(['original'], { type: 'audio/wav' }),
      'FLAC Session.wav',
    )
    await saveStemBlob(
      sessionId,
      'vocal',
      new Blob(['flac-vocal'], { type: 'audio/flac' }),
      'vocal.flac',
    )

    const archive = await buildSessionZip(sessionId, undefined, ['vocal'])
    const entries = unzipSync(new Uint8Array(await archive.arrayBuffer()))
    expect(entries).toHaveProperty('stem_vocal.flac')
    const beforeIds = new Set(
      getAllUvrSessions().map((session) => session.sessionId),
    )

    expect(await importSessionsFromZip(archive)).toBe(1)
    const restored = getAllUvrSessions().find(
      (session) => !beforeIds.has(session.sessionId),
    )
    expect(restored).toBeDefined()
    expect((await getStemBlob(restored!.sessionId, 'vocal'))?.type).toBe(
      'audio/flac',
    )
  })

  it('ignores unknown stem names from an untrusted archive', async () => {
    const payload = {
      version: 1,
      session: {
        ...makeSession('unsafe-stem-source', 'Unsafe Stem'),
        apiSessionId: 'remote-capability',
        splitApiSessionId: 'remote-split-capability',
      },
      lyrics: null,
    }
    const archive = zipSync({
      'session.json': strToU8(JSON.stringify(payload)),
      'stem_vocal.wav': strToU8('vocal'),
      'stem_private-token.wav': strToU8('not-a-real-stem'),
    })
    const beforeIds = new Set(
      getAllUvrSessions().map((session) => session.sessionId),
    )

    expect(
      await importSessionsFromZip(
        new Blob([archive], { type: 'application/zip' }),
      ),
    ).toBe(1)
    const restored = getAllUvrSessions().find(
      (session) => !beforeIds.has(session.sessionId),
    )
    expect(restored).toBeDefined()
    expect(await listStemTypes(restored!.sessionId)).toEqual(['vocal'])
    expect(restored).not.toHaveProperty('apiSessionId')
    expect(restored).not.toHaveProperty('splitApiSessionId')
  })

  it('rejects imported sessions without a Vocal or Instrumental stem', async () => {
    const payload = {
      version: 1,
      session: makeSession('part-only-import', 'Part Only Import'),
      lyrics: null,
    }
    const archive = zipSync({
      'session.json': strToU8(JSON.stringify(payload)),
      'stem_drums.wav': strToU8('drums'),
    })
    const beforeIds = new Set(
      getAllUvrSessions().map((session) => session.sessionId),
    )
    const stemRepository = adapter.getRepository('uvrStemBlobs')
    const stemsBefore = (await stemRepository.findAll({})).length
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(
      await importSessionsFromZip(
        new Blob([archive], { type: 'application/zip' }),
      ),
    ).toBe(0)
    expect(
      getAllUvrSessions().filter(
        (session) => !beforeIds.has(session.sessionId),
      ),
    ).toHaveLength(0)
    expect(await stemRepository.findAll({})).toHaveLength(stemsBefore)
    consoleWarn.mockRestore()
  })

  it('normalizes imported core audio out of stale remote job states', async () => {
    const payload = {
      version: 1,
      session: {
        ...makeSession('stale-status-import', 'Recovered Import'),
        status: 'processing',
        progress: 47,
        indeterminate: true,
        phase: 'processing',
        error: 'stale remote failure',
      },
      lyrics: null,
    }
    const archive = zipSync({
      'session.json': strToU8(JSON.stringify(payload)),
      'stem_vocal.wav': strToU8('vocal'),
    })
    const beforeIds = new Set(
      getAllUvrSessions().map((session) => session.sessionId),
    )

    expect(
      await importSessionsFromZip(
        new Blob([archive], { type: 'application/zip' }),
      ),
    ).toBe(1)
    const restored = getAllUvrSessions().find(
      (session) => !beforeIds.has(session.sessionId),
    )
    expect(restored).toMatchObject({ status: 'completed', progress: 100 })
    expect(restored?.indeterminate).toBeUndefined()
    expect(restored?.phase).toBeUndefined()
    expect(restored?.error).toBeUndefined()
  })

  it('does not report an imported session when a durable stem write fails', async () => {
    const payload = {
      version: 1,
      session: makeSession('failed-write-source', 'Failed Write'),
      lyrics: null,
    }
    const archive = zipSync({
      'session.json': strToU8(JSON.stringify(payload)),
      'stem_vocal.wav': strToU8('vocal'),
    })
    const stemRepository = adapter.getRepository('uvrStemBlobs')
    const writeFailure = vi
      .spyOn(stemRepository, 'create')
      .mockRejectedValue(new Error('simulated storage failure'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(
      await importSessionsFromZip(
        new Blob([archive], { type: 'application/zip' }),
      ),
    ).toBe(0)
    expect(writeFailure).toHaveBeenCalledTimes(2)

    writeFailure.mockRestore()
    consoleError.mockRestore()
  })

  it('IMPORT-6: propagates a fingerprint cleanup failure instead of claiming rollback', async () => {
    const payload = {
      version: 1,
      session: makeSession('cleanup-fingerprint-source', 'Cleanup Failure'),
      lyrics: null,
      fingerprint: {
        melodyId: 'stem:cleanup-fingerprint-source',
        name: 'Cleanup Failure',
        pitchSequence: [60, 64, 67],
        ioiSequence: [0.5, 0.5],
        durations: [0.4, 0.4, 0.4],
        durationSec: 1.4,
        noteCount: 3,
        chromaSequence: [0, 4, 7],
        intervalSequence: [4, 3],
        bpm: 120,
        key: 'C',
      },
    }
    const archive = zipSync({
      'session.json': strToU8(JSON.stringify(payload)),
      'stem_vocal.wav': strToU8('vocal'),
    })
    const sessionRepository = adapter.getRepository('uvrSessions')
    const fingerprintRepository = adapter.getRepository('uvrStemFingerprints')
    const fingerprintsBefore = new Set(
      (await fingerprintRepository.findAll({})).map((entry) => entry.id),
    )
    const sessionWriteFailure = vi
      .spyOn(sessionRepository, 'create')
      .mockRejectedValue(new Error('simulated session write failure'))
    const fingerprintDeleteFailure = vi
      .spyOn(fingerprintRepository, 'delete')
      .mockRejectedValue(new Error('simulated fingerprint delete failure'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      await expect(
        importSessionsFromZip(new Blob([archive], { type: 'application/zip' })),
      ).rejects.toThrow(/could not be completely rolled back/i)
      expect(sessionWriteFailure).toHaveBeenCalledTimes(2)
      expect(fingerprintDeleteFailure).toHaveBeenCalled()
    } finally {
      sessionWriteFailure.mockRestore()
      fingerprintDeleteFailure.mockRestore()
      consoleError.mockRestore()
      for (const entry of await fingerprintRepository.findAll({})) {
        if (!fingerprintsBefore.has(entry.id))
          await fingerprintRepository.delete(entry.id)
      }
    }
  })

  it('fails export when auxiliary session data cannot be read', async () => {
    const sessionId = 'lyrics-read-failure'
    await seedFullBandSession(sessionId)
    const lyricsRepository = adapter.getRepository('uvrSessionLyrics')
    const readFailure = vi
      .spyOn(lyricsRepository, 'findAll')
      .mockRejectedValue(new Error('simulated lyrics read failure'))

    await expect(buildSessionZip(sessionId)).rejects.toThrow(
      /simulated lyrics read failure/i,
    )
    readFailure.mockRestore()
  })

  it('keeps core lyrics visible when optional persisted metadata is corrupt', async () => {
    const sessionId = 'tolerant-lyrics-load'
    await adapter.getRepository<UvrSessionLyrics>('uvrSessionLyrics').create({
      sessionId,
      text: 'The lyric itself survives',
      format: 'lrc',
      filename: 'survives.lrc',
      wordTimingsJson: '{broken',
      blocksJson: '[also broken',
    })
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(loadLyricsFromDbStrict(sessionId)).rejects.toThrow()
    await expect(loadLyricsFromDb(sessionId)).resolves.toEqual({
      text: 'The lyric itself survives',
      format: 'lrc',
      filename: 'survives.lrc',
    })
    consoleWarn.mockRestore()
  })

  it('allows only one archive download to be built at a time', async () => {
    const sessionId = 'exclusive-export'
    await seedFullBandSession(sessionId)
    const stemRepository = adapter.getRepository('uvrStemBlobs')
    const originalFindAll = stemRepository.findAll.bind(stemRepository)
    let releaseRead = (): void => undefined
    const readGate = new Promise<void>((resolve) => {
      releaseRead = resolve
    })
    let blockNextRead = true
    const read = vi
      .spyOn(stemRepository, 'findAll')
      .mockImplementation(async (options) => {
        if (blockNextRead) {
          blockNextRead = false
          await readGate
        }
        return originalFindAll(options)
      })

    const first = exportSession(sessionId, undefined, ['vocal'])
    await vi.waitFor(() => expect(read).toHaveBeenCalled())
    await expect(
      exportSession(sessionId, undefined, ['vocal']),
    ).rejects.toMatchObject({ name: 'ArchiveExportBusyError' })

    releaseRead()
    await first
    read.mockRestore()
  })

  it('rolls back stems when auxiliary session data cannot be saved', async () => {
    const payload = {
      version: 1,
      session: makeSession('lyrics-write-source', 'Lyrics Write Failure'),
      lyrics: { text: 'line', format: 'txt', filename: 'lyrics.txt' },
    }
    const archive = zipSync({
      'session.json': strToU8(JSON.stringify(payload)),
      'stem_vocal.wav': strToU8('vocal'),
    })
    const beforeSessionIds = new Set(
      getAllUvrSessions().map((session) => session.sessionId),
    )
    const stemRepository = adapter.getRepository('uvrStemBlobs')
    const stemsBefore = (await stemRepository.findAll({})).length
    const lyricsRepository = adapter.getRepository('uvrSessionLyrics')
    const writeFailure = vi
      .spyOn(lyricsRepository, 'create')
      .mockRejectedValue(new Error('simulated lyrics write failure'))

    expect(
      await importSessionsFromZip(
        new Blob([archive], { type: 'application/zip' }),
      ),
    ).toBe(0)
    expect(
      getAllUvrSessions().filter(
        (session) => !beforeSessionIds.has(session.sessionId),
      ),
    ).toHaveLength(0)
    expect(await stemRepository.findAll({})).toHaveLength(stemsBefore)
    writeFailure.mockRestore()
  })

  it('rejects audio placed before its session manifest instead of dropping it', async () => {
    const payload = {
      version: 1,
      session: makeSession('reordered-source', 'Reordered Archive'),
      lyrics: null,
    }
    const archive = zipSync({
      'stem_vocal.wav': strToU8('vocal'),
      'session.json': strToU8(JSON.stringify(payload)),
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      importSessionsFromZip(new Blob([archive], { type: 'application/zip' })),
    ).rejects.toThrow(/before its session manifest/i)
    consoleError.mockRestore()
  })

  it('rejects a malformed karaoke manifest without partially importing sessions', async () => {
    const payload = {
      version: 1,
      session: makeSession('bad-karaoke-source', 'Bad Karaoke Manifest'),
      lyrics: null,
    }
    const archive = zipSync({
      'sessions/one/session.json': strToU8(JSON.stringify(payload)),
      'karaoke.json': strToU8('{broken'),
    })
    const beforeSessionIds = new Set(
      getAllUvrSessions().map((session) => session.sessionId),
    )
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      importSessionsFromZip(new Blob([archive], { type: 'application/zip' })),
    ).rejects.toThrow(/karaoke manifest is invalid/i)
    expect(
      getAllUvrSessions().filter(
        (session) => !beforeSessionIds.has(session.sessionId),
      ),
    ).toHaveLength(0)
    consoleError.mockRestore()
  })

  it('skips audio belonging to an invalid session while importing valid siblings', async () => {
    const validPayload = {
      version: 1,
      session: makeSession('valid-sibling-source', 'Valid Sibling'),
      lyrics: null,
    }
    const archive = zipSync({
      'valid/session.json': strToU8(JSON.stringify(validPayload)),
      'valid/stem_vocal.wav': strToU8('valid vocal'),
      'invalid/session.json': strToU8('{broken'),
      'invalid/stem_vocal.wav': strToU8('ignored vocal'),
    })
    const beforeSessionIds = new Set(
      getAllUvrSessions().map((session) => session.sessionId),
    )

    expect(
      await importSessionsFromZip(
        new Blob([archive], { type: 'application/zip' }),
      ),
    ).toBe(1)
    const restored = getAllUvrSessions().find(
      (session) => !beforeSessionIds.has(session.sessionId),
    )
    expect(restored?.originalFile?.name).toBe('Valid Sibling')
    expect(await listStemTypes(restored!.sessionId)).toEqual(['vocal'])
  })

  it('IMPORT-8: rolls back sessions, groups and playlists when a later playlist write fails', async () => {
    const payload = {
      version: 1,
      session: makeSession('manifest-rollback-source', 'Rollback Song'),
      lyrics: null,
    }
    const manifest = {
      version: 1,
      groups: [
        {
          id: 'source-group',
          name: 'Rollback Band',
          sessionIds: ['manifest-rollback-source'],
        },
      ],
      playlists: [
        {
          id: 'source-playlist-one',
          name: 'Rollback Set One',
          items: [{ kind: 'group', refId: 'source-group' }],
        },
        {
          id: 'source-playlist-two',
          name: 'Rollback Set Two',
          items: [{ kind: 'session', refId: 'manifest-rollback-source' }],
        },
      ],
    }
    const archive = zipSync({
      'sessions/rollback/session.json': strToU8(JSON.stringify(payload)),
      'sessions/rollback/stem_vocal.wav': strToU8('vocal'),
      'karaoke.json': strToU8(JSON.stringify(manifest)),
    })
    const sessionIdsBefore = new Set(
      getAllUvrSessions().map((session) => session.sessionId),
    )
    const groupIdsBefore = new Set(getGroupsReactive().map((group) => group.id))
    const playlistIdsBefore = new Set(
      getPlaylistsReactive().map((playlist) => playlist.id),
    )
    const playlistRepository =
      adapter.getRepository<KaraokePlaylistRecord>('karaokePlaylists')
    const originalCreate = playlistRepository.create.bind(playlistRepository)
    let writeAttempt = 0
    const writeFailure = vi
      .spyOn(playlistRepository, 'create')
      .mockImplementation((entity) => {
        writeAttempt++
        if (writeAttempt === 2)
          return Promise.reject(new Error('simulated second playlist failure'))
        return originalCreate(entity)
      })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      importSessionsFromZip(new Blob([archive], { type: 'application/zip' })),
    ).rejects.toThrow(/playlists and groups could not be restored/i)

    expect(
      getAllUvrSessions()
        .map((session) => session.sessionId)
        .filter((id) => !sessionIdsBefore.has(id)),
    ).toEqual([])
    expect(
      getGroupsReactive()
        .map((group) => group.id)
        .filter((id) => !groupIdsBefore.has(id)),
    ).toEqual([])
    expect(
      getPlaylistsReactive()
        .map((playlist) => playlist.id)
        .filter((id) => !playlistIdsBefore.has(id)),
    ).toEqual([])
    expect(writeFailure).toHaveBeenCalledTimes(2)

    writeFailure.mockRestore()
    consoleError.mockRestore()
  })

  it('IMPORT-8: propagates a session-data delete failure during manifest rollback', async () => {
    const payload = {
      version: 1,
      session: makeSession('manifest-cleanup-source', 'Manifest Cleanup'),
      lyrics: null,
    }
    const manifest = {
      version: 1,
      groups: [],
      playlists: [
        {
          id: 'manifest-cleanup-playlist-one',
          name: 'Manifest Cleanup One',
          items: [{ kind: 'session', refId: 'manifest-cleanup-source' }],
        },
        {
          id: 'manifest-cleanup-playlist-two',
          name: 'Manifest Cleanup Two',
          items: [{ kind: 'session', refId: 'manifest-cleanup-source' }],
        },
      ],
    }
    const archive = zipSync({
      'sessions/cleanup/session.json': strToU8(JSON.stringify(payload)),
      'sessions/cleanup/stem_vocal.wav': strToU8('vocal'),
      'karaoke.json': strToU8(JSON.stringify(manifest)),
    })
    const playlistRepository =
      adapter.getRepository<KaraokePlaylistRecord>('karaokePlaylists')
    const originalCreate = playlistRepository.create.bind(playlistRepository)
    let writeAttempt = 0
    const playlistWriteFailure = vi
      .spyOn(playlistRepository, 'create')
      .mockImplementation((entity) => {
        writeAttempt++
        if (writeAttempt === 2)
          return Promise.reject(new Error('simulated playlist write failure'))
        return originalCreate(entity)
      })
    const stemRepository = adapter.getRepository('uvrStemBlobs')
    const stemDeleteFailure = vi
      .spyOn(stemRepository, 'delete')
      .mockRejectedValue(new Error('simulated stem delete failure'))
    const sessionIdsBefore = new Set(
      getAllUvrSessions().map((session) => session.sessionId),
    )
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      await expect(
        importSessionsFromZip(new Blob([archive], { type: 'application/zip' })),
      ).rejects.toThrow(/could not be completely rolled back/i)
      expect(stemDeleteFailure).toHaveBeenCalled()
    } finally {
      playlistWriteFailure.mockRestore()
      stemDeleteFailure.mockRestore()
      consoleError.mockRestore()
      const retained = getAllUvrSessions().filter(
        (session) => !sessionIdsBefore.has(session.sessionId),
      )
      for (const session of retained) {
        await deleteUvrSessionFromDb(session.sessionId)
        deleteUvrSession(session.sessionId)
      }
    }
  })
})

describe('inspectSessionZip', () => {
  it('counts only sessions that the importer can actually add', async () => {
    const valid = {
      version: 1,
      session: makeSession('valid', 'Valid Song'),
      lyrics: null,
    }
    const zip = zipSync({
      'one/session.json': strToU8(JSON.stringify(valid)),
      'one/stem_vocal.wav': strToU8('vocal'),
      'two/session.json': strToU8('{broken json'),
    })

    const result = await inspectSessionZip(
      new Blob([zip], { type: 'application/zip' }),
    )

    expect(result).toMatchObject({
      sessionCount: 1,
      invalidSessionCount: 1,
      valid: true,
      error: '1 invalid session entry will be skipped',
    })
  })

  it('marks a valid manifest without core audio as incomplete', async () => {
    const payload = {
      version: 1,
      session: makeSession('inspect-part-only', 'Part Only'),
      lyrics: null,
    }
    const zip = zipSync({
      'one/session.json': strToU8(JSON.stringify(payload)),
      'one/stem_drums.wav': strToU8('drums'),
    })

    await expect(
      inspectSessionZip(new Blob([zip], { type: 'application/zip' })),
    ).resolves.toMatchObject({
      sessionCount: 0,
      invalidSessionCount: 1,
      valid: false,
      error: 'No valid MercuryPitch sessions found',
    })
  })

  it('reports an unreadable file without throwing', async () => {
    const result = await inspectSessionZip(
      new Blob(['not-a-zip'], { type: 'application/zip' }),
    )
    expect(result).toMatchObject({
      sessionCount: 0,
      valid: false,
      error: 'ZIP could not be read',
    })
  })
})

describe('plain session ZIP group assignment', () => {
  it('keeps imported membership, moves and persisted indexes consistent', async () => {
    const beforeSessionIds = new Set(
      getAllUvrSessions().map((session) => session.sessionId),
    )
    const target = await createGroup('Test import target')
    const zip = zipSync({
      'one/session.json': strToU8(
        JSON.stringify({
          version: 1,
          session: makeSession('plain-1', 'Plain One'),
        }),
      ),
      'one/stem_vocal.wav': strToU8('vocal one'),
      'two/session.json': strToU8(
        JSON.stringify({
          version: 1,
          session: makeSession('plain-2', 'Plain Two'),
        }),
      ),
      'two/stem_vocal.wav': strToU8('vocal two'),
      'three/session.json': strToU8(
        JSON.stringify({
          version: 1,
          session: makeSession('plain-3', 'Plain Three'),
        }),
      ),
      'three/stem_vocal.wav': strToU8('vocal three'),
    })

    expect(
      await importSessionsFromZip(
        new Blob([zip], { type: 'application/zip' }),
        target.id,
      ),
    ).toBe(3)

    const imported = getAllUvrSessions().filter(
      (session) => !beforeSessionIds.has(session.sessionId),
    )
    expect(imported).toHaveLength(3)
    expect(imported.every((session) => session.groupId === target.id)).toBe(
      true,
    )
    expect(
      getGroupsReactive().find((group) => group.id === target.id)?.sessionIds,
    ).toEqual(imported.map((session) => session.sessionId))

    const destination = await createGroup('Moved destination')
    const moved = imported[0]
    await addSessionToGroup(moved.sessionId, destination.id)

    expect(getUvrSessionGroupId(moved.sessionId)).toBe(destination.id)
    expect(
      getGroupsReactive().find((group) => group.id === target.id)?.sessionIds,
    ).toEqual(imported.slice(1).map((session) => session.sessionId))
    expect(
      getGroupsReactive().find((group) => group.id === destination.id)
        ?.sessionIds,
    ).toEqual([moved.sessionId])

    const groupRepo = adapter.getRepository<SessionGroupRecord>('sessionGroups')
    expect((await groupRepo.findById(target.id))?.sessionIds).toEqual(
      imported.slice(1).map((session) => session.sessionId),
    )
    expect((await groupRepo.findById(destination.id))?.sessionIds).toEqual([
      moved.sessionId,
    ])

    const sessionRepo = adapter.getRepository<UvrSessionRecord>('uvrSessions')
    const persisted = await sessionRepo.findAll({
      where: { appSessionId: moved.sessionId },
      limit: 1,
    })
    expect(persisted[0]?.groupId).toBe(destination.id)

    const rapidFirst = await createGroup('Rapid move first')
    const rapidLast = await createGroup('Rapid move last')
    await Promise.all([
      addSessionToGroup(moved.sessionId, rapidFirst.id),
      addSessionToGroup(moved.sessionId, rapidLast.id),
    ])

    expect(getUvrSessionGroupId(moved.sessionId)).toBe(rapidLast.id)
    expect(
      getGroupsReactive().find((group) => group.id === rapidFirst.id)
        ?.sessionIds,
    ).toEqual([])
    expect(
      getGroupsReactive().find((group) => group.id === rapidLast.id)
        ?.sessionIds,
    ).toEqual([moved.sessionId])
  })
})

function getUvrSessionGroupId(sessionId: string): string | undefined {
  return getAllUvrSessions().find((session) => session.sessionId === sessionId)
    ?.groupId
}
