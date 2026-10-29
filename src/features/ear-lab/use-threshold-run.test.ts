// A staircase's question when the sound is taken away. Back from the
// background, a sealed pair waiting on its answer was left as it was:
// Resume played nothing, and a sealed question opens no replay before
// its answer, so the singer could only guess (owner, 29 Oct). Now a
// question heard through and waiting on its answer is void: its answer
// shuts while it is held, and Resume sounds the same pair again, which
// counts as a replay, so the plate shows it. One still sounding sounds
// again from its start, with no replay counted.

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Feedback from '@/features/exercises/feedback'
import type { ThresholdDrill } from '@/lib/ear/drills'
import { findThresholdDrill } from '@/lib/ear/drills'
import { resetEarLabStore } from '@/stores/ear-lab-store'
import type { StimulusApi } from './use-threshold-run'
import { useThresholdRun } from './use-threshold-run'

vi.mock('@/features/exercises/feedback', async (importOriginal) => ({
  ...(await importOriginal<typeof Feedback>()),
  playTierSfx: vi.fn(),
}))

function hairline(): ThresholdDrill {
  const drill = findThresholdDrill('hairline')
  if (!drill) throw new Error('hairline missing from catalogue')
  return drill
}

beforeEach(() => {
  localStorage.clear()
  resetEarLabStore()
})

let dispose: () => void = () => undefined
afterEach(() => dispose())

/** A run whose stimulus is two steps, kept to read back; `pauseNext`
 *  keeps the next stimulus sounding until `release`. */
function setUp() {
  const played: { level: number; replay: boolean }[] = []
  let pausing = false
  let release: () => void = () => undefined
  const run = createRoot((done) => {
    dispose = done
    return useThresholdRun(hairline(), async (level, api: StimulusApi) => {
      played.push({ level, replay: api.replay === true })
      api.step(1)
      if (pausing) {
        pausing = false
        await new Promise<void>((resolve) => {
          release = resolve
        })
      } else {
        await Promise.resolve()
      }
      api.step(2)
    })
  })
  return {
    run,
    played,
    pauseNext: () => {
      pausing = true
    },
    release: () => release(),
  }
}

describe("a staircase's question, the sound taken away", () => {
  it('heard through, shuts its answer and sounds it again as a replay', async () => {
    const { run, played } = setUp()
    run.start('calibration')
    await vi.waitFor(() => expect(run.phase()).toBe('answer'))

    run.holdQuestion()
    expect(run.held()).toBe(true)
    // No answer lands behind the sheet: a key, a sung window closing.
    expect(run.phase()).toBe('stimulus')
    run.answerCorrect(true)
    expect(run.trials()).toBe(0)
    // A second stop before Resume (the app put away, then a call) is the
    // same hold: the pair still counts as heard through.
    run.holdQuestion()

    await run.resumeQuestion()
    expect(run.held()).toBe(false)
    expect(run.phase()).toBe('answer')
    // The same pair, never a fresh one in its place: and heard twice
    // before its answer, even sealed, it is a replay, once.
    expect(played).toEqual([
      played[0],
      { level: played[0].level, replay: true },
    ])
    expect(run.replays()).toBe(1)
    expect(run.trials()).toBe(0)
    run.abandon()
  })

  it("heard through on a practice run, uses up its question's replay", async () => {
    const { run } = setUp()
    run.start('practice')
    await vi.waitFor(() => expect(run.phase()).toBe('answer'))
    expect(run.replaysLeft()).toBe(1)

    run.holdQuestion()
    await run.resumeQuestion()
    expect(run.replays()).toBe(1)
    expect(run.replaysLeft()).toBe(0)
    run.abandon()
  })

  it('still sounding, sounds the same trial again with no replay counted', async () => {
    const { run, played, pauseNext, release } = setUp()
    pauseNext()
    run.start('calibration')
    await vi.waitFor(() => expect(played).toHaveLength(1))

    run.holdQuestion()
    expect(run.held()).toBe(true)
    release()
    await run.resumeQuestion()
    expect(run.phase()).toBe('answer')
    expect(played).toHaveLength(2)
    expect(played[1]).toEqual({ level: played[0].level, replay: true })
    expect(run.replays()).toBe(0)
    run.abandon()
  })
})
