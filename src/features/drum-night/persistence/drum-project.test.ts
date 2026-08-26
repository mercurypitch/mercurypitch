// Drum project persistence tests — compact round trips and strict boundaries.

import { describe, expect, it } from 'vitest'
import { applyDrumGrooveCommand, createEditableDrumGroove, } from '@/features/drum-night/groove/groove-editor'
import type { FirstPocketVariantId } from '@/features/drum-night/session/prepared-grooves'
import { createFirstPocketGroove, FIRST_POCKET_VARIANTS, } from '@/features/drum-night/session/prepared-grooves'
import type { DrumProject, DrumProjectSerializationInput } from './drum-project'
import { DRUM_PROJECT_MAX_BYTES, drumProjectContentFingerprint, hydrateDrumProject, serializeDrumProject, validateDrumProject, } from './drum-project'

function projectInput(
  overrides: Partial<DrumProjectSerializationInput> = {},
): DrumProjectSerializationInput {
  const drafts = Object.fromEntries(
    FIRST_POCKET_VARIANTS.map((variant) => [
      variant.id,
      createEditableDrumGroove(createFirstPocketGroove(variant.id).document),
    ]),
  ) as Record<FirstPocketVariantId, ReturnType<typeof createEditableDrumGroove>>
  return {
    id: 'project-1',
    title: 'Night pocket',
    revision: 0,
    createdAt: '2026-08-26T10:00:00.000Z',
    updatedAt: '2026-08-26T10:00:00.000Z',
    selectedVariantId: 'source',
    drafts,
    authoredFamilyMix: {
      kick: { level: 1, muted: false },
      snare: { level: 0.8, muted: false },
      hats: { level: 0.7, muted: false },
      toms: { level: 0.6, muted: true },
      cymbals: { level: 0.5, muted: false },
    },
    tempoBpm: 84,
    countInBeats: 4,
    clickEnabled: true,
    loopRange: { startBeat: 0.5, endBeat: 4.5 },
    ...overrides,
  }
}

function mutableProject(project: DrumProject): Record<string, unknown> {
  return JSON.parse(JSON.stringify(project)) as Record<string, unknown>
}

describe('Drum project persistence', () => {
  it('round-trips all four drafts without runtime-only editor state', () => {
    const input = projectInput()
    const source = input.drafts.source
    const firstSourceHit = source.hits[0]!
    const moved = applyDrumGrooveCommand(source, {
      type: 'move-hit',
      hitId: firstSourceHit.id,
      stepIndex: firstSourceHit.stepIndex + 1,
    }).state
    const withEditorHit = applyDrumGrooveCommand(moved, {
      type: 'add-hit',
      gmKey: 39,
      stepIndex: 3,
    }).state
    const project = serializeDrumProject({
      ...input,
      drafts: { ...input.drafts, source: withEditorHit },
    })

    const json = JSON.stringify(project)
    expect(json).not.toContain('undoHistory')
    expect(json).not.toContain('sourceEvidence')
    expect(json).not.toContain('canonicalHit')
    expect(json).not.toContain('selectedHit')
    expect(Object.keys(project.variants)).toEqual([
      'source',
      'tight',
      'loose',
      'half-time',
    ])

    const hydrated = hydrateDrumProject(project)
    expect(hydrated.drafts.source.hits).toMatchObject(
      withEditorHit.hits.map((hit) => ({
        id: hit.id,
        gmKey: hit.gmKey,
        stepIndex: hit.stepIndex,
        offsetBeats: hit.offsetBeats,
      })),
    )
    expect(hydrated.drafts.source.undoHistory).toEqual([])
    expect(hydrated.drafts.source.undoDepth).toBe(0)
    const restoredSource = hydrated.drafts.source.hits.find(
      (hit) => hit.id === firstSourceHit.id,
    )
    expect(restoredSource?.origin.kind).toBe('source')
    if (restoredSource?.origin.kind !== 'source') {
      throw new Error('source evidence was not restored')
    }
    expect(restoredSource.origin.canonicalHit).toEqual(
      firstSourceHit.origin.kind === 'source'
        ? firstSourceHit.origin.canonicalHit
        : undefined,
    )
  })

  it('uses a metadata-independent deterministic content fingerprint', () => {
    const project = serializeDrumProject(projectInput())
    const renamed = validateDrumProject({
      ...project,
      id: 'another-id',
      title: 'Renamed',
      revision: 12,
      createdAt: '2026-08-27T10:00:00.000Z',
      updatedAt: '2026-08-27T10:00:00.000Z',
    })
    const source = project.variants.source
    const editMetadataChanged = validateDrumProject({
      ...project,
      variants: {
        ...project.variants,
        source: {
          ...source,
          revision: source.revision + 1,
          nextCreatedOrdinal: source.nextCreatedOrdinal + 1,
        },
      },
    })
    const changed = validateDrumProject({ ...project, tempoBpm: 85 })

    expect(drumProjectContentFingerprint(project)).toMatch(
      /^drum-v1-[a-f\d]{16}$/,
    )
    expect(drumProjectContentFingerprint(renamed)).toBe(
      drumProjectContentFingerprint(project),
    )
    expect(drumProjectContentFingerprint(editMetadataChanged)).toBe(
      drumProjectContentFingerprint(project),
    )
    expect(drumProjectContentFingerprint(changed)).not.toBe(
      drumProjectContentFingerprint(project),
    )
  })

  it('counts project titles in Unicode code points and requires exact trim', () => {
    const astralCodePoint = String.fromCodePoint(0x1f941)
    expect(() =>
      serializeDrumProject(projectInput({ title: 'a'.repeat(80) })),
    ).not.toThrow()
    expect(() =>
      serializeDrumProject(projectInput({ title: astralCodePoint.repeat(80) })),
    ).not.toThrow()
    expect(() =>
      serializeDrumProject(projectInput({ title: astralCodePoint.repeat(81) })),
    ).toThrow(/Invalid Drum Night project/)
    expect(() =>
      serializeDrumProject(projectInput({ title: ' Pocket ' })),
    ).toThrow(/Invalid Drum Night project/)
  })

  it('rejects future, privacy-unsafe, and structurally partial payloads', () => {
    const project = serializeDrumProject(projectInput())
    expect(() =>
      validateDrumProject({ ...project, schemaVersion: 2 }),
    ).toThrow()
    expect(() =>
      validateDrumProject({ ...project, midiDeviceId: 'private-device' }),
    ).toThrow()

    const partial = mutableProject(project)
    const variants = partial.variants as Record<string, unknown>
    delete variants.tight
    expect(() => validateDrumProject(partial)).toThrow()
  })

  it('rejects rows beyond 256 KiB and variants beyond 256 hits', () => {
    const project = serializeDrumProject(projectInput())
    const oversized = {
      ...project,
      padding: 'x'.repeat(DRUM_PROJECT_MAX_BYTES),
    }
    expect(
      new TextEncoder().encode(JSON.stringify(oversized)).byteLength,
    ).toBeGreaterThan(DRUM_PROJECT_MAX_BYTES)
    expect(() => validateDrumProject(oversized)).toThrow()

    const tooManyHits = mutableProject(project)
    const variants = tooManyHits.variants as Record<
      string,
      Record<string, unknown>
    >
    const source = variants.source!
    const hits = source.hits as unknown[]
    source.hits = Array.from({ length: 257 }, () => hits[0])
    expect(() => validateDrumProject(tooManyHits)).toThrow()
  })

  it('rejects unsnapped/out-of-range loops and catalogue-forged source hits', () => {
    const project = serializeDrumProject(projectInput())
    expect(() =>
      validateDrumProject({
        ...project,
        loopRange: { startBeat: 0.1, endBeat: 2 },
      }),
    ).toThrow()
    expect(() =>
      validateDrumProject({
        ...project,
        loopRange: { startBeat: 0, endBeat: 8.25 },
      }),
    ).toThrow()

    const forged = mutableProject(project)
    const variants = forged.variants as Record<string, Record<string, unknown>>
    const source = variants.source!
    const hits = source.hits as Array<Record<string, unknown>>
    hits[0] = { ...hits[0], gmKey: 81 }
    expect(() => validateDrumProject(forged)).toThrow()
  })
})
