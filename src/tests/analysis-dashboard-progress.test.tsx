// ============================================================
// The Progress card, wired — the bug end to end
// ============================================================
//
// Reported as: "in Vocal Analysis under 'progress', I cannot get the
// exercises count to go up". The count came from the device-local practice
// history, which exercises are never written to, so it could not go up.
//
// These tests mount the real dashboard with the two stores mocked, and
// assert on the number a signed-in singer actually reads.

import { cleanup, render, screen, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionRecord } from '@/db/entities'

const mocks = vi.hoisted(() => ({
  hasValidToken: vi.fn(() => true),
  loadSessionRecords: vi.fn(async (_limit?: number) => [] as SessionRecord[]),
  getSessionHistory: vi.fn(() => [] as unknown[]),
}))

vi.mock('@/db/services/auth-service', () => ({
  hasValidToken: mocks.hasValidToken,
}))
vi.mock('@/db/services/session-service', () => ({
  loadSessionRecords: mocks.loadSessionRecords,
  sessionRecordVersion: () => 0,
}))
vi.mock('@/db/services/streak-service', () => ({
  getStreakState: async () => null,
}))
vi.mock('@/lib/use-supporter-features', () => ({
  useSupporterFeatures: () => ({
    perks: () => null,
    hasFeature: () => false,
  }),
}))
vi.mock('@/features/analysis/use-live-capture', () => ({
  useLiveCapture: () => ({
    isActive: () => false,
    stop: () => {},
    start: () => {},
  }),
}))
vi.mock('@/features/analysis/takes', () => ({
  listTakes: () => [],
  LIVE_TAKE_ID: 'live',
}))
vi.mock('@/stores', () => ({
  getSessionHistory: mocks.getSessionHistory,
}))

const { AnalysisDashboard } =
  await import('@/features/analysis/AnalysisDashboard')

function cloudRun(id: string, source: SessionRecord['source']): SessionRecord {
  return {
    id,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    userId: 'u1',
    melodyName: 'Warmup',
    startedAt: '2026-08-01T10:00:00.000Z',
    endedAt: '2026-08-01T10:05:00.000Z',
    score: 72,
    accuracy: 72,
    notesHit: 4,
    notesTotal: 4,
    streak: 1,
    results: [],
    source,
  } as SessionRecord
}

function tile(label: string): HTMLElement | null {
  return screen.getByText(label).parentElement
}

beforeEach(() => {
  mocks.hasValidToken.mockReturnValue(true)
  mocks.loadSessionRecords.mockResolvedValue([])
  mocks.getSessionHistory.mockReturnValue([])
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Vocal Analysis > Progress', () => {
  it('counts the account’s exercises and challenges when signed in', async () => {
    mocks.loadSessionRecords.mockResolvedValue([
      cloudRun('a', 'exercise'),
      cloudRun('b', 'exercise'),
      cloudRun('c', 'challenge'),
    ])

    render(() => <AnalysisDashboard />)

    // The regression: this read 0 while three runs sat in the account.
    await waitFor(() => expect(tile('Runs')).toHaveTextContent('3'))
    expect(
      screen.getByText('Exercise').previousElementSibling,
    ).toHaveTextContent('2')
    expect(
      screen.getByText('Challenge').previousElementSibling,
    ).toHaveTextContent('1')
    expect(screen.getByText(/across your account/i)).toBeInTheDocument()
  })

  it('falls back to this device’s history when nobody is signed in', async () => {
    mocks.hasValidToken.mockReturnValue(false)
    mocks.getSessionHistory.mockReturnValue([
      { completedAt: 1_700_000_000_000, score: 55, practiceItemResult: [] },
    ])

    render(() => <AnalysisDashboard />)

    await waitFor(() => expect(tile('Runs')).toHaveTextContent('1'))
    expect(screen.getByText(/on this device only/i)).toBeInTheDocument()
    expect(mocks.loadSessionRecords).not.toHaveBeenCalled()
  })

  it('reads zero, and says whose zero it is, before anything is loaded', () => {
    render(() => <AnalysisDashboard />)
    expect(tile('Runs')).toHaveTextContent('0')
  })

  it('opens the guide from the pill row', async () => {
    render(() => <AnalysisDashboard />)

    const explain = await screen.findByRole('button', {
      name: /what counts here/i,
    })
    explain.click()

    expect(await screen.findByTestId('what-counts-modal')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'What counts where' }),
    ).toBeInTheDocument()
  })
})
