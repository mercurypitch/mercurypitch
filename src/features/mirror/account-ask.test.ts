// ============================================================
// Voice Mirror: who is offered an account (owner rule, 11 Oct 2026)
// ============================================================
//
// "Make the account offer, but only if the visitor does not already have an
// account and voiceprints. With an account, no offer. Making another
// voiceprint, offer it." As built: signed in, never; no account, on the first
// voiceprint and every later one; signed out of an account this browser has
// met, never.

import { beforeEach, describe, expect, it, vi } from 'vitest'

/** A worker-shaped session token: only the payload is ever decoded here. */
function token(provider: string, expiresInSeconds = 3600): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds
  const body = btoa(JSON.stringify({ sub: 'user-1', provider, exp }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `h.${body}.s`
}

/** Fresh modules per test: the ask's state and the sign-in note are module
 *  signals, and each case starts from a browser that has met nobody. */
async function load() {
  const auth = await import('@/db/services/auth-service')
  const users = await import('@/db/services/user-service')
  const lastSignIn = await import('@/lib/last-sign-in')
  const nonce = await import('@/lib/google-return-nonce')
  const voiceprints = await import('@/db/services/voiceprint-service')
  const ask = await import('./account-ask')
  return { ask, auth, users, lastSignIn, nonce, voiceprints }
}

const SUMMARY = {
  lowMidi: 48,
  highMidi: 72,
  semitones: 24,
  accuracy: 80,
  steadiness: 85,
}

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  window.history.replaceState(null, '', '/vocal-range-test')
})

describe('who the Mirror asks to make an account', () => {
  it('asks a browser that has never met an account', async () => {
    const { ask } = await load()
    expect(ask.asksForAccount()).toBe(true)
  })

  it('asks again on another voiceprint while there is still no account', async () => {
    const { ask, voiceprints } = await load()
    await voiceprints.saveVoiceprint({
      summary: SUMMARY,
      twin: 'Freddie Mercury',
      source: 'mirror',
    })
    await voiceprints.saveVoiceprint({
      summary: SUMMARY,
      twin: 'Freddie Mercury',
      source: 'mirror',
    })

    expect(voiceprints.loadLocalVoiceprints()).toHaveLength(2)
    expect(ask.asksForAccount()).toBe(true)
  })

  it('asks the anonymous identity a browser gets on its first save', async () => {
    const { ask, users } = await load()
    users.setAuthToken(token('anonymous'))
    expect(ask.asksForAccount()).toBe(true)
  })

  it('never asks while a real account is signed in', async () => {
    const { ask, users } = await load()
    users.setAuthToken(token('google'))
    expect(ask.asksForAccount()).toBe(false)
  })

  it('never asks a browser whose account signed out here', async () => {
    const { ask, auth, users } = await load()
    users.setAuthToken(token('password'))
    auth.logout()

    expect(auth.accountHeld()).toBe(false)
    expect(ask.asksForAccount()).toBe(false)
  })

  it('never asks a browser that remembers how its account signs in', async () => {
    const { ask, lastSignIn } = await load()
    lastSignIn.rememberSignInMethod('google')
    expect(ask.asksForAccount()).toBe(false)
  })

  it("never asks a browser holding a real account's expired session", async () => {
    const { ask, users } = await load()
    users.setAuthToken(token('apple', -3600))
    expect(ask.asksForAccount()).toBe(false)
  })
})

describe('a Google return landing on the Mirror', () => {
  /** The fragment the worker sends back to a sign-in this browser started. */
  async function arrive(
    fragment: string,
  ): Promise<Awaited<ReturnType<typeof load>>> {
    const loaded = await load()
    const started = loaded.nonce.beginGoogleReturn()
    window.history.replaceState(
      null,
      '',
      `/vocal-range-test#${fragment}&gauth_nonce=${started}`,
    )
    loaded.auth.consumeGoogleRedirect()
    loaded.ask.takeGoogleLanding()
    return loaded
  }

  it('loads the dialog to say a session arrived, once', async () => {
    const { ask } = await arrive(`gauth=${token('google')}`)

    expect(ask.hostWanted()).toBe(true)
    expect(ask.takeLanding()).toEqual({ kind: 'result', result: { ok: true } })
    expect(ask.takeLanding()).toBeNull()
  })

  it('loads the dialog for a second factor still owed', async () => {
    const { ask } = await arrive('gauth_2fa=ceremony-1')

    expect(ask.hostWanted()).toBe(true)
    expect(ask.takeLanding()).toEqual({ kind: 'second-factor' })
  })

  it('loads nothing for an ordinary visit', async () => {
    const { ask } = await load()
    ask.takeGoogleLanding()

    expect(ask.hostWanted()).toBe(false)
    expect(ask.takeLanding()).toBeNull()
  })
})

describe("the ask's own state", () => {
  it('a tap asks for the dialog until the dialog answers', async () => {
    const { ask } = await load()
    ask.askForAccount()
    expect([ask.signUpAsked(), ask.hostWanted()]).toEqual([true, true])

    ask.answerAccountAsk()
    expect([ask.signUpAsked(), ask.hostWanted()]).toEqual([false, true])
  })

  it('a dialog that cannot load stands the ask down, and a new tap retries', async () => {
    const { ask } = await load()
    ask.askForAccount()
    ask.hostDidNotLoad()
    expect([ask.signUpAsked(), ask.hostWanted(), ask.hostFailed()]).toEqual([
      false,
      false,
      true,
    ])

    ask.askForAccount()
    expect([ask.signUpAsked(), ask.hostWanted(), ask.hostFailed()]).toEqual([
      true,
      true,
      false,
    ])
  })
})
