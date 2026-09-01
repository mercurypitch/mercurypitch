// ============================================================
// Drum Take History — explicit finish action and scalar evidence ledger
// ============================================================
//
// No event, audio, device, or persistence boundary lives here. The host
// freezes a take and writes its compact summary; this lazy view renders only
// the resulting controller truth.

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, createUniqueId, For, Match, onMount, Show, Switch, } from 'solid-js'
import { AlertTriangle, CheckSmall, History, Loader2 } from '@/components/icons'
import type { DrumTakeHistoryProps } from './drum-persistence-ui'
import { formatPersistenceCount, formatPersistenceDate, formatSignedPersistenceMeasurement, } from './drum-persistence-ui'
import styles from './DrumTakeHistory.module.css'

export type {
  DrumTakeFinishState,
  DrumTakeHistoryMode,
  DrumTakeHistoryProps,
  DrumTakeHistoryState,
  DrumTakeHistoryView,
  DrumTakeSummaryRow,
} from './drum-persistence-ui'

export function DrumTakeHistory(props: DrumTakeHistoryProps): JSX.Element {
  const headingId = createUniqueId()
  const actionHeadingId = createUniqueId()
  const [discardConfirming, setDiscardConfirming] = createSignal(false)
  const readyHistory = createMemo(() => {
    const history = props.view.history
    return history.kind === 'ready' ? history : null
  })
  const visibleTakes = createMemo(() =>
    [...(readyHistory()?.takes ?? [])]
      .sort((left, right) => right.finishedAt - left.finishedAt)
      .slice(0, 6),
  )

  onMount(() => {
    if (props.mode === 'expanded' && props.view.history.kind === 'idle') {
      props.onLoadHistory()
    }
  })

  createEffect(() => {
    if (props.view.finish.kind !== 'error') setDiscardConfirming(false)
  })

  return (
    <section
      class={styles.history}
      data-mode={props.mode}
      aria-labelledby={props.mode === 'expanded' ? headingId : actionHeadingId}
      data-testid="drum-take-history"
    >
      <Show when={props.mode === 'expanded'}>
        <header class={styles.intro}>
          <div>
            <span class={styles.kicker}>FINISHED ON THIS DEVICE</span>
            <h2 id={headingId}>Recent takes</h2>
            <p>Six compact snapshots of timing and dynamics—nothing more.</p>
          </div>
          <span class={styles.takeCount}>
            {formatPersistenceCount(readyHistory()?.takes.length ?? 0, 'take')}
          </span>
        </header>
      </Show>

      <section
        class={styles.finishRail}
        aria-labelledby={actionHeadingId}
        data-state={props.view.finish.kind}
      >
        <Switch>
          <Match when={props.view.finish.kind === 'saving'}>
            <span class={styles.actionIcon} aria-hidden="true">
              <Loader2 />
            </span>
            <div class={styles.actionCopy} role="status" aria-live="polite">
              <span>SAVING TAKE</span>
              <h3 id={actionHeadingId}>Writing the compact summary…</h3>
              <p>
                Your captured evidence stays intact until the write finishes.
              </p>
            </div>
            <button type="button" disabled aria-label="Saving take">
              Saving take…
            </button>
          </Match>

          <Match when={props.view.finish.kind === 'saved'}>
            <span
              class={styles.actionIcon}
              data-tone="saved"
              aria-hidden="true"
            >
              <CheckSmall />
            </span>
            <div class={styles.actionCopy} role="status" aria-live="polite">
              <span>TAKE SAVED</span>
              <h3 id={actionHeadingId}>Take summary saved on this device.</h3>
              <p>
                {props.view.finish.kind === 'saved'
                  ? (props.view.finish.message ??
                    'Start another take whenever the pocket is ready.')
                  : ''}
              </p>
              <Show when={props.view.replay.message !== ''}>
                <p class={styles.replayMessage}>{props.view.replay.message}</p>
              </Show>
            </div>
            <Switch>
              <Match when={props.view.replay.state === 'ready'}>
                <div class={styles.keepActions}>
                  <button type="button" onClick={() => props.onKeepReplay()}>
                    Keep in Hear Yourself
                  </button>
                  <button type="button" onClick={() => props.onDismissReplay()}>
                    Not now
                  </button>
                </div>
              </Match>
              <Match when={props.view.replay.state === 'saving'}>
                <div class={styles.keepActions}>
                  <button type="button" disabled>
                    Keeping replay…
                  </button>
                  <button type="button" disabled>
                    Not now
                  </button>
                </div>
              </Match>
              <Match when={props.view.replay.state === 'processing'}>
                <div class={styles.keepActions}>
                  <button type="button" disabled>
                    Preparing replay…
                  </button>
                  <button type="button" onClick={() => props.onDismissReplay()}>
                    Not now
                  </button>
                </div>
              </Match>
              <Match
                when={
                  props.view.replay.state === 'error' ||
                  props.view.replay.state === 'unsupported'
                }
              >
                <div class={styles.keepActions}>
                  <button type="button" onClick={() => props.onDismissReplay()}>
                    Not now
                  </button>
                </div>
              </Match>
              <Match when={props.view.replay.state === 'saved'}>
                <span class={styles.keptReplay}>Kept in Hear Yourself</span>
              </Match>
            </Switch>
          </Match>

          <Match when={props.view.finish.kind === 'error'}>
            <span
              class={styles.actionIcon}
              data-tone="error"
              aria-hidden="true"
            >
              <AlertTriangle />
            </span>
            <div class={styles.actionCopy} role="alert">
              <span>TAKE NOT SAVED</span>
              <h3 id={actionHeadingId}>
                Your captured evidence is still here.
              </h3>
              <p>
                {props.view.finish.kind === 'error'
                  ? (props.view.finish.message ??
                    'The take could not be saved. Try the write again.')
                  : ''}
              </p>
            </div>
            <div
              class={styles.failureActions}
              data-confirming={discardConfirming()}
            >
              <Show
                when={discardConfirming()}
                fallback={
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setDiscardConfirming(false)
                        props.onRetryFinish()
                      }}
                    >
                      Try again
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscardConfirming(true)}
                    >
                      Discard take
                    </button>
                  </>
                }
              >
                <span>Discard this unsaved take?</span>
                <button
                  type="button"
                  onClick={() => {
                    setDiscardConfirming(false)
                    props.onDiscardFailedTake()
                  }}
                >
                  Yes, discard
                </button>
                <button
                  type="button"
                  onClick={() => setDiscardConfirming(false)}
                >
                  Keep evidence
                </button>
              </Show>
            </div>
          </Match>

          <Match
            when={
              props.view.finish.kind === 'idle' &&
              props.view.capturedHitCount > 0 &&
              props.view.canFinish
            }
          >
            <span class={styles.actionIcon} aria-hidden="true">
              <History />
            </span>
            <div class={styles.actionCopy}>
              <span>TAKE READY</span>
              <h3 id={actionHeadingId}>
                {formatPersistenceCount(props.view.capturedHitCount, 'strike')}{' '}
                captured
              </h3>
              <p>Save a compact timing and dynamics summary on this device.</p>
            </div>
            <button type="button" onClick={() => props.onFinishTake()}>
              Finish take
            </button>
          </Match>

          <Match
            when={
              props.view.finish.kind === 'idle' &&
              props.view.capturedHitCount > 0 &&
              !props.view.canFinish
            }
          >
            <span
              class={styles.actionIcon}
              data-tone="quiet"
              aria-hidden="true"
            >
              <History />
            </span>
            <div class={styles.actionCopy}>
              <span>TAKE HELD IN SESSION</span>
              <h3 id={actionHeadingId}>This take cannot be finished yet.</h3>
              <p>
                {props.view.unavailableReason ??
                  'Open an authored score or saved groove to create a comparable take.'}
              </p>
            </div>
          </Match>

          <Match
            when={
              props.view.finish.kind === 'idle' &&
              props.view.capturedHitCount === 0
            }
          >
            <span
              class={styles.actionIcon}
              data-tone="quiet"
              aria-hidden="true"
            >
              <History />
            </span>
            <div class={styles.actionCopy}>
              <span>TAKE EVENTS</span>
              <h3 id={actionHeadingId}>No take waiting to finish</h3>
              <p>Play with Take events armed, then review the evidence here.</p>
            </div>
          </Match>
        </Switch>
      </section>

      <Show when={props.mode === 'expanded'}>
        <div class={styles.scrollRegion}>
          <Switch>
            <Match
              when={
                props.view.history.kind === 'idle' ||
                props.view.history.kind === 'loading'
              }
            >
              <div class={styles.historyState} role="status">
                <span class={styles.stateSpinner} aria-hidden="true">
                  <Loader2 />
                </span>
                <span>
                  <strong>Opening recent takes</strong>
                  <small>Reading compact summaries on this device…</small>
                </span>
              </div>
            </Match>
            <Match when={props.view.history.kind === 'error'}>
              <div class={styles.historyState} role="alert">
                <AlertTriangle />
                <span>
                  <strong>Recent takes could not be opened</strong>
                  <small>
                    {props.view.history.kind === 'error'
                      ? (props.view.history.message ??
                        'The current take and coach have not changed.')
                      : ''}
                  </small>
                </span>
                <button type="button" onClick={() => props.onRetryHistory()}>
                  Try again
                </button>
              </div>
            </Match>
            <Match
              when={
                props.view.history.kind === 'ready' &&
                visibleTakes().length === 0
              }
            >
              <div class={styles.historyState}>
                <History />
                <span>
                  <strong>No finished takes yet</strong>
                  <small>
                    Capture a phrase, then choose Finish take to keep its
                    summary here.
                  </small>
                </span>
              </div>
            </Match>
            <Match when={props.view.history.kind === 'ready'}>
              <ol
                class={styles.takeList}
                aria-label="Recent finished drum takes"
              >
                <For each={visibleTakes()}>
                  {(take, index) => (
                    <li class={styles.takeRow} data-latest={index() === 0}>
                      <header class={styles.takeIdentity}>
                        <span>
                          {index() === 0 ? 'LATEST TAKE' : take.inputLabel}
                        </span>
                        <h3>{take.sourceLabel}</h3>
                        <p>
                          <Show when={take.variationLabel !== undefined}>
                            {take.variationLabel} ·{' '}
                          </Show>
                          {take.rangeLabel}
                        </p>
                        <time
                          dateTime={new Date(take.finishedAt).toISOString()}
                        >
                          {formatPersistenceDate(
                            take.finishedAt,
                            'Finished date unavailable',
                          )}
                        </time>
                      </header>
                      <dl class={styles.takeFacts}>
                        <div>
                          <dt>Matched attacks</dt>
                          <dd>
                            {take.matchedHitCount} / {take.targetHitCount}
                          </dd>
                        </div>
                        <div>
                          <dt>Timing</dt>
                          <dd>
                            {formatSignedPersistenceMeasurement(
                              take.meanTimingOffsetMs,
                              'ms',
                            )}{' '}
                            · {take.timingLabel}
                          </dd>
                        </div>
                        <div>
                          <dt>Timing shape</dt>
                          <dd>
                            {take.earlyCount} early · {take.centredCount}{' '}
                            centred · {take.lateCount} late
                          </dd>
                        </div>
                        <div>
                          <dt>Velocity offset</dt>
                          <dd>
                            {formatSignedPersistenceMeasurement(
                              take.meanVelocityOffset,
                              'velocity',
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt>Input</dt>
                          <dd>{take.inputLabel}</dd>
                        </div>
                      </dl>
                    </li>
                  )}
                </For>
              </ol>
            </Match>
          </Switch>

          <Show
            when={
              readyHistory() !== null &&
              ((readyHistory()?.skippedCount ?? 0) > 0 ||
                (readyHistory()?.futureCount ?? 0) > 0)
            }
          >
            <div class={styles.catalogNotice} role="status">
              <AlertTriangle />
              <span>
                <Show when={(readyHistory()?.skippedCount ?? 0) > 0}>
                  <small>
                    {formatPersistenceCount(
                      readyHistory()?.skippedCount ?? 0,
                      'take summary',
                      'take summaries',
                    )}{' '}
                    could not be read and{' '}
                    {(readyHistory()?.skippedCount ?? 0) === 1 ? 'was' : 'were'}{' '}
                    skipped.
                  </small>
                </Show>
                <Show when={(readyHistory()?.futureCount ?? 0) > 0}>
                  <small>
                    {formatPersistenceCount(
                      readyHistory()?.futureCount ?? 0,
                      'take summary',
                      'take summaries',
                    )}{' '}
                    came from a newer Drum Night and stays untouched.
                  </small>
                </Show>
              </span>
            </div>
          </Show>
        </div>
      </Show>

      <footer class={styles.privacyNote}>
        Only timing and dynamics summaries are kept automatically. Hear Yourself
        saves a live-kit-only replay after Keep; authored audio, backing, click,
        microphone, raw MIDI, and device identity stay out.
      </footer>
    </section>
  )
}
