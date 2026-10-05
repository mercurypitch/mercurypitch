// Crystal obstacle art — versioned donors share the course's explicit collision envelopes.
export const RUNNER_OBSTACLE_ART = {
  'runner-crystal-bulwark-v1': {
    bundle: 'runner-crystal-bulwark-v1',
    root: 'B01_Blocker',
    parts: ['B01_Crystal', 'B01_Gold'],
  },
  'runner-crystal-bulwark-wide-v1': {
    bundle: 'runner-crystal-bulwark-v1',
    root: 'B01_Blocker',
    parts: ['B01_Crystal', 'B01_Gold'],
  },
  'runner-rose-hurdle-v1': {
    bundle: 'runner-rose-hurdle-v1',
    root: 'J01_Hurdle',
    parts: ['J01_Crystal', 'J01_Gold'],
  },
} as const

type RunnerObstacleArt =
  (typeof RUNNER_OBSTACLE_ART)[keyof typeof RUNNER_OBSTACLE_ART]

export function runnerObstacleArt(
  profileId: string,
): RunnerObstacleArt | undefined {
  return RUNNER_OBSTACLE_ART[profileId as keyof typeof RUNNER_OBSTACLE_ART]
}
