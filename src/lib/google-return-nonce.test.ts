// ============================================================
// Google return nonce: only the browser that started a sign-in takes its return
// ============================================================
//
// The rule against login CSRF, at the level where it is decided. A return
// counts when it carries the nonce this browser kept for the sign-in it
// started, once, inside the window. Anything else keeps nothing that could
// sign somebody in or out, and no words of its own.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { beginGoogleReturn, EXPIRED_STATE_CODE, readGoogleReturn, UNSTARTED_RETURN_CODE, } from './google-return-nonce'

const T0 = Date.UTC(2026, 9, 10, 12, 0, 0)
const MINUTE = 60 * 1000

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('beginGoogleReturn', () => {
  it('mints 256 url-safe bits, fresh for every sign-in', () => {
    const first = beginGoogleReturn(T0)
    const second = beginGoogleReturn(T0)

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(second).not.toBe(first)
  })

  it('refuses to start a sign-in whose return it could not recognise', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })

    expect(() => beginGoogleReturn(T0)).toThrow('storage disabled')
  })
})

describe('readGoogleReturn', () => {
  it("takes the session and sign-up flag that come back with this browser's nonce", () => {
    const nonce = beginGoogleReturn(T0)

    const landed = readGoogleReturn(
      `#gauth=tok&gauth_new=1&gauth_nonce=${nonce}`,
      T0 + MINUTE,
    )

    expect(landed).toEqual({
      token: 'tok',
      created: true,
      twofa: null,
      error: null,
      drive: null,
    })
  })

  it('takes a return once: the nonce is spent by the first', () => {
    const nonce = beginGoogleReturn(T0)
    const hash = `#gauth=tok&gauth_nonce=${nonce}`
    readGoogleReturn(hash, T0)

    expect(readGoogleReturn(hash, T0)?.token).toBeNull()
  })

  it('keeps the pending nonce when a different one arrives, for its own return', () => {
    const nonce = beginGoogleReturn(T0)
    readGoogleReturn('#gauth=planted&gauth_nonce=somebody-elses-nonce', T0)

    expect(readGoogleReturn(`#gauth=tok&gauth_nonce=${nonce}`, T0)?.token).toBe(
      'tok',
    )
  })

  it('honours the sign-in started last, and not the one it replaced', () => {
    const earlier = beginGoogleReturn(T0)
    const later = beginGoogleReturn(T0)

    expect(readGoogleReturn(`#gauth=a&gauth_nonce=${earlier}`, T0)?.token).toBe(
      null,
    )
    expect(readGoogleReturn(`#gauth=b&gauth_nonce=${later}`, T0)?.token).toBe(
      'b',
    )
  })

  it("outlasts the worker's ten-minute state, and no more than fifteen", () => {
    const late = beginGoogleReturn(T0)
    expect(
      readGoogleReturn(`#gauth=tok&gauth_nonce=${late}`, T0 + 14 * MINUTE)
        ?.token,
    ).toBe('tok')

    const stale = beginGoogleReturn(T0)
    expect(
      readGoogleReturn(`#gauth=tok&gauth_nonce=${stale}`, T0 + 15 * MINUTE)
        ?.token,
    ).toBeNull()
  })

  it('keeps no session, flag or ceremony from a return nobody started, and says why', () => {
    expect(readGoogleReturn('#gauth=planted&gauth_new=1', T0)).toEqual({
      token: null,
      created: false,
      twofa: null,
      error: UNSTARTED_RETURN_CODE,
      drive: null,
    })
    expect(readGoogleReturn('#gauth_2fa=planted', T0)?.twofa).toBeNull()
    expect(readGoogleReturn('#gauth_2fa=planted', T0)?.error).toBe(
      UNSTARTED_RETURN_CODE,
    )
  })

  it('drops the error of a return nobody started, words and all', () => {
    expect(readGoogleReturn('#gauth_error=account_suspended', T0)?.error).toBe(
      null,
    )
    expect(
      readGoogleReturn('#gauth_error=Your%20account%20is%20locked', T0)?.error,
    ).toBeNull()
  })

  it('reports a bound error as the worker sent it', () => {
    const nonce = beginGoogleReturn(T0)

    expect(
      readGoogleReturn(`#gauth_error=access_denied&gauth_nonce=${nonce}`, T0)
        ?.error,
    ).toBe('access_denied')
  })

  // The worker could not read the state, so it has no nonce to echo, and the
  // code maps to one fixed sentence: nothing a link could misuse.
  it('reports an expired state without a nonce', () => {
    expect(readGoogleReturn('#gauth_error=expired_state', T0)?.error).toBe(
      EXPIRED_STATE_CODE,
    )
  })

  it('reads a connect-Drive outcome, which carries no nonce', () => {
    expect(readGoogleReturn('#gdrive=1', T0)?.drive).toEqual({ ok: true })
    expect(readGoogleReturn('#gdrive_error=declined', T0)?.drive).toEqual({
      ok: false,
      error: 'declined',
    })
  })

  it('leaves an ordinary route alone', () => {
    expect(readGoogleReturn('#/karaoke', T0)).toBeNull()
    expect(readGoogleReturn('', T0)).toBeNull()
  })

  it('refuses rather than throwing when storage cannot be read', () => {
    const nonce = beginGoogleReturn(T0)
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })

    expect(readGoogleReturn(`#gauth=tok&gauth_nonce=${nonce}`, T0)?.token).toBe(
      null,
    )
  })
})
