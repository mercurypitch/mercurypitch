// ============================================================
// A song of the singer's own that is no longer on this phone
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UvrSession } from '@/stores/uvr-store'

/** Stage 2 (a build that imports songs), switched per test. */
const build = vi.hoisted(() => ({ importing: true }))
vi.mock('@/lib/native-build', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    get KARAOKE_IMPORT() {
      return build.importing
    },
  }
})

const disk = vi.hoisted(() => ({
  presence: 'absent' as 'present' | 'absent' | 'unknown',
  sessions: new Map<string, UvrSession>(),
}))
vi.mock('@/db/services/uvr-service', () => ({
  sessionStemPresence: async () => Promise.resolve(disk.presence),
}))
vi.mock('@/stores/uvr-store', () => ({
  getUvrSession: (id: string) => disk.sessions.get(id),
  deleteUvrSession: vi.fn(async () => Promise.resolve(true)),
}))

vi.mock('@/stores/notifications-store', () => ({
  showNotification: vi.fn(),
  showActionNotification: vi.fn(),
}))

vi.mock('./karaoke-import-queue', () => ({
  retryImport: vi.fn(),
  removeImportedSong: vi.fn(async () => Promise.resolve(true)),
}))

import { showActionNotification, showNotification, } from '@/stores/notifications-store'
import { deleteUvrSession } from '@/stores/uvr-store'
import { removeImportedSong, retryImport } from './karaoke-import-queue'
import type { RoomSong } from './karaoke-room-library'
import { isMissing, missingSongWay, sayMissingSong } from './missing-song'

const HOUR = 60 * 60 * 1000
const NOW = Date.UTC(2026, 9, 26, 3, 0)

const session = (over: Partial<UvrSession> = {}): UvrSession => ({
  sessionId: 'mine',
  status: 'completed',
  progress: 100,
  processingMode: 'server',
  apiSessionId: 'job-1',
  originalFile: { name: 'My Song.mp3', size: 1, mimeType: 'audio/mpeg' },
  createdAt: NOW - 2 * HOUR,
  ...over,
})

const SONG: RoomSong = {
  sessionId: 'mine',
  title: 'My Song',
  artist: null,
  durationSec: 201,
  credit: null,
  kind: 'yours',
  stems: { vocal: '', instrumental: '' },
}

/** The action the notice offers: its label, and a tap on it. */
function offered(): { message: string; label: string; tap: () => void } {
  const call = vi.mocked(showActionNotification).mock.calls.at(-1)
  if (call === undefined) throw new Error('no notice with an action')
  const [message, , action] = call
  return { message, label: action.label, tap: action.onClick }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  build.importing = true
  disk.presence = 'absent'
  disk.sessions = new Map([['mine', session()]])
})

describe('the way back', () => {
  it('downloads again a song the server still keeps', () => {
    expect(missingSongWay(session(), 'absent', NOW)).toBe('download')
    expect(missingSongWay(session(), 'present', NOW)).toBe('download')
  })

  it('removes one the server has let go of, a day after it was picked', () => {
    expect(
      missingSongWay(session({ createdAt: NOW - 25 * HOUR }), 'absent', NOW),
    ).toBe('remove')
  })

  it('removes one that was never separated on the server', () => {
    expect(
      missingSongWay(session({ apiSessionId: undefined }), 'absent', NOW),
    ).toBe('remove')
    expect(
      missingSongWay(session({ processingMode: 'local' }), 'absent', NOW),
    ).toBe('remove')
  })

  it('only says to try again when the stems could not be read', () => {
    expect(missingSongWay(session(), 'unknown', NOW)).toBe('retry')
  })

  it('never downloads in a build that does not import', () => {
    build.importing = false

    expect(missingSongWay(session(), 'absent', NOW)).toBe('remove')
  })
})

describe('telling the singer', () => {
  it('offers to download it again, which uses no song', async () => {
    await sayMissingSong(SONG)

    const notice = offered()
    expect(notice.message).toBe(
      'My Song is no longer on this phone. The server still has it, and downloading it again uses no song.',
    )
    expect(notice.label).toBe('Download again')
    notice.tap()
    expect(retryImport).toHaveBeenCalledWith('mine')
  })

  it('offers to remove one no server has, and says importing it uses a song', async () => {
    disk.sessions.set('mine', session({ createdAt: NOW - 30 * HOUR }))

    await sayMissingSong(SONG)

    const notice = offered()
    expect(notice.message).toBe(
      'My Song is no longer on this phone. Remove it, then import it again from Files. Separating it again uses a song.',
    )
    expect(notice.label).toBe('Remove')
    notice.tap()
    expect(removeImportedSong).toHaveBeenCalledWith('mine')
    expect(retryImport).not.toHaveBeenCalled()
  })

  it('removes the row alone in a build that does not import', async () => {
    build.importing = false

    await sayMissingSong(SONG)

    const notice = offered()
    expect(notice.message).toBe('My Song is no longer on this phone.')
    notice.tap()
    expect(deleteUvrSession).toHaveBeenCalledWith('mine')
    expect(removeImportedSong).not.toHaveBeenCalled()
  })

  it('offers nothing that deletes when the stems could not be read', async () => {
    disk.presence = 'unknown'

    await sayMissingSong(SONG)

    expect(showActionNotification).not.toHaveBeenCalled()
    expect(showNotification).toHaveBeenCalledWith(
      'My Song could not be read from this phone. Try it again in a moment.',
      'warning',
    )
  })

  it('says nothing of a song that has been removed meanwhile', async () => {
    disk.sessions.clear()

    await sayMissingSong(SONG)

    expect(showActionNotification).not.toHaveBeenCalled()
    expect(showNotification).not.toHaveBeenCalled()
  })
})

describe('a song cued without both stems', () => {
  const opened = { vocal: 'blob:v', instrumental: 'blob:i' }

  it('is missing when it is your own', () => {
    expect(isMissing(SONG, { ...opened, vocal: '' })).toBe(true)
    expect(isMissing(SONG, { ...opened, instrumental: '' })).toBe(true)
    expect(isMissing(SONG, opened)).toBe(false)
  })

  it('is never missing when it is an example', () => {
    expect(isMissing({ ...SONG, kind: 'example' }, SONG.stems)).toBe(false)
  })
})
