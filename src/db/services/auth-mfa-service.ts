// ============================================================
// Auth MFA Service — the client for /api/auth/2fa/*
// ============================================================
//
// Two halves that barely touch: enrollment, which needs a session and lives in
// settings, and the sign-in challenge, which has NO session and holds a
// ceremony token instead.
//
// Kept out of auth-service.ts, which is already 40 KB and loads on the first
// paint of every surface with an account chip. Nobody needs this before they
// open settings or meet a challenge.

import { API_BASE_URL } from '@/lib/defaults'
import type { AuthResponse } from './auth-service'
import { adoptSession } from './auth-service'
import { getAuthToken } from './user-service'

export interface TwofaStatus {
  enabled: boolean
  recoveryCodesLeft: number
  /** False when the environment has no TOTP_KEK: the feature is off here. */
  available: boolean
}

export interface TwofaSetup {
  /** The base32 secret, for someone typing it in by hand. */
  secret: string
  /** The otpauth:// payload behind the QR code. */
  otpauthUri: string
}

function requireBaseUrl(): string {
  if (API_BASE_URL == null || API_BASE_URL === '') {
    throw new Error('auth-mfa: VITE_API_BASE_URL is not configured')
  }
  return API_BASE_URL
}

function requireToken(): string {
  const token = getAuthToken()
  if (token == null || token === '') throw new Error('Not signed in')
  return token
}

/** The server's `{"error": …}` sentence, which is written to be shown as-is. */
async function messageOf(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string }
    return body.error ?? fallback
  } catch {
    return fallback
  }
}

async function authedJson(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`${requireBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${requireToken()}`,
      ...(init.headers as Record<string, string>),
    },
  })
}

// ── Enrollment (needs a session) ─────────────────────────────────────

export async function fetchTwofaStatus(): Promise<TwofaStatus> {
  const res = await authedJson('/api/auth/2fa/status')
  if (!res.ok) throw new Error(await messageOf(res, 'Could not read 2FA state'))
  return (await res.json()) as TwofaStatus
}

/** Mint a pending secret. Nothing is demanded of anyone until it is confirmed. */
export async function startTwofaSetup(): Promise<TwofaSetup> {
  const res = await authedJson('/api/auth/2fa/setup', {
    method: 'POST',
    body: '{}',
  })
  if (!res.ok)
    throw new Error(await messageOf(res, 'Could not start 2FA setup'))
  return (await res.json()) as TwofaSetup
}

/**
 * Confirm a code and turn 2FA on. Returns the recovery codes, which exist in
 * readable form exactly once — the server keeps only their hashes, so a
 * caller that drops them cannot ask for them again.
 *
 * This also signs out every OTHER device: any session predating enrollment got
 * in on a single factor.
 */
export async function enableTwofa(code: string): Promise<string[]> {
  const res = await authedJson('/api/auth/2fa/enable', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
  if (!res.ok) throw new Error(await messageOf(res, 'That code did not match'))
  const body = (await res.json()) as { recoveryCodes: string[] }
  return body.recoveryCodes
}

/** Turn 2FA off. Needs a current code or one recovery code. */
export async function disableTwofa(code: string): Promise<void> {
  const res = await authedJson('/api/auth/2fa/disable', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
  if (!res.ok) throw new Error(await messageOf(res, 'That code did not match'))
}

// ── The sign-in challenge (no session yet) ───────────────────────────

/**
 * Trade a code for the session the password (or Google, or a mailed code)
 * did not buy on its own.
 *
 * `code` is either the six digits from the authenticator app or one recovery
 * code; the server decides which by its shape, so the field takes both and the
 * UI does not have to ask which one someone is holding.
 */
export async function verifyTwofa(
  ceremony: string,
  code: string,
): Promise<AuthResponse> {
  const res = await fetch(`${requireBaseUrl()}/api/auth/2fa/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ceremony, code: code.trim() }),
  })
  if (!res.ok) throw new Error(await messageOf(res, 'That code did not match'))
  const auth = (await res.json()) as AuthResponse
  // The session is this module's only side effect on global state, and it
  // goes through auth-service so the token, the requires-login flag and the
  // reactive auth stamp all move together.
  adoptSession(auth)
  return auth
}
