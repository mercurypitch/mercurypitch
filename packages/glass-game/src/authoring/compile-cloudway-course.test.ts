// Cloudway course compiler tests — JSON placements stay strict and certified profiles own contacts.

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CLOUDWAY_LABORATORY_COURSE_PROFILES } from '../content/cloudway-laboratory-profiles'
import courseDocument from '../content/data/cloudway-crystal-promenade.course.json' with { type: 'json' }
import { FROSTED_SCROLL_WALL_PROFILE } from '../content/frost-wall-profile'
import { compileCloudwayCourseDocument } from './compile-cloudway-course'

type MutableRecord = Record<string, unknown>

function mutableRecord(value: unknown): MutableRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Test fixture path must be an object.')
  return value as MutableRecord
}

function mutableArray(value: unknown): unknown[] {
  if (!Array.isArray(value))
    throw new Error('Test fixture path must be an array.')
  return value
}

function source(): unknown {
  return structuredClone(courseDocument)
}

function course(data: unknown): MutableRecord {
  return mutableRecord(mutableArray(mutableRecord(data).courses)[0])
}

function nestedItem(
  data: unknown,
  collection: 'gaps' | 'encounters' | 'checkpoints',
  index: number,
): MutableRecord {
  return mutableRecord(mutableArray(course(data)[collection])[index])
}

describe('Cloudway course compiler', () => {
  it('loads the JSON-authored package export through native TypeScript stripping', () => {
    const result = spawnSync(
      process.execPath,
      [
        '--experimental-strip-types',
        '--input-type=module',
        '--eval',
        `const route = await import('@irchiinnuss/glass-game/promenade');
         process.stdout.write(route.CLOUDWAY_CRYSTAL_PROMENADE_STUDY.id);`,
      ],
      {
        cwd: fileURLToPath(new URL('../../', import.meta.url)),
        encoding: 'utf8',
        timeout: 10_000,
      },
    )
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toBe('cloudway-crystal-promenade-first-slice')
  })

  it('deterministically compiles the saved route and separate cardinal preview', () => {
    const first = compileCloudwayCourseDocument(
      source(),
      CLOUDWAY_LABORATORY_COURSE_PROFILES,
    )
    const second = compileCloudwayCourseDocument(
      source(),
      CLOUDWAY_LABORATORY_COURSE_PROFILES,
    )

    expect(first).toEqual(second)
    expect(first.map((level) => level.id)).toEqual([
      'cloudway-crystal-promenade-first-slice',
      'cloudway-crystal-promenade-mechanics-preview',
    ])
    expect(first[0]?.authored).toMatchObject({
      layoutId: 'crystal-promenade-first-slice',
      contentRevision: 4,
    })
    expect(first[1]?.authored).toMatchObject({
      layoutId: 'crystal-promenade-mechanics-preview',
      contentRevision: 2,
    })
  })

  it('derives cardinal platform axes, certified contacts and declared gaps', () => {
    const [promenade, preview] = compileCloudwayCourseDocument(
      source(),
      CLOUDWAY_LABORATORY_COURSE_PROFILES,
    )
    const mainScroll = promenade!.platforms.find(
      (platform) => platform.id === 'scroll-deck',
    )!
    const previewScroll = preview!.platforms.find(
      (platform) => platform.id === 'preview-scroll-deck',
    )!
    const frost = promenade!.platforms.find(
      (platform) => platform.id === 'frost-lily-one',
    )!

    expect(mainScroll.behavior).toMatchObject({ kind: 'scroll', axis: 'z' })
    expect(previewScroll.behavior).toMatchObject({ kind: 'scroll', axis: 'x' })
    expect(frost).toMatchObject({
      thickness: 0.3,
      surface: {
        kind: 'frost',
        controlMultiplier: 0.62,
        brakingMultiplier: 0.38,
        maximumSpeed: 2.45,
      },
    })
    expect(frost.minX).toBeCloseTo(-0.575, 10)
    expect(frost.maxX).toBeCloseTo(1.075, 10)
    expect(frost.minZ).toBeCloseTo(3.563464088, 10)
    expect(frost.maxZ).toBeCloseTo(5.763464088, 10)
    expect(
      promenade!.intentionalGaps?.map((gap) => ({
        id: gap.id,
        distance: gap.maxZ - gap.minZ,
      })),
    ).toEqual(
      expect.arrayContaining([
        { id: 'scroll-entry', distance: expect.closeTo(0.7, 8) },
        { id: 'frost-bend', distance: expect.closeTo(0.55, 8) },
        { id: 'aurora-exit', distance: expect.closeTo(0.55, 8) },
      ]),
    )
  })

  it('emits a removable pane and permanent certified frame at the floor datum', () => {
    const [promenade] = compileCloudwayCourseDocument(
      source(),
      CLOUDWAY_LABORATORY_COURSE_PROFILES,
    )
    const solids = new Map(
      promenade!.solids?.map((solid) => [solid.id, solid]) ?? [],
    )
    const pane = solids.get('barrier:voice-fifth:pane')!
    const left = solids.get('barrier:voice-fifth:left-post')!
    const right = solids.get('barrier:voice-fifth:right-post')!
    const lintel = solids.get('barrier:voice-fifth:lintel')!
    const wall = promenade!.breakables.find(
      (target) => target.id === 'voice-fifth',
    )!

    expect(wall.presentation).toEqual({
      kind: 'barrier',
      facingYaw: Math.PI,
    })
    expect(wall.anchor.z).toBeLessThan(wall.position.z)
    expect(wall.position.z - wall.anchor.z).toBeCloseTo(3.24, 10)
    expect(pane).toMatchObject({
      shape: 'box',
      top: 2.69,
      thickness: 2.69,
      activation: { noneCompleted: ['voice-fifth'] },
      presentation: { role: 'gate', material: 'glass' },
    })
    expect(pane.top - pane.thickness).toBeCloseTo(0, 10)
    for (const post of [left, right]) {
      expect(post.activation).toBeUndefined()
      expect(post.top - post.thickness).toBeCloseTo(0, 10)
      expect(post.fallback).toMatchObject({
        replacedByBundle: 'cloudway-lab-frosted-scroll-wall-v1',
        replacedByNode: 'frost_wall_frame',
      })
    }
    expect(lintel.top - lintel.thickness).toBeCloseTo(2.44, 10)
  })

  it('rejects an empty gateParts declaration instead of dropping an existing gate', () => {
    const profiles = {
      ...CLOUDWAY_LABORATORY_COURSE_PROFILES,
      barriers: {
        ...CLOUDWAY_LABORATORY_COURSE_PROFILES.barriers,
        [FROSTED_SCROLL_WALL_PROFILE.id]: {
          ...FROSTED_SCROLL_WALL_PROFILE,
          gateParts: [],
        },
      },
    }

    expect(() => compileCloudwayCourseDocument(source(), profiles)).toThrow(
      'must declare exactly one of gate or gateParts',
    )
  })

  it.each([
    [
      'unknown course key',
      (data: unknown) => (course(data).mystery = 1),
      'mystery',
    ],
    [
      'gap/profile drift',
      (data: unknown) => (nestedItem(data, 'gaps', 0).distance = 0.56),
      'declares 0.56m',
    ],
    [
      'non-cardinal wall',
      (data: unknown) =>
        (mutableRecord(
          nestedItem(data, 'encounters', 2).presentation,
        ).facingYaw = 0.2),
      'cardinal yaw',
    ],
    [
      'unknown wall profile',
      (data: unknown) =>
        (mutableRecord(
          nestedItem(data, 'encounters', 2).presentation,
        ).profileId = 'guess'),
      'unknown certified barrier profile',
    ],
    [
      'back-facing wall anchor',
      (data: unknown) =>
        (mutableRecord(nestedItem(data, 'encounters', 2).anchor).z = 13),
      'visual front side',
    ],
    [
      'dynamic checkpoint',
      (data: unknown) =>
        (nestedItem(data, 'checkpoints', 0).position = {
          x: 1,
          y: 0,
          z: 15.353464088,
        }),
      'behaviorless static platform',
    ],
    [
      'frost checkpoint',
      (data: unknown) =>
        (nestedItem(data, 'checkpoints', 0).position = {
          x: 0.25,
          y: 0,
          z: 4.663464088,
        }),
      'without a tuned surface',
    ],
    [
      'negative run delay',
      (data: unknown) =>
        (mutableRecord(course(data).movement).runDelaySeconds = -0.01),
      'runDelaySeconds must be between 0',
    ],
    [
      'unknown ordinary encounter variant',
      (data: unknown) =>
        (nestedItem(data, 'encounters', 0).variant = 'missing-recipe'),
      'unknown encounter variant',
    ],
  ])('rejects %s', (_label, mutate, message) => {
    const data = source()
    mutate(data)
    expect(() =>
      compileCloudwayCourseDocument(data, CLOUDWAY_LABORATORY_COURSE_PROFILES),
    ).toThrow(message)
  })
})
