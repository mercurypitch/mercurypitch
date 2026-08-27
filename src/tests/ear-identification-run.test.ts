// ============================================================
// Tests: use-identification-controller — the engine under Leap,
// Stack and Contour.
//
// Rounds arm after the prompt and advance on the reveal timer, a
// right answer rates up and a miss rates down (and replays slowly),
// the same item never comes twice in a row, twelve rounds end in a
// tally, and Stop cancels the RUN: a prompt still sounding must not
// re-arm the answer when it finally resolves.
// ============================================================

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDENTIFICATION_ROUNDS, useIdentificationController, } from '@/features/ear-lab/use-identification-controller'
import type { EarBankItem } from '@/lib/ear/banks'
import { CONTOUR_BANK } from '@/lib/ear/banks'
import { findIdentificationDrill } from '@/lib/ear/drills'
import { REVEAL_TIMING } from '@/lib/ear/timing'
import { earPlayerRating, resetEarLabStore } from '@/stores/ear-lab-store'

vi.mock('@/features/exercises/feedback', () => ({ playTierSfx: vi.fn() }))

const drill = findIdentificationDrill('contour')
if (!drill) throw new Error('contour drill missing from catalogue')

/** Trials that sound instantly and remember which item they got. */
function instantTrials() {
  const items: string[] = []
  const replays: string[] = []
  return {
    items,
    replays,
    makeTrial: (item: EarBankItem) => {
      items.push(item.itemId)
      return {
        expectedId: item.itemId,
        play: async () => undefined,
        replayOnWrong: async () => {
          replays.push(item.itemId)
        },
      }
    },
  }
}

/** A prompt that hangs until the test releases it. */
function pendingTrial() {
  let release: (() => void) | null = null
  return {
    release: () => release?.(),
    makeTrial: (item: EarBankItem) => ({
      expectedId: item.itemId,
      play: () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    }),
  }
}

/** Let the awaited prompt continuation run. */
const flush = () => vi.advanceTimersByTimeAsync(0)

beforeEach(() => {
  resetEarLabStore()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('a round', () => {
  it('arms the answer after the prompt, rates a hit up, and moves on after the short reveal', async () => {
    await createRoot(async (dispose) => {
      const trials = instantTrials()
      const run = useIdentificationController(
        drill,
        CONTOUR_BANK,
        trials.makeTrial,
      )
      const before = earPlayerRating(drill.id).rating

      run.start()
      expect(run.phase()).toBe('playing')
      await flush()
      expect(run.phase()).toBe('answer')
      expect(run.round()).toBe(0)
      expect(run.totalRounds).toBe(IDENTIFICATION_ROUNDS)

      const expected = run.expectedId()
      expect(expected).not.toBeNull()
      run.answer(expected as string)
      expect(run.phase()).toBe('reveal')
      expect(run.answeredId()).toBe(expected)
      expect(run.rating().rating).toBeGreaterThan(before)
      expect(trials.replays).toHaveLength(0)

      await vi.advanceTimersByTimeAsync(
        REVEAL_TIMING.identificationCorrectMs - 1,
      )
      expect(run.phase()).toBe('reveal')
      await vi.advanceTimersByTimeAsync(1)
      await flush()
      expect(run.round()).toBe(1)
      expect(run.phase()).toBe('answer')

      dispose()
    })
  })

  it('replays a miss slowly, rates it down, and holds the longer reveal', async () => {
    await createRoot(async (dispose) => {
      const trials = instantTrials()
      const run = useIdentificationController(
        drill,
        CONTOUR_BANK,
        trials.makeTrial,
      )
      const before = earPlayerRating(drill.id).rating

      run.start()
      await flush()
      const expected = run.expectedId() as string
      const wrong = CONTOUR_BANK.find((item) => item.itemId !== expected)
      if (!wrong) throw new Error('bank needs two items')

      run.answer(wrong.itemId)
      expect(run.phase()).toBe('reveal')
      expect(run.rating().rating).toBeLessThan(before)
      expect(trials.replays).toEqual([expected])

      await vi.advanceTimersByTimeAsync(REVEAL_TIMING.identificationCorrectMs)
      expect(run.phase()).toBe('reveal')
      await vi.advanceTimersByTimeAsync(
        REVEAL_TIMING.identificationWrongMs -
          REVEAL_TIMING.identificationCorrectMs,
      )
      await flush()
      expect(run.round()).toBe(1)

      dispose()
    })
  })

  it('takes no answer outside the answer phase', async () => {
    await createRoot(async (dispose) => {
      const pending = pendingTrial()
      const run = useIdentificationController(
        drill,
        CONTOUR_BANK,
        pending.makeTrial,
      )

      run.answer('up')
      expect(run.phase()).toBe('idle')

      run.start()
      expect(run.phase()).toBe('playing')
      run.answer(run.expectedId() as string)
      expect(run.phase()).toBe('playing')
      expect(run.answeredId()).toBeNull()

      dispose()
    })
  })
})

describe('a run', () => {
  it('ends after twelve rounds with the tally and the rating movement', async () => {
    await createRoot(async (dispose) => {
      const trials = instantTrials()
      const run = useIdentificationController(
        drill,
        CONTOUR_BANK,
        trials.makeTrial,
      )
      const start = earPlayerRating(drill.id).rating

      run.start()
      for (let i = 0; i < IDENTIFICATION_ROUNDS; i++) {
        await flush()
        expect(run.phase()).toBe('answer')
        const expected = run.expectedId() as string
        // Miss every third round so both tallies are exercised.
        run.answer(i % 3 === 2 ? `not-${expected}` : expected)
        await vi.advanceTimersByTimeAsync(REVEAL_TIMING.identificationWrongMs)
      }

      expect(run.phase()).toBe('done')
      const result = run.result()
      expect(result?.total).toBe(IDENTIFICATION_ROUNDS)
      expect(result?.correct).toBe(8)
      expect(result?.outcomes).toHaveLength(IDENTIFICATION_ROUNDS)
      expect(result?.outcomes.filter((o) => !o.correct)).toHaveLength(4)
      expect(result?.rating.rating).toBe(run.rating().rating)
      expect(result?.ratingDelta).toBe(
        Math.round((result?.rating.rating ?? 0) - start),
      )
      expect(earPlayerRating(drill.id).rating).toBe(run.rating().rating)

      dispose()
    })
  })

  it('never hands out the same item twice in a row', async () => {
    await createRoot(async (dispose) => {
      const trials = instantTrials()
      const run = useIdentificationController(
        drill,
        CONTOUR_BANK,
        trials.makeTrial,
      )

      run.start()
      for (let i = 0; i < IDENTIFICATION_ROUNDS; i++) {
        await flush()
        run.answer(run.expectedId() as string)
        await vi.advanceTimersByTimeAsync(REVEAL_TIMING.identificationCorrectMs)
      }

      expect(trials.items).toHaveLength(IDENTIFICATION_ROUNDS)
      for (let i = 1; i < trials.items.length; i++) {
        expect(trials.items[i]).not.toBe(trials.items[i - 1])
      }

      dispose()
    })
  })
})

describe('stopping', () => {
  it('mid-prompt ends the run, silences the audio, and stays ended when the prompt resolves', async () => {
    await createRoot(async (dispose) => {
      const pending = pendingTrial()
      const cancelAudio = vi.fn()
      const run = useIdentificationController(
        drill,
        CONTOUR_BANK,
        pending.makeTrial,
        { cancelAudio },
      )

      run.start()
      expect(run.phase()).toBe('playing')
      run.stop()
      expect(run.phase()).toBe('done')
      expect(cancelAudio).toHaveBeenCalledTimes(1)
      expect(run.result()?.total).toBe(0)

      // The moment the old bug fired: the prompt finally finishes.
      pending.release()
      await flush()
      expect(run.phase()).toBe('done')

      dispose()
    })
  })

  it('does nothing when idle or already done', async () => {
    await createRoot(async (dispose) => {
      const cancelAudio = vi.fn()
      const trials = instantTrials()
      const run = useIdentificationController(
        drill,
        CONTOUR_BANK,
        trials.makeTrial,
        { cancelAudio },
      )

      run.stop()
      expect(run.phase()).toBe('idle')
      expect(cancelAudio).not.toHaveBeenCalled()

      run.start()
      await flush()
      run.stop()
      expect(run.phase()).toBe('done')
      run.stop()
      expect(cancelAudio).toHaveBeenCalledTimes(1)

      dispose()
    })
  })
})
