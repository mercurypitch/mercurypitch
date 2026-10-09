// ============================================================
// Google return nonce — a Google sign-in counts only in the browser that started it
// ============================================================
//
// Google sign-in is a full-page redirect: the worker sends the browser back
// to the page that started it with the session in the URL fragment
// (`#gauth=<token>`). A fragment is only text in a link. Anyone holding a
// session for their own account could write `/#gauth=<it>&gauth_new=1` and
// send it, and until 2026-10 every page that takes a Google return stored
// that session: whoever opened the link was signed in to the sender's account
// (login CSRF), and `gauth_new=1` adopted this device's unclaimed takes into
// it. The same link could sign a singer out with `#gauth_error=account_suspended`
// or put any sentence it liked into the failure toast.
//
// So a sign-in carries a nonce. `beginGoogleReturn` mints one when this
// browser starts a sign-in and keeps it here. The worker signs it into the
// OAuth state and hands it back as `gauth_nonce` beside the session, the
// second-factor ceremony or the error. `readGoogleReturn` honours those only
// when that nonce is the pending one, and spends it.
//
// Two returns stay unbound on purpose. `expired_state` is the worker's answer
// when it could not read the state at all, so it has no nonce to echo; it maps
// to a fixed sentence. A connect-Drive pass (`#gdrive…`) cannot change who is
// signed in, and the settings page maps its codes to fixed sentences too.
//
// localStorage, not sessionStorage, for the reason the return route lives
// there (RETURN_HASH_KEY in auth-service): on Android the return can land in
// the installed app rather than the tab that started it, and only localStorage
// is shared between the two.

const PENDING_KEY = 'mp:gauthPending'

/**
 * How long a started sign-in waits for its return. The worker refuses a state
 * older than ten minutes (STATE_TTL_MS in workers/db-worker/src/auth.ts). This
 * is longer, so a return the worker accepted is never the one turned away here.
 */
const PENDING_TTL_MS = 15 * 60 * 1000

/**
 * The worker's answer when the OAuth state is unusable: almost always its
 * ten-minute life ran out while the consent screen sat open in a tab the
 * singer walked away from. The worker cannot read a nonce from a state it
 * cannot read, so this is the one sign-in error honoured without one.
 */
export const EXPIRED_STATE_CODE = 'expired_state'

/** A session or second-factor ceremony arrived for a sign-in this browser did not start. */
export const UNSTARTED_RETURN_CODE = 'unstarted_return'

interface PendingReturn {
  nonce: string
  expiresAt: number
}

/**
 * Mint the nonce for a Google sign-in this browser is about to start, and
 * remember it. It replaces any earlier one: the sign-in started last is the
 * one whose return counts.
 *
 * Throws when storage refuses the write. The caller then reports that the
 * sign-in could not start, which beats sending somebody through Google to a
 * return this page will refuse.
 */
export function beginGoogleReturn(now = Date.now()): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32))
  const nonce = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  const pending: PendingReturn = { nonce, expiresAt: now + PENDING_TTL_MS }
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending))
  return nonce
}

/**
 * Whether `returned` is the nonce of the sign-in this browser started. A match
 * is spent, so a return counts once. A different nonce leaves the pending one
 * alone: its own return may still be on the way.
 *
 * Never throws. It runs at boot, before the page renders, and blocked storage
 * must not cost the page its first paint.
 */
function claimGoogleReturn(returned: string | null, now: number): boolean {
  if (returned === null || returned === '') return false
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (raw === null) return false
    const pending = JSON.parse(raw) as Partial<PendingReturn>
    if (typeof pending.expiresAt !== 'number' || pending.expiresAt <= now) {
      localStorage.removeItem(PENDING_KEY)
      return false
    }
    if (pending.nonce !== returned) return false
    localStorage.removeItem(PENDING_KEY)
    return true
  } catch {
    return false
  }
}

/** A connect-Drive pass's outcome, as the settings page reads it. */
type DriveReturn = { ok: true } | { ok: false; error: string }

/** What a Google return may change, once a planted link has been ruled out. */
export interface GoogleReturn {
  /** The session, only from a sign-in this browser started. */
  token: string | null
  /** That sign-in created the account (`gauth_new=1`). */
  created: boolean
  /** The second-factor ceremony, only from a sign-in this browser started. */
  twofa: string | null
  /** An error code to report, or null when there is nothing to say. */
  error: string | null
  drive: DriveReturn | null
}

function present(value: string | null): string | null {
  return value === null || value === '' ? null : value
}

function readDrive(params: URLSearchParams): DriveReturn | null {
  if (params.get('gdrive') === '1') return { ok: true }
  const error = present(params.get('gdrive_error'))
  return error === null ? null : { ok: false, error }
}

/**
 * Read the fragment a Google return landed with: `#gauth…` from a sign-in,
 * `#gdrive…` from a connect-Drive pass. Null for any other address, which the
 * caller leaves alone.
 *
 * A return this browser did not start keeps nothing that could sign somebody
 * in or out. Its session or ceremony becomes `UNSTARTED_RETURN_CODE`, so the
 * person who did press the button hears why nothing happened, and any other
 * error is dropped, so no sentence of the link's choosing reaches the screen.
 */
export function readGoogleReturn(
  hash: string,
  now = Date.now(),
): GoogleReturn | null {
  if (!hash.startsWith('#gauth') && !hash.startsWith('#gdrive')) return null
  const params = new URLSearchParams(hash.slice(1))
  const token = present(params.get('gauth'))
  const twofa = present(params.get('gauth_2fa'))
  const error = present(params.get('gauth_error'))
  const drive = readDrive(params)
  if (claimGoogleReturn(params.get('gauth_nonce'), now)) {
    const created = token !== null && params.get('gauth_new') === '1'
    return { token, created, twofa, error, drive }
  }
  let unbound: string | null = null
  if (token !== null || twofa !== null) unbound = UNSTARTED_RETURN_CODE
  else if (error === EXPIRED_STATE_CODE) unbound = error
  return { token: null, created: false, twofa: null, error: unbound, drive }
}
