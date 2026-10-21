// Procedural generation safety — rejected searches never emit partial courses or ignore requested content.

import { describe, expect, it } from 'vitest'
import { compileStudioDocument } from '../cloudway-studio.ts'
import { generateProceduralCourse } from './course-generator.ts'

describe('procedural generation safety', () => {
  const lessons = [
    ['first-arc-v1', 3],
    ['sunlit-steps-v1', 5],
    ['gallery-arch-v1', 7],
    ['two-windows-v1', 10],
  ] as const
  for (const [melodyLessonId, stationCount] of lessons) {
    for (const difficulty of ['gentle', 'balanced', 'virtuoso'] as const) {
      it(`keeps the full ${melodyLessonId}/${difficulty} route across fixed regression seeds`, () => {
        for (const seed of [42, 777, 'celestial-prime', 'twin-windows']) {
          const result = generateProceduralCourse({
            seed,
            melodyLessonId,
            difficulty,
          })
          expect(result.compiledLevel.melodyLesson?.stations).toHaveLength(
            stationCount,
          )
          expect(
            result.geometryIssues.filter((issue) => issue.severity === 'error'),
          ).toEqual([])
          expect(
            result.routeConnections.some((gap) => gap.kind === 'invalid'),
          ).toBe(false)
          expect(result.routeConnections.length).toBeGreaterThan(0)
          expect(compileStudioDocument(result.rawDocument)[0]).toEqual(
            result.compiledLevel,
          )
        }
      })
    }
  }

  it('turns living interiors off when the recipe requests it', () => {
    const course = generateProceduralCourse({
      seed: 'celestial-prime',
      includeLivingCrystals: false,
    })
    const source = (
      course.rawDocument.courses as Array<{
        presentation: { crystalInteriors: unknown[] }
      }>
    )[0]!
    expect(source.presentation.crystalInteriors).toEqual([])
  })

  it('does not alter the route when an author changes only its label or explicit ID', () => {
    const recipe = { seed: 'celestial-prime', fogTheme: 'celestial' } as const
    const original = generateProceduralCourse(recipe)
    const renamed = generateProceduralCourse({
      ...recipe,
      courseId: 'cloudway-authored-comparison',
      title: 'A different label',
    })
    expect(renamed.compiledLevel.platforms).toEqual(
      original.compiledLevel.platforms,
    )
    expect(renamed.compiledLevel.breakables).toEqual(
      original.compiledLevel.breakables,
    )
  })

  it('round-trips its full document through the public studio compiler', () => {
    const result = generateProceduralCourse({ seed: 'celestial-prime' })
    expect(
      compileStudioDocument(JSON.parse(JSON.stringify(result.rawDocument)))[0],
    ).toEqual(result.compiledLevel)
  })

  it('rejects invalid input before entering the candidate search', () => {
    expect(() => generateProceduralCourse({ seed: Number.NaN })).toThrow()
    expect(() => generateProceduralCourse({ seed: 'x'.repeat(129) })).toThrow()
  })
})
