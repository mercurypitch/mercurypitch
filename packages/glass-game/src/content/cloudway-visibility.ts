// Cloudway visibility policy — bounded authoring distances shared by the compiler and renderer.

import type { LevelFogDefinition } from '../contracts'

export const CLOUDWAY_FOG_DEFAULTS: Readonly<LevelFogDefinition> =
  Object.freeze({
    kind: 'linear',
    nearMeters: 9,
    farMeters: 14,
  })

// The maximum fade plus the 2m cull margin remains below the smallest authored
// camera far plane (50m). Longer views require a separate device-budget study.
export const CLOUDWAY_FOG_LIMITS = Object.freeze({
  minimumNearMeters: 1,
  maximumFarMeters: 30,
  minimumSeparationMeters: 2,
})
