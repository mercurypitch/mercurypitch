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
import { seedSessionWithNotes } from './utils/session-fixtures'

const scale: ScaleDegree[] = [
  { midi: 60, name: 'C', octave: 4, freq: 261.63, semitone: 0 },
  { midi: 64, name: 'E', octave: 4, freq: 329.63, semitone: 4 },
  { midi: 99, name: 'X', octave: 9, freq: 0, semitone: 0 }, // no practice data
]

afterEach(() => setSessionResults([]))

describe('PitchAccuracyHeatmap', () => {
  it('renders per-note accuracy from session history', () => {
    seedSessionWithNotes([
      { midi: 60, avgCents: 10 }, // 10¢ off -> 100 - (10-5)*5 = 75%
      { midi: 64, avgCents: 30 }, // 30¢ off -> max(0, 100 - (30-5)*5) = 0%
    ])

    render(() => <PitchAccuracyHeatmap scale={() => scale} />)

    // hasData() is true -> the panel and its title render
    expect(screen.getByText('Note Accuracy')).toBeInTheDocument()
    // practiced keys expose their accuracy via the accessible name
    expect(
      screen.getByRole('button', { name: 'C4 accuracy 75%' }),
    ).toBeInTheDocument()
    // larger deviations are penalized (before the fix every note scored 100%)
    expect(
      screen.getByRole('button', { name: 'E4 accuracy 0%' }),
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
