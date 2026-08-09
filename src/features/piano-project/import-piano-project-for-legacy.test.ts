// ============================================================
// Legacy Piano project import bridge tests — canonical save precedes handoff
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { PianoProject } from '@/features/piano-project/piano-project'
import type { LegacyPianoProjectImportDependencies, LegacyPianoSelectionPersistenceDependencies, } from './import-piano-project-for-legacy'
import { importPianoProjectForLegacy, persistPianoCompatibilitySelection, pianoProjectToLegacySavedMidiSong, } from './import-piano-project-for-legacy'

function projectFixture(options?: { percussionOnly?: boolean }): PianoProject {
  const createdAt = '2026-08-09T20:00:00.000Z'
  const percussion = options?.percussionOnly === true
  return {
    schemaVersion: 1,
    id: 'piano-project-1',
    name: 'Canonical Study',
    createdAt,
    updatedAt: createdAt,
    source: {
      kind: 'midi',
      fileName: 'study.mid',
      byteLength: 128,
      sha256: 'a'.repeat(64),
      format: 1,
      ticksPerQuarter: 480,
    },
    durationTicks: 960,
    tempoMap: [
      {
        sourceTrackIndex: 0,
        order: 0,
        tick: 0,
        microsecondsPerQuarter: 600_000,
      },
    ],
    timeSignatures: [],
    keySignatures: [],
    tracks: [
      {
        id: 'track-0-channel-0',
        sourceTrackIndex: 0,
        channel: percussion ? 9 : 0,
        isPercussion: percussion,
        name: percussion ? 'Drums' : 'Piano',
        instrumentName: percussion ? 'Kit' : 'Acoustic Grand Piano',
        events: [
          {
            type: 'note-on',
            sourceTrackIndex: 0,
            order: 0,
            tick: 240,
            channel: percussion ? 9 : 0,
            note: percussion ? 36 : 60,
            velocity: 96,
          },
          {
            type: 'note-off',
            sourceTrackIndex: 0,
            order: 1,
            tick: 720,
            channel: percussion ? 9 : 0,
            note: percussion ? 36 : 60,
            velocity: 32,
          },
        ],
      },
    ],
    scoreTrackId: percussion ? null : 'track-0-channel-0',
    backingTrackIds: [],
    metaEvents: [],
    systemEvents: [],
  }
}

function dependencies(project: PianoProject) {
  const importProject = vi.fn<
    LegacyPianoProjectImportDependencies['importProject']
  >(async () => project)
  const saveProject = vi.fn<
    LegacyPianoProjectImportDependencies['saveProject']
  >(async () => ({ ok: true as const, value: project }))
  return { importProject, saveProject }
}

describe('legacy Piano project import bridge', () => {
  it('projects ticks and expressive note data into a temporary legacy view', () => {
    const project = projectFixture()

    expect(pianoProjectToLegacySavedMidiSong(project)).toEqual({
      id: 'piano-project-1',
      name: 'Canonical Study',
      bpm: 100,
      tracks: [
        {
          id: 'track-0-channel-0',
          name: 'Piano',
          instrumentName: 'Acoustic Grand Piano',
          noteCount: 1,
          notes: [
            {
              midi: 60,
              startBeat: 0.5,
              duration: 1,
              velocity: 96,
              releaseVelocity: 32,
            },
          ],
        },
      ],
      persistenceAuthority: 'piano-project',
      scoreTrackId: 'track-0-channel-0',
      backingTrackIds: [],
      importedAt: Date.parse(project.createdAt),
    })
  })

  it('persists the canonical project before returning its compatibility view', async () => {
    localStorage.clear()
    const project = projectFixture()
    const deps = dependencies(project)
    const file = new File([], 'study.mid')

    const result = await importPianoProjectForLegacy(file, {}, deps)

    expect(deps.importProject).toHaveBeenCalledWith(file, {})
    expect(deps.saveProject).toHaveBeenCalledWith(project)
    expect(result?.id).toBe(project.id)
    expect(localStorage.getItem('pitchperfect_guitar_songs')).toBeNull()
  })

  it('does not hand off or persist a percussion-only compatibility projection', async () => {
    const project = projectFixture({ percussionOnly: true })
    const deps = dependencies(project)

    await expect(
      importPianoProjectForLegacy(new File([], 'drums.mid'), {}, deps),
    ).resolves.toBeNull()
    expect(deps.saveProject).not.toHaveBeenCalled()
  })

  it('rejects the handoff when canonical persistence fails', async () => {
    const project = projectFixture()
    const deps = dependencies(project)
    deps.saveProject.mockResolvedValue({
      ok: false,
      code: 'quota-exceeded',
    })

    await expect(
      importPianoProjectForLegacy(new File([], 'study.mid'), {}, deps),
    ).rejects.toThrow('device storage is full')
  })

  it('persists compatibility choices to their declared authority', async () => {
    const project = projectFixture()
    const canonicalSong = pianoProjectToLegacySavedMidiSong(project)
    if (canonicalSong === null) throw new Error('fixture did not project')
    const updateProjectSelection = vi.fn<
      LegacyPianoSelectionPersistenceDependencies['updateProjectSelection']
    >(async () => ({ ok: true, value: project }))
    const updateLegacySelection =
      vi.fn<
        LegacyPianoSelectionPersistenceDependencies['updateLegacySelection']
      >()
    const selectionDependencies = {
      updateProjectSelection,
      updateLegacySelection,
    }

    await persistPianoCompatibilitySelection(
      {
        ...canonicalSong,
        scoreTrackId: 'track-0-channel-0',
        backingTrackIds: [],
      },
      selectionDependencies,
    )
    expect(updateProjectSelection).toHaveBeenCalledWith(
      project.id,
      'track-0-channel-0',
      [],
    )
    expect(updateLegacySelection).not.toHaveBeenCalled()

    const { persistenceAuthority: _authority, ...legacySong } = canonicalSong
    await persistPianoCompatibilitySelection(legacySong, selectionDependencies)
    expect(updateLegacySelection).toHaveBeenCalledWith(
      legacySong.id,
      legacySong.scoreTrackId,
      legacySong.backingTrackIds,
    )
  })

  it('never falls back to legacy storage when canonical selection persistence fails', async () => {
    const project = projectFixture()
    const canonicalSong = pianoProjectToLegacySavedMidiSong(project)
    if (canonicalSong === null) throw new Error('fixture did not project')
    const updateLegacySelection = vi.fn()

    await expect(
      persistPianoCompatibilitySelection(canonicalSong, {
        updateProjectSelection: vi.fn(async () => ({
          ok: false as const,
          code: 'not-found' as const,
        })),
        updateLegacySelection,
      }),
    ).rejects.toThrow('could not be saved')
    expect(updateLegacySelection).not.toHaveBeenCalled()
  })

  it('threads cancellation to the Worker importer and skips persistence', async () => {
    const project = projectFixture()
    const deps = dependencies(project)
    const abortController = new AbortController()
    deps.importProject.mockImplementation(async (_file, options) => {
      abortController.abort()
      expect(options?.signal).toBe(abortController.signal)
      return project
    })

    await expect(
      importPianoProjectForLegacy(
        new File([], 'study.mid'),
        { signal: abortController.signal },
        deps,
      ),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(deps.saveProject).not.toHaveBeenCalled()
  })

  it('does not hand off when cancellation arrives during persistence', async () => {
    const project = projectFixture()
    const deps = dependencies(project)
    const abortController = new AbortController()
    deps.saveProject.mockImplementation(async () => {
      abortController.abort()
      return { ok: true, value: project }
    })

    await expect(
      importPianoProjectForLegacy(
        new File([], 'study.mid'),
        { signal: abortController.signal },
        deps,
      ),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(deps.saveProject).toHaveBeenCalledWith(project)
  })
})
