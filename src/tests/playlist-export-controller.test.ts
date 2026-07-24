import { createRoot } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { createPlaylistExportController } from '@/components/playlist-export-controller'

const request = {
  playlistId: 'playlist-1',
  playlistName: 'Friday Set',
  songCount: 3,
}

describe('playlist export controller', () => {
  it('reports monotonic progress and resolves with visible success feedback', async () => {
    let reportProgress: ((progress: number) => void) | undefined
    let finishExport: (() => void) | undefined
    const exportPlaylists = vi.fn(
      (_ids: string[], onProgress?: (progress: number) => void) => {
        reportProgress = onProgress
        return new Promise<void>((resolve) => {
          finishExport = resolve
        })
      },
    )
    const notify = vi.fn()

    await new Promise<void>((resolveTest) => {
      createRoot((dispose) => {
        const controller = createPlaylistExportController({
          exportPlaylists,
          notify,
        })
        const running = controller.start(request)

        expect(controller.task()).toMatchObject({
          ...request,
          progress: 0,
          status: 'running',
        })
        reportProgress?.(46.4)
        reportProgress?.(40)
        expect(controller.task()?.progress).toBe(46.4)
        reportProgress?.(92)
        expect(controller.task()?.progress).toBe(92)

        finishExport?.()
        void running.then(() => {
          expect(controller.task()).toBeNull()
          expect(notify).toHaveBeenCalledWith(
            '“Friday Set” ZIP is ready to save.',
            'success',
            { durationMs: 7000 },
          )
          dispose()
          resolveTest()
        })
      })
    })
  })

  it('keeps failures visible until the user closes the dialog', async () => {
    const notify = vi.fn()

    await new Promise<void>((resolveTest) => {
      createRoot((dispose) => {
        const controller = createPlaylistExportController({
          exportPlaylists: vi.fn().mockRejectedValue(new Error('ZIP failed')),
          notify,
        })

        void controller.start(request).then(() => {
          expect(controller.task()).toMatchObject({
            ...request,
            status: 'error',
          })
          expect(notify).not.toHaveBeenCalled()

          controller.close()
          expect(controller.task()).toBeNull()
          dispose()
          resolveTest()
        })
      })
    })
  })

  it('ignores duplicate starts while an export is active', async () => {
    let finishExport: (() => void) | undefined
    const exportPlaylists = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishExport = resolve
        }),
    )

    await new Promise<void>((resolveTest) => {
      createRoot((dispose) => {
        const controller = createPlaylistExportController({
          exportPlaylists,
          notify: vi.fn(),
        })
        const first = controller.start(request)
        const duplicate = controller.start({
          ...request,
          playlistId: 'playlist-2',
        })

        expect(exportPlaylists).toHaveBeenCalledTimes(1)
        finishExport?.()
        void Promise.all([first, duplicate]).then(() => {
          dispose()
          resolveTest()
        })
      })
    })
  })
})
