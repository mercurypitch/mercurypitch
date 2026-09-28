// ── Play review access, from the phone ──
//
// Google Play's reviewers cannot buy, so Play Console's "App access" field
// gives them a code, and the Android app's Settings takes it: the server
// grants a few songs for it, once per account
// (workers/db-worker/src/review-access.ts). The code is typed by a person;
// the server forgives case and dashes, and says whether it was the one.
//
// Android only. The Settings row is drawn on Android alone, and the server
// refuses every other origin as well (App Store guideline 3.1.1).
//
// Part of the Karaoke room's Stage 2 (vite.config.ts KARAOKE_STAGE_2): a store
// build that does not import songs carries none of this.

import { requireAuth } from '@/db/services/auth-service'
import { getAuthHeaders } from '@/db/services/user-service'
import { API_BASE_URL } from '@/lib/defaults'

export type ReviewAccessOutcome =
  /** The songs are the account's now. */
  | { readonly kind: 'granted'; readonly songs: number }
  /** This account had them already; nothing more was granted. */
  | { readonly kind: 'already' }
  /** Nothing was granted, and the singer is told why. */
  | { readonly kind: 'refused'; readonly why: string }

function refusal(status: number): string {
  switch (status) {
    case 403:
      return 'That code is not right.'
    case 429:
      return 'Too many tries. Try again in an hour.'
    case 409:
      return 'Review access is used up.'
    case 501:
      return 'Review access is not available yet.'
    default:
      return 'The code could not be checked. Try again.'
  }
}

/** Ask the server to grant the songs `code` stands for. Never throws. */
export async function redeemReviewAccess(
  code: string,
  base: string | undefined = API_BASE_URL,
): Promise<ReviewAccessOutcome> {
  const api = (base ?? '').replace(/\/+$/u, '')
  if (api === '') {
    return { kind: 'refused', why: 'Review access is not available yet.' }
  }
  try {
    // A reviewer on a fresh install has no identity yet: this gives the
    // phone its anonymous one, which is all the grant needs.
    await requireAuth().catch(() => false)
    const response = await fetch(`${api}/api/billing/review-access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ code }),
    })
    if (!response.ok) return { kind: 'refused', why: refusal(response.status) }
    const body = (await response.json().catch(() => ({}))) as {
      granted?: unknown
      already?: unknown
    }
    if (body.already === true) return { kind: 'already' }
    const songs = Number(body.granted)
    return Number.isInteger(songs) && songs > 0
      ? { kind: 'granted', songs }
      : { kind: 'refused', why: refusal(0) }
  } catch {
    return {
      kind: 'refused',
      why: 'The server could not be reached. Try again.',
    }
  }
}

/** What Settings says after a redeem. */
export function reviewAccessLine(outcome: ReviewAccessOutcome): string {
  switch (outcome.kind) {
    case 'granted':
      return outcome.songs === 1
        ? '1 song is yours.'
        : `${outcome.songs} songs are yours.`
    case 'already':
      return 'This account has its review songs already.'
    case 'refused':
      return outcome.why
  }
}
