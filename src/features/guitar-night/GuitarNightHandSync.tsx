// ============================================================
// Hanging a written part on the recording, by hand
// ============================================================
//
// Phase 3 of `docs/plans/score-recording-sync.md`. The matcher needs a
// transcription of this recording and there is not always one — a live
// version, a cover, a song whose stems were never separated. This is the
// reader doing it themselves.
//
// The gesture is the loop's gesture, because the room already taught it: play
// to a moment and say "here". Two moments — the part's first note and its last
// — fix both where the part starts and how fast the recording runs against it.
//
// The nudge is separate and only appears once the part is on the recording,
// because sliding something that is not there yet means nothing.

import { For, Show } from 'solid-js'
import styles from './GuitarNightApp.module.css'

/** Seconds a nudge moves the part, smallest first. */
const NUDGE_STEPS = [0.1, 0.5] as const

export interface GuitarNightHandSyncProps {
  /** The part being placed, named so the reader knows what they are marking. */
  partName: string
  firstMarkSeconds: number | null
  lastMarkSeconds: number | null
  /** True once the part is actually on the recording, so it can be nudged. */
  placed: boolean
  /** Render one position the way this room's timeline reads. */
  format(position: number): string
  onMarkFirst(): void
  onMarkLast(): void
  onClear(): void
  onNudge(deltaSeconds: number): void
}

export function GuitarNightHandSync(props: GuitarNightHandSyncProps) {
  return (
    <div
      class={styles.handSync}
      role="group"
      aria-label={`Place ${props.partName} on this recording`}
    >
      <div>
        <strong>Place {props.partName} by hand</strong>
        <small>
          Play to the part’s first note and mark it. Mark its last note too and
          the tab follows the recording’s own speed.
        </small>
      </div>

      <div class={styles.handSyncMarks}>
        <button
          type="button"
          classList={{
            [styles.handSyncMarkSet]: props.firstMarkSeconds !== null,
          }}
          aria-pressed={props.firstMarkSeconds !== null}
          onClick={() => props.onMarkFirst()}
        >
          First note here
        </button>
        <button
          type="button"
          classList={{
            [styles.handSyncMarkSet]: props.lastMarkSeconds !== null,
          }}
          aria-pressed={props.lastMarkSeconds !== null}
          onClick={() => props.onMarkLast()}
        >
          Last note here
        </button>
        <Show
          when={
            props.firstMarkSeconds !== null || props.lastMarkSeconds !== null
          }
        >
          <button
            type="button"
            class={styles.handSyncClear}
            onClick={() => props.onClear()}
          >
            Clear
          </button>
        </Show>
      </div>

      <output aria-live="polite">
        <Show
          when={
            props.firstMarkSeconds !== null || props.lastMarkSeconds !== null
          }
          fallback="Nothing marked yet."
        >
          {props.firstMarkSeconds === null
            ? 'First note not marked'
            : `First note at ${props.format(props.firstMarkSeconds)}`}
          {' · '}
          {props.lastMarkSeconds === null
            ? 'last note not marked'
            : `last note at ${props.format(props.lastMarkSeconds)}`}
        </Show>
      </output>

      <Show when={props.placed}>
        <div
          class={styles.handSyncNudge}
          role="group"
          aria-label="Nudge the tab"
        >
          <For each={NUDGE_STEPS}>
            {(step) => (
              <button
                type="button"
                aria-label={`Move the tab ${step} seconds earlier`}
                onClick={() => props.onNudge(-step)}
              >
                −{step}s
              </button>
            )}
          </For>
          <span>Nudge</span>
          <For each={NUDGE_STEPS}>
            {(step) => (
              <button
                type="button"
                aria-label={`Move the tab ${step} seconds later`}
                onClick={() => props.onNudge(step)}
              >
                +{step}s
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
