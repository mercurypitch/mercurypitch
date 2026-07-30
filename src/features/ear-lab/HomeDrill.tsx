// ============================================================
// HomeDrill — scale-degree identification, the Ear Lab's spine.
//
// A cadence plants the key (four dots light as the chords land), a
// probe note sounds, and the answer is one of seven degree buttons.
// The reveal colours the truth: the correct degree goes green; a
// wrong pick goes red beside it while the probe replays and falls
// to the tonic, so the misjudged distance is heard again with the
// answer known.
// ============================================================

import type { JSX } from 'solid-js'
import { createMemo, For, onCleanup, Show } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { isProvisional } from '@/lib/ear/elo'
import { HOME_DEGREES } from '@/lib/ear/item-bank'
import styles from './EarDrill.module.css'
import { useHomeController } from './use-home-controller'

interface HomeDrillProps {
  onBack: () => void
}

const CADENCE_LABELS = ['I', 'IV', 'V', 'I']

export function HomeDrill(props: HomeDrillProps): JSX.Element {
  const { audioEngine } = useEngines()
  const controller = useHomeController(audioEngine)
  onCleanup(() => controller.dispose())

  const running = () =>
    controller.phase() !== 'idle' && controller.phase() !== 'done'

  const stageClass = createMemo(() => {
    if (controller.phase() !== 'reveal') return styles.stage
    const correct =
      controller.answeredDegree() === controller.currentDegree()?.degree
    return `${styles.stage} ${correct ? styles.correct : styles.wrong}`
  })

  /** How many cadence chords have sounded (drives the dots). The
   *  controller phase is 'cadence' for the whole progression, so the
   *  dots light on a coarse timer illusion — all lit by probe time. */
  const stageHint = () => {
    switch (controller.phase()) {
      case 'cadence':
        return 'Planting the key…'
      case 'probe':
        return 'The note — which degree is it?'
      case 'answer':
        return 'Which degree was that?'
      case 'reveal': {
        const target = controller.currentDegree()
        if (!target) return ''
        const correct = controller.answeredDegree() === target.degree
        return correct
          ? `Yes — ${target.solfege} (${target.degree})`
          : `That was ${target.solfege} (${target.degree}) — hear it fall home`
      }
      default:
        return ''
    }
  }

  function degreeClass(degree: number): string {
    if (controller.phase() !== 'reveal') return styles.degreeBtn
    const target = controller.currentDegree()?.degree
    const picked = controller.answeredDegree()
    if (degree === target) return `${styles.degreeBtn} ${styles.correctPick}`
    if (degree === picked) return `${styles.degreeBtn} ${styles.wrongPick}`
    return styles.degreeBtn
  }

  return (
    <div class={styles.drill} data-ear-drill="home">
      <div class={styles.header}>
        <button
          type="button"
          class={styles.backBtn}
          onClick={() => props.onBack()}
        >
          Back
        </button>
        <h2>Home</h2>
        <span class={styles.modeChip}>
          Rating {Math.round(controller.rating().rating)}
          {isProvisional(controller.rating()) ? ' · settling' : ''}
        </span>
      </div>

      <Show when={running()}>
        <div class={styles.status}>
          <span>
            Round{' '}
            <span class={styles.statusValue}>
              {Math.min(controller.round() + 1, controller.totalRounds)} /{' '}
              {controller.totalRounds}
            </span>
          </span>
          <div class={styles.progressTrack}>
            <div
              class={styles.progressFill}
              style={{
                width: `${(controller.round() / controller.totalRounds) * 100}%`,
              }}
            />
          </div>
        </div>
      </Show>

      <Show
        when={controller.phase() !== 'done'}
        fallback={<HomeDone controller={controller} onBack={props.onBack} />}
      >
        <div class={stageClass()}>
          <Show
            when={running()}
            fallback={
              <div class={styles.idleCard}>
                <p>
                  A short cadence tells your ear where home is. Then one note
                  sounds — name its scale degree. This is the hearing that
                  transfers to real music: not "a major sixth", but "that note
                  is La, and it wants to fall to Sol".
                </p>
                <button
                  type="button"
                  class={styles.primaryBtn}
                  onClick={() => controller.start()}
                >
                  Start (12 rounds)
                </button>
              </div>
            }
          >
            <div class={styles.cadenceDots}>
              <For each={CADENCE_LABELS}>
                {(label, i) => (
                  <div
                    class={`${styles.cadenceDot} ${
                      controller.phase() !== 'cadence' ||
                      i() < controller.cadenceStep()
                        ? styles.lit
                        : ''
                    }`}
                    title={label}
                  />
                )}
              </For>
            </div>

            <p class={styles.stageHint}>{stageHint()}</p>

            <div class={styles.degreeGrid}>
              <For each={HOME_DEGREES}>
                {(degree) => (
                  <button
                    type="button"
                    class={degreeClass(degree.degree)}
                    disabled={controller.phase() !== 'answer'}
                    onClick={() => controller.answer(degree.degree)}
                  >
                    <span class={styles.degreeNumber}>{degree.degree}</span>
                    <span class={styles.degreeSolfege}>{degree.solfege}</span>
                  </button>
                )}
              </For>
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

function HomeDone(props: {
  controller: ReturnType<typeof useHomeController>
  onBack: () => void
}): JSX.Element {
  const result = () => props.controller.result()

  return (
    <div class={styles.stage}>
      <div class={styles.doneCard}>
        <Show when={result()}>
          {(r) => (
            <>
              <div>
                <span class={styles.reading}>
                  {Math.round(r().rating.rating)}
                </span>{' '}
                <span class={styles.readingUnit}>Function rating</span>
              </div>
              <span
                class={r().ratingDelta >= 0 ? styles.deltaUp : styles.deltaDown}
              >
                {r().ratingDelta >= 0 ? '+' : ''}
                {r().ratingDelta} this session
              </span>
              <Show when={isProvisional(r().rating)}>
                <span class={styles.provisionalBadge}>
                  Provisional — keeps settling for {10 - r().rating.attempts}{' '}
                  more answers
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
                      title={`Degree ${outcome.degree}${
                        outcome.correct ? '' : ` — answered ${outcome.answered}`
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
  )
}
