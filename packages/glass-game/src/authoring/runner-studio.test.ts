// Runner studio tests: matching catalog, bounded imports and exact accepted course compilation.
import { describe, expect, it } from 'vitest'
import { SINGING_CURRENT } from '../runner/first-course.ts'
import { compileRunnerStudioDocument, RUNNER_STUDIO_CATALOG_ID, runnerStudioCatalog, summarizeRunnerStudioDocument, } from './runner-studio.ts'

describe('runner studio adapter', () => {
  it('exports a detached source snapshot that compiles to the accepted course', () => {
    const catalog = runnerStudioCatalog()
    expect(catalog.catalogId).toBe(RUNNER_STUDIO_CATALOG_ID)
    expect(compileRunnerStudioDocument(catalog.examples[0]!.document)).toEqual([
      SINGING_CURRENT,
    ])
    Object.assign(catalog.examples[0]!.document.courses[0]!, {
      title: 'A private draft',
    })
    expect(runnerStudioCatalog().examples[0]!.document.courses[0]!.title).toBe(
      'The Singing Current',
    )
  })
  it('reports authoritative windows and counts without claiming a playtest', () => {
    const [result] = summarizeRunnerStudioDocument(
      runnerStudioCatalog().examples[0]!.document,
    )
    expect(result!.durationSeconds).toBeCloseTo(86.065934, 5)
    expect(result!.targets).toHaveLength(8)
    expect(result!.obstacles).toHaveLength(SINGING_CURRENT.obstacles.length)
    expect(result!.checkpoints).toHaveLength(3)
    expect(result!.targets[0]!.completionPolicy).toBe('charge')
  })
  it('rejects stale catalog identities and unsupported profiles', () => {
    const source = runnerStudioCatalog().examples[0]!.document
    expect(() => compileRunnerStudioDocument(source, 'old-catalog')).toThrow(
      'catalog changed',
    )
    const malformed = {
      ...source,
      courses: [{ ...source.courses[0]!, movementProfileId: 'future-profile' }],
    }
    expect(() => compileRunnerStudioDocument(malformed)).toThrow(
      'movementProfileId',
    )
  })
  it('bounds external documents before allocating compiled courses', () => {
    const source = runnerStudioCatalog().examples[0]!.document
    expect(() =>
      compileRunnerStudioDocument({
        ...source,
        courses: Array(9).fill(source.courses[0]),
      }),
    ).toThrow('at most 8')
    expect(() =>
      compileRunnerStudioDocument({ ...source, unknown: true }),
    ).toThrow('$.unknown')
    expect(() => compileRunnerStudioDocument(null)).toThrow(
      'runner source document',
    )
  })
})
