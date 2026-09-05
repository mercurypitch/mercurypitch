// ============================================================
// Tests: use-threshold-run stop semantics.
//
// Guards the bug found on hardware: pressing Stop mid-stimulus
// showed the end card, but the audio kept playing and then the
// run re-armed its own question when the in-flight stimulus
// resolved. Stopping must cancel the RUN, not just its timer.
// ============================================================

import { createRoot } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useThresholdRun } from '@/features/ear-lab/use-threshold-run'
import { CALIBRATION_STAIRCASE } from '@/lib/ear/calibration'
import { findThresholdDrill } from '@/lib/ear/drills'
import { REVEAL_HOLD } from '@/lib/ear/timing'
import { armSprintSegment, latestThresholdReading, recordThresholdReading, resetEarLabStore, } from '@/stores/ear-lab-store'

const drill = findThresholdDrill('hairline')
if (!drill) throw new Error('hairline drill missing from catalogue')

/** A stimulus that hangs until the test releases it, so a Stop can
 *  land while it is still "sounding". */
function pendingStimulus() {
  let release: (() => void) | null = null
  let cancelCalls = 0
  return {
    play: () =>
      new Promise<void>((resolve) => {
        release = resolve
      }),
    release: () => release?.(),
    cancelStimulus: () => {
      cancelCalls++
    },
    cancelCalls: () => cancelCalls,
  }
}

/** Let queued microtasks (the awaited stimulus continuation) run. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  resetEarLabStore()
})

describe('stopping mid-stimulus', () => {
  it('does not re-arm the question when the stimulus resolves', async () => {
    await createRoot(async (dispose) => {
      const stim = pendingStimulus()
      const run = useThresholdRun(drill, stim.play, {
        cancelStimulus: stim.cancelStimulus,
      })

      run.start('practice')
      expect(run.phase()).toBe('stimulus')

      run.stop()
      expect(run.phase()).toBe('done')

      // The moment the bug fired: the stimulus finally finishes.
      stim.release()
      await settle()
      expect(run.phase()).toBe('done')

      dispose()
    })
  })

  it('silences audio already committed to the clock', async () => {
    await createRoot(async (dispose) => {
      const stim = pendingStimulus()
      const run = useThresholdRun(drill, stim.play, {
        cancelStimulus: stim.cancelStimulus,
      })

      run.start('practice')
      expect(stim.cancelCalls()).toBe(0)
      run.stop()
      // Clearing a setTimeout cannot unmake a scheduled oscillator,
      // so the run must ask the drill to silence it.
      expect(stim.cancelCalls()).toBe(1)

      dispose()
    })
  })

  it('ignores answers submitted after the run stopped', async () => {
    await createRoot(async (dispose) => {
      const stim = pendingStimulus()
      const run = useThresholdRun(drill, stim.play, {
        cancelStimulus: stim.cancelStimulus,
      })

      run.start('practice')
      stim.release()
      await settle()
      expect(run.phase()).toBe('answer')

      run.stop()
      const trialsAtStop = run.trials()
      run.answerCorrect(true)
      expect(run.trials()).toBe(trialsAtStop)
      expect(run.phase()).toBe('done')

      dispose()
    })
  })

  it('discards an abandoned calibration instead of marking the column', async () => {
    await createRoot(async (dispose) => {
      const stim = pendingStimulus()
      const run = useThresholdRun(drill, stim.play, {
        cancelStimulus: stim.cancelStimulus,
      })

      run.start('calibration')
      stim.release()
      await settle()
      run.answerCorrect(true)
      run.stop()

      expect(run.result()?.estimate).toBeNull()
      expect(latestThresholdReading('hairline')).toBeNull()

      dispose()
    })
  })

  it('stays stopped when unmounted mid-stimulus', async () => {
    let run: ReturnType<typeof useThresholdRun> | null = null
    const stim = pendingStimulus()

    createRoot((dispose) => {
      run = useThresholdRun(drill, stim.play, {
        cancelStimulus: stim.cancelStimulus,
      })
      run.start('practice')
      // Navigating away disposes the owner; the controller registers
      // its own cleanup, so the run must cancel itself.
      dispose()
    })

    expect(stim.cancelCalls()).toBeGreaterThanOrEqual(1)
    stim.release()
    await settle()
    expect(run!.phase()).toBe('stimulus')
  })
})

describe('a run that finishes normally', () => {
  it('still records its practice reading', async () => {
    // Fake timers so the between-trial reveal pauses do not make this
    // a 13-second test.
    vi.useFakeTimers()
    try {
      await createRoot(async (dispose) => {
        // Same hanging stimulus, re-armed each round: play() hands
        // back a fresh promise and release() resolves the latest.
        const stim = pendingStimulus()
        const run = useThresholdRun(drill, stim.play)

        run.start('practice')
        // Two right, one wrong: the track turns around often, so it
        // reaches its reversal target in a bounded number of trials.
        for (let i = 0; i < 300 && run.phase() !== 'done'; i++) {
          if (run.phase() === 'stimulus') {
            stim.release()
            await vi.advanceTimersByTimeAsync(1)
          } else if (run.phase() === 'answer') {
            run.answerCorrect(i % 3 !== 2)
            await vi.advanceTimersByTimeAsync(REVEAL_HOLD.defaultMs + 5)
          } else {
            await vi.advanceTimersByTimeAsync(5)
          }
        }

        expect(run.phase()).toBe('done')
        expect(run.result()?.estimate).not.toBeNull()
        expect(latestThresholdReading('hairline')?.source).toBe('practice')
        expect(latestThresholdReading('hairline')?.tracks).toBe(1)

        dispose()
      })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('a calibration you can see the end of', () => {
  it('warm-starts every track from the latest reading and counts the whole run', async () => {
    recordThresholdReading({
      drillId: 'hairline',
      value: 12,
      spread: 2,
      tracks: 1,
      source: 'practice',
    })
    await createRoot(async (dispose) => {
      const stim = pendingStimulus()
      const run = useThresholdRun(drill, stim.play)
      run.start('calibration')
      expect(run.level()).toBeCloseTo(18)
      expect(run.trackTarget()).toBe(CALIBRATION_STAIRCASE.reversalsToStop)
      expect(run.reversalTarget()).toBe(
        CALIBRATION_STAIRCASE.reversalsToStop * 3,
      )
      // Before the run shows its pace: the prior, two and a half a turn.
      expect(run.questionsLeft()).toBe(45)
      dispose()
    })
  })

  it('opens at the catalogue start with no reading, and ends inside the cap', async () => {
    vi.useFakeTimers()
    await createRoot(async (dispose) => {
      const stim = pendingStimulus()
      const run = useThresholdRun(drill, stim.play)
      run.start('calibration')
      expect(run.level()).toBe(drill.staircase.start)
      let trials = 0
      for (let i = 0; i < 2000 && run.phase() !== 'done'; i++) {
        if (run.phase() === 'stimulus') {
          stim.release()
          await vi.advanceTimersByTimeAsync(1)
        } else if (run.phase() === 'answer') {
          run.answerCorrect(i % 2 === 0)
          trials++
          await vi.advanceTimersByTimeAsync(REVEAL_HOLD.defaultMs + 5)
        } else {
          await vi.advanceTimersByTimeAsync(5)
        }
      }
      expect(run.phase()).toBe('done')
      expect(trials).toBeLessThanOrEqual(CALIBRATION_STAIRCASE.maxTrials * 3)
      expect(run.questionsLeft()).toBe(0)
      dispose()
    })
    vi.useRealTimers()
  })
})

describe('a sprint segment', () => {
  it('runs to the turns its card promised, and only that run', async () => {
    armSprintSegment({
      kind: 'threshold',
      drillId: 'hairline',
      reason: 'unmeasured',
      reversals: 4,
    })
    await createRoot(async (dispose) => {
      const stim = pendingStimulus()
      const run = useThresholdRun(drill, stim.play, {
        cancelStimulus: stim.cancelStimulus,
      })
      run.start('practice')
      expect(run.trackTarget()).toBe(4)
      expect(run.reversalTarget()).toBe(4)
      run.stop()
      // The arming was taken: a run opened from the bench afterwards is
      // the catalogue's full length again.
      run.start('practice')
      expect(run.trackTarget()).toBe(drill.staircase.reversalsToStop)
      dispose()
    })
  })

  it('is not taken by a different drill', async () => {
    armSprintSegment({
      kind: 'threshold',
      drillId: 'grid',
      reason: 'unmeasured',
      reversals: 4,
    })
    await createRoot(async (dispose) => {
      const stim = pendingStimulus()
      const run = useThresholdRun(drill, stim.play, {
        cancelStimulus: stim.cancelStimulus,
      })
      run.start('practice')
      expect(run.trackTarget()).toBe(drill.staircase.reversalsToStop)
      dispose()
    })
  })
})
