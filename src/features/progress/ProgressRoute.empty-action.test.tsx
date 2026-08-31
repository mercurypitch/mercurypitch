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
vi.mock('./ProgressPage', () => ({
  ProgressPage: function MockProgressPage(props: {
    emptyAction?: { id: string; label: string; href?: string }
  }) {
    return (
      <div
        data-testid="mock-progress-page"
        data-empty-href={props.emptyAction?.href}
        data-empty-label={props.emptyAction?.label}
      />
    )
  },
}))

import { render, screen, waitFor } from '@solidjs/testing-library'
import { ProgressRoute } from './ProgressRoute'

afterEach(() => {
  vi.clearAllMocks()
})

describe('ProgressRoute empty-state action', () => {
  it('opens the Exercises tab, the surface that actually banks a record', async () => {
    routeMocks.loadProgressModel.mockReturnValue(new Promise(() => {}))

    render(() => <ProgressRoute />)

    const page = await waitFor(() => screen.getByTestId('mock-progress-page'))
    expect(page.getAttribute('data-empty-href')).toBe('#/exercises')
    expect(page.getAttribute('data-empty-label')).toBe('Start an exercise')
  })
})
