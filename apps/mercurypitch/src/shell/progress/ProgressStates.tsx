// ============================================================
// The native Progress page before it has a record to draw
// ============================================================
//
// Opening (the record is being read), a first visit (nothing is recorded
// yet) and a failure (nothing could be read). The words are the web page's
// (ProgressPage.tsx) in the native rooms' plainer voice; the way in from an
// empty record is the route's own (PROGRESS_EMPTY_ACTION), so the two pages
// send a singer to the same place.

import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import type { ProgressActionView } from '@/features/progress/ProgressPage'
import { PulseIcon, RefreshIcon, WarnIcon } from '../icons'

/** The record being read: the cards' shapes, and one line for a screen reader. */
export function ProgressLoading(): JSX.Element {
  return (
    <div
      class="mp-prog-loading"
      aria-busy="true"
      data-testid="progress-loading"
    >
      <span class="mp-prog-skel mp-prog-skel--moment" aria-hidden="true" />
      <span class="mp-prog-skel mp-prog-skel--card" aria-hidden="true" />
      <span class="mp-prog-skel mp-prog-skel--card" aria-hidden="true" />
      <p class="mp-prog-sr" role="status">
        Opening your progress record.
      </p>
    </div>
  )
}

export interface ProgressEmptyProps {
  action?: ProgressActionView
  onAction?: (action: ProgressActionView) => void
  onWhatCounts: () => void
}

/** A first visit: what lands here, and the way to the first run. */
export function ProgressEmpty(props: ProgressEmptyProps): JSX.Element {
  return (
    <div class="mp-prog-empty" data-testid="progress-empty">
      <div class="mp-prog-empty__art" aria-hidden="true">
        <i />
        <i />
        <i />
        <b />
      </div>
      <h2 class="mp-prog-empty__title">Your progress starts with one run.</h2>
      <p class="mp-prog-empty__text">
        Finish a scored run and it lands here, week by week.
      </p>
      <div class="mp-prog-empty__actions">
        <Show when={props.action}>
          {(action) => (
            <a
              class="mp-prog-button"
              href={action().href}
              data-testid="progress-empty-action"
              onClick={() => props.onAction?.(action())}
            >
              <PulseIcon size={20} />
              {action().label}
            </a>
          )}
        </Show>
        <button
          type="button"
          class="mp-prog-button mp-prog-button--line"
          aria-haspopup="dialog"
          onClick={() => props.onWhatCounts()}
        >
          What counts as progress
        </button>
      </div>
    </div>
  )
}

export interface ProgressFailureProps {
  message?: string
  onRetry?: () => void
}

/** Nothing could be read: the record is untouched, and Try again reads it again. */
export function ProgressFailure(props: ProgressFailureProps): JSX.Element {
  return (
    <div class="mp-prog-failure" role="alert" data-testid="progress-failure">
      <span class="mp-prog-failure__icon" aria-hidden="true">
        <WarnIcon size={28} />
      </span>
      <h2 class="mp-prog-failure__title">
        Your saved record is still where you left it.
      </h2>
      <p class="mp-prog-failure__text">
        {props.message ?? 'Try opening Progress again.'}
      </p>
      <Show when={props.onRetry !== undefined}>
        <button
          type="button"
          class="mp-prog-button"
          data-testid="progress-retry"
          onClick={() => props.onRetry?.()}
        >
          <RefreshIcon size={20} />
          Try again
        </button>
      </Show>
    </div>
  )
}

export interface ProgressPartialFailureProps {
  message?: string
  onRetry?: () => void
}

/** Some of the record could not be read: what is shown, and Retry. */
export function ProgressPartialFailure(
  props: ProgressPartialFailureProps,
): JSX.Element {
  return (
    <div class="mp-prog-note mp-prog-note--warn" role="alert">
      <WarnIcon size={20} />
      <div class="mp-prog-note__text">
        <strong>Some updates could not be loaded.</strong>
        <p>{props.message ?? 'The last available record is shown.'}</p>
      </div>
      <Show when={props.onRetry !== undefined}>
        <button
          type="button"
          class="mp-prog-note__action"
          onClick={() => props.onRetry?.()}
        >
          Retry
        </button>
      </Show>
    </div>
  )
}
