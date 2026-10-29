import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StudioStorageError } from '@/db/services/studio-service'
import { isLocalSaveNavigationLocked, vetoNavigationDuringLocalSave, } from '@/lib/local-save-navigation-lock'
import type { StudioAssetInfo } from '@/lib/studio/audio/prepare-studio-asset'
import { studioReservedMemoryBytes } from '@/lib/studio/memory-budget'
import { createStudioProject, createStudioTrack, } from '@/lib/studio/model/defaults'
import type { StudioAssetData, StudioProject } from '@/lib/studio/model/types'
import type { StudioBackupTarget } from './backup/backup-target'
import { controllerServiceFixture, preparedFixture, presenceFixture, } from './controller/controller.fixture'
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

/** What the app is told when it asks to leave Studio now, or undefined when it may leave. */
function heldNavigation(): string | null | undefined {
  let said: string | null | undefined
  vetoNavigationDuringLocalSave({
    onBlocked: (message) => {
      said = message
    },
    onResolved: () => undefined,
  })
  return said
}

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

  /** 128 takes saved with song `one`, the most a song holds. */
  const fullSong = () =>
    Array.from({ length: 128 }, (_, index) => ({
      ...preparedFixture({
        id: `old-${index}`,
        projectId: 'one',
        originalName: 'Old take',
        provenance: { kind: 'file', importedAt: '2026-10-26T10:00:00.000Z' },
      }).asset,
      sha256: 'c'.repeat(64),
    }))

  it('rejects an over-limit import before staging an unsavable revision, and points removed takes at a copy', async () => {
    const service = controllerServiceFixture()
    vi.mocked(service.listAssets).mockResolvedValueOnce(fullSong())
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
    // No clip plays any of the 128: removed takes fill the song.
    expect(controller.problem()).toBe(
      "Takes you removed still count toward this song's audio limit. Make a copy, which keeps only the takes in use, and add this take there.",
    )
    expect(service.saveProject).not.toHaveBeenCalled()
    expect(isLocalSaveNavigationLocked()).toBe(false)
  })

  it('says a song is full when the takes it plays fill it', async () => {
    const service = controllerServiceFixture()
    const takes = fullSong()
    const playing = createStudioProject({
      id: 'one',
      now: '2026-10-26T10:00:00.000Z',
    })
    vi.mocked(service.loadProject).mockResolvedValueOnce({
      ...playing,
      tracks: [createStudioTrack({ id: 'lane', name: 'Voice', order: 0 })],
      clips: takes.map((take, index) => ({
        id: `clip-${index}`,
        trackId: 'lane',
        assetId: take.id,
        startFrame: index * 2,
        sourceInFrame: 0,
        sourceOutFrame: 2,
        gainDb: 0,
        fades: { curve: 'linear-amplitude' },
      })),
    })
    vi.mocked(service.listAssets).mockResolvedValueOnce(takes)
    const { controller } = mount({
      service,
      prepareFile: async (_blob, info) => preparedFixture(info),
    })
    await controller.open('one')
    await controller.addFile(
      new File(['abc'], 'New.wav', { type: 'audio/wav' }),
    )

    expect(controller.problem()).toBe(
      'This project has reached its local audio limit. Add this take to another project.',
    )
    expect(controller.project()?.clips).toHaveLength(128)
    expect(service.saveProject).not.toHaveBeenCalled()
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

  it('drops a queued file when the import is cancelled', async () => {
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
    controller.cancelImport()
    saves.shift()?.()
    await first
    expect(await second).toBe(false)
    expect(controller.project()?.tracks.map((track) => track.name)).toEqual([
      'First',
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
    expect(controller.busy()).toBe(true)
    expect(controller.editBlocked()).toBe(false)
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
    const writeBackup = vi.fn(async () => undefined)
    const { controller, service } = mount({
      prepareFile: async (_blob, info) => preparedFixture(info),
      writeBackup,
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
    const target = {
      kind: 'download',
      name: 'Unsaved title.mpstudio',
      keepMs: 0,
      reserve: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
      discard: vi.fn(),
    } satisfies StudioBackupTarget
    expect(await controller.backup(target)).toBe(true)
    expect(writeBackup).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Unsaved title', revision: 2 }),
      expect.any(Function),
      target,
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

  it('says why it holds navigation: a wait while saving, the way out once a save fails', async () => {
    const { controller, service } = mount()
    await controller.open('one')
    let fail!: (error: unknown) => void
    vi.mocked(service.saveProject).mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject
        }),
    )
    const free = heldNavigation()

    controller.rename('First title')
    const whileSaving = heldNavigation()
    fail(new StudioStorageError('quota-exceeded', 'Full'))
    await vi.waitFor(() => expect(controller.saveState()).toBe('error'))

    expect(free).toBeUndefined()
    expect(whileSaving).toBe(
      'Studio is still saving this project on this device. Try again in a moment.',
    )
    expect(heldNavigation()).toBe(
      'Studio could not save your latest changes. Retry the save, make a copy, or discard the changes before you leave.',
    )
  })

  it('says a tab that lost editing cannot save, and what keeps the changes', async () => {
    const { controller, service } = mount()
    await controller.open('one')
    vi.mocked(service.saveProject).mockRejectedValueOnce(
      new StudioStorageError('lease-lost', 'Another tab is editing.'),
    )

    controller.rename('Unsaved title')
    await vi.waitFor(() => expect(controller.writable()).toBe(false))

    expect(heldNavigation()).toBe(
      'This tab can no longer save your latest changes. Make a copy to keep them, or discard them before you leave.',
    )
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

  it('adds to the chosen lane where it fits and to a new lane where it would overlap', async () => {
    const { controller } = mount({
      prepareFile: async (_blob, info) => preparedFixture(info),
    })
    await controller.open('one')
    const file = new File(['abc'], 'Take.wav', { type: 'audio/wav' })
    await controller.addFile(file)
    const lane = controller.project()!.tracks[0].id
    const frames = controller.assets()[0].normalizedFrameCount
    await controller.addFile(file, frames, lane)
    expect(controller.project()?.tracks).toHaveLength(1)
    expect(
      controller
        .project()
        ?.clips.map((clip) => [clip.trackId, clip.startFrame]),
    ).toEqual([
      [lane, 0],
      [lane, frames],
    ])
    await controller.addFile(file, 0, lane)
    expect(controller.project()?.tracks).toHaveLength(2)
    expect(controller.project()?.clips.at(-1)?.trackId).not.toBe(lane)
  })

  it('says which lane a take missed and where, and stays quiet when it fits', async () => {
    const { controller } = mount({
      prepareFile: async (_blob, info) => preparedFixture(info),
    })
    await controller.open('one')
    const file = new File(['abc'], 'Take.wav', { type: 'audio/wav' })
    await controller.addFile(file)
    const lane = controller.project()!.tracks[0]
    const frames = controller.assets()[0].normalizedFrameCount

    await controller.addFile(file, frames, lane.id)
    const afterFit = controller.laneNotice()
    await controller.addFile(file, 0, lane.id)

    expect(afterFit).toBeNull()
    expect(controller.laneNotice()).toEqual({
      text: `No room on ${lane.name} at 0:00. Added on a new lane.`,
    })
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
    vi.mocked(service.reclaimLease).mockRejectedValueOnce(
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
    let finish!: (
      lease: Awaited<ReturnType<typeof service.reclaimLease>>,
    ) => void
    vi.mocked(service.reclaimLease).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    await vi.advanceTimersByTimeAsync(10000)
    await controller.open('two')
    await vi.advanceTimersByTimeAsync(10000)
    expect(service.reclaimLease).toHaveBeenLastCalledWith(
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

  describe('a backup asked about before its file is picked', () => {
    const target = (): StudioBackupTarget => ({
      kind: 'file',
      name: 'Window seat 2026-10-29 1142.mpstudio',
      keepMs: 0,
      reserve: vi.fn(),
      write: vi.fn(),
      close: vi.fn(async () => null),
      discard: vi.fn(async () => {}),
    })

    it('is refused for another song exactly when the switch behind it would be, and a save in flight is no reason', async () => {
      const { controller, service } = mount()
      await controller.open('one')
      let finish!: (project: StudioProject) => void
      vi.mocked(service.saveProject).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve
          }),
      )
      controller.rename('Saving')

      expect(controller.saveState()).toBe('saving')
      expect(controller.canBackup('two')).toBe(true)
      const opening = controller.openForBackup('two')
      finish(controller.project()!)
      expect(await opening).toBe(true)
      expect(controller.project()?.id).toBe('two')

      vi.mocked(service.saveProject).mockRejectedValueOnce(
        new StudioStorageError('quota-exceeded', 'Full'),
      )
      controller.rename('Unsaved')
      await vi.waitFor(() => expect(controller.saveState()).toBe('error'))
      expect(controller.canBackup('one')).toBe(false)
      expect(await controller.openForBackup('one')).toBe(false)
    })

    it('is refused for the open song while another backup runs, as the backup itself would be', async () => {
      let release!: () => void
      const writeBackup = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            release = resolve
          }),
      )
      const { controller } = mount({ writeBackup })
      await controller.open('one')

      expect(controller.canBackup()).toBe(true)
      const first = controller.backup(target())
      expect(controller.canBackup()).toBe(false)
      expect(await controller.backup(target())).toBe(false)
      release()
      expect(await first).toBe(true)
      expect(controller.canBackup()).toBe(true)
    })
  })

  describe('a tab away from view', () => {
    const TAKEN =
      'This project is no longer editable in this tab. Reload, make a copy, or take over editing.'
    /** Two minutes hidden: the renewal never ran, and the lease lapsed. */
    const hideForTwoMinutes = () => vi.setSystemTime(Date.now() + 120_000)
    const showAgain = () => {
      document.dispatchEvent(new Event('visibilitychange'))
    }

    it('wins its lapsed lease back as it comes into view, keeping its history and reloading nothing', async () => {
      vi.useFakeTimers()
      const { controller, service } = mount()
      await controller.open('one')
      controller.rename('First')
      await vi.waitFor(() => expect(controller.saveState()).toBe('saved'))

      hideForTwoMinutes()
      showAgain()
      await vi.waitFor(() =>
        expect(service.reclaimLease).toHaveBeenCalledWith(
          'one',
          expect.objectContaining({ epoch: 1 }),
        ),
      )

      expect(controller.writable()).toBe(true)
      expect(controller.problem()).toBeNull()
      expect(controller.canUndo()).toBe(true)
      expect(controller.project()?.title).toBe('First')
      expect(service.acquireLease).toHaveBeenCalledTimes(1)
      expect(service.loadProject).toHaveBeenCalledTimes(1)
      expect(controller.rename('Second')).toBe(true)
      await vi.waitFor(() => expect(controller.saveState()).toBe('saved'))
      expect(service.saveProject).toHaveBeenCalledTimes(2)
    })

    it('wins it back on focus too, and on the late renewal tick of a throttled tab', async () => {
      vi.useFakeTimers()
      const { controller, service } = mount()
      await controller.open('one')

      hideForTwoMinutes()
      window.dispatchEvent(new Event('focus'))
      await vi.waitFor(() =>
        expect(service.reclaimLease).toHaveBeenCalledTimes(1),
      )
      hideForTwoMinutes()
      await vi.advanceTimersByTimeAsync(10_000)

      expect(service.reclaimLease).toHaveBeenCalledTimes(2)
      expect(controller.writable()).toBe(true)
      expect(controller.problem()).toBeNull()
    })

    it('lets an edit made as it returns go ahead while it holds the lock, and saves it once the lease is back', async () => {
      vi.useFakeTimers()
      const presence = presenceFixture()
      const { controller, service } = mount({ presence: presence.source })
      await controller.open('one')

      hideForTwoMinutes()
      expect(controller.rename('Back again')).toBe(true)
      await vi.waitFor(() => expect(controller.saveState()).toBe('saved'))

      const [reclaimed] = vi.mocked(service.reclaimLease).mock
        .invocationCallOrder
      const [saved] = vi.mocked(service.saveProject).mock.invocationCallOrder
      expect(reclaimed).toBeLessThan(saved)
      expect(controller.writable()).toBe(true)
      expect(controller.problem()).toBeNull()
    })

    it('holds edits without the lock until the lease is back, and says nothing about it', async () => {
      vi.useFakeTimers()
      const { controller, service } = mount()
      await controller.open('one')

      hideForTwoMinutes()
      expect(controller.rename('Too soon')).toBe(false)
      await vi.waitFor(() => expect(controller.writable()).toBe(true))

      expect(service.reclaimLease).toHaveBeenCalledTimes(1)
      expect(controller.problem()).toBeNull()
      expect(controller.rename('Now')).toBe(true)
    })

    it('goes read-only, keeping its edits to copy, when another tab has held the project since', async () => {
      vi.useFakeTimers()
      const { controller, service } = mount()
      await controller.open('one')
      controller.rename('Mine')
      await vi.waitFor(() => expect(controller.saveState()).toBe('saved'))
      vi.mocked(service.reclaimLease).mockRejectedValueOnce(
        new StudioStorageError('lease-lost', TAKEN),
      )

      hideForTwoMinutes()
      showAgain()
      await vi.waitFor(() => expect(controller.writable()).toBe(false))

      expect(controller.problem()).toBe(TAKEN)
      expect(controller.project()?.title).toBe('Mine')
      await vi.advanceTimersByTimeAsync(30_000)
      expect(service.reclaimLease).toHaveBeenCalledTimes(1)
      expect(service.saveProject).toHaveBeenCalledTimes(1)
    })

    it('lets the lock and the lease go as the page hides, and wins both back as it is shown again', async () => {
      const presence = presenceFixture()
      const { controller, service } = mount({ presence: presence.source })
      await controller.open('one')
      controller.rename('Before')
      await vi.waitFor(() => expect(controller.saveState()).toBe('saved'))

      window.dispatchEvent(new Event('pagehide'))
      expect(presence.claims[0].release).toHaveBeenCalled()
      expect(service.releaseLease).toHaveBeenCalledWith(
        'one',
        expect.objectContaining({ epoch: 1 }),
      )
      window.dispatchEvent(new Event('pageshow'))
      await vi.waitFor(() =>
        expect(service.reclaimLease).toHaveBeenCalledTimes(1),
      )

      expect(presence.source.claim).toHaveBeenCalledTimes(2)
      expect(controller.writable()).toBe(true)
      expect(controller.canUndo()).toBe(true)
      expect(controller.rename('After')).toBe(true)
      await vi.waitFor(() => expect(controller.saveState()).toBe('saved'))
      expect(service.saveProject).toHaveBeenCalledTimes(2)
    })

    it('finds the project taken when another live tab holds its lock as the page is shown again', async () => {
      const presence = presenceFixture()
      const { controller, service } = mount({ presence: presence.source })
      await controller.open('one')

      window.dispatchEvent(new Event('pagehide'))
      presence.refuse()
      window.dispatchEvent(new Event('pageshow'))
      await vi.waitFor(() => expect(controller.writable()).toBe(false))

      expect(service.reclaimLease).not.toHaveBeenCalled()
      expect(controller.problem()).toBe(TAKEN)
    })
  })

  describe('audio no clip uses', () => {
    /** Two takes saved with song `one`, which plays neither: both were removed. */
    function removedTakes(
      service: ReturnType<typeof controllerServiceFixture>,
    ) {
      const takes = ['gone-one', 'gone-two'].map(
        (id) =>
          preparedFixture({
            id,
            projectId: 'one',
            provenance: {
              kind: 'file',
              importedAt: '2026-10-26T10:00:00.000Z',
            },
          }).asset,
      )
      vi.mocked(service.listAssets).mockResolvedValue(takes)
      return takes
    }

    it('is deleted as a song opens in the one tab that has it loaded, and only the audio left is listed', async () => {
      const presence = presenceFixture()
      const service = controllerServiceFixture()
      removedTakes(service)
      const { controller } = mount({ service, presence: presence.source })
      await controller.open('one')

      expect(service.pruneUnusedAssets).toHaveBeenCalledWith(
        'one',
        expect.objectContaining({ epoch: 1, expectedRevision: 0 }),
      )
      expect(controller.assets()).toEqual([])
      expect(controller.writable()).toBe(true)
      const [opened] = presence.source.open.mock.invocationCallOrder
      const [read] = vi.mocked(service.loadProject).mock.invocationCallOrder
      expect(opened).toBeLessThan(read)
    })

    it('stays while another tab has the song loaded: its history or copy may still want it', async () => {
      const presence = presenceFixture()
      presence.shared()
      const service = controllerServiceFixture()
      const takes = removedTakes(service)
      const { controller } = mount({ service, presence: presence.source })
      await controller.open('one')

      expect(service.pruneUnusedAssets).not.toHaveBeenCalled()
      expect(controller.assets()).toEqual(takes)
    })

    it('stays where the browser has no locks to prove the song is loaded nowhere else', async () => {
      const service = controllerServiceFixture()
      removedTakes(service)
      const { controller } = mount({ service })
      await controller.open('one')

      expect(service.pruneUnusedAssets).not.toHaveBeenCalled()
      expect(controller.assets()).toHaveLength(2)
    })

    it('stays when the song opens read-only', async () => {
      const presence = presenceFixture()
      presence.refuse()
      const service = controllerServiceFixture()
      removedTakes(service)
      const { controller } = mount({ service, presence: presence.source })
      await controller.open('one')

      expect(controller.writable()).toBe(false)
      expect(service.pruneUnusedAssets).not.toHaveBeenCalled()
    })

    it('is not asked about when every take is in use', async () => {
      const presence = presenceFixture()
      const { controller, service } = mount({ presence: presence.source })
      await controller.open('one')

      expect(service.pruneUnusedAssets).not.toHaveBeenCalled()
      expect(presence.opens[0].alone).not.toHaveBeenCalled()
    })

    it('stays, and the song opens as usual, when deleting it fails', async () => {
      const presence = presenceFixture()
      const service = controllerServiceFixture()
      const takes = removedTakes(service)
      vi.mocked(service.pruneUnusedAssets).mockRejectedValueOnce(
        new StudioStorageError('quota-exceeded', 'Full'),
      )
      const { controller } = mount({ service, presence: presence.source })
      await controller.open('one')

      expect(controller.assets()).toEqual(takes)
      expect(controller.writable()).toBe(true)
      expect(controller.problem()).toBeNull()
    })

    it('stays while a backup runs here: nothing can open the song again until it ends', async () => {
      const presence = presenceFixture()
      const service = controllerServiceFixture()
      removedTakes(service)
      let release!: () => void
      const writeBackup = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            release = resolve
          }),
      )
      const { controller } = mount({
        service,
        presence: presence.source,
        writeBackup,
      })
      await controller.open('one')
      const running = controller.backup({
        kind: 'file',
        name: 'Window seat 2026-10-29 1142.mpstudio',
        keepMs: 0,
        reserve: vi.fn(),
        write: vi.fn(),
        close: vi.fn(async () => null),
        discard: vi.fn(async () => {}),
      })

      await controller.open('one')
      await controller.takeOver()
      await controller.discardAndReload()
      await controller.openForBackup('two')
      release()
      expect(await running).toBe(true)

      expect(service.loadProject).toHaveBeenCalledTimes(1)
      expect(service.pruneUnusedAssets).toHaveBeenCalledTimes(1)
    })

    it('is protected for as long as the song is loaded here, and the song is let go with the lease', async () => {
      const presence = presenceFixture()
      const { controller } = mount({ presence: presence.source })
      await controller.open('one')
      await controller.open('two')

      expect(presence.opens.map((open) => open.projectId)).toEqual([
        'one',
        'two',
      ])
      expect(presence.opens[0].release).toHaveBeenCalled()
      expect(presence.opens[1].release).not.toHaveBeenCalled()
      controller.dispose()
      await Promise.resolve()
      expect(presence.opens[1].release).toHaveBeenCalled()
    })
  })

  describe('the project lock', () => {
    it('opens a project for editing at once while its lock is free, whatever lease a closed page left', async () => {
      const presence = presenceFixture()
      const { controller, service } = mount({ presence: presence.source })
      await controller.open('one')

      expect(presence.source.claim).toHaveBeenCalledWith('one', {
        waitMs: 1000,
        steal: false,
      })
      expect(service.acquireLease).toHaveBeenCalledWith(
        'one',
        expect.any(String),
        { takeover: true },
      )
      expect(controller.writable()).toBe(true)
    })

    it('waits out a lease another page left where the browser has no locks', async () => {
      const { controller, service } = mount()
      await controller.open('one')

      expect(service.acquireLease).toHaveBeenCalledWith(
        'one',
        expect.any(String),
        { takeover: false },
      )
    })

    it('opens a project read-only while another live tab holds its lock, and takes it on request', async () => {
      const presence = presenceFixture()
      presence.refuse()
      const { controller, service } = mount({ presence: presence.source })
      await controller.open('one')

      expect(controller.writable()).toBe(false)
      expect(controller.problem()).toBeNull()
      expect(service.acquireLease).not.toHaveBeenCalled()
      presence.grant()
      await controller.takeOver()
      expect(presence.source.claim).toHaveBeenLastCalledWith('one', {
        waitMs: 1000,
        steal: true,
      })
      expect(service.acquireLease).toHaveBeenLastCalledWith(
        'one',
        expect.any(String),
        { takeover: true },
      )
      expect(controller.writable()).toBe(true)
    })

    it('goes read-only at once when another tab takes the project over, and stops renewing', async () => {
      vi.useFakeTimers()
      const presence = presenceFixture()
      const { controller, service } = mount({ presence: presence.source })
      await controller.open('one')

      presence.claims[0].lose()
      await vi.waitFor(() => expect(controller.writable()).toBe(false))

      expect(controller.problem()).toBe(
        'This project is no longer editable in this tab. Reload, make a copy, or take over editing.',
      )
      await vi.advanceTimersByTimeAsync(30_000)
      expect(service.reclaimLease).not.toHaveBeenCalled()
    })

    it('lets the lock go with the lease when it switches projects', async () => {
      const presence = presenceFixture()
      const { controller, service } = mount({ presence: presence.source })
      await controller.open('one')
      await controller.open('two')

      expect(presence.claims.map((claim) => claim.projectId)).toEqual([
        'one',
        'two',
      ])
      expect(presence.claims[0].release).toHaveBeenCalled()
      expect(presence.claims[1].release).not.toHaveBeenCalled()
      expect(service.releaseLease).toHaveBeenCalledWith(
        'one',
        expect.objectContaining({ projectId: 'one' }),
      )
    })
  })
})
