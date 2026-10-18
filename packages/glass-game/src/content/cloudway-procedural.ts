// Procedural Cloudway course — dynamic seed-generated course featuring ice glissade, crumble hexes, moving aurora glide ferry, and living crystal interiors.

import { generateProceduralCourse } from '../authoring/procedural/course-generator.ts'
import type { ProceduralGeneratorOptions } from '../authoring/procedural/contracts.ts'
import type { LevelDefinition } from '../contracts.ts'

export function createProceduralCourse(
  seedOrOptions: number | string | ProceduralGeneratorOptions = 'daily-resonator',
) {
  if (typeof seedOrOptions === 'object' && seedOrOptions !== null) {
    return generateProceduralCourse(seedOrOptions)
  }
  return generateProceduralCourse({
    seed: seedOrOptions,
  })
}

/** Default procedural showcase level with verified reachability and certified platform clearances. */
export const CLOUDWAY_PROCEDURAL: LevelDefinition =
  createProceduralCourse('celestial-prime').compiledLevel
