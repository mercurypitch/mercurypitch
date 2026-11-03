// ============================================================
// ExerciseMenu, stopped: a stopped run is listed, but not scored
// ============================================================
//
// Recent Sessions lists every run on the device, a stopped one too: it was
// practice. Its percentage covers only the rounds it reached, so the row
// says it was stopped instead, and the drill's card keeps the best of its
// whole runs.

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { applyPersistedValue } from '@/lib/storage'
import ExerciseMenu from './ExerciseMenu'
import { EXERCISE_DRONE_INTONATION, EXERCISE_LONG_NOTE } from './types'

const HISTORY_KEY = 'mercurypitch_exercise_history'

afterEach(() => {
  cleanup()
  applyPersistedValue(HISTORY_KEY, JSON.stringify([]))
})

describe('the recent sessions list', () => {
  it('says a stopped run was stopped, where a whole run shows its score', () => {
    applyPersistedValue(
      HISTORY_KEY,
      JSON.stringify([
        {
          type: EXERCISE_DRONE_INTONATION,
          score: 100,
          metrics: { roundsCompleted: 1, stoppedEarly: 1 },
          completedAt: Date.now() - 60_000,
          scoringVersion: 2,
        },
        {
          type: EXERCISE_DRONE_INTONATION,
          score: 72,
          metrics: { roundsCompleted: 6 },
          completedAt: Date.now() - 120_000,
          scoringVersion: 2,
        },
      ]),
    )

    const { container } = render(() => <ExerciseMenu onSelect={() => {}} />)

    expect(
      [...container.querySelectorAll('.exercise-recent-score')].map(
        (score) => score.textContent,
      ),
    ).toEqual(['Stopped', '72%'])
    const drone = [...container.querySelectorAll('.exercise-card')].find(
      (el) =>
        el.querySelector('h3')?.firstChild?.textContent === 'Drone Intonation',
    )
    expect(drone?.querySelector('.exercise-card-best')?.textContent).toBe(
      'Best: 72%',
    )
    expect(drone?.querySelector('.exercise-card-plays')?.textContent).toBe('1x')
  })

  it('says a Manual hold under five sung seconds was too short, not stopped', () => {
    applyPersistedValue(
      HISTORY_KEY,
      JSON.stringify([
        {
          type: EXERCISE_LONG_NOTE,
          score: 85,
          metrics: { stoppedEarly: 1, tooShort: 1 },
          completedAt: Date.now() - 60_000,
        },
      ]),
    )

    const { container } = render(() => <ExerciseMenu onSelect={() => {}} />)

    expect(container.querySelector('.exercise-recent-score')?.textContent).toBe(
      'Too short',
    )
  })
})
