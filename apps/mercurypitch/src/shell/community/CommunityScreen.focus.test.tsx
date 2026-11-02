// ============================================================
// Community's two screens: pushed at their titles, and left by Back
// ============================================================
//
// A pushed screen hands the focus to its title. A result opened from the
// list is pushed over it, so the phone's Back leaves the result first and
// lands on the row that opened it, the list scrolled where it was and
// nothing asked of the worker, and the next Back leaves Community, as it
// leaves the Leagues screen (shell-navigation.ts). Blocked from the
// result, its singer's result is hidden at once and the focus goes to the
// screen's heading. The stores, the shell's stack and the sheet are real.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SharedSessionView } from '@/db/services/share-service'
import type * as Defaults from '@/lib/defaults'

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  NATIVE_COMMUNITY: true,
}))

vi.mock('@/lib/defaults', async (importOriginal) => ({
  ...(await importOriginal<typeof Defaults>()),
  API_BASE_URL: 'http://api.test',
}))

vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  accountHeld: () => true,
  currentAccountId: () => 'acc-1',
}))

vi.mock('@/db/services/user-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getUserId: () => 'acc-1',
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
import { loadProgressSessionRecords } from '@/db/services/progress-session-records'
import { readSharedMelodies, readSharedSessions, } from '@/db/services/share-service'
import { TAB_PROGRESS } from '@/features/tabs/constants'
import { resetBlockedSingersForTests } from '@/stores/blocked-singers-store'
import { closeSingerSheet } from '@/stores/singer-sheet-store'
import { setActiveTab } from '@/stores/ui-store'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { pushed, pushScreen, resetRunShell } from '../run-shell-store'
import { performBack } from '../shell-navigation'
import { ShellScreens } from '../ShellScreens'
import { forgetCommunityResult, resetCommunityStoreForTests, } from './community-store'
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

const title = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('.mp-pushed__title')

const opener = (id: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-community-open="${id}"]`)

const scroller = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('.mp-pushed__body')

function pressButton(name: string): void {
  const button = [...document.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === name,
  )
  if (button === undefined) throw new Error(`No button named ${name}`)
  button.click()
}

beforeEach(() => {
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

describe('Community, pushed and left', () => {
  it('hands the focus to its title as it is pushed', async () => {
    forgetCommunityResult()
    pushScreen('community')
    await settle()

    expect(title()?.textContent).toBe('Community')
    expect(document.activeElement).toBe(title())
  })

  it('leaves the focus alone on a screen that did not ask for its title', async () => {
    pushScreen('about')
    await settle()

    expect(title()?.textContent).toBe('About')
    expect(document.activeElement).not.toBe(title())
  })

  it('opens a result over the list, at its title, and Back lands on the row that opened it', async () => {
    pushScreen('community')
    await settle()

    opener('r2')?.click()
    await settle()
    expect(pushed()).toBe('community-result')
    expect(document.activeElement).toBe(title())
    expect(title()?.textContent).toBe('Shared result')
    expect(
      document.querySelector('.mp-community-result__name')?.textContent,
    ).toBe("Ben's run")
    expect(
      document.querySelector('.mp-community-result__score')?.textContent,
    ).toBe('72%')

    expect(performBack(host())).toBe('pushed')
    await settle()

    expect(pushed()).toBe('community')
    expect(document.activeElement).toBe(opener('r2'))

    expect(performBack(host())).toBe('pushed')
    expect(pushed()).toBeNull()
  })

  it('puts the list back where it was scrolled to, on Back, before the row takes the focus', async () => {
    pushScreen('community')
    await settle()
    const list = scroller()
    if (list === null) throw new Error('No scroller')
    list.scrollTop = 787

    opener('r2')?.click()
    await settle()
    performBack(host())
    await settle()

    // A new scroller: the screen was drawn anew, at the top.
    expect(scroller()).not.toBe(list)
    expect(scroller()?.scrollTop).toBe(787)
    expect(document.activeElement).toBe(opener('r2'))
  })

  it('asks the worker nothing on Back from a result', async () => {
    pushScreen('community')
    await settle()
    const reads = (): number[] => [
      vi.mocked(readSharedMelodies).mock.calls.length,
      sessions.mock.calls.length,
      vi.mocked(loadProgressSessionRecords).mock.calls.length,
      vi.mocked(fetch).mock.calls.length,
    ]
    const before = reads()

    opener('r2')?.click()
    await settle()
    performBack(host())
    await settle()

    expect(reads()).toEqual(before)
  })

  it('hides a result whose singer is blocked from it, and gives the focus to its heading', async () => {
    pushScreen('community')
    await settle()
    opener('r1')?.click()
    await settle()
    // The read after the block is still out: the result is hidden by the
    // phone, at once.
    sessions.mockReturnValue(new Promise(() => {}))

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

    const heading = document.querySelector('.mp-community-result__name')
    expect(heading?.textContent).toBe('Result hidden')
    expect(
      document.querySelector('[data-testid="community-result-gone"]')
        ?.textContent,
    ).toBe(BLOCK_WORDS)
    expect(document.activeElement).toBe(heading)
    // Read again after the block: once as Community opened, once since.
    expect(sessions).toHaveBeenCalledTimes(2)
  })
})
