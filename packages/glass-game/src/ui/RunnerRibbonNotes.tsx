// Musical ribbon notes — glass medallions fill from judge-owned progress, with a complete text equivalent.
import { For, Show } from 'solid-js'
import type { RunnerRibbonNote } from './runner-ribbon'
import styles from './RunnerNotation.module.css'

export function RunnerRibbonNotes(props: {
  notes: readonly RunnerRibbonNote[]
  progressName?: string
  preview?: boolean
}) {
  return (
    <div
      class={styles.notes}
      classList={{ [styles.previewNotes]: props.preview === true }}
      aria-label="Notes and holds"
    >
      <For each={props.notes}>
        {(note) => (
          <span
            class={styles.token}
            data-note-index={note.index}
            data-active={note.active}
            data-state={note.state}
          >
            <span
              class={styles.medallion}
              classList={{ [styles.glideToken]: note.pitch.includes('→') }}
              role={note.active ? 'progressbar' : undefined}
              aria-label={
                note.active ? (props.progressName ?? 'Note charge') : undefined
              }
              aria-valuemin={note.active ? 0 : undefined}
              aria-valuemax={note.active ? 100 : undefined}
              aria-valuenow={
                note.active ? Math.round(note.fill * 100) : undefined
              }
            >
              <span
                class={styles.water}
                data-note-fill
                style={{ height: `${Math.round(note.fill * 100)}%` }}
                aria-hidden="true"
              />
              <strong>{note.pitch}</strong>
              <Show when={note.state === 'filled'}>
                <svg
                  class={styles.check}
                  viewBox="0 0 16 16"
                  aria-label="Complete"
                >
                  <path d="m3 8 3 3 7-7" />
                </svg>
              </Show>
            </span>
            <span class={styles.duration}>{note.duration ?? 'Hold'}</span>
          </span>
        )}
      </For>
    </div>
  )
}
