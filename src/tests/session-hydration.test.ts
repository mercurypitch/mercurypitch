import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureSessionHydrated } from '@/features/stem-mixer/karaoke-playlist-runner'
import type { UvrSession } from '@/stores/uvr-store'
import { saveAllUvrSessions } from '@/stores/uvr-store'

vi.mock('@/db/services/uvr-service', () => ({
  hydrateStemUrls: vi.fn(),
}))

import { hydrateStemUrls } from '@/db/services/uvr-service'

const mockedHydrate = vi.mocked(hydrateStemUrls)

function makeSession(outputs?: {
  vocal?: string
  instrumental?: string
}): UvrSession {
  return {
    sessionId: 'sess-1',
    status: 'completed',
    progress: 100,
    createdAt: 1,
    originalFile: { name: 'song.mp3', size: 1, mimeType: 'audio/mpeg' },
    outputs,
  } as unknown as UvrSession
}

describe('ensureSessionHydrated', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockedHydrate.mockReset()
    saveAllUvrSessions([])
  })

  it('returns as-is when the blob URL is alive (GET probe — blob: rejects HEAD by spec)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchSpy)
    const s = makeSession({ vocal: 'blob:live' })
    const out = await ensureSessionHydrated(s)
    expect(out).toBe(s)
    expect(mockedHydrate).not.toHaveBeenCalled()
    // Must NOT be a HEAD request — blob: URLs only support GET, so a HEAD
    // probe reports every live URL as dead (the old always-re-mint bug).
    const init = fetchSpy.mock.calls[0][1] as RequestInit | undefined
    expect(init?.method).toBeUndefined()
  })

  it('returns as-is for remote (non-blob) stems without a HEAD probe', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const s = makeSession({ vocal: 'https://cdn.example/vocal.mp3' })
    const out = await ensureSessionHydrated(s)
    expect(out).toBe(s)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('re-mints dead blob URLs, revokes the dead ones, and heals the store record', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('dead')))
    const revoke = vi.fn()
    vi.stubGlobal('URL', {
      ...URL,
      revokeObjectURL: revoke,
      createObjectURL: URL.createObjectURL,
    })
    mockedHydrate.mockResolvedValue({ vocal: 'blob:fresh' })
    const stale = makeSession({ vocal: 'blob:dead' })
    saveAllUvrSessions([stale])

    const out = await ensureSessionHydrated(stale)
    expect(out.outputs?.vocal).toBe('blob:fresh')
    // The replaced dead URL is revoked so repeated picks don't leak refs.
    expect(revoke).toHaveBeenCalledWith('blob:dead')
  })

  it('re-verifies every call — a store record emptied behind our back still re-mints (regression: stale once-per-page cache)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('dead')))
    mockedHydrate.mockResolvedValue({ vocal: 'blob:fresh-1' })
    const first = await ensureSessionHydrated(
      makeSession({ vocal: 'blob:dead' }),
    )
    expect(first.outputs?.vocal).toBe('blob:fresh-1')

    // The rail remounts and the store record comes back with empty outputs —
    // the old implementation's Set skipped hydration here and the pick died.
    mockedHydrate.mockResolvedValue({ vocal: 'blob:fresh-2' })
    const second = await ensureSessionHydrated(makeSession({}))
    expect(second.outputs?.vocal).toBe('blob:fresh-2')
    expect(mockedHydrate).toHaveBeenCalledTimes(2)
  })

  it('returns the session unchanged when nothing can be re-minted', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('dead')))
    mockedHydrate.mockResolvedValue(null)
    const s = makeSession({})
    const out = await ensureSessionHydrated(s)
    expect(out.outputs?.vocal ?? '').toBe('')
  })
})
