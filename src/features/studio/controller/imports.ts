// Studio imports — prepare a selected batch sequentially and commit it as one edit.
import { audioUploadValidationError } from '@/lib/audio-upload-contract'
import { checkImportCancelled, DEFAULT_STUDIO_IMPORT_LIMITS, } from '@/lib/studio/audio/import-limits'
import { prepareStudioAsset } from '@/lib/studio/audio/prepare-studio-asset'
import type { StudioMidiSoundKind } from '@/lib/studio/midi/render-key'
import { studioMidiRenderKey } from '@/lib/studio/midi/render-key'
import { studioFitPasses } from '@/lib/studio/model/clip-passes'
import type { StudioCommand, StudioEdit } from '@/lib/studio/model/commands'
import { createStudioTrack } from '@/lib/studio/model/defaults'
import { fitsStudioProjectStorageBudget } from '@/lib/studio/model/storage-limits'
import type { StudioAsset, StudioAssetData, StudioClipMidi, StudioClipPasses, StudioNote, StudioProject, } from '@/lib/studio/model/types'
import { studioTakeFileName } from '@/lib/studio/record/take-audio'
import { studioTakeSequence } from '@/lib/studio/record/take-notes'
import { prepareStudioSource } from '../integration/prepare-source'
import type { StudioSourceEntry } from '../integration/source-catalog'
import { formatStudioMoment } from '../timeline/timeline-geometry'
import { createRetainedStudioAudio } from './retained-audio'

interface ImportItem {
  title: string
  role: StudioSourceEntry['suggestedRole']
  /** Frames left out at the clip's start: a recorded take's count-in and round trip. */
  sourceInFrame?: number
  /** Where the clip ends in its audio, a punch's out point; else the audio's end. */
  sourceOutFrame?: number
  /** Fades this long at both of the clip's edges: a punch's. */
  fadeFrames?: number
  /** A loop take's passes in its audio, the clip on one of them (clip-passes.ts). */
  passes?: StudioClipPasses
  /** A punch: it replaces what its lane plays under it, as tape does. */
  punch?: boolean
  /** A MIDI lane's take: the notes its clip plays. */
  midi?: StudioRecordingMidi
  prepare(
    id: string,
    projectId: string,
    signal: AbortSignal,
  ): Promise<StudioAssetData>
}

/** A take meant for a lane that had no room where it starts, so it got a lane of its own. */
export interface StudioMissedLane {
  trackId: string
  trackName: string
  startFrame: number
  /** Lanes the import made, so the notice can say "a new lane" or "new lanes". */
  newLanes: number
}

/** What the timeline says when a take had no room on its chosen lane. */
export function studioMissedLaneText(miss: StudioMissedLane): string {
  const lanes = miss.newLanes > 1 ? 'new lanes' : 'a new lane'
  return `No room on ${miss.trackName} at ${formatStudioMoment(miss.startFrame)}. Added on ${lanes}.`
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
  /** The edit's refusal goes to `refused`, this import's own notice. */
  commit(
    command: StudioCommand,
    prepared: readonly StudioAssetData[],
    refused: (error: unknown) => void,
  ): boolean
  flush(): Promise<unknown> | undefined
  createId(): string
  now(): Date
  prepareFile?: typeof prepareStudioAsset
  prepareTake?: typeof prepareStudioSource
  /** Told once an import that missed its chosen lane is saved. */
  onMissedLane?(miss: StudioMissedLane): void
}

function sameAudio(a: StudioAsset, b: StudioAsset): boolean {
  return (
    a.sha256 === b.sha256 &&
    a.canonicalPcmSha256 === b.canonicalPcmSha256 &&
    a.preparation.algorithmVersion === b.preparation.algorithmVersion
  )
}

const SONG_FULL =
  'This project has reached its local audio limit. Add this take to another project.'
/** The way out when only removed takes stand in the way: a copy takes only the takes in use. */
const REMOVED_TAKES_FULL =
  "Takes you removed still count toward this song's audio limit. Make a copy, which keeps only the takes in use, and add this take there."

function retainNewAudio(
  data: StudioAssetData,
  known: readonly StudioAsset[],
  inUse: ReadonlySet<string>,
  retained: ReturnType<typeof createRetainedStudioAudio>,
): StudioAsset {
  const existing = known.find((asset) => sameAudio(asset, data.asset))
  if (existing !== undefined) return existing
  if (!fitsStudioProjectStorageBudget([...known, data.asset])) {
    const playing = known.filter((asset) => inUse.has(asset.id))
    throw new Error(
      fitsStudioProjectStorageBudget([...playing, data.asset])
        ? REMOVED_TAKES_FULL
        : SONG_FULL,
    )
  }
  retained.retain([data])
  return data.asset
}

/** What a take recorded on a MIDI lane plays: its notes, and what they sounded as. */
export interface StudioRecordingMidi {
  /** In ticks from the take's first sample, at `tempoBpm` (take-notes.ts). */
  readonly notes: readonly StudioNote[]
  /** The song's tempo as the take was kept. */
  readonly tempoBpm: number
  readonly sound: StudioMidiSoundKind
}

/** A take recorded in the Studio, kept the way a picked file is. */
export interface StudioRecordingImport {
  /** The take as a WAV at the rate it was captured. */
  readonly wav: Blob
  /** Its name, and the name of a lane made for it. */
  readonly title: string
  /** Where its first kept sample lands. */
  readonly startFrame: number
  /** Frames before that sample: the count-in and the round trip. */
  readonly sourceInFrame: number
  /** Where the clip ends in the take: a punch's out point. Absent: the take's end. */
  readonly sourceOutFrame?: number
  /** Fades this long at both edges: a punch's in and out. */
  readonly fadeFrames?: number
  /** A loop take's whole passes, the clip on the newest (clip-passes.ts). */
  readonly passes?: StudioClipPasses
  /** A punch: it replaces what the armed lane plays under it, as tape does. */
  readonly punch?: boolean
  /** The armed lane, or null for a new one. */
  readonly trackId: string | null
  /** The take's own id for its audio, so its journal can tell it was stored. */
  readonly assetId?: string
  /** A MIDI lane's take: the notes it plays go into the song with its clip. */
  readonly midi?: StudioRecordingMidi
}

const TAKE_TOO_SHORT = 'That take was too short to keep.'

/** Whether a clip of this length starts here on the lane without overlapping one. */
function laneHasRoom(
  project: StudioProject,
  trackId: string,
  startFrame: number,
  frames: number,
): boolean {
  if (!project.tracks.some((track) => track.id === trackId)) return false
  return project.clips.every(
    (clip) =>
      clip.trackId !== trackId ||
      clip.startFrame + clip.sourceOutFrame - clip.sourceInFrame <=
        startFrame ||
      startFrame + frames <= clip.startFrame,
  )
}

type ImportEntry = {
  item: ImportItem
  asset: StudioAsset
  /** A MIDI take's clip: the sequence it plays, added in the same edit. */
  midi?: StudioClipMidi
}

/**
 * A MIDI take's sequence over its whole stored audio, and its clip's key
 * of it: the audio recorded live is its first render, so nothing renders
 * until its notes are edited (midi/render-key.ts).
 */
function midiEntry(
  entry: ImportEntry,
  createId: () => string,
): { entry: ImportEntry; edit?: StudioEdit } {
  const take = entry.item.midi
  if (take === undefined) return { entry }
  const sequence = studioTakeSequence({
    id: createId(),
    notes: take.notes,
    tempoBpm: take.tempoBpm,
    frames: entry.asset.normalizedFrameCount,
  })
  const renderKey = studioMidiRenderKey(sequence, take.sound)
  return {
    entry: { ...entry, midi: { sequenceId: sequence.id, renderKey } },
    edit: { type: 'add-sequence', sequence },
  }
}

/** A clip's source frames, fades and passes: the item's trim, inside its audio. */
function clipSource({ item, asset }: ImportEntry) {
  const audio = asset.normalizedFrameCount
  // A loop take keeps the passes its decoded audio holds whole.
  const fitted =
    item.passes &&
    studioFitPasses(
      { sourceInFrame: item.sourceInFrame ?? 0 },
      item.passes,
      audio,
    )
  const sourceInFrame = fitted?.sourceInFrame ?? item.sourceInFrame ?? 0
  const sourceOutFrame =
    fitted?.sourceOutFrame ?? Math.min(item.sourceOutFrame ?? Infinity, audio)
  const fade = Math.min(
    item.fadeFrames ?? 0,
    Math.floor((sourceOutFrame - sourceInFrame) / 2),
  )
  const fades =
    fade > 0
      ? {
          curve: 'linear-amplitude' as const,
          in: {
            fromSourceFrame: sourceInFrame,
            toSourceFrame: sourceInFrame + fade,
          },
          out: {
            fromSourceFrame: sourceOutFrame - fade,
            toSourceFrame: sourceOutFrame,
          },
        }
      : { curve: 'linear-amplitude' as const }
  return {
    sourceInFrame,
    sourceOutFrame,
    fades,
    ...(fitted?.passes && { passes: fitted.passes }),
  }
}

function importCommands(
  items: readonly ImportEntry[],
  project: StudioProject,
  startFrame: number,
  createId: () => string,
  targetTrackId: string | null,
): StudioEdit[] {
  const firstOrder =
    Math.max(-1, ...project.tracks.map((track) => track.order)) + 1
  const first = items.length > 0 ? clipSource(items[0]) : undefined
  // The first item lands on the chosen lane when it fits; the rest, or an item
  // that would overlap a clip there, get lanes of their own. A punch takes
  // its stretch of the lane over instead (punch-commands.ts).
  const punch = items[0]?.item.punch === true
  const target =
    targetTrackId !== null &&
    first !== undefined &&
    (punch
      ? project.tracks.some((track) => track.id === targetTrackId)
      : laneHasRoom(
          project,
          targetTrackId,
          startFrame,
          first.sourceOutFrame - first.sourceInFrame,
        ))
      ? targetTrackId
      : null
  let order = firstOrder
  return items.map((entry, index): StudioEdit => {
    const { item, asset } = entry
    const clip = (trackId: string) => ({
      id: createId(),
      trackId,
      assetId: asset.id,
      startFrame,
      ...clipSource(entry),
      gainDb: 0,
      ...(entry.midi && { midi: entry.midi }),
    })
    if (index === 0 && target !== null)
      return punch
        ? {
            type: 'punch-clip',
            clip: clip(target),
            afterClipId: createId(),
            fadeFrames: item.fadeFrames ?? 0,
          }
        : { type: 'add-clip', clip: clip(target) }
    const track = createStudioTrack({
      id: createId(),
      name: item.title,
      order: order++,
      role: item.role,
    })
    return { type: 'add-audio', track, clip: clip(track.id) }
  })
}

export function createStudioImporter(options: ImportControllerOptions) {
  let active: AbortController | null = null
  let cancels = 0

  /** Stops the import in flight; `queued` also drops the imports waiting their turn. */
  function stop(queued: boolean): void {
    if (queued) cancels++
    active?.abort()
    active = null
    options.setImporting(false)
  }
  const cancelImport = () => stop(true)

  // A file picked while the last import is still saving waits its turn; it
  // used to be dropped without a word.
  let turn: Promise<unknown> = Promise.resolve()

  function importItems(
    items: readonly ImportItem[],
    startFrame: number,
    trackId: string | null,
  ): Promise<boolean> {
    // A queued file belongs to the song it was picked for, and Cancel drops it.
    const epoch = options.epoch()
    const cancelled = cancels
    const run =
      active === null
        ? importNow(items, startFrame, trackId)
        : turn.then(() =>
            epoch === options.epoch() && cancelled === cancels
              ? importNow(items, startFrame, trackId)
              : false,
          )
    turn = run.catch(() => undefined)
    return run
  }

  async function importNow(
    items: readonly ImportItem[],
    startFrame: number,
    trackId: string | null,
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
        const adding = retained.values().map((value) => value.asset)
        const known = [...options.assets(), ...adding]
        // The takes the song plays, and the ones this import is adding.
        const inUse = new Set([
          ...(options.project()?.clips ?? []).map((clip) => clip.assetId),
          ...adding.map((asset) => asset.id),
        ])
        selected.push({
          item,
          asset: retainNewAudio(data, known, inUse, retained),
        })
      }
      const currentProject = options.project()
      if (currentProject === null || !options.current(epoch)) return false
      // A MIDI take's sequence is added in the edit that adds its clip, so
      // one undo takes both away.
      const played = selected.map((entry) => midiEntry(entry, options.createId))
      const commands = importCommands(
        played.map((each) => each.entry),
        currentProject,
        startFrame,
        options.createId,
        trackId,
      )
      const edits = [
        ...played.flatMap((each) => (each.edit ? [each.edit] : [])),
        ...commands,
      ]
      const prepared = retained.values()
      // Transfer admission synchronously to the queue. No allocation or await
      // intervenes; if staging fails, these results are discarded by this scope.
      retained.clear()
      const committed = options.commit(
        edits.length === 1 ? edits[0] : { type: 'batch', commands: edits },
        prepared,
        options.report,
      )
      await options.flush()
      const landed = committed && options.current(epoch)
      const chosen = currentProject.tracks.find((track) => track.id === trackId)
      if (landed && chosen !== undefined && commands[0].type === 'add-audio')
        options.onMissedLane?.({
          trackId: chosen.id,
          trackName: chosen.name,
          startFrame,
          newLanes: commands.length,
        })
      return landed
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

  /** `trackId` is the lane to add to; without room there, a new lane. */
  async function addFiles(
    files: readonly File[],
    startFrame = 0,
    trackId: string | null = null,
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
      trackId,
    )
  }
  const addFile = (file: File, startFrame = 0, trackId: string | null = null) =>
    addFiles([file], startFrame, trackId)

  async function addTakes(
    entries: readonly StudioSourceEntry[],
    startFrame = 0,
    trackId: string | null = null,
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
      trackId,
    )
  }

  /** A take recorded here: prepared as a picked WAV is, trimmed by its count-in and round trip. */
  function addRecording(take: StudioRecordingImport): Promise<boolean> {
    const importedAt = options.now().toISOString()
    return importItems(
      [
        {
          title: take.title,
          role: 'voice',
          sourceInFrame: take.sourceInFrame,
          sourceOutFrame: take.sourceOutFrame,
          fadeFrames: take.fadeFrames,
          passes: take.passes,
          punch: take.punch,
          midi: take.midi,
          prepare: async (id, projectId, signal) => {
            const data = await (options.prepareFile ?? prepareStudioAsset)(
              take.wav,
              {
                id: take.assetId ?? id,
                projectId,
                originalName: studioTakeFileName(take.title),
                provenance: { kind: 'recording', importedAt },
              },
              { signal },
            )
            if (
              !Number.isSafeInteger(take.sourceInFrame) ||
              take.sourceInFrame < 0 ||
              take.sourceInFrame >= data.asset.normalizedFrameCount
            )
              throw new Error(TAKE_TOO_SHORT)
            return data
          },
        },
      ],
      take.startFrame,
      take.trackId,
    )
  }

  return {
    addFile,
    addFiles,
    addRecording,
    addTakes,
    addTake: (
      entry: StudioSourceEntry,
      startFrame = 0,
      trackId: string | null = null,
    ) => addTakes([entry], startFrame, trackId),
    cancelImport,
    /** Stops only the import in flight: one queued behind it, a take included, still runs. */
    cancelCurrentImport: () => stop(false),
  }
}
