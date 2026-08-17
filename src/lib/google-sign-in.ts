// ============================================================
// Starting the Google redirect sign-in
// ============================================================
//
// Three surfaces offer "Continue with Google" — the shared auth modal, the
// account panel in Settings, and Karaoke Night's standalone account UI — and
// each carried its own copy of the same five-line handler.
//
// The copies agreed, which is the problem rather than the reassurance:
// nothing made them agree. They were three chances to drift on the path that
// carries the device secret, three places to fix a message, and only one of
// the three had a test. (The one test even said the other two were "covered
// by their own files". They were not.)
//
// What genuinely differs between the three is where a failure is SHOWN — an
// inline field in the two modals, a notification in the panel. So this hands
// the message back rather than taking a reporter to call: deciding how to
// show it stays with the component, and deciding *when there is something to
// show* stops being copied.

import { createSignal } from 'solid-js'
import { googleSignInUrl } from '@/db/services/auth-service'

/** Shown when the consent URL could not be fetched. */
export const GOOGLE_SIGN_IN_UNREACHABLE =
  'Could not reach Google sign-in. Try again.'

// The consent URL is FETCHED (see below), and on a slow connection that
// round trip took visible seconds during which the button gave no sign it
// had been pressed — so people pressed it again (owner report, 2026-08-17).
// One shared pending signal, because there are three buttons: each shows
// its own busy state, and a second press anywhere is ignored while the
// first is in flight. It stays true after a successful start on purpose —
// the page is about to unload, and re-enabling the button for that last
// instant invites the double-redirect this exists to prevent.
const [pending, setPending] = createSignal(false)
export const googleSignInPending = pending

/** Test seam: in production the page unloads after a successful start. */
export function resetGoogleSignInPending(): void {
  setPending(false)
}

// The one production path where the page does NOT unload after a
// successful start: the singer reaches Google's consent screen and
// presses Back, and the browser restores this page from the back-forward
// cache — JavaScript state intact, pending stuck true, button dead.
// pageshow with `persisted` is exactly that restoration.
if (typeof window !== 'undefined') {
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) setPending(false)
  })
}

/**
 * Send the browser to Google's consent screen.
 *
 * Resolves to `null` once the navigation has been asked for, or to the
 * message to show when it could not be started.
 *
 * Never rejects, deliberately. The URL is fetched rather than assembled — the
 * device secret that authorises absorbing this browser's anonymous progress
 * goes in a POST body, and a secret in a query string lands in browser
 * history, server logs and `Referer` headers. Fetching means an offline
 * device or a 500 can fail, and a click handler that throws leaves the button
 * looking dead.
 */
export async function startGoogleSignIn(): Promise<string | null> {
  if (pending()) return null
  setPending(true)
  try {
    window.location.assign(await googleSignInUrl())
    return null
  } catch {
    setPending(false)
    return GOOGLE_SIGN_IN_UNREACHABLE
  }
}
