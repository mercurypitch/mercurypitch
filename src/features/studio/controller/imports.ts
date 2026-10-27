// Studio imports — prepare a selected batch sequentially and commit it as one edit.
import { audioUploadValidationError } from '@/lib/audio-upload-contract'
import { checkImportCancelled, DEFAULT_STUDIO_IMPORT_LIMITS, } from '@/lib/studio/audio/import-limits'
import { prepareStudioAsset } from '@/lib/studio/audio/prepare-studio-asset'
import type { StudioCommand, StudioEdit } from '@/lib/studio/model/commands'
import { createStudioTrack } from '@/lib/studio/model/defaults'
import { fitsStudioProjectStorageBudget } from '@/lib/studio/model/storage-limits'
import type { StudioAsset, StudioAssetData, StudioProject, } from '@/lib/studio/model/types'
import { prepareStudioSource } from '../integration/prepare-source'
import type { StudioSourceEntry } from '../integration/source-catalog'
import { createRetainedStudioAudio } from './retained-audio'

interface ImportItem {
  title: string
  role: StudioSourceEntry['suggestedRole']
  prepare(
    id: string,
    projectId: string,
    signal: AbortSignal,
  ): Promise<StudioAssetData>
}

interface ImportControllerOptions {
  project(): StudioProject | null
  assets(): readonly StudioAsset[]
  epoch(): number
  current(epoch: number): boolean
  canEdit(): boolean
  setImporting(value: boolean): void
  clearProblem(): void
  report(error: unknown): void
  commit(command: StudioCommand, prepared: readonly StudioAssetData[]): boolean
  flush(): Promise<unknown> | undefined
  createId(): string
  now(): Date
  prepareFile?: typeof prepareStudioAsset
  prepareTake?: typeof prepareStudioSource
}

function sameAudio(a: StudioAsset, b: StudioAsset): boolean {
  return (
    a.sha256 === b.sha256 &&
    a.canonicalPcmSha256 === b.canonicalPcmSha256 &&
    a.preparation.algorithmVersion === b.preparation.algorithmVersion
  )
}

function retainNewAudio(
  data: StudioAssetData,
  known: readonly StudioAsset[],
  retained: ReturnType<typeof createRetainedStudioAudio>,
): StudioAsset {
  const existing = known.find((asset) => sameAudio(asset, data.asset))
  if (existing !== undefined) return existing
  if (!fitsStudioProjectStorageBudget([...known, data.asset]))
    throw new Error(
      'This project has reached its local audio limit. Add this take to another project.',
    )
  retained.retain([data])
  return data.asset
}

function importCommands(
  items: readonly { item: ImportItem; asset: StudioAsset }[],
  project: StudioProject,
  startFrame: number,
  createId: () => string,
): StudioEdit[] {
  const firstOrder =
    Math.max(-1, ...project.tracks.map((track) => track.order)) + 1
  return items.map(({ item, asset }, index) => {
    const track = createStudioTrack({
      id: createId(),
      name: item.title,
      order: firstOrder + index,
      role: item.role,
    })
    return {
      type: 'add-audio',
      track,
      clip: {
        id: createId(),
        trackId: track.id,
        assetId: asset.id,
        startFrame,
        sourceInFrame: 0,
        sourceOutFrame: asset.normalizedFrameCount,
        gainDb: 0,
        fades: { curve: 'linear-amplitude' },
      },
    }
  })
}

export function createStudioImporter(options: ImportControllerOptions) {
  let active: AbortController | null = null

  function cancelImport(): void {
    active?.abort()
    active = null
    options.setImporting(false)
  }

  // A file picked while the last import is still saving waits its turn; it
  // used to be dropped without a word.
  let turn: Promise<unknown> = Promise.resolve()

  function importItems(
    items: readonly ImportItem[],
    startFrame: number,
  ): Promise<boolean> {
    const run =
      active === null
        ? importNow(items, startFrame)
        : turn.then(() => importNow(items, startFrame))
    turn = run.catch(() => undefined)
    return run
  }

  async function importNow(
    items: readonly ImportItem[],
    startFrame: number,
  ): Promise<boolean> {
    const snapshot = options.project()
    if (
      !options.canEdit() ||
      active !== null ||
      snapshot === null ||
      items.length === 0
    )
      return false
    if (!Number.isSafeInteger(startFrame) || startFrame < 0) {
      options.report(new Error('Choose a valid position in the song.'))
      return false
    }
    const epoch = options.epoch()
    const abort = new AbortController()
    const retained = createRetainedStudioAudio()
    const selected: { item: ImportItem; asset: StudioAsset }[] = []
    active = abort
    options.setImporting(true)
    options.clearProblem()
    try {
      for (const item of items) {
        checkImportCancelled(abort.signal)
        const data = await item.prepare(
          options.createId(),
          snapshot.id,
          abort.signal,
        )
        checkImportCancelled(abort.signal)
        if (!options.current(epoch) || !options.canEdit()) return false
        const known = [
          ...options.assets(),
          ...retained.values().map((value) => value.asset),
        ]
        selected.push({ item, asset: retainNewAudio(data, known, retained) })
      }
      const currentProject = options.project()
      if (currentProject === null || !options.current(epoch)) return false
      const commands = importCommands(
        selected,
        currentProject,
        startFrame,
        options.createId,
      )
      const prepared = retained.values()
      // Transfer admission synchronously to the queue. No allocation or await
      // intervenes; if staging fails, these results are discarded by this scope.
      retained.clear()
      const committed = options.commit(
        commands.length === 1 ? commands[0] : { type: 'batch', commands },
        prepared,
      )
      await options.flush()
      return committed && options.current(epoch)
    } catch (error) {
      if (options.current(epoch) && !abort.signal.aborted) options.report(error)
      return false
    } finally {
      retained.clear()
      if (active === abort) {
        active = null
        options.setImporting(false)
      }
    }
  }

  async function addFiles(
    files: readonly File[],
    startFrame = 0,
  ): Promise<boolean> {
    if (!files.length || files.length > 128) {
      options.report(new Error('Choose between one and 128 audio files.'))
      return false
    }
    for (const file of files) {
      const error = audioUploadValidationError(
        file,
        DEFAULT_STUDIO_IMPORT_LIMITS.maxEncodedBytes,
        undefined,
        'Studio import',
      )
      if (error !== null) {
        options.report(new Error(error))
        return false
      }
    }
    const importedAt = options.now().toISOString()
    return importItems(
      files.map((file) => ({
        title: file.name.replace(/\.[^.]+$/, '').trim() || 'Audio',
        role: 'other',
        prepare: (id, projectId, signal) =>
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
      })),
      startFrame,
    )
  }
  const addFile = (file: File, startFrame = 0) => addFiles([file], startFrame)

  async function addTakes(
    entries: readonly StudioSourceEntry[],
    startFrame = 0,
  ): Promise<boolean> {
    const importedAt = options.now().toISOString()
    const selected = [
      ...new Map(entries.map((entry) => [entry.id, { ...entry }])).values(),
    ]
    return importItems(
      selected.map((entry) => ({
        title: entry.title,
        role: entry.suggestedRole,
        prepare: (id, projectId, signal) =>
          (options.prepareTake ?? prepareStudioSource)(
            entry,
            { id, projectId, importedAt },
            { signal },
          ),
      })),
      startFrame,
    )
  }

  return {
    addFile,
    addFiles,
    addTakes,
    addTake: (entry: StudioSourceEntry, startFrame = 0) =>
      addTakes([entry], startFrame),
    cancelImport,
  }
}
