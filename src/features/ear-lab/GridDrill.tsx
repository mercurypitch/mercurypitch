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
// ============================================================

import type { JSX } from 'solid-js'
import { For, onCleanup, Show } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { findThresholdDrill } from '@/lib/ear/drills'
import type { GridPattern } from '@/lib/ear/grid-pattern'
import { generateGridPattern, GRID_ANSWER_POSITIONS, GRID_CLICKS, gridPatternDuration, } from '@/lib/ear/grid-pattern'
import { latestThresholdReading } from '@/stores/ear-lab-store'
import { scheduleClick } from './click-synth'
import styles from './EarDrill.module.css'
import type { StimulusApi } from './use-threshold-run'
import { useThresholdRun } from './use-threshold-run'

interface GridDrillProps {
  onBack: () => void
}

const LEAD_IN_S = 0.2
const TAIL_MS = 250

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
  let stepTimers: Array<ReturnType<typeof setTimeout>> = []

  async function playStimulus(level: number, api: StimulusApi): Promise<void> {
    await audioEngine.init()
    await audioEngine.resume()
    const ctx = audioEngine.getAudioContext()
    if (!ctx) return

    const current = generateGridPattern(level)
    pattern = current
    const start = ctx.currentTime + LEAD_IN_S

    for (const timer of stepTimers) clearTimeout(timer)
    stepTimers = []

    current.clickTimes.forEach((offset, i) => {
      scheduleClick(ctx, start + offset)
      // The pulsing dots ride on setTimeout — close enough for eyes;
      // only the audio needs (and gets) the sample-accurate clock.
      stepTimers.push(
        setTimeout(
          () => {
            if (!api.cancelled()) api.step(i + 1)
          },
          (LEAD_IN_S + offset) * 1000,
        ),
      )
    })

    await new Promise((resolve) => {
      stepTimers.push(
        setTimeout(
          resolve,
          (LEAD_IN_S + gridPatternDuration(current)) * 1000 + TAIL_MS,
        ),
      )
    })
  }

  const run = useThresholdRun(drill, playStimulus)
  onCleanup(() => {
    run.dispose()
    for (const timer of stepTimers) clearTimeout(timer)
  })

  const running = () => run.phase() !== 'idle' && run.phase() !== 'done'

  const stageClass = () => {
    if (run.phase() !== 'reveal') return styles.stage
    return `${styles.stage} ${run.lastCorrect() === true ? styles.correct : styles.wrong}`
  }

  const lastReading = () => latestThresholdReading('the-grid')

  return (
    <div class={styles.drill} data-ear-drill="the-grid">
      <div class={styles.header}>
        <button
          type="button"
          class={styles.backBtn}
          onClick={() => props.onBack()}
        >
          Back
        </button>
        <h2>The Grid</h2>
        <Show when={running()}>
          <span
            class={`${styles.modeChip} ${
              run.mode() === 'calibration' ? styles.calibration : ''
            }`}
          >
            {run.mode() === 'calibration' ? 'Calibration' : 'Practice'}
          </span>
        </Show>
      </div>

      <Show when={running()}>
        <div class={styles.status}>
          <span>
            Offset{' '}
            <span class={styles.statusValue}>{run.level().toFixed(0)} ms</span>
          </span>
          <span>
            Trial <span class={styles.statusValue}>{run.trials() + 1}</span>
          </span>
          <div
            class={styles.progressTrack}
            title={`${run.reversalsDone()} of ${run.reversalTarget()} reversals`}
          >
            <div
              class={styles.progressFill}
              style={{
                width: `${Math.min(
                  100,
                  (run.reversalsDone() / run.reversalTarget()) * 100,
                )}%`,
              }}
            />
          </div>
        </div>
      </Show>

      <Show
        when={run.phase() !== 'done'}
        fallback={
          <div class={styles.stage}>
            <div class={styles.doneCard}>
              <Show
                when={run.result()?.estimate}
                fallback={
                  <p class={styles.stageHint}>
                    Stopped before the tracks could finish — nothing was marked.
                  </p>
                }
              >
                {(estimate) => (
                  <>
                    <div>
                      <span class={styles.reading}>
                        {estimate().value.toFixed(0)}
                      </span>{' '}
                      <span class={styles.readingUnit}>ms</span>
                    </div>
                    <Show when={estimate().provisional}>
                      <span class={styles.provisionalBadge}>
                        Provisional — short run
                      </span>
                    </Show>
                    <Show when={run.grade()}>
                      {(grade) => (
                        <p class={styles.stageHint}>
                          Grade {grade()} · {run.trials()} trials
                        </p>
                      )}
                    </Show>
                    <Show when={run.result()?.markedIndex !== undefined}>
                      <p class={styles.stageHint}>
                        Mercury Column marked at{' '}
                        <strong>{run.result()?.markedIndex}</strong>
                      </p>
                    </Show>
                  </>
                )}
              </Show>
              <div class={styles.answerRow}>
                <button
                  type="button"
                  class={styles.primaryBtn}
                  onClick={() => run.start(run.result()?.mode ?? 'practice')}
                >
                  Run again
                </button>
                <button
                  type="button"
                  class={styles.secondaryBtn}
                  onClick={() => props.onBack()}
                >
                  Back to Ear Lab
                </button>
              </div>
            </div>
          </div>
        }
      >
        <div class={stageClass()}>
          <Show
            when={running()}
            fallback={
              <div class={styles.idleCard}>
                <p>
                  Six clicks on a perfectly steady grid — except one of the last
                  four, nudged early or late. Say which. The nudge keeps
                  shrinking toward the finest timing flaw your ear still
                  catches, in milliseconds.
                </p>
                <Show when={lastReading()}>
                  {(reading) => (
                    <p>
                      Latest reading:{' '}
                      <strong>{reading().value.toFixed(0)} ms</strong>
                    </p>
                  )}
                </Show>
                <div class={styles.answerRow}>
                  <button
                    type="button"
                    class={styles.primaryBtn}
                    onClick={() => run.start('practice')}
                  >
                    Practice run
                  </button>
                  <button
                    type="button"
                    class={styles.secondaryBtn}
                    onClick={() => run.start('calibration')}
                  >
                    Calibration (3 tracks)
                  </button>
                </div>
              </div>
            }
          >
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

            <p class={styles.stageHint}>
              {run.phase() === 'answer'
                ? 'Which click was off the grid?'
                : 'Listen to the lattice…'}
            </p>

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

            <button
              type="button"
              class={styles.secondaryBtn}
              onClick={() => run.stop()}
            >
              Stop
            </button>
          </Show>
        </div>
      </Show>
    </div>
  )
}
