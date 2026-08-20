// The Progress card counts runs, not plottable points.
// ============================================================
//
// The regression this locks: "Sessions" read `buildTrend(sessions).length`,
// and `buildTrend` drops any run whose items carry no `noteResult`. Runs
// that happened, were scored and were stored still counted as zero.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TrendsCard } from '@/features/analysis/sections'
import type { ProgressRun } from '@/features/progress/run-kinds'
import type { SessionResult } from '@/types'

afterEach(cleanup)

function run(
  kind: ProgressRun['kind'],
  score: number,
  day: number,
): ProgressRun {
  return {
    kind,
    score,
    completedAt: Date.UTC(2026, 0, day),
    hasNoteDetail: false,
  }
}

/** A stored run with no per-note detail — invisible to `buildTrend`. */
function sessionWithoutNotes(score: number): SessionResult {
  return {
    score,
    completedAt: Date.UTC(2026, 0, 1),
    practiceItemResult: [{ noteResult: [] }],
  } as unknown as SessionResult
}

/** A stored run the trend line CAN plot. */
function sessionWithNotes(score: number, day: number): SessionResult {
  return {
    score,
    completedAt: Date.UTC(2026, 0, day),
    practiceItemResult: [
      {
        noteResult: [
          {
            avgCents: 8,
            rating: 'excellent',
            item: { note: { midi: 60 } },
          },
        ],
      },
    ],
  } as unknown as SessionResult
}

function tile(label: string): HTMLElement | null {
  const labelNode = screen.getByText(label)
  return labelNode.parentElement
}

describe('TrendsCard counts', () => {
  it('counts runs the trend line cannot plot', () => {
    const runs = [
      run('exercise', 70, 1),
      run('challenge', 80, 2),
      run('weekly', 90, 3),
    ]
    render(() => (
      <TrendsCard
        sessions={[sessionWithoutNotes(70)]}
        runs={runs}
        streak={null}
      />
    ))

    expect(tile('Runs')).toHaveTextContent('3')
  })

  it('takes the best score from every run, not only the plotted ones', () => {
    render(() => (
      <TrendsCard
        sessions={[]}
        runs={[run('challenge', 91, 1)]}
        streak={null}
      />
    ))

    expect(tile('Best score')).toHaveTextContent('91%')
  })

  it('reads a true zero when nothing has been run', () => {
    render(() => <TrendsCard sessions={[]} runs={[]} streak={null} />)

    expect(tile('Runs')).toHaveTextContent('0')
    expect(tile('Best score')).toHaveTextContent('0%')
  })

  it('breaks the count down by kind', () => {
    render(() => (
      <TrendsCard
        sessions={[]}
        runs={[run('weekly', 60, 1), run('weekly', 65, 2)]}
        streak={null}
      />
    ))

    expect(screen.getByText('Weekly').previousElementSibling).toHaveTextContent(
      '2',
    )
    expect(
      screen.getByText('Practice').previousElementSibling,
    ).toHaveTextContent('0')
  })

  it('says the count is device-only when nobody is signed in', () => {
    render(() => (
      <TrendsCard sessions={[]} runs={[]} scope="device" streak={null} />
    ))
    expect(screen.getByText(/on this device only/i)).toBeInTheDocument()
  })

  it('opens the explanation from the pill row', () => {
    const onExplain = vi.fn()
    render(() => (
      <TrendsCard sessions={[]} runs={[]} onExplain={onExplain} streak={null} />
    ))

    fireEvent.click(screen.getByRole('button', { name: /what counts here/i }))
    expect(onExplain).toHaveBeenCalledTimes(1)
  })

  it('draws the trend once two runs kept pitch detail', () => {
    render(() => (
      <TrendsCard
        sessions={[sessionWithNotes(60, 1), sessionWithNotes(80, 5)]}
        runs={[run('practice', 60, 1), run('practice', 80, 5)]}
        streak={null}
      />
    ))

    expect(
      screen.getByRole('img', {
        name: /Score across recent practice sessions/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Score per session')).toBeInTheDocument()
    // The two ends of the run, so the chart says what period it covers.
    expect(
      screen.getByText(new Date(Date.UTC(2026, 0, 1)).toLocaleDateString()),
    ).toBeInTheDocument()
    expect(
      screen.getByText(new Date(Date.UTC(2026, 0, 5)).toLocaleDateString()),
    ).toBeInTheDocument()
  })

  it('asks for one more run rather than drawing a chart from a single point', () => {
    render(() => (
      <TrendsCard
        sessions={[sessionWithNotes(60, 1)]}
        runs={[run('practice', 60, 1)]}
        streak={null}
      />
    ))

    expect(
      screen.getByText(/One more session and your score trend appears here/i),
    ).toBeInTheDocument()
    // The count is not held back by the chart having nothing to draw.
    expect(tile('Runs')).toHaveTextContent('1')
  })

  it('still shows the streak it is given', () => {
    render(() => (
      <TrendsCard
        sessions={[]}
        runs={[]}
        streak={{
          currentStreak: 4,
          longestStreak: 9,
          freezes: 0,
          maxFreezes: 2,
          practicedToday: true,
          atRisk: false,
          canRepair: false,
          repairableStreak: 0,
        }}
      />
    ))

    expect(tile('Current streak')).toHaveTextContent('4d')
    expect(tile('Best streak')).toHaveTextContent('9d')
    expect(screen.getByText('safe today')).toBeInTheDocument()
  })
})
