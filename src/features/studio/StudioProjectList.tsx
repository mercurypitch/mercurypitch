// Studio project list — local songs and explicit backup restore share one entry surface.
import { For, Show } from 'solid-js'
import { Plus, WaveformBars } from '@/components/icons'
import type { StudioProjectSummary } from '@/lib/studio/model/types'
import styles from './StudioPage.module.css'

interface StudioProjectListProps {
  projects: readonly StudioProjectSummary[]
  activeId?: string
  blocked: boolean
  onCreate(): void
  onOpen(id: string): void
  onRestore(): void
}

export function StudioProjectList(props: StudioProjectListProps) {
  return (
    <div class={styles.library}>
      <div class={styles.libraryHeading}>
        <h1>Your songs</h1>
        <div class={styles.actions}>
          <button
            type="button"
            class={styles.button}
            disabled={props.blocked}
            onClick={() => props.onRestore()}
          >
            Open backup
          </button>
          <button
            type="button"
            class={styles.primaryButton}
            disabled={props.blocked}
            onClick={() => props.onCreate()}
          >
            <Plus size={16} /> New song
          </button>
        </div>
      </div>
      <Show
        when={props.projects.length}
        fallback={
          <div class={styles.empty}>
            <WaveformBars size={40} />
            <h2>No songs yet</h2>
            <p>
              Build a song from takes you keep in the app, or from audio files.
            </p>
            <button
              type="button"
              class={styles.primaryButton}
              disabled={props.blocked}
              onClick={() => props.onCreate()}
            >
              Create project
            </button>
          </div>
        }
      >
        <nav class={styles.songList} aria-label="Studio projects">
          <For each={props.projects}>
            {(project) => (
              <button
                type="button"
                class={styles.songRow}
                aria-current={
                  project.id === props.activeId ? 'true' : undefined
                }
                disabled={props.blocked}
                onClick={() => props.onOpen(project.id)}
              >
                <WaveformBars size={24} />
                <span>
                  <strong>{project.title}</strong>
                  <small>
                    {project.trackCount}{' '}
                    {project.trackCount === 1 ? 'track' : 'tracks'} ·{' '}
                    {new Date(project.updatedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </small>
                </span>
                <span class={styles.songDuration}>
                  {Math.floor(project.durationFrames / 2_880_000)}:
                  {Math.floor((project.durationFrames / 48_000) % 60)
                    .toString()
                    .padStart(2, '0')}
                </span>
              </button>
            )}
          </For>
        </nav>
      </Show>
      <p class={styles.localNote}>
        Saved in this browser. Download a song backup to keep a copy elsewhere.
      </p>
    </div>
  )
}
