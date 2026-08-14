// Live-score presentation tests keep partial evidence quiet and final results legible.
// ============================================================

import { cleanup, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it } from 'vitest'
import { GuitarNightLiveScore } from './GuitarNightLiveScore'

describe('GuitarNightLiveScore', () => {
  afterEach(cleanup)

  it('withholds a false zero and grade while evidence is warming up', () => {
    render(() => (
      <GuitarNightLiveScore
        state={() => 'warming'}
        basis={() => 'notes'}
        label={() => 'Setting your score'}
        detail={() => '2 of 4 notes scored'}
        score={() => null}
        grade={() => null}
        announcement={() => 'Setting your live score'}
      />
    ))

    expect(screen.getByTestId('guitar-night-live-score')).toHaveAttribute(
      'data-state',
      'warming',
    )
    expect(screen.queryByLabelText('Live score')).toBeNull()
    expect(screen.queryByLabelText('Live grade')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Setting your live score',
    )
  })

  it('shows a labelled note score without making the rolling number live', () => {
    const [score, setScore] = createSignal(86)
    const [grade, setGrade] = createSignal<'A' | 'B'>('A')
    render(() => (
      <GuitarNightLiveScore
        state={() => 'active'}
        basis={() => 'notes'}
        label={() => 'Live take'}
        detail={() => 'Notes'}
        score={score}
        grade={grade}
        announcement={() => 'Live grade A'}
      />
    ))

    const scoreOutput = screen.getByLabelText('Live score, 86 out of 100')
    expect(scoreOutput).toHaveTextContent('86')
    expect(scoreOutput).toHaveAttribute('aria-live', 'off')
    expect(screen.getByLabelText('Live grade, A')).toHaveTextContent('A')
    expect(screen.getByTestId('guitar-night-live-score')).toHaveAttribute(
      'data-score-basis',
      'notes',
    )

    setScore(72)
    setGrade('B')
    expect(scoreOutput).toHaveTextContent('72')
    expect(screen.getByLabelText('Live grade, B')).toHaveTextContent('B')
  })

  it('retains the settled result in paused and complete states', () => {
    const [state, setState] = createSignal<'paused' | 'complete'>('paused')
    render(() => (
      <GuitarNightLiveScore
        state={state}
        basis={() => 'notes'}
        label={() => (state() === 'paused' ? 'Score held' : 'Take complete')}
        detail={() => 'Notes'}
        score={() => 95}
        grade={() => 'S'}
        announcement={() =>
          state() === 'paused'
            ? 'Live score held at 95, grade S'
            : 'Take complete, score 95, grade S'
        }
      />
    ))

    expect(
      screen.getByLabelText('Live score, 95 out of 100'),
    ).toHaveTextContent('95')
    expect(screen.getByLabelText('Live grade, S')).toHaveTextContent('S')
    setState('complete')
    expect(screen.getByTestId('guitar-night-live-score')).toHaveAttribute(
      'data-state',
      'complete',
    )
    expect(
      screen.getByText('Take complete, score 95, grade S', {
        selector: '[aria-live="polite"]',
      }),
    ).toBeInTheDocument()
  })
})
