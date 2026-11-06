import { IS_NATIVE_BUILD } from '@/lib/native-build'

const PERSISTENCE_ATTEMPT_KEY = 'mp.storage_persist_prompted.v1'
/**
 * The Studio's own attempt. Its songs are the largest audio the app keeps,
 * often hundreds of megabytes, and a refusal given to stems on a first
 * visit may be a yes once the site is used more (Chromium decides from
 * that, without a prompt), so the Studio asks once on its own.
 */
const STUDIO_ATTEMPT_KEY = 'mp.storage_persist_prompted.studio.v1'

const attemptedThisPage = new Set<string>()

/**
 * Claim the one persistence attempt allowed for this prompt version. The
 * in-memory guard still works when localStorage is unavailable.
 */
function claimPersistenceAttempt(key: string): boolean {
  if (attemptedThisPage.has(key)) return false

  try {
    if (localStorage.getItem(key) === '1') {
      attemptedThisPage.add(key)
      return false
    }
    localStorage.setItem(key, '1')
  } catch {
    // Storage access can be blocked in private or embedded contexts.
  }

  attemptedThisPage.add(key)
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
 * Best-effort request to protect large local audio from browser eviction.
 * Unsupported APIs, blocked storage, denials, and browser errors never fail
 * the completed separation that triggered this follow-up.
 */
export type PersistentStorageReason = 'stems' | 'voice-takes' | 'studio'

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

  if (
    !claimPersistenceAttempt(
      reason === 'studio' ? STUDIO_ATTEMPT_KEY : PERSISTENCE_ATTEMPT_KEY,
    )
  )
    return false

  // Stems announce the request: the separation just finished and a prompt
  // out of nowhere would be a mystery. A kept take says "Take kept" on its
  // own page, and that page's rail footer carries the storage advice, so
  // the request is silent there, as the Studio's is: its Song options and
  // song list say whether the songs are kept. The app announces nothing: it
  // has no browser, and no prompt comes (review V2).
  if (reason === 'stems' && !IS_NATIVE_BUILD) {
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
  }

  try {
    const granted = await storage.persist()
    console.info('[db] persistent storage', granted ? 'granted' : 'denied')
    return granted
  } catch {
    return false
  }
}
