// ============================================================
// Frame loop: a premium room's one loop a screen frame
// ============================================================
//
// While a room listens (Echo's call and response, a glide run or its
// settle, Long note's take) it runs one loop a screen frame: it hears the
// new frames, then hands the scene its frame. The loop asks for the next
// screen frame only while the screen is alive and the room still runs, and
// only if this frame did not already ask: a frame that ends a take and
// opens the next (Long note's false start) has started the loop again, and
// one loop must stay one.
//
// The callback handed to requestAnimationFrame is a function named `tick`:
// Long note's tests count the queued `tick`s to prove one take loop.

export interface FrameGate {
  /** False once the screen has gone (room-life.ts). */
  readonly alive: () => boolean
  /** The room still wants frames: a run, a take or a settle is on. */
  readonly running: () => boolean
}

export interface FrameLoop {
  /** Asks for the next screen frame, unless one is asked for already. */
  readonly start: () => void
  /** Takes back the screen frame asked for, if any. */
  readonly stop: () => void
}

/** `frame` once a screen frame, while `gate` lets it run. */
export function createFrameLoop(frame: () => void, gate: FrameGate): FrameLoop {
  let asked = 0

  function tick(): void {
    asked = 0
    if (!gate.alive() || !gate.running()) return
    frame()
    if (gate.alive() && gate.running() && asked === 0) {
      asked = requestAnimationFrame(tick)
    }
  }

  return {
    start: () => {
      if (asked === 0) asked = requestAnimationFrame(tick)
    },
    stop: () => {
      if (asked !== 0) cancelAnimationFrame(asked)
      asked = 0
    },
  }
}
