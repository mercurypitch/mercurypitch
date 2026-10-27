// Studio song options — local project identity, copies, backups and deletion.
import { ChevronDown, Copy, Download, MusicLibrary, Trash2, } from '@/components/icons'
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
      <div class={styles.menuList}>
        <button
          type="button"
          class={styles.menuItem}
          disabled={props.studio.busy() || props.studio.hasUnsavedChanges()}
          onClick={() => props.onLibrary()}
        >
          <MusicLibrary />
          <span>All songs</span>
          <ChevronDown />
        </button>
        <button
          type="button"
          class={styles.menuItem}
          disabled={props.studio.busy() || props.processing}
          onClick={() => props.onFork()}
        >
          <Copy />
          <span>Duplicate song</span>
        </button>
        <button
          type="button"
          class={styles.menuItem}
          disabled={props.studio.busy() || props.processing}
          onClick={() => props.onBackup()}
        >
          <Download />
          <span>Save project backup</span>
        </button>
      </div>
      <p class={styles.help}>
        A backup holds your arrangement and copied audio. Saved projects stay in
        this browser.
      </p>
      <div class={styles.fieldDivider} />
      <button
        type="button"
        class={`${styles.menuItem} ${styles.menuDanger}`}
        disabled={
          !props.writable ||
          props.studio.busy() ||
          props.studio.hasUnsavedChanges()
        }
        onClick={() => props.onDelete()}
      >
        <Trash2 />
        <span>Delete project</span>
      </button>
    </div>
  )
}
