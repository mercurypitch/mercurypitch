// Cloudway course validation primitives — parse strict JSON fields with useful author paths.

import type { Bounds3, PlatformRenderQuarterTurns, Vec3 } from '../contracts'

export const CLOUDWAY_GAP_TOLERANCE = 1e-6
const CARDINAL_YAW_TOLERANCE = 1e-8

export type JsonRecord = Record<string, unknown>

export function fail(path: string, message: string): never {
  throw new Error(`${path} ${message}`)
}

export function record(value: unknown, path: string): JsonRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return fail(path, 'must be an object.')
  return value as JsonRecord
}

export function exactKeys(
  value: JsonRecord,
  path: string,
  required: readonly string[],
  optional: readonly string[] = [],
): void {
  const allowed = new Set([...required, ...optional])
  const unknown = Object.keys(value).find((key) => !allowed.has(key))
  if (unknown !== undefined) fail(`${path}.${unknown}`, 'is not supported.')
  const missing = required.find((key) => !(key in value))
  if (missing !== undefined) fail(`${path}.${missing}`, 'is required.')
}

export function string(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0)
    return fail(path, 'must be a non-empty string.')
  return value
}

export function finite(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    return fail(path, 'must be finite.')
  return value
}

export function positive(value: unknown, path: string): number {
  const result = finite(value, path)
  if (result <= 0) fail(path, 'must be positive.')
  return result
}

export function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') return fail(path, 'must be boolean.')
  return value
}

export function array(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) return fail(path, 'must be an array.')
  return value
}

export function stringArray(value: unknown, path: string): readonly string[] {
  return array(value, path).map((item, index) =>
    string(item, `${path}[${index}]`),
  )
}

export function vec3(value: unknown, path: string): Vec3 {
  const source = record(value, path)
  exactKeys(source, path, ['x', 'y', 'z'])
  return {
    x: finite(source.x, `${path}.x`),
    y: finite(source.y, `${path}.y`),
    z: finite(source.z, `${path}.z`),
  }
}

export function bounds3(value: unknown, path: string): Bounds3 {
  const source = record(value, path)
  exactKeys(source, path, ['minX', 'maxX', 'minY', 'maxY', 'minZ', 'maxZ'])
  const bounds = {
    minX: finite(source.minX, `${path}.minX`),
    maxX: finite(source.maxX, `${path}.maxX`),
    minY: finite(source.minY, `${path}.minY`),
    maxY: finite(source.maxY, `${path}.maxY`),
    minZ: finite(source.minZ, `${path}.minZ`),
    maxZ: finite(source.maxZ, `${path}.maxZ`),
  }
  if (
    bounds.minX >= bounds.maxX ||
    bounds.minY >= bounds.maxY ||
    bounds.minZ >= bounds.maxZ
  )
    fail(path, 'must contain ordered bounds.')
  return bounds
}

export function identifierSet(
  values: readonly string[],
  path: string,
): Set<string> {
  const result = new Set<string>()
  for (const [index, value] of values.entries()) {
    if (result.has(value))
      fail(`${path}[${index}]`, `duplicates id "${value}".`)
    result.add(value)
  }
  return result
}

export function quarterTurns(
  value: unknown,
  path: string,
): PlatformRenderQuarterTurns {
  if (value !== 0 && value !== 1 && value !== 2 && value !== 3)
    return fail(path, 'must be one of 0, 1, 2 or 3.')
  return value
}

export function cardinalQuarterTurns(
  yaw: number,
  path: string,
): PlatformRenderQuarterTurns {
  const turns = Math.round(yaw / (Math.PI / 2))
  if (Math.abs(yaw - turns * (Math.PI / 2)) > CARDINAL_YAW_TOLERANCE)
    return fail(path, 'must be a finite cardinal yaw in radians.')
  return (((turns % 4) + 4) % 4) as PlatformRenderQuarterTurns
}
