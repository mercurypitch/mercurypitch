// ============================================================
// The Legend the phone keeps: the running one, and the singer's own best
// ============================================================

import { createRoot, onMount } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActiveWeeklyRead, WeeklyBoard, WeeklyChallenge, } from '@/features/challenges/weekly-service'

const auth = vi.hoisted(() => ({
  held: true,
  id: 'acc-1' as string | null,
  as: (_id: string | null): void => {},
}))

const posted = vi.hoisted(() => ({ bump: (): void => {} }))

vi.mock('@/db/services/auth-service', async (importOriginal) => {
  const { createSignal } = await import('solid-js')
  const [version, setVersion] = createSignal(0)
  auth.as = (id) => {
    auth.id = id
    auth.held = id !== null
    setVersion((v) => v + 1)
  }
  return {
    ...(await importOriginal<Record<string, unknown>>()),
    accountHeld: () => {
      version()
      return auth.held
    },
    currentAccountId: () => auth.id,
  }
})

vi.mock('@/features/challenges/weekly-attempt', async () => {
  const { createSignal } = await import('solid-js')
  const [version, setVersion] = createSignal(0)
  posted.bump = () => setVersion((v) => v + 1)
  return { weeklyAttemptVersion: version }
})

vi.mock('@/features/challenges/weekly-service', () => ({
  readActiveWeekly: vi.fn(),
  getWeeklyBoard: vi.fn(),
}))

import { getWeeklyBoard, readActiveWeekly, } from '@/features/challenges/weekly-service'
import { installLegendRefresh, LEGEND_FRESH_MS, legendCard, legendStanding, refreshLegend, resetLegendStoreForTests, } from './legend-store'

const active = vi.mocked(readActiveWeekly)
const boardOf = vi.mocked(getWeeklyBoard)

const NOW = Date.parse('2026-10-31T12:00:00Z')

function legend(over: Partial<WeeklyChallenge> = {}): WeeklyChallenge {
  return {
    id: 'legend-1',
    slug: 'vincero',
    title: 'Vincero',
    description: '',
    featType: 'range',
    voiceTypeSplit: null,
    difficulty: 'hard',
    targetItems: [],
    targetScore: 70,
    hearItUrl: null,
    startsAt: '2026-10-26T00:00:00Z',
    endsAt: new Date(NOW + 3 * 86_400_000).toISOString(),
    rewardBadgeId: null,
    founderScore: 88,
    founderTrace: null,
    status: 'active',
    ...over,
  }
}

function board(best: number | null): WeeklyBoard {
  return {
    top: [{ rank: 1, displayName: 'Ana', best: 96, isFounder: false }],
    attemptedCount: 23,
    rankedCount: 18,
    completedCount: 8,
    targetScore: 70,
    founderScore: 88,
    frozen: false,
    you:
      best === null
        ? null
        : {
            best,
            rank: 3,
            percentile: 12,
            beatFounder: false,
            completed: true,
            ranked: true,
          },
  }
}

const ok = (challenge: WeeklyChallenge | null): ActiveWeeklyRead => ({
  status: 'ok',
  challenge,
})

const settle = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

let stop: (() => void) | null = null

beforeEach(() => {
  auth.as('acc-1')
  resetLegendStoreForTests()
  active.mockReset().mockResolvedValue(ok(legend()))
  boardOf.mockReset().mockResolvedValue(board(82))
})

afterEach(() => {
  stop?.()
  stop = null
  vi.restoreAllMocks()
})

describe('the Legend the phone keeps', () => {
  it('is nothing before the first read, and the running one after', async () => {
    expect(legendCard()).toBeUndefined()
    await refreshLegend()
    expect(legendCard()).toMatchObject({ id: 'legend-1', title: 'Vincero' })
  })

  it('says when nothing is running, apart from no answer', async () => {
    active.mockResolvedValue(ok(null))
    await refreshLegend()
    expect(legendCard()).toBeNull()
    active.mockResolvedValue({ status: 'unreachable' })
    await refreshLegend()
    // No answer keeps what the phone had.
    expect(legendCard()).toBeNull()
  })

  it('keeps what it had when a read gets no answer', async () => {
    await refreshLegend()
    active.mockResolvedValue({ status: 'unreachable' })
    await refreshLegend()
    expect(legendCard()?.id).toBe('legend-1')
    expect(legendStanding()?.best).toBe(82)
  })

  it("keeps the singer's own best for their account alone", async () => {
    await refreshLegend()
    expect(legendStanding()).toMatchObject({ best: 82, completed: true })
    auth.as('acc-2')
    expect(legendStanding()).toBeNull()
    auth.as(null)
    expect(legendStanding()).toBeNull()
    // The Legend itself is public: kept for anyone.
    expect(legendCard()?.id).toBe('legend-1')
  })

  it('asks no board for a phone with no account', async () => {
    auth.as(null)
    await refreshLegend()
    expect(boardOf).not.toHaveBeenCalled()
    expect(legendCard()?.id).toBe('legend-1')
  })

  it('keeps no other singer’s name on the phone', async () => {
    await refreshLegend()
    const raw = localStorage.getItem('mp:legend-card') ?? ''
    expect(raw).toContain('Vincero')
    expect(raw).not.toContain('Ana')
  })

  it('shares one read between asks that overlap', async () => {
    await Promise.all([refreshLegend(), refreshLegend()])
    expect(active).toHaveBeenCalledTimes(1)
  })
})

describe('reading in the background', () => {
  it('reads once at a cold start from the shell’s mount', async () => {
    const dispose = createRoot((done) => {
      onMount(() => {
        stop = installLegendRefresh()
      })
      return done
    })
    await settle()
    expect(active).toHaveBeenCalledTimes(1)
    expect(legendStanding()?.best).toBe(82)
    dispose()
  })

  it('does not read again on a return while what it kept holds', async () => {
    stop = installLegendRefresh()
    await settle()
    document.dispatchEvent(new Event('visibilitychange'))
    await settle()
    expect(active).toHaveBeenCalledTimes(1)
  })

  it('reads again on a return once its Legend has closed, however fresh', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
    active.mockResolvedValue(
      ok(legend({ endsAt: new Date(NOW + 60_000).toISOString() })),
    )
    stop = installLegendRefresh()
    await settle()
    vi.spyOn(Date, 'now').mockReturnValue(NOW + 2 * 60_000)
    document.dispatchEvent(new Event('visibilitychange'))
    await settle()
    expect(active).toHaveBeenCalledTimes(2)
  })

  it('reads again on a return once the kept read is stale', async () => {
    stop = installLegendRefresh()
    await settle()
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + LEGEND_FRESH_MS + 1)
    document.dispatchEvent(new Event('visibilitychange'))
    await settle()
    expect(active).toHaveBeenCalledTimes(2)
  })

  it('reads again for an account that signs in, and lets the last one’s best go', async () => {
    stop = installLegendRefresh()
    await settle()
    boardOf.mockResolvedValue(board(64))
    auth.as('acc-2')
    expect(legendStanding()).toBeNull()
    await settle()
    expect(legendStanding()).toMatchObject({ accountId: 'acc-2', best: 64 })
  })

  it('reads again once a take is posted', async () => {
    stop = installLegendRefresh()
    await settle()
    boardOf.mockResolvedValue(board(91))
    posted.bump()
    await settle()
    expect(legendStanding()?.best).toBe(91)
  })
})
