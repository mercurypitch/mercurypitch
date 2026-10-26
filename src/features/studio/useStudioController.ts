// Studio controller — local project ownership, selected imports and durable revision saves.
import { createSignal, onCleanup, onMount, untrack } from 'solid-js'
import type { StudioEditorLease, StudioService, } from '@/db/services/studio-service'
import { createStudioService, StudioStorageError, } from '@/db/services/studio-service'
import { audioUploadValidationError } from '@/lib/audio-upload-contract'
import { useLocalSaveNavigationLock } from '@/lib/local-save-navigation-lock'
import { DEFAULT_STUDIO_IMPORT_LIMITS } from '@/lib/studio/audio/import-limits'
import { prepareStudioAsset } from '@/lib/studio/audio/prepare-studio-asset'
import type { StudioCommand } from '@/lib/studio/model/commands'
import { applyStudioCommand } from '@/lib/studio/model/commands'
import { createStudioTrack } from '@/lib/studio/model/defaults'
import { fitsStudioProjectStorageBudget } from '@/lib/studio/model/storage-limits'
import type { StudioAsset, StudioAssetData, StudioProject, StudioProjectSummary, } from '@/lib/studio/model/types'
import { createStudioBackup, restoreStudioBackup } from './backup/studio-backup'
import type { StudioSaveQueue, StudioSaveState } from './controller/save-queue'
import { createStudioSaveQueue } from './controller/save-queue'
import { prepareStudioSource } from './integration/prepare-source'
import type { StudioSourceEntry } from './integration/source-catalog'
import { listStudioSources } from './integration/source-catalog'

export interface StudioControllerOptions {
  service?: StudioService
  now?: () => Date
  createId?: () => string
  listSources?: typeof listStudioSources
  prepareFile?: typeof prepareStudioAsset
  prepareTake?: typeof prepareStudioSource
  createBackup?: typeof createStudioBackup
  restoreBackup?: typeof restoreStudioBackup
}

function message(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Studio could not complete this operation. Try again.'
}

function lostOwnership(error: unknown): boolean {
  return (
    error instanceof StudioStorageError &&
    ['locked', 'lease-lost', 'conflict'].includes(error.code)
  )
}

export function useStudioController(options: StudioControllerOptions = {}) {
  const service = options.service ?? createStudioService()
  const now = options.now ?? (() => new Date())
  const createId = options.createId ?? (() => globalThis.crypto.randomUUID())
  const [project, setProject] = createSignal<StudioProject | null>(null)
  const [assets, setAssets] = createSignal<readonly StudioAsset[]>([])
  const [projects, setProjects] = createSignal<readonly StudioProjectSummary[]>(
    [],
  )
  const [sources, setSources] = createSignal<readonly StudioSourceEntry[]>([])
  const [sourceError, setSourceError] = createSignal<string | null>(null)
  const [loading, setLoading] = createSignal(false)
  const [working, setWorking] = createSignal(false)
  const [importing, setImporting] = createSignal(false)
  const [saveState, setSaveState] = createSignal<StudioSaveState>('saved')
  const [writable, setWritable] = createSignal(false)
  const [problem, setProblem] = createSignal<string | null>(null)
  const [disposed, setDisposed] = createSignal(false)
  let generation = 0
  let sourceGeneration = 0
  let listGeneration = 0
  let queue: StudioSaveQueue | null = null
  let lease: StudioEditorLease | null = null
  let importAbort: AbortController | null = null
  let operationAbort: AbortController | null = null
  let renewingGeneration: number | null = null
  const busy = () =>
    loading() || working() || importing() || saveState() === 'saving'
  const hasUnsavedChanges = () =>
    !!project() && !!queue && project()!.revision > queue.durableRevision()
  useLocalSaveNavigationLock(
    () =>
      !disposed() &&
      (importing() || saveState() === 'saving' || hasUnsavedChanges()),
    'Studio local project',
  )

  const current = (epoch: number) =>
    untrack(() => !disposed() && generation === epoch)
  const report = (error: unknown) => setProblem(message(error))

  function cancelImport(): void {
    importAbort?.abort()
    importAbort = null
    setImporting(false)
  }

  function expireEditor(): void {
    setWritable(false)
    cancelImport()
    const error = new Error(
      'Editing expired in this tab. Reload, make a copy, or take over editing.',
    )
    queue?.pause(error)
    report(error)
  }

  function canEdit(): boolean {
    if (
      disposed() ||
      loading() ||
      working() ||
      !project() ||
      !lease ||
      !writable()
    )
      return false
    if (lease.expiresAt <= now().getTime()) {
      expireEditor()
      return false
    }
    return true
  }

  function canSwitch(): boolean {
    if (disposed() || loading() || working()) return false
    if (importing() || saveState() === 'saving' || hasUnsavedChanges()) {
      setProblem(
        'Save these changes, make a copy, or discard them before opening another project.',
      )
      return false
    }
    return true
  }

  async function refreshProjects(): Promise<void> {
    const request = ++listGeneration
    try {
      const rows = await service.listProjects()
      if (!disposed() && listGeneration === request) setProjects(rows)
    } catch (error) {
      if (!disposed() && listGeneration === request) report(error)
    }
  }

  async function refreshSources(): Promise<void> {
    const request = ++sourceGeneration
    setSourceError(null)
    try {
      const rows = await (options.listSources ?? listStudioSources)()
      if (!disposed() && sourceGeneration === request) setSources(rows)
    } catch (error) {
      if (!disposed() && sourceGeneration === request)
        setSourceError(message(error))
    }
  }

  async function retire(): Promise<number> {
    const epoch = ++generation
    cancelImport()
    operationAbort?.abort()
    operationAbort = null
    queue?.dispose()
    queue = null
    const previous = lease
    lease = null
    setWritable(false)
    if (previous) {
      try {
        await service.releaseLease(previous.projectId, previous)
      } catch {
        /* Expiry also retires this token. */
      }
    }
    return epoch
  }

  function attachQueue(
    snapshot: StudioProject,
    token: StudioEditorLease,
    epoch: number,
  ): void {
    queue = createStudioSaveQueue({
      project: snapshot,
      token,
      save: (next, writeToken, prepared) =>
        service.saveProject(next, writeToken, prepared),
      changed: (state, error) => {
        if (!current(epoch)) return
        setSaveState(state)
        if (error !== null) {
          report(error)
          if (lostOwnership(error)) {
            setWritable(false)
            cancelImport()
          }
        } else if (state === 'saved') {
          setProblem(null)
          void refreshProjects()
        }
      },
    })
  }

  async function acquireProjectEditor(
    id: string,
    takeover: boolean,
  ): Promise<StudioEditorLease | null> {
    try {
      return await service.acquireLease(id, createId(), { takeover })
    } catch (error) {
      if (!(error instanceof StudioStorageError) || error.code !== 'locked')
        throw error
      // Another editor is a read-only state, not a failed storage operation.
      return null
    }
  }

  async function openProject(
    id: string,
    force = false,
    takeover = false,
  ): Promise<void> {
    if (!force && !canSwitch()) return
    const retirement = retire()
    const epoch = generation
    setLoading(true)
    setProject(null)
    setAssets([])
    setSaveState('saved')
    setProblem(null)
    let acquired: StudioEditorLease | null = null
    try {
      await retirement
      if (!current(epoch)) return
      acquired = await acquireProjectEditor(id, takeover)
      const [snapshot, metadata] = await Promise.all([
        service.loadProject(id),
        service.listAssets(id),
      ])
      if (!current(epoch)) {
        if (acquired) await service.releaseLease(id, acquired)
        return
      }
      setProject(snapshot)
      setAssets(metadata)
      lease = acquired
      if (acquired && acquired.expiresAt > now().getTime()) {
        setWritable(true)
        attachQueue(snapshot, acquired, epoch)
      }
    } catch (error) {
      if (acquired)
        await service.releaseLease(id, acquired).catch(() => undefined)
      if (current(epoch)) report(error)
    } finally {
      if (current(epoch)) setLoading(false)
    }
  }

  function commit(
    command: StudioCommand,
    prepared: readonly StudioAssetData[] = [],
  ): boolean {
    const snapshot = project()
    if (!canEdit() || !queue || snapshot === null) return false
    try {
      const metadata = [...assets(), ...prepared.map((data) => data.asset)]
      const next = applyStudioCommand(snapshot, command, {
        assets: metadata,
        now: now(),
      })
      if (next === snapshot) return true
      queue.stage(next, prepared)
      setProject(next)
      setAssets(metadata)
      void queue.flush()
      return true
    } catch (error) {
      report(error)
      return false
    }
  }

  async function importAudio(
    title: string,
    role: StudioSourceEntry['suggestedRole'],
    prepare: (
      id: string,
      projectId: string,
      signal: AbortSignal,
    ) => Promise<StudioAssetData>,
  ): Promise<void> {
    if (!canEdit() || importing()) return
    const epoch = generation
    const snapshot = project()!
    const abort = new AbortController()
    importAbort = abort
    setImporting(true)
    setProblem(null)
    try {
      const data = await prepare(createId(), snapshot.id, abort.signal)
      if (
        !current(epoch) ||
        abort.signal.aborted ||
        importAbort !== abort ||
        !canEdit()
      )
        return
      const existing = assets().find(
        (asset) =>
          asset.sha256 === data.asset.sha256 &&
          asset.canonicalPcmSha256 === data.asset.canonicalPcmSha256 &&
          asset.preparation.algorithmVersion ===
            data.asset.preparation.algorithmVersion,
      )
      const asset = existing ?? data.asset
      if (!existing && !fitsStudioProjectStorageBudget([...assets(), asset])) {
        throw new Error(
          'This project has reached its local audio limit. Add this take to another project.',
        )
      }
      const laneId = createId()
      const track = createStudioTrack({
        id: laneId,
        name: title,
        order: project()!.tracks.length,
        role,
      })
      commit(
        {
          type: 'add-audio',
          track,
          clip: {
            id: createId(),
            trackId: laneId,
            assetId: asset.id,
            startFrame: 0,
            sourceInFrame: 0,
            sourceOutFrame: asset.normalizedFrameCount,
            gainDb: 0,
            fades: { curve: 'linear-amplitude' },
          },
        },
        existing ? [] : [data],
      )
      await queue?.flush()
    } catch (error) {
      if (current(epoch) && !abort.signal.aborted) report(error)
    } finally {
      if (importAbort === abort) {
        importAbort = null
        setImporting(false)
      }
    }
  }

  async function addFile(file: File): Promise<void> {
    const error = audioUploadValidationError(
      file,
      DEFAULT_STUDIO_IMPORT_LIMITS.maxEncodedBytes,
      undefined,
      'Studio import',
    )
    if (error !== null) {
      setProblem(error)
      return
    }
    const title = file.name.replace(/\.[^.]+$/, '').trim() || 'Audio'
    const importedAt = now().toISOString()
    await importAudio(title, 'other', (id, projectId, signal) =>
      (options.prepareFile ?? prepareStudioAsset)(
        file,
        {
          id,
          projectId,
          originalName: file.name,
          provenance: { kind: 'file', importedAt },
        },
        { signal },
      ),
    )
  }

  async function addTake(entry: StudioSourceEntry): Promise<void> {
    const selected = { ...entry }
    const importedAt = now().toISOString()
    await importAudio(
      selected.title,
      selected.suggestedRole,
      (id, projectId, signal) =>
        (options.prepareTake ?? prepareStudioSource)(
          selected,
          { id, projectId, importedAt },
          { signal },
        ),
    )
  }

  async function create(title?: string): Promise<void> {
    if (!canSwitch()) return
    const epoch = generation
    const trimmedTitle = title?.trim()
    setWorking(true)
    setProblem(null)
    try {
      const created = await service.createProject(
        trimmedTitle === '' ? undefined : trimmedTitle,
      )
      if (current(epoch)) {
        setWorking(false)
        await openProject(created.id, true)
        await refreshProjects()
      }
    } catch (error) {
      if (current(epoch)) report(error)
    } finally {
      if (current(epoch)) setWorking(false)
    }
  }

  async function retrySave(): Promise<void> {
    if (!canEdit() || !queue) return
    setProblem(null)
    await queue.retry()
  }

  async function takeOver(): Promise<void> {
    const id = project()?.id
    if (id === undefined || busy()) return
    if (hasUnsavedChanges()) {
      setProblem(
        'Your changes are not saved. Make a copy or download a backup, or discard changes and reload before taking over editing.',
      )
      return
    }
    // This explicit action reloads durable data; Fork preserves unsaved edits.
    await openProject(id, true, true)
  }

  async function fork(): Promise<void> {
    const snapshot = project()
    if (!snapshot || busy()) return
    const prepared = queue?.preparedAssets() ?? []
    const epoch = generation
    setWorking(true)
    setProblem(null)
    try {
      const copy = await service.forkProject(snapshot, prepared)
      if (current(epoch)) {
        setWorking(false)
        await openProject(copy.id, true)
        await refreshProjects()
      }
    } catch (error) {
      if (current(epoch)) report(error)
    } finally {
      if (current(epoch)) setWorking(false)
    }
  }

  async function backup(): Promise<Blob | null> {
    const snapshot = project()
    if (!snapshot || working() || importing() || loading()) return null
    const prepared = queue?.preparedAssets() ?? []
    const epoch = generation
    const abort = new AbortController()
    operationAbort = abort
    setWorking(true)
    setProblem(null)
    try {
      const blob = await (options.createBackup ?? createStudioBackup)(
        snapshot,
        (id) => service.readAssetBytes(snapshot.id, id),
        { preparedAssets: prepared, signal: abort.signal },
      )
      return current(epoch) && !abort.signal.aborted ? blob : null
    } catch (error) {
      if (current(epoch) && !abort.signal.aborted) report(error)
      return null
    } finally {
      if (operationAbort === abort) {
        operationAbort = null
        setWorking(false)
      }
    }
  }

  async function restore(blob: Blob): Promise<void> {
    if (!canSwitch()) return
    const epoch = generation
    const abort = new AbortController()
    operationAbort = abort
    setWorking(true)
    setProblem(null)
    try {
      const restored = await (options.restoreBackup ?? restoreStudioBackup)(
        blob,
        service,
        { signal: abort.signal },
      )
      if (current(epoch) && !abort.signal.aborted) {
        setWorking(false)
        await openProject(restored.id, true)
        await refreshProjects()
      }
    } catch (error) {
      if (current(epoch) && !abort.signal.aborted) report(error)
    } finally {
      if (operationAbort === abort) {
        operationAbort = null
        setWorking(false)
      }
    }
  }

  async function discardAndReload(): Promise<void> {
    const id = project()?.id
    if (id !== undefined && !working()) await openProject(id, true)
  }

  async function deleteProject(): Promise<void> {
    if (!canEdit() || busy() || saveState() !== 'saved' || !queue || !lease)
      return
    const id = project()!.id
    const token = { ...lease, expectedRevision: queue.durableRevision() }
    const epoch = generation
    setWorking(true)
    try {
      await service.deleteProject(id, token)
      if (current(epoch)) {
        await retire()
        setProject(null)
        setAssets([])
        setSaveState('saved')
        setWorking(false)
        await refreshProjects()
      }
    } catch (error) {
      if (current(epoch)) report(error)
    } finally {
      if (current(epoch)) setWorking(false)
    }
  }

  const renewTimer = setInterval(
    () =>
      untrack(() => {
        const token = lease
        const epoch = generation
        if (!token || !writable() || renewingGeneration === epoch || disposed())
          return
        if (token.expiresAt <= now().getTime()) {
          expireEditor()
          return
        }
        renewingGeneration = epoch
        void service
          .renewLease(token.projectId, token)
          .then((renewed) => {
            if (current(epoch) && lease === token) lease = renewed
          })
          .catch((error: unknown) => {
            if (current(epoch) && lease === token) {
              setWritable(false)
              cancelImport()
              queue?.pause(error)
              report(error)
            }
          })
          .finally(() => {
            if (renewingGeneration === epoch) renewingGeneration = null
          })
      }),
    10_000,
  )

  function dispose(): void {
    if (disposed()) return
    setDisposed(true)
    clearInterval(renewTimer)
    void retire()
  }
  onCleanup(dispose)
  onMount(() => {
    void refreshProjects()
  })

  return {
    project,
    assets,
    projects,
    sources,
    sourceError,
    loading,
    busy,
    importing,
    saveState,
    writable,
    problem,
    hasUnsavedChanges,
    create,
    open: (id: string) => openProject(id),
    refreshProjects,
    refreshSources,
    addFile,
    addTake,
    cancelImport,
    retrySave,
    takeOver,
    fork,
    backup,
    restore,
    discardAndReload,
    deleteProject,
    dispose,
    rename: (title: string) =>
      commit({ type: 'rename-project', title: title.trim() }),
    dispatch: (command: StudioCommand) => commit(command),
  }
}

export type StudioController = ReturnType<typeof useStudioController>
