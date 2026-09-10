// Calm: fewer drawn frames while nothing is happening.
// ============================================================
//
// The idle loop is the thermal budget (glass-3d.md §5.4). A phone starts
// throttling after a minute or so of sustained rendering, and the risk
// is never the shatter itself -- it is everything drawn BEFORE it, so
// the burst lands on a GPU that is already hot. Every stage used to draw
// every frame from mount to unmount, whether anybody was playing or not.
//
// P3 (slice-5-polish-to-v1.md §2.1) chose calm over stop: after three
// seconds with no touch, no key, no voiced frame and nothing moving, the
// stage draws at half rate, and the next touch, key or voiced frame puts
// it back to full rate on that very frame. Stopping outright would
// freeze Merc mid-breath, which reads as a crash rather than as rest.
//
// ONLY THE DRAWING SLOWS. The stage still runs every frame: the fixed-step
// simulation (runtime/loop.ts) is fed the same wall time either way,
// input is read every frame, and this function is asked every frame --
// which is what lets a touch be answered on the frame it arrives in
// rather than on the next frame that happens to be drawn.
//
// Calm is a RATE, not a ratio: `fps` frames a second, by the clock. That
// is half of a 60 Hz screen and a quarter of a 120 Hz one, and it leaves
// a phone that Low Power Mode already holds at 30 exactly where it is --
// halving that would draw a breathing Merc at 15.

export interface CalmConfig {
  /** Seconds with no touch, key, voice or motion before the stage calms. */
  afterSeconds: number
  /** Frames drawn a second while calm. */
  fps: number
}

export interface CalmState {
  /** Wall seconds of the last thing that asked for full rate. */
  activeAt: number
  /** Wall seconds of the last drawn frame. */
  drawnAt: number
  /** Whether the stage is calm right now, for the chip. */
  calm: boolean
}

/** What happened this frame that calm has to answer to. */
export interface Activity {
  /** A touch, a key, or the pad held down. */
  input: boolean
  /** A voiced frame from the microphone. */
  voiced: boolean
  /** Something on screen that half rate would visibly stutter: shards in
   * the air, a fall, a room handing over, Merc walking or in the air. */
  moving: boolean
}

export const createCalmState = (now: number): CalmState => ({
  activeAt: now,
  drawnAt: Number.NEGATIVE_INFINITY,
  calm: false,
})

/**
 * How early a calm frame may come and still count as due, as a fraction
 * of the calm interval. rAF frames land a hair either side of their
 * nominal spacing, so a threshold of exactly 1/fps would sometimes skip
 * a 60 Hz screen's second frame and draw its third, which is 20 fps and
 * a visible hitch. At 0.85 a 60 Hz screen draws every second frame, 90 Hz
 * every third and 120 Hz every fourth, with room for jitter either side.
 */
const DUE = 0.85

/**
 * Decide whether this frame is drawn. Advances `state`.
 *
 * @param now wall time in seconds. A clock that jumps backwards (a tab
 *   restored, a device waking) or is not a number draws, and restarts the
 *   calm interval from here: skipping frames until a clock catches up
 *   with a time it has already passed would freeze the screen.
 */
export const stepCalm = (
  state: CalmState,
  now: number,
  activity: Activity,
  cfg: CalmConfig,
): boolean => {
  if (!Number.isFinite(now) || now < state.drawnAt || now < state.activeAt) {
    state.activeAt = Number.isFinite(now) ? now : state.activeAt
    state.drawnAt = Number.isFinite(now) ? now : state.drawnAt
    state.calm = false
    return true
  }
  if (activity.input || activity.voiced || activity.moving) state.activeAt = now

  state.calm = now - state.activeAt >= cfg.afterSeconds
  const interval = cfg.fps > 0 ? 1 / cfg.fps : 0
  if (!state.calm || now - state.drawnAt >= interval * DUE) {
    state.drawnAt = now
    return true
  }
  return false
}
