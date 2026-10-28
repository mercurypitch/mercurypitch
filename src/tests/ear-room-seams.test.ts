// ============================================================
// Tests: the run engines' seams for the native room.
//
//   - Hear it again: a practice question replays once before its
//     answer and the run counts it; a sealed one never does; any
//     answered question replays freely.
//   - The sound taken away: the question in flight is voided and
//     plays again from its start, the same trial, or a fresh one at the
//     same level if none of it had sounded.
//   - A replay at the reveal is listen-only where the drill says so, is
//     held until its sound ends, and stops when the next question
//     starts.
//   - Ending mid-run keeps nothing: a rated run's answers are put back.
// ============================================================

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setRevealRule } from '@/features/ear-lab/reveal-pacing'
import { useIdentificationController } from '@/features/ear-lab/use-identification-controller'
import { useThresholdRun } from '@/features/ear-lab/use-threshold-run'
import { LEAP_BANK } from '@/lib/ear/banks'
import { findIdentificationDrill, findThresholdDrill } from '@/lib/ear/drills'
import { earConfusions, earItemStates, earPlayerRating, markRatedRun, recordIdentificationAnswer, resetEarLabStore, rollBackRatedRun, } from '@/stores/ear-lab-store'

const hairline = findThresholdDrill('hairline')
const leap = findIdentificationDrill('leap')
if (!hairline || !leap) throw new Error('drills missing from catalogue')

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

/** A stimulus that resolves at once, and remembers how it was asked. */
function recordedStimulus() {
  const calls: Array<{ level: number; replay: boolean }> = []
  return {
    calls,
    play: async (level: number, api: { replay: boolean }) => {
      calls.push({ level, replay: api.replay })
    },
  }
}

beforeEach(() => {
  localStorage.clear()
  resetEarLabStore()
})

describe('Hear it again, on a staircase', () => {
  it('replays a practice question once before its answer, and counts it', async () => {
    await createRoot(async (dispose) => {
      const stim = recordedStimulus()
      const run = useThresholdRun(hairline, stim.play, { replayable: true })
      run.start('practice')
      await settle()
      expect(run.phase()).toBe('answer')
      expect(run.replayAllowed()).toBe(true)
      expect(run.replaysLeft()).toBe(1)

      await run.replay()
      expect(stim.calls.at(-1)?.replay).toBe(true)
      expect(run.phase()).toBe('answer')
      expect(run.replays()).toBe(1)
      expect(run.replaysLeft()).toBe(0)
      expect(run.replayAllowed()).toBe(false)

      // Answered: free again, and not counted.
      run.answerCorrect(true)
      expect(run.replayAllowed()).toBe(true)
      await run.replay()
      await run.replay()
      expect(run.replays()).toBe(1)
      dispose()
    })
  })

  it('never replays a sealed question before its answer', async () => {
    await createRoot(async (dispose) => {
      const stim = recordedStimulus()
      const run = useThresholdRun(hairline, stim.play, { replayable: true })
      run.start('calibration')
      await settle()
      expect(run.phase()).toBe('answer')
      expect(run.replayAllowed()).toBe(false)
      expect(run.replaysLeft()).toBeNull()
      await run.replay()
      expect(stim.calls.filter((call) => call.replay)).toHaveLength(0)
      dispose()
    })
  })

  it('offers nothing for a drill that cannot replay faithfully', async () => {
    await createRoot(async (dispose) => {
      const stim = recordedStimulus()
      const run = useThresholdRun(hairline, stim.play)
      run.start('practice')
      await settle()
      expect(run.replayable).toBe(false)
      expect(run.replayAllowed()).toBe(false)
      dispose()
    })
  })
})

describe('the sound taken away mid-question', () => {
  it('voids the trial in flight and plays the same one again', async () => {
    await createRoot(async (dispose) => {
      const gate: { release: (() => void) | null } = { release: null }
      const calls: boolean[] = []
      const run = useThresholdRun(
        hairline,
        (_level, api) => {
          calls.push(api.replay)
          // The first tone sounds: the trial is the drill's to keep.
          api.step(1)
          return new Promise<void>((resolve) => {
            gate.release = resolve
          })
        },
        { replayable: true },
      )
      run.start('practice')
      expect(run.phase()).toBe('stimulus')

      run.holdQuestion()
      expect(run.held()).toBe(true)
      // The voided sound finishing must not arm the answer.
      gate.release?.()
      await settle()
      expect(run.phase()).toBe('stimulus')

      const resumed = run.resumeQuestion()
      expect(run.held()).toBe(false)
      gate.release?.()
      await resumed
      expect(run.phase()).toBe('answer')
      // The same trial, asked again; never a new one.
      expect(calls).toEqual([false, true])
      expect(run.trials()).toBe(0)
      dispose()
    })
  })
})

describe('the sound taken away before any of the question sounded', () => {
  it('plays a fresh trial at the same level, not the last one kept', async () => {
    await createRoot(async (dispose) => {
      const gate: { release: (() => void) | null } = { release: null }
      const calls: Array<{ level: number; replay: boolean }> = []
      const run = useThresholdRun(
        hairline,
        async (level, api) => {
          calls.push({ level, replay: api.replay })
          // The audio wakes first (the Grid waits on it); only then is
          // the trial stored and sounded.
          await new Promise<void>((resolve) => {
            gate.release = resolve
          })
          if (api.cancelled()) return
          api.step(1)
        },
        { replayable: true },
      )
      run.start('practice')
      run.holdQuestion()
      gate.release?.()
      await settle()

      const resumed = run.resumeQuestion()
      gate.release?.()
      await resumed
      expect(run.phase()).toBe('answer')
      // Asked fresh, at the level the staircase scores it at.
      expect(calls.map((call) => call.replay)).toEqual([false, false])
      expect(calls[1]?.level).toBe(calls[0]?.level)
      dispose()
    })
  })
})

describe('a replay at the reveal', () => {
  // The room's pacing: a replay holds the verdict for Next.
  beforeEach(() => setRevealRule('merc'))
  afterEach(() => setRevealRule('switch'))

  it('on a staircase, stops when the next trial starts', async () => {
    await createRoot(async (dispose) => {
      const pending: Array<() => void> = []
      const calls: boolean[] = []
      const cancel = vi.fn()
      const run = useThresholdRun(
        hairline,
        (_level, api) => {
          calls.push(api.replay)
          // A replay sounds on; a fresh trial is over at once.
          return api.replay
            ? new Promise<void>((resolve) => pending.push(resolve))
            : Promise.resolve()
        },
        { replayable: true, cancelStimulus: cancel },
      )
      run.start('practice')
      await settle()
      run.answerCorrect(true)
      expect(run.phase()).toBe('reveal')
      void run.replay()
      expect(run.replaying()).toBe(true)
      expect(run.parked()).toBe(true)

      run.next()
      await settle()
      expect(cancel).toHaveBeenCalled()
      expect(run.replaying()).toBe(false)
      expect(calls).toEqual([false, true, false])
      expect(run.phase()).toBe('answer')
      // The silenced replay ending later leaves the new trial alone.
      pending[0]?.()
      await settle()
      expect(run.replaying()).toBe(false)
      expect(run.phase()).toBe('answer')
      dispose()
    })
  })

  it('on a rated run, stops when the next question starts', async () => {
    await createRoot(async (dispose) => {
      const pending: Array<() => void> = []
      const cancel = vi.fn()
      let plays = 0
      const controller = useIdentificationController(
        leap,
        LEAP_BANK,
        (picked) => ({
          expectedId: picked.itemId,
          play: async () => {
            plays += 1
          },
          replay: () => new Promise<void>((resolve) => pending.push(resolve)),
        }),
        { cancelAudio: cancel },
      )
      controller.start()
      await settle()
      controller.answer(controller.expectedId() ?? '')
      await settle()
      void controller.replay()
      expect(controller.replaying()).toBe(true)

      controller.next()
      await settle()
      expect(cancel).toHaveBeenCalled()
      expect(controller.replaying()).toBe(false)
      expect(plays).toBe(2)
      expect(controller.phase()).toBe('answer')
      pending[0]?.()
      await settle()
      expect(controller.replaying()).toBe(false)
      dispose()
    })
  })

  it("sounds a trial's listen-only replay, held until it ends, and the verdict stays", async () => {
    await createRoot(async (dispose) => {
      let plays = 0
      let listens = 0
      const done: { end: (() => void) | null } = { end: null }
      const controller = useIdentificationController(
        leap,
        LEAP_BANK,
        (picked) => ({
          expectedId: picked.itemId,
          play: async () => {
            plays += 1
          },
          replay: () => {
            listens += 1
            return new Promise<void>((resolve) => {
              done.end = resolve
            })
          },
        }),
      )
      controller.start()
      await settle()
      controller.answer('not-it')
      await settle()

      const replayed = controller.replay()
      // The call again, and not the question: no new answer opens.
      expect(listens).toBe(1)
      expect(plays).toBe(1)
      expect(controller.phase()).toBe('reveal')
      // Not again while it sounds.
      expect(controller.replayAllowed()).toBe(false)
      done.end?.()
      await replayed
      expect(controller.replayAllowed()).toBe(true)
      expect(controller.answeredId()).toBe('not-it')
      dispose()
    })
  })
})

describe('ending a rated run part-way', () => {
  it('puts back every answer the run wrote', async () => {
    await createRoot(async (dispose) => {
      // A rating the singer already had.
      const item = LEAP_BANK[0]
      recordIdentificationAnswer({
        drillId: 'leap',
        itemId: item.itemId,
        itemDifficulty: { rating: 1100, attempts: 3 },
        correct: true,
        guessRate: 1 / 12,
        expected: item.itemId,
        answered: item.itemId,
      })
      const before = earPlayerRating('leap')
      const itemsBefore = earItemStates()

      const controller = useIdentificationController(
        leap,
        LEAP_BANK,
        (picked) => ({
          expectedId: picked.itemId,
          play: async () => undefined,
        }),
      )
      controller.start()
      await settle()
      expect(controller.phase()).toBe('answer')
      // A wrong answer moves the rating, an item and the confusions.
      controller.answer('not-it')
      expect(earPlayerRating('leap')).not.toEqual(before)
      expect(Object.keys(earConfusions('leap'))).not.toHaveLength(0)

      controller.abandon()
      expect(earPlayerRating('leap')).toEqual(before)
      expect(earItemStates()).toEqual(itemsBefore)
      expect(earConfusions('leap')).toEqual({})
      dispose()
    })
  })

  it('replays an answered question only, never before the answer', async () => {
    await createRoot(async (dispose) => {
      let plays = 0
      const controller = useIdentificationController(
        leap,
        LEAP_BANK,
        (picked) => ({
          expectedId: picked.itemId,
          play: async () => {
            plays += 1
          },
        }),
      )
      controller.start()
      await settle()
      expect(controller.replayAllowed()).toBe(false)
      controller.answer(controller.expectedId() ?? '')
      await settle()
      expect(controller.replayAllowed()).toBe(true)
      await controller.replay()
      expect(plays).toBe(2)
      dispose()
    })
  })
})

describe('the ledger a rated run found', () => {
  it('is put back key by key, leaving other drills alone', () => {
    recordIdentificationAnswer({
      drillId: 'stack',
      itemId: 'stack:maj',
      itemDifficulty: { rating: 1000, attempts: 0 },
      correct: false,
      guessRate: 1 / 6,
      expected: 'maj',
      answered: 'min',
    })
    const mark = markRatedRun('leap')
    const stackBefore = earPlayerRating('stack')
    recordIdentificationAnswer({
      drillId: 'leap',
      itemId: 'leap:m2',
      itemDifficulty: { rating: 1150, attempts: 0 },
      correct: false,
      guessRate: 1 / 12,
      expected: 'leap:m2',
      answered: 'leap:M2',
    })
    rollBackRatedRun(mark)
    expect(earPlayerRating('leap').attempts).toBe(0)
    expect(earPlayerRating('stack')).toEqual(stackBefore)
    expect(earConfusions('leap')).toEqual({})
    expect(earConfusions('stack')).toEqual({ 'maj>min': 1 })
  })
})
