// Studio workspace notices — the rows above the arrangement: song audio being prepared, playback, errors, editing elsewhere, an import, and recording.
import { Show } from 'solid-js'
import { StudioRecordNotices } from './record/StudioRecordNotices'
import type { StudioRecorderHandle } from './record/useStudioRecorder'
import { StudioPlaybackNotice } from './sound/StudioPlaybackNotice'
import styles from './StudioPage.module.css'

export interface StudioWorkspaceNoticesProps {
  /** Export, Compare or auto-balance prepare song audio away from their panel. */
  preparing: boolean
  onShowProgress(): void
  onShowSound(): void
  error: string | null
  writable: boolean
  busy: boolean
  onTakeOver(): void
  importing: boolean
  onCancelImport(): void
  recorder: StudioRecorderHandle
}

export function StudioWorkspaceNotices(props: StudioWorkspaceNoticesProps) {
  return (
    <>
      <Show when={props.preparing}>
        <div class={styles.notice} role="status">
          <p>Preparing song audio…</p>
          <button
            type="button"
            class={styles.button}
            onClick={() => props.onShowProgress()}
          >
            Show progress
          </button>
        </div>
      </Show>
      <StudioPlaybackNotice onShow={() => props.onShowSound()} />
      <Show when={props.error}>
        {(error) => (
          <p class={styles.inlineError} role="alert">
            {error()}
          </p>
        )}
      </Show>
      <Show when={!props.writable}>
        <div class={styles.notice}>
          <p>
            This project is open in another tab, or editing has expired here.
          </p>
          <button
            type="button"
            class={styles.button}
            disabled={props.busy}
            onClick={() => props.onTakeOver()}
          >
            Edit in this tab
          </button>
        </div>
      </Show>
      <Show when={props.importing}>
        <div class={styles.notice} role="status">
          <p>Preparing audio…</p>
          <button
            type="button"
            class={styles.button}
            onClick={() => props.onCancelImport()}
          >
            Cancel import
          </button>
        </div>
      </Show>
      <StudioRecordNotices recorder={props.recorder} />
    </>
  )
}
