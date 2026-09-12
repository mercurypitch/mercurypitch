// ============================================================
// The Sing room's state machine, and the mic policy inside it
// ============================================================
//
// Six states (brief §3) and one question the room asks on every frame:
// should the microphone be capturing right now? The answer is a pure
// function of the machine's context, which is why both live here and not in
// the component — a mic that turns itself on is the kind of behaviour that
// is easy to get subtly wrong and impossible to check from a screenshot.
//
// THE POLICY (gate 3, owner answer 8). The microphone is automatic. The
// first arrival asks for it at the moment of intent — the "Sing a note"
// capsule — with one priming screen in front of the system alert. After that
// the room holds the mic whenever Sing is the tab on screen, so the line is
// already alive when the singer walks in; leaving the tab releases it (the
// shell's park does that), and the only visible control is the state chip,
// which mutes and unmutes.
//
// TWO THINGS THAT LOOK THE SAME AND ARE NOT:
//
//   muted   the singer tapped the state chip. The RUN CONTINUES — the clock
//           keeps running, the transport stays in the band, the trace
//           freezes. The brief's §5 sentence "a run is live when the mic is
//           capturing" would make the mute end the take, which would leave
//           the room with a control that silently throws away a take. A mute
//           is a mic gate inside a run, never a stop.
//   armed   the room may acquire the mic by itself. Arrival arms it; a
//           deliberate Stop disarms it, because auto-starting the next take
//           the instant somebody ended one makes Stop useless. "Sing a note"
//           arms it again.

export type SingRoomState =
  /** R0/R1: the silent trace and the capsule. Mic off. */
  | 'resting'
  /** 3b: one screen, then the system alert. */
  | 'priming'
  /** A/M: a free run, or a melody run. */
  | 'live'
  /** P: frozen, mic released, the transport showing Play. */
  | 'paused'
  /** E: the end card is open and undecided. */
  | 'ended'
  /** D: the demo line and the way to Settings. */
  | 'denied'

export type MicPermission = 'unknown' | 'granted' | 'denied'

export interface SingRoomContext {
  state: SingRoomState
  permission: MicPermission
  /** The state chip's mute. Survives nothing — a fresh arrival clears it. */
  muted: boolean
  /** May the room acquire the mic without being asked? */
  armed: boolean
  /** Sing is the tab on screen. */
  active: boolean
  /** The sheet's "Microphone: on when the room opens". */
  micOnArrival: boolean
  /** True once a melody is loaded and running — the M half of a live run. */
  melody: boolean
}

export type SingRoomEvent =
  /** The tab became the one on screen (arrival, or a return from the pill). */
  | { type: 'enter' }
  /** The tab stopped being the one on screen. The shell parks the run. */
  | { type: 'leave' }
  /** The capsule. The gesture the permission ask has to happen inside. */
  | { type: 'sing-a-note' }
  /** The priming screen's Continue — the system alert comes next. */
  | { type: 'priming-continue' }
  | { type: 'mic-granted' }
  | { type: 'mic-denied' }
  /** The state chip. */
  | { type: 'toggle-mute' }
  /** Play on a loaded melody. */
  | { type: 'melody-play' }
  | { type: 'pause' }
  | { type: 'resume' }
  /** Stop. `hasTake` is the summary's verdict: under three seconds, none. */
  | { type: 'stop'; hasTake: boolean }
  /** Keep or Discard — either one closes the end card. */
  | { type: 'take-decided' }
  /** "Explore the rooms", from the denied state. */
  | { type: 'explore' }
  /**
   * The device could not be opened for a reason that is NOT a refusal — it
   * is busy, or another tab holds it. 3d's copy ("turn on the microphone in
   * Settings") would be a lie there, so the room simply rests.
   */
  | { type: 'mic-unavailable' }
  | { type: 'set-mic-on-arrival'; value: boolean }

export function initialSingRoomContext(
  overrides: Partial<SingRoomContext> = {},
): SingRoomContext {
  return {
    state: 'resting',
    permission: 'unknown',
    muted: false,
    armed: true,
    active: false,
    micOnArrival: true,
    melody: false,
    ...overrides,
  }
}

/** Would the room start capturing by itself right now? */
function autoStarts(ctx: SingRoomContext): boolean {
  return (
    ctx.active &&
    ctx.armed &&
    ctx.micOnArrival &&
    ctx.permission === 'granted' &&
    ctx.state === 'resting'
  )
}

export function singRoomReducer(
  ctx: SingRoomContext,
  event: SingRoomEvent,
): SingRoomContext {
  switch (event.type) {
    case 'enter': {
      // A fresh arrival clears a mute: the chip is a mid-run control, and a
      // room that came back silent with no visible reason reads as broken.
      const entered = { ...ctx, active: true, muted: false }
      return autoStarts(entered) ? { ...entered, state: 'live' } : entered
    }

    case 'leave': {
      // Park, never stop (REQ-NHR-017 and the shell's own contract): a
      // parked run comes back paused, with the singer's place kept.
      const state: SingRoomState = ctx.state === 'live' ? 'paused' : ctx.state
      return { ...ctx, active: false, state }
    }

    case 'sing-a-note': {
      if (ctx.permission === 'granted') {
        return { ...ctx, armed: true, muted: false, state: 'live' }
      }
      // Denied is re-asked here and only here — the gentle re-ask at the next
      // moment of intent, never a nag (3d).
      return { ...ctx, armed: true, muted: false, state: 'priming' }
    }

    case 'priming-continue':
      // The system alert answers next; the machine waits for it rather than
      // guessing, so a slow alert cannot leave the room in a state it has to
      // be walked back from.
      return ctx

    case 'mic-granted':
      return {
        ...ctx,
        permission: 'granted',
        muted: false,
        armed: true,
        state: 'live',
      }

    case 'mic-denied':
      return { ...ctx, permission: 'denied', state: 'denied' }

    case 'toggle-mute':
      if (ctx.state !== 'live' && ctx.state !== 'paused') return ctx
      return { ...ctx, muted: !ctx.muted }

    case 'melody-play':
      // Play on a melody turns the mic on if it is off (owner answer 8).
      return { ...ctx, melody: true, muted: false, armed: true, state: 'live' }

    case 'pause':
      return ctx.state === 'live' ? { ...ctx, state: 'paused' } : ctx

    case 'resume':
      return ctx.state === 'paused'
        ? { ...ctx, state: 'live', muted: false }
        : ctx

    case 'stop':
      return {
        ...ctx,
        // Disarmed: a deliberate stop must not be undone by the policy that
        // turns the mic on for an arrival.
        armed: false,
        melody: false,
        state: event.hasTake ? 'ended' : 'resting',
      }

    case 'take-decided':
      return ctx.state === 'ended' ? { ...ctx, state: 'resting' } : ctx

    case 'explore':
      return ctx.state === 'denied' ? { ...ctx, state: 'resting' } : ctx

    case 'mic-unavailable':
      return { ...ctx, armed: false, state: 'resting' }

    case 'set-mic-on-arrival':
      // Identity matters: the context is a signal, and handing back a new
      // object for a value that did not change wakes everything reading it.
      return ctx.micOnArrival === event.value
        ? ctx
        : { ...ctx, micOnArrival: event.value }
  }
}

/**
 * Should the microphone be capturing?
 *
 * Every acquisition in the room goes through this one answer, so there is no
 * second path that can turn the device on — the failure this shape exists to
 * prevent is a mic left open on a tab nobody is looking at.
 */
export function micIntent(ctx: SingRoomContext): boolean {
  return ctx.active && !ctx.muted && ctx.state === 'live'
}

/** What the state chip says, given the whole context. */
export function micChipState(
  ctx: SingRoomContext,
  capturing: boolean,
): 'listening' | 'muted' | 'paused' | 'off' {
  if (ctx.state === 'paused') return 'paused'
  if (ctx.muted) return 'muted'
  return capturing ? 'listening' : 'off'
}

/** Does the shell's Keep alert have something to ask about? */
export function hasUnsavedTake(ctx: SingRoomContext): boolean {
  return ctx.state === 'ended'
}

/** Is the room's run one the shell should draw a transport for? */
export function runIsLive(ctx: SingRoomContext): boolean {
  return ctx.state === 'live'
}

export function runIsPaused(ctx: SingRoomContext): boolean {
  return ctx.state === 'paused'
}
