// ============================================================
// Auth passkey service — the client for /api/auth/passkey/*
// ============================================================
//
// Each call here is half a WebAuthn ceremony: ask the server for options, hand
// them to the authenticator, send back what it signed. The ceremony token is
// what ties the two halves together, and it never leaves this module.
//
// Nothing in here decides whether to SHOW a passkey control — that needs both
// `available` from the server and a working authenticator in the browser, and
// the caller has to ask for both.

import { API_BASE_URL } from '@/lib/defaults'
import { rememberSignInMethod } from '@/lib/last-sign-in'
import { createCredential, getCredential } from '@/lib/webauthn'
import type { AuthResponse } from './auth-service'
import { adoptSession } from './auth-service'
import { getAuthToken } from './user-service'

export interface Passkey {
  id: string
  name: string
  /** Synced through a provider keychain, so it survives losing the device. */
  backedUp: boolean
  createdAt: string
  lastUsedAt: string | null
}

/** What a stale session may present to prove itself again. */
export type PasskeyProof = 'code' | 'password'

/**
 * Thrown when the server wants the account to prove itself again first.
 *
 * `accepts` is what this particular account CAN present — a Google identity
 * has no password, an account with no authenticator has no code, and one with
 * neither gets an empty list. The caller renders from it rather than assuming,
 * because a field for a proof that cannot exist is a dead end.
 */
export class PasskeyReauthRequired extends Error {
  readonly accepts: PasskeyProof[]

  constructor(message: string, accepts: PasskeyProof[] = []) {
    super(message)
    this.name = 'PasskeyReauthRequired'
    this.accepts = accepts
  }
}

function requireBaseUrl(): string {
  if (API_BASE_URL == null || API_BASE_URL === '') {
    throw new Error('auth-passkey: VITE_API_BASE_URL is not configured')
  }
  return API_BASE_URL
}

function requireToken(): string {
  const token = getAuthToken()
  if (token == null || token === '') throw new Error('Not signed in')
  return token
}

async function messageOf(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string }
    return body.error ?? fallback
  } catch {
    return fallback
  }
}

async function post(
  path: string,
  body: unknown,
  authed = true,
): Promise<Response> {
  return fetch(`${requireBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authed ? { Authorization: `Bearer ${requireToken()}` } : {}),
    },
    body: JSON.stringify(body),
  })
}

interface CeremonyOptions {
  options: Record<string, unknown>
  ceremony: string
}

/** Whether this deployment has an RP id at all. False on PR previews. */
export async function passkeysAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${requireBaseUrl()}/api/auth/passkey/status`)
    if (!res.ok) return false
    return ((await res.json()) as { available: boolean }).available
  } catch {
    return false
  }
}

export async function fetchPasskeys(): Promise<Passkey[]> {
  const res = await fetch(`${requireBaseUrl()}/api/auth/passkey/list`, {
    headers: { Authorization: `Bearer ${requireToken()}` },
  })
  if (!res.ok) throw new Error(await messageOf(res, 'Could not list passkeys'))
  return ((await res.json()) as { passkeys: Passkey[] }).passkeys
}

/**
 * Add a passkey to the signed-in account.
 *
 * `proof` is a TOTP or recovery code, needed only when the session is older
 * than the sudo window — a passkey skips the second-factor challenge and
 * survives a password reset, so minting one from a session that last proved
 * something hours ago would be a weaker gate than the thing it creates.
 * Callers pass nothing first and retry with a code on PasskeyReauthRequired.
 */
export async function addPasskey(proof = ''): Promise<Passkey[]> {
  const start = await post('/api/auth/passkey/register/options', { proof })
  if (start.status === 403) {
    const body = (await start.json().catch(() => ({}))) as {
      error?: string
      accepts?: PasskeyProof[]
    }
    throw new PasskeyReauthRequired(
      body.error ?? 'Confirm it is you before adding a passkey',
      body.accepts ?? [],
    )
  }
  if (!start.ok) {
    throw new Error(await messageOf(start, 'Could not start passkey setup'))
  }
  const { options, ceremony } = (await start.json()) as CeremonyOptions

  const response = await createCredential(options)

  const finish = await post('/api/auth/passkey/register/verify', {
    ceremony,
    response,
  })
  if (!finish.ok) {
    throw new Error(await messageOf(finish, 'Could not add that passkey'))
  }
  return ((await finish.json()) as { passkeys: Passkey[] }).passkeys
}

export async function removePasskey(id: string): Promise<Passkey[]> {
  const res = await post('/api/auth/passkey/delete', { id })
  if (!res.ok) throw new Error(await messageOf(res, 'Could not remove it'))
  return ((await res.json()) as { passkeys: Passkey[] }).passkeys
}

/**
 * Sign in with a passkey, from nothing.
 *
 * No email, no password, and — deliberately — no second-factor challenge
 * afterwards: a user-verified passkey is possession and inherence in one
 * gesture, so it already is multi-factor. That is why this returns a session
 * directly where every other sign-in path returns a union.
 */
export async function signInWithPasskey(): Promise<AuthResponse> {
  const start = await fetch(
    `${requireBaseUrl()}/api/auth/passkey/login/options`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    },
  )
  if (!start.ok) {
    throw new Error(await messageOf(start, 'Passkey sign-in is unavailable'))
  }
  const { options, ceremony } = (await start.json()) as CeremonyOptions

  const response = await getCredential(options)

  const finish = await post(
    '/api/auth/passkey/login/verify',
    { ceremony, response },
    false,
  )
  if (!finish.ok) {
    throw new Error(await messageOf(finish, 'That passkey was not accepted'))
  }
  const auth = (await finish.json()) as AuthResponse
  rememberSignInMethod('passkey')
  adoptSession(auth)
  return auth
}
