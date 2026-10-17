// ============================================================
// Stage 2's half of the shell: the import queue and the store
// ============================================================
//
// Plan S8 steps 20 and 22. The queue that sends imported songs runs for as
// long as the shell does: it sends again what the app closed on, re-attaches
// what the server already has, and says when a song is ready. The Cloud
// offer, which lives with the Karaoke room, reaches the store through the
// API returned here, since a feature cannot import the shell.
//
// A build without Import (the store build, until the subscription is real)
// gets neither. KARAOKE_IMPORT is a compile-time constant there, and the one
// conditional below folds to its stub, so `install` and all it imports are
// dead code in that bundle (assert-bundle.mjs STAGE 2 proves it).
//
// The subscription is told who is on the phone (PHONE) and keeps its note of
// a purchase made signed out in this phone's storage, so a sign-in can take
// that purchase to the account (karaoke-subscription.ts). Every change of
// session settles the note, a sign-in that never reached afterSignIn
// included. A test build also times every flow for the Developer screen
// (subscription-timing.ts); VITE_PORTABLE_CONSOLE is a compile-time constant
// too, so a build without the console carries no timer.

import { createEffect, createRoot, on } from 'solid-js'
import { currentAccountId, isRegisteredProvider, storedTokenProvider, } from '@/db/services/auth-service'
import { ensureSingerIdentity } from '@/db/services/singer-identity'
import { authVersion, getDeviceId, getUserId } from '@/db/services/user-service'
import { startKaraokeImportQueue } from '@/features/karaoke-room/karaoke-import-queue'
import { KARAOKE_IMPORT } from '@/lib/native-build'
import type { NativeShellApi } from '@/stores/native-shell-store'
import { createNativeRuntime } from '../infrastructure/mobile-runtime'
import type { PhoneIdentity } from './karaoke-subscription'
import { createKaraokeSubscription, settleNote, storedPurchaseNote, } from './karaoke-subscription'
import { appSubscriptionTiming } from './subscription-timing'

/**
 * The server's own id for this phone's user, making the anonymous identity
 * if there is none yet (singer-identity.ts, the one way the offer's path
 * makes one). Null when the server cannot be reached, or a signed-out
 * account has to sign in first.
 */
async function serverUserId(): Promise<string | null> {
  return (await ensureSingerIdentity()) ? getUserId() : null
}

export interface KaraokeImportWiring {
  /** What the shell adds to the API it registers for the rooms. */
  readonly api: Pick<NativeShellApi, 'karaokeSubscription'>
  /** Stops the queue and the note's settling, with the shell. */
  readonly stop: () => void
}

/**
 * Who is on this phone, by the session it holds. A real account's session
 * stays that account's while its token waits to be refreshed: only the
 * phone's own identity (or none) is "signed out" here.
 */
const PHONE: PhoneIdentity = {
  accountHeld: () => isRegisteredProvider(storedTokenProvider()),
  accountId: () =>
    isRegisteredProvider(storedTokenProvider()) ? currentAccountId() : null,
  anonymousId: getDeviceId,
}

function install(): KaraokeImportWiring {
  const note = storedPurchaseNote()
  const settling = createRoot((dispose) => {
    createEffect(
      on(authVersion, () => {
        settleNote(note, PHONE)
      }),
    )
    return dispose
  })
  const stopQueue = startKaraokeImportQueue()
  return {
    api: {
      karaokeSubscription: createKaraokeSubscription(
        createNativeRuntime(),
        serverUserId,
        {
          phone: PHONE,
          note,
          ...(import.meta.env.VITE_PORTABLE_CONSOLE === 'true'
            ? { timer: appSubscriptionTiming().timer }
            : {}),
        },
      ),
    },
    stop: () => {
      settling()
      stopQueue()
    },
  }
}

export function installKaraokeImport(): KaraokeImportWiring {
  return KARAOKE_IMPORT ? install() : { api: {}, stop: () => undefined }
}
