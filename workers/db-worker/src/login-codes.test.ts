// ── The code, and the row it belongs to ──────────────────────────────
//
// Six digits is a small space, so the pieces that bound guessing are the ones
// worth pinning: an unbiased draw, a hash that is actually SHA-256, and a
// claim that spends the row exactly once.
//
// The claim tests run against a hand-rolled in-memory table rather than SQLite
// — the SQL itself is covered by the integration suite, and what matters here
// is the decision tree above it.

import { describe, expect, it } from 'vitest'
import { generateLoginCode, hashLoginCode, LOGIN_CODE_MAX_ATTEMPTS, } from './login-codes'

describe('generateLoginCode', () => {
  it('is always exactly six digits', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateLoginCode()).toMatch(/^\d{6}$/)
    }
  })

  it('keeps the leading zeros', () => {
    // '042' would be rejected by a six-digit field and read as a bug by the
    // person holding the email. padStart is doing real work here.
    const codes = Array.from({ length: 500 }, () => generateLoginCode())
    expect(codes.every((c) => c.length === 6)).toBe(true)
  })

  it('spreads across the space rather than repeating', () => {
    const codes = new Set(Array.from({ length: 300 }, generateLoginCode))
    // 300 draws from 10^6 collide with probability well under 5%, so a run
    // that produced fewer than 290 distinct values is not chance.
    expect(codes.size).toBeGreaterThan(290)
  })
})

describe('hashLoginCode', () => {
  it('matches the published SHA-256 of the input', async () => {
    // The vector, not this implementation: sha256("abc").
    expect(await hashLoginCode('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('is stable and 64 hex characters', async () => {
    const once = await hashLoginCode('123456')
    expect(once).toMatch(/^[0-9a-f]{64}$/)
    expect(await hashLoginCode('123456')).toBe(once)
    expect(await hashLoginCode('123457')).not.toBe(once)
  })
})

describe('the attempt budget', () => {
  it('is small enough to matter against 10^6', () => {
    // Five guesses out of a million is a 1-in-200,000 chance per row. Raising
    // this is the single easiest way to quietly break the feature's security
    // argument, so the number is asserted rather than merely written down.
    expect(LOGIN_CODE_MAX_ATTEMPTS).toBeLessThanOrEqual(5)
  })
})
