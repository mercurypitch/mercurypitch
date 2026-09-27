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
import { rememberSignInMethod } from '@/lib/last-sign-in'
import type { AuthResponse, SignInOutcome } from './auth-service'
import { adoptSession, isTwofaChallenge } from './auth-service'
import { getDeviceSecret, getUserId } from './user-service'

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
  options: {
    /**
     * Ask for a code that SETS UP an account when the address has none. The
     * native sheet asks; the web's pane does not, and an address with no
     * account still gets nothing there.
     */
    signUp?: boolean
  } = {},
): Promise<string> {
  const res = await postJson('/api/auth/email-code/request', {
    email: email.trim().toLowerCase(),
    cfTurnstileToken: turnstileToken,
    ...(options.signUp === true ? { signUp: true } : {}),
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
  options: {
    /**
     * Send this device's anonymous credential along. A sign-up code then
     * takes over the device's anonymous account in place, so what it
     * practiced stays with the new account, exactly as signing up with Apple
     * or Google does. A sign-in code ignores it.
     */
    proveDevice?: boolean
  } = {},
): Promise<SignInOutcome> {
  const res = await postJson('/api/auth/email-code/verify', {
    ceremony,
    code: code.trim(),
    ...(options.proveDevice === true
      ? { deviceId: getUserId(), deviceSecret: getDeviceSecret() }
      : {}),
  })
  if (!res.ok) {
    throw new Error(await messageOf(res, 'That code is not valid'))
  }
  const outcome = (await res.json()) as SignInOutcome
  // The mailed code IS the first factor, so the hint is earned here whether or
  // not a second one is still owed. Mirrors postSignIn in auth-service.
  rememberSignInMethod('emailcode')
  // Nothing is stored on a challenge: the code was right and bought nothing
  // until the second factor lands.
  if (isTwofaChallenge(outcome)) return outcome
  adoptSession(outcome as AuthResponse)
  return outcome
}
