// ============================================================
// The empty Atlas sends the singer somewhere that can fill it
// ============================================================
//
// The empty-state CTA is the one action the route hardcodes — there is no
// history to derive it from. It used to point at `#/singing`, but a plain
// Singing take never banks a progress record (only the far less discoverable
// session-mode run does); an exercise always does, through
// `recordExerciseResult`. So the button that promises to start your story
// must open the Exercises tab.
//
// The model is really empty and the real page is rendered, so this fails if
// the link is wrong, if the empty surface stops offering it, or if the route
// stops reaching the empty state at all. Asserting the prop against a stubbed
// page would pass while the resource was still loading — with the CTA never
// on screen.

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

/** A singer who has finished nothing yet: every source readable, no records. */
const nothingYet = buildProgressModel(
  {
    records: [],
    voiceprints: [],
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

describe('ProgressRoute empty-state action', () => {
  it('is a fixture the route will actually treat as empty', () => {
    // Guards the test itself: a model that stopped counting as empty would
    // otherwise send the assertion below looking for a surface that never
    // renders, and it would fail for the wrong reason.
    expect(isProgressEmpty(nothingYet)).toBe(true)
  })

  it('opens the Exercises tab, the surface that actually banks a record', async () => {
    routeMocks.loadProgressModel.mockResolvedValue(nothingYet)

    render(() => <ProgressRoute />)

    // The empty surface, not the loading one — this is the copy only it has.
    await waitFor(() =>
      expect(
        screen.getByText(
          'Finish one practice and this surface starts holding your story.',
        ),
      ).toBeInTheDocument(),
    )

    const cta = screen.getByRole('link', { name: /Start an exercise/ })
    expect(cta).toHaveAttribute('href', '#/exercises')
  })
})
