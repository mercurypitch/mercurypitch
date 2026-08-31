// ── The ceremony token must fail closed in every direction ───────────
//
// It stands in for server-side state between "prove one more thing" and the
// answer, so every way of getting one wrong has to be a refusal rather than a
// milder outcome. Forged, expired, malformed, minted under another key, or
// minted for a DIFFERENT ceremony — all of them are null, and the caller
// cannot accidentally treat one as less serious than the rest.

import { describe, expect, it } from 'vitest'
import { CEREMONY_TTL, issueCeremony, readCeremony } from './auth-ceremony'

const SECRET = 'ceremony-test-secret'

// base64url by hand rather than through Buffer: the worker tsconfig carries
// the Workers types, not node's, so Buffer does not exist here any more than
// it does in production.
const toBase64Url = (text: string): string =>
  btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const fromBase64Url = (text: string): string =>
  atob(text.replace(/-/g, '+').replace(/_/g, '/'))

describe('issueCeremony / readCeremony', () => {
  it('round-trips the claims', async () => {
    const token = await issueCeremony(SECRET, {
      purpose: '2fa',
      userId: 'user-1',
      provider: 'password',
    })
    const claims = await readCeremony(SECRET, token, '2fa')
    expect(claims?.userId).toBe('user-1')
    expect(claims?.provider).toBe('password')
  })

  it('refuses a token minted for another ceremony', async () => {
    // The purpose is asserted by readCeremony rather than checked by callers
    // afterwards, because "read the claims, then remember to check" is exactly
    // the step that gets skipped. A passkey challenge must never be spendable
    // as a 2FA challenge.
    const token = await issueCeremony(SECRET, {
      purpose: 'webauthn-auth',
      challenge: 'abc',
    })
    expect(await readCeremony(SECRET, token, '2fa')).toBeNull()
    expect(await readCeremony(SECRET, token, 'webauthn-auth')).not.toBeNull()
  })

  it('refuses a token signed with a different key', async () => {
    const token = await issueCeremony('another-secret', {
      purpose: '2fa',
      userId: 'user-1',
      provider: 'password',
    })
    expect(await readCeremony(SECRET, token, '2fa')).toBeNull()
  })

  it('refuses a token whose claims were edited', async () => {
    // The whole point: the holder can read the claims, and cannot change them.
    const token = await issueCeremony(SECRET, {
      purpose: '2fa',
      userId: 'user-1',
      provider: 'password',
    })
    const [payload, mac] = token.split('.')
    const claims = JSON.parse(fromBase64Url(payload as string)) as Record<
      string,
      unknown
    >
    claims.userId = 'somebody-else'
    const forged = `${toBase64Url(JSON.stringify(claims))}.${mac}`
    expect(await readCeremony(SECRET, forged, '2fa')).toBeNull()
  })

  it('refuses an expired token', async () => {
    const token = await issueCeremony(SECRET, {
      purpose: '2fa',
      userId: 'user-1',
      provider: 'password',
    })
    const past = Date.now
    try {
      // Far enough past the TTL that no rounding can save it.
      const later = past() + (CEREMONY_TTL['2fa'] + 60) * 1000
      Date.now = () => later
      expect(await readCeremony(SECRET, token, '2fa')).toBeNull()
    } finally {
      Date.now = past
    }
  })

  it('refuses garbage without throwing', async () => {
    // A malformed token must be indistinguishable from a wrong one: both are
    // a refusal, never a 500. `atob` throws on a bad base64url segment, and
    // that exception reaching the top-level handler would answer 500 on a
    // path a client cannot recover from on its own.
    for (const bad of [
      '',
      'no-dot',
      'a.b.c',
      '.',
      'not!base64.alsonot!',
      'YWJj.', // valid payload, empty signature
      '.YWJj', // empty payload
    ]) {
      expect(await readCeremony(SECRET, bad, '2fa')).toBeNull()
    }
  })

  it('refuses everything when there is no key to verify with', async () => {
    const token = await issueCeremony(SECRET, {
      purpose: '2fa',
      userId: 'user-1',
      provider: 'password',
    })
    expect(await readCeremony(undefined, token, '2fa')).toBeNull()
    expect(await readCeremony('', token, '2fa')).toBeNull()
    expect(await readCeremony(SECRET, undefined, '2fa')).toBeNull()
  })

  it('gives the mailed-code ceremony at least the life of the code', async () => {
    // A ceremony that expired before the code it addresses would refuse a code
    // the email still says is good — an error nobody could act on.
    expect(CEREMONY_TTL.logincode).toBeGreaterThanOrEqual(600)
  })
})
