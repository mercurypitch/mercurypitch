// ============================================================
// The web's Blocked singers, in account settings
// ============================================================
//
// The flow, the service and the blocked store are real; the worker is a
// stand-in at the network edge.

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Defaults from '@/lib/defaults'

vi.mock('@/lib/defaults', async (importOriginal) => ({
  ...(await importOriginal<typeof Defaults>()),
  API_BASE_URL: 'http://api.test',
}))

vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  accountHeld: () => true,
  currentAccountId: () => 'me',
}))

import { resetBlockedSingersForTests } from '@/stores/blocked-singers-store'
import { BlockedSingersList } from './BlockedSingersList'

type Answer = { status: number; body?: unknown } | 'offline'

let answers: Answer[] = []
let requests: string[] = []

const BLOCKS = {
  blocks: [
    { userId: 'ada', displayName: 'Ada', createdAt: '2026-11-01T00:00:00Z' },
    { userId: 'ben', displayName: 'Ben', createdAt: '2026-11-01T00:00:00Z' },
  ],
}

beforeEach(() => {
  answers = []
  requests = []
  resetBlockedSingersForTests()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      requests.push(`${init.method ?? 'GET'} ${new URL(url).pathname}`)
      const next = answers.shift() ?? { status: 500 }
      if (next === 'offline') throw new TypeError('Failed to fetch')
      return Response.json(next.body ?? {}, { status: next.status })
    }),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('the web’s Blocked singers', () => {
  it('unblocks a singer and gives the focus to the row in its place', async () => {
    answers = [
      { status: 200, body: BLOCKS },
      { status: 200, body: {} },
    ]
    render(() => <BlockedSingersList />)
    const ada = await waitFor(() =>
      screen.getByRole('button', { name: 'Unblock Ada' }),
    )
    ada.focus()

    fireEvent.click(ada)

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Unblock Ada' })).toBeNull(),
    )
    expect(requests).toEqual(['GET /api/blocks', 'DELETE /api/blocks/ada'])
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Unblock Ben' }),
      ),
    )
  })

  it('says so when nobody is blocked', async () => {
    answers = [{ status: 200, body: { blocks: [] } }]
    render(() => <BlockedSingersList />)

    await waitFor(() =>
      expect(screen.getByTestId('blocked-empty').textContent).toBe(
        'You have not blocked anyone. A singer you block from a board shows here.',
      ),
    )
  })

  it('offers to try again when the list cannot be read', async () => {
    answers = ['offline', { status: 200, body: BLOCKS }]
    render(() => <BlockedSingersList />)
    const retry = await waitFor(() => screen.getByTestId('blocked-retry'))

    fireEvent.click(retry)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Unblock Ben' })).toBeTruthy(),
    )
    expect(screen.queryByTestId('blocked-retry')).toBeNull()
  })
})
