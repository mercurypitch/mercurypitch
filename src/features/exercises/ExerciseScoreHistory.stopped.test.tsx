// ============================================================
// ExerciseScoreHistory, stopped: the corner chip shows whole runs only
// ============================================================
//
// The chip beside a finished run lists the drill's last few scores and its
// best. A stopped run stays in the history, marked, but its percentage
// covers only the rounds it reached: listed first, one good round and Stop
// read as the latest score, a hundred where the last whole run made 72.

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { applyPersistedValue } from '@/lib/storage'
import { exerciseScoringVersion } from './exercise-comparability'
import { ExerciseScoreHistory } from './ExerciseScoreHistory'
import { EXERCISE_DRONE_INTONATION } from './types'

const HISTORY_KEY = 'mercurypitch_exercise_history'

afterEach(() => {
  cleanup()
  applyPersistedValue(HISTORY_KEY, JSON.stringify([]))
})

describe('the recent scores chip', () => {
  it('leaves out a stopped run, and leads with the last whole one', () => {
    const scoringVersion = exerciseScoringVersion(EXERCISE_DRONE_INTONATION)
    applyPersistedValue(
      HISTORY_KEY,
      JSON.stringify([
        {
          type: EXERCISE_DRONE_INTONATION,
          score: 100,
          metrics: { roundsCompleted: 1, stoppedEarly: 1 },
          completedAt: 3,
          scoringVersion,
        },
        {
          type: EXERCISE_DRONE_INTONATION,
          score: 72,
          metrics: { roundsCompleted: 6 },
          completedAt: 2,
          scoringVersion,
        },
        {
          type: EXERCISE_DRONE_INTONATION,
          score: 64,
          metrics: { roundsCompleted: 6 },
          completedAt: 1,
          scoringVersion,
        },
      ]),
    )

    const { container } = render(() => (
      <ExerciseScoreHistory type={EXERCISE_DRONE_INTONATION} />
    ))

    expect(container.querySelector('.exercise-score-latest')?.textContent).toBe(
      '72%',
    )
    expect(
      [...container.querySelectorAll('.exercise-score-chip')].map(
        (chip) => chip.textContent,
      ),
    ).toEqual(['64%'])
    expect(
      container.querySelector('.exercise-score-history-best')?.textContent,
    ).toBe('Best 72%')
  })
})
