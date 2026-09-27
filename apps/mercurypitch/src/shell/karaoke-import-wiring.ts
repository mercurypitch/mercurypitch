// ============================================================
// Stage 2's half of the shell: the import queue and the store
// ============================================================
//
// Plan S8 steps 20 and 22. The queue that sends imported songs runs for as
// long as the shell does: it sends again what the app closed on, re-attaches
// what the server already has, and says when a song is ready. The Karaoke
// room's paywall reaches the store through the API returned here, since the
// room cannot import the shell.
//
// A build without Import (the store build, until the subscription is real)
// gets neither. KARAOKE_IMPORT is a compile-time constant there, so the
// branch below, and all it imports, is dead code in that bundle.

import { requireAuth } from '@/db/services/auth-service'
import { getUserId } from '@/db/services/user-service'
import { startKaraokeImportQueue } from '@/features/karaoke-room/karaoke-import-queue'
import { KARAOKE_IMPORT } from '@/lib/native-build'
import type { NativeShellApi } from '@/stores/native-shell-store'
import { createNativeRuntime } from '../infrastructure/mobile-runtime'
import { createKaraokeSubscription } from './karaoke-subscription'

/**
 * The server's own id for this phone's user, making the anonymous identity
 * if there is none yet, as an import does. Null when the server cannot be
 * reached, or a signed-out account has to sign in first.
 */
async function serverUserId(): Promise<string | null> {
  return (await requireAuth()) ? getUserId() : null
}

export interface KaraokeImportWiring {
  /** What the shell adds to the API it registers for the rooms. */
  readonly api: Pick<NativeShellApi, 'karaokeSubscription'>
  /** Stops the queue, with the shell. */
  readonly stop: () => void
}

export function installKaraokeImport(): KaraokeImportWiring {
  if (!KARAOKE_IMPORT) return { api: {}, stop: () => undefined }
  return {
    api: {
      karaokeSubscription: createKaraokeSubscription(
        createNativeRuntime(),
        serverUserId,
      ),
    },
    stop: startKaraokeImportQueue(),
  }
}
