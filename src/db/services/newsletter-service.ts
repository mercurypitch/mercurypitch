// ============================================================
// Newsletter Service — the product-updates checkbox
// ============================================================
//
// One call, because there is one answer to store. The value itself arrives
// with `/api/auth/me` (`user.newsletterOptIn`), so nothing here reads it back:
// the caller re-fetches the profile and renders what the server kept, which
// is the only way a checkbox about consent can be trusted to show the truth.
//
// The consent lives on the account row, not in a mailing list held elsewhere.
// See docs/plans/newsletter-registered-users.md for why, and
// workers/db-worker/src/newsletter-consent.ts for the column.
//
// Kept out of auth-service.ts, which is already 50 KB and loads on the first
// paint of every surface with an account chip. Nobody needs this before they
// open their settings.

import { API_BASE_URL } from '@/lib/defaults'
import { getAuthToken } from './user-service'

/**
 * Say yes or no to product updates.
 *
 * Throws on anything but a 2xx, which is what lets the caller snap the
 * checkbox back to the stored value instead of leaving it showing a consent
 * the server never accepted.
 */
export async function setNewsletterOptIn(optIn: boolean): Promise<void> {
  const base = API_BASE_URL
  const token = getAuthToken()
  if (base == null || base === '') {
    throw new Error('newsletter: VITE_API_BASE_URL is not configured')
  }
  if (token == null || token === '') throw new Error('Not signed in')

  const res = await fetch(`${base}/api/newsletter/preference`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ optIn }),
  })
  if (!res.ok) {
    throw new Error(
      optIn
        ? 'Could not turn product updates on'
        : 'Could not turn product updates off',
    )
  }
}
