// ============================================================
// pwa-service-worker — register src/sw.ts and route its updates to the user
// ============================================================
// The worker (src/sw.ts) is what makes the app installable, and its cache is
// the second cache in front of the stale-chunk failure that
// src/lib/chunk-load-recovery.ts exists for. That makes the update path a
// correctness concern, not a nicety: a page must never keep running against a
// worker from a newer deploy than its own HTML.
//
// So nothing here reloads on its own. The worker refuses to skipWaiting, this
// module notices the waiting worker and hands the decision to the caller, and
// only an accepted prompt triggers the single reload that swaps both halves at
// once.

/** Must match the constant of the same purpose in src/sw.ts. */
const SKIP_WAITING_MESSAGE = 'mercurypitch:skip-waiting'

/** Where vite-plugin-pwa emits the built worker (dist/sw.js, root scope). */
const SERVICE_WORKER_URL = '/sw.js'

/**
 * A tab left open for days would otherwise never notice a deploy. Re-checking
 * whenever it comes back to the foreground is enough, throttled so that
 * flicking between tabs does not hammer the origin.
 */
const UPDATE_CHECK_INTERVAL_MS = 15 * 60_000

export interface RegisterServiceWorkerOptions {
  /**
   * Called when a new worker is installed and waiting. `applyUpdate` adopts it
   * and reloads once. Not called for a first-ever install — there is no
   * previous version to replace, so there is nothing to ask about.
   */
  onUpdateReady?: (applyUpdate: () => void) => void
}

/** True once *this* tab's user has accepted an update. */
let updateAccepted = false
let reloading = false

function reloadOnce(): void {
  if (reloading) return
  reloading = true
  window.location.reload()
}

function watchForUpdate(
  registration: ServiceWorkerRegistration,
  onUpdateReady: (applyUpdate: () => void) => void,
): void {
  const applyUpdate = (): void => {
    updateAccepted = true
    const waiting = registration.waiting
    if (waiting === null) {
      // The worker went away between the prompt and the click (another tab
      // took the update). A plain reload lands on the new one anyway.
      reloadOnce()
      return
    }
    // `controllerchange` fires once the worker that skipped waiting takes
    // over, which is the earliest moment a reload is guaranteed to get the
    // matching HTML and chunk map together.
    waiting.postMessage({ type: SKIP_WAITING_MESSAGE })
  }

  const announce = (): void => {
    // With no controller this is the first install on this origin: the page is
    // already running the only version there is.
    if (navigator.serviceWorker.controller === null) return
    onUpdateReady(applyUpdate)
  }

  if (registration.waiting !== null) announce()

  registration.addEventListener('updatefound', () => {
    const installing = registration.installing
    if (installing === null) return
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed') announce()
    })
  })
}

/**
 * Register the worker. Safe to call more than once per page — the browser
 * de-duplicates registrations for the same script URL and scope.
 *
 * `__SW_ENABLED__` is false under `vite dev`, where dist/sw.js does not exist;
 * it is true for every build, so the worker ships to the dev deploy as well as
 * production and can be exercised somewhere other than prod.
 */
export function registerServiceWorker(
  options: RegisterServiceWorkerOptions = {},
): void {
  if (!__SW_ENABLED__) return
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Only the tab whose user accepted reloads. Another tab's decision must
    // not throw away what is happening in this one — a half-finished take, an
    // in-flight separation — so an unasked-for controller change is left to be
    // picked up on the next navigation.
    if (updateAccepted) reloadOnce()
  })

  // Registering after `load` keeps the worker's install fetches off the
  // critical path of the first paint it is trying to make faster.
  const register = (): void => {
    void navigator.serviceWorker
      .register(SERVICE_WORKER_URL, {
        scope: '/',
        // Always revalidate the worker script itself. Without this a cached
        // sw.js can keep a client on an old worker for its max-age.
        updateViaCache: 'none',
      })
      .then((registration) => {
        const { onUpdateReady } = options
        if (onUpdateReady !== undefined) {
          watchForUpdate(registration, onUpdateReady)
        }

        let lastCheck = Date.now()
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState !== 'visible') return
          if (Date.now() - lastCheck < UPDATE_CHECK_INTERVAL_MS) return
          lastCheck = Date.now()
          void registration.update().catch(() => undefined)
        })
      })
      .catch((error: unknown) => {
        // A failed registration must never take the app down with it; the site
        // works fine uninstalled.
        console.warn('pwa-service-worker: registration failed', error)
      })
  }

  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}
