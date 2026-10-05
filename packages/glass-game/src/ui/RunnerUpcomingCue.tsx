// Runner preparation row — one compact pitch and hold pair for every note ahead.
import { For } from 'solid-js'
import type { RunnerUpcomingCue as UpcomingCue } from './runner-upcoming-cue'
import styles from './RunnerUpcomingCue.module.css'

export function RunnerUpcomingCue(props: { cue: UpcomingCue }) {
  return (
    <div
      class={styles.cue}
      data-testid="runner-upcoming-cue"
      data-target-id={props.cue.targetId}
    >
      <span class={styles.label}>{props.cue.label}</span>
      <div class={styles.notes} aria-label="Notes and holds">
        <For each={props.cue.notes}>
          {(note) => (
            <span class={styles.note}>
              <strong>{note.pitch}</strong>
              <span>{note.duration}</span>
            </span>
          )}
        </For>
      </div>
    </div>
  )
}
