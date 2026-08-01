// ============================================================
// UserSurveyModal — dismissal hardening + feedback mode
// ============================================================

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db/services/survey-service', () => ({
  submitSurvey: vi.fn().mockResolvedValue({ id: 'r1' }),
}))

import UserSurveyModal from '@/components/UserSurveyModal'
import { submitSurvey } from '@/db/services/survey-service'

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const skip = () => screen.getByTestId('survey-skip')
const submit = () => screen.getByTestId('survey-submit')

describe('UserSurveyModal — accidental dismissal', () => {
  // The modal can arrive while hands are already moving; a click meant for the
  // app must not land on Skip and burn the one prompt this browser ever gets.
  it('holds Skip inert until the arming delay passes', async () => {
    const onClose = vi.fn()
    render(() => <UserSurveyModal onClose={onClose} />)

    expect(skip()).toBeDisabled()
    fireEvent.click(skip())
    expect(onClose).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(3200)
    await waitFor(() => expect(skip()).not.toBeDisabled())
    fireEvent.click(skip())
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('counts down so the disabled button explains itself', () => {
    render(() => <UserSurveyModal onClose={vi.fn()} />)
    expect(skip().textContent).toMatch(/Skip \(\d\)/)
  })

  // Clicking the backdrop was the same trap as Skip, and easier to hit.
  it('ignores a backdrop click until armed, then honours it', async () => {
    const onClose = vi.fn()
    render(() => <UserSurveyModal onClose={onClose} />)
    const overlay = screen.getByTestId('user-survey-modal')

    fireEvent.click(overlay)
    expect(onClose).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(3200)
    fireEvent.click(overlay)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('UserSurveyModal — empty responses', () => {
  it('will not send a response with nothing in it', () => {
    render(() => <UserSurveyModal onClose={vi.fn()} />)
    expect(submit()).toBeDisabled()
    fireEvent.click(submit())
    expect(submitSurvey).not.toHaveBeenCalled()
  })

  it('enables Submit as soon as one answer is given', async () => {
    render(() => <UserSurveyModal onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Guitarist'))
    await waitFor(() => expect(submit()).not.toBeDisabled())
    fireEvent.click(submit())
    await waitFor(() => expect(submitSurvey).toHaveBeenCalledTimes(1))
    expect(vi.mocked(submitSurvey).mock.calls[0][0].background).toEqual([
      'guitarist',
    ])
  })
})

describe('UserSurveyModal — feedback mode', () => {
  // Opened deliberately from Settings: they are already looking at it, so a
  // delay would only be in the way.
  it('is dismissable immediately and drops the welcome copy', () => {
    const onClose = vi.fn()
    render(() => <UserSurveyModal mode="feedback" onClose={onClose} />)

    expect(skip()).not.toBeDisabled()
    expect(skip().textContent).toContain('Close')
    expect(
      screen.queryByText('Welcome to MercuryPitch'),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Share your feedback')).toBeInTheDocument()

    fireEvent.click(skip())
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('still refuses an empty response', () => {
    render(() => <UserSurveyModal mode="feedback" onClose={vi.fn()} />)
    expect(submit()).toBeDisabled()
  })
})
