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

    // Kind-free content is valid under both, and means the same under both.
    expect(parseZenExerciseVersion(seed, 1).exercise?.id).toBe('noo-siren')
    expect(parseZenExerciseVersion(seed, 2).exercise?.id).toBe('noo-siren')
    expect(parseZenExerciseVersion(seed, 3)).toEqual({
      exercise: null,
      issues: [
        expect.objectContaining({
          path: 'schemaVersion',
          message: expect.stringContaining('Unsupported'),
        }),
      ],
    })
  })

  // v1 is frozen: a historical Ascent assignment stored as version one must
  // keep meaning exactly what it meant, and a block kind is not something it
  // could ever have contained.
  it('refuses a block kind under the frozen version-one schema', () => {
    const seed = getZenExercise('noo-siren')
    expect(seed).not.toBeNull()
    if (seed === null) return

    const withKind = {
      ...seed,
      targets: [
        {
          id: 'hiss',
          startBeat: 0,
          durationBeats: 4,
          semitone: 0,
          cue: 'sss',
          kind: 'amplitude' as const,
        },
      ],
    }

    expect(parseZenExerciseVersion(withKind, 1).exercise).toBeNull()
    expect(parseZenExerciseVersion(withKind, 2).exercise).not.toBeNull()
  })

  it('accepts a hiss and a breath alongside sung notes', () => {
    const seed = getZenExercise('noo-siren')
    expect(seed).not.toBeNull()
    if (seed === null) return

    const issues = validateZenExercise({
      ...seed,
      loopBeats: 12,
      targets: [
        { ...seed.targets[0]!, id: 'sung', startBeat: 0, durationBeats: 4 },
        {
          id: 'hiss',
          startBeat: 4,
          durationBeats: 4,
          semitone: 0,
          cue: 'sss',
          kind: 'amplitude',
        },
        {
          id: 'inhale',
          startBeat: 8,
          durationBeats: 4,
          semitone: 0,
          cue: 'Breathe in',
          kind: 'breath',
        },
      ],
    })

    expect(issues).toEqual([])
  })

  // A glide is a pitch idea. Letting one onto a hiss would ask the renderer
  // to draw a slide between two notes neither block has.
  it('refuses a glide on a block with no pitch', () => {
    const seed = getZenExercise('noo-siren')
    expect(seed).not.toBeNull()
    if (seed === null) return

    const issues = validateZenExercise({
      ...seed,
      targets: [
        {
          id: 'hiss',
          startBeat: 0,
          durationBeats: 4,
          semitone: 0,
          endSemitone: 12,
          cue: 'sss',
          kind: 'amplitude',
        },
      ],
    })

    expect(issues).toContainEqual(
      expect.objectContaining({ path: 'targets.0.endSemitone' }),
    )
  })

  it('refuses an exercise that is nothing but breathing', () => {
    const seed = getZenExercise('noo-siren')
    expect(seed).not.toBeNull()
    if (seed === null) return

    const issues = validateZenExercise({
      ...seed,
      targets: [
        {
          id: 'inhale',
          startBeat: 0,
          durationBeats: 4,
          semitone: 0,
          cue: 'Breathe in',
          kind: 'breath',
        },
      ],
    })

    expect(issues).toContainEqual(
      expect.objectContaining({
        path: 'targets',
        message: expect.stringContaining('nothing to hear'),
      }),
    )
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
