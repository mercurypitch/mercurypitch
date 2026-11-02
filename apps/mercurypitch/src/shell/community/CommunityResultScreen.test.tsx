// ============================================================
// A shared result, drawn again: what it says is true of the result now
// ============================================================
//
// The result screen is drawn anew whenever it is the top of the stack
// again: after a screen pushed over it, then Back. It takes what it shows
// from the result as it was opened and from what is true now: its singer
// blocked, in the sheet's own words; the result gone from the latest read;
// or another account, or none, signed in since. The stores, the shell's
// stack and the sheet are real; the reads are stand-ins at the service edge.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SharedSessionView } from '@/db/services/share-service'
import type * as Defaults from '@/lib/defaults'

const held = vi.hoisted(() => ({
  account: 'acc-1' as string | null,
  /** Sign in or out as the token would: every reader is told. */
  as: (_account: string | null): void => {},
}))

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  NATIVE_COMMUNITY: true,
}))

vi.mock('@/lib/defaults', async (importOriginal) => ({
  ...(await importOriginal<typeof Defaults>()),
  API_BASE_URL: 'http://api.test',
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
    currentAccountId: () => {
      version()
      return held.account
    },
  }
})

vi.mock('@/db/services/user-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getUserId: () => held.account ?? 'device-1',
}))

vi.mock('@/db/services/share-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  readSharedMelodies: vi.fn(async () => []),
  readSharedSessions: vi.fn(),
  loadPublishedShareCounts: vi.fn(async () => null),
  loadUserProfile: vi.fn(async () => null),
}))

vi.mock('@/db/services/progress-session-records', () => ({
  loadProgressSessionRecords: vi.fn(async () => ({
    records: [],
    available: true,
    complete: true,
    totalAvailable: 0,
  })),
}))

vi.mock('@/db/services/streak-service', () => ({
  getCurrentStreak: vi.fn(async () => 0),
}))

import { BLOCK_WORDS } from '@/components/moderation/singer-sheet-copy'
import { SingerSheet } from '@/components/moderation/SingerSheet'
import { readSharedSessions } from '@/db/services/share-service'
import { TAB_PROGRESS } from '@/features/tabs/constants'
import { resetBlockedSingersForTests } from '@/stores/blocked-singers-store'
import { closeSingerSheet } from '@/stores/singer-sheet-store'
import { setActiveTab } from '@/stores/ui-store'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { pushScreen, resetRunShell } from '../run-shell-store'
import { performBack } from '../shell-navigation'
import { ShellScreens } from '../ShellScreens'
import { refreshCommunity, resetCommunityStoreForTests, } from './community-store'
import { CommunityResultScreen } from './CommunityResultScreen'
import { CommunityScreen } from './CommunityScreen'

const sessions = vi.mocked(readSharedSessions)

function result(id: string, userId: string, author: string): SharedSessionView {
  return {
    id,
    userId,
    name: `${author}'s run`,
    items: [],
    author,
    results: [80, 64],
    date: 1,
  }
}

let view: RenderedShell | null = null

const settle = async (): Promise<void> => {
  for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 0))
}

const host = () => ({ canGoBack: true, back: vi.fn(), minimize: vi.fn() })

const heading = (): string | null | undefined =>
  document.querySelector('.mp-community-result__name')?.textContent

const note = (): string | null | undefined =>
  document.querySelector('[data-testid="community-result-gone"]')?.textContent

function pressButton(name: string): void {
  const button = [...document.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === name,
  )
  if (button === undefined) throw new Error(`No button named ${name}`)
  button.click()
}

/** Community, and the result `id` opened from it. */
async function openResult(id: string): Promise<void> {
  pushScreen('community')
  await settle()
  document.querySelector<HTMLElement>(`[data-community-open="${id}"]`)?.click()
  await settle()
}

/** A screen pushed over the result, then Back: the result drawn anew. */
async function drawnAgain(): Promise<void> {
  pushScreen('about')
  await settle()
  performBack(host())
  await settle()
}

beforeEach(() => {
  held.as('acc-1')
  setActiveTab(TAB_PROGRESS)
  resetRunShell()
  resetCommunityStoreForTests()
  resetBlockedSingersForTests()
  sessions
    .mockReset()
    .mockResolvedValue([result('r1', 'ada', 'Ada'), result('r2', 'ben', 'Ben')])
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit = {}) =>
      (init.method ?? 'GET') === 'POST'
        ? Response.json({ blocked: true }, { status: 201 })
        : Response.json({ blocks: [] }),
    ),
  )
  view = renderShell(() => (
    <>
      <ShellScreens
        community={CommunityScreen}
        communityResult={CommunityResultScreen}
      />
      <SingerSheet />
    </>
  ))
})

afterEach(() => {
  closeSingerSheet()
  view?.unmount()
  view = null
  resetRunShell()
  vi.unstubAllGlobals()
})

describe('a shared result, drawn again', () => {
  it('still says its singer is blocked, in the sheet’s words, once the read has dropped it', async () => {
    await openResult('r1')
    // After the block the worker leaves Ada's result out of the read.
    sessions.mockResolvedValue([result('r2', 'ben', 'Ben')])
    document.querySelector<HTMLElement>('[data-singer-more="ada"]')?.click()
    await settle()
    document
      .querySelector<HTMLElement>('[data-testid="singer-choose-block"]')
      ?.click()
    await settle()
    pressButton('Block Ada')
    await settle()
    pressButton('Done')
    await settle()

    await drawnAgain()

    expect(heading()).toBe('Result hidden')
    expect(note()).toBe(BLOCK_WORDS)
  })

  it('says the account changed, not that the result was taken down, when the phone signs out under it', async () => {
    await openResult('r2')

    held.as(null)
    await settle()

    expect(heading()).toBe('Account changed')
    expect(note()).toMatch(/^The account on this phone changed/u)
    expect(document.querySelector('[data-singer-more]')).toBeNull()
  })

  it('says it is not found once the latest read no longer has it', async () => {
    await openResult('r2')
    sessions.mockResolvedValue([result('r1', 'ada', 'Ada')])

    await refreshCommunity()
    await drawnAgain()

    expect(heading()).toBe('Result not found')
    expect(note()).toMatch(/^This shared result is not here any more\./u)
  })

  it('shows the result as the latest read has it', async () => {
    await openResult('r2')
    sessions.mockResolvedValue([
      { ...result('r2', 'ben', 'Ben'), name: 'Evening scales' },
    ])

    await refreshCommunity()
    await drawnAgain()

    expect(heading()).toBe('Evening scales')
  })
})
