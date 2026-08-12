import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProgressPageSnapshot } from './ProgressPage'
import { ProgressPage } from './ProgressPage'

afterEach(() => cleanup())

function snapshot(): ProgressPageSnapshot {
  return {
    periodLabel: 'Last 13 weeks',
    periodContext: 'All recorded voice practice',
    activePeriodId: '13-weeks',
    periodOptions: [
      { id: '7-days', label: '7 days' },
      { id: '13-weeks', label: '13 weeks' },
    ],
    selectedWeekId: 'week-one',
    moment: {
      id: 'moment-returned',
      kindLabel: 'Consistency',
      title: 'You returned four weeks in a row.',
      context: 'Last 13 weeks · all recorded voice practice',
      evidence: [
        { id: 'weeks', label: 'Active weeks', value: '4' },
        { id: 'days', label: 'Active days', value: '8' },
      ],
      reason: 'A fourth active week made this the clearest recent pattern.',
      confidenceLabel: 'Derived from completed sessions.',
      primaryAction: {
        id: 'repeat-long-note',
        label: 'Repeat Long Note',
        href: '#exercises/long-note',
      },
      shareable: true,
    },
    alternateMoments: [
      {
        id: 'moment-challenge',
        kindLabel: 'Challenge',
        title: 'You finished this week’s Legend.',
      },
    ],
    weeks: [
      {
        id: 'week-one',
        shortLabel: 'May 18',
        rangeLabel: 'May 18–24',
        activityLevel: 0.4,
        activeDaysLabel: '2 active days',
        attemptsLabel: '3 attempts',
        summary: 'Two active days across practice and exercise.',
        sources: ['practice', 'exercise'],
        coverage: 'complete',
      },
      {
        id: 'week-two',
        shortLabel: 'May 25',
        rangeLabel: 'May 25–31',
        activityLevel: 0.7,
        activeDaysLabel: '3 active days',
        attemptsLabel: '5 attempts',
        summary: 'Three active days including a Weekly Legend.',
        sources: ['weekly', 'practice'],
        coverage: 'complete',
        milestoneLabel: 'Four active weeks',
      },
    ],
    atlasTrace: {
      label: 'Latest supported challenge contour',
      values: [0.2, 0.48, 0.31, 0.8],
    },
    rhythm: {
      title: 'Four active weeks, held together.',
      summary: 'Eight active days across four recorded practice weeks.',
      facts: [
        { id: 'current', label: 'Current streak', value: '4 weeks' },
        { id: 'longest', label: 'Longest', value: '6 weeks' },
      ],
    },
    skillThreads: [
      {
        id: 'long-note-v2',
        label: 'Long Note',
        context: 'Same exercise · version 2',
        metricLabel: 'Steadiness',
        summary: 'Three comparable readings.',
        points: [
          { id: 'one', label: 'Earlier', value: '72%', level: 0.72 },
          { id: 'two', label: 'Middle', value: '75%', level: 0.75 },
          { id: 'three', label: 'Latest', value: '78%', level: 0.78 },
        ],
      },
    ],
    voice: {
      title: 'Your voice, in its latest measured shape.',
      twinName: 'Freddie Mercury',
      measuredAtLabel: 'Mapped August 8',
      description:
        'Range and steadiness are shown without turning them into one score.',
      metrics: [
        { id: 'range', label: 'Measured range', value: 'C3–A4' },
        { id: 'steady', label: 'Steadiness', value: '78%' },
      ],
      trace: {
        label: 'Latest supported voiceprint contour',
        values: [0.1, 0.45, 0.7, 0.54],
      },
      actions: [
        {
          id: 'constellation',
          label: 'Explore constellation',
          href: '#voice-constellation',
        },
      ],
    },
    paths: {
      summary: 'Exercises and challenges form the strongest recent route.',
      segments: [
        {
          id: 'exercise',
          label: 'Long Note',
          detail: 'Three comparable attempts',
          source: 'exercise',
          status: 'visited',
        },
        {
          id: 'weekly',
          label: 'Weekly Legend',
          detail: 'Completed this week',
          source: 'weekly',
          status: 'current',
        },
      ],
      recommendation: {
        id: 'return',
        label: 'Return to Long Note',
        href: '#exercises/long-note',
      },
      recommendationReason: 'It is your clearest comparable thread.',
    },
    milestones: [
      {
        id: 'badge',
        title: 'Steady Return',
        kindLabel: 'Badge',
        earnedAtLabel: 'Earned August 7',
        detail: 'Practised in four consecutive weeks.',
      },
    ],
    league: {
      title: 'Silver League',
      rankLabel: 'Rank 7',
      periodLabel: 'This week',
      zoneLabel: 'Holding zone',
    },
    history: {
      summary: 'Every row states what was recorded and where it lives.',
      activeFilterId: 'all',
      filters: [
        { id: 'all', label: 'All' },
        { id: 'exercise', label: 'Exercises' },
      ],
      items: [
        {
          id: 'history-one',
          occurredAtLabel: 'August 8',
          title: 'Long Note completed',
          context: 'Version 2',
          facts: ['78% steadiness'],
          storageLabel: 'On this device',
          source: 'exercise',
          action: {
            id: 'open-analysis',
            label: 'Open',
            href: '#analysis',
          },
        },
      ],
    },
    coverage: {
      scopeLabel: 'On this device',
      detail: 'Detailed timing is available for recent recorded practice.',
      status: 'partial',
      boundaryLabel: 'Detailed timing available from August 1.',
    },
  }
}

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
