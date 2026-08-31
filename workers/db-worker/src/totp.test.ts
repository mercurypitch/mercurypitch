// ── TOTP against the published vectors ───────────────────────────────
//
// A homegrown TOTP that is subtly wrong fails in the worst possible way: it
// works perfectly in every test written against itself, and then produces
// codes no authenticator app agrees with. So the codes here come from RFC 6238
// Appendix B and RFC 4226 Appendix D — from the specification, not from this
// implementation — and the base32 vectors from RFC 4648 §10.

import { describe, expect, it } from 'vitest'
import { base32Decode, base32Encode, currentStep, generateTotpSecret, otpauthUri, totpCode, verifyTotp, } from './totp'

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s)

/**
 * RFC 6238's shared secret is the ASCII string "12345678901234567890"; the
 * spec states it as bytes, and an authenticator takes it as base32.
 */
const RFC_SECRET = base32Encode(utf8('12345678901234567890'))

describe('base32 (RFC 4648)', () => {
  it('matches the published vectors', () => {
    expect(base32Encode(utf8(''))).toBe('')
    expect(base32Encode(utf8('f'))).toBe('MY')
    expect(base32Encode(utf8('fo'))).toBe('MZXQ')
    expect(base32Encode(utf8('foo'))).toBe('MZXW6')
    expect(base32Encode(utf8('foob'))).toBe('MZXW6YQ')
    expect(base32Encode(utf8('fooba'))).toBe('MZXW6YTB')
    expect(base32Encode(utf8('foobar'))).toBe('MZXW6YTBOI')
  })

  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255, 42, 17])
    expect([...base32Decode(base32Encode(bytes))]).toEqual([...bytes])
  })

  it('accepts what people actually paste', () => {
    // Authenticator apps display secrets in lowercase, in spaced groups, and
    // some pad with '='. Refusing any of those turns a correct paste into a
    // support request.
    const expected = [...base32Decode('MZXW6YTBOI')]
    expect([...base32Decode('mzxw6ytboi')]).toEqual(expected)
    expect([...base32Decode('MZXW 6YTB OI')]).toEqual(expected)
    expect([...base32Decode('MZXW6YTBOI======')]).toEqual(expected)
  })

  it('refuses a character that is not in the alphabet', () => {
    // '1', '8' and '9' are deliberately absent from RFC 4648 base32, so a
    // secret containing one was mistyped and must not silently decode.
    expect(() => base32Decode('MZXW6YTB1I')).toThrow(/Invalid base32/)
  })
})

describe('totpCode (RFC 6238 Appendix B)', () => {
  // The RFC tabulates codes at fixed unix times for SHA-1. These are the
  // 8-digit values it prints; the last six are what a 6-digit app shows.
  const VECTORS: [number, string][] = [
    [59, '287082'],
    [1_111_111_109, '081804'],
    [1_111_111_111, '050471'],
    [1_234_567_890, '005924'],
    [2_000_000_000, '279037'],
    [20_000_000_000, '353130'],
  ]

  it.each(VECTORS)('unix %i produces %s', async (unixSeconds, expected) => {
    const step = currentStep(unixSeconds * 1000)
    expect(await totpCode(RFC_SECRET, step)).toBe(expected)
  })

  it('matches HOTP at counter zero (RFC 4226 Appendix D)', () => {
    // TOTP is HOTP with a time-derived counter, so the HOTP vectors pin the
    // truncation exactly the same way.
    return expect(totpCode(RFC_SECRET, 0)).resolves.toBe('755224')
  })
})

describe('verifyTotp', () => {
  const NOW = 1_111_111_111_000

  it('accepts the current code', async () => {
    const step = currentStep(NOW)
    const code = await totpCode(RFC_SECRET, step)
    expect(await verifyTotp(RFC_SECRET, code, { nowMs: NOW })).toBe(step)
  })

  it('tolerates one step of clock drift either way', async () => {
    // Phones and servers disagree by a few seconds all the time. Refusing
    // that would reject correct codes for no security gain worth having.
    const step = currentStep(NOW)
    for (const offset of [-1, 0, 1]) {
      const code = await totpCode(RFC_SECRET, step + offset)
      expect(await verifyTotp(RFC_SECRET, code, { nowMs: NOW })).toBe(
        step + offset,
      )
    }
  })

  it('refuses a code two steps away', async () => {
    const step = currentStep(NOW)
    const code = await totpCode(RFC_SECRET, step + 2)
    expect(await verifyTotp(RFC_SECRET, code, { nowMs: NOW })).toBeNull()
  })

  it('will not reuse a code that was already spent', async () => {
    // The anti-replay rule: a code read over someone's shoulder must buy
    // nothing, even during the thirty seconds it would otherwise be valid.
    const step = currentStep(NOW)
    const code = await totpCode(RFC_SECRET, step)
    expect(await verifyTotp(RFC_SECRET, code, { nowMs: NOW })).toBe(step)
    expect(
      await verifyTotp(RFC_SECRET, code, { nowMs: NOW, minStep: step + 1 }),
    ).toBeNull()
    // And the NEXT code still works, so the rule costs the owner nothing.
    const next = await totpCode(RFC_SECRET, step + 1)
    expect(
      await verifyTotp(RFC_SECRET, next, { nowMs: NOW, minStep: step + 1 }),
    ).toBe(step + 1)
  })

  it('refuses anything that is not six digits, without touching crypto', async () => {
    for (const bad of ['', '12345', '1234567', 'abcdef', '12 34 56', '12345a'])
      expect(await verifyTotp(RFC_SECRET, bad, { nowMs: NOW })).toBeNull()
  })
})

describe('the enrollment payload', () => {
  it('generates a 160-bit secret', () => {
    // RFC 4226 asks for at least 128 bits; 160 is the SHA-1 block-matched
    // size every authenticator handles. 20 bytes is 32 base32 characters.
    const secret = generateTotpSecret()
    expect(secret).toMatch(/^[A-Z2-7]{32}$/)
    expect(base32Decode(secret)).toHaveLength(20)
    expect(generateTotpSecret()).not.toBe(secret)
  })

  it('builds an otpauth URI an app can scan', () => {
    const uri = otpauthUri('JBSWY3DPEHPK3PXP', 'singer@example.com', 'Mercury')
    expect(uri).toContain('otpauth://totp/Mercury:singer%40example.com?')
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP')
    expect(uri).toContain('issuer=Mercury')
    // Stated explicitly rather than left to the app's defaults: an app that
    // guesses differently produces codes that never match.
    expect(uri).toContain('algorithm=SHA1')
    expect(uri).toContain('digits=6')
    expect(uri).toContain('period=30')
  })

  it('escapes an address that would otherwise break the label', () => {
    const uri = otpauthUri('JBSWY3DPEHPK3PXP', 'a:b/c@example.com', 'My App')
    expect(uri).toContain('otpauth://totp/My%20App:a%3Ab%2Fc%40example.com?')
  })
})
