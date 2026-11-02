// ============================================================
// The singer sheet's requests: one at a time, each its own open's, and
// every answer worded
// ============================================================
//
// A second tap on Send, Block or Try again while the first is out asks the
// worker nothing; a request still out when the sheet closes moves nothing
// in the sheet opened next; a suspended account and a server that failed
// are each told so in their own words. The sheet, its flow, the service
// and the blocked store are real; the worker is a stand-in that can hold an
// answer back.

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Defaults from '@/lib/defaults'

vi.mock('@/lib/defaults', async (importOriginal) => ({
  ...(await importOriginal<typeof Defaults>()),
  API_BASE_URL: 'http://api.test',
}))
vi.mock('@/stores/notifications-store', () => ({
  showNotification: vi.fn(),
}))

import { getAuthToken, setAuthToken } from '@/db/services/user-service'
import { resetBlockedSingersForTests } from '@/stores/blocked-singers-store'
import { showNotification } from '@/stores/notifications-store'
import type { SingerSheetSubject } from '@/stores/singer-sheet-store'
import { closeSingerSheet, openSingerSheet } from '@/stores/singer-sheet-store'
import { SingerSheet } from './SingerSheet'

function makeToken(): string {
  const body = btoa(
    JSON.stringify({
      sub: 'me',
      provider: 'password',
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `header.${body}.signature`
}

type Answer = { status: number; body?: unknown } | 'offline'

/** What the stand-in answers next on a path, and the answers held back. */
let answers: Record<string, Answer[]> = {}
let held: Array<() => void> = []
let holding = false
let requests: string[] = []

function answer(path: string, ...next: Answer[]): void {
  answers[path] = [...(answers[path] ?? []), ...next]
}

const onBlocked = vi.fn()
const ADA: SingerSheetSubject = { userId: 'ada', displayName: 'Ada', onBlocked }
const BEN: SingerSheetSubject = { userId: 'ben', displayName: 'Ben' }

const settle = async (): Promise<void> => {
  for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 0))
}

const button = (name: string | RegExp): HTMLElement =>
  screen.getByRole('button', { name })

const title = (): string =>
  screen.getByRole('heading', { level: 2 }).textContent ?? ''

function open(subject: SingerSheetSubject = ADA): void {
  render(() => <SingerSheet onSignIn={vi.fn()} />)
  openSingerSheet(subject)
}

function chooseSpam(): void {
  fireEvent.click(button(/^Report/u))
  fireEvent.click(screen.getByLabelText('Spam'))
}

beforeEach(() => {
  answers = {}
  held = []
  holding = false
  requests = []
  onBlocked.mockClear()
  vi.mocked(showNotification).mockClear()
  localStorage.clear()
  setAuthToken(makeToken())
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const path = new URL(url).pathname
      requests.push(`${init.method ?? 'GET'} ${path}`)
      if (holding) await new Promise<void>((go) => held.push(go))
      const next = answers[path]?.shift() ?? { status: 500 }
      if (next === 'offline') throw new TypeError('Failed to fetch')
      return Response.json(next.body ?? {}, { status: next.status })
    }),
  )
})

afterEach(() => {
  closeSingerSheet()
  resetBlockedSingersForTests()
  cleanup()
  vi.unstubAllGlobals()
  setAuthToken(null)
})

describe('one request at a time', () => {
  it('sends one report for a double tap on Send', async () => {
    answer('/api/reports', { status: 201, body: { id: 'r1' } })
    open()
    chooseSpam()

    fireEvent.click(button('Send report'))
    fireEvent.click(button(/^Sending/u))

    await waitFor(() => expect(title()).toBe('Report sent'))
    expect(requests).toEqual(['POST /api/reports'])
  })

  it('blocks once for a double tap on Block', async () => {
    answer('/api/blocks', { status: 201, body: { blocked: true } })
    open()
    fireEvent.click(button(/^Block/u))

    fireEvent.click(button('Block Ada'))
    fireEvent.click(button(/^Blocking/u))

    await waitFor(() => expect(title()).toBe('Ada is blocked'))
    expect(requests).toEqual(['POST /api/blocks'])
    expect(onBlocked).toHaveBeenCalledTimes(1)
  })

  it('tries again once for a double tap on Try again', async () => {
    answer('/api/reports', 'offline', { status: 201, body: { id: 'r1' } })
    open()
    chooseSpam()
    fireEvent.click(button('Send report'))
    const retry = await waitFor(() => button('Try again'))

    fireEvent.click(retry)
    fireEvent.click(retry)

    await waitFor(() => expect(title()).toBe('Report sent'))
    expect(requests).toEqual(['POST /api/reports', 'POST /api/reports'])
  })
})

describe('a request out when the sheet closes', () => {
  it('moves nothing, and frees nothing, in the sheet opened next', async () => {
    answer('/api/reports', { status: 201, body: { id: 'r1' } })
    answer('/api/blocks', { status: 201, body: { blocked: true } })
    holding = true
    open()
    chooseSpam()
    fireEvent.click(button('Send report'))
    await settle()
    closeSingerSheet()

    openSingerSheet(BEN)
    await settle()
    // A fresh open: its first pane, nothing out.
    expect(title()).toBe('Ben')
    fireEvent.click(button(/^Block/u))
    fireEvent.click(button('Block Ben'))
    await settle()

    held[0]()
    await settle()

    // Ada's report landed: Ben's sheet is where it was, his block still out.
    expect(title()).toBe('Block Ben?')
    fireEvent.click(button(/^Blocking/u))
    await settle()
    expect(requests).toEqual(['POST /api/reports', 'POST /api/blocks'])

    held[1]()
    await waitFor(() => expect(title()).toBe('Ben is blocked'))
  })

  it('still has the board read again for a block that lands after it', async () => {
    answer('/api/blocks', { status: 201, body: { blocked: true } })
    holding = true
    open()
    fireEvent.click(button(/^Block/u))
    fireEvent.click(button('Block Ada'))
    await settle()
    closeSingerSheet()
    openSingerSheet(ADA)
    await settle()

    held[0]()
    await settle()

    expect(onBlocked).toHaveBeenCalledTimes(1)
    expect(title()).toBe('Ada')
  })
})

describe('what the sheet says', () => {
  it('tells a suspended account so, with the contact form and no sign-in', async () => {
    answer('/api/blocks', {
      status: 403,
      body: { error: 'Suspended', code: 'account_suspended' },
    })
    open()
    fireEvent.click(button(/^Block/u))

    fireEvent.click(button('Block Ada'))

    await waitFor(() => expect(title()).toBe('This account is suspended'))
    expect(screen.getByRole('alert').textContent).toBe(
      'A suspended account cannot report or block. If you think this is a mistake, tell us through the contact form.',
    )
    const contact = new URL(
      screen.getByRole('link', { name: 'Contact us' }).getAttribute('href') ??
        '',
    )
    expect(contact.searchParams.get('message')).toBe(
      'About my suspended account:\n\n',
    )
    expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    // Signed out as on every read, and never told its session expired.
    expect(getAuthToken()).toBeNull()
    expect(showNotification).not.toHaveBeenCalled()
  })

  it('tells a server that failed apart from no connection', async () => {
    answer('/api/reports', { status: 502, body: { error: 'Bad gateway' } })
    open()
    chooseSpam()

    fireEvent.click(button('Send report'))

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'MercuryPitch could not answer just now. Try again in a moment.',
      ),
    )
    expect(title()).toBe('Could not send the report')
    expect(button('Try again').textContent).toBe('Try again')
  })
})
