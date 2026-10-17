// ============================================================
// Drive Connect Service — client for the db-worker /api/auth/drive endpoints
// ============================================================
//
// Google Drive is the sync transport. Drive access rides the same redirect
// flow as sign-in, with scope=drive asked for only when the user turns Drive
// sync on (incremental authorization — a pending Google review of the scope
// must never break plain sign-in). The worker keeps the refresh token; the
// browser asks it for short-lived access tokens and talks to googleapis.com
// itself, so song audio still never touches our servers.
//
// Split out of auth-service.ts, which keeps the redirect plumbing: the
// one-shot outcome of a connect redirect is recorded there by
// consumeGoogleRedirect() and taken by the settings page. This module
// imports from auth-service one way only, so the two cannot form a cycle.

import type { DriveConnectResult } from './auth-service'
import { requireBaseUrl, RETURN_HASH_KEY } from './auth-service'
import { getAuthToken } from './user-service'

/**
 * Commit a sealed Drive grant from a connect redirect.
 *
 * The callback hands back the grant rather than storing it, because that
 * callback runs in whichever browser finished Google's consent — which may
 * not be the one that started the connect. This authenticated POST is what
 * ties the grant to the signed-in account: the worker stores it only when
 * this account is the one the connect was started for, so a grant that landed
 * in the wrong browser cannot attach a Drive to someone else's account.
 */
export async function finishDriveConnect(
  pending: string,
): Promise<DriveConnectResult> {
  const token = getAuthToken()
  if (token == null || token === '') return { ok: false, error: 'signed_out' }
  let res: Response
  try {
    res = await fetch(`${requireBaseUrl()}/api/auth/drive/finish`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pending }),
    })
  } catch {
    return { ok: false, error: 'offline' }
  }
  return res.ok ? { ok: true } : { ok: false, error: 'finish_failed' }
}

/**
 * Begin the connect-Google-Drive redirect, and go.
 *
 * Authenticated POST rather than a plain link: the worker has to know
 * WHICH account is asking before the browser leaves, because a top-level
 * navigation carries no Authorization header. Working it out afterwards
 * from whichever Google identity came back is how connecting a Drive
 * would sign somebody into a different account — and choosing a Google
 * account other than the one you signed up with is the normal case, not
 * a mistake.
 */
export async function startDriveConnect(): Promise<{
  ok: boolean
  error?: string
}> {
  const token = getAuthToken()
  if (token == null || token === '') return { ok: false, error: 'signed_out' }
  const returnTo =
    window.location.origin + window.location.pathname + window.location.search
  let res: Response
  try {
    res = await fetch(`${requireBaseUrl()}/api/auth/drive/start`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ returnTo }),
    })
  } catch {
    return { ok: false, error: 'offline' }
  }
  if (!res.ok) return { ok: false, error: 'start_failed' }
  const data = (await res.json()) as { url?: string }
  if (data.url == null || data.url === '') {
    return { ok: false, error: 'start_failed' }
  }
  // Only now, once there is somewhere to go: stashing the hash and then
  // failing would restore a route on the next unrelated redirect.
  localStorage.setItem(RETURN_HASH_KEY, window.location.hash)
  window.location.href = data.url
  return { ok: true }
}

/**
 * Whether Drive is connected — with "could not ask" kept separate.
 *
 * An expired session, a 500 or an offline device are not "you have no
 * Drive": answering `connected: false` to those is what makes a settings
 * page offer to connect a Drive that is already connected.
 */
export type DriveStatus =
  | { known: true; connected: boolean; email?: string }
  | { known: false }

export async function fetchDriveStatus(): Promise<DriveStatus> {
  const token = getAuthToken()
  if (token == null || token === '') return { known: true, connected: false }
  let res: Response
  try {
    res = await fetch(`${requireBaseUrl()}/api/auth/drive/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    return { known: false }
  }
  if (!res.ok) return { known: false }
  const data = (await res.json()) as { connected?: boolean; email?: string }
  return {
    known: true,
    connected: data.connected === true,
    ...(data.email != null ? { email: data.email } : {}),
  }
}

export type DriveAccessToken =
  | { ok: true; accessToken: string; expiresIn: number }
  | { ok: false; reason: 'disconnected' | 'failed' }

/**
 * A short-lived Drive access token, minted by the worker from the stored
 * refresh token. 410 means the grant is gone (revoked on Google's side or
 * never stored) — the caller should surface "reconnect", not retry.
 */
export async function fetchDriveAccessToken(): Promise<DriveAccessToken> {
  const token = getAuthToken()
  if (token == null || token === '') return { ok: false, reason: 'failed' }
  const res = await fetch(`${requireBaseUrl()}/api/auth/drive/token`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 410) return { ok: false, reason: 'disconnected' }
  if (!res.ok) return { ok: false, reason: 'failed' }
  const data = (await res.json()) as {
    accessToken?: string
    expiresIn?: number
  }
  if (data.accessToken == null || data.accessToken === '') {
    return { ok: false, reason: 'failed' }
  }
  return {
    ok: true,
    accessToken: data.accessToken,
    expiresIn: data.expiresIn ?? 3600,
  }
}

/** Disconnect Drive: the worker revokes what it can and forgets the key. */
export async function disconnectDrive(): Promise<boolean> {
  const token = getAuthToken()
  if (token == null || token === '') return false
  const res = await fetch(`${requireBaseUrl()}/api/auth/drive`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.ok
}
