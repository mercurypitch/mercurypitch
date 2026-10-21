// Course recipes round-trip between hosts without aliasing another course's progress.
import { describe, expect, it } from 'vitest'
import { decodeProceduralCourseCode, encodeProceduralCourseCode, getProceduralCourseIdentity, normalizeProceduralCourseOptions, PROCEDURAL_CODE_LIMIT, } from './course-options.ts'

const base = { seed: 'pearl garden' }
const wrap = (value: unknown) =>
  `cloudway:v1:${btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`

describe('portable course recipes', () => {
  it.each([
    'pearl garden',
    '𝄞 Čarobni vrt',
    '42',
    42,
    -42,
    0,
    Number.MAX_SAFE_INTEGER,
  ])('round-trips typed seed %s and all settings', (seed) => {
    const options = normalizeProceduralCourseOptions({
      seed,
      difficulty: 'virtuoso',
      melodyLessonId: 'two-windows-v1',
      fogTheme: 'twilight',
      includeLivingCrystals: false,
      includeOptionalAlcoves: false,
    })
    expect(
      decodeProceduralCourseCode(encodeProceduralCourseCode(options)),
    ).toEqual(options)
  })

  it('uses the same identity for implicit and explicit defaults regardless of key order', () => {
    const normalized = normalizeProceduralCourseOptions(base)
    expect(getProceduralCourseIdentity(base)).toBe(
      getProceduralCourseIdentity(
        Object.fromEntries(Object.entries(normalized).reverse()),
      ),
    )
    expect(encodeProceduralCourseCode(base)).toBe(
      encodeProceduralCourseCode(normalized),
    )
  })

  it('isolates all generation settings and seed types in the saved course identity', () => {
    const variants = [
      base,
      { seed: 42 },
      { seed: '42' },
      { seed: 'Pearl garden' },
      { ...base, difficulty: 'gentle' },
      { ...base, melodyLessonId: 'gallery-arch-v1' },
      { ...base, fogTheme: 'dawn' },
      { ...base, includeLivingCrystals: false },
      { ...base, includeOptionalAlcoves: false },
      { ...base, title: 'A different title' },
    ]
    expect(new Set(variants.map(getProceduralCourseIdentity)).size).toBe(
      variants.length,
    )
  })

  it('preserves an authored identity but never imports an identity override', () => {
    expect(
      getProceduralCourseIdentity({ ...base, courseId: 'author-course' }),
    ).toBe('author-course')
    expect(() =>
      encodeProceduralCourseCode({ ...base, courseId: 'campaign-id' }),
    ).toThrow()
    expect(() =>
      decodeProceduralCourseCode(
        wrap({
          ...normalizeProceduralCourseOptions(base),
          courseId: 'campaign-id',
        }),
      ),
    ).toThrow()
    expect(() =>
      decodeProceduralCourseCode(
        wrap({ ...normalizeProceduralCourseOptions(base), title: 'Changed' }),
      ),
    ).toThrow()
  })

  it.each([
    null,
    [],
    {},
    { seed: '' },
    { seed: '  ' },
    { seed: 'x'.repeat(129) },
    { seed: Infinity },
    { seed: NaN },
    { seed: 1.1 },
    { seed: Number.MAX_SAFE_INTEGER + 1 },
    { seed: 'a\n' },
    { seed: '\ud800' },
    { seed: true },
    { seed: {} },
    { ...base, difficulty: 'expert' },
    { ...base, melodyLessonId: 'missing' },
    { ...base, fogTheme: '__proto__' },
    { ...base, includeLivingCrystals: 'false' },
    { ...base, includeOptionalAlcoves: null },
    { ...base, extra: true },
    { ...base, title: '' },
    { ...base, courseId: '' },
    Object.create({ seed: 'inherited' }),
  ])('rejects invalid or unbounded generator settings %#', (value) => {
    expect(() => normalizeProceduralCourseOptions(value)).toThrow()
  })

  it.each([
    '',
    'https://example.test/?seed=hello',
    'cloudway:v2:AAAA',
    'cloudway:v1:!',
    'cloudway:v1:abcd',
    wrap(base),
    wrap(null),
    wrap([]),
    `cloudway:v1:${btoa('{"seed":"hello","__proto__":{}}')}`,
    'x'.repeat(PROCEDURAL_CODE_LIMIT + 1),
  ])('rejects damaged, incomplete or unsupported codes %#', (code) => {
    expect(() => decodeProceduralCourseCode(code)).toThrow()
  })

  it('bounds worst-case unicode input while preserving it exactly', () => {
    const seed = '𝄞'.repeat(128)
    const code = encodeProceduralCourseCode({ seed })
    expect(code.length).toBeLessThan(PROCEDURAL_CODE_LIMIT)
    expect(decodeProceduralCourseCode(code).seed).toBe(seed)
  })
})
