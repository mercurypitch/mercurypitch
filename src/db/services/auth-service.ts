// ============================================================
// Auth Service — client for the db-worker /api/auth endpoints
// ============================================================
//
// Lazy-anonymous: the device id lives in localStorage from the first
// page load, but it is only exchanged for a server identity once the
// visitor does something worth saving. restoreAuth() reuses an existing
// session and never creates one; requireAuth() provisions on demand and
// is called from write paths. Register/login/Google upgrade the same
// userId server-side (deviceId is passed along), so local attribution
// stays valid. See docs/plans/users-auth-plan.md.
//
// Provisioning eagerly at startup used to mint a users + userProfiles row
// for every page load — 93% of them bounces that never practiced — which
// buried the real signal and wrote personal data before the consent
// banner was answered.

import { createSignal } from 'solid-js'
import { trackEvent } from '@/lib/analytics'
import { API_BASE_URL } from '@/lib/defaults'
import { showNotification } from '@/stores/notifications-store'
// Cyclic with grant-flush, which imports hasValidToken from here. Safe:
// neither module touches the other at load time, only inside functions that
// run long after both have initialised. The alternative was a second copy of
// the token-expiry rule inside grant-flush.
import { discardPendingGrants, flushGrants } from './grant-flush'
import { authVersion, getAuthToken, getUserId, resetUserId, setAuthToken, } from './user-service'

// Bumped on every auth transition (token issued, redirect consumed, logout)
// so account-aware UI (e.g. the verify-email banner) can re-check /me
// without polling or prop-threading.
const [authStamp, bumpAuthStamp] = createSignal(0)
export { authStamp }

function authChanged(): void {
  bumpAuthStamp((n) => n + 1)
}

export interface AuthUserInfo {
  id: string
  createdAt: string
  updatedAt: string
  authProvider: 'anonymous' | 'password' | 'google'
  email: string | null
  emailVerified: boolean
  lastLoginAt: string | null
}

export interface AuthResponse {
  token: string
  userId: string
  isNew: boolean
  user: AuthUserInfo
}

export interface MeResponse {
  user: AuthUserInfo
  profile: Record<string, unknown> | null
}

// ── Token inspection (decode only — verification is server-side) ──

interface TokenPayload {
  sub: string
  provider: string
  exp: number
}

function decodeToken(token: string): TokenPayload | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const body = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(body)) as TokenPayload
  } catch {
    return null
  }
}

/** True when the stored token exists and is not (nearly) expired. */
export function hasValidToken(): boolean {
  const token = getAuthToken()
  if (token == null || token === '') return false
  const payload = decodeToken(token)
  if (payload == null) return false
  return payload.exp > Date.now() / 1000 + 60
}

/**
 * True when the held token belongs to a REAL account (password/Google).
 * Lazily provisioned anonymous identities hold valid tokens too, so
 * hasValidToken() alone cannot answer "do they still need to create an
 * account?" — asking it that quietly removed the account offer for
 * exactly the users it targets.
 */
export function hasUpgradedAccount(): boolean {
  if (!hasValidToken()) return false
  const payload = decodeToken(getAuthToken() ?? '')
  return payload != null && payload.provider !== 'anonymous'
}

/**
 * hasUpgradedAccount, but reactive — use this one inside components.
 *
 * The answer is available synchronously on the very first render: the
 * token is already in localStorage and decoding it is local work. Gating
 * account UI on a profile FETCH instead is what made the app look like
 * it did not know you were signed in for the first second after load,
 * and it is why a signed-in singer was being offered an account.
 *
 * Reading authVersion() subscribes the caller, so the same UI corrects
 * itself the moment someone signs in or out — without polling and
 * without a round trip.
 */
export function accountHeld(): boolean {
  authVersion()
  return hasUpgradedAccount()
}

// ── HTTP helpers ────────────────────────────────────────────────

function requireBaseUrl(): string {
  if (API_BASE_URL == null || API_BASE_URL === '') {
    throw new Error('auth-service: VITE_API_BASE_URL is not configured')
  }
  return API_BASE_URL
}

class AuthHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'AuthHttpError'
  }
}

const ACCOUNT_SUSPENDED_CODE = 'account_suspended'
const ACCOUNT_SUSPENDED_MESSAGE =
  'This account is suspended. Contact support if you believe this is a mistake.'
const ACCOUNT_SUSPENDED_NOTIFICATION_CHANNEL = 'account-suspension'

export function handleAuthErrorResponse(
  status: number,
  body: string,
  providerHint?: AuthUserInfo['authProvider'],
  notifyUser = true,
): boolean {
  if (status !== 403) return false
  let code = ''
  try {
    code = (JSON.parse(body) as { code?: string }).code ?? ''
  } catch {
    return false
  }
  if (code !== ACCOUNT_SUSPENDED_CODE) return false

  const provider =
    decodeToken(getAuthToken() ?? '')?.provider ?? providerHint ?? null
  const anonymous = provider === 'anonymous'
  // Keep an anonymous token as a server-side revocation probe. If the account
  // is restored, /me will reject that now-version-stale token and the client
  // can safely re-provision the same device identity. Real accounts must stop
  // carrying their bearer token immediately.
  if (!anonymous) setAuthToken(null)
  setRequiresLogin(!anonymous)
  tokenServerVerified = false
  authChanged()
  if (notifyUser) {
    showNotification(ACCOUNT_SUSPENDED_MESSAGE, 'error', {
      channel: ACCOUNT_SUSPENDED_NOTIFICATION_CHANNEL,
      durationMs: 15000,
    })
  }
  console.info('[auth] account suspended — cloud access disabled')
  return true
}

async function handleAuthResponse(
  response: Response,
  providerHint?: AuthUserInfo['authProvider'],
): Promise<boolean> {
  if (response.ok) return false
  const body = await response
    .clone()
    .text()
    .catch(() => '')
  return handleAuthErrorResponse(response.status, body, providerHint)
}

async function postAuth(
  route: string,
  body: Record<string, unknown>,
): Promise<AuthResponse> {
  const res = await fetch(`${requireBaseUrl()}/api/auth/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    // Surface the server's human-readable message ({"error": "…"}),
    // not the raw JSON — this string is shown directly in the UI.
    const detail = await res.text().catch(() => '')
    let message = ''
    let code = ''
    try {
      const parsed = JSON.parse(detail) as { error?: string; code?: string }
      message = parsed.error ?? ''
      code = parsed.code ?? ''
    } catch {
      /* not JSON */
    }
    handleAuthErrorResponse(
      res.status,
      detail,
      route === 'anonymous' ? 'anonymous' : undefined,
      false,
    )
    throw new AuthHttpError(
      message !== '' ? message : `Sign-in failed (${res.status})`,
      res.status,
      code !== '' ? code : undefined,
    )
  }
  const auth = (await res.json()) as AuthResponse
  setAuthToken(auth.token)
  setRequiresLogin(false)
  tokenServerVerified = true // freshly issued by this server
  // Anonymous device provisioning is not a signup — only count real
  // account creation (register / first Google sign-in).
  if (auth.isNew && route !== 'anonymous') trackEvent('signup')
  authChanged()
  return auth
}

// ── Signed-out state ────────────────────────────────────────────
//
// Once a device's anonymous identity is upgraded to a real account,
// the server refuses anonymous re-auth for it (403). After a sign-out
// we remember that, so the app stays quietly signed out — public
// content keeps working, personal data simply isn't tracked — instead
// of retrying a doomed anonymous handshake on every startup.

const REQUIRES_LOGIN_KEY = 'mp:requiresLogin'

function requiresLogin(): boolean {
  return localStorage.getItem(REQUIRES_LOGIN_KEY) === '1'
}

function setRequiresLogin(value: boolean): void {
  if (value) {
    localStorage.setItem(REQUIRES_LOGIN_KEY, '1')
  } else {
    localStorage.removeItem(REQUIRES_LOGIN_KEY)
  }
}

// ── Public API ──────────────────────────────────────────────────

// The client-side check only sees expiry — a token signed by a
// different worker (localhost vs deployed, or a rotated JWT_SECRET)
// looks "valid" locally but 401s on every request. Verify it against
// the server once per session and drop it if the server rejects it.
let tokenServerVerified = false

async function verifyTokenWithServer(): Promise<boolean> {
  if (tokenServerVerified) return true
  try {
    const res = await fetch(`${requireBaseUrl()}/api/auth/me`, {
      headers: { Authorization: `Bearer ${getAuthToken() ?? ''}` },
    })
    if (res.ok) {
      tokenServerVerified = true
      return true
    }
    if (res.status === 401 || res.status === 404) {
      // Stale or foreign-signed token — discard and re-auth below.
      console.info('[auth] stored token rejected by server — re-authenticating')
      setAuthToken(null)
      return false
    }
    if (res.status === 403) {
      const body = await res
        .clone()
        .text()
        .catch(() => '')
      if (handleAuthErrorResponse(res.status, body)) return false
    }
    // 5xx etc. — keep the token, assume a server hiccup.
    return true
  } catch {
    // Network down — keep the token, stay offline-tolerant.
    return true
  }
}

/**
 * Reuse an existing session, and never create one. Returns false when no
 * API is configured, no valid token is stored, or the server rejected it.
 * This is what startup and account UI call: a visitor who only browses
 * never gets a server-side identity. Never throws — callers must stay
 * usable offline.
 */
export async function restoreAuth(): Promise<boolean> {
  if (API_BASE_URL == null || API_BASE_URL === '') return false
  return hasValidToken() && (await verifyTokenWithServer())
}

// Concurrent first writes (a session save racing a settings push) must not
// each POST /api/auth/anonymous. The server is idempotent on deviceId, so
// this only avoids redundant round-trips and token churn.
let provisioning: Promise<boolean> | null = null

// Between account erasure and the page reload that follows it, nothing may
// re-provision an identity: a queued settings write hitting requireAuth in
// that window would mint a junk anonymous user seconds after the erasure.
// In-memory only — the reload clears it, and a later fresh visit should
// provision normally.
let tearingDown = false

/**
 * Make sure a cloud identity exists, provisioning an anonymous one on
 * demand. Call this from paths that are about to persist something —
 * the ServerAdapter write hook covers the generic CRUD surface; direct
 * fetch callers (billing, weekly attempts) call it themselves.
 *
 * Returns false when no API is configured, the network is down, or the
 * account was upgraded and requires an explicit login. Never throws.
 */
export async function requireAuth(): Promise<boolean> {
  if (API_BASE_URL == null || API_BASE_URL === '') return false
  if (tearingDown) return false
  if (await restoreAuth()) return true
  // A suspended anonymous token is deliberately retained so /me can detect
  // a later restore. Do not turn its failed verification into a new identity.
  if (hasValidToken()) return false
  if (requiresLogin()) return false
  provisioning ??= (async () => {
    try {
      await postAuth('anonymous', { deviceId: getUserId() })
      return true
    } catch (err) {
      if (
        err instanceof AuthHttpError &&
        err.status === 403 &&
        err.code !== ACCOUNT_SUSPENDED_CODE
      ) {
        // Upgraded account signed out — needs an explicit login.
        setRequiresLogin(true)
        console.info('[auth] signed out — log in to sync personal data')
      } else if (
        err instanceof AuthHttpError &&
        err.code === ACCOUNT_SUSPENDED_CODE
      ) {
        console.info('[auth] suspended account cannot sync personal data')
      } else {
        console.warn('[auth] anonymous auth failed:', err)
      }
      return false
    } finally {
      provisioning = null
    }
  })()
  return provisioning
}

export async function registerWithPassword(
  email: string,
  password: string,
  displayName?: string,
): Promise<AuthResponse> {
  return postAuth('register', {
    email,
    password,
    displayName,
    deviceId: getUserId(),
  })
}

export async function loginWithPassword(
  email: string,
  password: string,
): Promise<AuthResponse> {
  return postAuth('login', { email, password })
}

/**
 * Exchange a Google `idToken` credential for a session. Not used by the
 * web UI (it goes through the redirect flow below — COOP breaks the GIS
 * popup); kept deliberately as the API for native/mobile clients, where
 * the platform sign-in SDK yields an idToken directly.
 */
export async function loginWithGoogle(idToken: string): Promise<AuthResponse> {
  return postAuth('google', { idToken, deviceId: getUserId() })
}

// ── Google sign-in (redirect flow) ──────────────────────────────
//
// The app's COOP: same-origin header (required for SharedArrayBuffer /
// multithreaded ONNX) severs window.opener for popups, which breaks
// GIS popup sign-in in non-FedCM browsers (Firefox, Safari). So Google
// sign-in is a full-page redirect through the db-worker instead:
// GET /api/auth/google/start bounces via accounts.google.com and lands
// back on `returnTo` with our JWT in the fragment (#gauth=… on success,
// #gauth_error=… on failure).

export type GoogleRedirectResult = { ok: true } | { ok: false; error: string }

let googleRedirectResult: GoogleRedirectResult | null = null

/**
 * The app is hash-routed, but the hash can't ride along in `returnTo`:
 * the worker hands the JWT back as its own fragment (`#gauth=…`), and a
 * second `#` would corrupt it. So the current route is stashed here and
 * restored by consumeGoogleRedirect() when the user lands back.
 */
const RETURN_HASH_KEY = 'mp:gauthReturnHash'

/** URL that starts the Google sign-in redirect for this device. Also
 *  stashes the current hash route so the user returns to the same page. */
export function googleSignInUrl(): string {
  sessionStorage.setItem(RETURN_HASH_KEY, window.location.hash)
  const returnTo =
    window.location.origin + window.location.pathname + window.location.search
  const params = new URLSearchParams({ deviceId: getUserId(), returnTo })
  return `${requireBaseUrl()}/api/auth/google/start?${params.toString()}`
}

/**
 * Pick up the #gauth / #gauth_error fragment after returning from the
 * Google redirect: store the JWT, then swap the fragment for the hash
 * route stashed by googleSignInUrl() so the user lands back on the page
 * they started from. Runs at app startup, before the router boots and
 * before any other auth call.
 */
export function consumeGoogleRedirect(): void {
  const hash = window.location.hash
  if (!hash.startsWith('#gauth')) return
  const params = new URLSearchParams(hash.slice(1))
  const token = params.get('gauth')
  const error = params.get('gauth_error')
  if (token != null && token !== '') {
    setAuthToken(token)
    setRequiresLogin(false)
    tokenServerVerified = true // freshly issued by the worker
    googleRedirectResult = { ok: true }
    authChanged()
    // gauth_new marks a first-time Google account (set by the worker).
    if (params.get('gauth_new') === '1') trackEvent('signup')
  } else if (error != null && error !== '') {
    if (error === ACCOUNT_SUSPENDED_CODE) {
      handleAuthErrorResponse(
        403,
        JSON.stringify({ code: ACCOUNT_SUSPENDED_CODE }),
        undefined,
        false,
      )
    }
    googleRedirectResult = {
      ok: false,
      error:
        error === ACCOUNT_SUSPENDED_CODE ? ACCOUNT_SUSPENDED_MESSAGE : error,
    }
  }
  const returnHash = sessionStorage.getItem(RETURN_HASH_KEY) ?? ''
  sessionStorage.removeItem(RETURN_HASH_KEY)
  history.replaceState(
    null,
    '',
    window.location.pathname + window.location.search + returnHash,
  )
}

/** One-shot result of the redirect sign-in, for UI notifications. */
export function takeGoogleRedirectResult(): GoogleRedirectResult | null {
  const result = googleRedirectResult
  googleRedirectResult = null
  return result
}

// ── Email verification (confirm-link redirect + resend) ─────────────
//
// Password signups get a "confirm your email" link that routes through the
// worker (GET /api/auth/verify-email) and bounces back to the app root with
// #everified=1 / #everified_error=…, mirroring the Google flow above.

export type EmailVerifyResult = { ok: true } | { ok: false; error: string }

let emailVerifyResult: EmailVerifyResult | null = null

/** Pick up the #everified / #everified_error fragment after the emailed
 *  confirm link lands back on the app. Runs at startup, right after
 *  consumeGoogleRedirect() and before the router boots. */
export function consumeEmailVerifyRedirect(): void {
  const hash = window.location.hash
  if (!hash.startsWith('#everified')) return
  const params = new URLSearchParams(hash.slice(1))
  if (params.get('everified') === '1') {
    emailVerifyResult = { ok: true }
  } else {
    emailVerifyResult = {
      ok: false,
      error: params.get('everified_error') ?? 'unknown',
    }
  }
  history.replaceState(
    null,
    '',
    window.location.pathname + window.location.search,
  )
  authChanged()
}

/** One-shot result of the confirm-link redirect, for UI notifications. */
export function takeEmailVerifyResult(): EmailVerifyResult | null {
  const result = emailVerifyResult
  emailVerifyResult = null
  return result
}

/** Ask the server to re-send the confirm-your-email link. */
export async function resendVerificationEmail(): Promise<void> {
  const token = getAuthToken()
  if (token == null || token === '') throw new Error('Not signed in')
  const res = await fetch(`${requireBaseUrl()}/api/auth/resend-verification`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  await handleAuthResponse(res)
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    let message = ''
    try {
      message = (JSON.parse(detail) as { error?: string }).error ?? ''
    } catch {
      /* not JSON */
    }
    throw new Error(message !== '' ? message : `Resend failed (${res.status})`)
  }
}

// ── Password reset (forgot / choose-new) ─────────────────────────────
//
// Forgot-password emails a single-use link to the app's #/reset-password
// form; completing it revokes every existing session server-side, so the
// user signs in fresh with the password they just chose (no auto-login).

/** Pull the server's {"error": …} message out of a failed response. */
async function extractError(res: Response, fallback: string): Promise<string> {
  const detail = await res.text().catch(() => '')
  try {
    const message = (JSON.parse(detail) as { error?: string }).error ?? ''
    if (message !== '') return message
  } catch {
    /* not JSON */
  }
  return `${fallback} (${res.status})`
}

/** Ask the server to email a password-reset link. The response never
 *  reveals whether the address has an account. */
export async function requestPasswordReset(email: string): Promise<void> {
  const res = await fetch(`${requireBaseUrl()}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) {
    throw new Error(await extractError(res, 'Could not send the reset email'))
  }
}

/** Non-consuming validity probe for an emailed reset token, so the form can
 *  show "link expired" before the user types anything. Throws on network /
 *  server failure — callers decide whether to fall through to the form. */
export async function checkResetToken(token: string): Promise<boolean> {
  const res = await fetch(
    `${requireBaseUrl()}/api/auth/reset-password?token=${encodeURIComponent(token)}`,
  )
  if (!res.ok) {
    throw new Error(await extractError(res, 'Could not check the reset link'))
  }
  const data = (await res.json()) as { valid?: boolean }
  return data.valid === true
}

/** Complete the reset: consume the token and set the new password. */
export async function resetPassword(
  token: string,
  password: string,
): Promise<void> {
  const res = await fetch(`${requireBaseUrl()}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  })
  if (!res.ok) {
    throw new Error(await extractError(res, 'Could not reset the password'))
  }
}

export function logout(): void {
  const token = getAuthToken()
  const payload = token != null ? decodeToken(token) : null

  // Anything the grant engine has evaluated but not yet written belongs to
  // THIS identity. Flush it while the token is still valid — the flush
  // snapshots its credentials synchronously for exactly this reason — then
  // abandon whatever did not make it, so nothing lands on the next account.
  void flushGrants(true)
  discardPendingGrants()

  // Clear token immediately so the UI reflects signed-out state.
  // An upgraded device can't fall back to anonymous auth — remember
  // that so requireAuth() doesn't retry a doomed handshake on the next write.
  if (payload != null && payload.provider !== 'anonymous') {
    setRequiresLogin(true)
  }
  setAuthToken(null)
  tokenServerVerified = false
  authChanged()

  // Notify the server to revoke all tokens for this account.
  // Fire-and-forget: the client is already signed out regardless.
  if (
    token != null &&
    payload != null &&
    API_BASE_URL != null &&
    API_BASE_URL !== ''
  ) {
    void fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {
      // Network failure is non-fatal
    })
  }
}

/**
 * Permanently delete the signed-in account and everything the server holds
 * for it, then drop the local session. Irreversible; the caller confirms
 * first. Throws with the server's message so the UI can surface a failure
 * rather than pretending the data is gone.
 */
export async function deleteAccount(): Promise<void> {
  const token = getAuthToken()
  if (token == null || token === '') throw new Error('Not signed in')
  const res = await fetch(`${requireBaseUrl()}/api/auth/me`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  await handleAuthResponse(res)
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    let message = ''
    try {
      message = (JSON.parse(detail) as { error?: string }).error ?? ''
    } catch {
      /* not JSON */
    }
    throw new Error(
      message !== '' ? message : `Could not delete account (${res.status})`,
    )
  }
  // The account is gone, so there is nothing to sign back into and no
  // upgraded identity to remember — clear the signed-out flag too, letting
  // this device start fresh as a new visitor. Rotate the device id as well:
  // /api/auth/anonymous keys on it, so keeping it would resurrect the very
  // user id the erasure just removed. Block re-provisioning until the
  // caller's reload lands: a queued write in that window must not recreate
  // an identity the user just erased.
  tearingDown = true
  setRequiresLogin(false)
  setAuthToken(null)
  resetUserId()
  tokenServerVerified = false
  authChanged()
}

/** Current user + profile, or null when not authenticated / unreachable. */
export async function fetchMe(): Promise<MeResponse | null> {
  const token = getAuthToken()
  if (token == null || token === '') return null
  try {
    const res = await fetch(`${requireBaseUrl()}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      await handleAuthResponse(res)
      return null
    }
    return (await res.json()) as MeResponse
  } catch {
    // Backend unreachable (offline / CORS / down) — treat as unauthenticated
    // so the account UI degrades gracefully instead of leaking a NetworkError.
    return null
  }
}
