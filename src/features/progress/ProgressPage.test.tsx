import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { snapshot } from './progress-snapshot.fixture'
import { ProgressPage } from './ProgressPage'

afterEach(() => cleanup())

describe('ProgressPage', () => {
  it('renders one leading moment and every progress chapter from semantic data', () => {
    render(() => <ProgressPage status="ready" snapshot={snapshot()} />)

    expect(screen.getByRole('heading', { name: 'Progress' })).toBeVisible()
    expect(
      screen.getByRole('heading', {
        name: 'You returned four weeks in a row.',
      }),
    ).toBeVisible()
    expect(
      screen.getByRole('group', { name: /Practice by week/ }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', {
        name: 'Four active weeks, held together.',
      }),
    ).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Skill Threads' })).toBeVisible()
    expect(screen.getByRole('heading', { name: /Your voice/ })).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Practice Paths' }),
    ).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Milestones' })).toBeVisible()
    expect(
      screen.getByRole('list', { name: /Earned milestones/ }),
    ).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('heading', { name: 'History' })).toBeVisible()
    expect(
      screen.getByText('Detailed timing available from August 1.'),
    ).toBeVisible()
  })

  it('moves the Atlas selection with arrow keys and exposes the selected evidence', () => {
    const onWeekSelect = vi.fn()
    render(() => (
      <ProgressPage
        status="ready"
        snapshot={snapshot()}
        onWeekSelect={onWeekSelect}
      />
    ))

    const atlas = screen.getByRole('group', { name: /Practice by week/ })
    fireEvent.keyDown(atlas, { key: 'ArrowRight' })

    expect(onWeekSelect).toHaveBeenCalledWith('week-two')
    expect(
      screen.getByText('Three active days including a Weekly Legend.'),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: /May 25–31/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('opens the attached evidence drawer and delegates period, moment, and share actions', () => {
    const onPeriodChange = vi.fn()
    const onMomentSelect = vi.fn()
    const onShareMoment = vi.fn()
    render(() => (
      <ProgressPage
        status="ready"
        snapshot={snapshot()}
        onPeriodChange={onPeriodChange}
        onMomentSelect={onMomentSelect}
        onShareMoment={onShareMoment}
      />
    ))

    const drawer = screen.getByRole('button', { name: 'View evidence' })
    expect(drawer).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(drawer)
    expect(drawer).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(screen.getByRole('button', { name: '7 days' }))
    fireEvent.click(
      screen.getByRole('button', {
        name: /You finished this week’s Legend/,
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Share this moment' }))

    expect(onPeriodChange).toHaveBeenCalledWith('7-days')
    expect(onMomentSelect).toHaveBeenCalledWith('moment-challenge')
    expect(onShareMoment).toHaveBeenCalledWith('moment-returned')
  })

  it('explains why the leading moment was selected without expanding the inspector', () => {
    render(() => <ProgressPage status="ready" snapshot={snapshot()} />)

    const trigger = screen.getByRole('button', {
      name: 'Why this moment was selected',
    })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(trigger)

    const explanation = screen.getByRole('tooltip')
    expect(explanation).toHaveTextContent(
      'A fourth active week made this the clearest recent pattern.',
    )
    expect(explanation).toHaveTextContent('Derived from completed sessions.')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('teaches the empty state without presenting zero-valued performance', () => {
    const onAction = vi.fn()
    render(() => (
      <ProgressPage
        status="empty"
        emptyAction={{ id: 'start', label: 'Start a practice' }}
        onAction={onAction}
      />
    ))

    expect(
      screen.getByRole('heading', {
        name: 'Finish one practice and this surface starts holding your story.',
      }),
    ).toBeVisible()
    expect(screen.queryByText(/0%|0 sessions|0 days/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Start a practice' }))
    expect(onAction).toHaveBeenCalledWith({
      id: 'start',
      label: 'Start a practice',
    })
  })

  it('preserves a valid snapshot while reporting a refresh error', () => {
    const onRetry = vi.fn()
    render(() => (
      <ProgressPage
        status="error"
        snapshot={snapshot()}
        errorMessage="League updates are temporarily unavailable."
        onRetry={onRetry}
      />
    ))

    expect(
      screen.getByRole('heading', {
        name: 'You returned four weeks in a row.',
      }),
    ).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'League updates are temporarily unavailable.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})

describe('the cabinet', () => {
  it('shows every badge and achievement with where the singer stands', () => {
    render(() => <ProgressPage status="ready" snapshot={snapshot()} />)

    expect(
      screen.getByRole('heading', { name: 'Badges and achievements' }),
    ).toBeVisible()

    // Earned and locked tiles are both on the wall; only one wears the tick.
    const earned = screen.getByTestId('cabinet-badge-steady-return')
    expect(earned).toHaveTextContent('Steady Return')
    expect(earned.querySelector('[title="Earned"]')).not.toBeNull()
    const locked = screen.getByTestId('cabinet-badge-first-legend')
    expect(locked).toHaveTextContent('First Legend')
    expect(locked.querySelector('[title="Earned"]')).toBeNull()

    // The bar carries the percentage; the label carries the count behind it.
    expect(
      screen.getByRole('progressbar', { name: 'Ten Runs: 3 / 10' }),
    ).toHaveAttribute('aria-valuenow', '30')
    expect(screen.getByRole('heading', { name: 'Beginnings' })).toBeVisible()
  })

  it('says when the marks cannot be loaded rather than showing an empty wall', () => {
    const offline = {
      ...snapshot(),
      cabinet: { ...snapshot().cabinet!, available: false },
    }
    render(() => <ProgressPage status="ready" snapshot={offline} />)

    expect(
      screen.getByText(/Reconnect to load your badges and achievements/),
    ).toBeVisible()
    expect(screen.queryByTestId('cabinet-badge-steady-return')).toBeNull()
  })
})
