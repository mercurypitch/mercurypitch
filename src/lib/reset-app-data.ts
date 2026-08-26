// ============================================================
// reset-app-data — the Danger Zone's scoped, observable resets
// ============================================================
// The old "Reset All Data" cleared localStorage first and then awaited
// indexedDB.deleteDatabase — which waits, silently and forever, while ANY
// other connection to the database is open. The app itself holds two (the
// main adapter singleton and local-database's second one for Piano Night /
// karaoke reads), so with a stem library loaded the button wiped your
// settings and then hung on a blank promise. This module fixes the order
// (storage last, so a stall leaves a usable app), closes every connection
// the app owns before deleting, reports each step so the UI can show
// progress, and says so when another tab is the thing holding the delete up.
//
// Three scopes, because "delete everything" was the only lever and users
// asked for smaller ones:
//
//   settings   localStorage + sessionStorage, KEEPING the mp:* identity and
//              auth keys. The on-device database rows are owned by that
//              identity — wiping it while keeping the rows would strand every
//              song and melody under an id the fresh visitor no longer has.
//   database   the on-device database (songs, stems, melodies, piano/drum
//              projects, drum take summaries, playlists) and the model cache. Settings and
//              sign-in are kept; pointers to deleted rows (a last-opened
//              session, say) dangle harmlessly — the app already tolerates
//              missing rows, it must for sync.
//   factory    everything above, all of localStorage, the service worker's
//              caches, and the registration itself.
//
// Every scope's caller reloads afterwards: in-memory stores still hold the
// state that was just deleted, and a clean boot is the point of a reset.

import { MERCURY_PITCH_DB_NAME } from '@/db/adapters/dexie-adapter'
import { MODEL_CACHE_DB_NAME } from './model-cache'

export type ResetScope = 'settings' | 'database' | 'factory'

export interface ResetStep {
  id: string
  /** Shown in the progress dialog while the step runs. */
  label: string
}

const CLOSE_STEP: ResetStep = {
  id: 'close',
  label: 'Closing the database…',
}
const DELETE_DB_STEP: ResetStep = {
  id: 'delete-db',
  label: 'Deleting stored songs, stems, projects, takes, and melodies…',
}
const DELETE_MODELS_STEP: ResetStep = {
  id: 'delete-models',
  label: 'Deleting cached models…',
}
const SETTINGS_STEP: ResetStep = {
  id: 'settings',
  label: 'Clearing settings and practice history…',
}
const ALL_STORAGE_STEP: ResetStep = {
  id: 'storage',
  label: 'Clearing settings and sign-in…',
}
const CACHES_STEP: ResetStep = {
  id: 'caches',
  label: 'Clearing cached app files…',
}
const SW_STEP: ResetStep = {
  id: 'sw',
  label: 'Removing the offline worker…',
}

/** The steps each scope runs, in order — exported so the UI can size its bar. */
export const RESET_STEPS: Record<ResetScope, readonly ResetStep[]> = {
  settings: [SETTINGS_STEP],
  database: [CLOSE_STEP, DELETE_DB_STEP, DELETE_MODELS_STEP],
  factory: [
    CLOSE_STEP,
    DELETE_DB_STEP,
    DELETE_MODELS_STEP,
    ALL_STORAGE_STEP,
    CACHES_STEP,
    SW_STEP,
  ],
}

/**
 * Keys the `settings` scope must NOT clear: the device identity and auth
 * token. Every row in the on-device database is owned by this identity;
 * clearing it while keeping the database would orphan the lot under an id
 * the freshly-minted anonymous visitor never gets back.
 */
export const PRESERVED_KEY_PREFIX = 'mp:'

export interface ResetHooks {
  /** Called as each step begins; drive a progress bar with index/total. */
  onStep?: (step: ResetStep, index: number, total: number) => void
  /**
   * Another connection — in practice, another MercuryPitch tab — is holding
   * the database open. The delete finishes on its own once that tab closes;
   * this is the moment to tell the user why nothing seems to be happening.
   */
  onBlocked?: () => void
}

/** Everything the module touches, injectable for tests. */
export interface ResetEnv {
  closeConnections: () => Promise<void>
  deleteIdb: (name: string, onBlocked?: () => void) => Promise<void>
  localStorage: Pick<Storage, 'key' | 'length' | 'removeItem' | 'clear'>
  sessionStorage: Pick<Storage, 'clear'>
  caches?: Pick<CacheStorage, 'keys' | 'delete'>
  swContainer?: Pick<ServiceWorkerContainer, 'getRegistrations'>
}

/** Close every database connection this page holds. */
async function closeOwnConnections(): Promise<void> {
  const [db, localDb, modelCache] = await Promise.all([
    import('@/db'),
    import('@/db/local-database'),
    import('./model-cache'),
  ])
  await db.closeDatabase()
  localDb.closeLocalDatabase()
  modelCache.closeModelCacheDb()
}

/**
 * deleteDatabase as a promise. `blocked` is not an error: the request stays
 * queued and succeeds the moment the last open connection goes away, so it
 * reports and keeps waiting rather than giving up.
 */
function deleteIdbByName(name: string, onBlocked?: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.deleteDatabase(name)
    request.onblocked = () => onBlocked?.()
    request.onsuccess = () => resolve()
    request.onerror = () =>
      reject(request.error ?? new Error(`deleteDatabase(${name}) failed`))
  })
}

function defaultEnv(): ResetEnv {
  return {
    closeConnections: closeOwnConnections,
    deleteIdb: deleteIdbByName,
    localStorage,
    sessionStorage,
    caches: typeof caches === 'undefined' ? undefined : caches,
    swContainer:
      typeof navigator !== 'undefined' && 'serviceWorker' in navigator
        ? navigator.serviceWorker
        : undefined,
  }
}

/** Remove every localStorage key except the preserved identity/auth ones. */
function clearStorageKeepingIdentity(storage: ResetEnv['localStorage']): void {
  const doomed: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key !== null && !key.startsWith(PRESERVED_KEY_PREFIX)) doomed.push(key)
  }
  for (const key of doomed) storage.removeItem(key)
}

async function deleteAllCaches(
  cacheStorage: ResetEnv['caches'],
): Promise<void> {
  if (cacheStorage === undefined) return
  const names = await cacheStorage.keys()
  await Promise.all(names.map((name) => cacheStorage.delete(name)))
}

async function unregisterServiceWorkers(
  container: ResetEnv['swContainer'],
): Promise<void> {
  if (container === undefined) return
  const registrations = await container.getRegistrations()
  await Promise.all(registrations.map((r) => r.unregister()))
}

/**
 * Run one scope's reset, reporting progress. Throws on the first failing
 * step — half-done is reported honestly rather than papered over with a
 * success toast. The caller reloads the page after this resolves.
 */
export async function resetAppData(
  scope: ResetScope,
  hooks: ResetHooks = {},
  envOverrides: Partial<ResetEnv> = {},
): Promise<void> {
  const env: ResetEnv = { ...defaultEnv(), ...envOverrides }
  const steps = RESET_STEPS[scope]
  let index = 0
  const begin = (step: ResetStep): void => {
    hooks.onStep?.(step, index, steps.length)
    index += 1
  }

  for (const step of steps) {
    begin(step)
    switch (step.id) {
      case 'close':
        await env.closeConnections()
        break
      case 'delete-db':
        await env.deleteIdb(MERCURY_PITCH_DB_NAME, hooks.onBlocked)
        break
      case 'delete-models':
        await env.deleteIdb(MODEL_CACHE_DB_NAME, hooks.onBlocked)
        break
      case 'settings':
        clearStorageKeepingIdentity(env.localStorage)
        env.sessionStorage.clear()
        break
      case 'storage':
        env.localStorage.clear()
        env.sessionStorage.clear()
        break
      case 'caches':
        await deleteAllCaches(env.caches)
        break
      case 'sw':
        await unregisterServiceWorkers(env.swContainer)
        break
    }
  }
}
