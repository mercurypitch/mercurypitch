// ============================================================
// What the middle of the room is showing
// ============================================================
//
// Four pictures, one question, and the answer is a pure function of the
// machine's context — so it is here rather than in a nest of `<Show>`
// fallbacks nobody can read the order of.
//
// THE MELODY PREVIEW IS DEVICE ROUND 2, R1. A melody stays loaded after a
// take: the chip still names it and the capsule reads "Continue", so the
// staff has to agree with them. Resting with one loaded draws that melody's
// target line, dimmed and still, over an empty trace — the room is not
// running, and a dimmed line is the difference between "this is where you
// will be singing" and "this is where you are".

import type { SingRoomContext } from './room-machine'

export type SingStageView =
  /** The live canvas: a run, a pause, or the take behind its end card. */
  | 'run'
  /** Resting with a melody loaded: its target line, dimmed. */
  | 'melody-preview'
  /** The denied state's pre-recorded line, labelled as one (3d). */
  | 'demo'
  /** Resting with nothing loaded: a dashed line waiting for a voice. */
  | 'silent'

export function singStageView(ctx: SingRoomContext): SingStageView {
  if (ctx.state === 'live' || ctx.state === 'paused' || ctx.state === 'ended') {
    return 'run'
  }
  if (ctx.state === 'denied') return 'demo'
  return ctx.melodyLoaded ? 'melody-preview' : 'silent'
}
