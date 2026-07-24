import { createSignal } from 'solid-js'
import { exportKaraokePlaylists } from '@/db/services/session-export-service'
import { showNotification } from '@/stores/notifications-store'
import type { PlaylistExportStatus } from './PlaylistExportDialog'

export interface PlaylistExportTask {
  playlistId: string
  playlistName: string
  songCount: number
  progress: number
  status: PlaylistExportStatus
}

export interface PlaylistExportRequest {
  playlistId: string
  playlistName: string
  songCount: number
}

interface PlaylistExportControllerDeps {
  exportPlaylists?: typeof exportKaraokePlaylists
  notify?: typeof showNotification
}

export function createPlaylistExportController(
  deps: PlaylistExportControllerDeps = {},
) {
  const exportPlaylists = deps.exportPlaylists ?? exportKaraokePlaylists
  const notify = deps.notify ?? showNotification
  const [task, setTask] = createSignal<PlaylistExportTask | null>(null)

  const start = async (request: PlaylistExportRequest): Promise<void> => {
    if (task() !== null) return
    setTask({ ...request, progress: 0, status: 'running' })

    try {
      await exportPlaylists([request.playlistId], (nextProgress) => {
        const normalized = Math.min(100, Math.max(0, nextProgress))
        setTask((current) =>
          current?.playlistId === request.playlistId &&
          current.status === 'running'
            ? {
                ...current,
                progress: Math.max(current.progress, normalized),
              }
            : current,
        )
      })
      setTask(null)
      notify(`“${request.playlistName}” ZIP is ready to save.`, 'success', {
        durationMs: 7000,
      })
    } catch {
      setTask((current) =>
        current?.playlistId === request.playlistId
          ? { ...current, status: 'error' }
          : current,
      )
    }
  }

  const close = (): void => {
    setTask(null)
  }

  return { task, start, close }
}
