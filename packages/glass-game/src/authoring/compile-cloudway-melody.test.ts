import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
// Thawing Song authoring tests — musical order, contacts, gates and durable route identities.
import { describe, expect, it } from 'vitest'
import document from '../content/data/cloudway-thawing-song.course.json' with { type: 'json' }
import { DEFAULT_EXHIBIT_MOUNT_HEIGHT, PORTRAIT_EXHIBIT_ENVELOPE, } from '../content/solid-props'
import { THAWING_SONG_PROFILES } from '../content/thawing-song-profiles'
import { compileCloudwayCourseDocument } from './compile-cloudway-course'

type JsonObject = Record<string, unknown>
const object = (value: unknown): JsonObject => value as JsonObject
const list = (value: unknown): JsonObject[] => value as JsonObject[]
const source = () => structuredClone(document) as unknown as JsonObject
const course = (data: JsonObject) => list(data.courses)[0]!
const encounters = (data: JsonObject) => list(course(data).encounters)
const lesson = (data: JsonObject) => object(course(data).melodyLesson)
const compile = (data: unknown = document) =>
  compileCloudwayCourseDocument(data, THAWING_SONG_PROFILES)[0]!

describe('Thawing Song course', () => {
  it('loads the authored melody route through the native package export', () => {
    const result = spawnSync(
      process.execPath,
      [
        '--experimental-strip-types',
        '--input-type=module',
        '--eval',
        `const { CLOUDWAY_THAWING_SONG: level } = await import('@irchiinnuss/glass-game/thawing-song');
       process.stdout.write(JSON.stringify([level.id, level.breakables.length, level.presentation.melodyMarkers.length]));`,
      ],
      {
        cwd: fileURLToPath(new URL('../../', import.meta.url)),
        encoding: 'utf8',
        timeout: 10000,
      },
    )
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual([
      'cloudway-thawing-song-audition',
      6,
      5,
    ])
  })

  it('compiles a deterministic, independent six-encounter crescent', () => {
    const level = compile()
    expect(level).toEqual(compile())
    expect(level.id).toBe('cloudway-thawing-song-audition')
    expect(level.authored?.contentRevision).toBe(1)
    expect(level.melodyLesson?.melody.id).toBe('sunlit-steps')
    expect(level.melodyLesson?.stations.map((s) => s.anchorId)).toEqual([
      'sunlit-steps-home',
      'sunlit-steps-two',
      'sunlit-steps-four',
      'sunlit-steps-back-two',
      'sunlit-steps-return',
    ])
    expect(level.breakables.map((b) => b.challenge.kind)).toEqual([
      'melody-anchor',
      'melody-anchor',
      'melody-anchor',
      'melody-anchor',
      'melody-anchor',
      'melody-contour',
    ])
    expect(level.platforms.some((p) => p.behavior !== undefined)).toBe(false)
    expect(level.camera?.kind).toBe('route-sections')
    expect(level.intentionalGaps).toHaveLength(8)
    for (const gap of level.intentionalGaps ?? []) {
      const shorter = Math.min(gap.maxX - gap.minX, gap.maxZ - gap.minZ)
      expect(shorter).toBeGreaterThanOrEqual(0.55 - 1e-8)
      expect(shorter).toBeLessThanOrEqual(0.65 + 1e-8)
    }
  })

  it('keeps each singing position on static stone, separated from its solid exhibit', () => {
    const level = compile()
    for (const exhibit of level.breakables) {
      const floor = level.platforms.find(
        (p) =>
          p.minX <= exhibit.anchor.x &&
          p.maxX >= exhibit.anchor.x &&
          p.minZ <= exhibit.anchor.z &&
          p.maxZ >= exhibit.anchor.z,
      )
      expect(floor?.surface).toBeUndefined()
      expect(floor?.behavior).toBeUndefined()
      expect(floor).toBeDefined()
      expect(
        Math.hypot(
          exhibit.anchor.x - exhibit.position.x,
          exhibit.anchor.z - exhibit.position.z,
        ),
      ).toBeGreaterThan(0.7)
    }
  })

  it('certifies both gate directions and removes only each completed pane', () => {
    const level = compile()
    const gates = level.breakables.filter(
      (b) => b.presentation?.kind === 'barrier',
    )
    expect(gates.map((g) => g.id)).toEqual([
      'thaw-gate-rise',
      'thaw-gate-return',
    ])
    expect(gates.map((g) => g.presentation?.facingYaw)).toEqual([
      Math.PI,
      -Math.PI / 2,
    ])
    for (const gate of gates) {
      const pane = level.solids!.find(
        (s) => s.id === `barrier:${gate.id}:pane`,
      )!
      expect(pane.activation).toEqual({ noneCompleted: [gate.id] })
      expect(pane.top - pane.thickness).toBeCloseTo(0)
      expect(
        level.solids!.filter(
          (s) => s.id.startsWith(`barrier:${gate.id}:`) && !s.activation,
        ),
      ).toHaveLength(3)
      expect(
        Math.hypot(
          gate.position.x - gate.anchor.x,
          gate.position.z - gate.anchor.z,
        ),
      ).toBeCloseTo(3.24)
    }
  })

  it('provides a real intact portrait collider and room for the exit behind it', () => {
    const level = compile()
    const portrait = level.breakables.at(-1)!
    const solid = level.solids!.find((s) => s.id === `intact:${portrait.id}`)!
    expect(solid.shape).toBe('box')
    if (solid.shape !== 'box') throw new Error('Expected portrait box.')
    expect(solid.maxX - solid.minX).toBeCloseTo(PORTRAIT_EXHIBIT_ENVELOPE.width)
    expect(solid.top - solid.thickness).toBeCloseTo(
      DEFAULT_EXHIBIT_MOUNT_HEIGHT,
    )
    expect(solid.activation).toEqual({ noneCompleted: [portrait.id] })
    expect(level.exit.requiresCompleted).toEqual([portrait.id])
    expect(portrait.position.z - level.exit.maxZ).toBeGreaterThan(0.8)
    expect(
      level.checkpoints.find((p) => p.id === 'thaw-garden-save')
        ?.requiresCompleted,
    ).toContain('thaw-gate-rise')
    expect(
      level.checkpoints.find((p) => p.id === 'thaw-home-save')
        ?.requiresCompleted,
    ).toContain('thaw-gate-return')
    expect(
      level.checkpoints.find((p) => p.id === 'thaw-portrait-save')
        ?.requiresCompleted,
    ).toHaveLength(5)
  })

  it.each([
    [
      'unknown profile',
      (d: JsonObject) => {
        lesson(d).profileId = 'made-up'
      },
      'unknown melody profile',
    ],
    [
      'fractional revision',
      (d: JsonObject) => {
        lesson(d).revision = 1.5
      },
      'must be an integer',
    ],
    [
      'missing lesson',
      (d: JsonObject) => {
        delete course(d).melodyLesson
      },
      'required for melodic challenges',
    ],
    [
      'duplicate repeated-pitch identity',
      (d: JsonObject) => {
        list(lesson(d).stations)[3]!.anchorId = 'sunlit-steps-two'
      },
      'duplicates id',
    ],
    [
      'skipped teaching anchor',
      (d: JsonObject) => {
        list(lesson(d).stations).pop()
      },
      'teach every anchor',
    ],
    [
      'wrong lesson',
      (d: JsonObject) => {
        object(encounters(d)[0]!.challenge).lessonId = 'other'
      },
      'another lesson',
    ],
    [
      'wrong note order',
      (d: JsonObject) => {
        object(encounters(d)[0]!.challenge).anchorId = 'sunlit-steps-four'
      },
      'complete melody order',
    ],
    [
      'unlocked later station',
      (d: JsonObject) => {
        encounters(d)[3]!.requiresCompleted = []
      },
      'every earlier station',
    ],
    [
      'optional station',
      (d: JsonObject) => {
        encounters(d)[1]!.optional = true
      },
      'non-optional encounter',
    ],
    [
      'hold-only finale',
      (d: JsonObject) => {
        encounters(d)[5]!.challenge = { profileId: 'comfortable-hold' }
      },
      'mapped stations and one finale',
    ],
    [
      'unguarded exit',
      (d: JsonObject) => {
        object(course(d).exit).requiresCompleted = []
      },
      'whole-melody finale',
    ],
    [
      'unrecognized challenge',
      (d: JsonObject) => {
        object(encounters(d)[0]!.challenge).profileId = 'magical'
      },
      'supported challenge',
    ],
    [
      'reference mismatch',
      (d: JsonObject) => {
        object(encounters(d)[0]!.challenge).reference = 'whole-melody'
      },
      'anchor-tone',
    ],
    [
      'unknown challenge field',
      (d: JsonObject) => {
        object(encounters(d)[0]!.challenge).automatic = true
      },
      'automatic',
    ],
    [
      'legacy key mixed into v3',
      (d: JsonObject) => {
        encounters(d)[0]!.challengeProfileId = 'comfortable-hold'
      },
      'challengeProfileId',
    ],
    [
      'singing on frost',
      (d: JsonObject) => {
        encounters(d)[0]!.anchor = { x: -6.35, y: 0, z: -6.55 }
      },
      'without a tuned surface',
    ],
  ])('rejects %s', (_label, mutate, message) => {
    const data = source()
    mutate(data)
    expect(() => compile(data)).toThrow(message)
  })
})
