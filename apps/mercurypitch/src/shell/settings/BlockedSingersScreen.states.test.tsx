// ============================================================
// Blocked singers, for whoever holds the phone: signed out, a device with
// no account, a suspended account, and a sign-in from the screen
// ============================================================
//
// The flow, the service, the blocked store and the session are real; the
// worker is a stand-in at the network edge, and a sign-in is the token it
// leaves behind.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Defaults from '@/lib/defaults'

vi.mock('@/lib/defaults', async (importOriginal) => ({
  ...(await importOriginal<typeof Defaults>()),
  API_BASE_URL: 'http://api.test',
}))

vi.mock('./sign-in-state', () => ({ openSignIn: vi.fn() }))

import { getAuthToken, setAuthToken } from '@/db/services/user-service'
import { resetBlockedSingersForTests } from '@/stores/blocked-singers-store'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { BlockedSingersScreen } from './BlockedSingersScreen'
import { openSignIn } from './sign-in-state'

function token(sub: string, provider: string): string {
  const body = btoa(
    JSON.stringify({
      sub,
      provider,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `header.${body}.signature`
}

let answers: Array<{ status: number; body?: unknown }> = []
let requests: string[] = []
let view: RenderedShell | null = null

const ADA_AND_BEN = {
  blocks: [
    { userId: 'ada', displayName: 'Ada', createdAt: '2026-11-01T00:00:00Z' },
    { userId: 'ben', displayName: 'Ben', createdAt: '2026-11-01T00:00:00Z' },
  ],
}
const CLEO = {
  blocks: [
    { userId: 'cleo', displayName: 'Cleo', createdAt: '2026-11-01T00:00:00Z' },
  ],
}
const SUSPENDED = {
  status: 403,
  body: { error: 'Suspended', code: 'account_suspended' },
}

const settle = async (): Promise<void> => {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

const q = (selector: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(selector)

const said = (): string =>
  q('[data-testid="blocked-failed"]')?.textContent ?? ''

const names = (): string[] =>
  [...document.querySelectorAll('[data-blocked]')].map(
    (row) =>
      row.querySelector('.mp-set-row__label')?.firstChild?.textContent ?? '',
  )

async function open(): Promise<void> {
  view = renderShell(() => <BlockedSingersScreen />)
  await settle()
}

beforeEach(() => {
  answers = []
  requests = []
  localStorage.clear()
  setAuthToken(null)
  resetBlockedSingersForTests()
  vi.mocked(openSignIn).mockClear()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      requests.push(`${init.method ?? 'GET'} ${new URL(url).pathname}`)
      const next = answers.shift() ?? { status: 500 }
      return Response.json(next.body ?? {}, { status: next.status })
    }),
  )
})

afterEach(() => {
  view?.unmount()
  view = null
  vi.unstubAllGlobals()
  setAuthToken(null)
})

describe('Blocked singers, for whoever holds the phone', () => {
  it('asks a singer signed out to sign in, and reads the list of whoever does', async () => {
    await open()

    expect(said()).toBe(
      'Sign in to see whom you blocked Your blocks are kept with your account.',
    )
    expect(requests).toEqual([])
    const signIn = q('[data-testid="blocked-sign-in"]') as HTMLButtonElement
    signIn.focus()
    signIn.click()
    expect(openSignIn).toHaveBeenCalledTimes(1)

    answers = [{ status: 200, body: ADA_AND_BEN }]
    setAuthToken(token('acc-1', 'apple'))
    await settle()

    expect(requests).toEqual(['GET /api/blocks'])
    expect(names()).toEqual(['Ada', 'Ben'])
    expect(q('[data-testid="blocked-failed"]')).toBeNull()
    // The Sign in went with the sign-in: the focus goes on to the list.
    expect(document.activeElement).toBe(q('[data-unblock="ada"]'))
  })

  it('tells a device with no account that blocking is for registered singers', async () => {
    setAuthToken(token('device-1', 'anonymous'))
    await open()

    expect(said()).toBe(
      'Blocking is for registered singers Sign in or create an account to block a singer and see whom you blocked.',
    )
    expect(q('[data-testid="blocked-sign-in"]')).not.toBeNull()
    expect(requests).toEqual([])
  })

  it('tells a suspended account so, with the contact form and no sign-in', async () => {
    setAuthToken(token('acc-1', 'password'))
    answers = [SUSPENDED]
    await open()

    expect(said()).toBe(
      'This account is suspended A suspended account cannot see or change its blocks. If you think this is a mistake, tell us through the contact form.',
    )
    const contact = new URL(
      q('[data-testid="blocked-contact"]')?.getAttribute('href') ?? '',
    )
    expect(contact.searchParams.get('message')).toBe(
      'About my suspended account:\n\n',
    )
    expect(q('[data-testid="blocked-sign-in"]')).toBeNull()
    expect(q('[data-testid="blocked-retry"]')).toBeNull()
    expect(getAuthToken()).toBeNull()
  })

  it('says so when an unblock finds the account suspended, and shows no list', async () => {
    setAuthToken(token('acc-1', 'password'))
    answers = [{ status: 200, body: ADA_AND_BEN }, SUSPENDED]
    await open()

    q('[data-unblock="ada"]')?.click()
    await settle()

    expect(said()).toContain('This account is suspended')
    expect(names()).toEqual([])
  })

  it('shows one account’s list to nobody else', async () => {
    setAuthToken(token('acc-1', 'apple'))
    answers = [{ status: 200, body: ADA_AND_BEN }]
    await open()
    expect(names()).toEqual(['Ada', 'Ben'])

    setAuthToken(null)
    await settle()
    expect(names()).toEqual([])
    expect(said()).toContain('Sign in to see whom you blocked')

    answers = [{ status: 200, body: CLEO }]
    setAuthToken(token('acc-2', 'google'))
    await settle()
    expect(names()).toEqual(['Cleo'])
  })
})
