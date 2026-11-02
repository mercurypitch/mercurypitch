// ============================================================
// The Community screen: each state, worded plainly
// ============================================================
//
// Loading, an empty board, a read that failed with Try again, a phone that
// knows it is offline, and nobody signed in, beside the lists and the
// profile they frame. The store is real; the share and profile reads are
// stand-ins at the service edge.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SharedMelodyView, SharedSessionView, } from '@/db/services/share-service'

const held = vi.hoisted(() => ({
  account: 'acc-1' as string | null,
  /** Sign in or out as the token would: every reader is told. */
  as: (_account: string | null): void => {},
}))

vi.mock('@/db/services/auth-service', async (importOriginal) => {
  const { createSignal } = await import('solid-js')
  const [version, setVersion] = createSignal(0)
  held.as = (account) => {
    held.account = account
    setVersion((v) => v + 1)
  }
  return {
    ...(await importOriginal<Record<string, unknown>>()),
    accountHeld: () => {
      version()
      return held.account !== null
    },
    currentAccountId: () => held.account,
  }
})

vi.mock('@/db/services/user-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getUserId: () => held.account ?? 'device-1',
}))

vi.mock('@/db/services/share-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  readSharedMelodies: vi.fn(),
  readSharedSessions: vi.fn(),
  loadPublishedShareCounts: vi.fn(),
  loadUserProfile: vi.fn(),
}))

vi.mock('@/db/services/progress-session-records', () => ({
  loadProgressSessionRecords: vi.fn(),
}))

vi.mock('@/db/services/streak-service', () => ({
  getCurrentStreak: vi.fn(async () => 0),
}))

import { loadProgressSessionRecords } from '@/db/services/progress-session-records'
import { loadPublishedShareCounts, loadUserProfile, readSharedMelodies, readSharedSessions, } from '@/db/services/share-service'
import { resetBlockedSingersForTests } from '@/stores/blocked-singers-store'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { resetCommunityStoreForTests } from './community-store'
import { CommunityScreen } from './CommunityScreen'

const melodies = vi.mocked(readSharedMelodies)
const sessions = vi.mocked(readSharedSessions)
const history = vi.mocked(loadProgressSessionRecords)

const MELODY: SharedMelodyView = {
  id: 'm1',
  userId: 'ada',
  name: 'Moon River',
  items: [],
  author: 'Ada',
  tags: [],
  date: Date.parse('2026-10-30T10:00:00Z'),
}

const RESULT: SharedSessionView = {
  id: 'r1',
  userId: 'ben',
  name: 'Morning scales',
  items: [],
  author: 'Ben',
  results: [80, 70],
  date: Date.parse('2026-10-31T10:00:00Z'),
}

let view: RenderedShell | null = null

const settle = async (): Promise<void> => {
  for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 0))
}

const text = (testId: string): string | null | undefined =>
  document.querySelector(`[data-testid="${testId}"]`)?.textContent

function show(): void {
  view = renderShell(() => <CommunityScreen />)
}

beforeEach(() => {
  held.account = 'acc-1'
  resetCommunityStoreForTests()
  resetBlockedSingersForTests()
  melodies.mockReset().mockResolvedValue([MELODY])
  sessions.mockReset().mockResolvedValue([RESULT])
  history.mockReset().mockResolvedValue({
    records: [
      { id: 'run', endedAt: '2026-10-30T10:00:00.000Z', score: 76 },
    ] as never,
    available: true,
    complete: true,
    totalAvailable: 1,
  })
  vi.mocked(loadPublishedShareCounts).mockReset().mockResolvedValue({
    melodies: 0,
    sessions: 0,
  })
  vi.mocked(loadUserProfile)
    .mockReset()
    .mockResolvedValue({
      userId: 'acc-1',
      displayName: 'Maya',
      joinDate: Date.parse('2026-10-05T10:00:00Z'),
    })
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ blocks: [] })),
  )
})

afterEach(() => {
  view?.unmount()
  view = null
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the Community screen', () => {
  it('says it is loading while the first read is out', async () => {
    melodies.mockReturnValue(new Promise(() => {}))
    show()
    await settle()

    expect(text('community-loading')).toBe('Loading what singers shared')
    expect(document.querySelector('[data-community-melody]')).toBeNull()
  })

  it('lists the melodies and the results, and the singer’s own figures', async () => {
    show()
    await settle()

    expect(
      document.querySelector('[data-community-melody="m1"]')?.textContent,
    ).toContain('Moon River')
    expect(
      document.querySelector('[data-community-result="r1"]')?.textContent,
    ).toContain('75%')
    expect(
      document.querySelector('.mp-community-profile__name')?.textContent,
    ).toBe('Maya')
    const figures = [...document.querySelectorAll('[data-figure]')].map(
      (figure) => figure.textContent,
    )
    expect(figures).toEqual(['1run', '76%best', '76%recent average'])
  })

  it('says plainly that nothing has been shared yet', async () => {
    melodies.mockResolvedValue([])
    sessions.mockResolvedValue([])
    show()
    await settle()

    expect(text('community-empty')).toBe(
      'Nothing shared yet. When singers share a melody or a result, it shows here.',
    )
  })

  it('says a read that failed, and Try again reads it and hands the focus on', async () => {
    melodies.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    show()
    await settle()
    expect(text('community-problem')).toBe(
      'Could not load Community. Check the connection and try again.',
    )
    const retry = document.querySelector<HTMLButtonElement>(
      '[data-testid="community-retry"]',
    )
    retry?.focus()

    retry?.click()
    await settle()

    expect(document.querySelector('[data-testid="community-problem"]')).toBe(
      null,
    )
    expect(document.querySelector('[data-community-melody="m1"]')).not.toBe(
      null,
    )
    expect(document.activeElement?.textContent).toBe('Maya')
  })

  it('asks nothing offline, says so, and reads once the phone is back online', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    show()
    await settle()
    expect(melodies).not.toHaveBeenCalled()
    expect(text('community-problem')).toMatch(/^You are offline\. /u)

    online.mockReturnValue(true)
    window.dispatchEvent(new Event('online'))
    await settle()

    expect(melodies).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-community-melody="m1"]')).not.toBe(
      null,
    )
  })

  it('asks a phone with no account to sign in for its profile, and still lists the shares', async () => {
    held.account = null
    show()
    await settle()

    expect(text('community-signed-out')).toContain(
      'Sign in to see your runs, your best and your streak here.',
    )
    expect(
      document.querySelector('[data-testid="community-sign-in"]'),
    ).not.toBeNull()
    expect(document.querySelector('[data-community-melody="m1"]')).not.toBe(
      null,
    )
    expect(history).not.toHaveBeenCalled()
  })

  it('reads Community again for whoever signs in, and hands the focus to their name', async () => {
    held.account = null
    show()
    await settle()
    const signIn = document.querySelector<HTMLButtonElement>(
      '[data-testid="community-sign-in"]',
    )
    signIn?.focus()
    expect(melodies).toHaveBeenCalledTimes(1)

    held.as('acc-1')
    await settle()

    expect(melodies).toHaveBeenCalledTimes(2)
    expect(history).toHaveBeenCalledTimes(1)
    const name = document.querySelector('.mp-community-profile__name')
    expect(name?.textContent).toBe('Maya')
    expect(document.activeElement).toBe(name)
  })

  it('ends with the contact form, opened in the phone’s browser', async () => {
    show()
    await settle()

    const link = document.querySelector<HTMLAnchorElement>(
      '[data-testid="community-contact"] a',
    )
    expect(link?.textContent).toBe('Contact us')
    expect(link?.target).toBe('_blank')
    expect(new URL(link?.href ?? '').searchParams.get('topic')).toBe('support')
  })
})
