// Studio controller — local project ownership, selected imports and durable revision saves.
import { createSignal, onCleanup, onMount, untrack } from 'solid-js'
import type { StudioEditorLease, StudioService, } from '@/db/services/studio-service'
import { createStudioService, StudioStorageError, } from '@/db/services/studio-service'
import { useLocalSaveNavigationLock } from '@/lib/local-save-navigation-lock'
import { checkImportCancelled, DEFAULT_STUDIO_IMPORT_LIMITS, } from '@/lib/studio/audio/import-limits'
import type { prepareStudioAsset } from '@/lib/studio/audio/prepare-studio-asset'
import { reserveStudioMemory } from '@/lib/studio/memory-budget'
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioAsset, StudioAssetData, StudioProject, StudioProjectSummary, } from '@/lib/studio/model/types'
import type { StudioBackupTarget } from './backup/backup-target'
import { restoreStudioBackup, writeStudioBackup } from './backup/studio-backup'
import type { StudioEditHistory } from './controller/edit-history'
import { createStudioEditHistory, executeStudioEdit, travelStudioHistory, } from './controller/edit-history'
import { createStudioImporter, studioMissedLaneText, } from './controller/imports'
import type { StudioSaveQueue, StudioSaveState } from './controller/save-queue'
import { createStudioSaveQueue } from './controller/save-queue'
import type { prepareStudioSource } from './integration/prepare-source'
import type { StudioSourceEntry } from './integration/source-catalog'
import { listStudioSources, readStudioSourceBlob, } from './integration/source-catalog'

/**
 * How long a song switch for a picked backup waits for a save in flight. An
 * edit's save writes the arrangement; an import's audio is saved while the
 * import still holds the Studio busy, and a backup is refused then.
 */
export const STUDIO_SAVE_WAIT_MS = 10_000
const SWITCH_REFUSED =
  'Save these changes, make a copy, or discard them before opening another project.'

export interface StudioControllerOptions {
  service?: StudioService
  now?: () => Date
  createId?: () => string
  listSources?: typeof listStudioSources
  prepareFile?: typeof prepareStudioAsset
  prepareTake?: typeof prepareStudioSource
  writeBackup?: typeof writeStudioBackup
  restoreBackup?: typeof restoreStudioBackup
  readSource?: typeof readStudioSourceBlob
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
  // Where a take went when its lane had no room: a fresh object per miss, so
  // the same sentence twice is still said twice.
  const [laneNotice, setLaneNotice] = createSignal<{ text: string } | null>(
    null,
  )
  const [disposed, setDisposed] = createSignal(false)
  const [editHistory, setEditHistory] = createSignal<StudioEditHistory | null>(
    null,
  )
  let generation = 0
  let sourceGeneration = 0
  let listGeneration = 0
  let queue: StudioSaveQueue | null = null
  let lease: StudioEditorLease | null = null
  let operationAbort: AbortController | null = null
  let renewingGeneration: number | null = null
  /** Edits wait on loading, imports and whole-song work, not on a save. */
  const editBlocked = () => loading() || working() || importing()
  const busy = () => editBlocked() || saveState() === 'saving'
  const hasUnsavedChanges = () =>
    !!project() && !!queue && project()!.revision > queue.durableRevision()
  const canUndo = () =>
    writable() &&
    !loading() &&
    !working() &&
    (editHistory()?.state.past.length ?? 0) > 0
  const canRedo = () =>
    writable() &&
    !loading() &&
    !working() &&
    (editHistory()?.state.future.length ?? 0) > 0
  const undoLabel = () => {
    const label = editHistory()?.pastLabels.at(-1)
    return label === undefined ? 'Undo' : `Undo ${label}`
  }
  const redoLabel = () => {
    const label = editHistory()?.futureLabels[0]
    return label === undefined ? 'Redo' : `Redo ${label}`
  }
  useLocalSaveNavigationLock(
    () =>
      !disposed() &&
      (importing() || saveState() === 'saving' || hasUnsavedChanges()),
    'Studio local project',
  )

  const current = (epoch: number) =>
    untrack(() => !disposed() && generation === epoch)
  const report = (error: unknown) => setProblem(message(error))

  const { addFile, addFiles, addTake, addTakes, cancelImport } =
    createStudioImporter({
      project,
      assets,
      epoch: () => generation,
      current,
      canEdit,
      setImporting,
      clearProblem: () => setProblem(null),
      report,
      commit,
      flush: () => queue?.flush(),
      createId,
      now,
      prepareFile: options.prepareFile,
      prepareTake: options.prepareTake,
      onMissedLane: (miss) =>
        setLaneNotice({ text: studioMissedLaneText(miss) }),
    })

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

  /** Whether switching songs now would lose edits; a save in flight counts unless `waitsForSave`. */
  function unsavedWork(waitsForSave: boolean): boolean {
    if (importing()) return true
    if (saveState() === 'saving') return !waitsForSave
    return hasUnsavedChanges()
  }

  function canSwitch(waitsForSave = false): boolean {
    if (disposed() || loading() || working()) return false
    if (unsavedWork(waitsForSave)) {
      setProblem(SWITCH_REFUSED)
      return false
    }
    return true
  }

  /**
   * Whether a backup of song `id`, or of the open song, can start. The page
   * asks before it opens a save picker, which empties the file picked: a
   * refusal after it would cost that file. A save in flight is no reason to
   * refuse; the switch to the song waits for it.
   */
  function canBackup(id?: string): boolean {
    if (id !== undefined && id !== project()?.id) return canSwitch(true)
    return (
      !!project() && !disposed() && !loading() && !working() && !importing()
    )
  }

  /** Wait for a save in flight to land, but no longer than STUDIO_SAVE_WAIT_MS. */
  async function settleSave(): Promise<void> {
    const saving = saveState() === 'saving' ? queue?.flush() : undefined
    if (!saving) return
    let timer: ReturnType<typeof setTimeout> | undefined
    await Promise.race([
      saving,
      new Promise((resolve) => {
        timer = setTimeout(resolve, STUDIO_SAVE_WAIT_MS)
      }),
    ])
    clearTimeout(timer)
  }

  /** Open song `id` for a backup whose file is picked: true once it is open. */
  async function openForBackup(id: string): Promise<boolean> {
    if (project()?.id !== id) {
      await settleSave()
      await openProject(id)
    }
    return project()?.id === id
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
    setEditHistory(null)
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
      const history = createStudioEditHistory(snapshot)
      setEditHistory(history)
      setProject(history.state.present)
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
    const history = editHistory()
    if (!canEdit() || !queue || history === null) return false
    try {
      const metadata = [...assets(), ...prepared.map((data) => data.asset)]
      const next = executeStudioEdit(history, command, {
        assets: metadata,
        now: now(),
      })
      if (next === history) return true
      queue.stage(next.state.present, prepared)
      setEditHistory(next)
      setProject(next.state.present)
      setAssets(metadata)
      void queue.flush()
      return true
    } catch (error) {
      report(error)
      return false
    }
  }

  function historyAction(direction: 'undo' | 'redo'): boolean {
    const history = editHistory()
    if (!canEdit() || !queue || history === null) return false
    try {
      const next = travelStudioHistory(history, direction, {
        assets: assets(),
        now: now(),
      })
      if (next === history) return true
      queue.stage(next.state.present)
      setEditHistory(next)
      setProject(next.state.present)
      void queue.flush()
      return true
    } catch (error) {
      report(error)
      return false
    }
  }

  async function readCanonicalAsset(assetId: string): Promise<Blob> {
    const snapshot = project()
    const epoch = generation
    if (snapshot === null || !assets().some((asset) => asset.id === assetId))
      throw new Error('This project audio is missing.')
    const staged = queue
      ?.preparedAssets()
      .find((data) => data.asset.id === assetId)
    const blob =
      staged?.canonicalPcm ??
      (await service.readCanonicalAsset(snapshot.id, assetId))
    if (!current(epoch))
      throw new DOMException('The project changed.', 'AbortError')
    return blob
  }

  async function readSourcePreview(
    entry: StudioSourceEntry,
    previewOptions: { signal?: AbortSignal } = {},
  ): Promise<Blob> {
    const epoch = generation
    checkImportCancelled(previewOptions.signal)
    if (
      !Number.isSafeInteger(entry.sizeBytes) ||
      entry.sizeBytes <= 0 ||
      entry.sizeBytes > DEFAULT_STUDIO_IMPORT_LIMITS.maxEncodedBytes
    )
      throw new Error('This take is too large to preview here.')
    const release = reserveStudioMemory(entry.sizeBytes * 2)
    try {
      const blob = await (options.readSource ?? readStudioSourceBlob)(entry, {
        signal: previewOptions.signal,
      })
      checkImportCancelled(previewOptions.signal)
      if (!current(epoch))
        throw new DOMException('The project changed.', 'AbortError')
      return blob
    } finally {
      release()
    }
  }

  async function create(title?: string): Promise<boolean> {
    if (!canSwitch()) return false
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
        return project()?.id === created.id && !disposed()
      }
      return false
    } catch (error) {
      if (current(epoch)) report(error)
      return false
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

  /** Write the open song's backup into the target. False when it did not finish. */
  async function backup(target: StudioBackupTarget): Promise<boolean> {
    const snapshot = project()
    if (!snapshot || working() || importing() || loading()) return false
    const prepared = queue?.preparedAssets() ?? []
    const epoch = generation
    const abort = new AbortController()
    operationAbort = abort
    setWorking(true)
    setProblem(null)
    try {
      await (options.writeBackup ?? writeStudioBackup)(
        snapshot,
        (id) => service.readAssetBuffers(snapshot.id, id),
        target,
        {
          preparedAssets: prepared,
          signal: abort.signal,
          assetMetadata: assets(),
        },
      )
      return current(epoch) && !abort.signal.aborted
    } catch (error) {
      if (current(epoch) && !abort.signal.aborted) report(error)
      return false
    } finally {
      if (operationAbort === abort) {
        operationAbort = null
        setWorking(false)
      }
    }
  }

  async function restore(blob: Blob): Promise<boolean> {
    if (!canSwitch()) return false
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
        return project()?.id === restored.id && !disposed()
      }
      return false
    } catch (error) {
      if (current(epoch) && !abort.signal.aborted) report(error)
      return false
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
    editBlocked,
    importing,
    saveState,
    writable,
    problem,
    laneNotice,
    hasUnsavedChanges,
    create,
    open: (id: string) => openProject(id),
    refreshProjects,
    refreshSources,
    addFile,
    addFiles,
    addTake,
    addTakes,
    readCanonicalAsset,
    readSourcePreview,
    canUndo,
    canRedo,
    undoLabel,
    redoLabel,
    undo: () => historyAction('undo'),
    redo: () => historyAction('redo'),
    cancelImport,
    retrySave,
    takeOver,
    fork,
    canBackup,
    openForBackup,
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
