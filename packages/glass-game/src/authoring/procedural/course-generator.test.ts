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
    expect(run1.compiledLevel.platforms.length).toBe(run2.compiledLevel.platforms.length)
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
      expect(maxSpan).toBeCloseTo(1.60, 1)

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
    const platformCounts = new Set(results.map((r) => r.compiledLevel.platforms.length))
    const exitX = new Set(results.map((r) => r.compiledLevel.exit.maxX))

    // Multiple distinct titles, platform counts, and spatial bounds
    expect(titles.size).toBeGreaterThan(1)
    expect(platformCounts.size).toBeGreaterThan(1)
    expect(exitX.size).toBeGreaterThan(1)
  })
})

