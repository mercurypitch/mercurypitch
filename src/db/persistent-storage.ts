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
 * Whether this origin's storage is already protected from eviction.
 *
 * `null` means the browser will not say — which is not the same as "no",
 * and Settings shows it differently.
 */
export async function isStoragePersisted(): Promise<boolean | null> {
  const storage =
    typeof navigator === 'undefined' ? undefined : navigator.storage
  if (storage?.persisted === undefined) return null
  try {
    return await storage.persisted()
  } catch {
    return null
  }
}

/**
 * Ask for persistence because somebody asked for it.
 *
 * Deliberately not `ensurePersistentStorage`: that one is the automatic
 * follow-up to a separation and spends its single attempt quietly, so a
 * button wired to it would do nothing at all the second time somebody
 * pressed it. When the request is the user's own action there is no
 * attempt to ration and no notification to explain it -- they are looking
 * at the thing they asked about.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  const storage =
    typeof navigator === 'undefined' ? undefined : navigator.storage
  if (storage?.persist === undefined) return false
  try {
    const granted = await storage.persist()
    console.info(
      '[db] persistent storage (asked for)',
      granted ? 'granted' : 'denied',
    )
    return granted
  } catch {
    return false
  }
}

/**
 * Best-effort request to protect large local stems from browser eviction.
 * Unsupported APIs, blocked storage, denials, and browser errors never fail
 * the completed separation that triggered this follow-up.
 */
export async function ensurePersistentStorage(): Promise<boolean> {
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
    showNotification(
      'Stems saved! To protect your separated audio from browser disk cleanups under low space, allow persistent storage when prompted.',
      'info',
      { durationMs: 12000 },
    )
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
