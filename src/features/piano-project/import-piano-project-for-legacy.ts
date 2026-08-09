// ============================================================
// Legacy Piano project import bridge — canonical persistence, temporary DTO
// ============================================================
//
// This module is reached only through PianoPage's explicit import gesture.
// The Worker result remains the persisted authority; the SavedMidiSong shape
// exists only long enough to feed the proven Falling Notes controller.

import { savePianoProject, updatePianoProjectSelection, } from '@/db/services/piano-library-service'
import type { PianoProject } from '@/features/piano-project/piano-project'
import { importPianoProject } from '@/features/piano-project/piano-project-import-client'
import { projectToMidiSong } from '@/features/piano-project/project-to-midi-song'
import type { SavedMidiSong } from '@/stores/saved-midi-songs-store'
import { updateMidiSongSelection } from '@/stores/saved-midi-songs-store'

export interface LegacyPianoProjectImportDependencies {
  importProject: typeof importPianoProject
  saveProject: typeof savePianoProject
}

export interface LegacyPianoProjectImportOptions {
  signal?: AbortSignal
}

export interface LegacyPianoSelectionPersistenceDependencies {
  updateProjectSelection: typeof updatePianoProjectSelection
  updateLegacySelection: typeof updateMidiSongSelection
}

const DEFAULT_DEPENDENCIES: LegacyPianoProjectImportDependencies = {
  importProject: importPianoProject,
  saveProject: savePianoProject,
}

const DEFAULT_SELECTION_DEPENDENCIES: LegacyPianoSelectionPersistenceDependencies =
  {
    updateProjectSelection: updatePianoProjectSelection,
    updateLegacySelection: updateMidiSongSelection,
  }

function persistenceFailureMessage(
  code:
    | 'invalid-project'
    | 'not-found'
    | 'quota-exceeded'
    | 'storage-unavailable',
): string {
  if (code === 'invalid-project') {
    return 'The imported Piano project failed validation and was not saved.'
  }
  if (code === 'quota-exceeded') {
    return 'The Piano project was not saved because device storage is full.'
  }
  return 'The Piano project could not be saved on this device.'
}

function throwIfImportAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw new DOMException('Piano project import was cancelled.', 'AbortError')
  }
}

/** Build the in-memory DTO consumed by the unchanged song-picker/controller. */
export function pianoProjectToLegacySavedMidiSong(
  project: PianoProject,
): SavedMidiSong | null {
  const projected = projectToMidiSong(project)
  if (projected.scoreTrackId === null || projected.tracks.length === 0) {
    return null
  }

  const importedAt = Date.parse(project.createdAt)
  if (!Number.isFinite(importedAt)) {
    throw new Error('The imported Piano project has an invalid creation time.')
  }

  return {
    id: project.id,
    name: project.name,
    bpm: projected.bpm,
    tracks: projected.tracks,
    persistenceAuthority: 'piano-project',
    scoreTrackId: projected.scoreTrackId,
    backingTrackIds: projected.backingTrackIds,
    importedAt,
  }
}

/** Import, validate and durably save before exposing a legacy load view. */
export async function importPianoProjectForLegacy(
  file: File,
  options: LegacyPianoProjectImportOptions = {},
  dependencies: LegacyPianoProjectImportDependencies = DEFAULT_DEPENDENCIES,
): Promise<SavedMidiSong | null> {
  const project = await dependencies.importProject(
    file,
    options.signal === undefined ? {} : { signal: options.signal },
  )
  const compatibilitySong = pianoProjectToLegacySavedMidiSong(project)
  if (compatibilitySong === null) return null
  throwIfImportAborted(options.signal)

  const saved = await dependencies.saveProject(project)
  if (!saved.ok) throw new Error(persistenceFailureMessage(saved.code))
  throwIfImportAborted(options.signal)

  return compatibilitySong
}

/** Persist track choices to the authority declared by the compatibility DTO. */
export async function persistPianoCompatibilitySelection(
  song: SavedMidiSong,
  dependencies: LegacyPianoSelectionPersistenceDependencies = DEFAULT_SELECTION_DEPENDENCIES,
): Promise<void> {
  if (song.persistenceAuthority !== 'piano-project') {
    dependencies.updateLegacySelection(
      song.id,
      song.scoreTrackId,
      song.backingTrackIds,
    )
    return
  }

  const updated = await dependencies.updateProjectSelection(
    song.id,
    song.scoreTrackId,
    song.backingTrackIds,
  )
  if (!updated.ok) throw new Error(persistenceFailureMessage(updated.code))
}
