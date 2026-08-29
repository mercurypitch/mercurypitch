// The V1 songbook: public-domain melodies and our own originals, in our
// own arrangements, as data (see melody-levels.md, songbook rule).

import { FRERE_JACQUES } from './frere-jacques'
import { ODE_TO_JOY } from './ode-to-joy'
import { TWINKLE_TWINKLE } from './twinkle-twinkle'
import type { LevelDef } from './types'

export { compileLevel } from './compile'
export type { CompiledStage, CompileOpts, PlayMode } from './compile'
export { FRERE_JACQUES, ODE_TO_JOY, TWINKLE_TWINKLE }
export type { LevelDef, MelodyDef, Segment } from './types'

export const SONGBOOK: readonly LevelDef[] = [
  ODE_TO_JOY,
  TWINKLE_TWINKLE,
  FRERE_JACQUES,
]
