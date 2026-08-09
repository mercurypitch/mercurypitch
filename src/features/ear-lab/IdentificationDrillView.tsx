// ============================================================
// IdentificationDrillView — shared chrome for the button drills
// (Leap, Stack, Contour). Same skeleton as Home minus the cadence
// and mic machinery: prompt sounds, choice grid answers, reveal
// colours the truth, end card reports the rating with its delta.
// ============================================================

import type { JSX } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { isProvisional } from '@/lib/ear/elo'
import styles from './EarDrill.module.css'
import type { useIdentificationController } from './use-identification-controller'

export interface IdentificationChoice {
  id: string
  label: string
  sub?: string
}

interface IdentificationDrillViewProps {
  title: string
  description: string
  /** Copy under the hint while the prompt plays. */
  listenHint: string
  answerHint: string
  choices: IdentificationChoice[]
  /** Buttons per row (choice grids differ: 6 for Leap, 3 for
   *  Stack/Contour). */
  columns: number
  controller: ReturnType<typeof useIdentificationController>
  /** Reveal copy for the correct choice, e.g. "Minor 6th". */
  revealName: (choiceId: string) => string
  onBack: () => void
}

export function IdentificationDrillView(
  props: IdentificationDrillViewProps,
): JSX.Element {
  // No cleanup here: the controller registers its own onCleanup, so
  // disposing from the view too would just double up.
  const running = () =>
    props.controller.phase() !== 'idle' && props.controller.phase() !== 'done'

  const stageClass = createMemo(() => {
    if (props.controller.phase() !== 'reveal') return styles.stage
    const correct =
      props.controller.answeredId() === props.controller.expectedId()
    return `${styles.stage} ${correct ? styles.correct : styles.wrong}`
  })

  const stageHint = () => {
    switch (props.controller.phase()) {
      case 'playing':
        return props.listenHint
      case 'answer':
        return props.answerHint
      case 'reveal': {
        const expected = props.controller.expectedId()
        if (expected === null) return ''
        const correct = props.controller.answeredId() === expected
        return correct
          ? `Yes — ${props.revealName(expected)}`
          : `That was ${props.revealName(expected)} — listen again`
      }
      default:
        return ''
    }
  }

  function choiceClass(id: string): string {
    if (props.controller.phase() !== 'reveal') return styles.degreeBtn
    if (id === props.controller.expectedId())
      return `${styles.degreeBtn} ${styles.correctPick}`
    if (id === props.controller.answeredId())
      return `${styles.degreeBtn} ${styles.wrongPick}`
    return styles.degreeBtn
  }

  return (
    <div class={styles.drill} data-ear-drill={props.title.toLowerCase()}>
      <div class={styles.header}>
        <button
          type="button"
          class={styles.backBtn}
          onClick={() => props.onBack()}
        >
          Back
        </button>
        <h2>{props.title}</h2>
        <span class={styles.modeChip}>
          Rating {Math.round(props.controller.rating().rating)}
          {isProvisional(props.controller.rating()) ? ' · settling' : ''}
        </span>
      </div>

      <Show when={running()}>
        <div class={styles.status}>
          <span>
            Round{' '}
            <span class={styles.statusValue}>
              {Math.min(
                props.controller.round() + 1,
                props.controller.totalRounds,
              )}{' '}
              / {props.controller.totalRounds}
            </span>
          </span>
          <div class={styles.progressTrack}>
            <div
              class={styles.progressFill}
              style={{
                width: `${
                  (props.controller.round() / props.controller.totalRounds) *
                  100
                }%`,
              }}
            />
          </div>
        </div>
      </Show>

      <Show
        when={props.controller.phase() !== 'done'}
        fallback={
          <div class={styles.stage}>
            <div class={styles.doneCard}>
              <Show when={props.controller.result()}>
                {(r) => (
                  <>
                    <div>
                      <span class={styles.reading}>
                        {Math.round(r().rating.rating)}
                      </span>{' '}
                      <span class={styles.readingUnit}>
                        {props.title} rating
                      </span>
                    </div>
                    <span
                      class={
                        r().ratingDelta >= 0 ? styles.deltaUp : styles.deltaDown
                      }
                    >
                      {r().ratingDelta >= 0 ? '+' : ''}
                      {r().ratingDelta} this session
                    </span>
                    <Show when={isProvisional(r().rating)}>
                      <span class={styles.provisionalBadge}>
                        Provisional — keeps settling for{' '}
                        {10 - r().rating.attempts} more answers
                      </span>
                    </Show>
                    <p class={styles.stageHint}>
                      {r().correct} of {r().total} named correctly
                    </p>
                    <div class={styles.outcomeDots}>
                      <For each={r().outcomes}>
                        {(outcome) => (
                          <div
                            class={`${styles.outcomeDot} ${
                              outcome.correct ? '' : styles.miss
                            }`}
                            title={`${props.revealName(outcome.expectedId)}${
                              outcome.correct
                                ? ''
                                : ` — answered ${props.revealName(outcome.answeredId)}`
                            }`}
                          />
                        )}
                      </For>
                    </div>
                  </>
                )}
              </Show>
              <div class={styles.answerRow}>
                <button
                  type="button"
                  class={styles.primaryBtn}
                  onClick={() => props.controller.start()}
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
                <button
                  type="button"
                  class={styles.primaryBtn}
                  onClick={() => props.controller.start()}
                >
                  Start (12 rounds)
                </button>
              </div>
            }
          >
            <p class={styles.stageHint}>{stageHint()}</p>

            <div
              class={styles.choiceGrid}
              style={{
                'grid-template-columns': `repeat(${props.columns}, minmax(0, 1fr))`,
              }}
            >
              <For each={props.choices}>
                {(choice) => (
                  <button
                    type="button"
                    class={choiceClass(choice.id)}
                    disabled={props.controller.phase() !== 'answer'}
                    onClick={() => props.controller.answer(choice.id)}
                  >
                    <span class={styles.degreeNumber}>{choice.label}</span>
                    <Show when={choice.sub}>
                      <span class={styles.degreeSolfege}>{choice.sub}</span>
                    </Show>
                  </button>
                )}
              </For>
            </div>

            <button
              type="button"
              class={styles.secondaryBtn}
              onClick={() => props.controller.stop()}
            >
              Stop
            </button>
          </Show>
        </div>
      </Show>
    </div>
  )
}
