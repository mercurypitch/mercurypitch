// ============================================================
// The singer sheet: Report and Block, every pane, against the worker's
// answers
// ============================================================
//
// The sheet, its flow, the service and the blocked store are all real here;
// only the network is a stand-in, answering as the worker does
// (reports-and-blocks-integration.test.ts pins what the worker answers).

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Defaults from '@/lib/defaults'

vi.mock('@/lib/defaults', async (importOriginal) => ({
  ...(await importOriginal<typeof Defaults>()),
  API_BASE_URL: 'http://api.test',
}))

import { getAuthToken, setAuthToken } from '@/db/services/user-service'
import { blockedSingerIds, resetBlockedSingersForTests, } from '@/stores/blocked-singers-store'
import type { SingerSheetSubject } from '@/stores/singer-sheet-store'
import { closeSingerSheet, openSingerSheet, singerSheetSubject, } from '@/stores/singer-sheet-store'
import { SingerSheet } from './SingerSheet'

function makeToken(provider: string): string {
  const payload = {
    sub: 'me',
    provider,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `header.${body}.signature`
}

type Answer = { status: number; body?: unknown } | 'offline'

/** What the stand-in worker answers next, by path. */
let answers: Record<string, Answer[]> = {}
let requests: Array<{ method: string; path: string; body: unknown }> = []

function answer(path: string, ...next: Answer[]): void {
  answers[path] = [...(answers[path] ?? []), ...next]
}

const onSignIn = vi.fn()
const onBlocked = vi.fn()

const ADA: SingerSheetSubject = {
  userId: 'ada',
  displayName: 'Ada',
  onBlocked,
}

const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

function open(subject: SingerSheetSubject = ADA): void {
  render(() => <SingerSheet onSignIn={onSignIn} />)
  openSingerSheet(subject)
}

const button = (name: string | RegExp): HTMLElement =>
  screen.getByRole('button', { name })

beforeEach(() => {
  answers = {}
  requests = []
  onSignIn.mockClear()
  onBlocked.mockClear()
  localStorage.clear()
  setAuthToken(makeToken('password'))
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const path = new URL(url).pathname
      requests.push({
        method: init.method ?? 'GET',
        path,
        body:
          init.body === undefined ? undefined : JSON.parse(String(init.body)),
      })
      const next = answers[path]?.shift() ?? { status: 500 }
      if (next === 'offline') throw new TypeError('Failed to fetch')
      return new Response(JSON.stringify(next.body ?? {}), {
        status: next.status,
        headers: { 'Content-Type': 'application/json' },
      })
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

describe('the singer sheet', () => {
  it('opens on the singer, offering Report and Block', () => {
    open()

    expect(
      screen.getByRole('dialog', { name: 'Report or block Ada' }),
    ).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Ada')
    expect(button(/^Report/u).textContent).toContain(
      'We read every report within a day.',
    )
    expect(button(/^Block/u).textContent).toContain(
      "You will not see each other's names or posts.",
    )
  })

  it('asks a reason from the worker’s own list, in plain words, and counts the note', () => {
    open()
    fireEvent.click(button(/^Report/u))

    const reasons = screen
      .getAllByRole('radio')
      .map((radio) => radio.closest('label')?.textContent)
    expect(reasons).toEqual([
      'Offensive name or words',
      'Bullying or harassment',
      'Sexual content',
      'Spam',
      'Pretending to be someone else',
      'Something else',
    ])
    const send = button('Send report') as HTMLButtonElement
    expect(send.disabled).toBe(true)
    const note = screen.getByLabelText(/Anything else we should know/u)
    expect(note.getAttribute('maxlength')).toBe('500')
    expect(screen.getByText('0 of 500')).toBeTruthy()

    fireEvent.input(note, { target: { value: 'Rude' } })
    fireEvent.click(screen.getByLabelText('Spam'))

    expect(screen.getByText('4 of 500')).toBeTruthy()
    expect(send.disabled).toBe(false)
  })

  it('sends what the singer wrote, thanks them, and offers the contact form', async () => {
    answer('/api/reports', { status: 201, body: { id: 'r1', status: 'open' } })
    open()
    fireEvent.click(button(/^Report/u))
    fireEvent.click(screen.getByLabelText('Offensive name or words'))
    fireEvent.input(screen.getByLabelText(/Anything else/u), {
      target: { value: '  The name  ' },
    })

    fireEvent.click(button('Send report'))

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
        'Report sent',
      ),
    )
    expect(requests).toEqual([
      {
        method: 'POST',
        path: '/api/reports',
        body: {
          targetKind: 'user',
          targetId: 'ada',
          reason: 'offensive',
          note: 'The name',
        },
      },
    ])
    expect(screen.getByTestId('singer-sent').textContent).toBe(
      'Thanks. We read every report within a day.',
    )
    const contact = new URL(
      screen.getByRole('link', { name: 'Contact us' }).getAttribute('href') ??
        '',
    )
    expect(contact.searchParams.get('topic')).toBe('support')
    expect(contact.searchParams.get('message')).toContain(
      'About a report on Ada (user ada)',
    )
  })

  it('says so when the singer had reported it already', async () => {
    answer('/api/reports', { status: 200, body: { status: 'open' } })
    open()
    fireEvent.click(button(/^Report/u))
    fireEvent.click(screen.getByLabelText('Spam'))

    fireEvent.click(button('Send report'))

    await waitFor(() =>
      expect(screen.getByTestId('singer-sent').textContent).toContain(
        'You reported this already',
      ),
    )
  })

  it('says what a block does before it blocks, hides the singer, and has the board read again', async () => {
    answer('/api/blocks', { status: 201, body: { blocked: true } })
    open()
    fireEvent.click(button(/^Block/u))
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
      'Block Ada?',
    )
    expect(document.body.textContent).toContain(
      "You will not see each other's names or posts. You can unblock them in Settings, Blocked singers.",
    )

    fireEvent.click(button('Block Ada'))

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
        'Ada is blocked',
      ),
    )
    expect(requests).toEqual([
      { method: 'POST', path: '/api/blocks', body: { userId: 'ada' } },
    ])
    expect([...blockedSingerIds()]).toEqual(['ada'])
    expect(onBlocked).toHaveBeenCalledTimes(1)
  })

  it('says what went wrong, and tries again where that can help', async () => {
    answer('/api/reports', 'offline', {
      status: 201,
      body: { id: 'r1', status: 'open' },
    })
    open()
    fireEvent.click(button(/^Report/u))
    fireEvent.click(screen.getByLabelText('Spam'))
    fireEvent.click(button('Send report'))

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'Could not reach MercuryPitch. Check the connection and try again.',
      ),
    )
    fireEvent.click(button('Try again'))

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
        'Report sent',
      ),
    )
    expect(requests.map((request) => request.body)).toEqual([
      { targetKind: 'user', targetId: 'ada', reason: 'spam', note: null },
      { targetKind: 'user', targetId: 'ada', reason: 'spam', note: null },
    ])
  })

  it('offers no second try where one cannot help', async () => {
    answer('/api/blocks', { status: 409, body: { error: 'Full' } })
    open()
    fireEvent.click(button(/^Block/u))

    fireEvent.click(button('Block Ada'))

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'You have blocked as many singers as you can. Unblock someone in Settings, Blocked singers, first.',
      ),
    )
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(blockedSingerIds().size).toBe(0)
    expect(onBlocked).not.toHaveBeenCalled()
  })

  it('sends a singer with no account to sign in, and asks the worker nothing', () => {
    setAuthToken(null)
    open()

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
      'Sign in to report or block',
    )
    expect(screen.getByRole('link', { name: 'Contact us' })).toBeTruthy()
    fireEvent.click(button('Sign in'))

    expect(onSignIn).toHaveBeenCalledTimes(1)
    expect(singerSheetSubject()).toBeNull()
    expect(requests).toEqual([])
  })

  it('asks for a sign-in again when the server refuses the session', async () => {
    answer('/api/reports', { status: 401, body: { error: 'Unauthorized' } })
    open()
    fireEvent.click(button(/^Report/u))
    fireEvent.click(screen.getByLabelText('Spam'))

    fireEvent.click(button('Send report'))

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
        'Sign in again',
      ),
    )
    expect(getAuthToken()).toBeNull()
    expect(button('Sign in')).toBeTruthy()
  })

  it('hands the focus to each pane’s title as it opens', async () => {
    open()

    fireEvent.click(button(/^Report/u))
    await settle()

    const title = screen.getByRole('heading', { level: 2 })
    expect(title.textContent).toBe('Report Ada')
    expect(document.activeElement).toBe(title)
  })

  it('closes on Escape, and from its Close button', async () => {
    open()
    await settle()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(singerSheetSubject()).toBeNull()

    openSingerSheet(ADA)
    await settle()
    fireEvent.click(button('Close'))
    expect(singerSheetSubject()).toBeNull()
  })

  it('offers Report alone where a block cannot reach', () => {
    open({ ...ADA, reportOnly: true })

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
      'Report Ada',
    )
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Block/u })).toBeNull()
  })
})
