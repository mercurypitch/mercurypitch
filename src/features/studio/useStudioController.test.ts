import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StudioStorageError } from '@/db/services/studio-service'
import { isLocalSaveNavigationLocked } from '@/lib/local-save-navigation-lock'
import type { StudioAssetInfo } from '@/lib/studio/audio/prepare-studio-asset'
import { studioReservedMemoryBytes } from '@/lib/studio/memory-budget'
import { createStudioProject } from '@/lib/studio/model/defaults'
import type { StudioAssetData, StudioProject } from '@/lib/studio/model/types'
import { controllerServiceFixture, preparedFixture, } from './controller/controller.fixture'
import type { StudioSourceEntry } from './integration/source-catalog'
import type { StudioController, StudioControllerOptions, } from './useStudioController'
import { useStudioController } from './useStudioController'

const cleanups: (() => void)[] = []
const source = (id: string): StudioSourceEntry => ({
  id,
  source: 'freeform',
  title: `Take ${id}`,
  sourceLabel: 'Hear Yourself',
  audioDescription: 'Kept microphone audio.',
  suggestedRole: 'voice',
  durationMs: 100,
  sizeBytes: 3,
  capturedAt: '2026-10-26T10:00:00.000Z',
  mimeType: 'audio/wav',
})
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
  it('adds selected takes together at the captured playhead and retains their audio through undo and redo during save', async () => {
    let finishSave!: (project: StudioProject) => void
    let finishFirst!: (data: StudioAssetData) => void
    const infos: StudioAssetInfo[] = []
    const prepareTake = vi.fn(
      (
        entry: StudioSourceEntry,
        info: { id: string; projectId: string; importedAt: string },
      ) => {
        const assetInfo: StudioAssetInfo = {
          id: info.id,
          projectId: info.projectId,
          provenance: {
            kind: entry.source,
            sourceId: entry.id,
            importedAt: info.importedAt,
          },
        }
        infos.push(assetInfo)
        if (infos.length === 1)
          return new Promise<StudioAssetData>((resolve) => {
            finishFirst = resolve
          })
        const data = preparedFixture(assetInfo)
        return Promise.resolve({
          ...data,
          asset: { ...data.asset, sha256: 'c'.repeat(64) },
        })
      },
    )
    const { controller, service } = mount({ prepareTake })
    await controller.open('one')
    const baseline = studioReservedMemoryBytes()
    vi.mocked(service.saveProject).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSave = resolve
        }),
    )
    let playhead = 24000
    const pending = controller.addTakes([source('a'), source('b')], playhead)
    playhead = 96000
    expect(prepareTake).toHaveBeenCalledTimes(1)
    expect(service.saveProject).not.toHaveBeenCalled()
    finishFirst(preparedFixture(infos[0]))
    await vi.waitFor(() => {
      expect(controller.problem()).toBeNull()
      expect(service.saveProject).toHaveBeenCalledTimes(1)
    })
    const imported = controller.project()!
    expect(imported.revision).toBe(1)
    expect(imported.clips.map((clip) => clip.startFrame)).toEqual([
      24000, 24000,
    ])
    expect(imported.clips[0].startFrame).not.toBe(playhead)
    expect(imported.tracks.map((track) => track.order)).toEqual([0, 1])
    expect(controller.undoLabel()).toBe('Undo add takes')
    expect(controller.canUndo()).toBe(true)
    expect(studioReservedMemoryBytes()).toBe(baseline + 86)
    await expect(
      controller.readCanonicalAsset(imported.clips[0].assetId),
    ).resolves.toBeInstanceOf(Blob)
    expect(service.readCanonicalAsset).not.toHaveBeenCalled()
    expect(controller.undo()).toBe(true)
    expect(controller.project()?.clips).toEqual([])
    expect(controller.project()?.revision).toBe(2)
    expect(controller.canRedo()).toBe(true)
    expect(controller.redoLabel()).toBe('Redo add takes')
    expect(controller.redo()).toBe(true)
    expect(controller.project()?.clips).toEqual(imported.clips)
    expect(controller.project()?.revision).toBe(3)
    expect(controller.assets()).toHaveLength(2)
    expect(service.saveProject).toHaveBeenCalledTimes(1)
    finishSave(imported)
    expect(await pending).toBe(true)
    await vi.waitFor(() => expect(controller.saveState()).toBe('saved'))
    expect(service.saveProject).toHaveBeenLastCalledWith(
      expect.objectContaining({ revision: 3, clips: imported.clips }),
      expect.objectContaining({ expectedRevision: 1 }),
      [],
    )
    expect(studioReservedMemoryBytes()).toBe(baseline)
  })

  it('discards the entire selected batch and releases its admitted audio when a later take fails', async () => {
    const baseline = studioReservedMemoryBytes()
    const prepareTake = vi.fn(
      async (
        entry: StudioSourceEntry,
        info: { id: string; projectId: string; importedAt: string },
      ) => {
        if (entry.id === 'b') {
          expect(studioReservedMemoryBytes()).toBe(baseline + 43)
          throw new Error('Unreadable take')
        }
        return preparedFixture({
          id: info.id,
          projectId: info.projectId,
          provenance: { kind: entry.source, importedAt: info.importedAt },
        })
      },
    )
    const { controller, service } = mount({ prepareTake })
    await controller.open('one')
    expect(await controller.addTakes([source('a'), source('b')], 48000)).toBe(
      false,
    )
    expect(controller.problem()).toContain('Unreadable take')
    expect(controller.project()?.revision).toBe(0)
    expect(controller.project()?.clips).toEqual([])
    expect(controller.assets()).toEqual([])
    expect(controller.canUndo()).toBe(false)
    expect(service.saveProject).not.toHaveBeenCalled()
    expect(studioReservedMemoryBytes()).toBe(baseline)
  })

  it('invalidates redo after a new edit and clears session history when switching projects', async () => {
    const { controller } = mount()
    await controller.open('one')
    controller.rename('First')
    controller.rename('Second')
    controller.undo()
    expect(controller.project()?.title).toBe('First')
    expect(controller.canRedo()).toBe(true)
    controller.rename('Third')
    expect(controller.canRedo()).toBe(false)
    expect(controller.redoLabel()).toBe('Redo')
    await vi.waitFor(() => expect(controller.saveState()).toBe('saved'))
    await controller.open('two')
    expect(controller.canUndo()).toBe(false)
    expect(controller.undoLabel()).toBe('Undo')
  })

  it('reads only explicitly selected audio and rejects results from the previous project', async () => {
    const service = controllerServiceFixture()
    const data = preparedFixture({
      id: 'owned',
      projectId: 'one',
      provenance: { kind: 'file', importedAt: '2026-10-26T10:00:00.000Z' },
    })
    vi.mocked(service.listAssets).mockResolvedValueOnce([data.asset])
    let finishPcm!: (blob: Blob) => void
    let finishPreview!: (blob: Blob) => void
    vi.mocked(service.readCanonicalAsset).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishPcm = resolve
        }),
    )
    const readSource = vi.fn(
      () =>
        new Promise<Blob>((resolve) => {
          finishPreview = resolve
        }),
    )
    const { controller } = mount({
      service,
      listSources: async () => [source('a'), source('b')],
      readSource,
    })
    await controller.open('one')
    await controller.refreshSources()
    expect(readSource).not.toHaveBeenCalled()
    expect(service.readCanonicalAsset).not.toHaveBeenCalled()
    const pcm = controller.readCanonicalAsset('owned')
    const preview = controller.readSourcePreview(source('b'))
    expect(service.readCanonicalAsset).toHaveBeenCalledWith('one', 'owned')
    expect(readSource).toHaveBeenCalledWith(source('b'), { signal: undefined })
    await controller.open('two')
    finishPcm(data.canonicalPcm)
    finishPreview(data.original)
    await expect(pcm).rejects.toMatchObject({ name: 'AbortError' })
    await expect(preview).rejects.toMatchObject({ name: 'AbortError' })
    const abort = new AbortController()
    abort.abort()
    await expect(
      controller.readSourcePreview(source('a'), { signal: abort.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(readSource).toHaveBeenCalledTimes(1)
  })
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

  it('queues a file picked while the last import is still saving', async () => {
    const service = controllerServiceFixture()
    const saves: (() => void)[] = []
    vi.mocked(service.saveProject).mockImplementation(
      (project) =>
        new Promise((resolve) => {
          saves.push(() => resolve(project))
        }),
    )
    const { controller } = mount({
      service,
      prepareFile: async (_blob, info) => preparedFixture(info),
    })
    await controller.open('one')
    const first = controller.addFile(
      new File(['abc'], 'First.wav', { type: 'audio/wav' }),
    )
    await vi.waitFor(() => expect(saves).toHaveLength(1))
    const second = controller.addFile(
      new File(['def'], 'Second.wav', { type: 'audio/wav' }),
    )
    saves.shift()?.()
    expect(await first).toBe(true)
    await vi.waitFor(() => expect(saves).toHaveLength(1))
    saves.shift()?.()
    expect(await second).toBe(true)
    expect(controller.project()?.tracks.map((track) => track.name)).toEqual([
      'First',
      'Second',
    ])
  })

  it('recovers from create/open failure without leaving operations busy', async () => {
    const { controller, service } = mount()
    vi.mocked(service.createProject).mockRejectedValueOnce(
      new Error('Storage unavailable'),
    )
    expect(await controller.create('New song')).toBe(false)
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
    expect(await controller.create('New song')).toBe(true)
    expect(controller.project()?.id).toBe('new')
  })

  it('reports successful restore only after its fresh project opens and retains failure recovery', async () => {
    const restoreBackup = vi.fn(
      async (
        _blob: Blob,
        service: Pick<
          ReturnType<typeof controllerServiceFixture>,
          'restoreProject'
        >,
      ) => service.restoreProject(createStudioProject({ id: 'imported' }), []),
    )
    const { controller } = mount({ restoreBackup })
    await controller.open('one')
    restoreBackup.mockRejectedValueOnce(new Error('Damaged backup'))
    expect(await controller.restore(new Blob(['bad']))).toBe(false)
    expect(controller.project()?.id).toBe('one')
    expect(controller.busy()).toBe(false)
    expect(await controller.restore(new Blob(['good']))).toBe(true)
    expect(controller.project()?.id).toBe('restored')
    expect(controller.problem()).toBeNull()
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
