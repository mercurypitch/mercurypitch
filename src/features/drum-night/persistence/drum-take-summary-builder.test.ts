// Drum take summary builder tests — scalar projection and privacy boundary.

import { describe, expect, it } from 'vitest'
import { createDrumGrooveDraftController } from '@/features/drum-night/groove'
import type { DrumKitAuthoredFamily } from '@/features/drum-night/runtime'
import { DRUM_KIT_AUTHORED_FAMILIES } from '@/features/drum-night/runtime'
import { createFirstPocketGroove, FIRST_POCKET_VARIANTS, } from '@/features/drum-night/session'
import type { DrumProjectFamilyMix } from './drum-project'
import { serializeDrumProject } from './drum-project'
import { buildDrumTakeSummary } from './drum-take-summary-builder'

function familyMix(): DrumProjectFamilyMix {
  return Object.freeze(
    Object.fromEntries(
      DRUM_KIT_AUTHORED_FAMILIES.map((family) => [
        family,
        Object.freeze({ level: 1, muted: false }),
      ]),
    ) as Record<
      DrumKitAuthoredFamily,
      { readonly level: number; readonly muted: boolean }
    >,
  )
}

function project(
  loopRange: { startBeat: number; endBeat: number } | null = null,
) {
  const controller = createDrumGrooveDraftController()
  const drafts = Object.fromEntries(
    FIRST_POCKET_VARIANTS.map((variant) => [
      variant.id,
      controller.draftFor(variant.id),
    ]),
  ) as Record<
    (typeof FIRST_POCKET_VARIANTS)[number]['id'],
    ReturnType<typeof controller.draftFor>
  >
  return serializeDrumProject({
    id: 'project-1',
    title: 'First Pocket study',
    revision: 3,
    createdAt: '2026-08-26T10:00:00.000Z',
    updatedAt: '2026-08-26T10:10:00.000Z',
    selectedVariantId: 'source',
    drafts,
    authoredFamilyMix: familyMix(),
    tempoBpm: 84,
    countInBeats: 4,
    clickEnabled: false,
    loopRange,
  })
}

function nestedKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(nestedKeys)
  if (typeof value !== 'object' || value === null) return []
  return Object.entries(value).flatMap(([key, child]) => [
    key,
    ...nestedKeys(child),
  ])
}

describe('buildDrumTakeSummary', () => {
  it('projects coaching into a validated scalar-only row', () => {
    const document = createFirstPocketGroove('source').document
    const targets = document.percussionTracks.flatMap(
      (track) => track.percussionHits,
    )
    const first = targets[0]!
    const second = targets[1]!

    const summary = buildDrumTakeSummary({
      id: 'take-1',
      completedAt: '2026-08-26T10:12:00.000Z',
      project: project(),
      document,
      capturedHits: [
        {
          id: 'capture-1',
          source: 'touch',
          beat: first.startBeat,
          gmKey: first.gmKey,
          velocity: first.velocity,
        },
        {
          id: 'capture-2',
          source: 'keyboard',
          beat: second.startBeat,
          gmKey: second.gmKey,
          velocity: second.velocity,
        },
      ],
      omittedCaptureHitCount: 2,
      tempoBpm: 84,
      speedScale: 1,
    })

    expect(summary).toMatchObject({
      schemaVersion: 1,
      projectId: 'project-1',
      projectRevision: 3,
      variationId: 'source',
      inputSources: ['keyboard', 'touch'],
      capturedHitCount: 2,
      omittedCaptureHitCount: 2,
      matchedHitCount: 2,
      evidenceScope: 'timing-and-dynamics',
    })
    expect(summary.projectFingerprint).toMatch(/^drum-v1-[a-f\d]{16}$/)
    expect(JSON.stringify(summary)).not.toContain('capture-1')
    expect(nestedKeys(summary)).not.toEqual(
      expect.arrayContaining([
        'hits',
        'matches',
        'gmKey',
        'velocity',
        'observation',
        'deviceId',
        'audio',
        'blob',
        'midiMessage',
      ]),
    )
  })

  it('rejects microphone evidence instead of silently retaining it', () => {
    const document = createFirstPocketGroove('source').document
    expect(() =>
      buildDrumTakeSummary({
        id: 'take-mic',
        completedAt: '2026-08-26T10:12:00.000Z',
        project: project(),
        document,
        capturedHits: [
          {
            id: 'mic-1',
            source: 'room-mic',
            beat: 0,
            confidence: 0.9,
            timingUncertaintyMs: 12,
          },
        ],
        omittedCaptureHitCount: 0,
        tempoBpm: 84,
        speedScale: 1,
      }),
    ).toThrow('Room-microphone evidence cannot be saved')
  })

  it('retains an omitted-only practiced range without inventing measurements', () => {
    const document = createFirstPocketGroove('source').document
    const last = document.percussionTracks
      .flatMap((track) => track.percussionHits)
      .at(-1)!
    const summary = buildDrumTakeSummary({
      id: 'take-omitted',
      completedAt: '2026-08-26T10:12:00.000Z',
      project: project({ startBeat: 0, endBeat: 0.25 }),
      document,
      capturedHits: [
        {
          id: 'outside-range',
          source: 'touch',
          beat: last.startBeat,
          gmKey: last.gmKey,
          velocity: last.velocity,
        },
      ],
      omittedCaptureHitCount: 1,
      tempoBpm: 84,
      speedScale: 1,
    })

    expect(summary).toMatchObject({
      status: 'no-captures',
      capturedHitCount: 0,
      omittedCaptureHitCount: 1,
      meanTimingOffsetMs: null,
      meanVelocityOffset: null,
    })
  })

  it('refuses imported-session evidence at the persistence boundary', () => {
    const prepared = createFirstPocketGroove('source').document
    const imported = { ...prepared, sourceFormat: 'midi' as const }
    expect(() =>
      buildDrumTakeSummary({
        id: 'take-imported',
        completedAt: '2026-08-26T10:12:00.000Z',
        project: project(),
        document: imported,
        capturedHits: [],
        omittedCaptureHitCount: 1,
        tempoBpm: 84,
        speedScale: 1,
      }),
    ).toThrow('Only prepared First Pocket takes can be saved')
  })
})
