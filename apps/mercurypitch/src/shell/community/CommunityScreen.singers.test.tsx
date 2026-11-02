// ============================================================
// The Community screen: Report and Block on what other singers shared
// ============================================================
//
// Slice 4c. Every share by another singer ends in a "...", and a report
// from it names the share; the singer's own shares carry none, and neither
// does a share with no id to act on. A singer blocked from here leaves both
// lists at once, the lists are read again, and the focus comes back to the
// "..." now at that place. The sheet, its flow, the service, the blocked
// store and the Community store are real; the worker is a stand-in at the
// network edge, and the share reads at the service edge.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SharedMelodyView, SharedSessionView, } from '@/db/services/share-service'
import type * as Defaults from '@/lib/defaults'

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
  readSharedMelodies: vi.fn(),
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

import { SingerSheet } from '@/components/moderation/SingerSheet'
import { readSharedMelodies, readSharedSessions, } from '@/db/services/share-service'
import { resetBlockedSingersForTests } from '@/stores/blocked-singers-store'
import { closeSingerSheet } from '@/stores/singer-sheet-store'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { resetCommunityStoreForTests } from './community-store'
import { CommunityScreen } from './CommunityScreen'

const melodies = vi.mocked(readSharedMelodies)
const sessions = vi.mocked(readSharedSessions)

function melody(id: string, userId: string, author: string): SharedMelodyView {
  return {
    id,
    userId,
    name: `${author}'s tune`,
    items: [],
    author,
    tags: [],
    date: 1,
  }
}

function result(id: string, userId: string, author: string): SharedSessionView {
  return {
    id,
    userId,
    name: `${author}'s run`,
    items: [],
    author,
    results: [70],
    date: 1,
  }
}

let view: RenderedShell | null = null
let posted: Array<{ path: string; body: unknown }> = []

const settle = async (): Promise<void> => {
  for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 0))
}

const moreLabels = (board: string): string[] =>
  [
    ...document.querySelectorAll(
      `[data-singer-board="${board}"] [data-singer-more]`,
    ),
  ].map((button) => button.getAttribute('aria-label') ?? '')

const more = (board: string, userId: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(
    `[data-singer-board="${board}"] [data-singer-more="${userId}"]`,
  )

function press(selector: string): void {
  const element = document.querySelector<HTMLElement>(selector)
  if (element === null) throw new Error(`Nothing at ${selector}`)
  element.click()
}

function pressButton(name: string): void {
  const button = [...document.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === name,
  )
  if (button === undefined) throw new Error(`No button named ${name}`)
  button.click()
}

function show(): void {
  view = renderShell(() => (
    <>
      <CommunityScreen />
      <SingerSheet />
    </>
  ))
}

beforeEach(() => {
  resetCommunityStoreForTests()
  resetBlockedSingersForTests()
  posted = []
  melodies
    .mockReset()
    .mockResolvedValue([
      melody('m1', 'ada', 'Ada'),
      melody('m2', 'acc-1', 'Maya'),
      melody('m3', 'ben', 'Ben'),
      melody('m4', 'cleo', 'Cleo'),
    ])
  sessions
    .mockReset()
    .mockResolvedValue([
      result('r1', 'ben', 'Ben'),
      result('r2', '', 'Old row'),
      result('r3', 'cleo', 'Cleo'),
    ])
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      if ((init.method ?? 'GET') === 'POST') {
        posted.push({
          path: new URL(url).pathname,
          body: JSON.parse(String(init.body)),
        })
        return Response.json({ ok: true }, { status: 201 })
      }
      return Response.json({ blocks: [] })
    }),
  )
})

afterEach(() => {
  closeSingerSheet()
  view?.unmount()
  view = null
  vi.unstubAllGlobals()
})

describe('Community’s shares and their singers', () => {
  it('offers Report and Block on another singer’s share, and on none of the singer’s own or one with no id', async () => {
    show()
    await settle()

    expect(moreLabels('community-melodies')).toEqual([
      "More about Ada's tune, by Ada",
      "More about Ben's tune, by Ben",
      "More about Cleo's tune, by Cleo",
    ])
    expect(moreLabels('community-results')).toEqual([
      "More about Ben's run, by Ben",
      "More about Cleo's run, by Cleo",
    ])
    expect(
      document.querySelector('[data-community-melody="m2"]')?.textContent,
    ).toContain('You')
  })

  it('names each share’s "..." for the share, so two of one singer’s are told apart', async () => {
    melodies.mockResolvedValue([
      { ...melody('m1', 'ada', 'Ada'), name: 'Moon River' },
      { ...melody('m5', 'ada', 'Ada'), name: 'Blue Moon' },
    ])
    show()
    await settle()

    expect(moreLabels('community-melodies')).toEqual([
      'More about Moon River, by Ada',
      'More about Blue Moon, by Ada',
    ])
  })

  it('names the melody in a report made from its "..."', async () => {
    show()
    await settle()

    more('community-melodies', 'ada')?.click()
    press('[data-testid="singer-choose-report"]')
    press('input[value="spam"]')
    press('[data-testid="singer-report-send"]')
    await settle()

    expect(posted).toEqual([
      {
        path: '/api/reports',
        body: expect.objectContaining({
          targetKind: 'melody',
          targetId: 'm1',
          reason: 'spam',
        }),
      },
    ])
  })

  it('names the result in a report made from its "..."', async () => {
    show()
    await settle()

    more('community-results', 'cleo')?.click()
    press('[data-testid="singer-choose-report"]')
    press('input[value="offensive"]')
    press('[data-testid="singer-report-send"]')
    await settle()

    expect(posted[0]?.body).toEqual(
      expect.objectContaining({ targetKind: 'session', targetId: 'r3' }),
    )
  })

  it('takes a blocked singer’s shares off both lists at once, and reads them again', async () => {
    show()
    await settle()
    expect(melodies).toHaveBeenCalledTimes(1)
    // The read after the block is still out: what the lists show meanwhile
    // is the phone's own doing.
    melodies.mockReturnValue(new Promise(() => {}))

    more('community-melodies', 'ben')?.click()
    press('[data-testid="singer-choose-block"]')
    pressButton('Block Ben')
    await settle()

    expect(posted).toEqual([{ path: '/api/blocks', body: { userId: 'ben' } }])
    expect(melodies).toHaveBeenCalledTimes(2)
    expect(
      [...document.querySelectorAll('[data-community-melody]')].map((row) =>
        row.getAttribute('data-community-melody'),
      ),
    ).toEqual(['m1', 'm2', 'm4'])
    expect(
      [...document.querySelectorAll('[data-community-result]')].map((row) =>
        row.getAttribute('data-community-result'),
      ),
    ).toEqual(['r2', 'r3'])
  })

  it('gives the focus to the "..." now at the blocked share’s place, and keeps it through the read', async () => {
    show()
    await settle()
    let letGo: () => void = () => {}
    melodies.mockReturnValueOnce(
      new Promise((resolve) => {
        letGo = () =>
          resolve([
            melody('m1', 'ada', 'Ada'),
            melody('m2', 'acc-1', 'Maya'),
            melody('m4', 'cleo', 'Cleo'),
          ])
      }),
    )

    more('community-melodies', 'ben')?.click()
    await settle()
    press('[data-testid="singer-choose-block"]')
    await settle()
    pressButton('Block Ben')
    await settle()
    pressButton('Done')
    await settle()

    expect(document.activeElement).toBe(more('community-melodies', 'cleo'))

    letGo()
    await settle()

    expect(document.activeElement).toBe(more('community-melodies', 'cleo'))
  })
})
