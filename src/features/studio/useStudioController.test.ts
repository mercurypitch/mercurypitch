import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StudioStorageError } from '@/db/services/studio-service'
import { isLocalSaveNavigationLocked } from '@/lib/local-save-navigation-lock'
import type { StudioAssetInfo } from '@/lib/studio/audio/prepare-studio-asset'
import type { StudioAssetData, StudioProject } from '@/lib/studio/model/types'
import { controllerServiceFixture, preparedFixture, } from './controller/controller.fixture'
import type { StudioController, StudioControllerOptions, } from './useStudioController'
import { useStudioController } from './useStudioController'

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  vi.useRealTimers()
})

function mount(options: StudioControllerOptions = {}): {
  controller: StudioController
  service: ReturnType<typeof controllerServiceFixture>
} {
  const service = options.service ?? controllerServiceFixture()
  let serial = 0
  let controller!: StudioController
  createRoot((dispose) => {
    cleanups.push(dispose)
    controller = useStudioController({
      service,
      createId: () => `id-${++serial}`,
      ...options,
    })
  })
  return { controller, service }
}

describe('Studio controller', () => {
  it('accepts an unchanged title without saving or reporting an error', async () => {
    const { controller, service } = mount()
    await controller.open('one')
    const snapshot = controller.project()
    expect(controller.rename(snapshot?.title ?? '')).toBe(true)
    expect(controller.project()).toBe(snapshot)
    expect(controller.saveState()).toBe('saved')
    expect(controller.problem()).toBeNull()
    expect(service.saveProject).not.toHaveBeenCalled()
    expect(isLocalSaveNavigationLocked()).toBe(false)
  })

  it('rejects an over-limit import before staging an unsavable revision', async () => {
    const service = controllerServiceFixture()
    const retained = Array.from({ length: 128 }, (_, index) => ({
      ...preparedFixture({
        id: `old-${index}`,
        projectId: 'one',
        originalName: 'Old take',
        provenance: { kind: 'file', importedAt: '2026-10-26T10:00:00.000Z' },
      }).asset,
      sha256: 'c'.repeat(64),
    }))
    vi.mocked(service.listAssets).mockResolvedValueOnce(retained)
    const { controller } = mount({
      service,
      prepareFile: async (_blob, info) => preparedFixture(info),
    })
    await controller.open('one')
    await controller.addFile(
      new File(['abc'], 'New.wav', { type: 'audio/wav' }),
    )
    expect(controller.project()?.revision).toBe(0)
    expect(controller.project()?.clips).toEqual([])
    expect(controller.assets()).toHaveLength(128)
    expect(controller.problem()).toContain('local audio limit')
    expect(service.saveProject).not.toHaveBeenCalled()
    expect(isLocalSaveNavigationLocked()).toBe(false)
  })

  it('recovers from create/open failure without leaving operations busy', async () => {
    const { controller, service } = mount()
    vi.mocked(service.createProject).mockRejectedValueOnce(
      new Error('Storage unavailable'),
    )
    await controller.create('New song')
    expect(controller.busy()).toBe(false)
    expect(controller.problem()).toContain('Storage unavailable')
    vi.mocked(service.loadProject).mockRejectedValueOnce(
      new Error('Missing project'),
    )
    await controller.open('one')
    expect(controller.busy()).toBe(false)
    expect(service.releaseLease).toHaveBeenCalledWith(
      'one',
      expect.objectContaining({ epoch: 1 }),
    )
    await controller.open('two')
    expect(controller.project()?.id).toBe('two')
    expect(controller.writable()).toBe(true)
  })

  it('serializes an edit made during save without reporting the older revision as saved', async () => {
    const { controller, service } = mount()
    await controller.open('one')
    let finish!: (project: StudioProject) => void
    vi.mocked(service.saveProject).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    controller.rename('First title')
    const first = controller.project()!
    expect(controller.saveState()).toBe('saving')
    expect(isLocalSaveNavigationLocked()).toBe(true)
    controller.rename('Latest title')
    expect(service.saveProject).toHaveBeenCalledTimes(1)
    finish(first)
    await vi.waitFor(() => expect(controller.saveState()).toBe('saved'))
    expect(controller.project()?.title).toBe('Latest title')
    expect(service.saveProject).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ revision: 2, title: 'Latest title' }),
      expect.objectContaining({ expectedRevision: 1 }),
      [],
    )
    expect(isLocalSaveNavigationLocked()).toBe(false)
  })

  it('retains failed audio imports and subsequent edits for backup and retry', async () => {
    const createBackup = vi.fn(async () => new Blob(['backup']))
    const { controller, service } = mount({
      prepareFile: async (_blob, info) => preparedFixture(info),
      createBackup,
    })
    await controller.open('one')
    vi.mocked(service.saveProject).mockRejectedValueOnce(
      new StudioStorageError('quota-exceeded', 'Full'),
    )
    await controller.addFile(
      new File(['abc'], 'Song.wav', { type: 'audio/wav' }),
    )
    expect(controller.saveState()).toBe('error')
    expect(controller.assets()).toHaveLength(1)
    expect(controller.project()?.clips).toHaveLength(1)
    expect(isLocalSaveNavigationLocked()).toBe(true)
    controller.rename('Unsaved title')
    expect(service.saveProject).toHaveBeenCalledTimes(1)
    await controller.open('two')
    expect(controller.project()?.id).toBe('one')
    expect(await controller.backup()).toBeInstanceOf(Blob)
    expect(createBackup).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Unsaved title', revision: 2 }),
      expect.any(Function),
      expect.objectContaining({
        preparedAssets: [
          expect.objectContaining({
            asset: expect.objectContaining({ projectId: 'one' }),
          }),
        ],
      }),
    )
    await controller.retrySave()
    expect(controller.saveState()).toBe('saved')
    expect(service.saveProject).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Unsaved title', revision: 2 }),
      expect.objectContaining({ expectedRevision: 0 }),
      [
        expect.objectContaining({
          asset: expect.objectContaining({ projectId: 'one' }),
        }),
      ],
    )
    expect(isLocalSaveNavigationLocked()).toBe(false)
  })

  it('discards cancelled late import results after switching projects', async () => {
    let finish!: (data: StudioAssetData) => void
    let captured!: StudioAssetInfo
    let signal!: AbortSignal
    const { controller, service } = mount({
      prepareFile: (_blob, info, options) => {
        captured = info
        signal = options!.signal!
        return new Promise((resolve) => {
          finish = resolve
        })
      },
    })
    await controller.open('one')
    const pending = controller.addFile(
      new File(['abc'], 'Late.wav', { type: 'audio/wav' }),
    )
    expect(controller.importing()).toBe(true)
    controller.cancelImport()
    expect(signal.aborted).toBe(true)
    await controller.open('two')
    finish(preparedFixture(captured))
    await pending
    expect(controller.project()?.id).toBe('two')
    expect(controller.project()?.clips).toEqual([])
    expect(controller.assets()).toEqual([])
    expect(service.saveProject).not.toHaveBeenCalled()
  })

  it('reuses identical owned audio while adding another independent lane and clip', async () => {
    const { controller, service } = mount({
      prepareFile: async (_blob, info) => preparedFixture(info),
    })
    await controller.open('one')
    const file = new File(['abc'], 'Repeat.wav', { type: 'audio/wav' })
    await controller.addFile(file)
    await controller.addFile(file)
    expect(controller.assets()).toHaveLength(1)
    expect(controller.project()?.tracks).toHaveLength(2)
    expect(
      new Set(controller.project()?.clips.map((clip) => clip.assetId)).size,
    ).toBe(1)
    expect(service.saveProject).toHaveBeenLastCalledWith(
      expect.objectContaining({ revision: 2 }),
      expect.objectContaining({ expectedRevision: 1 }),
      [],
    )
  })

  it('opens locked projects read-only and takeover reloads the latest durable snapshot', async () => {
    const { controller, service } = mount()
    vi.mocked(service.acquireLease).mockRejectedValueOnce(
      new StudioStorageError('locked', 'Another tab'),
    )
    await controller.open('one')
    expect(controller.writable()).toBe(false)
    expect(controller.problem()).toBeNull()
    expect(controller.rename('Blocked')).toBe(false)
    expect(service.saveProject).not.toHaveBeenCalled()
    const latest = {
      ...controller.project()!,
      revision: 4,
      title: 'Other tab title',
    }
    vi.mocked(service.loadProject).mockResolvedValueOnce(latest)
    await controller.takeOver()
    expect(service.acquireLease).toHaveBeenLastCalledWith(
      'one',
      expect.any(String),
      { takeover: true },
    )
    expect(controller.project()).toEqual(latest)
    expect(controller.writable()).toBe(true)
  })

  it('pauses queued writes on lease loss and leaves unsaved work available to fork', async () => {
    vi.useFakeTimers()
    const { controller, service } = mount()
    await controller.open('one')
    let finish!: (project: StudioProject) => void
    vi.mocked(service.saveProject).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    controller.rename('First')
    const first = controller.project()!
    controller.rename('Keep this edit')
    vi.mocked(service.renewLease).mockRejectedValueOnce(
      new StudioStorageError('lease-lost', 'Taken over'),
    )
    await vi.advanceTimersByTimeAsync(10000)
    expect(controller.writable()).toBe(false)
    expect(controller.saveState()).toBe('error')
    finish(first)
    await Promise.resolve()
    await Promise.resolve()
    expect(service.saveProject).toHaveBeenCalledTimes(1)
    await controller.takeOver()
    expect(service.acquireLease).toHaveBeenCalledTimes(1)
    expect(controller.project()?.title).toBe('Keep this edit')
    expect(controller.problem()).toContain('Make a copy or download a backup')
    await controller.fork()
    expect(service.forkProject).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Keep this edit', revision: 2 }),
      [],
    )
    expect(controller.project()?.id).toBe('copy')
  })

  it('does not let an old pending renewal block the next project lease', async () => {
    vi.useFakeTimers()
    const { controller, service } = mount()
    await controller.open('one')
    let finish!: (lease: Awaited<ReturnType<typeof service.renewLease>>) => void
    vi.mocked(service.renewLease).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    await vi.advanceTimersByTimeAsync(10000)
    await controller.open('two')
    await vi.advanceTimersByTimeAsync(10000)
    expect(service.renewLease).toHaveBeenLastCalledWith(
      'two',
      expect.objectContaining({ projectId: 'two' }),
    )
    finish({
      projectId: 'one',
      ownerId: 'old',
      epoch: 1,
      expiresAt: Date.now() + 30000,
    })
    await Promise.resolve()
    expect(controller.project()?.id).toBe('two')
    expect(controller.writable()).toBe(true)
  })

  it('releases its lease and navigation lock on disposal while import is pending', async () => {
    let finish!: (data: StudioAssetData) => void
    let captured!: StudioAssetInfo
    const { controller, service } = mount({
      prepareFile: (_blob, info) => {
        captured = info
        return new Promise((resolve) => {
          finish = resolve
        })
      },
    })
    await controller.open('one')
    const pending = controller.addFile(
      new File(['abc'], 'Late.wav', { type: 'audio/wav' }),
    )
    controller.dispose()
    expect(isLocalSaveNavigationLocked()).toBe(false)
    expect(service.releaseLease).toHaveBeenCalledWith(
      'one',
      expect.objectContaining({ epoch: 1 }),
    )
    finish(preparedFixture(captured))
    await pending
    expect(service.saveProject).not.toHaveBeenCalled()
  })
})
