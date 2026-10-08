// ============================================================
// A voiceprint with no practice yet still gets a Progress page
// ============================================================
//
// Signed out, a device can hold takes made under an account. Progress used
// to count only the anonymous ones, found none, and showed the empty "finish
// one practice" surface while Settings listed every take. With a voiceprint
// and no runs, the page shows the reading and points at a first exercise,
// the surface that actually banks a record.
//
// The real page is rendered from a real model, like the empty-action test,
// so this fails if the route falls back to the empty surface or the moment
// loses its action.

import { afterEach, describe, expect, it, vi } from 'vitest'

const routeMocks = vi.hoisted(() => ({
  loadProgressModel: vi.fn(),
  trackEvent: vi.fn(),
}))

vi.mock('@/db/services/auth-service', () => ({ accountHeld: () => false }))
vi.mock('@/db/services/session-service', () => ({
  sessionRecordVersion: () => 0,
}))
vi.mock('@/lib/analytics', () => ({ trackEvent: routeMocks.trackEvent }))
vi.mock('./progress-data', () => ({
  loadProgressModel: routeMocks.loadProgressModel,
}))

import { cleanup, render, screen, waitFor } from '@solidjs/testing-library'
import { buildProgressModel } from './model'
import { isProgressEmpty, ProgressRoute } from './ProgressRoute'

/** Signed out, one device take, nothing practiced. */
const readingOnly = buildProgressModel(
  {
    records: [],
    voiceprints: [
      {
        id: 'reading',
        takenAt: '2026-08-10T10:00:00.000Z',
        source: 'mirror',
        twin: 'Frank Sinatra',
        summary: {
          lowMidi: 48,
          highMidi: 69,
          semitones: 21,
          accuracy: 88,
          steadiness: 77,
        },
      },
    ],
    voiceprintHistory: { complete: true, totalAvailable: 1, comparable: false },
    badgeDefinitions: [],
    userBadges: [],
    achievementDefinitions: [],
    userAchievements: [],
    challengeDefinitions: [],
    activityRows: [],
    recentActivity: [],
    league: null,
  },
  { now: new Date('2026-08-11T12:00:00.000Z') },
)

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ProgressRoute with a voiceprint and no practice', () => {
  it('is a fixture the route will not treat as empty', () => {
    expect(isProgressEmpty(readingOnly)).toBe(false)
  })

  it('shows the reading and opens Exercises from it', async () => {
    routeMocks.loadProgressModel.mockResolvedValue(readingOnly)

    render(() => <ProgressRoute />)

    await waitFor(() =>
      expect(
        screen.getAllByText('You share a range with Frank Sinatra.').length,
      ).toBeGreaterThan(0),
    )
    expect(
      screen.queryByText(
        'Finish one practice and this surface starts holding your story.',
      ),
    ).toBeNull()

    const ctas = screen.getAllByRole('link', { name: /Start an exercise/ })
    expect(ctas.length).toBeGreaterThan(0)
    for (const cta of ctas) expect(cta).toHaveAttribute('href', '#/exercises')
  })
})
