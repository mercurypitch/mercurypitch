// Runner preview ribbon — the next phrase uses the same medallions without pretending that scoring is open.
import { createMemo, For, Show } from 'solid-js'
import type { RunnerRibbonNote } from './runner-ribbon'
import type { RunnerUpcomingCue as UpcomingCue } from './runner-upcoming-cue'
import { RunnerRibbonNotes } from './RunnerRibbonNotes'
import styles from './RunnerUpcomingCue.module.css'

export function RunnerUpcomingCue(props: { cue: UpcomingCue }) {
  const notes = createMemo<readonly RunnerRibbonNote[]>(() =>
    props.cue.notes.map((note, index) => ({
      index,
      pitch: note.pitch,
      duration: note.duration,
      fill: 0,
      state: 'hollow',
      active: false,
    })),
  )
  return (
    <div
      class={styles.cue}
      data-testid="runner-upcoming-cue"
      data-target-id={props.cue.targetId}
    >
      <span class={styles.label}>{props.cue.label}</span>
      <RunnerRibbonNotes notes={notes().slice(0, 3)} preview />
      <Show when={notes().length > 3}>
        <span class={styles.remaining}>+{notes().length - 3}</span>
      </Show>
      <ol class={styles.srOnly} aria-label="Complete upcoming melody">
        <For each={notes()}>
          {(note) => (
            <li>
              {note.pitch}, hold {note.duration}
            </li>
          )}
        </For>
      </ol>
    </div>
  )
}
