import type { Component } from 'solid-js'
import { createUniqueId, For, Show } from 'solid-js'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { Box, Download, XCircle } from './icons'
import styles from './PlaylistExportDialog.module.css'

export type PlaylistExportStatus = 'running' | 'error'

interface PlaylistExportDialogProps {
  open: boolean
  playlistName: string
  songCount: number
  progress: number
  status: PlaylistExportStatus
  onClose: () => void
}

const EXPORT_STEPS = [
  { label: 'Collect', threshold: 0 },
  { label: 'Pack', threshold: 90 },
  { label: 'Download', threshold: 100 },
] as const

function clampProgress(progress: number): number {
  return Math.round(Math.min(100, Math.max(0, progress)))
}

function progressStatus(progress: number): string {
  if (progress >= 100) return 'Opening your download'
  if (progress >= 90) return 'Compressing your playlist ZIP'
  return 'Gathering audio, stems, lyrics and set details'
}

export const PlaylistExportDialog: Component<PlaylistExportDialogProps> = (
  props,
) => {
  let dialogRef: HTMLDivElement | undefined
  const titleId = createUniqueId()
  const descriptionId = createUniqueId()
  const progress = () => clampProgress(props.progress)

  const close = (): void => {
    if (props.status === 'error') props.onClose()
  }

  useFocusTrap(() => dialogRef, {
    isOpen: () => props.open,
    onClose: close,
    initialFocus: () => dialogRef,
  })

  return (
    <Show when={props.open}>
      <div class={styles.overlay} data-testid="playlist-export-overlay">
        <div
          ref={dialogRef}
          class={styles.dialog}
          classList={{ [styles.dialogError]: props.status === 'error' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          aria-busy={props.status === 'running' ? true : undefined}
          tabindex="-1"
        >
          <header class={styles.header}>
            <span
              class={styles.headerIcon}
              classList={{ [styles.headerIconError]: props.status === 'error' }}
              aria-hidden="true"
            >
              <Show when={props.status === 'running'} fallback={<XCircle />}>
                <Box />
              </Show>
            </span>
            <div class={styles.headerCopy}>
              <p class={styles.kicker}>Playlist export</p>
              <h4 id={titleId}>
                <Show
                  when={props.status === 'running'}
                  fallback="Export couldn’t be finished"
                >
                  Packing “{props.playlistName}”
                </Show>
              </h4>
              <p id={descriptionId}>
                <Show
                  when={props.status === 'running'}
                  fallback="Your playlist and recordings are unchanged. Close this message and try the export again."
                >
                  MercuryPitch is preparing {props.songCount}{' '}
                  {props.songCount === 1 ? 'song' : 'songs'} and the set details
                  needed to restore the playlist later.
                </Show>
              </p>
            </div>
          </header>

          <Show
            when={props.status === 'running'}
            fallback={
              <div class={styles.errorPanel}>
                <XCircle />
                <div>
                  <strong>The ZIP archive was not created</strong>
                  <span>
                    Check that the playlist’s sessions are still available, then
                    try again.
                  </span>
                </div>
              </div>
            }
          >
            <div class={styles.progressPanel}>
              <div class={styles.progressHead} aria-live="polite">
                <div>
                  <span>Current step</span>
                  <strong>{progressStatus(progress())}</strong>
                </div>
                <output aria-label="Export progress">{progress()}%</output>
              </div>

              <div
                class={styles.progressTrack}
                role="progressbar"
                aria-label={`Exporting ${props.playlistName}`}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={progress()}
              >
                <span style={{ width: `${progress()}%` }} />
              </div>

              <ol class={styles.steps} aria-label="Export stages">
                <For each={EXPORT_STEPS}>
                  {(step) => {
                    const reached = () => progress() >= step.threshold
                    const active = () =>
                      step.label === 'Collect'
                        ? progress() < 90
                        : step.label === 'Pack'
                          ? progress() >= 90 && progress() < 100
                          : progress() >= 100
                    return (
                      <li
                        classList={{
                          [styles.stepReached]: reached(),
                          [styles.stepActive]: active(),
                        }}
                      >
                        <span aria-hidden="true" />
                        {step.label}
                      </li>
                    )
                  }}
                </For>
              </ol>
            </div>

            <p class={styles.footnote}>
              <span aria-hidden="true">
                <Download />
              </span>
              Large sets can take a little while. Keep this window open until
              your browser shows the download.
            </p>
          </Show>

          <Show when={props.status === 'error'}>
            <footer class={styles.actions}>
              <button type="button" onClick={() => props.onClose()}>
                Close
              </button>
            </footer>
          </Show>
        </div>
      </div>
    </Show>
  )
}
