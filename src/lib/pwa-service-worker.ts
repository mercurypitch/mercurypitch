// ============================================================
// pwa-service-worker — register src/sw.ts and route its updates to the user
// ============================================================
// The worker (src/sw.ts) serves the app from a precache, one build at a time.
// That makes this module the only way a visitor moves to a newer build, so the
// prompt it raises has to mean something: it appears when the page really is
// running code the origin has replaced, and not otherwise.
//
// Three things feed it.
//
//   a waiting worker   the normal case — a deploy landed, the new worker
//                      installed, and it is holding until the page agrees.
//   its build id       asked over a MessageChannel before prompting. A worker
//                      built from the commit the page is already running has
//                      nothing to announce, so it is adopted silently.
//   a stale-build      posted by the worker when a request proves the origin
//   notice             no longer serves this build. Worth an update check
//                      immediately rather than at the next 15-minute one.
//
// Nothing here reloads on its own. The worker refuses to skipWaiting, this
// module hands the decision to the caller, and only an accepted prompt triggers
// the single reload that swaps both halves at once.

import { COMMIT_SHA } from './defaults'
import { BUILD_ID_MESSAGE, SKIP_WAITING_MESSAGE, STALE_BUILD_MESSAGE, UNKNOWN_BUILD_ID, } from './sw-runtime'

/** Where vite-plugin-pwa emits the built worker (dist/sw.js, root scope). */
const SERVICE_WORKER_URL = '/sw.js'

/**
 * A tab left open for days would otherwise never notice a deploy. Re-checking
 * whenever it comes back to the foreground is enough, throttled so that
 * flicking between tabs does not hammer the origin.
 */
const UPDATE_CHECK_INTERVAL_MS = 15 * 60_000

/**
 * A failed chunk is direct evidence that the origin moved on, so it earns a
 * check far sooner than the foreground poll — but still throttled, because one
 * broken deploy can produce a burst of them.
 */
const STALE_BUILD_CHECK_INTERVAL_MS = 10_000

/** How long the waiting worker gets to answer before it is treated as unknown. */
const BUILD_ID_TIMEOUT_MS = 2_000

/**
 * How long `reloadToLatest` waits for an adopted worker to take control before
 * giving up on the graceful path and unregistering instead. Generous — the
 * swap is normally near-instant — but bounded, because the whole point of that
 * function is that it always ends in a reload.
 */
const CONTROLLER_CHANGE_TIMEOUT_MS = 4_000

export interface RegisterServiceWorkerOptions {
  /**
   * Called when a new worker is installed, waiting, and built from a different
   * commit than this page. `applyUpdate` adopts it and reloads once. Not called
   * for a first-ever install — there is no previous version to replace — nor
   * when the waiting worker carries the build the page is already running.
   */
  onUpdateReady?: (applyUpdate: () => void) => void
  /** Test seam: defaults to `__SW_ENABLED__` (false only under `vite dev`). */
  enabled?: boolean
  /** Test seam: defaults to the commit this bundle was built from. */
  buildId?: string
  /** Test seam: defaults to `navigator.serviceWorker`. */
  container?: ServiceWorkerContainer
  /** Test seam: defaults to a full page reload. */
  reload?: () => void
}

/** True once *this* tab's user has accepted an update. */
let updateAccepted = false
let reloading = false
/** Set once registration resolves, so a page-side failure can ask for a check. */
let activeRegistration: ServiceWorkerRegistration | null = null
/** Seeded at registration: the poll is a heartbeat, not a reaction. */
let lastForegroundCheck = 0
/** Left at zero: the first piece of evidence must never be throttled away. */
let lastStaleCheck = 0

function messageType(data: unknown): unknown {
  return typeof data === 'object' && data !== null
    ? (data as { type?: unknown }).type
    : undefined
}

/**
 * Ask a worker which commit it was built from. Resolves to null if it does not
 * answer — an older worker with no handler for this message, or one busy enough
 * to miss the window — and the caller then treats it as a real update, which is
 * the safe direction to be wrong in.
 */
async function askBuildId(worker: ServiceWorker): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    const channel = new MessageChannel()
    // Safe to run twice — resolving a promise a second time is a no-op, and
    // closing an already-closed port is too — so no "settled" bookkeeping.
    const finish = (value: string | null): void => {
      clearTimeout(timer)
      channel.port1.close()
      resolve(value)
    }
    const timer = setTimeout(() => {
      finish(null)
    }, BUILD_ID_TIMEOUT_MS)
    channel.port1.onmessage = (event: MessageEvent) => {
      const data: unknown = event.data
      const id =
        typeof data === 'object' && data !== null
          ? (data as { buildId?: unknown }).buildId
          : undefined
      finish(typeof id === 'string' ? id : null)
    }
    try {
      worker.postMessage({ type: BUILD_ID_MESSAGE }, [channel.port2])
    } catch {
      // A worker that went redundant between the check and the post.
      finish(null)
    }
  })
}

/**
 * `foreground` is the periodic poll for a tab that has been open a while.
 * `stale` is a request that already failed, which is evidence rather than a
 * guess: it is checked immediately and throttled only against a burst from one
 * broken deploy.
 */
function checkForUpdate(kind: 'foreground' | 'stale'): void {
  const registration = activeRegistration
  if (registration === null) return
  const now = Date.now()
  if (kind === 'foreground') {
    if (now - lastForegroundCheck < UPDATE_CHECK_INTERVAL_MS) return
  } else if (now - lastStaleCheck < STALE_BUILD_CHECK_INTERVAL_MS) {
    return
  } else {
    lastStaleCheck = now
  }
  // Either way the origin has just been asked, so the poll can wait.
  lastForegroundCheck = now
  void registration.update().catch(() => undefined)
}

/**
 * Ask the browser to look for a new worker now. Called by
 * src/lib/global-error-handler.ts when a failure has the shape of a build that
 * is no longer deployed, so the reload prompt appears while the user is still
 * looking at the thing that failed. A no-op with no worker registered.
 */
export function requestUpdateCheck(): void {
  checkForUpdate('stale')
}

export interface ReloadToLatestOptions {
  /** Test seam: defaults to `navigator.serviceWorker`. */
  container?: ServiceWorkerContainer
  /** Test seam: defaults to a full page reload. */
  reload?: () => void
}

/**
 * Reload in a way that is guaranteed to land on the newest build the origin
 * serves — unlike `location.reload()`, which the controlling worker answers
 * from its own precache. That difference is the trap this function exists for:
 * when the running build's chunks are gone from the origin (a deploy landed,
 * or a stale waiting worker was adopted), a plain reload re-serves the same
 * dead shell and the app crashes identically, forever. Seen on dev 2026-08-16.
 *
 * The escape ladder:
 *   1. a waiting worker exists — adopt it (SKIP_WAITING) and reload when it
 *      takes control; that is the newest build already downloaded.
 *   2. no waiting worker, and the network is reachable — unregister, then
 *      reload: an unregistered worker does not claim the next navigation, so
 *      the shell comes from the origin and the current build reinstalls clean.
 *   3. offline, or no worker at all — plain reload; the cache is all there is.
 *
 * Rung 1 falls through to rung 2 if the adopted worker never takes control.
 * Every path ends in exactly one reload, shared with the update flow's guard.
 */
export async function reloadToLatest(
  options: ReloadToLatestOptions = {},
): Promise<void> {
  if (reloading) return
  const reload =
    options.reload ??
    (() => {
      window.location.reload()
    })
  const doReload = (rung: string): void => {
    if (reloading) return
    reloading = true
    // Which rung of the ladder took the page away. Same reason as
    // chunk-load-recovery's line: a silent self-reload cannot be told apart
    // from an iOS content process being killed, and the two need different
    // fixes.
    console.warn(`[sw-reload] ${rung}`)
    reload()
  }
  // Unlike registerServiceWorker this only ever runs inside a page — from a
  // recovery screen or the crash modal — so `navigator` itself always exists.
  const container =
    options.container ??
    ('serviceWorker' in navigator ? navigator.serviceWorker : undefined)
  if (container === undefined) {
    doReload('no service worker support — plain reload')
    return
  }

  let registration: ServiceWorkerRegistration | undefined
  try {
    registration = await container.getRegistration()
  } catch {
    registration = undefined
  }
  if (registration === undefined) {
    doReload('no worker registered — plain reload')
    return
  }
  const finalRegistration = registration

  const unregisterAndReload = async (): Promise<void> => {
    if (navigator.onLine !== false) {
      // Offline, the worker's cache is the only copy of the app — deleting the
      // registration would trade a broken build for no build at all.
      try {
        await finalRegistration.unregister()
      } catch {
        // The reload still happens; it just may hit the cache again.
      }
    }
    doReload('unregistered the worker, reloading from the origin')
  }

  const waiting = finalRegistration.waiting
  if (waiting === null) {
    await unregisterAndReload()
    return
  }

  // Same contract as applyUpdate: this tab has decided to move, so the
  // update-flow's own controllerchange listener may reload too — harmless,
  // both share the `reloading` guard.
  updateAccepted = true
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      void unregisterAndReload().then(resolve)
    }, CONTROLLER_CHANGE_TIMEOUT_MS)
    container.addEventListener(
      'controllerchange',
      () => {
        clearTimeout(timer)
        doReload('adopted the waiting worker, reloading into it')
        resolve()
      },
      { once: true },
    )
    waiting.postMessage({ type: SKIP_WAITING_MESSAGE })
  })
}

function watchForUpdate(
  registration: ServiceWorkerRegistration,
  container: ServiceWorkerContainer,
  buildId: string,
  onUpdateReady: (applyUpdate: () => void) => void,
  reload: () => void,
): void {
  const reloadOnce = (): void => {
    if (reloading) return
    reloading = true
    reload()
  }

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

  container.addEventListener('controllerchange', () => {
    // Only the tab whose user accepted reloads. Another tab's decision must
    // not throw away what is happening in this one — a half-finished take, an
    // in-flight separation — so an unasked-for controller change is left to be
    // picked up on the next navigation.
    if (updateAccepted) reloadOnce()
  })

  let announcedFor: ServiceWorker | null = null

  const announce = (): void => {
    // Once this tab has accepted an update it is on its way to a reload; a
    // second prompt racing the swap is noise (and was seen on dev popping over
    // the reload it was about to interrupt). The fresh page re-announces if
    // there really is a newer build.
    if (updateAccepted || reloading) return
    // With no controller this is the first install on this origin: the page is
    // already running the only version there is.
    if (container.controller === null) return
    const waiting = registration.waiting
    if (waiting === null) {
      onUpdateReady(applyUpdate)
      return
    }
    if (announcedFor === waiting) return
    announcedFor = waiting

    void askBuildId(waiting).then((waitingBuild) => {
      if (
        waitingBuild !== null &&
        waitingBuild !== UNKNOWN_BUILD_ID &&
        waitingBuild === buildId
      ) {
        // Same commit as the page is running. Adopting it cannot change
        // anything the user would see, and it replaces a prompt that would
        // reload to an identical app — the complaint this handshake exists
        // for. No reload follows: `updateAccepted` is still false.
        waiting.postMessage({ type: SKIP_WAITING_MESSAGE })
        return
      }
      onUpdateReady(applyUpdate)
    })
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
  const enabled =
    options.enabled ?? (typeof __SW_ENABLED__ !== 'undefined' && __SW_ENABLED__)
  if (!enabled) return
  const container =
    options.container ??
    (typeof navigator !== 'undefined' && 'serviceWorker' in navigator
      ? navigator.serviceWorker
      : undefined)
  if (container === undefined) return

  const buildId = options.buildId ?? COMMIT_SHA
  const reload =
    options.reload ??
    (() => {
      window.location.reload()
    })

  // Registering after `load` keeps the worker's install fetches off the
  // critical path of the first paint it is trying to make faster.
  const register = (): void => {
    void container
      .register(SERVICE_WORKER_URL, {
        scope: '/',
        // Always revalidate the worker script itself. Without this a cached
        // sw.js can keep a client on an old worker for its max-age.
        updateViaCache: 'none',
      })
      .then((registration) => {
        activeRegistration = registration
        lastForegroundCheck = Date.now()

        const { onUpdateReady } = options
        if (onUpdateReady !== undefined) {
          watchForUpdate(
            registration,
            container,
            buildId,
            onUpdateReady,
            reload,
          )
        }

        // The worker only sends this when it has proof: a request for build
        // output that the origin answered with the SPA fallback, or not at all.
        container.addEventListener('message', (event: MessageEvent) => {
          if (messageType(event.data) !== STALE_BUILD_MESSAGE) return
          checkForUpdate('stale')
        })

        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState !== 'visible') return
          checkForUpdate('foreground')
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
