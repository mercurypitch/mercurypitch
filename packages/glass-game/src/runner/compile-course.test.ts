// ============================================================
// Song runner compiler tests — literal timing, safety, and strict rejection.
// ============================================================

import { describe, expect, it } from 'vitest'
import { compileSongRunnerCourseDocument } from './compile-course'
import { SINGING_CURRENT, SINGING_CURRENT_CATALOG, SINGING_CURRENT_SOURCE_DOCUMENT, } from './first-course'
import type { SongRunnerCourseCatalog, SongRunnerSourceDocument, } from './source'

type Mutable<T> = T extends readonly (infer Entry)[]
  ? Mutable<Entry>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T

function sourceClone(): Mutable<SongRunnerSourceDocument> {
  return mutableJsonClone(SINGING_CURRENT_SOURCE_DOCUMENT)
}

function catalogClone(): Mutable<SongRunnerCourseCatalog> {
  return mutableJsonClone(SINGING_CURRENT_CATALOG)
}

function mutableJsonClone<T>(value: T): Mutable<T> {
  return JSON.parse(JSON.stringify(value)) as Mutable<T>
}

describe('song runner course compiler', () => {
  it('compiles the approved 160-beat timing and literal content', () => {
    expect(SINGING_CURRENT.id).toBe('the-singing-current-v1')
    expect(SINGING_CURRENT.lengthBeats).toBe(160)
    expect(SINGING_CURRENT.lengthMeters).toBe(192)
    expect(SINGING_CURRENT.laneCenters).toEqual([-2, 0, 2])
    expect(SINGING_CURRENT.groundFeetY).toBe(0)
    expect(SINGING_CURRENT.fallBelowFeetY).toBe(-3)
    expect(SINGING_CURRENT.tempoSegments[0]?.endCourseSeconds).toBeCloseTo(
      40,
      12,
    )
    expect(SINGING_CURRENT.tempoSegments[1]?.endCourseSeconds).toBeCloseTo(
      57.77777777777778,
      12,
    )
    expect(SINGING_CURRENT.lengthCourseSeconds).toBeCloseTo(
      90.88122605363984,
      12,
    )
    expect(
      SINGING_CURRENT.targets.map((target) => [
        target.notes[0]?.startBeat,
        target.notes.at(-1)?.endBeat,
      ]),
    ).toEqual([
      [8, 12],
      [32, 34],
      [40, 42],
      [52, 56],
      [68, 74],
      [100, 108],
      [120, 124],
      [148, 156],
    ])
    expect(
      SINGING_CURRENT.rewards.pickups.map((pickup) => pickup.beat),
    ).toEqual([60, 62, 114, 118])
    expect(
      SINGING_CURRENT.checkpoints.map((checkpoint) => checkpoint.beat),
    ).toEqual([0, 64, 96])
    expect(SINGING_CURRENT.chunks).toHaveLength(10)
    expect(
      new Set(SINGING_CURRENT.targets.map((target) => target.glassProfileId)),
    ).toEqual(new Set(['runner-score-window-v1']))
    expect(SINGING_CURRENT.preloadAssetProfileIds).toContain(
      'cloudway-lab-frost-gold-arch-v1',
    )
    expect(SINGING_CURRENT.preloadAssetProfileIds).toContain(
      'museum-environment-v2',
    )
    expect(SINGING_CURRENT.preloadAssetProfileIds).not.toContain(
      'cloudway-platform-kit-v1',
    )
    expect(SINGING_CURRENT.preloadAssetProfileIds).not.toContain(
      'cloudway-lab-frosted-scroll-wall-v1',
    )
    expect(SINGING_CURRENT.preloadAssetProfileIds).not.toContain(
      'pearl-ribbon-lantern-v1',
    )
    expect(SINGING_CURRENT.preloadAssetProfileIds).not.toContain(
      'runner-first-flight-v1',
    )
    expect(SINGING_CURRENT.preloadAssetProfileIds).not.toContain(
      'runner-staff-glass-v1',
    )
    expect(
      SINGING_CURRENT.preloadAssetProfileIds.some((assetId) =>
        /^(g01|g14|g22)-/.test(assetId),
      ),
    ).toBe(false)
  })

  it('resolves glide endpoints, merged full-width gaps, and landing margins', () => {
    const arc = SINGING_CURRENT.targets.find(
      (target) => target.id === 'arc-diadem',
    )!
    expect(
      arc.notes.map((note) => [
        note.startOffsetSemitones,
        note.endOffsetSemitones,
        note.connection,
      ]),
    ).toEqual([
      [0, 0, 'separate'],
      [0, 2, 'glide'],
      [2, 0, 'glide'],
    ])
    const gaps = SINGING_CURRENT.obstacles.filter(
      (obstacle) => obstacle.kind === 'gap',
    )
    expect(gaps).toHaveLength(2)
    for (const gap of gaps) {
      expect(gap.lateralSpans).toEqual([{ minLateralX: -3, maxLateralX: 3 }])
      expect(gap.landingEndCourseDistanceMeters).toBeGreaterThan(
        gap.landingStartCourseDistanceMeters,
      )
      expect(gap.certifiedActions[0]?.launchCloseCourseSeconds).toBeGreaterThan(
        gap.certifiedActions[0]!.launchOpenCourseSeconds,
      )
    }
    const secondGap = gaps[1]!
    const firstGap = gaps[0]!
    expect(firstGap.telegraphFromCourseSeconds).toBeCloseTo(14.375, 12)
    expect(firstGap.telegraphFromCourseSeconds).toBeLessThan(
      firstGap.certifiedActions[0]!.launchOpenCourseSeconds,
    )
    const melodyCheckpoint = SINGING_CURRENT.checkpoints.find(
      (checkpoint) => checkpoint.id === 'melody',
    )!
    expect(secondGap.landingEndCourseDistanceMeters).toBeLessThan(
      melodyCheckpoint.courseDistanceMeters,
    )
  })

  it('rejects unknown keys and inverted ground datums at precise paths', () => {
    const unknown = sourceClone()
    Object.assign(unknown.courses[0]!.track, { surprise: true })
    expect(() =>
      compileSongRunnerCourseDocument(unknown, SINGING_CURRENT_CATALOG),
    ).toThrow('$.courses[0].track.surprise is not supported.')

    const inverted = sourceClone()
    inverted.courses[0].track.fallBelowFeetY = 0
    expect(() =>
      compileSongRunnerCourseDocument(inverted, SINGING_CURRENT_CATALOG),
    ).toThrow('$.courses[0].track.fallBelowFeetY must be below groundFeetY.')
  })

  it('rejects target overlap through delivery settlement and tempo steps in protection', () => {
    const overlapSource = sourceClone()
    overlapSource.courses[0].voice.phrases[0].breathAfterBeats = 2
    overlapSource.courses[0].voice.targets =
      overlapSource.courses[0].voice.targets.slice(0, 2)
    overlapSource.courses[0].voice.targets[1].atBeat = 14
    const overlapCatalog = catalogClone()
    overlapCatalog.voiceProfiles[
      'runner-relative-pitch-v1'
    ].voice.judge.maximumDeliveryLatencySeconds = 1.5
    expect(() =>
      compileSongRunnerCourseDocument(overlapSource, overlapCatalog),
    ).toThrow('overlaps target "home-window" through settlement grace')

    const protectedTempo = sourceClone()
    protectedTempo.courses[0].tempoMap.splice(1, 0, { atBeat: 8, bpm: 100 })
    expect(() =>
      compileSongRunnerCourseDocument(protectedTempo, SINGING_CURRENT_CATALOG),
    ).toThrow('falls inside protected target "home-window"')
  })

  it('rejects action sweeps through singing and unsafe checkpoint runways', () => {
    const actionOverlap = sourceClone()
    actionOverlap.courses[0].obstacles[0].atBeat = 13
    expect(() =>
      compileSongRunnerCourseDocument(actionOverlap, SINGING_CURRENT_CATALOG),
    ).toThrow('certified action overlaps protected target "home-window"')

    const unsafeCheckpoint = sourceClone()
    unsafeCheckpoint.courses[0].checkpoints[1].atBeat = 24
    expect(() =>
      compileSongRunnerCourseDocument(
        unsafeCheckpoint,
        SINGING_CURRENT_CATALOG,
      ),
    ).toThrow('runway intersects gap "first-jump"')
  })

  it('rejects impossible routes and visible/collision geometry disagreement', () => {
    const impossible = sourceClone()
    impossible.courses[0].obstacles[0].laneMask = [0, 1, 2]
    expect(() =>
      compileSongRunnerCourseDocument(impossible, SINGING_CURRENT_CATALOG),
    ).toThrow('blockers must leave at least one lane open')

    const mismatchedCatalog = catalogClone()
    const gapProfile = mismatchedCatalog.obstacleProfiles['runner-gap-v1']
    if (gapProfile.kind !== 'gap') {
      throw new Error('Expected runner-gap-v1 to resolve to a gap profile.')
    }
    gapProfile.visibleLengthMeters = 1.2
    expect(() =>
      compileSongRunnerCourseDocument(
        SINGING_CURRENT_SOURCE_DOCUMENT,
        mismatchedCatalog,
      ),
    ).toThrow('must have matching positive visible and collision spans')
  })
})
