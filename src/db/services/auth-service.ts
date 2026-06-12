// ============================================================
// Auth Service — client for the db-worker /api/auth endpoints
// ============================================================
//
// Anonymous-first: ensureAuth() silently exchanges the persisted
// device id for a JWT at startup. Register/login/Google upgrade the
// same userId server-side (deviceId is passed along), so local
// attribution stays valid. See docs/plans/users-auth-plan.md.

import { API_BASE_URL } from '@/lib/defaults'
import { getAuthToken, getUserId, setAuthToken } from './user-service'

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
  ) {
    super(message)
    this.name = 'AuthHttpError'
  }
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
    const detail = await res.text().catch(() => '')
    throw new AuthHttpError(
      `auth ${route} failed: ${res.status}${detail !== '' ? ` — ${detail}` : ''}`,
      res.status,
    )
  }
  const auth = (await res.json()) as AuthResponse
  setAuthToken(auth.token)
  setRequiresLogin(false)
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

/**
 * Make sure a JWT is available, requesting an anonymous one when
 * needed. Returns false when no API is configured, the network is
 * down, or the account was upgraded and requires an explicit login.
 * Never throws — callers must stay usable offline.
 */
export async function ensureAuth(): Promise<boolean> {
  if (API_BASE_URL == null || API_BASE_URL === '') return false
  if (hasValidToken()) return true
  if (requiresLogin()) return false
  try {
    await postAuth('anonymous', { deviceId: getUserId() })
    return true
  } catch (err) {
    if (err instanceof AuthHttpError && err.status === 403) {
      // Upgraded account signed out — needs an explicit login.
      setRequiresLogin(true)
      console.info('[auth] signed out — log in to sync personal data')
    } else {
      console.warn('[auth] anonymous auth failed:', err)
    }
    return false
  }
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

/** `idToken` is the credential from Google Identity Services. */
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

/** URL that starts the Google sign-in redirect for this device. */
export function googleSignInUrl(): string {
  const returnTo =
    window.location.origin + window.location.pathname + window.location.search
  const params = new URLSearchParams({ deviceId: getUserId(), returnTo })
  return `${requireBaseUrl()}/api/auth/google/start?${params.toString()}`
}

/**
 * Pick up the #gauth / #gauth_error fragment after returning from the
 * Google redirect: store the JWT and strip the fragment from the URL.
 * Runs at app startup, before any other auth call.
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
    googleRedirectResult = { ok: true }
  } else if (error != null && error !== '') {
    googleRedirectResult = { ok: false, error }
  }
  history.replaceState(
    null,
    '',
    window.location.pathname + window.location.search,
  )
}

/** One-shot result of the redirect sign-in, for UI notifications. */
export function takeGoogleRedirectResult(): GoogleRedirectResult | null {
  const result = googleRedirectResult
  googleRedirectResult = null
  return result
}

export function logout(): void {
  const token = getAuthToken()
  const payload = token != null ? decodeToken(token) : null
  // An upgraded device can't fall back to anonymous auth — remember
  // that so ensureAuth() doesn't retry a doomed handshake at startup.
  if (payload != null && payload.provider !== 'anonymous') {
    setRequiresLogin(true)
  }
  setAuthToken(null)
}

/** Current user + profile, or null when not authenticated. */
export async function fetchMe(): Promise<MeResponse | null> {
  const token = getAuthToken()
  if (token == null || token === '') return null
  const res = await fetch(`${requireBaseUrl()}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  return (await res.json()) as MeResponse
}
