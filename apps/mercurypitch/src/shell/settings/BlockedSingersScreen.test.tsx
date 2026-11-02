// ============================================================
// Blocked singers: the list, Unblock, and a list that cannot be read
// ============================================================
//
// The flow, the service and the blocked store are real; the worker is a
// stand-in at the network edge.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Defaults from '@/lib/defaults'

vi.mock('@/lib/defaults', async (importOriginal) => ({
  ...(await importOriginal<typeof Defaults>()),
  API_BASE_URL: 'http://api.test',
}))

const session = vi.hoisted(() => ({ rejected: 0 }))

vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  accountHeld: () => true,
  currentAccountId: () => 'acc-1',
  handleCloudSessionRejected: () => {
    session.rejected++
    return true
  },
}))

vi.mock('./sign-in-state', () => ({ openSignIn: vi.fn() }))

import { blockedSingerIds, resetBlockedSingersForTests, } from '@/stores/blocked-singers-store'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { BlockedSingersScreen } from './BlockedSingersScreen'
import { openSignIn } from './sign-in-state'

type Answer = { status: number; body?: unknown } | 'offline' | 'held'

let answers: Answer[] = []
let requests: string[] = []
/** Lets a held answer go. */
let release: () => void = () => {}

const BLOCKS = {
  blocks: [
    { userId: 'ada', displayName: 'Ada', createdAt: new Date().toISOString() },
    { userId: 'ben', displayName: 'Ben', createdAt: '2026-10-01T00:00:00Z' },
  ],
}

let view: RenderedShell | null = null

const settle = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

const q = (selector: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(selector)

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
  session.rejected = 0
  resetBlockedSingersForTests()
  vi.mocked(openSignIn).mockClear()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      requests.push(`${init.method ?? 'GET'} ${new URL(url).pathname}`)
      const next = answers.shift() ?? { status: 500 }
      if (next === 'offline') throw new TypeError('Failed to fetch')
      if (next === 'held') {
        await new Promise<void>((resolve) => {
          release = resolve
        })
        return Response.json(BLOCKS)
      }
      return Response.json(next.body ?? {}, { status: next.status })
    }),
  )
})

afterEach(() => {
  view?.unmount()
  view = null
  vi.unstubAllGlobals()
})

describe('the Blocked singers screen', () => {
  it('lists whom the account blocked, each with when and an Unblock', async () => {
    answers = [{ status: 200, body: BLOCKS }]
    await open()

    expect(requests).toEqual(['GET /api/blocks'])
    expect(names()).toEqual(['Ada', 'Ben'])
    expect(q('[data-blocked="ada"] .mp-set-row__sub')?.textContent).toBe(
      'Blocked today',
    )
    expect(q('[data-unblock="ben"]')?.getAttribute('aria-label')).toBe(
      'Unblock Ben',
    )
  })

  it('unblocks a singer, takes the row away, and gives the focus to the row in its place', async () => {
    answers = [
      { status: 200, body: BLOCKS },
      { status: 200, body: { userId: 'ada', blocked: false } },
    ]
    await open()
    expect(blockedSingerIds().has('ada')).toBe(true)
    const button = q('[data-unblock="ada"]') as HTMLButtonElement
    button.focus()

    button.click()
    await settle()

    expect(requests).toEqual(['GET /api/blocks', 'DELETE /api/blocks/ada'])
    expect(names()).toEqual(['Ben'])
    expect(blockedSingerIds().has('ada')).toBe(false)
    expect(document.activeElement).toBe(q('[data-unblock="ben"]'))
  })

  it('says so when nobody is blocked', async () => {
    answers = [{ status: 200, body: { blocks: [] } }]
    await open()

    expect(q('[data-testid="blocked-empty"]')?.textContent).toBe(
      'You have not blocked anyone. A singer you block from a board shows here.',
    )
  })

  it('keeps Try again where it is while the next read is out, then hands its focus on', async () => {
    answers = ['offline', 'held']
    await open()
    expect(q('[data-testid="blocked-failed"]')?.textContent).toContain(
      'Could not load the singers you blocked.',
    )
    const retry = q('[data-testid="blocked-retry"]') as HTMLButtonElement
    retry.focus()

    retry.click()
    await settle()

    // The read is out: the button stays, and so does its focus.
    expect(q('[data-testid="blocked-retry"]')).toBe(retry)
    expect(retry.getAttribute('aria-disabled')).toBe('true')
    expect(retry.disabled).toBe(false)
    expect(document.activeElement).toBe(retry)

    release()
    await settle()
    await settle()

    expect(names()).toEqual(['Ada', 'Ben'])
    expect(document.activeElement).toBe(q('[data-unblock="ada"]'))
  })

  it('asks for a sign-in again when the server refuses the session', async () => {
    answers = [{ status: 401, body: { error: 'Unauthorized' } }]
    await open()

    expect(session.rejected).toBe(1)
    expect(q('[data-testid="blocked-retry"]')).toBeNull()
    q('[data-testid="blocked-sign-in"]')?.click()
    expect(openSignIn).toHaveBeenCalledTimes(1)
  })

  it('says why an unblock did not happen, and keeps the row', async () => {
    answers = [
      { status: 200, body: BLOCKS },
      { status: 429, body: { error: 'Slow down' } },
    ]
    await open()

    q('[data-unblock="ben"]')?.click()
    await settle()

    expect(names()).toEqual(['Ada', 'Ben'])
    expect(q('[data-testid="unblock-failed"]')?.textContent).toBe(
      'You have blocked or unblocked a lot of singers in the last hour. Try again later.',
    )
  })
})
