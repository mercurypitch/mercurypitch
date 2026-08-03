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
//
// Signed out (or no API configured) the hooks are inert — settings
// stay local, exactly as before.

import { createEffect } from 'solid-js'
import { getDb } from '@/db'
import type { UserSetting } from '@/db/entities'
import { hasUpgradedAccount, hasValidToken } from '@/db/services/auth-service'
import { authVersion, getDeviceId, getUserId } from '@/db/services/user-service'
import type { PathProgress } from '@/features/path/path-progress'
import { mergePathProgress, PATH_PROGRESS_KEY, } from '@/features/path/path-progress'
import { API_BASE_URL } from '@/lib/defaults'
import { applyPersistedValue, onPersistedWrite } from '@/lib/storage'

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
])

/**
 * Unprefixed keys that ARE account state and must follow the user across
 * devices. The Ascent's progress predates the prefix convention; renaming
 * it would strand every climb already in progress, so it opts in by name.
 */
const INCLUDED_KEYS = new Set<string>([PATH_PROGRESS_KEY])

/**
 * Keys whose two sides must be reconciled, not overwritten, when a
 * sign-in finds a value on both the device and the account.
 *
 * Everything else is a preference — last one wins is right, and the newest
 * device is the best guess. Progress is not a preference: overwriting it
 * destroys practice days someone actually did. Each resolver takes the raw
 * strings and returns the value both sides should end up holding.
 */
const MERGE_ON_PULL: Record<
  string,
  (local: string | null, cloud: string) => string
> = {
  [PATH_PROGRESS_KEY]: (local, cloud) => {
    if (local === null) return cloud
    try {
      const merged = mergePathProgress(
        JSON.parse(local) as PathProgress | null,
        JSON.parse(cloud) as PathProgress | null,
      )
      return JSON.stringify(merged)
    } catch {
      // Unparseable on either side — prefer the account's copy over a
      // corrupt local one rather than dropping the pull entirely.
      return cloud
    }
  },
}

/**
 * Which ACCOUNT the device's merge-key values belong to.
 *
 * Merging is only safe when the local side is the SAME person. Logout does
 * not clear localStorage (auth-service.ts `logout`), so on a shared computer
 * one singer's progress is still sitting there when the next one signs in —
 * and a union is irreversible, so their Ascent would permanently absorb
 * practice days they never did. Unset means the local copy was made
 * signed-out: that IS the person now signing in, and merging is exactly
 * what they want (this is the "I practised before making an account" path).
 *
 * Account, emphatically — an anonymous identity is not one. It is lazily
 * provisioned on the first write and holds a real token, so the sync runs
 * long before anyone signs in; stamping its id here made the unowned state
 * indistinguishable from a stranger's, and the commonest path in the app
 * lost its climb to the account's copy on sign-in.
 *
 * Same rule the voiceprints take from decision D2, kept deliberately
 * conservative: when the owner does not match, the account's copy wins and
 * the device's is left alone rather than uploaded.
 */
const MERGE_OWNER_KEY = 'mp_sync_owner'

function localMergeOwner(): string | null {
  try {
    return localStorage.getItem(MERGE_OWNER_KEY)
  } catch {
    return null
  }
}

function claimMergeOwner(userId: string): void {
  try {
    localStorage.setItem(MERGE_OWNER_KEY, userId)
  } catch {
    /* private mode — merging simply stays conservative next time */
  }
}

function forgetMergeOwner(): void {
  try {
    localStorage.removeItem(MERGE_OWNER_KEY)
  } catch {
    /* private mode — there was nothing stored to forget */
  }
}

/** Safety valve: skip anything suspiciously large for a preference. */
const MAX_VALUE_BYTES = 8 * 1024

const PUSH_DEBOUNCE_MS = 1500

function isSyncedKey(key: string): boolean {
  if (INCLUDED_KEYS.has(key)) return true
  return key.startsWith(SYNCED_PREFIX) && !EXCLUDED_KEYS.has(key)
}

function cloudActive(): boolean {
  return API_BASE_URL != null && API_BASE_URL !== '' && hasValidToken()
}

// key → cloud row id, learned from the pull so pushes can update
// instead of create without an extra lookup per write.
const cloudRowIds = new Map<string, string>()
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>()

async function pushSetting(key: string, value: string): Promise<void> {
  if (!cloudActive()) return
  try {
    const db = await getDb()
    const repo = db.getRepository<UserSetting>('userSettings')
    const existingId = cloudRowIds.get(key)
    if (existingId != null) {
      await repo.update(existingId, { value })
      return
    }
    // First write for this key this session — resolve or create the row.
    const rows = await repo.findAll({ where: { key } })
    if (rows.length > 0) {
      cloudRowIds.set(key, rows[0].id)
      await repo.update(rows[0].id, { value })
    } else {
      const created = await repo.create({ userId: '', key, value })
      cloudRowIds.set(key, created.id)
    }
  } catch (err) {
    console.warn(`[settings-sync] push failed for "${key}":`, err)
  }
}

/**
 * Apply all cloud settings to localStorage and live signals. Cloud
 * wins at sign-in time; afterwards local writes win (write-through).
 */
export async function pullCloudSettings(): Promise<void> {
  if (!cloudActive()) return
  try {
    const db = await getDb()
    const repo = db.getRepository<UserSetting>('userSettings')
    const rows = await repo.findAll()
    cloudRowIds.clear()
    // Whose progress is sitting on this device? Only merge with our own.
    const me = getUserId()
    const owner = localMergeOwner()
    const mayMerge = owner === null || owner === me
    for (const row of rows) {
      if (!isSyncedKey(row.key)) continue
      cloudRowIds.set(row.key, row.id)
      const local = localStorage.getItem(row.key)
      const merge = mayMerge ? MERGE_ON_PULL[row.key] : undefined
      const next = merge === undefined ? row.value : merge(local, row.value)
      if (local !== next) applyPersistedValue(row.key, next)
      // A merge can leave the account behind the device (local-only days).
      // applyPersistedValue deliberately doesn't echo, so push it back.
      if (next !== row.value) void pushSetting(row.key, next)
    }

    // Backfill: a climb that started before this device ever signed in has
    // no cloud row at all, and nothing would upload it until the next
    // practice day. Seed it now so the account owns it immediately — but
    // only when the device's copy is ours to give (see MERGE_OWNER_KEY).
    if (mayMerge) {
      for (const key of Object.keys(MERGE_ON_PULL)) {
        if (cloudRowIds.has(key)) continue
        const local = localStorage.getItem(key)
        if (local !== null && local.length <= MAX_VALUE_BYTES) {
          void pushSetting(key, local)
        }
      }
    }

    // From here the device's copy belongs to this account, so the next
    // signer-in gets the account's own data instead of inheriting ours.
    // Only a real account may say that; see MERGE_OWNER_KEY.
    if (hasUpgradedAccount()) {
      if (me !== '') claimMergeOwner(me)
    } else if (owner !== null && owner === getDeviceId()) {
      // An older build claimed on every pull, so devices are out there
      // carrying their own id here — which would block the merge above
      // for the rest of that device's life. It is safe to read as unset
      // only from inside an anonymous session, which is the one place
      // the stamp is unambiguous: an upgraded device cannot reach this
      // line, because the server refuses it anonymous re-auth (403) and
      // the pull returns early with no token at all.
      forgetMergeOwner()
    }
  } catch (err) {
    console.warn('[settings-sync] pull failed:', err)
  }
}

/**
 * Start settings sync. Call once from a component scope (App onMount):
 * registers the write-through hook and re-pulls on every auth change.
 */
export function initSettingsSync(): void {
  if (API_BASE_URL == null || API_BASE_URL === '') return

  onPersistedWrite((key, serialized) => {
    if (!isSyncedKey(key)) return
    if (serialized.length > MAX_VALUE_BYTES) return
    if (!cloudActive()) return
    clearTimeout(pushTimers.get(key))
    pushTimers.set(
      key,
      setTimeout(() => {
        pushTimers.delete(key)
        void pushSetting(key, serialized)
      }, PUSH_DEBOUNCE_MS),
    )
  })

  // Pull now and on every sign-in/sign-out (token change).
  createEffect(() => {
    authVersion()
    void pullCloudSettings()
  })
}
