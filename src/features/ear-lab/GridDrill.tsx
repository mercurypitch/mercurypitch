// ============================================================
// GridDrill — The Grid: timing resolution in milliseconds.
//
// Six clicks on a steady lattice, one of the last four nudged off
// it by the staircase's current level; say which. Perception only
// — no tapping — so the round trip the latency wizard measures
// never contaminates the reading: the stimulus is scheduled
// sample-accurately on the audio clock (click-synth) and the
// answer is a button.
//
// The dots pulse as the clicks land, but deliberately never show
// WHICH dot was off — the lattice on screen is always perfect;
// only the ear hears the flaw.
//
// Scheduled clicks are held as handles so Stop can silence a
// stimulus already committed to the audio clock.
// ============================================================

import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { findThresholdDrill } from '@/lib/ear/drills'
import type { GridPattern } from '@/lib/ear/grid-pattern'
import { generateGridPattern, GRID_ANSWER_POSITIONS, GRID_CLICKS, gridPatternDuration, } from '@/lib/ear/grid-pattern'
import { GRID_TIMING } from '@/lib/ear/timing'
import { latestThresholdReading } from '@/stores/ear-lab-store'
import type { ScheduledClick } from './click-synth'
import { scheduleClick } from './click-synth'
import styles from './EarDrill.module.css'
import { ThresholdDrillView } from './ThresholdDrillView'
import type { StimulusApi } from './use-threshold-run'
import { useThresholdRun } from './use-threshold-run'

interface GridDrillProps {
  onBack: () => void
}

const POSITION_LABELS: Record<number, string> = {
  2: '3rd',
  3: '4th',
  4: '5th',
  5: '6th',
}

export function GridDrill(props: GridDrillProps): JSX.Element {
  const { audioEngine } = useEngines()
  const drill = findThresholdDrill('the-grid')
  if (!drill) throw new Error('the-grid drill missing from catalogue')

  let pattern: GridPattern | null = null
  let scheduled: ScheduledClick[] = []
  let stepTimers: Array<ReturnType<typeof setTimeout>> = []

  /** Silence the whole stimulus: the pending dot timers AND the
   *  oscillators already handed to the audio clock. Clearing the
   *  timers alone would leave the clicks sounding. */
  function cancelStimulus(): void {
    for (const timer of stepTimers) clearTimeout(timer)
    stepTimers = []
    for (const click of scheduled) click.cancel()
    scheduled = []
  }

  async function playStimulus(level: number, api: StimulusApi): Promise<void> {
    await audioEngine.init()
    await audioEngine.resume()
    const ctx = audioEngine.getAudioContext()
    if (!ctx || api.cancelled()) return

    cancelStimulus()

    const current = generateGridPattern(level)
    pattern = current
    const start = ctx.currentTime + GRID_TIMING.leadInS

    for (const [i, offset] of current.clickTimes.entries()) {
      scheduled.push(scheduleClick(ctx, start + offset))
      // The pulsing dots ride on setTimeout — close enough for eyes;
      // only the audio needs (and gets) the sample-accurate clock.
      stepTimers.push(
        setTimeout(
          () => {
            if (!api.cancelled()) api.step(i + 1)
          },
          (GRID_TIMING.leadInS + offset) * 1000,
        ),
      )
    }

    await new Promise<void>((resolve) => {
      stepTimers.push(
        setTimeout(
          () => resolve(),
          (GRID_TIMING.leadInS + gridPatternDuration(current)) * 1000 +
            GRID_TIMING.tailMs,
        ),
      )
    })
  }

  const run = useThresholdRun(drill, playStimulus, { cancelStimulus })

  return (
    <ThresholdDrillView
      title="The Grid"
      drillId="the-grid"
      description="Six clicks on a perfectly steady grid — except one of the last four, nudged early or late. Say which. The nudge keeps shrinking toward the finest timing flaw your ear still catches, in milliseconds."
      listenHint="Listen to the lattice…"
      answerHint="Which click was off the grid?"
      levelCaption="Offset"
      levelLabel={() => `${run.level().toFixed(0)} ms`}
      formatValue={(value) => value.toFixed(0)}
      unitLabel="ms"
      unitShort=" ms"
      latestValue={() => latestThresholdReading('the-grid')?.value ?? null}
      run={run}
      stage={() => (
        <div class={styles.cadenceDots}>
          <For each={Array.from({ length: GRID_CLICKS }, (_, i) => i)}>
            {(i) => (
              <div
                class={`${styles.cadenceDot} ${
                  run.phase() === 'stimulus' && run.stimulusStep() > i
                    ? styles.lit
                    : ''
                }`}
              />
            )}
          </For>
        </div>
      )}
      answers={() => (
        <div class={styles.answerRow}>
          <For each={[...GRID_ANSWER_POSITIONS]}>
            {(position) => (
              <button
                type="button"
                class={styles.answerBtn}
                style={{ 'min-width': '70px' }}
                disabled={run.phase() !== 'answer'}
                onClick={() =>
                  run.answerCorrect(position === pattern?.displacedIndex)
                }
              >
                {POSITION_LABELS[position]}
              </button>
            )}
          </For>
        </div>
      )}
      onBack={props.onBack}
    />
  )
}
