// Cloudway visibility compiler — strict schema-4 fog values with path-specific errors.

import { CLOUDWAY_FOG_LIMITS } from '../content/cloudway-visibility.ts'
import type { LevelFogDefinition } from '../contracts'
import { exactKeys, fail, finite, record, } from './cloudway-course-validation.ts'

export function compileCloudwayFog(
  raw: unknown,
  path: string,
): LevelFogDefinition | undefined {
  if (raw === undefined) return undefined
  const source = record(raw, path)
  exactKeys(source, path, ['kind', 'nearMeters', 'farMeters'])
  if (source.kind !== 'linear') fail(`${path}.kind`, 'must be linear.')
  const nearMeters = finite(source.nearMeters, `${path}.nearMeters`)
  const farMeters = finite(source.farMeters, `${path}.farMeters`)
  if (nearMeters < CLOUDWAY_FOG_LIMITS.minimumNearMeters)
    fail(
      `${path}.nearMeters`,
      `must be at least ${CLOUDWAY_FOG_LIMITS.minimumNearMeters}m.`,
    )
  if (farMeters > CLOUDWAY_FOG_LIMITS.maximumFarMeters)
    fail(
      `${path}.farMeters`,
      `must be at most ${CLOUDWAY_FOG_LIMITS.maximumFarMeters}m.`,
    )
  if (farMeters - nearMeters < CLOUDWAY_FOG_LIMITS.minimumSeparationMeters)
    fail(
      `${path}.farMeters`,
      `must be at least ${CLOUDWAY_FOG_LIMITS.minimumSeparationMeters}m beyond nearMeters.`,
    )
  return { kind: 'linear', nearMeters, farMeters }
}
