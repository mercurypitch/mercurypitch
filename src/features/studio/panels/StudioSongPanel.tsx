// Studio song options — local project identity, copies, backups and deletion.
import styles from '../StudioPage.module.css'
import type { StudioController } from '../useStudioController'

interface Props {
  studio: StudioController
  writable: boolean
  processing?: boolean
  onLibrary(): void
  onBackup(): void
  onDelete(): void
  onFork(): void
}
export function StudioSongPanel(props: Props) {
  return (
    <div class={styles.detailsFields}>
      <label class={styles.stackedField}>
        <span>Project name</span>
        <input
          aria-label="Project name"
          value={props.studio.project()!.title}
          maxLength={160}
          disabled={!props.writable}
          onChange={(event) => {
            if (!props.studio.rename(event.currentTarget.value))
              event.currentTarget.value = props.studio.project()!.title
          }}
        />
      </label>
      <button
        type="button"
        class={styles.button}
        disabled={props.studio.busy() || props.studio.hasUnsavedChanges()}
        onClick={() => props.onLibrary()}
      >
        All songs
      </button>
      <button
        type="button"
        class={styles.button}
        disabled={props.studio.busy() || props.processing}
        onClick={() => props.onFork()}
      >
        Duplicate song
      </button>
      <button
        type="button"
        class={styles.button}
        disabled={props.studio.busy() || props.processing}
        onClick={() => props.onBackup()}
      >
        Save project backup
      </button>
      <p class={styles.help}>
        Includes your arrangement and copied audio. Saved projects stay in this
        browser.
      </p>
      <div class={styles.fieldDivider} />
      <button
        type="button"
        class={styles.dangerButton}
        disabled={
          !props.writable ||
          props.studio.busy() ||
          props.studio.hasUnsavedChanges()
        }
        onClick={() => props.onDelete()}
      >
        Delete project
      </button>
    </div>
  )
}
