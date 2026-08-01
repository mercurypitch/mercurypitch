import { getZenExercise, installPublishedZenExercises, installPublishedZenExerciseVersion, restoreSeedZenExercises, zenExerciseCatalog, } from '@/features/zen/exercise-catalog'
import { parseZenExercise, parseZenExerciseStructure, parseZenExerciseVersion, validateZenExercise, } from '@/features/zen/validate-exercise'

describe('Zen exercise publication validation', () => {
  afterEach(() => restoreSeedZenExercises())

  it('rejects malformed input at the runtime boundary', () => {
    const parsed = parseZenExercise({
      id: 'broken',
      targets: 'not-an-array',
    })

    expect(parsed.exercise).toBeNull()
    expect(parsed.issues.length).toBeGreaterThan(0)
  })

  it('keeps a complete unfinished draft editable without publishing it', () => {
    const seed = getZenExercise('ng-five-tone')
    expect(seed).not.toBeNull()
    if (seed === null) return
    const unfinished = { ...seed, title: '', instructions: '' }

    const draft = parseZenExerciseStructure(unfinished)
    const publication = parseZenExercise(unfinished)

    expect(draft.exercise).toEqual(unfinished)
    expect(draft.issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining(['title', 'instructions']),
    )
    expect(publication.exercise).toBeNull()
  })

  it('rejects overlapping monophonic targets', () => {
    const seed = getZenExercise('ng-five-tone')
    expect(seed).not.toBeNull()
    if (seed === null) return

    const issues = validateZenExercise({
      ...seed,
      targets: [
        { ...seed.targets[0]!, startBeat: 1, durationBeats: 2 },
        { ...seed.targets[1]!, startBeat: 2, durationBeats: 1 },
      ],
    })

    expect(issues).toContainEqual(
      expect.objectContaining({
        path: 'targets.1.startBeat',
        message: expect.stringContaining('overlap'),
      }),
    )
  })

  it('requires a non-zero scoring contribution', () => {
    const seed = getZenExercise('major-scale-ascending')
    expect(seed).not.toBeNull()
    if (seed === null) return

    const issues = validateZenExercise({
      ...seed,
      scoring: {
        ...seed.scoring,
        pitchWeight: 0,
        coverageWeight: 0,
        steadinessWeight: 0,
      },
    })

    expect(issues).toContainEqual(
      expect.objectContaining({
        path: 'scoring',
        message: expect.stringContaining('greater than zero'),
      }),
    )
  })

  it('accepts a structurally and semantically valid seed', () => {
    const seed = getZenExercise('noo-siren')
    expect(seed).not.toBeNull()

    const parsed = parseZenExercise(seed)

    expect(parsed.issues).toEqual([])
    expect(parsed.exercise?.id).toBe('noo-siren')
  })

  it('dispatches immutable publications by their stored schema version', () => {
    const seed = getZenExercise('noo-siren')
    expect(seed).not.toBeNull()

    expect(parseZenExerciseVersion(seed, 1).exercise?.id).toBe('noo-siren')
    expect(parseZenExerciseVersion(seed, 2)).toEqual({
      exercise: null,
      issues: [
        expect.objectContaining({
          path: 'schemaVersion',
          message: expect.stringContaining('Unsupported'),
        }),
      ],
    })
  })

  it('installs a complete valid publication atomically', () => {
    const seed = getZenExercise('ng-five-tone')
    expect(seed).not.toBeNull()
    if (seed === null) return

    expect(
      installPublishedZenExercises([
        { ...seed, version: seed.version + 1, title: 'Published NG' },
      ]),
    ).toBe(true)
    expect(zenExerciseCatalog()).toHaveLength(1)
    expect(getZenExercise(seed.id)?.title).toBe('Published NG')
  })

  it('keeps bundled IDs launchable beside a partial remote catalogue', () => {
    const remote = getZenExercise('ng-five-tone')
    const bundledOnly = getZenExercise('major-scale-ascending')
    expect(remote).not.toBeNull()
    expect(bundledOnly).not.toBeNull()
    if (remote === null || bundledOnly === null) return

    expect(
      installPublishedZenExercises([
        { ...remote, version: remote.version + 1, title: 'Remote NG' },
      ]),
    ).toBe(true)
    expect(zenExerciseCatalog()).toHaveLength(1)
    expect(getZenExercise('major-scale-ascending')).toEqual(bundledOnly)
  })

  it('keeps the current catalogue when any published item is invalid', () => {
    const before = zenExerciseCatalog()

    expect(installPublishedZenExercises([{ id: 'invalid' }])).toBe(false)
    expect(zenExerciseCatalog()).toBe(before)
  })

  it('indexes an exact pinned version without changing the active catalogue', () => {
    const seed = getZenExercise('ng-five-tone')
    expect(seed).not.toBeNull()
    if (seed === null) return
    const activeBefore = zenExerciseCatalog()
    const older = { ...seed, version: 7, title: 'Pinned revision' }

    expect(installPublishedZenExerciseVersion(older)).toBe(true)
    expect(zenExerciseCatalog()).toBe(activeBefore)
    expect(getZenExercise(seed.id, 7)?.title).toBe('Pinned revision')
  })
})
