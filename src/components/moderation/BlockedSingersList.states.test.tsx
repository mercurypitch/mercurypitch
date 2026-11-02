// ============================================================
// The web's Blocked singers, for whoever holds the browser: signed out, a
// device with no account, a suspended account, and a sign-in from the list
// ============================================================
//
// The flow, the service, the blocked store and the session are real; the
// worker is a stand-in at the network edge, and a sign-in is the token it
// leaves behind.

import { cleanup, render, screen, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Defaults from '@/lib/defaults'
import type * as UiStore from '@/stores/ui-store'

vi.mock('@/lib/defaults', async (importOriginal) => ({
  ...(await importOriginal<typeof Defaults>()),
  API_BASE_URL: 'http://api.test',
}))

vi.mock('@/stores/ui-store', async (importOriginal) => ({
  ...(await importOriginal<typeof UiStore>()),
  openAuthModal: vi.fn(),
}))

import { getAuthToken, setAuthToken } from '@/db/services/user-service'
import { resetBlockedSingersForTests } from '@/stores/blocked-singers-store'
import { openAuthModal } from '@/stores/ui-store'
import { BlockedSingersList } from './BlockedSingersList'

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

const ADA = {
  blocks: [
    { userId: 'ada', displayName: 'Ada', createdAt: '2026-11-01T00:00:00Z' },
  ],
}

/** The words in place of the list, without the button under them. */
const said = (): string =>
  screen.queryByTestId('blocked-failed')?.querySelector('p')?.textContent ?? ''

beforeEach(() => {
  answers = []
  requests = []
  localStorage.clear()
  setAuthToken(null)
  resetBlockedSingersForTests()
  vi.mocked(openAuthModal).mockClear()
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
  cleanup()
  vi.unstubAllGlobals()
  setAuthToken(null)
})

describe('the web’s Blocked singers, for whoever holds the browser', () => {
  it('asks a singer signed out to sign in, and reads the list of whoever does', async () => {
    render(() => <BlockedSingersList />)

    expect(said()).toBe(
      'Sign in to see whom you blocked Your blocks are kept with your account.',
    )
    expect(requests).toEqual([])
    const signIn = screen.getByTestId('blocked-sign-in')
    signIn.focus()
    signIn.click()
    expect(openAuthModal).toHaveBeenCalledWith('login')

    answers = [{ status: 200, body: ADA }]
    setAuthToken(token('acc-1', 'password'))

    const unblock = await waitFor(() =>
      screen.getByRole('button', { name: 'Unblock Ada' }),
    )
    expect(requests).toEqual(['GET /api/blocks'])
    await waitFor(() => expect(document.activeElement).toBe(unblock))
  })

  it('tells a device with no account that blocking is for registered singers', () => {
    setAuthToken(token('device-1', 'anonymous'))
    render(() => <BlockedSingersList />)

    expect(said()).toBe(
      'Blocking is for registered singers Sign in or create an account to block a singer and see whom you blocked.',
    )
    expect(screen.getByTestId('blocked-sign-in').textContent).toBe('Sign in')
    expect(requests).toEqual([])
  })

  it('tells a suspended account so, with the contact form and no sign-in', async () => {
    setAuthToken(token('acc-1', 'password'))
    answers = [
      { status: 403, body: { error: 'Suspended', code: 'account_suspended' } },
    ]
    render(() => <BlockedSingersList />)

    await waitFor(() => expect(said()).toContain('This account is suspended'))
    expect(said()).toBe(
      'This account is suspended A suspended account cannot see or change its blocks. If you think this is a mistake, tell us through the contact form.',
    )
    const contact = screen.getByRole('link', { name: 'Contact us' })
    expect(
      new URL(contact.getAttribute('href') ?? '').searchParams.get('message'),
    ).toBe('About my suspended account:\n\n')
    expect(screen.queryByTestId('blocked-sign-in')).toBeNull()
    expect(screen.queryByTestId('blocked-retry')).toBeNull()
    expect(getAuthToken()).toBeNull()
  })

  it('says what a server that failed says, and offers to try again', async () => {
    setAuthToken(token('acc-1', 'password'))
    answers = [{ status: 503, body: { error: 'Unavailable' } }]
    render(() => <BlockedSingersList />)

    await waitFor(() =>
      expect(said()).toBe(
        'Could not load the singers you blocked. MercuryPitch could not answer just now. Try again in a moment.',
      ),
    )
    expect(screen.getByTestId('blocked-retry').textContent).toBe('Try again')
  })
})
