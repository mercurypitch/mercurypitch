// A session accumulates lyric versions and they are not equally good --
// LRCLib's line timings are routinely a second or two out, so the
// hand-corrected one is usually what you want to sing to. These pin that
// the room offers the choice and opens on the right one.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sessionLyricChoices, sessionSongLines, } from '@/lib/jam/jam-session-songs'

const loadLyricsFromDb = vi.hoisted(() => vi.fn())
vi.mock('@/db/services/lyrics-db-service', () => ({
  loadLyricsFromDb,
  saveLyricsToDb: vi.fn(),
}))
vi.mock('@/db/services/session-pitch-analysis-service', () => ({
  loadPitchAnalysisFromDb: vi.fn(async () => null),
}))
vi.mock('@/db/services/uvr-service', () => ({
  getStemBlobUrl: vi.fn(async () => null),
}))

const IMPORTED = '[00:01.00] imported one\n[00:05.00] imported two'
const EDITED = '[00:01.40] edited one\n[00:05.30] edited two'

describe('sessionLyricChoices', () => {
  beforeEach(() => {
    loadLyricsFromDb.mockReset()
  })

  it('offers every version that has timings', async () => {
    loadLyricsFromDb.mockResolvedValue({
      text: IMPORTED,
      format: 'lrc',
      filename: 'x.lrc',
      activeVersionKind: 'edited',
      versions: [
        { kind: 'imported', text: IMPORTED, createdAt: 1 },
        { kind: 'edited', text: EDITED, createdAt: 2 },
      ],
    })
    const choices = await sessionLyricChoices('s1')
    expect(choices.map((c) => c.kind)).toEqual(['imported', 'edited'])
    expect(choices.map((c) => c.label)).toEqual(['Original', 'Edited'])
    expect(choices.find((c) => c.kind === 'edited')?.active).toBe(true)
  })

  it('drops versions with no timings, which cannot scroll', async () => {
    loadLyricsFromDb.mockResolvedValue({
      text: IMPORTED,
      format: 'lrc',
      filename: 'x.lrc',
      versions: [
        { kind: 'imported', text: IMPORTED, createdAt: 1 },
        { kind: 'whisper', text: 'plain words, no times', createdAt: 2 },
      ],
    })
    const choices = await sessionLyricChoices('s1')
    expect(choices.map((c) => c.kind)).toEqual(['imported'])
  })

  it('falls back to the single stored text for a session with no history', async () => {
    // Sessions saved before versions existed still have words worth singing.
    loadLyricsFromDb.mockResolvedValue({
      text: IMPORTED,
      format: 'lrc',
      filename: 'x.lrc',
    })
    const choices = await sessionLyricChoices('s1')
    expect(choices).toHaveLength(1)
    expect(choices[0]?.active).toBe(true)
  })

  it('offers nothing for plain-text lyrics', async () => {
    loadLyricsFromDb.mockResolvedValue({
      text: 'just words',
      format: 'txt',
      filename: 'x.txt',
    })
    expect(await sessionLyricChoices('s1')).toEqual([])
  })

  it('survives a database failure, because lyrics are a nicety', async () => {
    loadLyricsFromDb.mockImplementation(async () => {
      throw new Error('idb gone')
    })
    expect(await sessionLyricChoices('s1')).toEqual([])
  })
})

describe('sessionSongLines', () => {
  beforeEach(() => {
    loadLyricsFromDb.mockReset()
  })

  it('opens on the version the mixer had selected, not on the raw text', async () => {
    // The bug this pins: `text` held the import, so a room ignored the
    // hand-corrected timings the singer had already fixed.
    loadLyricsFromDb.mockResolvedValue({
      text: IMPORTED,
      format: 'lrc',
      filename: 'x.lrc',
      activeVersionKind: 'edited',
      versions: [
        { kind: 'imported', text: IMPORTED, createdAt: 1 },
        { kind: 'edited', text: EDITED, createdAt: 2 },
      ],
    })
    const lines = await sessionSongLines('s1')
    expect(lines[0]?.text).toBe('edited one')
    expect(lines[0]?.startSec).toBeCloseTo(1.4)
  })

  it('falls back to the first version when none is marked active', async () => {
    loadLyricsFromDb.mockResolvedValue({
      text: IMPORTED,
      format: 'lrc',
      filename: 'x.lrc',
      versions: [{ kind: 'imported', text: IMPORTED, createdAt: 1 }],
    })
    const lines = await sessionSongLines('s1')
    expect(lines[0]?.text).toBe('imported one')
  })
})
