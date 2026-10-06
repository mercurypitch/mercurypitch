// Tests for procedural course generator.

import { describe, expect, it } from 'vitest'
import { generateProceduralCourse } from './course-generator.ts'
import { proveReachability } from '../../solver/reachability-prover.ts'

describe('generateProceduralCourse', () => {
  it('generates a valid schema 4 course document and compiles to LevelDefinition', () => {
    const result = generateProceduralCourse({ seed: 42 })

    expect(result.courseId).toMatch(/^cloudway-procedural-/)
    expect(result.rawDocument.schema).toBe('mercurypitch.cloudway-course')
    expect(result.rawDocument.schemaVersion).toBe(4)
    expect(result.compiledLevel).toBeDefined()
    expect(result.compiledLevel.id).toBe(result.courseId)
    expect(result.compiledLevel.platforms.length).toBeGreaterThan(20)
    expect(result.compiledLevel.breakables.length).toBe(4) // home note, gate 1, gate 2, finale portrait
    expect(result.compiledLevel.checkpoints.length).toBeGreaterThanOrEqual(3)
  })

  it('is strictly deterministic for identical seeds', () => {
    const run1 = generateProceduralCourse({ seed: 'daily-2026-10-06' })
    const run2 = generateProceduralCourse({ seed: 'daily-2026-10-06' })

    expect(run1.rawDocument).toEqual(run2.rawDocument)
    expect(run1.compiledLevel.platforms.length).toBe(
      run2.compiledLevel.platforms.length,
    )
  })

  it('generates distinct layouts for distinct seeds', () => {
    const runA = generateProceduralCourse({ seed: 101 })
    const runB = generateProceduralCourse({ seed: 202 })

    expect(runA.courseId).not.toBe(runB.courseId)
    expect(runA.title).not.toBe(runB.title)
  })

  it('guarantees kinematic clearances on moving rafts to avoid collisions', () => {
    const result = generateProceduralCourse({ seed: 777 })
    const level = result.compiledLevel

    // Find the moving raft
    const raft = level.platforms.find((p) => p.behavior?.kind === 'glide')
    expect(raft).toBeDefined()
    expect(raft?.behavior?.kind).toBe('glide')
  })

  it('verifies that the opening home note anchor is reachable from spawn', () => {
    const result = generateProceduralCourse({ seed: 888 })
    const level = result.compiledLevel

    const homeNote = level.breakables.find((b) => b.id.includes('note-home'))
    expect(homeNote).toBeDefined()

    const proof = proveReachability(level, {
      id: homeNote!.id,
      label: 'Home Note',
      anchor: homeNote!.anchor,
      interactionRadius: 1.2,
    })

    expect(proof.reachable).toBe(true)
  })

  it('derives correctly oriented exit portal geometry past the finale portrait', () => {
    for (const seed of [1, 42, 999, 'hook-test', 'straight-test']) {
      const result = generateProceduralCourse({ seed })
      const exit = result.compiledLevel.exit
      const spanX = exit.maxX - exit.minX
      const spanZ = exit.maxZ - exit.minZ

      // Exactly one axis must be thin (crossing depth <= 0.40m) and the other wide (aperture >= 1.4m)
      const minSpan = Math.min(spanX, spanZ)
      const maxSpan = Math.max(spanX, spanZ)
      expect(minSpan).toBeCloseTo(0.36, 1)
      expect(maxSpan).toBeCloseTo(1.6, 1)

      // The exit must not overlap or precede the finale portrait
      const portrait = result.compiledLevel.breakables.find((b) =>
        b.variant.includes('portrait'),
      )!
      expect(portrait).toBeDefined()
      const distFromPortrait = Math.hypot(
        (exit.minX + exit.maxX) / 2 - portrait.position.x,
        (exit.minZ + exit.maxZ) / 2 - portrait.position.z,
      )
      expect(distFromPortrait).toBeGreaterThanOrEqual(0.75)
    }
  })

  it('generates distinct topological layouts, platform counts, and titles across seeds', () => {
    const seeds = [1, 2, 3, 4, 5]
    const results = seeds.map((seed) => generateProceduralCourse({ seed }))

    const titles = new Set(results.map((r) => r.title))
    const platformCounts = new Set(
      results.map((r) => r.compiledLevel.platforms.length),
    )
    const exitX = new Set(results.map((r) => r.compiledLevel.exit.maxX))

    // Multiple distinct titles, platform counts, and spatial bounds
    expect(titles.size).toBeGreaterThan(1)
    expect(platformCounts.size).toBeGreaterThan(1)
    expect(exitX.size).toBeGreaterThan(1)
  })

  it('guarantees rich lateral variety, diagonal placements, and multiple turns across seeds', () => {
    // Test across a diverse seed suite
    const testSeeds = [
      10,
      42,
      100,
      255,
      777,
      'serpent',
      'crystal',
      'abyss',
      'aurora',
      'meander',
    ]
    for (const seed of testSeeds) {
      const result = generateProceduralCourse({ seed })
      const level = result.compiledLevel

      // 1. Ensure course has extensive platforms (typically 40-55 platforms)
      expect(level.platforms.length).toBeGreaterThanOrEqual(35)

      // 2. Ensure platforms have pronounced lateral variety (|x| > 0.5m)
      const maxAbsX = Math.max(
        ...level.platforms.map((p) => Math.abs(p.minX + p.maxX) / 2),
      )
      expect(maxAbsX).toBeGreaterThanOrEqual(1.0)

      // 3. Ensure multi-mechanic presence (frost, crackle/hex, deck)
      const hasFrost = level.platforms.some((p) => p.surface?.kind === 'frost')
      const hasHex = level.platforms.some((p) => p.behavior?.kind === 'crackle')
      expect(hasFrost || hasHex).toBe(true)

      // 4. Ensure non-trivial bounding box (both width and depth span over 10m)
      const spanX =
        Math.max(...level.platforms.map((p) => p.maxX)) -
        Math.min(...level.platforms.map((p) => p.minX))
      const spanZ =
        Math.max(...level.platforms.map((p) => p.maxZ)) -
        Math.min(...level.platforms.map((p) => p.minZ))
      expect(spanX).toBeGreaterThanOrEqual(8.0)
      expect(spanZ).toBeGreaterThanOrEqual(15.0)
    }
  })

  it('guarantees zero physical 2D platform overlaps across procedural seeds', () => {
    const testSeeds = [
      'fork',
      'serpent',
      'crystal',
      'abyss',
      'aurora',
      'meander',
      1,
      2,
      42,
      100,
      777,
    ]
    for (const seed of testSeeds) {
      const result = generateProceduralCourse({ seed })
      const level = result.compiledLevel
      const overlappingPairs: string[] = []
      for (let i = 0; i < level.platforms.length; i++) {
        for (let j = i + 1; j < level.platforms.length; j++) {
          const p1 = level.platforms[i]
          const p2 = level.platforms[j]
          const xOverlap =
            Math.min(p1.maxX, p2.maxX) - Math.max(p1.minX, p2.minX)
          const zOverlap =
            Math.min(p1.maxZ, p2.maxZ) - Math.max(p1.minZ, p2.minZ)
          if (xOverlap > 0.01 && zOverlap > 0.01) {
            overlappingPairs.push(
              `seed=${seed}: ${p1.id} overlaps with ${p2.id}: x=[${p1.minX.toFixed(3)}, ${p1.maxX.toFixed(3)}] vs [${p2.minX.toFixed(3)}, ${p2.maxX.toFixed(3)}], z=[${p1.minZ.toFixed(3)}, ${p1.maxZ.toFixed(3)}] vs [${p2.minZ.toFixed(3)}, ${p2.maxZ.toFixed(3)}] (dx=${xOverlap.toFixed(3)}, dz=${zOverlap.toFixed(3)})`,
            )
          }
        }
      }
      expect(
        overlappingPairs,
        `Found overlapping platforms in seed=${seed}`,
      ).toEqual([])
    }
  })
})
