// ============================================================
// The email-code client: what each caller sends
// ============================================================
//
// The web's pane and the native sheet share these two calls and must not
// share their bodies. Only the sheet asks for a code that can set an account
// up, and only the sheet sends this device's anonymous credential with the
// code; the web's requests are exactly what they were.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/defaults', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  API_BASE_URL: 'http://api.test',
}))

import { requestLoginCode, verifyLoginCode } from './auth-email-code-service'
import { getDeviceSecret, getUserId } from './user-service'

let sent: Record<string, unknown>[] = []

function answer(body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      sent.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )
}

const SESSION = { token: 'h.b.s', userId: 'user-1', isNew: true, user: {} }

beforeEach(() => {
  localStorage.clear()
  sent = []
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('asking for a code', () => {
  it("sends the web pane's request as it always was", async () => {
    answer({ ok: true, ceremony: 'c-1' })

    await requestLoginCode('Singer@Example.test', 'token-1')

    expect(sent).toEqual([
      { email: 'singer@example.test', cfTurnstileToken: 'token-1' },
    ])
  })

  it('asks for a code that can set an account up, when told to', async () => {
    answer({ ok: true, ceremony: 'c-1' })

    await requestLoginCode('singer@example.test', 'token-1', { signUp: true })

    expect(sent[0]?.signUp).toBe(true)
  })
})

describe('spending a code', () => {
  it('sends no device credential unless told to', async () => {
    answer(SESSION)

    await verifyLoginCode('c-1', ' 123456 ')

    expect(sent).toEqual([{ ceremony: 'c-1', code: '123456' }])
  })

  it("sends this device's anonymous credential, when told to", async () => {
    answer(SESSION)

    await verifyLoginCode('c-1', '123456', { proveDevice: true })

    expect(sent[0]).toMatchObject({
      deviceId: getUserId(),
      deviceSecret: getDeviceSecret(),
    })
  })

  it("carries a sign-up's hint for the first mail, when given one", async () => {
    answer(SESSION)
    const hint = { twin: 'Nina Simone', lowMidi: 50, highMidi: 74 }

    await verifyLoginCode('c-1', '123456', {
      proveDevice: true,
      signup: { voiceprintHint: hint },
    })

    expect(sent[0]).toMatchObject({ voiceprintHint: hint })
  })
})
