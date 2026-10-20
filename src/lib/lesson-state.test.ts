// @vitest-environment node

import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { LESSON_STATE_VERSION, parseLessonNumber, parseLessonPatch, parseLessonState, VARIANT_ID, } from './lesson-state'

const state = (lessons: unknown, extra: Record<string, unknown> = {}) => ({
  version: 1,
  updatedAt: '2026-10-20T12:00:00.000Z',
  lessons,
  ...extra,
})

describe('VARIANT_ID', () => {
  it('admits 1 to 32 lowercase letters, digits and hyphens that do not lead with a hyphen', () => {
    const admitted = ['a', '3', 'short', 'v2-question', 'a'.repeat(32), '0-']
    const refused = [
      '',
      '-a',
      'A',
      'Short',
      'two words',
      'a_b',
      'a'.repeat(33),
      'a\n',
      'é',
    ]

    expect(admitted.filter((id) => !VARIANT_ID.test(id))).toEqual([])
    expect(refused.filter((id) => VARIANT_ID.test(id))).toEqual([])
  })
})

describe('parseLessonNumber', () => {
  it('reads one or two digits as a lesson from 0 to 99', () => {
    expect(['0', '3', '03', '14', '99'].map(parseLessonNumber)).toEqual([
      0, 3, 3, 14, 99,
    ])
  })

  it('refuses anything else', () => {
    const refused = ['', '100', '-1', '3.5', ' 3', '3 ', '1e1', 'abc', '０']

    expect(refused.map(parseLessonNumber)).toEqual(refused.map(() => null))
  })
})

describe('parseLessonState', () => {
  it('reads a well-formed state as it was written', () => {
    const written = state({
      '0': { hook: 'question' },
      '3': { published: true, hook: 'short', tease: 'stair' },
      '14': { published: false },
    })

    expect(parseLessonState(written)).toEqual(written)
  })

  it('reads the empty state as no overrides at all', () => {
    expect(
      parseLessonState({ version: 1, updatedAt: null, lessons: {} }),
    ).toEqual({ version: LESSON_STATE_VERSION, updatedAt: null, lessons: {} })
  })

  it('returns null for a version it does not know', () => {
    const versions = [2, 0, '1', null, undefined]

    expect(
      versions.map((version) => parseLessonState(state({}, { version }))),
    ).toEqual(versions.map(() => null))
  })

  it('returns null for something that is not a state object', () => {
    const values = [null, undefined, 'state', 1, true, [state({})]]

    expect(values.map(parseLessonState)).toEqual(values.map(() => null))
  })

  it('drops a lesson key outside "0" to "99"', () => {
    // Parsed from text, as the API's answer is: JSON.parse makes
    // "__proto__" an own key, where an object literal would not.
    const read = parseLessonState(
      JSON.parse(
        JSON.stringify(state({})).replace(
          '"lessons":{}',
          `"lessons":{${['3', '03', '100', '-1', '1.5', 'abc', '__proto__']
            .map((key) => `"${key}":{"published":true}`)
            .join(',')}}`,
        ),
      ),
    )

    expect(Object.keys(read?.lessons ?? {})).toEqual(['3'])
    expect(Object.getPrototypeOf(read?.lessons)).toBe(Object.prototype)
  })

  it('drops a field it does not understand and keeps the rest of the lesson', () => {
    const read = parseLessonState(
      state({
        '1': { published: 'yes', hook: 'short', film: 'live' },
        '2': { published: true, hook: 'Not An Id', tease: 7 },
      }),
    )

    expect(read?.lessons).toEqual({
      '1': { hook: 'short' },
      '2': { published: true },
    })
  })

  it('leaves out a lesson whose override sets nothing it understands', () => {
    const read = parseLessonState(
      state({
        '1': { published: null, hook: null, tease: null },
        '2': {},
        '3': 'published',
        '4': [true],
        '5': null,
        '6': { published: 1 },
      }),
    )

    expect(read?.lessons).toEqual({})
  })

  it('reads a missing or malformed lessons map as no overrides', () => {
    const maps = [undefined, null, [], 'lessons', 3]

    expect(
      maps.map((lessons) => parseLessonState(state(lessons))?.lessons),
    ).toEqual(maps.map(() => ({})))
  })

  it('reads a missing or malformed updatedAt as null', () => {
    const times = [undefined, null, 1760961600000, { at: 'noon' }]

    expect(
      times.map(
        (updatedAt) => parseLessonState(state({}, { updatedAt }))?.updatedAt,
      ),
    ).toEqual(times.map(() => null))
  })

  it('ignores keys beside version, updatedAt and lessons', () => {
    const read = parseLessonState(state({}, { owner: 'someone', debug: true }))

    expect(read).toEqual({
      version: 1,
      updatedAt: '2026-10-20T12:00:00.000Z',
      lessons: {},
    })
  })

  describe('properties', () => {
    it('never throws, and reads its own output back unchanged', () => {
      fc.assert(
        fc.property(fc.jsonValue(), fc.jsonValue(), (lessons, updatedAt) => {
          const once = parseLessonState({ version: 1, updatedAt, lessons })

          expect(once).not.toBeNull()
          expect(parseLessonState(once)).toEqual(once)
        }),
        { numRuns: 500 },
      )
    })

    it('keeps only canonical lesson keys, each with at least one valid field', () => {
      const override = fc.record(
        {
          published: fc.oneof(fc.boolean(), fc.constant(null), fc.string()),
          hook: fc.oneof(
            fc.stringMatching(VARIANT_ID),
            fc.string(),
            fc.constant(null),
          ),
          tease: fc.oneof(fc.stringMatching(VARIANT_ID), fc.integer()),
        },
        { requiredKeys: [] },
      )
      const lessons = fc.dictionary(
        fc.oneof(fc.integer({ min: -5, max: 120 }).map(String), fc.string()),
        override,
      )

      fc.assert(
        fc.property(lessons, (map) => {
          const read = parseLessonState({
            version: 1,
            updatedAt: null,
            lessons: map,
          })

          for (const [key, value] of Object.entries(read?.lessons ?? {})) {
            expect(String(Number(key))).toBe(key)
            expect(Number(key)).toBeGreaterThanOrEqual(0)
            expect(Number(key)).toBeLessThanOrEqual(99)
            expect(Object.keys(value).length).toBeGreaterThan(0)
            if (value.published !== undefined) {
              expect(typeof value.published).toBe('boolean')
            }
            for (const id of [value.hook, value.tease]) {
              if (id !== undefined) expect(id).toMatch(VARIANT_ID)
            }
          }
        }),
        { numRuns: 500 },
      )
    })
  })
})

describe('parseLessonPatch', () => {
  it('accepts each field on its own, and null to clear it', () => {
    const bodies = [
      { published: true },
      { published: false },
      { published: null },
      { hook: 'short' },
      { hook: null },
      { tease: 'stair' },
      { tease: null },
    ]

    expect(bodies.map(parseLessonPatch)).toEqual(
      bodies.map((patch) => ({ ok: true, patch })),
    )
  })

  it('accepts all three fields together', () => {
    const body = { published: true, hook: 'v2', tease: null }

    expect(parseLessonPatch(body)).toEqual({ ok: true, patch: body })
  })

  it('refuses a key it does not know, even beside valid ones', () => {
    expect(parseLessonPatch({ published: true, film: 'live' })).toEqual({
      ok: false,
      error: 'Unknown field: film',
    })
  })

  it('refuses published that is not true, false, or null', () => {
    const values = [1, 0, 'true', 'false', {}, []]

    expect(values.map((published) => parseLessonPatch({ published }))).toEqual(
      values.map(() => ({
        ok: false,
        error: 'published must be true, false, or null',
      })),
    )
  })

  it('refuses a hook or tease that is not a variant id or null', () => {
    const values = ['', 'Short', '-a', 'a'.repeat(33), 'two words', 3, true]
    const results = ['hook', 'tease'].flatMap((field) =>
      values.map((value) => parseLessonPatch({ [field]: value })),
    )

    expect(results.map((result) => result.ok)).toEqual(results.map(() => false))
    expect(parseLessonPatch({ tease: 'Short' })).toEqual({
      ok: false,
      error:
        'tease must be null or a variant id: 1 to 32 lowercase letters, digits, or hyphens, not starting with a hyphen',
    })
  })

  it('refuses a body that names no field', () => {
    expect(parseLessonPatch({})).toEqual({
      ok: false,
      error: 'Set at least one of published, hook, or tease',
    })
  })

  it('refuses a body that is not an object', () => {
    const bodies = [null, undefined, [], [{ published: true }], 'x', 1, true]

    expect(bodies.map(parseLessonPatch)).toEqual(
      bodies.map(() => ({ ok: false, error: 'Body must be a JSON object' })),
    )
  })

  it('counts a field whose value is undefined as absent', () => {
    expect(parseLessonPatch({ published: true, hook: undefined })).toEqual({
      ok: true,
      patch: { published: true },
    })
    expect(parseLessonPatch({ hook: undefined }).ok).toBe(false)
  })

  it('accepts every patch of valid values, which the tolerant reader then reads back', () => {
    const variant = fc.oneof(fc.stringMatching(VARIANT_ID), fc.constant(null))
    const patches = fc.record(
      {
        published: fc.oneof(fc.boolean(), fc.constant(null)),
        hook: variant,
        tease: variant,
      },
      { requiredKeys: [] },
    )

    fc.assert(
      fc.property(patches, (body) => {
        const result = parseLessonPatch(body)
        const set = Object.fromEntries(
          Object.entries(body).filter(([, value]) => value !== null),
        )
        const read = parseLessonState({
          version: 1,
          updatedAt: null,
          lessons: { '7': body },
        })

        expect(result).toEqual(
          Object.keys(body).length > 0
            ? { ok: true, patch: body }
            : {
                ok: false,
                error: 'Set at least one of published, hook, or tease',
              },
        )
        expect(read?.lessons['7'] ?? {}).toEqual(set)
      }),
      { numRuns: 500 },
    )
  })
})
