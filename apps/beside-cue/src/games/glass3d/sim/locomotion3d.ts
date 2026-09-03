// Merc walks, and Merc jumps.
// ============================================================
//
// The Hallway moved him by adding a constant to `mercX` every step: the
// right amount of machinery for a scene with one pane in it, and the
// wrong amount for a room where standing in the correct place IS the
// puzzle (see docs/games/standing-wave-chamber.md §3).
//
// Two decisions are the whole design.
//
// IT TAKES AN INTENT, NOT A DEVICE. `{ move, jump }` is what a thumb, a
// keyboard, a replayed recording and a scripted walk-on all produce, so
// none of them has to be present for this to be exercised -- and the day
// the controls change, nothing in here does. It is the same seam the
// voice already has (`InteractionDriver`), for the same reason.
//
// IT KNOWS NOTHING ABOUT THE ROOM. The floor arrives as a function,
// `groundAt(x)`, and whether a given spot is SAFE to stand on is
// somebody else's question -- in a chamber it depends on which note is
// being sung, which is not a thing locomotion should ever have heard of.
// It reports where he is and whether he is on something; the stage
// decides what that means.
//
// The forgivenesses are the two every platformer has, and they are here
// from the start because retrofitting them means re-tuning everything
// that was tuned without them:
//
//   COYOTE TIME   a jump pressed just after walking off an edge still
//                 jumps. Without it, players who are not late report the
//                 game as unresponsive, and they are right to.
//   JUMP BUFFER   a jump pressed just before landing fires on landing.
//                 Without it, holding a rhythm means dropping inputs.

/** What the player is asking for, this step. */
export interface LocomotionIntent {
  /** -1 towards the start of the room, +1 towards the exit, 0 still.
   * Analogue on purpose: a thumb that has barely moved should barely
   * move him. */
  readonly move: number
  /** Held state, not an edge. This module owns the edge, because the
   * buffer below needs to know when the press STARTED and a caller
   * reporting edges cannot be trusted to have seen every frame. */
  readonly jump: boolean
}

export interface LocomotionConfig {
  /** Metres per second at full intent. */
  walkSpeed: number
  /** Seconds to reach `walkSpeed` from a standstill, and to stop again.
   * Not zero: instant velocity reads as sliding, not walking. */
  accelSeconds: number
  /** Apex height of a jump, in metres. The launch velocity is derived
   * from this and gravity rather than set directly, so tuning the arc
   * cannot silently change how high he reaches. */
  jumpHeight: number
  /** Metres per second squared, positive, applied downward. */
  gravity: number
  /** Grace after walking off an edge during which a jump still works. */
  coyoteSeconds: number
  /** How early a jump may be pressed before landing and still fire. */
  bufferSeconds: number
  /** Terminal downward speed. Caps how fast a long fall reads. */
  maxFallSpeed: number
  /** Where the room begins and ends. He cannot walk past either. */
  minX: number
  maxX: number
}

export interface LocomotionState {
  x: number
  /** Height above the room's floor plane. */
  y: number
  vx: number
  vy: number
  /** Standing on something as of the last step. */
  grounded: boolean
  /** -1 or +1. Held through a standstill, so he does not snap to face
   * the camera every time the player lets go. */
  facing: 1 | -1
  /** Seconds of coyote time left, counted down while airborne. */
  coyoteLeft: number
  /** Seconds a buffered jump remains willing to fire. */
  bufferLeft: number
  /** Last frame's jump button state, for the edge. */
  jumpWasDown: boolean
}

/**
 * The surface under his feet at a given x, or null where there is
 * nothing to stand on. Heights are absolute, so a platform is simply a
 * higher answer.
 *
 * `fromY` is where his feet already are, and it is not optional
 * bookkeeping: without it the sampler can only report the HIGHEST
 * surface over that x, and a walk into a ledge's shadow then reads as a
 * landing on top of it. That is not a hypothetical -- chamber 3's ledge
 * shipped as a free step up, and the jump it was built to need was
 * never once required. A sampler answers with the highest surface AT OR
 * BELOW him, so a ledge overhead is not a floor.
 */
export type GroundSampler = (x: number, fromY: number) => number | null

export const createLocomotion = (
  x: number,
  facing: 1 | -1 = 1,
): LocomotionState => ({
  x,
  y: 0,
  vx: 0,
  vy: 0,
  grounded: true,
  facing,
  coyoteLeft: 0,
  bufferLeft: 0,
  jumpWasDown: false,
})

/** The upward velocity that reaches `jumpHeight` under `gravity`. */
export const jumpVelocity = (cfg: LocomotionConfig): number =>
  Math.sqrt(2 * cfg.gravity * Math.max(0, cfg.jumpHeight))

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v

/**
 * One fixed step. Mutates `state`, like the resonance does, because it
 * is stepped up to 120 times a second and allocating a new object each
 * time is a cost with nothing to show for it.
 *
 * Returns whether this step LANDED him, which is the event a stage
 * wants (a sound, a puff of dust) and cannot recover from the state
 * afterwards.
 */
export const stepLocomotion = (
  state: LocomotionState,
  intent: LocomotionIntent,
  ground: GroundSampler,
  dt: number,
  cfg: LocomotionConfig,
): { landed: boolean } => {
  const move = clamp(Number.isFinite(intent.move) ? intent.move : 0, -1, 1)

  // Horizontal: accelerate towards the intended speed rather than
  // assuming it. `accelSeconds` is the time to cross the whole range, so
  // the step is a fraction of `walkSpeed` and not of the current gap --
  // an exponential approach never actually arrives.
  const wanted = move * cfg.walkSpeed
  const step = (cfg.walkSpeed * dt) / Math.max(cfg.accelSeconds, 1e-4)
  if (state.vx < wanted) state.vx = Math.min(wanted, state.vx + step)
  else if (state.vx > wanted) state.vx = Math.max(wanted, state.vx - step)

  if (move > 0) state.facing = 1
  else if (move < 0) state.facing = -1

  state.x = clamp(state.x + state.vx * dt, cfg.minX, cfg.maxX)
  // Walking into a wall should not leave momentum banked against it.
  if (state.x === cfg.minX || state.x === cfg.maxX) state.vx = 0

  // The jump edge, and the buffer it feeds.
  const pressed = intent.jump && !state.jumpWasDown
  state.jumpWasDown = intent.jump
  if (pressed) state.bufferLeft = cfg.bufferSeconds
  else state.bufferLeft = Math.max(0, state.bufferLeft - dt)

  const mayJump = state.grounded || state.coyoteLeft > 0
  if (state.bufferLeft > 0 && mayJump) {
    state.vy = jumpVelocity(cfg)
    state.grounded = false
    state.coyoteLeft = 0
    state.bufferLeft = 0
  }

  // Vertical.
  state.vy = Math.max(-cfg.maxFallSpeed, state.vy - cfg.gravity * dt)
  const wasGrounded = state.grounded
  const nextY = state.y + state.vy * dt
  const floor = ground(state.x, state.y)

  let landed = false
  if (floor !== null && state.vy <= 0 && nextY <= floor) {
    // Only landing on the way DOWN, so a jump through a platform's plane
    // is not caught by it on the way up. Coming from BELOW is the
    // sampler's job, not this test's: it never offers a surface above
    // his feet, so there is nothing here to be snapped up onto.
    state.y = floor
    state.vy = 0
    state.grounded = true
    state.coyoteLeft = cfg.coyoteSeconds
    landed = !wasGrounded
  } else {
    state.y = nextY
    state.grounded = false
    state.coyoteLeft = Math.max(0, state.coyoteLeft - dt)
  }

  return { landed }
}

/** Below this he is gone: the stage's cue to play the fall and reset. */
export const hasFallenOut = (state: LocomotionState, floorY: number): boolean =>
  state.y < floorY
