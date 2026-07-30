// ============================================================
// HairlineDrill — the Resolution drill's runner UI.
//
// The stage shows two mercury beads whose horizontal separation is
// the current staircase gap: as the ear sharpens, the beads close
// in until they nearly merge. The beads deliberately sit at the
// SAME height — showing which tone was higher would answer the
// question for the eye instead of the ear. The gap in cents is
// displayed openly (it is the difficulty, not the answer).
// ============================================================

import type { JSX } from 'solid-js'
import { createMemo, onCleanup, onMount, Show } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { findThresholdDrill } from '@/lib/ear/drills'
import { latestThresholdReading } from '@/stores/ear-lab-store'
import styles from './EarDrill.module.css'
import { useHairlineController } from './use-hairline-controller'
import type { ThresholdRunMode } from './use-threshold-run'

interface HairlineDrillProps {
  onBack: () => void
  /** When set, the run starts immediately in this mode (the
   *  dashboard's Calibrate CTA jumps straight in). */
  autoStartMode?: ThresholdRunMode
}

export function HairlineDrill(props: HairlineDrillProps): JSX.Element {
  const { audioEngine } = useEngines()
  const drill = findThresholdDrill('hairline')
  if (!drill) throw new Error('hairline drill missing from catalogue')

  const controller = useHairlineController(drill, audioEngine)
  onCleanup(() => controller.dispose())
  onMount(() => {
    if (props.autoStartMode) controller.start(props.autoStartMode)
  })

  /** Bead separation from the staircase level, log-scaled across the
   *  drill's floor..ceiling so early coarse steps stay on screen. */
  const separation = createMemo(() => {
    const { min, max } = drill.staircase
    const t =
      (Math.log(controller.levelCents()) - Math.log(min)) /
      (Math.log(max) - Math.log(min))
    return 10 + Math.max(0, Math.min(1, t)) * 110
  })

  const running = () =>
    controller.phase() !== 'idle' && controller.phase() !== 'done'

  const stageClass = () => {
    const base = styles.stage
    if (controller.phase() !== 'reveal') return base
    return `${base} ${controller.lastCorrect() === true ? styles.correct : styles.wrong}`
  }

  const gapLabel = () => `${controller.levelCents().toFixed(1)}¢`

  const lastPractice = () => latestThresholdReading('hairline', 'practice')

  return (
    <div class={styles.drill} data-ear-drill="hairline">
      <div class={styles.header}>
        <button
          type="button"
          class={styles.backBtn}
          onClick={() => props.onBack()}
        >
          Back
        </button>
        <h2>Hairline</h2>
        <Show when={running()}>
          <span
            class={`${styles.modeChip} ${
              controller.mode() === 'calibration' ? styles.calibration : ''
            }`}
          >
            {controller.mode() === 'calibration' ? 'Calibration' : 'Practice'}
          </span>
        </Show>
      </div>

      <Show when={running()}>
        <div class={styles.status}>
          <span>
            Gap <span class={styles.statusValue}>{gapLabel()}</span>
          </span>
          <span>
            Trial{' '}
            <span class={styles.statusValue}>{controller.trials() + 1}</span>
          </span>
          <div
            class={styles.progressTrack}
            title={`${controller.reversalsDone()} of ${controller.reversalTarget()} reversals`}
          >
            <div
              class={styles.progressFill}
              style={{
                width: `${Math.min(
                  100,
                  (controller.reversalsDone() / controller.reversalTarget()) *
                    100,
                )}%`,
              }}
            />
          </div>
        </div>
      </Show>

      <Show
        when={controller.phase() !== 'done'}
        fallback={
          <HairlineDone
            controller={controller}
            drill={drill}
            onBack={props.onBack}
          />
        }
      >
        <div class={stageClass()}>
          <Show
            when={running()}
            fallback={
              <div class={styles.idleCard}>
                <p>
                  Two tones. Pick the higher one. The gap between them keeps
                  shrinking toward the finest difference your ear can still
                  resolve — that number, in cents, is your reading. It falls as
                  you improve, and there is no ceiling to park at.
                </p>
                <Show when={lastPractice()}>
                  {(reading) => (
                    <p>
                      Last practice reading:{' '}
                      <strong>
                        {reading().value.toFixed(1)}
                        {'¢'}
                      </strong>
                    </p>
                  )}
                </Show>
                <div class={styles.answerRow}>
                  <button
                    type="button"
                    class={styles.primaryBtn}
                    onClick={() => controller.start('practice')}
                  >
                    Practice run (about a minute)
                  </button>
                  <button
                    type="button"
                    class={styles.secondaryBtn}
                    onClick={() => controller.start('calibration')}
                  >
                    Calibration (3 tracks, about 3 minutes)
                  </button>
                </div>
              </div>
            }
          >
            <svg class={styles.beads} viewBox="0 0 320 90" aria-hidden="true">
              <line class={styles.beadRail} x1="30" x2="290" y1="45" y2="45" />
              <circle
                class={`${styles.bead} ${
                  controller.phase() === 'stimulus' &&
                  controller.stimulusStep() === 1
                    ? styles.active
                    : ''
                }`}
                cx={160 - separation() / 2}
                cy="45"
                r="14"
              />
              <circle
                class={`${styles.bead} ${
                  controller.phase() === 'stimulus' &&
                  controller.stimulusStep() === 2
                    ? styles.active
                    : ''
                }`}
                cx={160 + separation() / 2}
                cy="45"
                r="14"
              />
            </svg>

            <p class={styles.stageHint}>
              {controller.phase() === 'answer'
                ? 'Which tone was higher?'
                : 'Listen…'}
            </p>

            <div class={styles.answerRow}>
              <button
                type="button"
                class={styles.answerBtn}
                disabled={controller.phase() !== 'answer'}
                onClick={() => controller.answer('first')}
              >
                First was higher
              </button>
              <button
                type="button"
                class={styles.answerBtn}
                disabled={controller.phase() !== 'answer'}
                onClick={() => controller.answer('second')}
              >
                Second was higher
              </button>
            </div>

            <button
              type="button"
              class={styles.secondaryBtn}
              onClick={() => controller.stop()}
            >
              Stop
            </button>
          </Show>
        </div>
      </Show>
    </div>
  )
}

function HairlineDone(props: {
  controller: ReturnType<typeof useHairlineController>
  drill: NonNullable<ReturnType<typeof findThresholdDrill>>
  onBack: () => void
}): JSX.Element {
  const estimate = () => props.controller.result()?.estimate ?? null

  return (
    <div class={styles.stage}>
      <div class={styles.doneCard}>
        <Show
          when={estimate()}
          fallback={
            <p class={styles.stageHint}>
              Stopped before the tracks could finish — a calibration only counts
              when all three run to the end, so nothing was marked.
            </p>
          }
        >
          {(reading) => (
            <>
              <div>
                <span class={styles.reading}>{reading().value.toFixed(1)}</span>{' '}
                <span class={styles.readingUnit}>cents</span>
              </div>
              <Show when={'standardError' in reading()}>
                <span class={styles.readingSpread}>
                  ±{' '}
                  {(
                    reading() as { standardError: number }
                  ).standardError.toFixed(1)}
                  {'¢'} across 3 pooled tracks
                </span>
              </Show>
              <Show when={reading().provisional}>
                <span class={styles.provisionalBadge}>
                  Provisional — short run
                </span>
              </Show>
              <Show when={props.controller.grade()}>
                {(grade) => (
                  <p class={styles.stageHint}>
                    Grade {grade()} · {props.controller.trials()} trials
                  </p>
                )}
              </Show>
              <Show when={props.controller.result()?.markedIndex !== undefined}>
                <p class={styles.stageHint}>
                  Mercury Column marked at{' '}
                  <strong>{props.controller.result()?.markedIndex}</strong>
                </p>
              </Show>
            </>
          )}
        </Show>

        <div class={styles.answerRow}>
          <button
            type="button"
            class={styles.primaryBtn}
            onClick={() =>
              props.controller.start(
                props.controller.result()?.mode ?? 'practice',
              )
            }
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
  )
}
