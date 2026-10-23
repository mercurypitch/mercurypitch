// ============================================================
// Settings Sync Service — cloud-preserved user settings
// ============================================================
//
// Mirrors the localStorage-backed preference signals to the cloud
// `userSettings` table (key/value rows, scoped to the JWT user) so
// settings follow a signed-in account across devices.
//
//   pull:  on startup and every auth change, cloud values are applied
//          to localStorage AND live signals (via applyPersistedValue).
//   push:  every persisted-signal write (onPersistedWrite hook) is
//          debounced and upserted to the cloud.
//   rule:  whoever owns a key can register which side stands when an
//          unsent local value meets a different account row
//          (registerSyncPrecedence), before the first pull. With no
//          rule the local value wins; a merged key merges and has none.
//
// Signed out, practice stays in a separate guest copy on this device.
// With no API configured the sync hooks are inert.

import { createEffect, onCleanup } from 'solid-js'
import { getDb } from '@/db'
import type { UserSetting } from '@/db/entities'
import { hasValidToken } from '@/db/services/auth-service'
import { authVersion, getAuthToken, getUserId, } from '@/db/services/user-service'
import { API_BASE_URL } from '@/lib/defaults'
import { IS_NATIVE_BUILD } from '@/lib/native-build'
import { applyPersistedValue, onBeforePersistedWrite, onPersistedWrite, } from '@/lib/storage'
import { AUTH_TOKEN_KEY } from '@/lib/storage-port'
import { clearPendingIfUnchanged, markPending, readPending, } from './settings-pending'
import { acknowledgeProgressReset, activateProgress, activateProgressKey, beforeProgressWrite, MERGE_DEFAULTS, MERGE_ON_PULL, progressReset, progressResetRevision, progressValue, saveLocalProgress, saveProgress, } from './settings-progress'

/** Preference keys all share this prefix (see src/stores/*.ts). */
const SYNCED_PREFIX = 'pitchperfect_'

/**
 * Prefixed keys that are data, not preferences — never synced.
 *
 * The usage counters are per-device telemetry (usage_ms ticks every 15s the
 * tab is visible), so syncing them was both semantically wrong and the single
 * largest source of userSettings rows: it wrote a cloud row for anyone who
 * left the tab open, which made "has settings" useless as an activity signal.
 * Cross-device state (welcome_version, survey_seen) stays synced.
 */
const EXCLUDED_KEYS = new Set([
  'pitchperfect_session_history',
  'pitchperfect_usage_ms',
  'pitchperfect_activity_count',
  // The native app's two first-run facts are about THIS install: that its
  // welcome has been walked through, and that its operating system granted
  // the microphone. Synced, a second phone would skip its own welcome and
  // open the microphone on arrival without ever having been asked.
  'pitchperfect_native_welcome_seen',
  'pitchperfect_sing_mic_granted',
])

// The in-app developer console is device-local by nature: it is switched on
// to read what THIS device is saying, usually a phone that cannot be
// plugged in. Syncing it put a debug panel on every other signed-in device
// and wrote a cloud row for a debugging affordance.
//
// Named only in a build that has the floating console: the web, and a native
// test build. A native store build has none, and naming the key would put the
// console's fingerprint back into that binary
// (`scripts/assert-no-portable-console.mjs --store-binary`). Nothing there
// reads the key or pushes it; a pull can still copy an account's row for it
// into this device's storage, where only a test build installed over the
// store build would read it. Both sides of the condition are build constants,
// so a store build drops the branch and the string with it.
if (!IS_NATIVE_BUILD || import.meta.env.VITE_PORTABLE_CONSOLE === 'true') {
  EXCLUDED_KEYS.add('pitchperfect_developer_console')
}

/** Safety valve: skip anything suspiciously large for a preference. */
const MAX_VALUE_BYTES = 8 * 1024

const PUSH_DEBOUNCE_MS = 1500

function isSyncedKey(key: string): boolean {
  if (MERGE_ON_PULL[key] !== undefined) return true
  return key.startsWith(SYNCED_PREFIX) && !EXCLUDED_KEYS.has(key)
}

function cloudActive(): boolean {
  return API_BASE_URL != null && API_BASE_URL !== '' && hasValidToken()
}

interface SyncIdentity {
  userId: string
  version: number
  token: string | null
}

function syncIdentity(): SyncIdentity {
  return { userId: getUserId(), version: authVersion(), token: getAuthToken() }
}

function isCurrent(identity: SyncIdentity): boolean {
  return (
    cloudActive() &&
    getUserId() === identity.userId &&
    authVersion() === identity.version &&
    getAuthToken() === identity.token
  )
}

const pushTimers = new Map<string, ReturnType<typeof setTimeout>>()
const pushQueues = new Map<string, Promise<void>>()
let pullRevision = 0

type SyncPrecedence = (local: string, remote: string) => 'local' | 'remote'

const precedence = new Map<string, SyncPrecedence>()

/**
 * Gives `key` a rule for when this device's unsent value and the account's
 * row differ: 'remote' keeps the account's value and drops the local one,
 * 'local' sends the local one as a key with no rule does. A key that merges
 * on pull (MERGE_ON_PULL) merges and ignores it.
 */
export function registerSyncPrecedence(
  key: string,
  prefer: SyncPrecedence,
): void {
  precedence.set(key, prefer)
}

/** Does the key's rule keep the account's row over a different unsent value? */
function accountStands(key: string, local: string, remote: string): boolean {
  if (local === remote || MERGE_ON_PULL[key] !== undefined) return false
  return precedence.get(key)?.(local, remote) === 'remote'
}

async function uploadPending(
  key: string,
  identity: SyncIdentity,
): Promise<void> {
  if (!isCurrent(identity)) return
  try {
    const db = await getDb()
    if (!isCurrent(identity)) return
    const repo = db.getRepository<UserSetting>('userSettings')
    // Reads must fail closed. A swallowed network failure is not evidence
    // that the row is absent, and must never turn an update into a create.
    const rows = await repo.findAll({ where: { key }, throwOnError: true })
    if (!isCurrent(identity)) return
    let value = readPending(identity.userId)[key]
    if (value === undefined) return
    const existing = rows[0]
    const merge = MERGE_ON_PULL[key]
    let reset: string | undefined
    if (merge !== undefined) {
      activateProgressKey(key)
      reset = progressReset(key)
      value = progressValue(key) ?? value
      if (reset === undefined)
        value = merge(value, existing?.value ?? MERGE_DEFAULTS[key])
      saveProgress(key, value)
      // The merged value replaces the pending snapshot before one upload.
      // Flushing the old snapshot after a separate merge upload loses days.
      markPending(key, value, identity.userId)
    }
    if (!isCurrent(identity) || value.length > MAX_VALUE_BYTES) return
    if (existing === undefined) {
      await repo.create({ userId: '', key, value })
    } else if (accountStands(key, value, existing.value)) {
      // The identity checked above still holds: nothing was awaited since.
      applyPersistedValue(key, existing.value)
    } else if (existing.value !== value) {
      await repo.update(existing.id, { value })
    }
    // An old completion must not clear the new account/generation's ledger.
    if (isCurrent(identity) && progressReset(key) === reset) {
      acknowledgeProgressReset(key, reset)
      clearPendingIfUnchanged(key, value, identity.userId)
    }
  } catch (err) {
    console.warn(`[settings-sync] push failed for "${key}":`, err)
  }
}

function pushPending(key: string, identity = syncIdentity()): void {
  const queueKey = JSON.stringify([identity.userId, key])
  const previous = pushQueues.get(queueKey) ?? Promise.resolve()
  const pushing = previous.then(() => uploadPending(key, identity))
  pushQueues.set(queueKey, pushing)
  void pushing.finally(() => {
    if (pushQueues.get(queueKey) === pushing) pushQueues.delete(queueKey)
  })
}

function flushPendingPushes(): void {
  for (const timer of pushTimers.values()) clearTimeout(timer)
  pushTimers.clear()
  if (!cloudActive()) return
  const identity = syncIdentity()
  for (const key of Object.keys(readPending(identity.userId))) {
    if (isSyncedKey(key)) pushPending(key, identity)
  }
}

/**
 * One pull. True once the account's rows were read and applied; false when it
 * stopped short of that: no API, no usable sign-in, a newer pull or another
 * identity took over, a progress reset, or a read that failed.
 */
async function pullOnce(): Promise<boolean> {
  if (API_BASE_URL == null || API_BASE_URL === '') return false
  const revision = ++pullRevision
  // This happens even on sign-out or an expired token: A's work stays in A's
  // saved copy, while the newly active guest/account receives its own signals.
  if (!activateProgress() || !cloudActive()) return false
  const identity = syncIdentity()
  try {
    const resetRevision = progressResetRevision()
    const db = await getDb()
    if (!isCurrent(identity) || revision !== pullRevision) return false
    const repo = db.getRepository<UserSetting>('userSettings')
    const rows = await repo.findAll({ throwOnError: true })
    if (!isCurrent(identity) || revision !== pullRevision) return false
    if (!activateProgress() || progressResetRevision() !== resetRevision) {
      return false
    }
    const seen = new Set<string>()
    const pending = readPending(identity.userId)
    for (const row of rows) {
      if (!isSyncedKey(row.key)) continue
      seen.add(row.key)
      const merge = MERGE_ON_PULL[row.key]
      if (merge !== undefined) {
        // Reset survives a restart and an absent pending ledger (for example
        // after token expiry). Upload this owned copy before merging again.
        if (progressReset(row.key) !== undefined) {
          const local = progressValue(row.key)
          if (local !== undefined && local.length <= MAX_VALUE_BYTES)
            markPending(row.key, local, identity.userId)
          continue
        }
        const next = merge(progressValue(row.key) ?? null, row.value)
        saveProgress(row.key, next)
        if (next !== row.value) {
          if (next.length <= MAX_VALUE_BYTES)
            markPending(row.key, next, identity.userId)
        } else if (pending[row.key] !== undefined) {
          clearPendingIfUnchanged(row.key, pending[row.key], identity.userId)
        }
      } else if (pending[row.key] !== undefined) {
        if (pending[row.key] === row.value) {
          clearPendingIfUnchanged(row.key, row.value, identity.userId)
        } else if (accountStands(row.key, pending[row.key], row.value)) {
          applyPersistedValue(row.key, row.value)
          clearPendingIfUnchanged(row.key, pending[row.key], identity.userId)
        }
      } else if (localStorage.getItem(row.key) !== row.value) {
        applyPersistedValue(row.key, row.value)
      }
    }
    for (const key of Object.keys(MERGE_ON_PULL)) {
      if (seen.has(key)) continue
      const local = progressValue(key)
      if (local !== undefined && local.length <= MAX_VALUE_BYTES) {
        markPending(key, local, identity.userId)
      }
    }
    flushPendingPushes()
    return true
  } catch (err) {
    console.warn('[settings-sync] pull failed:', err)
    return false
  }
}

// ── This page's first pull ───────────────────────────────────────────────
//
// What a caller waits on when a decision depends on the account's settings
// (a plan answered on another device arrives with them). The answer is module
// state because it belongs to this page load: callers mount after the pull has
// begun, or after it has ended, and ask all the same.

let settleFirstPull: (applied: boolean) => void = () => undefined
const firstPull = new Promise<void>((resolve, reject) => {
  settleFirstPull = (applied) => {
    if (applied) resolve()
    else reject(new Error('The first settings pull ended without the account'))
  }
})
// A page nobody asks never reads it, and an unread rejection is reported.
void firstPull.catch(() => undefined)

/**
 * Resolves when this page's first settings pull has applied the account's
 * settings, and at once when sync is off (there is no pull to wait for).
 * Rejects when that pull ended without reading them: no usable sign-in,
 * offline, a newer pull took over, a progress reset. The first pull to finish
 * decides, and a later one changes nothing. The wait is the caller's to
 * bound (awaitSettingsPull in the plan's settings-pull-wait.ts does).
 */
export async function settingsPulled(): Promise<void> {
  if (API_BASE_URL == null || API_BASE_URL === '') return
  await firstPull
}

/** Restore this account's local progress first, then reconcile its cloud copy. */
export async function pullCloudSettings(): Promise<void> {
  let applied = false
  try {
    applied = await pullOnce()
  } finally {
    settleFirstPull(applied)
  }
}

/**
 * Start settings sync. Call once from a component scope (App onMount):
 * registers the write-through hook and re-pulls on every auth change.
 */
export function initSettingsSync(): void {
  if (API_BASE_URL == null || API_BASE_URL === '') return

  activateProgress()
  onBeforePersistedWrite((key) => {
    if (MERGE_ON_PULL[key] === undefined) return true
    try {
      // A token changed in another tab before its storage event reached us.
      // Reconcile the live store, but reject this already-computed write:
      // an absolute caller may have calculated it from the previous singer.
      return beforeProgressWrite(key)
    } catch (err) {
      console.warn('[settings-sync] refused a write with unknown owner:', err)
      return false
    }
  })
  onPersistedWrite((key, serialized) => {
    if (!isSyncedKey(key)) return
    try {
      const value =
        MERGE_ON_PULL[key] === undefined
          ? serialized
          : saveLocalProgress(key, serialized)
      if (!cloudActive() || value.length > MAX_VALUE_BYTES) return
      const identity = syncIdentity()
      markPending(key, value, identity.userId)
      clearTimeout(pushTimers.get(key))
      pushTimers.set(
        key,
        setTimeout(() => {
          pushTimers.delete(key)
          pushPending(key, identity)
        }, PUSH_DEBOUNCE_MS),
      )
    } catch (err) {
      console.warn('[settings-sync] could not retain a local write:', err)
    }
  })

  // pagehide fires on a reload, a close and a bfcache suspend alike, which is
  // every way this tab can stop running its own timers. visibilitychange is
  // the companion iOS actually delivers when an app is backgrounded and then
  // killed without ever firing pagehide.
  if (typeof window !== 'undefined') {
    const onStorage = (event: StorageEvent): void => {
      if (event.key === AUTH_TOKEN_KEY || event.key === null)
        void pullCloudSettings()
    }
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') flushPendingPushes()
    }
    window.addEventListener('pagehide', flushPendingPushes)
    window.addEventListener('storage', onStorage)
    document.addEventListener('visibilitychange', onVisibility)
    onCleanup(() => {
      window.removeEventListener('pagehide', flushPendingPushes)
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onVisibility)
      onBeforePersistedWrite(null)
      onPersistedWrite(null)
      for (const timer of pushTimers.values()) clearTimeout(timer)
      pushTimers.clear()
    })
  }

  // Pull now and on every sign-in/sign-out (token change).
  createEffect(() => {
    authVersion()
    void pullCloudSettings()
  })
}
