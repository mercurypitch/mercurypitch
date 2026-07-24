/**
 * A backgrounded tab can outlive a deployment. Its already-running entry
 * bundle then asks for an old, hashed lazy chunk that no longer exists.
 * Vite reports that specific boundary through `vite:preloadError`.
 *
 * Reload once so the tab receives the current entry bundle and chunk map.
 * The session-scoped cooldown deliberately lets a second failure surface to
 * the normal error boundary instead of trapping the user in a reload loop.
 */

export const CHUNK_RELOAD_STORAGE_KEY = 'mercurypitch:chunk-reload-at'
export const CHUNK_RELOAD_COOLDOWN_MS = 60_000

type RecoveryTarget = Pick<
  EventTarget,
  'addEventListener' | 'removeEventListener'
>
type RecoveryStorage = Pick<Storage, 'getItem' | 'setItem'>

interface ChunkLoadRecoveryOptions {
  target?: RecoveryTarget
  storage?: RecoveryStorage
  reload?: () => void
  now?: () => number
}

function readLastReload(storage: RecoveryStorage | undefined): {
  available: boolean
  timestamp: number | null
} {
  if (storage === undefined) return { available: false, timestamp: null }
  try {
    const stored = storage.getItem(CHUNK_RELOAD_STORAGE_KEY)
    if (stored === null) return { available: true, timestamp: null }
    const parsed = Number(stored)
    return {
      available: true,
      timestamp: Number.isFinite(parsed) ? parsed : null,
    }
  } catch {
    return { available: false, timestamp: null }
  }
}

function recordReload(
  storage: RecoveryStorage | undefined,
  timestamp: number,
): boolean {
  if (storage === undefined) return false
  try {
    storage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(timestamp))
    return true
  } catch {
    // Without a persistent guard, reloading a permanently broken deployment
    // could loop forever. Let the normal error boundary take over instead.
    return false
  }
}

export function installChunkLoadRecovery(
  options: ChunkLoadRecoveryOptions = {},
): () => void {
  const browserWindow = typeof window === 'undefined' ? undefined : window
  const target = options.target ?? browserWindow
  if (target === undefined) return () => undefined

  const storage =
    options.storage ??
    (() => {
      try {
        return browserWindow?.sessionStorage
      } catch {
        return undefined
      }
    })()
  const reload =
    options.reload ??
    (() => {
      browserWindow?.location.reload()
    })
  const now = options.now ?? Date.now

  const handlePreloadError: EventListener = (event) => {
    const timestamp = now()
    const lastReload = readLastReload(storage)
    if (!lastReload.available) return
    if (lastReload.timestamp !== null) {
      const elapsed = timestamp - lastReload.timestamp
      if (elapsed >= 0 && elapsed < CHUNK_RELOAD_COOLDOWN_MS) return
    }

    if (!recordReload(storage, timestamp)) return
    event.preventDefault()
    reload()
  }

  target.addEventListener('vite:preloadError', handlePreloadError)
  return () => {
    target.removeEventListener('vite:preloadError', handlePreloadError)
  }
}
