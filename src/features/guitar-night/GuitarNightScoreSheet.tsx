// ============================================================
// Guitar Night Score sheet — objective take results without phrase diagnosis.
// ============================================================
//
// The room owns scoring and persistence. This reusable modal owns the calm
// Velvet Rehearsal hierarchy, keyboard containment, empty/partial states, and
// the clear boundary between a take score and an optional Jam Doctor review.

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createUniqueId, For, onCleanup, Show, } from 'solid-js'
import { Portal } from 'solid-js/web'
import { Ear, History, Play, X } from '@/components/icons'
import type { GuitarScoreRecentOutcome, GuitarScoreTakeSummary, } from '@/lib/guitar/guitar-score-history'
import { useFocusTrap } from '@/lib/use-focus-trap'
import styles from './GuitarNightScoreSheet.module.css'

export interface GuitarNightScoreSheetProps {
  open: boolean
  /** The take on the stage now. Held takes are shown as partial, not saved. */
  current: GuitarScoreTakeSummary | null
  /** Completed device-local summaries, oldest to newest or newest to oldest. */
  history: readonly GuitarScoreTakeSummary[]
  returnFocus?: Accessor<HTMLElement | null>
  onClose(): void
  /** Omit when the displayed result does not belong to the loaded score. */
  onPlayAgain?(): void
  /** Phrase diagnosis stays optional and separate from objective scoring. */
  onReviewPhrase?(): void
}

function sameTake(
  left: GuitarScoreTakeSummary,
  right: GuitarScoreTakeSummary,
): boolean {
  return (
    left.savedAt === right.savedAt &&
    left.pieceLabel === right.pieceLabel &&
    left.trackLabel === right.trackLabel &&
    left.range.startBeat === right.range.startBeat &&
    left.range.endBeat === right.range.endBeat
  )
}

function countedBeat(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1)
}

function rangeLabel(summary: GuitarScoreTakeSummary): string {
  return `Scored beats ${countedBeat(summary.range.startBeat + 1)}–${countedBeat(summary.range.endBeat)}`
}

function inputLabel(summary: GuitarScoreTakeSummary): string {
  if (summary.inputKind === 'interface') return 'Direct input'
  if (summary.inputKind === 'midi') return 'MIDI'
  return 'Room mic'
}

function dateLabel(savedAt: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(savedAt))
}

function scoreLabel(summary: GuitarScoreTakeSummary): string {
  return summary.score === null
    ? 'No score yet'
    : `${Math.round(summary.score)} out of 100`
}

function evidenceDetail(summary: GuitarScoreTakeSummary): string {
  if (summary.status === 'partial') {
    return summary.counts.judgedTargets === 0
      ? 'No notes have been judged yet. Finish the take to add it to history.'
      : 'This held result stays on the stage and is not added to history.'
  }
  if (summary.grade === null) {
    return 'At least four judged notes are needed for a letter grade.'
  }
  if (summary.evidence.status === 'event-gap') {
    return 'Some notes were skipped where input evidence left the live window.'
  }
  return `${summary.counts.judgedTargets} notes judged against ${summary.trackLabel}.`
}

function outcomeLabel(outcome: GuitarScoreRecentOutcome): string {
  if (outcome.outcome === 'hit') {
    return `Hit, ${Math.round(outcome.score)} points`
  }
  if (outcome.outcome === 'miss') return 'Missed note'
  return 'Skipped without a score'
}

function latestHeading(summary: GuitarScoreTakeSummary): string {
  if (summary.status === 'partial') return 'Score held'
  if (summary.grade === null) return 'Not enough notes to grade'
  return 'Take complete'
}

export function GuitarNightScoreSheet(props: GuitarNightScoreSheetProps) {
  let panel: HTMLElement | undefined
  const generatedId = createUniqueId()
  const titleId = `guitar-night-score-${generatedId}-title`
  const descriptionId = `guitar-night-score-${generatedId}-description`
  const latestTitleId = `guitar-night-score-${generatedId}-latest`

  const completedHistory = createMemo(() =>
    [...props.history]
      .filter((summary) => summary.status === 'completed')
      .sort((left, right) => right.savedAt - left.savedAt),
  )
  const latest = createMemo(
    () => props.current ?? completedHistory()[0] ?? null,
  )
  const recent = createMemo(() => {
    const current = latest()
    return completedHistory()
      .filter((summary) => current === null || !sameTake(summary, current))
      .slice(0, 6)
  })

  useFocusTrap(() => panel, {
    isOpen: () => props.open,
    onClose: () => props.onClose(),
    initialFocus: () => panel,
  })

  let wasOpen = false
  createEffect(() => {
    if (props.open) {
      wasOpen = true
      const previousOverflow = document.documentElement.style.overflow
      document.documentElement.style.overflow = 'hidden'
      onCleanup(() => {
        document.documentElement.style.overflow = previousOverflow
      })
      return
    }
    if (!wasOpen) return
    wasOpen = false
    const returnFocus = props.returnFocus
    queueMicrotask(() => {
      const target = returnFocus?.() ?? null
      if (target?.isConnected === true) target.focus({ preventScroll: true })
    })
  })

  return (
    <Show when={props.open}>
      <Portal mount={document.body}>
        <div
          class={styles.backdrop}
          data-testid="guitar-night-score-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) props.onClose()
          }}
        >
          <aside
            ref={panel}
            class={styles.sheet}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            tabindex="-1"
          >
            <div class={styles.header}>
              <div>
                <span>Rehearsal record</span>
                <h2 id={titleId}>Score</h2>
              </div>
              <button
                class={styles.close}
                type="button"
                aria-label="Close Score"
                onClick={() => props.onClose()}
              >
                <X />
              </button>
            </div>

            <p id={descriptionId} class={styles.intro}>
              Note results from this device. Timing and phrase guidance remain a
              separate review.
            </p>

            <div class={styles.body}>
              <Show
                when={latest()}
                fallback={
                  <div class={styles.empty}>
                    <span class={styles.emptyIcon} aria-hidden="true">
                      <History />
                    </span>
                    <h3>No scored take yet</h3>
                    <p>
                      Turn on Listening, play the written part, then finish the
                      take. Your first result will wait here.
                    </p>
                  </div>
                }
              >
                {(summary) => (
                  <section
                    class={styles.latest}
                    aria-labelledby={latestTitleId}
                    data-status={summary().status}
                    data-evidence={summary().evidence.status}
                  >
                    <div class={styles.latestMeta}>
                      <div>
                        <span>{summary().pieceLabel}</span>
                        <strong>
                          {summary().trackLabel} · {rangeLabel(summary())}
                        </strong>
                      </div>
                      <time
                        datetime={new Date(summary().savedAt).toISOString()}
                      >
                        {dateLabel(summary().savedAt)}
                      </time>
                    </div>

                    <div class={styles.resultLine}>
                      <div class={styles.resultIdentity}>
                        <h3 id={latestTitleId}>{latestHeading(summary())}</h3>
                        <output
                          class={styles.gradeMark}
                          aria-label={
                            summary().grade === null
                              ? 'No letter grade'
                              : `Grade ${summary().grade}`
                          }
                        >
                          <Show
                            when={summary().grade}
                            fallback={<span class={styles.noGrade}>—</span>}
                          >
                            {(grade) => grade()}
                          </Show>
                        </output>
                      </div>
                      <div class={styles.scoreValue}>
                        <strong>
                          {summary().score === null
                            ? '—'
                            : Math.round(summary().score ?? 0)}
                        </strong>
                        <span>
                          {summary().score === null ? 'unscored' : '/100'}
                        </span>
                      </div>
                      <p>{evidenceDetail(summary())}</p>
                    </div>

                    <dl class={styles.counts}>
                      <div>
                        <dt>Hit</dt>
                        <dd>{summary().counts.hitTargets}</dd>
                      </div>
                      <div>
                        <dt>Missed</dt>
                        <dd>{summary().counts.missedTargets}</dd>
                      </div>
                      <div>
                        <dt>Skipped</dt>
                        <dd>{summary().counts.skippedTargets}</dd>
                      </div>
                      <div>
                        <dt>Best run</dt>
                        <dd>{summary().bestStreak}</dd>
                      </div>
                    </dl>

                    <Show when={summary().recentOutcomes.length > 0}>
                      <div class={styles.outcomes}>
                        <div>
                          <span>Recent notes</span>
                          <small>
                            {summary().counts.judgedTargets} of{' '}
                            {summary().counts.targetCount} judged ·{' '}
                            {inputLabel(summary())}
                          </small>
                        </div>
                        <ol aria-label="Recent note outcomes">
                          <For each={summary().recentOutcomes}>
                            {(outcome) => (
                              <li
                                data-outcome={outcome.outcome}
                                title={outcomeLabel(outcome)}
                              >
                                <span class={styles.visuallyHidden}>
                                  {outcomeLabel(outcome)}
                                </span>
                              </li>
                            )}
                          </For>
                        </ol>
                      </div>
                    </Show>
                  </section>
                )}
              </Show>

              <Show when={recent().length > 0}>
                <section
                  class={styles.recent}
                  aria-labelledby={`${latestTitleId}-recent`}
                >
                  <div class={styles.sectionHeading}>
                    <h3 id={`${latestTitleId}-recent`}>Recent takes</h3>
                    <span>Saved on this device</span>
                  </div>
                  <ol>
                    <For each={recent()}>
                      {(summary) => (
                        <li>
                          <div class={styles.recentIdentity}>
                            <strong>{summary.pieceLabel}</strong>
                            <span>
                              {summary.trackLabel} · {rangeLabel(summary)}
                            </span>
                            <time
                              datetime={new Date(summary.savedAt).toISOString()}
                            >
                              {dateLabel(summary.savedAt)}
                            </time>
                          </div>
                          <div class={styles.recentResult}>
                            <strong
                              aria-label={
                                summary.grade === null
                                  ? 'No grade'
                                  : `Grade ${summary.grade}`
                              }
                            >
                              {summary.grade ?? '—'}
                            </strong>
                            <span>{scoreLabel(summary)}</span>
                          </div>
                        </li>
                      )}
                    </For>
                  </ol>
                </section>
              </Show>

              <Show when={latest()}>
                <p class={styles.privacy}>
                  Only note outcomes and summary counts are kept here. Audio and
                  input device identities are not saved.
                </p>
              </Show>
            </div>

            <Show
              when={
                latest() !== null &&
                (props.onPlayAgain !== undefined ||
                  props.onReviewPhrase !== undefined)
              }
            >
              <div class={styles.actions}>
                <Show when={props.onPlayAgain !== undefined}>
                  <button
                    class={styles.playAgain}
                    type="button"
                    onClick={() => props.onPlayAgain?.()}
                  >
                    <span aria-hidden="true">
                      <Play />
                    </span>
                    Play again
                  </button>
                </Show>
                <Show when={props.onReviewPhrase}>
                  <button
                    class={styles.review}
                    type="button"
                    onClick={() => props.onReviewPhrase?.()}
                  >
                    <span aria-hidden="true">
                      <Ear />
                    </span>
                    Review a phrase
                  </button>
                </Show>
              </div>
            </Show>
          </aside>
        </div>
      </Portal>
    </Show>
  )
}
