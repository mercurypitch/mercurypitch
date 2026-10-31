// ============================================================
// The Legend's card over the Sing room's exercises: its words, its way in
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const build = vi.hoisted(() => ({ leagues: true }))

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  get NATIVE_LEAGUES() {
    return build.leagues
  },
}))

vi.mock('./legend-store', () => ({
  legendCard: vi.fn(),
  legendStanding: vi.fn(),
}))

vi.mock('../run-shell-store', () => ({ pushScreen: vi.fn() }))

import { pushScreen } from '../run-shell-store'
import { installLegendCard, legendCardWords } from './legend-card-wiring'
import { legendCard, legendStanding } from './legend-store'

const NOW = Date.parse('2026-10-31T12:00:00Z')
const DAY = 86_400_000

const card = vi.mocked(legendCard)
const standing = vi.mocked(legendStanding)

beforeEach(() => {
  card.mockReturnValue({
    id: 'legend-1',
    title: 'The Evening Bell',
    endsAt: new Date(NOW + 3 * DAY).toISOString(),
  })
  standing.mockReturnValue(null)
})

afterEach(() => {
  build.leagues = true
  vi.clearAllMocks()
})

describe('the card’s words', () => {
  it('names the running Legend and when it closes', () => {
    expect(legendCardWords(NOW)).toMatchObject({
      title: 'The Evening Bell',
      when: 'Ends in 3 days',
      best: null,
    })
  })

  it('says the singer’s best on it, rounded as the board rounds it', () => {
    standing.mockReturnValue({
      accountId: 'acc-1',
      challengeId: 'legend-1',
      best: 73.6,
      completed: true,
    })
    expect(legendCardWords(NOW)?.best).toBe('Your best 74%')
  })

  it('says a Legend past its close is closing', () => {
    card.mockReturnValue({
      id: 'legend-1',
      title: 'The Evening Bell',
      endsAt: new Date(NOW - 60_000).toISOString(),
    })
    expect(legendCardWords(NOW)?.when).toBe('Closing')
  })

  it('has no card for a Legend kept past even its grace', () => {
    card.mockReturnValue({
      id: 'legend-1',
      title: 'The Evening Bell',
      endsAt: new Date(NOW - 3 * DAY).toISOString(),
    })
    expect(legendCardWords(NOW)).toBeNull()
  })

  it('has no card before a read, or while no Legend is open', () => {
    card.mockReturnValue(undefined)
    expect(legendCardWords(NOW)).toBeNull()
    card.mockReturnValue(null)
    expect(legendCardWords(NOW)).toBeNull()
  })

  it('never names a period', () => {
    const words = Object.values(legendCardWords(NOW) ?? {}).join(' ')
    expect(words).not.toMatch(
      /\b(weekly|monthly|fortnightly|this week|this month)\b/iu,
    )
  })
})

describe('the way in', () => {
  it('opens the Legend room', () => {
    installLegendCard().legend?.open()
    expect(pushScreen).toHaveBeenCalledWith('legend')
  })

  it('registers nothing on a build without Leagues', () => {
    build.leagues = false
    expect(installLegendCard()).toEqual({})
  })
})
