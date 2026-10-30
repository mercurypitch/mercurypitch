// ============================================================
// The More sheet's Together group, on a build with Leagues
// ============================================================
//
// The suite runs as a build with no Together switch on by default
// (vitest.config.ts defines no build constants), so the other suites see
// Rooms and You only. Here NATIVE_LEAGUES is on, as in a test build.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LeagueMe } from '@/db/services/league-service'

const held = vi.hoisted(() => ({
  signedIn: true,
  league: null as LeagueMe | null,
  /** The store's verdict on when the league was read. */
  thisWeek: true,
}))

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  NATIVE_LEAGUES: true,
}))

vi.mock('./leagues/league-store', () => ({
  leagueCard: () => held.league,
  leagueReadThisWeek: () => held.thisWeek,
}))

vi.mock('./settings/account-state', () => ({
  accountSignedIn: () => held.signedIn,
  accountCard: () => null,
  accountProviderLine: () => 'Signed in with Apple',
}))

import { MoreSheet } from './MoreSheet'
import type { RenderedShell } from './render-for-test'
import { renderShell } from './render-for-test'

let view: RenderedShell | null = null

function league(): LeagueMe {
  return {
    eligible: true,
    weekStart: '2026-10-26T00:00:00.000Z',
    league: {
      id: 'l2',
      rank: 2,
      name: 'Sparkwing',
      trophyAsset: '/leagues/l2.webp',
      badgeAsset: null,
      isMystery: false,
      promoteCount: 10,
      relegateCount: 10,
    },
    points: 120,
    rank: 4,
    cohortSize: 23,
    standings: [],
  }
}

function openSheet(onPushLeagues = vi.fn(), onClose = vi.fn()): void {
  view = renderShell(() => (
    <MoreSheet
      open={() => true}
      onClose={onClose}
      onPushSettings={vi.fn()}
      onPushAccount={vi.fn()}
      onPushDeveloper={vi.fn()}
      onPushLeagues={onPushLeagues}
    />
  ))
}

function line(id: string): string | null | undefined {
  return document.querySelector(`[data-more-item="${id}"] .mp-more-row__state`)
    ?.textContent
}

beforeEach(() => {
  held.signedIn = true
  held.league = league()
  held.thisWeek = true
})

afterEach(() => {
  view?.unmount()
  view = null
})

describe('the Together group', () => {
  it('stands between Rooms and You, tinted as its own group', () => {
    openSheet()
    const titles = [...document.querySelectorAll('.mp-more-group__title')]
    expect(titles.map((title) => title.textContent)).toEqual([
      'Rooms',
      'Together',
      'You',
    ])
    expect(
      document.querySelector(
        '.mp-more-group--together [data-more-item="leagues"]',
      ),
    ).not.toBeNull()
  })

  it("names the singer's rung and place from the league the phone kept", () => {
    openSheet()
    expect(line('leagues')).toBe('Sparkwing, 4th of 23')
  })

  it("names no rung from last week's league", () => {
    held.thisWeek = false
    openSheet()
    expect(line('leagues')).toBe('A rung higher every week')
  })

  it('asks a phone with no account to sign in', () => {
    held.signedIn = false
    openSheet()
    expect(line('leagues')).toBe('Sign in to climb')
  })

  it('pushes Leagues, closing the sheet on the way', () => {
    const onPushLeagues = vi.fn()
    const onClose = vi.fn()
    openSheet(onPushLeagues, onClose)
    ;(
      document.querySelector('[data-more-item="leagues"]') as HTMLButtonElement
    ).click()
    expect(onPushLeagues).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
