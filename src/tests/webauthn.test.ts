// ── base64url, both ways ─────────────────────────────────────────────
//
// The one part of the browser half that fails silently. A challenge decoded
// with the wrong alphabet still produces bytes, the authenticator still signs
// them, and the server rejects the result with no hint as to why — so the
// round-trip is pinned against known values rather than against itself.

import { describe, expect, it } from 'vitest'
import { base64UrlToBytes, bytesToBase64Url, describeWebAuthnError, passkeysSupported, } from '@/lib/webauthn'

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s)

describe('base64url', () => {
  it('encodes with the URL alphabet and no padding', () => {
    // 0xFB 0xFF exercises both substituted characters: standard base64 gives
    // "+/8=", and a passkey field carrying '+' or '/' is one a server reading
    // it as base64url will decode into different bytes.
    expect(bytesToBase64Url(new Uint8Array([0xfb, 0xff]).buffer)).toBe('-_8')
    expect(bytesToBase64Url(utf8('foobar').buffer as ArrayBuffer)).toBe(
      'Zm9vYmFy',
    )
    expect(bytesToBase64Url(new Uint8Array([]).buffer)).toBe('')
  })

  it('decodes what it encoded, at every padding length', () => {
    for (const text of ['', 'f', 'fo', 'foo', 'foob', 'fooba', 'foobar']) {
      const bytes = utf8(text)
      const encoded = bytesToBase64Url(bytes.buffer as ArrayBuffer)
      expect(encoded).not.toContain('=')
      expect([...base64UrlToBytes(encoded)]).toEqual([...bytes])
    }
  })

  it('decodes the URL alphabet, which is what the server sends', () => {
    expect([...base64UrlToBytes('-_8')]).toEqual([0xfb, 0xff])
  })

  it('survives every byte value', () => {
    const all = new Uint8Array(256)
    for (let i = 0; i < 256; i += 1) all[i] = i
    expect([...base64UrlToBytes(bytesToBase64Url(all.buffer))]).toEqual([
      ...all,
    ])
  })
})

describe('describeWebAuthnError', () => {
  it('reads a cancelled dialog as cancelled', () => {
    // NotAllowedError is what both "you cancelled" and "it timed out" raise.
    // Showing the DOM name verbatim is how a cancel looks like a broken site.
    expect(describeWebAuthnError(new DOMException('', 'NotAllowedError'))).toBe(
      'That was cancelled.',
    )
  })

  it('explains a credential this device already holds', () => {
    expect(
      describeWebAuthnError(new DOMException('', 'InvalidStateError')),
    ).toContain('already has a passkey')
  })

  it('passes an ordinary error through', () => {
    expect(describeWebAuthnError(new Error('Server said no'))).toBe(
      'Server said no',
    )
    expect(describeWebAuthnError('nonsense')).toBe('That did not work.')
  })
})

describe('passkeysSupported', () => {
  it('is false in a browser without the API', () => {
    // jsdom has no PublicKeyCredential, which is exactly the case the guard
    // exists for: no button rather than a button that opens a dialog saying no.
    expect(passkeysSupported()).toBe(false)
  })
})
