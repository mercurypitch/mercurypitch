// ============================================================
// pitch-accuracy-heatmap.test.tsx — end-to-end render of the
// PitchAccuracyHeatmap fed by persisted session history, proving
// the decoupled getNoteAccuracyMap() path still renders correctly.
// ============================================================

import { render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import PitchAccuracyHeatmap from '@/components/PitchAccuracyHeatmap'
import { setSessionResults } from '@/stores/practice-session-store'
import type { ScaleDegree } from '@/types'

function seedSessionWithNotes(
  noteResults: { midi: number; avgCents: number }[],
) {
  setSessionResults((prev) => [
    {
      name: 'Test',
      score: 60,
      itemsCompleted: noteResults.length,
      sessionName: 'Test',
      completedAt: Date.now(),
      practiceItemResult: [
        {
          score: 60,
          noteCount: noteResults.length,
          avgCents: 25,
          itemsCompleted: noteResults.length,
          name: 'Test',
          mode: 'once',
          completedAt: Date.now(),
          noteResult: noteResults.map((n) => ({
            item: {
              id: 0,
              note: { midi: n.midi, name: 'C', octave: 4, freq: 261 },
              duration: 1,
              startBeat: 0,
            },
            pitchFreq: 261,
            pitchCents: n.avgCents,
            time: 100,
            rating: 'good' as const,
            avgCents: n.avgCents,
            targetNote: 'C4',
          })),
        },
      ],
    },
    ...prev,
  ])
}

const scale: ScaleDegree[] = [
  { midi: 60, name: 'C', octave: 4 },
  { midi: 64, name: 'E', octave: 4 },
  { midi: 99, name: 'X', octave: 9 }, // no practice data
]

afterEach(() => setSessionResults([]))

describe('PitchAccuracyHeatmap', () => {
  it('renders per-note accuracy from session history', () => {
    seedSessionWithNotes([
      { midi: 60, avgCents: -10 }, // -> 100 - 50 = 50%
      { midi: 64, avgCents: 30 }, // -> 100% (sharp never penalized)
    ])

    render(() => <PitchAccuracyHeatmap scale={() => scale} />)

    // hasData() is true -> the panel and its title render
    expect(screen.getByText('Note Accuracy')).toBeInTheDocument()
    // practiced keys expose their accuracy via the accessible name
    expect(
      screen.getByRole('button', { name: 'C4 accuracy 50%' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'E4 accuracy 100%' }),
    ).toBeInTheDocument()
    // a scale note without data renders but carries no accuracy
    expect(
      screen.getByRole('button', { name: 'X9 no practice data' }),
    ).toBeInTheDocument()
  })

  it('renders nothing when there is no session history', () => {
    const { container } = render(() => (
      <PitchAccuracyHeatmap scale={() => scale} />
    ))
    expect(container.textContent).toBe('')
  })
})
