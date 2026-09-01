/**
 * A backgrounded tab can outlive a deployment. Its already-running entry
 * bundle then asks for an old, hashed lazy chunk that no longer exists.
 * Vite reports that specific boundary through `vite:preloadError`.
 *
 * Reload once so the tab receives the current entry bundle and chunk map.
 * The session-scoped cooldown deliberately lets a second failure surface to
 * the normal error boundary instead of trapping the user in a reload loop.
 *
 * This handler must NOT call `event.preventDefault()`. Vite's helper is
 * `baseModule().catch(handlePreloadError)`, and `handlePreloadError` rethrows
 * only when the event was left un-prevented:
 *
 *   if (!e.defaultPrevented) { throw err }
 *
 * Preventing it therefore makes the import promise RESOLVE, with `undefined`.
 * A reload does not stop JavaScript, so in the ~100ms before the navigation
 * commits, every `lazy(() => import(x).then((m) => ({ default: m.Thing })))`
 * in the app — all 39 of them — dereferences that `undefined` and throws
 * `TypeError: Cannot read properties of undefined`. That message does not
 * match `isStaleBuildError`, so `TabErrorBoundary` classified a routine
 * deployment as an application crash and showed the crash modal, moments
 * before the reload it had already scheduled. Reported on a tablet opening
 * Progress, dev 2026-08-17: crash modal first, update second.
 *
 * Left un-prevented, Vite rethrows the true "Failed to fetch dynamically
 * imported module", `isStaleBuildError` matches it, and the boundary renders
 * `StaleBuildRecovery` — which is the honest thing to show while the new
 * build is fetched.
 */

import { reloadToLatest } from './pwa-service-worker'

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
  // `location.reload()` is answered by the controlling worker from its own
  // precache — the exact trap `reloadToLatest` documents: when the running
  // build's chunks are gone from the origin, a plain reload re-serves the
  // same dead shell and fails identically, forever. The one situation this
  // handler fires in IS that situation.
  const reload =
    options.reload ??
    (() => {
      void reloadToLatest()
    })
  const now = options.now ?? Date.now

  const handlePreloadError: EventListener = () => {
    const timestamp = now()
    const lastReload = readLastReload(storage)
    if (!lastReload.available) return
    if (lastReload.timestamp !== null) {
      const elapsed = timestamp - lastReload.timestamp
      if (elapsed >= 0 && elapsed < CHUNK_RELOAD_COOLDOWN_MS) return
    }

    if (!recordReload(storage, timestamp)) return
    // Said out loud before the navigation, because a page that reloads
    // itself in silence is indistinguishable from a browser that killed the
    // tab — and on iOS both happen. The relay flushes on `pagehide`, so this
    // line is the last one of the dying load and names the cause.
    console.warn(
      '[chunk-recovery] a lazy chunk failed to load; reloading to the current build',
    )
    reload()
  }

  target.addEventListener('vite:preloadError', handlePreloadError)
  return () => {
    target.removeEventListener('vite:preloadError', handlePreloadError)
  }
}
