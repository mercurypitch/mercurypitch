// ============================================================
// Studio persistence — ask the browser once to keep this device's songs, and say whether it does
// ============================================================
//
// Songs live only in this browser's storage, which a browser may clear
// when the disk runs low (Chromium) or after a week without a visit
// (Safari, for a site not added to the home screen).
// navigator.storage.persist() asks it not to. The Studio asks after the
// first import or take is kept, once on this device
// (ensurePersistentStorage's 'studio' attempt): Chromium answers from how
// the site is used, with no prompt; Firefox shows one. A browser without
// the call, one that refuses, or one that fails leaves the songs as they
// were, and the readout says so.
import { createSignal } from 'solid-js'
import { ensurePersistentStorage, isStoragePersisted, } from '@/db/persistent-storage'

/** Whether the browser keeps the songs: `unknown` when it will not say. */
export type StudioProtection = 'protected' | 'unprotected' | 'unknown'

export interface StudioPersistenceDependencies {
  /** The once-a-device request; true when the songs are kept. */
  ensure(): Promise<boolean>
  /** Whether they are kept now: null when the browser will not say. */
  persisted(): Promise<boolean | null>
}

const BROWSER: StudioPersistenceDependencies = {
  ensure: () => ensurePersistentStorage('studio'),
  persisted: isStoragePersisted,
}

export function createStudioPersistence(
  dependencies: StudioPersistenceDependencies = BROWSER,
) {
  // Null until the browser has answered the first read.
  const [protection, setProtection] = createSignal<StudioProtection | null>(
    null,
  )
  let asked = false

  async function read(): Promise<void> {
    let kept: boolean | null
    try {
      kept = await dependencies.persisted()
    } catch {
      kept = null
    }
    setProtection(
      kept === null ? 'unknown' : kept ? 'protected' : 'unprotected',
    )
  }
  void read()

  /**
   * A take was kept in a song: the first time this page sees one, ask the
   * browser to keep the songs (it asks once on this device), then read the
   * answer back.
   */
  function afterKeep(): void {
    if (asked) return
    asked = true
    void dependencies.ensure().then(read, read)
  }

  return {
    protection,
    afterKeep,
    /** `add`, and once it has kept a take, afterKeep. */
    keeping<A extends unknown[]>(
      add: (...args: A) => Promise<boolean>,
    ): (...args: A) => Promise<boolean> {
      return async (...args) => {
        const added = await add(...args)
        if (added) afterKeep()
        return added
      }
    },
  }
}

export type StudioPersistence = ReturnType<typeof createStudioPersistence>
