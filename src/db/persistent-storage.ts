const PERSISTENCE_ATTEMPT_KEY = 'mp.storage_persist_prompted.v1'

let attemptedThisPage = false

/**
 * Claim the one persistence attempt allowed for this prompt version. The
 * in-memory guard still works when localStorage is unavailable.
 */
function claimPersistenceAttempt(): boolean {
  if (attemptedThisPage) return false

  try {
    if (localStorage.getItem(PERSISTENCE_ATTEMPT_KEY) === '1') {
      attemptedThisPage = true
      return false
    }
    localStorage.setItem(PERSISTENCE_ATTEMPT_KEY, '1')
  } catch {
    // Storage access can be blocked in private or embedded contexts.
  }

  attemptedThisPage = true
  return true
}

/**
 * Best-effort request to protect large local audio from browser eviction.
 * Unsupported APIs, blocked storage, denials, and browser errors never fail
 * the completed separation that triggered this follow-up.
 */
export type PersistentStorageReason = 'stems' | 'voice-takes'

export async function ensurePersistentStorage(
  reason: PersistentStorageReason = 'stems',
): Promise<boolean> {
  const storage =
    typeof navigator === 'undefined' ? undefined : navigator.storage
  if (storage?.persist === undefined) return false

  if (storage.persisted !== undefined) {
    try {
      if (await storage.persisted()) return true
    } catch {
      // A failed status query should not prevent the actual request.
    }
  }

  if (!claimPersistenceAttempt()) return false

  try {
    const { showNotification } = await import('@/stores/notifications-store')
    const message =
      reason === 'voice-takes'
        ? 'Take saved on this device. Allow persistent storage when prompted to reduce the chance of your browser reclaiming it under low space.'
        : 'Stems saved! To protect your separated audio from browser disk cleanups under low space, allow persistent storage when prompted.'
    showNotification(message, 'info', { durationMs: 12000 })
  } catch {
    // A notification failure must not prevent the browser request.
  }

  try {
    const granted = await storage.persist()
    console.info('[db] persistent storage', granted ? 'granted' : 'denied')
    return granted
  } catch {
    return false
  }
}
