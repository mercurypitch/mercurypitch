// Procedural Cloudway course — dynamic seed-generated course featuring ice glissade, crumble hexes, moving aurora glide ferry, and living crystal interiors.

import type { ProceduralGeneratorOptions } from '../authoring/procedural/contracts.ts'
import { generateProceduralCourse } from '../authoring/procedural/course-generator.ts'

export function createProceduralCourse(
  seedOrOptions:
    | number
    | string
    | ProceduralGeneratorOptions = 'daily-resonator',
) {
  if (typeof seedOrOptions === 'object' && seedOrOptions !== null) {
    return generateProceduralCourse(seedOrOptions)
  }
  return generateProceduralCourse({
    seed: seedOrOptions,
  })
}
