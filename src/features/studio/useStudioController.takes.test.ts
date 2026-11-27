// Studio controller takes — a song opens with the audio of every take its clips keep, the playing ones and the ones waiting, so the clean-up of audio no clip uses never takes a take; audio no take uses still goes.
import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { studioClipWithTakes } from '@/lib/studio/model/clip-takes'
import { createStudioProject, createStudioTrack, } from '@/lib/studio/model/defaults'
import type { StudioClip } from '@/lib/studio/model/types'
import { controllerServiceFixture, preparedFixture, presenceFixture, } from './controller/controller.fixture'
import type { StudioController } from './useStudioController'
import { useStudioController } from './useStudioController'

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

/**
 * Song `one` as this tab alone has it loaded: one clip of two takes, take-b
 * playing and take-a waiting, and the audio saved with it, `extra` more.
 */
function songOfTakes(extra: readonly string[] = []) {
  const presence = presenceFixture()
  const service = controllerServiceFixture()
  const assets = ['take-a', 'take-b', ...extra].map(
    (id) =>
      preparedFixture({
        id,
        projectId: 'one',
        provenance: {
          kind: 'recording',
          importedAt: '2026-10-26T10:00:00.000Z',
        },
      }).asset,
  )
  const take = (assetId: string): StudioClip => ({
    id: 'clip-1',
    trackId: 'lane',
    assetId,
    startFrame: 0,
    sourceInFrame: 0,
    sourceOutFrame: 2,
    gainDb: 0,
    fades: { curve: 'linear-amplitude' },
  })
  const song = {
    ...createStudioProject({ id: 'one', now: '2026-10-26T10:00:00.000Z' }),
    tracks: [createStudioTrack({ id: 'lane', name: 'Voice', order: 0 })],
    clips: [studioClipWithTakes([take('take-a'), take('take-b')], 1)],
  }
  vi.mocked(service.loadProject).mockImplementation(async () =>
    structuredClone(song),
  )
  vi.mocked(service.listAssets).mockResolvedValue(assets)
  let controller!: StudioController
  createRoot((dispose) => {
    cleanups.push(dispose)
    controller = useStudioController({
      service,
      presence: presence.source,
      createId: () => 'id',
    })
  })
  return { controller, service, assets }
}

describe('a song whose clip keeps takes', () => {
  it('opens with the audio of the take waiting as well as the one playing, and deletes neither', async () => {
    // Arrange
    const { controller, service, assets } = songOfTakes()

    // Act
    await controller.open('one')

    // Assert
    expect(controller.writable()).toBe(true)
    expect(service.pruneUnusedAssets).not.toHaveBeenCalled()
    expect(controller.assets()).toEqual(assets)
  })

  it('still has the audio no take uses deleted as it opens', async () => {
    // Arrange
    const { controller, service } = songOfTakes(['gone'])

    // Act
    await controller.open('one')

    // Assert
    expect(service.pruneUnusedAssets).toHaveBeenCalledExactlyOnceWith(
      'one',
      expect.objectContaining({ expectedRevision: 0 }),
    )
  })
})
