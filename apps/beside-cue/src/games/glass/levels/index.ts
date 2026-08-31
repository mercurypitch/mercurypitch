// The V1 songbook: public-domain melodies and our own originals, in our
// own arrangements, as data (see melody-levels.md, songbook rule).
// Ordered as a learning path: wide intervals first, then the round,
// then semitone control, the chase, and the chromatic descent.

import { FRERE_JACQUES } from './frere-jacques'
import { FUR_ELISE } from './fur-elise'
import { HABANERA } from './habanera'
import { MOUNTAIN_KING } from './mountain-king'
import { ODE_TO_JOY } from './ode-to-joy'
import { THE_GLASSWORKS } from './the-glassworks'
import { TWINKLE_TWINKLE } from './twinkle-twinkle'
import type { LevelDef } from './types'

export { compileLevel } from './compile'
export type { CompiledStage, CompileOpts, PlayMode } from './compile'
export {
  FRERE_JACQUES,
  THE_GLASSWORKS,
  FUR_ELISE,
  HABANERA,
  MOUNTAIN_KING,
  ODE_TO_JOY,
  TWINKLE_TWINKLE,
}
export type { LevelDef, MelodyDef, Segment } from './types'

export const SONGBOOK: readonly LevelDef[] = [
  THE_GLASSWORKS,
  ODE_TO_JOY,
  TWINKLE_TWINKLE,
  FRERE_JACQUES,
  FUR_ELISE,
  MOUNTAIN_KING,
  HABANERA,
]
