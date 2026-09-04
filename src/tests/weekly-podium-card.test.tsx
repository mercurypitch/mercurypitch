// ============================================================
// The result of a closed challenge, on the card that replays it
// ============================================================
//
// The podium was frozen into `resultsJson` when the window shut, and the
// archive endpoint has been shipping it as `results` all along — the card
// simply never read it, so a challenge's result vanished the moment it
// stopped being the live one.
//
// Two shapes have to render. Version 2 rows carry `userId` and `rank` and may
// arrive with an entry redacted, because a singer who has since opted out of
// public boards keeps their place and loses their name. Version 1 rows —
// every challenge closed before consent was asked for — carry neither, and
// are the only record of those weeks, so they must still draw.

import { render, screen, waitFor } from '@solidjs/testing-library'
import { cleanup } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as WeeklyService from '@/features/challenges/weekly-service'
import type { WeeklyResults } from '@/features/challenges/weekly-service'
import { podiumOf } from '@/features/challenges/weekly-service'

let archive: unknown[] = []

vi.mock('@/features/challenges/weekly-service', async () => {
  // `podiumOf` is the thing under test; only the fetch is stubbed.
  const actual = await vi.importActual<typeof WeeklyService>(
    '@/features/challenges/weekly-service',
  )
  return { ...actual, getWeeklyArchive: () => Promise.resolve(archive) }
})

vi.mock('@/features/challenges/weekly-attempt', () => ({
  clearWeeklyAttempt: () => {},
}))

vi.mock('@/stores/ui-store', () => ({ openChallengeStage: () => {} }))

const { PastWeeklyChallenges } =
  await import('@/features/challenges/PastWeeklyChallenges')

function challenge(id: string, results: WeeklyResults | null): unknown {
  return {
    id,
    slug: id,
    title: `Challenge ${id}`,
    description: 'A closed one',
    featType: 'money-note',
    voiceTypeSplit: null,
    difficulty: 'advanced',
    targetItems: [],
    targetScore: 70,
    hearItUrl: null,
    startsAt: '2026-08-03T00:00:00.000Z',
    endsAt: '2026-08-31T00:00:00.000Z',
    rewardBadgeId: null,
    founderScore: null,
    results,
  }
}

async function show(rows: unknown[]): Promise<void> {
  archive = rows
  render(() => <PastWeeklyChallenges />)
  await waitFor(() => screen.getByText('Challenge c1'))
}

afterEach(() => {
  archive = []
  cleanup()
})

describe('the frozen podium', () => {
  it('names the first three and what they scored', async () => {
    await show([
      challenge('c1', {
        version: 2,
        top3: [
          { userId: 'u1', displayName: 'Alto', best: 97, rank: 1 },
          { userId: 'u2', displayName: 'Tenor', best: 95, rank: 2 },
          { userId: 'u3', displayName: 'Bass', best: 91, rank: 3 },
        ],
        attemptedCount: 17,
        completedCount: 6,
        closedAt: '2026-09-02T00:20:33.088Z',
      }),
    ])

    const rows = [...screen.getByTestId('podium-c1').querySelectorAll('li')]
    expect(rows.map((li) => li.textContent)).toEqual([
      'Alto97%',
      'Tenor95%',
      'Bass91%',
    ])
  })

  it('draws the medal each place earned, not a number', async () => {
    // The same file as the badge in the winner's cabinet — the trophy shown
    // where it was won. A numbered ring said "1" and connected to nothing.
    await show([
      challenge('c1', {
        version: 2,
        top3: [
          { userId: 'u1', displayName: 'Alto', best: 97, rank: 1 },
          { userId: 'u2', displayName: 'Tenor', best: 95, rank: 2 },
          { userId: 'u3', displayName: 'Bass', best: 91, rank: 3 },
        ],
        attemptedCount: 17,
        completedCount: 6,
        closedAt: '2026-09-02T00:20:33.088Z',
      }),
    ])

    const medals = [...screen.getByTestId('podium-c1').querySelectorAll('img')]
    expect(medals.map((img) => img.getAttribute('src'))).toEqual([
      '/badges/firstvoice.webp',
      '/badges/secondvoice.webp',
      '/badges/thirdvoice.webp',
    ])
    expect(medals.map((img) => img.getAttribute('alt'))).toEqual([
      'Place 1',
      'Place 2',
      'Place 3',
    ])
  })

  it('reports how many sang and how many finished', async () => {
    await show([
      challenge('c1', {
        version: 2,
        top3: [{ userId: 'u1', displayName: 'Alto', best: 97, rank: 1 }],
        attemptedCount: 17,
        completedCount: 6,
        closedAt: '2026-09-02T00:20:33.088Z',
      }),
    ])
    expect(screen.getByText(/17 sang this/)).toBeTruthy()
    expect(screen.getByText(/6 completed/)).toBeTruthy()
  })

  it('marks a withdrawn singer redacted without moving anyone up', async () => {
    await show([
      challenge('c1', {
        version: 2,
        top3: [
          { displayName: null, best: 97, rank: 1, redacted: true },
          { userId: 'u2', displayName: 'Tenor', best: 95, rank: 2 },
        ],
        attemptedCount: 17,
        completedCount: 6,
        closedAt: '2026-09-02T00:20:33.088Z',
      }),
    ])

    const rows = [...screen.getByTestId('podium-c1').querySelectorAll('li')]
    // The score and the place are the record and stay; only the name goes.
    expect(rows.map((li) => li.textContent)).toEqual([
      '<redacted>97%',
      'Tenor95%',
    ])
    // A withdrawn name still won: the medal stays on the row.
    expect(rows[0].querySelector('img')?.getAttribute('src')).toBe(
      '/badges/firstvoice.webp',
    )
  })

  it('draws a version 1 row, numbering it by position', async () => {
    await show([
      challenge('c1', {
        top3: [
          { displayName: 'Singer-8df2', best: 97 },
          { displayName: 'Singer-7822', best: 95 },
        ],
        attemptedCount: 17,
        completedCount: 6,
        closedAt: '2026-09-02T00:20:33.088Z',
      } as WeeklyResults),
    ])

    const rows = [...screen.getByTestId('podium-c1').querySelectorAll('li')]
    expect(rows.map((li) => li.textContent)).toEqual([
      'Singer-8df297%',
      'Singer-782295%',
    ])
    // Position stands in for the missing rank, medals included.
    expect(
      rows.map((li) => li.querySelector('img')?.getAttribute('src')),
    ).toEqual(['/badges/firstvoice.webp', '/badges/secondvoice.webp'])
  })

  it('shows no podium for a challenge that was closed without one', async () => {
    // Closed by hand before results were snapshotted. The card still offers
    // the melody as practice — the point of the archive — with no result.
    await show([challenge('c1', null)])
    expect(screen.queryByTestId('podium-c1')).toBeNull()
    expect(screen.getByLabelText('Practise Challenge c1')).toBeTruthy()
  })

  it('shows no podium when nobody consented to be named', async () => {
    await show([
      challenge('c1', {
        version: 2,
        top3: [],
        attemptedCount: 4,
        completedCount: 1,
        closedAt: '2026-09-02T00:20:33.088Z',
      }),
    ])
    expect(screen.queryByTestId('podium-c1')).toBeNull()
  })

  it('never draws more than three places', async () => {
    await show([
      challenge('c1', {
        version: 2,
        top3: [
          { userId: 'u1', displayName: 'One', best: 97, rank: 1 },
          { userId: 'u2', displayName: 'Two', best: 95, rank: 2 },
          { userId: 'u3', displayName: 'Three', best: 91, rank: 3 },
          { userId: 'u4', displayName: 'Four', best: 88, rank: 4 },
        ],
        attemptedCount: 17,
        completedCount: 6,
        closedAt: '2026-09-02T00:20:33.088Z',
      }),
    ])
    expect(screen.getByTestId('podium-c1').querySelectorAll('li')).toHaveLength(
      3,
    )
  })
})

// ── The reader itself ───────────────────────────────────────────────
//
// `podiumOf` is total by construction: a row written by an older worker, or a
// row corrupted in transit, yields no podium rather than throwing inside a
// `<For>` and taking the whole archive section down with it.

describe('podiumOf', () => {
  it('reads nothing out of nothing', () => {
    expect(podiumOf(null)).toEqual([])
    expect(podiumOf(undefined)).toEqual([])
  })

  it('survives a results object with no podium in it', () => {
    expect(podiumOf({ attemptedCount: 3 } as unknown as WeeklyResults)).toEqual(
      [],
    )
    expect(
      podiumOf({ top3: 'not an array' } as unknown as WeeklyResults),
    ).toEqual([])
  })

  it('treats a blank name as redacted rather than printing an empty row', () => {
    expect(
      podiumOf({
        top3: [{ displayName: '', best: 90, rank: 1 }],
        attemptedCount: 1,
        completedCount: 1,
        closedAt: '',
      }),
    ).toEqual([{ rank: 1, displayName: null, best: 90 }])
  })

  it('rounds a score that arrived unrounded', () => {
    expect(
      podiumOf({
        top3: [{ displayName: 'Alto', best: 90.6, rank: 1 }],
        attemptedCount: 1,
        completedCount: 1,
        closedAt: '',
      })[0].best,
    ).toBe(91)
  })
})
