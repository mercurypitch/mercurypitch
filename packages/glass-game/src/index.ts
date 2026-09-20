// Glass game public API — content and simulation are independent of either product host.
export type * from './contracts'
export type * from './host'
export { GLASSWORKS } from './content/glassworks'
export { composeLevel } from './authoring/compose-level'
export { LevelAuthoringError } from './authoring/contracts'
export type * from './authoring/contracts'
export { createGlassGame } from './core/game'
export { createChallengeJudge } from './core/challenge'
export type {
  ChallengeJudge,
  ChallengeJudgeEvent,
  ChallengeJudgeResult,
  ChallengeProgress,
  ChallengeTargetError,
} from './core/challenge'
export {
  getActiveCourseSolids,
  getActiveSolidIds,
  solidActivationMet,
} from './core/solid-activation'
