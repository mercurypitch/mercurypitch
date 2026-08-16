import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestUpdateCheck } from '@/lib/pwa-service-worker'
import { STALE_RELOAD_STAMP_KEY, StaleBuildRecovery, } from '../StaleBuildRecovery'

vi.mock('@/lib/pwa-service-worker', () => ({
  reloadToLatest: vi.fn(async () => Promise.resolve()),
  requestUpdateCheck: vi.fn(),
}))

/** A Storage stand-in holding at most the recovery stamp. */
function fakeStorage(stamp?: number): Storage {
  const store = new Map<string, string>()
  if (stamp !== undefined) store.set(STALE_RELOAD_STAMP_KEY, String(stamp))
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size
    },
  } as Storage
}

const NOW = 1_755_000_000_000

describe('StaleBuildRecovery', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('reloads on its own the first time, and says it is updating', () => {
    const reload = vi.fn(async () => Promise.resolve())
    const storage = fakeStorage()

    const { getByText, queryByText } = render(() => (
      <StaleBuildRecovery reload={reload} storage={storage} now={() => NOW} />
    ))

    expect(reload).toHaveBeenCalledTimes(1)
    expect(getByText(/updating to the latest version/i)).toBeDefined()
    expect(queryByText('Reload now')).toBeNull()
    // The stamp is what stops a second stale crash from looping.
    expect(storage.getItem(STALE_RELOAD_STAMP_KEY)).toBe(String(NOW))
    // The prompt flow is asked in parallel — a second rescue path.
    expect(requestUpdateCheck).toHaveBeenCalledTimes(1)
  })

  it('asks instead of looping when the last attempt was moments ago', () => {
    const reload = vi.fn(async () => Promise.resolve())
    const storage = fakeStorage(NOW - 5_000)

    const { getByText } = render(() => (
      <StaleBuildRecovery reload={reload} storage={storage} now={() => NOW} />
    ))

    // No automatic reload: it just failed to fix this.
    expect(reload).not.toHaveBeenCalled()

    fireEvent.click(getByText('Reload now'))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('reloads automatically again once the cooldown has passed', () => {
    const reload = vi.fn(async () => Promise.resolve())
    const storage = fakeStorage(NOW - 10 * 60_000)

    render(() => (
      <StaleBuildRecovery reload={reload} storage={storage} now={() => NOW} />
    ))

    expect(reload).toHaveBeenCalledTimes(1)
    expect(storage.getItem(STALE_RELOAD_STAMP_KEY)).toBe(String(NOW))
  })

  it('treats denied storage as a first attempt', () => {
    const reload = vi.fn(async () => Promise.resolve())
    const storage = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
    } as unknown as Storage

    render(() => (
      <StaleBuildRecovery reload={reload} storage={storage} now={() => NOW} />
    ))

    expect(reload).toHaveBeenCalledTimes(1)
  })
})
