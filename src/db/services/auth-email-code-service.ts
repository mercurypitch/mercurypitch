// ============================================================
// Auth email-code service — the client for /api/auth/email-code/*
// ============================================================
//
// Signing in without a password. Two calls: ask for a code, then spend it.
//
// The ceremony token between them is the whole protocol. It is what the server
// remembers instead of session state, and it addresses exactly one mailed code,
// so this module holds it for the caller and hands it straight back — there is
// nothing here to interpret or to store.
//
// Kept out of auth-service.ts for the same reason auth-mfa-service is: that
// file already loads on the first paint of every surface with an account chip,
// and nobody needs this before they ask for a code.

import { API_BASE_URL } from '@/lib/defaults'
import type { AuthResponse, SignInOutcome } from './auth-service'
import { adoptSession, isTwofaChallenge } from './auth-service'

function requireBaseUrl(): string {
  if (API_BASE_URL == null || API_BASE_URL === '') {
    throw new Error('auth-email-code: VITE_API_BASE_URL is not configured')
  }
  return API_BASE_URL
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

async function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(`${requireBaseUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/**
 * Ask for a six-digit code.
 *
 * Succeeds whether or not the address has an account — deliberately, so this
 * endpoint cannot be used to find out which addresses are registered. The
 * caller shows "check your inbox" either way, and there is nothing else honest
 * it could show.
 */
export async function requestLoginCode(
  email: string,
  turnstileToken = '',
): Promise<string> {
  const res = await postJson('/api/auth/email-code/request', {
    email: email.trim().toLowerCase(),
    cfTurnstileToken: turnstileToken,
  })
  if (!res.ok) throw new Error(await messageOf(res, 'Could not send a code'))
  const body = (await res.json()) as { ceremony: string }
  return body.ceremony
}

/**
 * Spend the code.
 *
 * A mailed code proves the inbox, which is one factor. An account with a second
 * factor configured comes back owing a TOTP code, exactly as a password sign-in
 * would — so this returns the same union `loginWithPassword` does, and the
 * caller shows the same pane for it.
 */
export async function verifyLoginCode(
  ceremony: string,
  code: string,
): Promise<SignInOutcome> {
  const res = await postJson('/api/auth/email-code/verify', {
    ceremony,
    code: code.trim(),
  })
  if (!res.ok) {
    throw new Error(await messageOf(res, 'That code is not valid'))
  }
  const outcome = (await res.json()) as SignInOutcome
  // Nothing is stored on a challenge: the code was right and bought nothing
  // until the second factor lands. Mirrors postSignIn in auth-service.
  if (isTwofaChallenge(outcome)) return outcome
  adoptSession(outcome as AuthResponse)
  return outcome
}
