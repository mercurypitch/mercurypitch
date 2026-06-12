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
import { hasValidToken } from '@/db/services/auth-service'
import { authVersion } from '@/db/services/user-service'
import { API_BASE_URL } from '@/lib/defaults'
import { applyPersistedValue, onPersistedWrite } from '@/lib/storage'

/** Preference keys all share this prefix (see src/stores/*.ts). */
const SYNCED_PREFIX = 'pitchperfect_'

/** Prefixed keys that are data, not preferences — never synced. */
const EXCLUDED_KEYS = new Set(['pitchperfect_session_history'])

/** Safety valve: skip anything suspiciously large for a preference. */
const MAX_VALUE_BYTES = 8 * 1024

const PUSH_DEBOUNCE_MS = 1500

function isSyncedKey(key: string): boolean {
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
    for (const row of rows) {
      if (!isSyncedKey(row.key)) continue
      cloudRowIds.set(row.key, row.id)
      if (localStorage.getItem(row.key) !== row.value) {
        applyPersistedValue(row.key, row.value)
      }
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
