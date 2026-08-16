// ============================================================
// The routine card says how many runs each drill wants
// ============================================================
//
// The card is where the singer agrees to the session, so it is where the reps
// have to be visible. "Long Note 3m" with one run behind it was the shape of
// the old lie; "Long Note 5 x 3m" is the plan, and the row for the drill in
// progress counts the runs so a segment that refuses to tick off after a good
// run reads as the plan rather than as a bug.

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { EXERCISE_LONG_NOTE, EXERCISE_SCALE_RUNNER, } from '@/features/exercises/types'
import { DailyRoutinePanel } from '@/features/routines/DailyRoutinePanel'
import type { RoutineTemplate } from '@/features/routines/types'
import { autoAdvanceRoutineSegment, loadSharedRoutine, } from '@/features/routines/use-daily-routine'

const TEMPLATE: RoutineTemplate = {
  id: 'panel-reps',
  name: "Today's Session",
  description: 'two drills',
  segments: [
    {
      type: 'exercise',
      durationSec: 150,
      reps: 5,
      config: { exercise: EXERCISE_LONG_NOTE },
    },
    {
      type: 'exercise',
      durationSec: 90,
      reps: 2,
      config: { exercise: EXERCISE_SCALE_RUNNER },
    },
    { type: 'cooldown', durationSec: 60, config: { mode: 'free-sing' } },
  ],
}

/** Render the card with its body open — it starts collapsed. */
function openPanel(): ReturnType<typeof render> {
  const result = render(() => <DailyRoutinePanel />)
  fireEvent.click(result.getByText('Daily Practice'))
  return result
}

afterEach(cleanup)

describe('DailyRoutinePanel reps', () => {
  it('counts the runs of the drill in progress and totals the rest', () => {
    loadSharedRoutine(TEMPLATE)
    const { getAllByTestId } = openPanel()

    const chips = getAllByTestId('segment-reps')
    // The cool-down asks for one run and says nothing; the two drills do.
    expect(chips).toHaveLength(2)
    expect(chips[0]?.textContent).toBe('1 of 5')
    expect(chips[1]?.textContent).toBe('2 x')
  })

  it('follows the runs as they bank', () => {
    loadSharedRoutine(TEMPLATE)
    const { getAllByTestId } = openPanel()

    autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)
    expect(getAllByTestId('segment-reps')[0]?.textContent).toBe('2 of 5')

    autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)
    expect(getAllByTestId('segment-reps')[0]?.textContent).toBe('3 of 5')
  })

  // Once the segment is behind them the count is history: the row goes back
  // to stating what the drill asked for.
  it('states the total again once the segment is done', () => {
    loadSharedRoutine(TEMPLATE)
    const { getAllByTestId } = openPanel()

    for (let i = 0; i < 5; i++) autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)
    const chips = getAllByTestId('segment-reps')
    expect(chips[0]?.textContent).toBe('5 x')
    expect(chips[1]?.textContent).toBe('1 of 2')
  })

  // A routine stored before reps existed: nothing to say, and the card must
  // not invent a count for it.
  it('says nothing for a routine that predates reps', () => {
    loadSharedRoutine({
      ...TEMPLATE,
      segments: TEMPLATE.segments.map(({ reps: _reps, ...seg }) => seg),
    })
    const { queryAllByTestId } = openPanel()
    expect(queryAllByTestId('segment-reps')).toHaveLength(0)
  })
})
