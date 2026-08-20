// ============================================================
// Reading a written part on the recording being heard
// ============================================================
//
// Shown under an attached reference. Two states and nothing in between: an
// offer, listing the scores that could be hung on this recording, and a
// statement of what was hung plus the way back.
//
// It is deliberately a separate box from the measured line's own facts. Those
// are things that are true; this is something a reader may want. A reader who
// does not want it should be able to skip the whole block.

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import styles from './GuitarNightApp.module.css'
import type { GuitarNightReferenceSummary } from './reference-port'

/** What was hung, and how well it fit. */
export interface OnRecordingReading {
  matchedFraction: number
  driftSeconds: number
}

export interface GuitarNightOnRecordingProps {
  /** The scores that could be hung on this recording. */
  scores: readonly GuitarNightReferenceSummary[]
  /** The one currently hung, or null while the offer stands. */
  reading: OnRecordingReading | null
  /** Whether a recording is being read at all — an authored tab is not one. */
  offer: boolean
  status: string | null
  onRead(songId: string): void
  onStop(): void
}

/**
 * Drift under a second is not worth a reader's attention: it is inside the
 * tolerance the alignment was measured at, and naming it invites them to
 * chase it.
 */
const DRIFT_WORTH_SAYING_SECONDS = 1

export const GuitarNightOnRecording: Component<GuitarNightOnRecordingProps> = (
  props,
) => (
  <>
    <Show when={props.reading}>
      {(reading) => (
        <div class={styles.referenceOnRecording}>
          <small>
            Written part, placed on this recording ·{' '}
            {Math.round(reading().matchedFraction * 100)}% of it was heard here
            {reading().driftSeconds >= DRIFT_WORTH_SAYING_SECONDS
              ? `, and the two drift ${reading().driftSeconds.toFixed(1)}s apart end to end`
              : ''}
            .
          </small>
          <button
            type="button"
            class={styles.referenceOnRecordingBack}
            onClick={() => props.onStop()}
          >
            Back to what was heard
          </button>
        </div>
      )}
    </Show>

    <Show
      when={props.reading === null && props.offer && props.scores.length > 0}
    >
      <div
        class={styles.referenceOnRecording}
        role="group"
        aria-label="Read a written part on this recording"
      >
        <small>
          Read a written part on this recording instead of the transcribed one.
        </small>
        <div class={styles.referenceOnRecordingList}>
          <For each={props.scores}>
            {(score) => (
              <button
                type="button"
                class={styles.referenceOnRecordingButton}
                onClick={() => props.onRead(score.songId)}
              >
                {score.title}
              </button>
            )}
          </For>
        </div>
      </div>
    </Show>

    <Show when={props.status}>
      {(status) => (
        <small class={styles.referenceOnRecordingProblem}>{status()}</small>
      )}
    </Show>
  </>
)
