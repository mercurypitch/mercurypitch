// ── The policy around a passkey, without the ceremony ────────────────
//
// The WebAuthn ceremony itself is @simplewebauthn's job and is exercised by
// its own suite; forging an attestation here would test CBOR, not this code.
// What IS this code's job is everything around it — which domain a credential
// is minted for, what a backwards counter means, and the caps — and each of
// those is a line somebody could quietly change.

import { describe, expect, it } from 'vitest'
import { allowedOrigins, MAX_PASSKEYS_PER_USER, passkeyName, passkeysConfigured, rpIdFor, SUDO_WINDOW_MS, transportsOf, } from './passkeys'
import type { PasskeyRow } from './passkeys'

const DB = null as unknown as D1Database

function row(overrides: Partial<PasskeyRow> = {}): PasskeyRow {
  return {
    id: 'cred-1',
    userId: 'user-1',
    publicKey: 'AAAA',
    counter: 3,
    transports: null,
    deviceName: null,
    backedUp: 0,
    createdAt: '2026-08-31 10:00:00',
    lastUsedAt: null,
    ...overrides,
  }
}

describe('the relying-party identity', () => {
  it('comes from configuration, never from the request', () => {
    // The single most dangerous shortcut available here: deriving the RP id
    // from the API host would mint credentials bound to api.mercurypitch.com
    // that then fail every sign-in from the app origin, silently, and only
    // after somebody has already replaced their password with one.
    expect(rpIdFor({ DB, PASSKEY_RP_ID: 'mercurypitch.com' })).toBe(
      'mercurypitch.com',
    )
    expect(rpIdFor({ DB })).toBeNull()
    expect(rpIdFor({ DB, PASSKEY_RP_ID: '' })).toBeNull()
    expect(rpIdFor({ DB, PASSKEY_RP_ID: '   ' })).toBeNull()
  })

  it('reports itself unconfigured rather than guessing', () => {
    // This is what a *.workers.dev PR preview gets. workers.dev is a public
    // suffix, so there is no RP id to guess at — the honest answer is 503.
    expect(
      passkeysConfigured({ DB, ALLOWED_ORIGINS: 'https://x.workers.dev' }),
    ).toBe(false)
    expect(passkeysConfigured({ DB, PASSKEY_RP_ID: 'localhost' })).toBe(false)
    expect(
      passkeysConfigured({
        DB,
        PASSKEY_RP_ID: 'localhost',
        ALLOWED_ORIGINS: 'http://localhost:3000',
      }),
    ).toBe(true)
  })

  it('reads every origin the app is served from', () => {
    expect(
      allowedOrigins({
        DB,
        ALLOWED_ORIGINS: 'https://mercurypitch.com, http://localhost:3000 ,',
      }),
    ).toEqual(['https://mercurypitch.com', 'http://localhost:3000'])
    expect(allowedOrigins({ DB })).toEqual([])
  })
})

describe('the caps', () => {
  it('bounds passkeys per account', () => {
    // Not tidiness: every stored credential goes into excludeCredentials on
    // the next registration, and authenticators cap how long that list may
    // be — so an unbounded table breaks the owner's own "add" button.
    expect(MAX_PASSKEYS_PER_USER).toBeGreaterThan(1)
    expect(MAX_PASSKEYS_PER_USER).toBeLessThanOrEqual(20)
  })

  it('keeps the sudo window short enough to mean something', () => {
    // Long enough for the post-sign-in nudge, short enough that a session
    // left open on a shared laptop is not a standing offer to mint a
    // credential that outlives the owner's next password change.
    expect(SUDO_WINDOW_MS).toBeLessThanOrEqual(15 * 60 * 1000)
  })
})

describe('transportsOf', () => {
  it('reads the stored JSON array', () => {
    expect(transportsOf(row({ transports: '["internal","hybrid"]' }))).toEqual([
      'internal',
      'hybrid',
    ])
  })

  it('treats missing or corrupt data as "no hint"', () => {
    // A bad hint is worse than none: it points the browser at a device the
    // credential is not on.
    expect(transportsOf(row({ transports: null }))).toBeUndefined()
    expect(transportsOf(row({ transports: 'not json' }))).toBeUndefined()
    expect(transportsOf(row({ transports: '{"a":1}' }))).toBeUndefined()
  })
})

describe('passkeyName', () => {
  it('names the platform, which is the only question the list answers', () => {
    expect(passkeyName('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe(
      'Passkey on iPhone',
    )
    expect(passkeyName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe(
      'Passkey on Mac',
    )
    expect(passkeyName('Mozilla/5.0 (Linux; Android 14)')).toBe(
      'Passkey on Android',
    )
  })

  it('falls back rather than inventing a device', () => {
    expect(passkeyName(null)).toBe('Passkey')
    expect(passkeyName('')).toBe('Passkey')
    expect(passkeyName('curl/8.0')).toBe('Passkey')
  })
})
