// ============================================================
// Storage port — where this device's identity actually lives
// ============================================================
//
// Three keys decide who this device is: `mp:userId`, `mp:deviceSecret` and
// `mp:authToken`. On the web they have always lived in `localStorage`, and on
// the web that is fine. On a phone it is not.
//
// **Mobile operating systems clear a WebView's `localStorage`.** Capacitor's
// own storage documentation says so outright, and it is why `@capacitor/
// preferences` exists at all. Losing these three keys does not sign anybody
// out politely — it ORPHANS THE ACCOUNT, permanently: the device mints a
// fresh UUID and a fresh secret, while the server row it used to own still
// carries the old `deviceSecretHash` that nothing will ever be able to
// present again. There is no recovery path for an anonymous account after
// that, and for an upgraded one the device silently becomes a stranger.
//
// So the identity keys move behind a port. The interface is deliberately
// async, because every native key-value store is: `Preferences.get()` crosses
// the bridge. Everything above it, though, is synchronous — `getUserId()` is
// called from render paths and from module scope — so the port is read ONCE
// at boot into a cache and every existing synchronous reader keeps working.
//
// Two backends, and the difference between them is the whole design:
//
//   web     `localStorage` itself. There is nothing to hydrate: the browser's
//           store IS a synchronous cache, so reads go straight to it and a
//           failed write is observable in the same tick (which is what
//           `getDeviceSecret` needs — see below). Hydration is a no-op.
//
//   native  installed by `apps/mercurypitch/src/main.tsx` over
//           `@capacitor/preferences`, then `hydrateStoragePort()` is awaited
//           BEFORE the first render. After that the cache answers every read.
//           Writes go to the cache immediately and to the port on a queue.
//
// On the first native run the port is empty while `localStorage` may still
// hold a perfectly good identity from a previous build. Hydration copies it
// across — copies, never moves: a half-migrated device that fails mid-write
// must still be able to fall back, and the WebView will clear the old copy
// on its own schedule anyway.
//
// `storageDurable()` is not decoration. `getDeviceSecret()` returns `''`
// rather than an unpersistable secret, because a secret that differs on the
// next launch is worse than none: the worker still admits an account that
// never bound one, but it will refuse to rebind a changed one.
//
// ── The window between install and hydrate ──
//
// `installStoragePort()` drops the synchronous web fast path, and nothing can
// be answered until `hydrateStoragePort()` has read the port. Answering
// `null` in that window LOOKS harmless and is the exact failure the port
// exists to prevent: `getUserId()` reads null, decides the device is new,
// mints a fresh UUID — and the write that follows queues it over a perfectly
// good durable identity, orphaning the account this whole file is about.
//
// So the window throws instead. `readStored`, `writeStored` and
// `removeStored` all raise `storage port not hydrated`: a boot-order mistake
// fails in a test, or on the first launch of a debug build, rather than
// silently costing somebody their account on a phone. `storageDurable()`
// answers false there for the same reason, so the one caller that asks before
// it mints (`getDeviceSecret`) gets a correct no rather than an exception.
//
// The web is untouched by all of this. Its backend is synchronous and always
// installed, so it is never in the window at all.

/** The identity store, as anything above it sees it. */
export interface StoragePort {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

export const USER_ID_KEY = 'mp:userId'
export const DEVICE_SECRET_KEY = 'mp:deviceSecret'
export const AUTH_TOKEN_KEY = 'mp:authToken'

/**
 * Every key the port owns, and the list hydration reads at boot.
 *
 * Adding a key here is the whole cost of putting it behind the port — but
 * only add one that must survive a WebView clearing its site data. This is
 * not a settings store; `createPersistedSignal` remains the right home for a
 * preference, which is re-derivable and whose loss costs nobody an account.
 */
export const PORTED_KEYS: readonly string[] = [
  USER_ID_KEY,
  DEVICE_SECRET_KEY,
  AUTH_TOKEN_KEY,
]

/**
 * The synchronous half of the built-in web backend.
 *
 * Kept as its own shape rather than folded into `StoragePort` because it can
 * answer a question the async interface cannot: *did that write stick, now?*
 * `localStorage.setItem` throws in the same tick when site data is blocked or
 * the quota is full, and the device-secret path has to know.
 */
interface SyncBackend {
  get(key: string): string | null
  set(key: string, value: string): boolean
  remove(key: string): boolean
}

const localStorageBackend: SyncBackend = {
  get(key) {
    return localStorage.getItem(key)
  },
  set(key, value) {
    localStorage.setItem(key, value)
    return true
  },
  remove(key) {
    localStorage.removeItem(key)
    return true
  },
}

const localStoragePort: StoragePort = {
  // Async by signature, synchronous by body: everything up to the implicit
  // return runs before the promise is handed back, so a web write really has
  // landed by the time `writeStored` returns. Several tests read
  // `localStorage` directly on the next line and depend on exactly that.
  get: async (key) => localStorage.getItem(key),
  set: async (key, value) => {
    localStorage.setItem(key, value)
  },
  remove: async (key) => {
    localStorage.removeItem(key)
  },
}

let port: StoragePort = localStoragePort
/** Non-null only while the built-in web backend is the one installed. */
let syncBackend: SyncBackend | null = localStorageBackend
/** Set when a boot gave up on the installed port; a late hydration must not undo that. */
let abandoned = false
/** Non-null once an installed async port has been hydrated. */
let cache: Map<string, string> | null = null
let readable = true
let writable = true
let queue: Promise<void> = Promise.resolve()

/**
 * True in the window between `installStoragePort()` and the hydration that
 * follows it: a port is installed, and nothing has been read out of it yet.
 * Only a native boot is ever here, and only for one await.
 */
function unhydrated(): boolean {
  return cache === null && syncBackend === null
}

/** What that window answers with, rather than a plausible `null`. */
function notHydrated(): Error {
  return new Error('storage port not hydrated')
}

/** Every port write, in order, with its failure already handled — a
 *  fire-and-forget tail that outlives its caller is how an unhandled
 *  rejection fails an otherwise green test run. */
function enqueue(work: () => Promise<void>): void {
  queue = queue.then(work).then(
    () => {
      writable = true
    },
    (error: unknown) => {
      writable = false
      console.warn('[storage-port] write failed', error)
    },
  )
}

/**
 * Put a platform store behind the identity keys.
 *
 * Call before `hydrateStoragePort()` and before anything reads an identity —
 * in practice, the first statement of the native entry point. Installing a
 * port drops the synchronous web fast path, and until hydration finishes
 * every read and write THROWS rather than answering from the store the port
 * replaced: a stale answer is how one device ends up wearing another's id,
 * and a plausible `null` is how it mints a third over the top of both.
 */
export function installStoragePort(next: StoragePort): void {
  port = next
  syncBackend = null
  cache = null
  abandoned = false
}

/**
 * Give up on the installed port for this launch and answer from
 * `localStorage` instead.
 *
 * For the boot sequence only, when hydration rejected or missed its
 * deadline: the alternative is an app whose every identity read throws,
 * which is a blank screen (TestFlight build 29, 11 Sep 2026). Identity kept
 * in `localStorage` is not durable, but it is the same store the web app has
 * always used and the next launch tries the port again. A hydration that
 * settles after this call is ignored, so the state cannot flip under a
 * running app. No-op once hydrated, and on the web.
 */
export function abandonStoragePort(reason: unknown): void {
  if (!unhydrated()) return
  abandoned = true
  port = localStoragePort
  syncBackend = localStorageBackend
  cache = null
  console.warn(
    '[storage-port] port abandoned for this launch; identity is read from localStorage',
    reason,
  )
}

/**
 * Read the port into the synchronous cache, once, at boot.
 *
 * On the web this is free and returns an already-resolved promise. On native
 * it must be awaited before the first render — every synchronous reader below
 * answers `null` until it has been.
 *
 * Migration happens here: a key the port does not hold yet, but which
 * `localStorage` still does, is copied across. This is the upgrade path for a
 * device that ran an earlier build, and it must run before anything can
 * decide the device is new and mint a replacement identity.
 */
export async function hydrateStoragePort(): Promise<void> {
  if (syncBackend !== null) return

  const next = new Map<string, string>()
  for (const key of PORTED_KEYS) {
    let value: string | null = null
    try {
      value = await port.get(key)
      readable = true
    } catch (error) {
      readable = false
      console.warn('[storage-port] read failed', key, error)
    }
    if (value === null || value === '') {
      const carried = readLocalStorageDirectly(key)
      if (carried !== null && carried !== '') {
        value = carried
        try {
          await port.set(key, carried)
          writable = true
        } catch (error) {
          writable = false
          console.warn('[storage-port] migration write failed', key, error)
        }
      }
    }
    if (value !== null && value !== '') next.set(key, value)
  }
  // A boot that already gave up (`abandonStoragePort`) is running on
  // localStorage; a hydration landing now would swap the store under it.
  if (abandoned) return
  cache = next
}

/** The pre-port copy, for the migration only. Never the answer to a read. */
function readLocalStorageDirectly(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * The stored value, synchronously. `null` when absent OR unreadable.
 *
 * Throws in the install-to-hydrate window — see the header. That is a
 * boot-order bug in the caller, and the alternative answer is `null`, which
 * reads as "new device" and mints over a durable identity.
 */
export function readStored(key: string): string | null {
  if (cache !== null) return cache.get(key) ?? null
  if (syncBackend === null) throw notHydrated()
  try {
    const value = syncBackend.get(key)
    readable = true
    return value
  } catch {
    readable = false
    return null
  }
}

/**
 * Store a value. Returns whether it is believed to have been persisted.
 *
 * On the web the answer is exact. Behind an installed port it is the state of
 * the last completed write — a queued write that has not run yet cannot be
 * reported on, and pretending otherwise would be worse than the optimism.
 *
 * Throws in the install-to-hydrate window: a write there bypasses the cache
 * that does not exist yet and races the hydration read, so the value that
 * survives is whichever landed last.
 */
export function writeStored(key: string, value: string): boolean {
  if (unhydrated()) throw notHydrated()
  cache?.set(key, value)
  if (syncBackend !== null) {
    try {
      syncBackend.set(key, value)
      writable = true
      return true
    } catch {
      writable = false
      return false
    }
  }
  enqueue(() => port.set(key, value))
  return writable
}

/**
 * Forget a value. Returns whether the removal is believed to have landed.
 *
 * Throws in the window for the same reason a write does, and it matters more
 * here: a removal that races hydration deletes a key hydration is about to
 * read back, and the factory reset is exactly the caller that would do it.
 */
export function removeStored(key: string): boolean {
  if (unhydrated()) throw notHydrated()
  cache?.delete(key)
  if (syncBackend !== null) {
    try {
      syncBackend.remove(key)
      writable = true
      return true
    } catch {
      writable = false
      return false
    }
  }
  enqueue(() => port.remove(key))
  return writable
}

/**
 * Can this device keep an identity at all?
 *
 * False in a private window with site data blocked, and false once a write
 * has been refused. A caller that is about to MINT something — an id, a
 * credential — must ask first: minting into a store that forgets is how a
 * device ends up presenting a different secret on every launch.
 *
 * False in the install-to-hydrate window too, so that the asking is safe
 * there rather than the one call in the mint path that throws.
 */
export function storageDurable(): boolean {
  if (unhydrated()) return false
  return readable && writable
}

/** Every queued port write, settled. For tests and for the developer screen. */
export function flushStoragePort(): Promise<void> {
  return queue
}

/**
 * What the port holds right now, for the native developer screen.
 *
 * Values are the caller's to mask — this returns them whole, because the one
 * consumer needs to compare a prefix and a suffix against the server.
 */
export function storagePortSnapshot(): Record<string, string | null> {
  const snapshot: Record<string, string | null> = {}
  for (const key of PORTED_KEYS) snapshot[key] = readStored(key)
  return snapshot
}

/** Test seam: back to the built-in web backend with nothing remembered. */
export function resetStoragePort(): void {
  abandoned = false
  port = localStoragePort
  syncBackend = localStorageBackend
  cache = null
  readable = true
  writable = true
  queue = Promise.resolve()
}
