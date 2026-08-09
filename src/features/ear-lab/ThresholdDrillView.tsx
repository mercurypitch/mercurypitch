// ============================================================
// ThresholdDrillView — shared chrome for every Ruler-A drill.
//
// Hairline and The Grid differ only in their stage visual, their
// answer buttons and their unit; everything else — the header,
// the level/trial/reversal strip, the practice-vs-calibration
// idle card, and the end card with its reading, spread, grade and
// column mark — is identical and lives here once.
//
// Mirrors IdentificationDrillView on the Ruler-B side, so adding
// a drill stays a thin spec rather than another copy of the shell.
// ============================================================

import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import styles from './EarDrill.module.css'
import type { useThresholdRun } from './use-threshold-run'

interface ThresholdDrillViewProps {
  title: string
  /** Drill id for the DOM hook (tests, future tour steps). */
  drillId: string
  description: string
  listenHint: string
  answerHint: string
  /** The live staircase level, pre-formatted with its unit. */
  levelLabel: () => string
  /** Caption for that strip, e.g. "Gap" or "Offset". */
  levelCaption: string
  /** A reading formatted for display (no unit). */
  formatValue: (value: number) => string
  /** Unit shown large on the end card, e.g. "cents". */
  unitLabel: string
  /** Unit shown inline, e.g. "¢" or "ms". */
  unitShort: string
  /** Newest stored reading, or null before the first run. */
  latestValue: () => number | null
  run: ReturnType<typeof useThresholdRun>
  /** The drill's own stage visual (beads, dots…). */
  stage: () => JSX.Element
  /** The drill's answer buttons. */
  answers: () => JSX.Element
  onBack: () => void
}

export function ThresholdDrillView(
  props: ThresholdDrillViewProps,
): JSX.Element {
  const running = () =>
    props.run.phase() !== 'idle' && props.run.phase() !== 'done'

  const stageClass = () => {
    if (props.run.phase() !== 'reveal') return styles.stage
    return `${styles.stage} ${
      props.run.lastCorrect() === true ? styles.correct : styles.wrong
    }`
  }

  const estimate = () => props.run.result()?.estimate ?? null

  return (
    <div class={styles.drill} data-ear-drill={props.drillId}>
      <div class={styles.header}>
        <button
          type="button"
          class={styles.backBtn}
          onClick={() => props.onBack()}
        >
          Back
        </button>
        <h2>{props.title}</h2>
        <Show when={running()}>
          <span
            class={`${styles.modeChip} ${
              props.run.mode() === 'calibration' ? styles.calibration : ''
            }`}
          >
            {props.run.mode() === 'calibration' ? 'Calibration' : 'Practice'}
          </span>
        </Show>
      </div>

      <Show when={running()}>
        <div class={styles.status}>
          <span>
            {props.levelCaption}{' '}
            <span class={styles.statusValue}>{props.levelLabel()}</span>
          </span>
          <span>
            Trial{' '}
            <span class={styles.statusValue}>{props.run.trials() + 1}</span>
          </span>
          <div
            class={styles.progressTrack}
            title={`${props.run.reversalsDone()} of ${props.run.reversalTarget()} reversals`}
          >
            <div
              class={styles.progressFill}
              style={{
                width: `${Math.min(
                  100,
                  (props.run.reversalsDone() / props.run.reversalTarget()) *
                    100,
                )}%`,
              }}
            />
          </div>
        </div>
      </Show>

      <Show
        when={props.run.phase() !== 'done'}
        fallback={
          <div class={styles.stage}>
            <div class={styles.doneCard}>
              <Show
                when={estimate()}
                fallback={
                  <p class={styles.stageHint}>
                    Stopped before the tracks could finish — a calibration only
                    counts when all three run to the end, so nothing was marked.
                  </p>
                }
              >
                {(reading) => (
                  <>
                    <div>
                      <span class={styles.reading}>
                        {props.formatValue(reading().value)}
                      </span>{' '}
                      <span class={styles.readingUnit}>{props.unitLabel}</span>
                    </div>
                    <Show when={'standardError' in reading()}>
                      <span class={styles.readingSpread}>
                        ±{' '}
                        {props.formatValue(
                          (reading() as { standardError: number })
                            .standardError,
                        )}
                        {props.unitShort} across 3 pooled tracks
                      </span>
                    </Show>
                    <Show when={reading().provisional}>
                      <span class={styles.provisionalBadge}>
                        Provisional — short run
                      </span>
                    </Show>
                    <Show when={props.run.grade()}>
                      {(grade) => (
                        <p class={styles.stageHint}>
                          Grade {grade()} · {props.run.trials()} trials
                        </p>
                      )}
                    </Show>
                    <Show when={props.run.result()?.markedIndex !== undefined}>
                      <p class={styles.stageHint}>
                        Mercury Column marked at{' '}
                        <strong>{props.run.result()?.markedIndex}</strong>
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
                    props.run.start(props.run.result()?.mode ?? 'practice')
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
        }
      >
        <div class={stageClass()}>
          <Show
            when={running()}
            fallback={
              <div class={styles.idleCard}>
                <p>{props.description}</p>
                <Show when={props.latestValue() !== null}>
                  <p>
                    Latest reading:{' '}
                    <strong>
                      {props.formatValue(props.latestValue() ?? 0)}
                      {props.unitShort}
                    </strong>
                  </p>
                </Show>
                <div class={styles.answerRow}>
                  <button
                    type="button"
                    class={styles.primaryBtn}
                    onClick={() => props.run.start('practice')}
                  >
                    Practice run (about a minute)
                  </button>
                  <button
                    type="button"
                    class={styles.secondaryBtn}
                    onClick={() => props.run.start('calibration')}
                  >
                    Calibration (3 tracks, about 3 minutes)
                  </button>
                </div>
              </div>
            }
          >
            {props.stage()}

            <p class={styles.stageHint}>
              {props.run.phase() === 'answer'
                ? props.answerHint
                : props.listenHint}
            </p>

            {props.answers()}

            <button
              type="button"
              class={styles.secondaryBtn}
              onClick={() => props.run.stop()}
            >
              Stop
            </button>
          </Show>
        </div>
      </Show>
    </div>
  )
}
