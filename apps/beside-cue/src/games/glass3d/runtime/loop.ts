// A fixed simulation step, whatever the renderer is doing.
// ============================================================
//
// The frame rate is not a design parameter, and the moment simulation is
// advanced by whatever `dt` the last frame happened to take, it becomes
// one: a phone that drops to 30fps gets different physics from the
// laptop the numbers were tuned on. So the loop accumulates real time
// and spends it in fixed steps.
//
// Two details that matter more than they look:
//
// `maxStepsPerFrame` is a spiral guard. If a frame takes long enough to
// owe more steps than that, the excess time is DROPPED rather than
// queued — otherwise a stall makes the next frame more expensive, which
// makes the stall longer, which is how a hitch becomes a freeze.
//
// The leftover accumulator is returned as `alpha`, the fraction of a
// step the renderer is ahead of the simulation. Interpolating the draw
// by it is what stops a 120 Hz fixed step from looking juddery at 60.

export interface LoopConfig {
  stepSeconds: number
  maxStepsPerFrame: number
}

export interface LoopState {
  /** Unspent real time, in seconds. */
  accumulator: number
  /** Simulation time elapsed, in seconds. Never runs ahead of real time. */
  simTime: number
  /** Steps dropped to the spiral guard — a straight measure of how far
   * behind we have fallen, and worth putting on the debug HUD. */
  droppedSteps: number
}

export const createLoopState = (): LoopState => ({
  accumulator: 0,
  simTime: 0,
  droppedSteps: 0,
})

export interface LoopResult {
  /** Fixed steps that ran this frame. */
  steps: number
  /** 0..1, how far past the last step the renderer should draw. */
  alpha: number
}

/**
 * Spend one frame's worth of real time in fixed steps.
 *
 * @param frameSeconds wall time since the last call. Negative or NaN is
 *   treated as zero — a clock that jumps backwards (a tab restored, a
 *   device waking) must not run the simulation backwards.
 */
export const runLoop = (
  state: LoopState,
  frameSeconds: number,
  cfg: LoopConfig,
  step: (dt: number, simTime: number) => void,
): LoopResult => {
  const delta =
    Number.isFinite(frameSeconds) && frameSeconds > 0 ? frameSeconds : 0
  state.accumulator += delta

  let steps = 0
  while (state.accumulator >= cfg.stepSeconds && steps < cfg.maxStepsPerFrame) {
    step(cfg.stepSeconds, state.simTime)
    state.simTime += cfg.stepSeconds
    state.accumulator -= cfg.stepSeconds
    steps++
  }

  // Owed more than the guard allows: drop the rest rather than let the
  // debt compound into the next frame.
  if (state.accumulator >= cfg.stepSeconds) {
    const owed = Math.floor(state.accumulator / cfg.stepSeconds)
    state.droppedSteps += owed
    state.accumulator -= owed * cfg.stepSeconds
  }

  return { steps, alpha: state.accumulator / cfg.stepSeconds }
}
