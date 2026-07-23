import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ showNotification: vi.fn() }))
vi.mock('@/stores/notifications-store', () => ({
  showNotification: mocks.showNotification,
}))

interface StorageApi {
  persist: ReturnType<typeof vi.fn>
  persisted?: ReturnType<typeof vi.fn>
}

function stubStorageApi(storage: StorageApi): void {
  vi.stubGlobal('navigator', { storage })
}

async function loadSubject() {
  return import('@/db/persistent-storage')
}

describe('ensurePersistentStorage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.resetModules()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('returns false when the persistence API is unavailable', async () => {
    vi.stubGlobal('navigator', {})
    const { ensurePersistentStorage } = await loadSubject()

    await expect(ensurePersistentStorage()).resolves.toBe(false)
    expect(mocks.showNotification).not.toHaveBeenCalled()
  })

  it('does nothing when storage is already persistent', async () => {
    const storage = {
      persist: vi.fn(),
      persisted: vi.fn().mockResolvedValue(true),
    }
    stubStorageApi(storage)
    const { ensurePersistentStorage } = await loadSubject()

    await expect(ensurePersistentStorage()).resolves.toBe(true)
    expect(storage.persist).not.toHaveBeenCalled()
    expect(mocks.showNotification).not.toHaveBeenCalled()
  })

  it('explains and performs the request only once after a denial', async () => {
    const storage = {
      persist: vi.fn().mockResolvedValue(false),
      persisted: vi.fn().mockResolvedValue(false),
    }
    stubStorageApi(storage)
    const { ensurePersistentStorage } = await loadSubject()

    await expect(ensurePersistentStorage()).resolves.toBe(false)
    await expect(ensurePersistentStorage()).resolves.toBe(false)

    expect(storage.persist).toHaveBeenCalledTimes(1)
    expect(mocks.showNotification).toHaveBeenCalledTimes(1)
    expect(mocks.showNotification).toHaveBeenCalledWith(
      expect.stringContaining('Stems saved!'),
      'info',
      { durationMs: 12000 },
    )
  })

  it('still requests persistence when localStorage access is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })
    const storage = {
      persist: vi.fn().mockResolvedValue(true),
      persisted: vi.fn().mockRejectedValue(new Error('query failed')),
    }
    stubStorageApi(storage)
    const { ensurePersistentStorage } = await loadSubject()

    await expect(ensurePersistentStorage()).resolves.toBe(true)
    expect(storage.persist).toHaveBeenCalledTimes(1)
  })

  it('keeps browser request failures non-fatal', async () => {
    const storage = {
      persist: vi.fn().mockRejectedValue(new Error('permission error')),
      persisted: vi.fn().mockResolvedValue(false),
    }
    stubStorageApi(storage)
    const { ensurePersistentStorage } = await loadSubject()

    await expect(ensurePersistentStorage()).resolves.toBe(false)
  })
})
