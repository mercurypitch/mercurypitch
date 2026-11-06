// Studio workspace notices — the rows above the arrangement: song audio being prepared, playback, errors, editing elsewhere, an import and why one was refused, and recording. The record card floats over the lanes instead, so it mounts after the timeline.
import { Show } from 'solid-js'
import { StudioRecordNotices } from './record/StudioRecordNotices'
import type { StudioRecorderHandle } from './record/useStudioRecorder'
import { StudioPlaybackNotice } from './sound/StudioPlaybackNotice'
import styles from './StudioPage.module.css'
import type { StudioController } from './useStudioController'

export { StudioRecordStatus } from './record/StudioRecordNotices'

export interface StudioWorkspaceNoticesProps {
  /** Export, Compare or auto-balance prepare song audio away from their panel. */
  preparing: boolean
  onShowProgress(): void
  onShowSound(): void
  error: string | null
  studio: Pick<
    StudioController,
    | 'writable'
    | 'busy'
    | 'takeOver'
    | 'importing'
    | 'cancelImport'
    | 'importRefusal'
    | 'dismissImportRefusal'
  >
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
      <Show when={!props.studio.writable()}>
        <div class={styles.notice}>
          <p>
            This project is open in another tab, or editing has expired here.
          </p>
          <button
            type="button"
            class={styles.button}
            disabled={props.studio.busy()}
            onClick={() => void props.studio.takeOver()}
          >
            Edit in this tab
          </button>
        </div>
      </Show>
      <Show when={props.studio.importing()}>
        <div class={styles.notice} role="status">
          <p>Preparing audio…</p>
          <button
            type="button"
            class={styles.button}
            onClick={() => props.studio.cancelImport()}
          >
            Cancel import
          </button>
        </div>
      </Show>
      {/* A refused file or take is not a failed save: it has a notice of its
          own, and nothing to copy, back up or reload. */}
      <Show when={props.studio.importRefusal()}>
        {(refusal) => (
          <div class={styles.notice} role="alert" data-studio-import-refusal="">
            <p>{refusal()}</p>
            <button
              type="button"
              class={styles.textButton}
              onClick={() => props.studio.dismissImportRefusal()}
            >
              Dismiss
            </button>
          </div>
        )}
      </Show>
      <StudioRecordNotices recorder={props.recorder} />
    </>
  )
}
