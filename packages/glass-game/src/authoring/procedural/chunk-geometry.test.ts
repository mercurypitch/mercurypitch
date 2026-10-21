// Procedural geometry regressions — physical routes and visible envelopes stay separate.

import { describe, expect, it } from 'vitest'
import { compileGap } from '../compile-cloudway-platforms.ts'
import { compileAssembledPlatform, platformVisualEnvelope, } from './chunk-envelopes.ts'
import { getAssembledGeometryIssues } from './chunk-geometry.ts'
import * as chunks from './chunk-library.ts'
import { createChunkSocket } from './chunk-routing.ts'
import type { AssembledPlatform } from './chunk-stitcher.ts'
import { buildAssembledCourseGaps, classifyAssembledCourseGaps, hasAssembledPlatformOverlap, stitchChunks, } from './chunk-stitcher.ts'
import type { CardinalDirection, ProceduralChunk } from './contracts.ts'

const { createArrivalChunk } = chunks

function chunkVariants(): ProceduralChunk[] {
  const variants = [
    createArrivalChunk(),
    chunks.createFinalePavilionChunk('final'),
    chunks.createFrostGlissadeChunk('frost'),
    chunks.createHexCascadeChunk('hex'),
    chunks.createAuroraGlideChunk('raft'),
    chunks.createTerracedAscentChunk('ascent'),
    chunks.createSkyElevatorGlideChunk('elevator'),
    chunks.createFrostRaftTransferChunk('transfer'),
    chunks.createTwinGlideCrossingChunk('twins'),
    chunks.createViaductSCurveChunk('s'),
    chunks.createSplitForkChunk('fork'),
    chunks.createDiagonalGlideChunk('diagonal-l', 'left-to-right'),
    chunks.createDiagonalGlideChunk('diagonal-r', 'right-to-left'),
  ]
  for (const preset of [
    'aurora-heart',
    'resonance-veins',
    'frost-roots',
  ] as const)
    variants.push(
      chunks.createScrollBridgeChunk(preset, preset),
      chunks.createCrystalCrossroadsChunk(preset, preset),
    )
  for (const style of ['frost', 'hex', 'hybrid'] as const)
    variants.push(chunks.createSlalomZigzagChunk(style, style))
  for (const turn of ['east', 'west'] as const)
    variants.push(
      chunks.createArcedViaductChunk(turn, turn),
      chunks.createCascadingDropChunk(turn, turn),
      chunks.createCrackingSpiralChunk(turn, turn),
    )
  for (const turn of ['none', 'east', 'west'] as const)
    for (const barrierProfileId of [
      'frosted-scroll-wall',
      'frost-gold-arch-breakwall-a',
    ] as const)
      for (const alcove of [false, true])
        variants.push(
          chunks.createVocalSanctuaryChunk(
            `${turn}-${barrierProfileId}-${alcove}`,
            'first-arc-rise',
            turn,
            {
              barrierProfileId,
              ...(alcove
                ? {
                    optionalAlcove: {
                      variant: 'goblet',
                      label: 'Side alcove',
                      coinId: 'test-coin',
                    },
                  }
                : {}),
            },
          ),
        )
  return variants
}

function orientedChunk(chunk: ProceduralChunk, heading: CardinalDirection) {
  const prefix = createArrivalChunk()
  const assembled = stitchChunks([
    {
      ...prefix,
      exitSocket: createChunkSocket('exit', prefix.platforms.at(-1)!, heading),
    },
    chunk,
  ])
  return {
    ...assembled,
    platforms: assembled.platforms.filter((p) => p.id.startsWith('proc-c2-')),
    joins: assembled.joins.filter((j) => j.platformAId.startsWith('proc-c2-')),
    gaps: assembled.gaps.filter((g) => g.id.startsWith('proc-c2-')),
    encounters: assembled.encounters.filter((e) => e.id.startsWith('proc-c2-')),
    checkpoints: assembled.checkpoints.filter((c) =>
      c.id.startsWith('proc-c2-'),
    ),
  }
}

describe('procedural visible geometry', () => {
  it('detects the measured 17 cm Pearl ornament overlap when no join is declared', () => {
    const course = stitchChunks([createArrivalChunk()])
    // Renderer-fitted Pearl depth is 0.88837033 m; contact pitch is 0.72 m.
    expect(hasAssembledPlatformOverlap(course.platforms)).toBe(true)
  })

  it('reports authored Pearl seams honestly while rejecting undeclared, raised and turned overlaps', () => {
    const course = stitchChunks([createArrivalChunk()])
    const issues = getAssembledGeometryIssues(course)
    expect(
      issues.filter((i) => i.id === 'decorative-seam-overlap'),
    ).toHaveLength(4)
    expect(issues.some((i) => i.severity === 'error')).toBe(false)
    for (const changed of [
      {
        ...course.platforms[1],
        center: { ...course.platforms[1].center, y: 0.06 },
      },
      { ...course.platforms[1], quarterTurns: 1 },
      { ...course.platforms[1], center: course.platforms[0].center },
    ]) {
      expect(
        getAssembledGeometryIssues({
          ...course,
          platforms: [course.platforms[0], changed],
        }).some((i) => i.severity === 'error'),
      ).toBe(true)
    }
  })

  it('rejects unknown contact profiles instead of assuming a Pearl floor', () => {
    expect(
      getAssembledGeometryIssues({
        platforms: [
          {
            id: 'unknown',
            profileId: 'typo',
            center: { x: 0, y: 0, z: 0 },
            quarterTurns: 0,
          },
        ],
      })[0].id,
    ).toBe('unknown-profile')
  })

  it('tests three-dimensional swept volumes, including travel through an intermediate height', () => {
    const fixed: AssembledPlatform = {
      id: 'fixed',
      profileId: 'pearl-rest',
      center: { x: 4, y: 2, z: 0 },
      quarterTurns: 0,
    }
    const raft: AssembledPlatform = {
      id: 'raft',
      profileId: 'aurora-glide',
      center: { x: 0, y: 0, z: 0 },
      quarterTurns: 0,
      behavior: {
        kind: 'glide',
        translation: { x: 8, y: 4, z: 0 },
        travelSeconds: 3,
        dwellSeconds: 1,
      },
    }
    expect(hasAssembledPlatformOverlap([raft, fixed])).toBe(true)
    expect(
      hasAssembledPlatformOverlap([
        raft,
        { ...fixed, center: { x: 4, y: 7, z: 0 } },
      ]),
    ).toBe(false)
  })

  it('rejects low overhead slabs but permits a crossing with standing headroom', () => {
    const floor: AssembledPlatform = {
      id: 'floor',
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 0 },
      quarterTurns: 0,
    }
    const ceiling = {
      ...floor,
      id: 'ceiling',
      center: { x: 0, y: 0.6, z: 0 },
      quarterTurns: 1,
    }
    expect(
      getAssembledGeometryIssues({ platforms: [floor, ceiling] }).some(
        (i) => i.id === 'headroom-obstruction',
      ),
    ).toBe(true)
    expect(
      getAssembledGeometryIssues({
        platforms: [floor, { ...ceiling, center: { x: 0, y: 1, z: 0 } }],
      }),
    ).toEqual([])
  })

  it('rejects unrelated routes and moving rafts crossing visible gate wings', () => {
    const course = stitchChunks([
      chunks.createVocalSanctuaryChunk('gate', 'note'),
    ])
    const unrelated: AssembledPlatform = {
      id: 'unrelated',
      profileId: 'pearl-rest',
      center: { x: 3.6, y: 0, z: 3.96 },
      quarterTurns: 0,
    }
    expect(
      getAssembledGeometryIssues({
        ...course,
        platforms: [...course.platforms, unrelated],
      }).some((i) => i.id === 'barrier-route-intersection'),
    ).toBe(true)
    const raft: AssembledPlatform = {
      id: 'foreign-raft',
      profileId: 'aurora-glide',
      center: { x: 5, y: 0, z: 1 },
      quarterTurns: 0,
      behavior: {
        kind: 'glide',
        translation: { x: -3, y: 0.2, z: 5 },
        travelSeconds: 3,
        dwellSeconds: 1,
      },
    }
    expect(
      getAssembledGeometryIssues({
        ...course,
        platforms: [...course.platforms, raft],
      }).some((i) => i.id === 'barrier-route-intersection'),
    ).toBe(true)
    expect(
      getAssembledGeometryIssues(course).filter((i) => i.severity === 'error'),
    ).toEqual([])
  })

  it.each(
    chunkVariants().flatMap((chunk) =>
      (['north', 'east', 'south', 'west'] as const).map((heading) => ({
        name: `${chunk.id}/${heading}`,
        chunk,
        heading,
      })),
    ),
  )(
    'checks every route and visual envelope for $name',
    ({ chunk, heading }) => {
      const assembled = orientedChunk(chunk, heading)
      expect(
        getAssembledGeometryIssues(assembled).filter(
          (i) => i.severity === 'error',
        ),
      ).toEqual([])
      const classifications = classifyAssembledCourseGaps(assembled)
      expect(classifications).toHaveLength(assembled.gaps.length)
      expect(classifications.some((g) => g.kind === 'invalid')).toBe(false)
      const compiled = new Map(
        assembled.platforms.map((p) => [p.id, compileAssembledPlatform(p)]),
      )
      for (const gap of buildAssembledCourseGaps(assembled))
        expect(() => compileGap(gap, compiled, 'test.gap')).not.toThrow()
    },
  )

  it('aligns nonzero entry sockets and honors both declared clearances', () => {
    const first = createArrivalChunk(),
      second = chunks.createDiagonalGlideChunk('offset')
    const assembled = stitchChunks([
      { ...first, exitSocket: { ...first.exitSocket, clearanceMargin: 0.75 } },
      second,
    ])
    const gap = classifyAssembledCourseGaps(assembled).find(
      (g) => g.id === 'proc-intergap-1',
    )!
    expect(gap.distance).toBeCloseTo(0.75, 6)
    const firstLanding = assembled.platforms.find((p) =>
      p.id.endsWith('diag-dep-offset'),
    )!
    expect(firstLanding.center.x).toBe(0)
  })

  it('uses declared main exit ownership when optional alcove platforms follow it', () => {
    const sanctuary = chunks.createVocalSanctuaryChunk(
      'branch',
      'note',
      'east',
      { optionalAlcove: { variant: 'coupe', label: 'Alcove', coinId: 'coin' } },
    )
    const assembled = stitchChunks([
      sanctuary,
      chunks.createScrollBridgeChunk('next'),
    ])
    expect(
      assembled.gaps.find((g) => g.id === 'proc-intergap-1')?.platformAId,
    ).toBe('proc-c1-sanc-10-branch')
    expect(assembled.cameraSections[1].lookFromPlatformId).toBe(
      'proc-c1-sanc-10-branch',
    )
    expect(sanctuary.exitSocket.position.z).toBeGreaterThan(
      sanctuary.encounters![0].position.z + 2,
    )
  })

  it('rejects unsupported note/checkpoint anchors and overclaimed gap clearance', () => {
    const course = stitchChunks([chunks.createFrostGlissadeChunk('f')])
    expect(
      getAssembledGeometryIssues({
        ...course,
        checkpoints: [
          {
            id: 'floating',
            position: { x: 0, y: 3, z: 1.4 },
            radius: 1,
            facingYaw: 0,
          },
        ],
      }).some((i) => i.id === 'unsupported-anchor'),
    ).toBe(true)
    expect(
      getAssembledGeometryIssues({
        ...course,
        gaps: course.gaps.map((g) => ({ ...g, minimumClearanceMeters: 4 })),
      }).some((i) => i.id === 'gap-clearance'),
    ).toBe(true)
  })

  it('rotates the asymmetric scroll envelope and keeps its rollers on the traversal axis', () => {
    const assembled = stitchChunks([chunks.createScrollBridgeChunk('bridge')])
    const platform = assembled.platforms[0],
      bounds = platformVisualEnvelope(platform)
    expect(
      compileAssembledPlatform(platform).definition.behavior,
    ).toMatchObject({ kind: 'scroll', axis: 'z' })
    expect(bounds.maxZ - bounds.minZ).toBeGreaterThan(bounds.maxX - bounds.minX)
  })
})
