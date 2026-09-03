// ============================================================
// Nobody is put on a public board without being asked
// ============================================================
//
// A ranked take publishes a display name beside a score, and the podium of a
// closed challenge keeps it — that is the point of the podium. So the consent
// is collected before the take, not inferred from having taken one.
//
// The failure this guards is quiet in every direction: a gate that asks but
// starts the attempt anyway, a decline that silently starts a ranked run, and
// a consent write that fails while the attempt proceeds as though it had not.
// None of those show up on screen, and all three publish a name.

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { cleanup } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const began: unknown[] = []
const staged: Array<{ mode: string }> = []
const notes: Array<{ message: string; kind: string }> = []
let consented = false
let consentWriteSucceeds = true
let consentWrites = 0
let boardResponse: unknown = null

const CHALLENGE = {
  id: 'c1',
  slug: 'c1',
  title: 'The Impossible Note',
  description: 'Hold the B4',
  featType: 'money-note',
  voiceTypeSplit: null,
  difficulty: 'advanced',
  targetItems: [],
  targetScore: 70,
  hearItUrl: null,
  startsAt: '2026-08-31T00:00:00.000Z',
  endsAt: '2026-09-28T00:00:00.000Z',
  rewardBadgeId: null,
  founderScore: null,
}

vi.mock('@/features/challenges/board-consent', () => ({
  hasBoardConsent: () => Promise.resolve(consented),
  grantBoardConsent: () => {
    consentWrites += 1
    if (consentWriteSucceeds) consented = true
    return Promise.resolve(consentWriteSucceeds)
  },
}))

vi.mock('@/features/challenges/weekly-service', () => ({
  getActiveWeekly: () => Promise.resolve(CHALLENGE),
  getWeeklyBoard: () => Promise.resolve(boardResponse),
  hoursUntil: () => 72,
}))

vi.mock('@/features/challenges/weekly-attempt', () => ({
  beginWeeklyAttempt: (a: unknown) => began.push(a),
  clearWeeklyAttempt: () => {},
  weeklyAttemptVersion: () => 0,
}))

vi.mock('@/stores/ui-store', () => ({
  openChallengeStage: (o: { mode: string }) => staged.push(o),
  setActiveTab: () => {},
}))

vi.mock('@/stores/notifications-store', () => ({
  showNotification: (message: string, kind: string) =>
    notes.push({ message, kind }),
}))

vi.mock('@/features/challenges/PastWeeklyChallenges', () => ({
  requestPastChallengesScroll: () => {},
}))

const { WeeklyLegendHero } =
  await import('@/features/challenges/WeeklyLegendHero')

async function openHero(): Promise<void> {
  render(() => <WeeklyLegendHero />)
  await waitFor(() => screen.getByText('Sing it'))
}

async function tapSingIt(): Promise<void> {
  fireEvent.click(screen.getByText('Sing it'))
}

beforeEach(() => {
  began.length = 0
  staged.length = 0
  notes.length = 0
  consented = false
  consentWriteSucceeds = true
  consentWrites = 0
  boardResponse = null
})

afterEach(() => {
  cleanup()
})

describe('the first ranked take', () => {
  it('asks before starting anything', async () => {
    await openHero()
    await tapSingIt()

    await waitFor(() => screen.getByText('Sing it for the board?'))
    // Nothing has begun: the dialog is a gate, not a notice shown alongside
    // an attempt that already started.
    expect(began).toEqual([])
    expect(staged).toEqual([])
  })

  it('records the consent and then takes the attempt', async () => {
    await openHero()
    await tapSingIt()
    await waitFor(() => screen.getByText('Sing it for the board?'))

    fireEvent.click(screen.getByText('Put me on the board'))

    await waitFor(() => expect(began).toHaveLength(1))
    expect(consentWrites).toBe(1)
    expect(staged[0].mode).toBe('ranked')
  })

  it('offers the melody as practice when the singer declines', async () => {
    await openHero()
    await tapSingIt()
    await waitFor(() => screen.getByText('Sing it for the board?'))

    fireEvent.click(screen.getByText('Cancel'))

    await waitFor(() => expect(staged).toHaveLength(1))
    // Declining is not a dead end, but it is definitely not a ranked run.
    expect(staged[0].mode).toBe('practice')
    expect(began).toEqual([])
    expect(consentWrites).toBe(0)
  })

  it('does not start a ranked take on a consent that failed to save', async () => {
    consentWriteSucceeds = false
    await openHero()
    await tapSingIt()
    await waitFor(() => screen.getByText('Sing it for the board?'))

    fireEvent.click(screen.getByText('Put me on the board'))

    await waitFor(() => expect(notes).toHaveLength(1))
    expect(notes[0].kind).toBe('error')
    // The score would publish a name no record can show was agreed to.
    expect(began).toEqual([])
    expect(staged).toEqual([])
    // Still open, so the singer can try again rather than losing the attempt.
    expect(screen.getByText('Sing it for the board?')).toBeTruthy()
  })
})

describe('a singer who has already agreed', () => {
  it('goes straight to the attempt with no dialog', async () => {
    consented = true
    await openHero()
    await tapSingIt()

    await waitFor(() => expect(began).toHaveLength(1))
    expect(staged[0].mode).toBe('ranked')
    expect(screen.queryByText('Sing it for the board?')).toBeNull()
    expect(consentWrites).toBe(0)
  })
})

describe('what the board says about you', () => {
  function withYou(you: Record<string, unknown>): void {
    boardResponse = {
      top: [{ rank: 1, displayName: 'Rival', best: 95, isFounder: false }],
      attemptedCount: 2,
      completedCount: 1,
      targetScore: 70,
      founderScore: null,
      frozen: false,
      you,
    }
  }

  it('gives an unranked singer their score and no placing', async () => {
    withYou({
      best: 88,
      rank: 1,
      percentile: 100,
      beatFounder: false,
      completed: true,
      ranked: false,
    })
    await openHero()

    const row = await screen.findByTestId('you-unranked')
    expect(row.textContent).toContain('88%')
    // The one number on this card that would not be real.
    expect(row.textContent).not.toContain('top 100%')
    expect(row.textContent).toContain('not on the board')
  })

  it('shows a ranked singer where they stand', async () => {
    withYou({
      best: 88,
      rank: 2,
      percentile: 100,
      beatFounder: false,
      completed: true,
      ranked: true,
    })
    await openHero()

    await waitFor(() => screen.getByText(/Your best 88%/))
    expect(screen.queryByTestId('you-unranked')).toBeNull()
  })
})
