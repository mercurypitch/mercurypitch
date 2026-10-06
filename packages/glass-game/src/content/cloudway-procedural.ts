// Procedural Cloudway course — dynamic seed-generated course featuring ice glissade, crumble hexes, moving aurora glide ferry, and living crystal interiors.

import { generateProceduralCourse } from '../authoring/procedural/course-generator.ts'
import type { LevelDefinition } from '../contracts.ts'

export function createProceduralCourse(seed: number | string = 'daily-resonator') {
  return generateProceduralCourse({
    seed,
  })
}

/** Default procedural showcase level with verified reachability and certified platform clearances. */
export const CLOUDWAY_PROCEDURAL: LevelDefinition =
  createProceduralCourse('celestial-prime').compiledLevel
