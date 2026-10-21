// Procedural course recipes — bounded, versioned settings preserve identity across hosts.
import type { ProceduralGeneratorOptions } from './contracts.ts'

export const PROCEDURAL_COURSE_VERSION = 1
export const PROCEDURAL_SEED_LIMIT = 128
export const PROCEDURAL_CODE_LIMIT = 2048
const CODE_PREFIX = `cloudway:v${PROCEDURAL_COURSE_VERSION}:`
const recipeKeys = [
  'seed',
  'difficulty',
  'melodyLessonId',
  'fogTheme',
  'includeLivingCrystals',
  'includeOptionalAlcoves',
] as const

export type NormalizedProceduralCourseOptions = Required<
  Omit<ProceduralGeneratorOptions, 'courseId' | 'title'>
> &
  Pick<ProceduralGeneratorOptions, 'courseId' | 'title'>

function object(
  value: unknown,
  allowed: readonly string[],
): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  ) {
    throw new Error('Course settings must be an object.')
  }
  const result = value as Record<string, unknown>
  if (Object.keys(result).some((key) => !allowed.includes(key))) {
    throw new Error('Course settings contain an unsupported field.')
  }
  return result
}

function choice<T extends string>(
  value: unknown,
  values: readonly T[],
  fallback: T,
): T {
  if (value === undefined) return fallback
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new Error('Choose one of the supported course settings.')
  }
  return value as T
}

function flag(value: unknown): boolean {
  if (value === undefined) return true
  if (typeof value !== 'boolean')
    throw new Error('Course switches must be true or false.')
  return value
}

function text(value: unknown, name: string, limit: number): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    Array.from(value).length > limit ||
    Array.from(value).some((character) => {
      const point = character.codePointAt(0)!
      return point < 32 || point === 127 || (point >= 0xd800 && point <= 0xdfff)
    })
  ) {
    throw new Error(
      `${name} must contain 1 to ${limit} characters without control characters.`,
    )
  }
  return value
}

export function normalizeProceduralCourseOptions(
  value: unknown,
): NormalizedProceduralCourseOptions {
  const source = object(value, [...recipeKeys, 'courseId', 'title'])
  const seed =
    typeof source.seed === 'number'
      ? source.seed === 0
        ? 0
        : source.seed
      : text(source.seed, 'Course seed', PROCEDURAL_SEED_LIMIT)
  if (typeof seed === 'number' && !Number.isSafeInteger(seed)) {
    throw new Error('A numeric course seed must be a finite safe integer.')
  }
  return {
    seed,
    difficulty: choice(
      source.difficulty,
      ['gentle', 'balanced', 'virtuoso'],
      'balanced',
    ),
    melodyLessonId: choice(
      source.melodyLessonId,
      ['first-arc-v1', 'sunlit-steps-v1', 'gallery-arch-v1', 'two-windows-v1'],
      'first-arc-v1',
    ),
    fogTheme: choice(
      source.fogTheme,
      ['dawn', 'celestial', 'aurora', 'twilight'],
      'celestial',
    ),
    includeLivingCrystals: flag(source.includeLivingCrystals),
    includeOptionalAlcoves: flag(source.includeOptionalAlcoves),
    ...(source.courseId === undefined
      ? {}
      : { courseId: text(source.courseId, 'Course identity', 128) }),
    ...(source.title === undefined
      ? {}
      : { title: text(source.title, 'Course title', 128) }),
  }
}

function encode(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function getProceduralCourseIdentity(value: unknown): string {
  const options = normalizeProceduralCourseOptions(value)
  // Authored identities remain an explicit trusted-authoring override. Imported
  // recipes cannot set them, so another course's saved progress stays isolated.
  if (options.courseId !== undefined) return options.courseId
  return `cloudway-procedural-v${PROCEDURAL_COURSE_VERSION}-${encode(options)}`
}

export function encodeProceduralCourseCode(value: unknown): string {
  object(value, recipeKeys)
  const code = CODE_PREFIX + encode(normalizeProceduralCourseOptions(value))
  if (code.length > PROCEDURAL_CODE_LIMIT)
    throw new Error('The course code is too long.')
  return code
}

export function decodeProceduralCourseCode(
  value: string,
): NormalizedProceduralCourseOptions {
  if (typeof value !== 'string' || value.length > PROCEDURAL_CODE_LIMIT) {
    throw new Error('The course code is too long.')
  }
  const code = value.trim()
  if (!code.startsWith(CODE_PREFIX))
    throw new Error('Use a supported Cloudway course code (v1).')
  const payload = code.slice(CODE_PREFIX.length)
  if (!/^[A-Za-z0-9_-]+$/.test(payload))
    throw new Error('The course code is incomplete or damaged.')
  try {
    const bytes = Uint8Array.from(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/')),
      (char) => char.charCodeAt(0),
    )
    const raw: unknown = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    )
    object(raw, recipeKeys)
    const options = normalizeProceduralCourseOptions(raw)
    // Require a complete canonical recipe, including every switch and version.
    if (encodeProceduralCourseCode(options) !== code)
      throw new Error('Noncanonical recipe')
    return options
  } catch {
    throw new Error(
      'The course code is incomplete or contains unsupported settings.',
    )
  }
}
