// ============================================================
// Piano Night music source tests — lazy catalogue and durable MIDI outcomes
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { LegacyPianoMigrationResult, PianoLibraryResult, } from '@/db/services/piano-library-service'
import type { PianoComposition, PianoCompositionLibraryResult, } from '@/features/piano-project/piano-composition-stage'
import type { PianoProject } from '@/features/piano-project/piano-project'
import { PIANO_NIGHT_DEMO_PROJECT } from './piano-night-demo-project'
import type { PianoNightMusicSourceDependencies } from './piano-night-music-source'
import { createPianoNightMusicSource } from './piano-night-music-source'

const TEST_STORAGE = {
  getItem: () => null,
} as unknown as Storage

const ABSENT_MIGRATION: LegacyPianoMigrationResult = {
  status: 'absent',
  imported: 0,
  alreadyPresent: 0,
  skippedRows: 0,
  duplicateRows: 0,
  fallbackProjects: [],
  quotaExceeded: false,
}

const ABSENT_COMPOSITIONS: PianoCompositionLibraryResult = {
  status: 'absent',
  compositions: [],
  skippedRows: 0,
  skippedItems: 0,
}

function legacyProject(id: string, sourceHash: string): PianoProject {
  return {
    ...PIANO_NIGHT_DEMO_PROJECT,
    id,
    name: id,
    source: {
      kind: 'legacy-midi',
      storageKey: 'legacy-midi-library',
      sourceHash,
      ticksPerQuarter: 480,
    },
  }
}

function composition(id: string): PianoComposition {
  return {
    id,
    name: id,
    bpm: 96,
    notes: [
      {
        id: `${id}:note`,
        midi: 60,
        startBeat: 0,
        duration: 1,
        velocity: 0.75,
      },
    ],
  }
}

function dependencies(
  overrides: Partial<PianoNightMusicSourceDependencies> = {},
): PianoNightMusicSourceDependencies {
  return {
    migrateLegacyProjects: async () => ABSENT_MIGRATION,
    listProjects: async () => ({ ok: true, value: [] }),
    readCompositions: () => ABSENT_COMPOSITIONS,
    importProject: async () => legacyProject('imported', 'imported-hash'),
    saveProject: async (project) => ({ ok: true, value: project }),
    updateProjectSelection: async (_id, scoreTrackId, backingTrackIds) => ({
      ok: true,
      value: {
        ...legacyProject('updated', 'updated-hash'),
        scoreTrackId,
        backingTrackIds: [...backingTrackIds],
      },
    }),
    ...overrides,
  }
}

function codedError(code: string): Error & { code: string } {
  return Object.assign(new Error(`private parser detail for ${code}`), {
    name: 'PianoProjectImportError',
    code,
  })
}

describe('Piano Night music catalogue', () => {
  it('migrates before listing canonical projects and includes compositions', async () => {
    const calls: string[] = []
    const saved = legacyProject('saved', 'saved-hash')
    const source = createPianoNightMusicSource(
      dependencies({
        migrateLegacyProjects: async () => {
          calls.push('migrate')
          return { ...ABSENT_MIGRATION, status: 'complete', imported: 1 }
        },
        listProjects: async () => {
          calls.push('list')
          return { ok: true, value: [saved] }
        },
        readCompositions: () => {
          calls.push('compositions')
          return {
            status: 'ready',
            compositions: [composition('local-study')],
            skippedRows: 0,
            skippedItems: 0,
          }
        },
      }),
    )

    const result = await source.loadCatalog({ storage: TEST_STORAGE })

    expect(calls).toEqual(['migrate', 'list', 'compositions'])
    expect(result).toMatchObject({ ok: true, status: 'ready' })
    expect(result.value.projects).toEqual([
      { project: saved, persistence: 'saved' },
    ])
    expect(result.value.compositions.map((item) => item.id)).toEqual([
      'local-study',
    ])
    expect(result.value.issues).toEqual([])
  })

  it('distinguishes a healthy empty catalogue from unavailable sources', async () => {
    const source = createPianoNightMusicSource(dependencies())

    const result = await source.loadCatalog({ storage: TEST_STORAGE })

    expect(result).toMatchObject({ ok: true, status: 'empty' })
    expect(result.value).toMatchObject({
      projects: [],
      compositions: [],
      issues: [],
      sourceStatus: {
        migration: 'absent',
        projects: 'ready',
        compositions: 'absent',
      },
    })
  })

  it('dedupes load-only fallbacks by id and source hash', async () => {
    const saved = legacyProject('saved', 'same-content')
    const sameSource = legacyProject('fallback-copy', 'same-content')
    const fallback = legacyProject('fallback', 'fallback-content')
    const duplicateFallback = legacyProject(
      'fallback-duplicate',
      'fallback-content',
    )
    const source = createPianoNightMusicSource(
      dependencies({
        migrateLegacyProjects: async () => ({
          ...ABSENT_MIGRATION,
          status: 'failed',
          fallbackProjects: [sameSource, fallback, duplicateFallback],
        }),
        listProjects: async () => ({ ok: true, value: [saved] }),
      }),
    )

    const result = await source.loadCatalog({ storage: TEST_STORAGE })

    expect(result).toMatchObject({ ok: true, status: 'partial' })
    expect(result.value.projects).toEqual([
      { project: saved, persistence: 'saved' },
      { project: fallback, persistence: 'session-only' },
    ])
    expect(result.value.issues.map((item) => item.code)).toContain(
      'legacy-migration-failed',
    )
  })

  it('reports skipped project, migration, and composition data as partial', async () => {
    const source = createPianoNightMusicSource(
      dependencies({
        migrateLegacyProjects: async () => ({
          ...ABSENT_MIGRATION,
          status: 'complete-with-skips',
          skippedRows: 2,
          duplicateRows: 1,
        }),
        listProjects: async () => ({
          ok: true,
          value: [],
          skippedRecords: 3,
        }),
        readCompositions: () => ({
          status: 'ready',
          compositions: [composition('partially-recovered')],
          skippedRows: 4,
          skippedItems: 5,
        }),
      }),
    )

    const result = await source.loadCatalog({ storage: TEST_STORAGE })

    expect(result).toMatchObject({ ok: true, status: 'partial' })
    expect(result.value.skipped).toEqual({
      projectRecords: 3,
      legacyRows: 2,
      legacyDuplicates: 1,
      compositionRows: 4,
      compositionNotes: 5,
    })
    expect(result.value.issues.map((item) => item.code)).toEqual([
      'legacy-rows-skipped',
      'legacy-duplicates-skipped',
      'project-records-skipped',
      'composition-rows-skipped',
      'composition-notes-skipped',
    ])
  })

  it('returns a stable failure when every primary library read is unavailable', async () => {
    const source = createPianoNightMusicSource(
      dependencies({
        migrateLegacyProjects: async () => {
          throw new Error('private migration failure')
        },
        listProjects: async () => {
          throw new Error('private IndexedDB failure')
        },
        readCompositions: () => {
          throw new Error('private localStorage failure')
        },
      }),
    )

    const result = await source.loadCatalog({ storage: TEST_STORAGE })

    expect(result).toMatchObject({
      ok: false,
      status: 'unavailable',
      code: 'music-library-unavailable',
      message: 'Your Piano music library could not be read on this device.',
    })
    expect(result.value.projects).toEqual([])
    expect(JSON.stringify(result)).not.toContain('private')
  })
})

describe('Piano Night MIDI import', () => {
  it('returns the canonical saved project only after durable persistence', async () => {
    const parsed = legacyProject('parsed', 'parsed-hash')
    const saved = { ...parsed, name: 'Saved name' }
    const calls: string[] = []
    const source = createPianoNightMusicSource(
      dependencies({
        importProject: async () => {
          calls.push('import')
          return parsed
        },
        saveProject: async (project) => {
          calls.push(`save:${project.id}`)
          return { ok: true, value: saved }
        },
      }),
    )

    const result = await source.importMidi(
      new File(['midi'], 'study.mid', { type: 'audio/midi' }),
    )

    expect(calls).toEqual(['import', 'save:parsed'])
    expect(result).toEqual({ ok: true, project: saved })
  })

  it('does not parse or save when the request is already cancelled', async () => {
    const importProject = vi.fn()
    const saveProject = vi.fn()
    const abortController = new AbortController()
    abortController.abort()
    const source = createPianoNightMusicSource(
      dependencies({ importProject, saveProject }),
    )

    const result = await source.importMidi(new File([], 'cancelled.mid'), {
      signal: abortController.signal,
    })

    expect(result).toEqual({
      ok: false,
      code: 'cancelled',
      message: 'MIDI import was cancelled.',
    })
    expect(importProject).not.toHaveBeenCalled()
    expect(saveProject).not.toHaveBeenCalled()
  })

  it('does not persist a project when cancellation wins after parsing', async () => {
    const abortController = new AbortController()
    const saveProject = vi.fn()
    const source = createPianoNightMusicSource(
      dependencies({
        importProject: async () => {
          abortController.abort()
          return legacyProject('cancelled', 'cancelled-hash')
        },
        saveProject,
      }),
    )

    const result = await source.importMidi(new File([], 'cancelled.mid'), {
      signal: abortController.signal,
    })

    expect(result).toMatchObject({ ok: false, code: 'cancelled' })
    expect(saveProject).not.toHaveBeenCalled()
  })

  it.each([
    ['NO_NOTES', 'no-notes'],
    ['FILE_TOO_LARGE', 'file-too-large'],
    ['UNSUPPORTED_FORMAT', 'unsupported-format'],
    ['UNSUPPORTED_TIME_DIVISION', 'unsupported-timing'],
    ['TOO_MANY_EVENTS', 'too-complex'],
    ['TIMED_OUT', 'timed-out'],
    ['WORKER_FAILED', 'worker-unavailable'],
    ['INVALID_HEADER', 'invalid-midi'],
    ['UNKNOWN_PRIVATE_CODE', 'invalid-midi'],
  ] as const)(
    'maps parser failure %s to stable code %s',
    async (rawCode, code) => {
      const source = createPianoNightMusicSource(
        dependencies({
          importProject: async () => Promise.reject(codedError(rawCode)),
        }),
      )

      const result = await source.importMidi(new File([], 'broken.mid'))

      expect(result).toMatchObject({ ok: false, code })
      expect(JSON.stringify(result)).not.toContain('private parser detail')
    },
  )

  it('maps AbortError without exposing its raw message', async () => {
    const source = createPianoNightMusicSource(
      dependencies({
        importProject: async () =>
          Promise.reject(
            new DOMException('private abort detail', 'AbortError'),
          ),
      }),
    )

    const result = await source.importMidi(new File([], 'cancelled.mid'))

    expect(result).toEqual({
      ok: false,
      code: 'cancelled',
      message: 'MIDI import was cancelled.',
    })
  })

  it.each([
    ['quota-exceeded', 'storage-full'],
    ['invalid-project', 'invalid-project'],
    ['storage-unavailable', 'storage-unavailable'],
    ['not-found', 'storage-unavailable'],
  ] as const)(
    'maps save failure %s to stable code %s',
    async (rawCode, code) => {
      const source = createPianoNightMusicSource(
        dependencies({
          saveProject: async () =>
            ({
              ok: false,
              code: rawCode,
            }) satisfies PianoLibraryResult<PianoProject>,
        }),
      )

      const result = await source.importMidi(new File([], 'unsaved.mid'))

      expect(result).toMatchObject({ ok: false, code })
    },
  )
})

describe('Piano Night track selection', () => {
  it('persists canonical track ids and returns the updated project', async () => {
    const updated = legacyProject('saved-project', 'saved-hash')
    const updateProjectSelection = vi.fn(
      async (): Promise<PianoLibraryResult<PianoProject>> => ({
        ok: true,
        value: updated,
      }),
    )
    const source = createPianoNightMusicSource(
      dependencies({ updateProjectSelection }),
    )

    const result = await source.updateProjectSelection(
      'saved-project',
      'afterglow-grand',
      [],
    )

    expect(updateProjectSelection).toHaveBeenCalledWith(
      'saved-project',
      'afterglow-grand',
      [],
    )
    expect(result).toEqual({ ok: true, project: updated })
  })

  it.each([
    ['invalid-project', 'invalid-selection'],
    ['not-found', 'project-not-found'],
    ['quota-exceeded', 'storage-full'],
    ['storage-unavailable', 'storage-unavailable'],
  ] as const)(
    'maps selection failure %s to stable code %s',
    async (rawCode, code) => {
      const source = createPianoNightMusicSource(
        dependencies({
          updateProjectSelection: async () => ({
            ok: false,
            code: rawCode,
          }),
        }),
      )

      const result = await source.updateProjectSelection(
        'saved-project',
        'afterglow-grand',
        [],
      )

      expect(result).toMatchObject({ ok: false, code })
    },
  )

  it('contains a thrown storage error behind a stable failure', async () => {
    const source = createPianoNightMusicSource(
      dependencies({
        updateProjectSelection: async () => {
          throw new Error('private IndexedDB detail')
        },
      }),
    )

    const result = await source.updateProjectSelection(
      'saved-project',
      'afterglow-grand',
      [],
    )

    expect(result).toMatchObject({
      ok: false,
      code: 'storage-unavailable',
    })
    expect(JSON.stringify(result)).not.toContain('private')
  })
})
