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
import type { EditorPresence, EditorPresenceSource, ProjectOpenHold, } from './controller/editor-presence'
import { defaultEditorPresence, EDITOR_CLAIM_WAIT_MS, } from './controller/editor-presence'
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
const LEAVE_WHILE_IMPORTING =
  'Studio is still adding audio to this project. Wait for it to finish, or cancel the import.'
const LEAVE_WHILE_SAVING =
  'Studio is still saving this project on this device. Try again in a moment.'
const LEAVE_AFTER_FAILED_SAVE =
  'Studio could not save your latest changes. Retry the save, make a copy, or discard the changes before you leave.'
const EDITING_TAKEN =
  'This project is no longer editable in this tab. Reload, make a copy, or take over editing.'
const LEAVE_WITHOUT_EDITING =
  'This tab can no longer save your latest changes. Make a copy to keep them, or discard them before you leave.'

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
  /** Which live tab edits a project: Web Locks where the browser has them. */
  presence?: EditorPresenceSource
}

/** This tab's hold on the open project: the lease that fences its writes, and its live presence. */
interface ProjectEditor {
  lease: StudioEditorLease
  presence: EditorPresence
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
  const presenceSource = options.presence ?? defaultEditorPresence()
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
  let presence: EditorPresence | null = null
  /** The open song, held as loaded in this tab: no tab deletes its audio meanwhile. */
  let openHold: ProjectOpenHold | null = null
  /**
   * True while editing is on hold but the token may still be this tab's: a
   * save found the lease gone, or renewing it failed. The next reclaim gives
   * editing back, with the history and the waiting saves intact.
   */
  let editingLapsed = false
  let reclaiming: { epoch: number; done: Promise<void> } | null = null
  let operationAbort: AbortController | null = null
  /** Edits wait on loading, imports and whole-song work, not on a save. */
  const editBlocked = () => loading() || working() || importing()
  const busy = () => editBlocked() || saveState() === 'saving'
  const hasUnsavedChanges = () =>
    !!project() && !!queue && project()!.revision > queue.durableRevision()
  /**
   * What the app says when Studio holds a tab switch, a route or a voice
   * command. A save in flight ends by itself; a failed save or a tab that
   * lost editing never does, so those name the way out instead.
   */
  const leaveHeldMessage = (): string => {
    if (importing()) return LEAVE_WHILE_IMPORTING
    if (!writable()) return LEAVE_WITHOUT_EDITING
    if (saveState() === 'error') return LEAVE_AFTER_FAILED_SAVE
    return LEAVE_WHILE_SAVING
  }
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
    leaveHeldMessage,
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

  /** Stop editing here: nothing more is written, and what is not saved waits. */
  function suspendEditor(error: unknown): void {
    setWritable(false)
    cancelImport()
    queue?.pause(error)
    report(error)
  }

  /** Another tab took the project over: this tab's token can never write again. */
  function loseEditor(error: unknown): void {
    const held = presence
    lease = null
    presence = null
    editingLapsed = false
    held?.release()
    suspendEditor(error)
  }

  function watchPresence(held: EditorPresence, epoch: number): void {
    void held.lost.then(() => {
      if (presence !== held || !current(epoch)) return
      loseEditor(new StudioStorageError('lease-lost', EDITING_TAKEN))
    })
  }

  /** Whether this tab's lease ran out on its own clock. The record may still be this tab's. */
  function leaseLapsed(): boolean {
    return lease !== null && lease.expiresAt <= now().getTime()
  }

  /** Whether this tab edits the open project, or did until editing was put on hold. */
  function holdsEditor(): boolean {
    return lease !== null && !disposed() && (writable() || editingLapsed)
  }

  /**
   * Renew this tab's lease, or win it back after it lapsed, on the same
   * token, so the project, its history and its waiting saves stay as they
   * are. A page lets the project's lock go on its way into the back-forward
   * cache, so the lock is claimed again first: while this tab holds it, no
   * other live tab can be editing. The lease is then reclaimed on its epoch,
   * which fails only when another tab has held the project since, and
   * editing here is over. Runs on every renewal tick, before a write that
   * finds the lease lapsed, and as the tab comes back into view, into focus
   * or out of the back-forward cache.
   */
  function reclaimEditor(): Promise<void> {
    const token = lease
    const epoch = generation
    if (!token || disposed() || loading()) return Promise.resolve()
    if (reclaiming?.epoch === epoch) return reclaiming.done
    const entry = { epoch, done: Promise.resolve() }
    reclaiming = entry
    entry.done = Promise.resolve()
      .then(() => reclaimToken(token, epoch))
      .finally(() => {
        if (reclaiming === entry) reclaiming = null
      })
    return entry.done
  }

  async function reclaimToken(
    token: StudioEditorLease,
    epoch: number,
  ): Promise<void> {
    const ours = () =>
      current(epoch) &&
      lease !== null &&
      lease.ownerId === token.ownerId &&
      lease.epoch === token.epoch
    try {
      if (presence === null) {
        const claimed = await presenceSource.claim(token.projectId, {
          waitMs: EDITOR_CLAIM_WAIT_MS,
          steal: false,
        })
        if (!ours()) {
          claimed?.release()
          return
        }
        // Another live tab holds the project's lock, so it edits the project now.
        if (claimed === null) {
          loseEditor(new StudioStorageError('lease-lost', EDITING_TAKEN))
          return
        }
        presence = claimed
        watchPresence(claimed, epoch)
      }
      const renewed = await service.reclaimLease(token.projectId, token)
      if (!ours()) return
      lease = renewed
      if (!editingLapsed) return
      editingLapsed = false
      setWritable(true)
      void queue?.retry()
    } catch (error) {
      if (!ours()) return
      if (lostOwnership(error)) {
        loseEditor(error)
        return
      }
      editingLapsed = true
      suspendEditor(error)
    }
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
    if (!leaseLapsed()) return true
    // The renewal ran late, as a hidden tab's do. While this tab holds the
    // project's lock no other tab can be editing, so the edit goes ahead and
    // its save waits for the reclaim. Without the lock, editing waits.
    void reclaimEditor()
    if (presence?.exclusive === true) return true
    editingLapsed = true
    setWritable(false)
    return false
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
    const held = presence
    const opened = openHold
    lease = null
    presence = null
    openHold = null
    editingLapsed = false
    setWritable(false)
    try {
      if (previous) await service.releaseLease(previous.projectId, previous)
    } catch {
      /* Expiry also retires this token. */
    } finally {
      held?.release()
      opened?.release()
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
      save: async (next, writeToken, prepared) => {
        // A renewal that ran late leaves this tab's own lease lapsed: win it
        // back before the write instead of failing the write.
        if (leaseLapsed()) await reclaimEditor()
        return service.saveProject(next, writeToken, prepared)
      },
      changed: (state, error) => {
        if (!current(epoch)) return
        setSaveState(state)
        if (error !== null) {
          report(error)
          if (lostOwnership(error)) {
            setWritable(false)
            cancelImport()
            // Perhaps the lease only lapsed. The next renewal, or the tab's
            // return to view, wins it back or finds it taken.
            if (lease !== null) editingLapsed = true
          }
        } else if (state === 'saved') {
          setProblem(null)
          void refreshProjects()
        }
      },
    })
  }

  /**
   * This tab's lease and presence on project `id`, or null while another
   * live tab edits it. Holding the project's lock proves the lease's owner,
   * if any, has gone (a reload's old document, a closed or crashed tab), so
   * its lease is taken over at once instead of after its 30 seconds.
   */
  async function acquireProjectEditor(
    id: string,
    takeover: boolean,
  ): Promise<ProjectEditor | null> {
    const claimed = await presenceSource.claim(id, {
      waitMs: EDITOR_CLAIM_WAIT_MS,
      steal: takeover,
    })
    // Another editor is a read-only state, not a failed storage operation.
    if (claimed === null) return null
    try {
      const acquired = await service.acquireLease(id, createId(), {
        takeover: takeover || claimed.exclusive,
      })
      return { lease: acquired, presence: claimed }
    } catch (error) {
      claimed.release()
      if (!(error instanceof StudioStorageError) || error.code !== 'locked')
        throw error
      return null
    }
  }

  async function releaseProjectEditor(
    id: string,
    editor: ProjectEditor,
  ): Promise<void> {
    try {
      await service.releaseLease(id, editor.lease)
    } finally {
      editor.presence.release()
    }
  }

  /**
   * Delete the song's audio that no clip uses, as it opens: takes removed in
   * an earlier session stop counting against its audio limit. Only a tab that
   * edits the song and holds its lock asks, and only once it is proven that
   * no other tab has the song loaded: another tab's history, unsaved edits
   * or copy may still want that audio. A failure keeps everything.
   */
  async function pruneUnused(
    id: string,
    token: StudioEditorLease,
    snapshot: StudioProject,
    opened: ProjectOpenHold,
    metadata: StudioAsset[],
  ): Promise<StudioAsset[]> {
    const used = new Set(snapshot.clips.map((clip) => clip.assetId))
    if (metadata.every((asset) => used.has(asset.id))) return metadata
    try {
      if (!(await opened.alone())) return metadata
      return await service.pruneUnusedAssets(id, {
        ...token,
        expectedRevision: snapshot.revision,
      })
    } catch {
      return metadata
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
    let opened: ProjectOpenHold | null = null
    let acquired: ProjectEditor | null = null
    let adopted = false
    try {
      await retirement
      if (!current(epoch)) return
      // Held from before the song is read until this tab lets it go: while
      // any tab holds it, no tab deletes the song's unused audio.
      opened = await presenceSource.open(id)
      if (!current(epoch)) return
      acquired = await acquireProjectEditor(id, takeover)
      const [snapshot, loaded] = await Promise.all([
        service.loadProject(id),
        service.listAssets(id),
      ])
      if (!current(epoch)) return
      const editing =
        acquired !== null && acquired.lease.expiresAt > now().getTime()
      const metadata =
        acquired !== null && editing && acquired.presence.exclusive
          ? await pruneUnused(id, acquired.lease, snapshot, opened, loaded)
          : loaded
      if (!current(epoch)) return
      const history = createStudioEditHistory(snapshot)
      setEditHistory(history)
      setProject(history.state.present)
      setAssets(metadata)
      openHold = opened
      adopted = true
      if (acquired) {
        lease = acquired.lease
        presence = acquired.presence
        watchPresence(acquired.presence, epoch)
        if (editing) {
          setWritable(true)
          attachQueue(snapshot, acquired.lease, epoch)
        }
      }
    } catch (error) {
      if (current(epoch)) report(error)
    } finally {
      if (!adopted) {
        opened?.release()
        if (acquired)
          await releaseProjectEditor(id, acquired).catch(() => undefined)
      }
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
    if (leaseLapsed()) await reclaimEditor()
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

  // Every 10 seconds against a 30 second lease. A tick that runs late, as a
  // hidden tab's do, finds the lease lapsed and reclaims it on the same epoch
  // instead of giving editing up.
  const renewTimer = setInterval(
    () =>
      untrack(() => {
        if (holdsEditor()) void reclaimEditor()
      }),
    10_000,
  )

  // Back in view, in focus, or out of the back-forward cache: editing that
  // lapsed meanwhile comes back here, with nothing reloaded.
  const regain = () =>
    untrack(() => {
      if (holdsEditor() && (editingLapsed || leaseLapsed() || !presence))
        void reclaimEditor()
    })
  const onVisibility = () => {
    if (document.visibilityState === 'visible') regain()
  }
  // Leaving the page: let the project's lock go at once, so a reload or
  // another tab can edit, and the lease too where the page lives long enough
  // to write it. A page kept in the back-forward cache claims both back as it
  // is shown again.
  const onPageHide = () =>
    untrack(() => {
      const held = presence
      presence = null
      held?.release()
      const token = lease
      if (!token || disposed()) return
      lease = { ...token, expiresAt: 0 }
      void service.releaseLease(token.projectId, token).catch(() => undefined)
    })

  function dispose(): void {
    if (disposed()) return
    setDisposed(true)
    clearInterval(renewTimer)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('focus', regain)
    window.removeEventListener('pageshow', regain)
    window.removeEventListener('pagehide', onPageHide)
    void retire()
  }
  onCleanup(dispose)
  onMount(() => {
    void refreshProjects()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', regain)
    window.addEventListener('pageshow', regain)
    window.addEventListener('pagehide', onPageHide)
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
