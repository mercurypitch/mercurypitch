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
  /**
   * Has a melody been chosen IN THE ROOM this session?
   *
   * Not the same question as `melody`, and not the same as
   * `melodyStore.currentMelody()`: the app always has a melody loaded, so a
   * room that asked the store drew a song chip on a fresh boot for a melody
   * nobody picked — against the free tracker the brief opens with. This is
   * set by the one act that loads one and never cleared by a stop, because
   * the melody is still there after the run that used it.
   */
  melodyLoaded: boolean
}

export type SingRoomEvent =
  /**
   * The tab became the one on screen (arrival, or a return from the pill).
   *
   * `hasSummary` is the safety net under the end card: the card is the only
   * thing `ended` means, and the summary it reads lives beside this context.
   * An `ended` that comes back with no summary — a reload, a store cleared
   * under it — is a room with no card, no capsule and no way out, so it
   * rests instead. Measured: Back with the card open left exactly that.
   */
  | { type: 'enter'; hasSummary: boolean }
  /** The tab stopped being the one on screen. The shell parks the run. */
  | { type: 'leave' }
  /** The capsule. The gesture the permission ask has to happen inside. */
  | { type: 'sing-a-note' }
  /** The priming screen's Continue — the system alert comes next. */
  | { type: 'priming-continue' }
  /**
   * The priming screen was dismissed without answering it.
   *
   * Back, or a tap outside the door. `priming` is a full-screen portal with
   * no control on it but Continue, so without this the state stuck: leaving
   * the tab from the door and coming back drew the door again over a room
   * with no way past it. The permission is NOT touched — nothing was asked.
   */
  | { type: 'priming-cancel' }
  | { type: 'mic-granted' }
  | { type: 'mic-denied' }
  /**
   * The device opened, but the audio context is not running.
   *
   * iOS only resumes a context inside a user gesture, and the remembered
   * grant means the room can reach for the microphone with no gesture behind
   * it at all. The capture is then live over a suspended clock: the chip
   * would say "Listening" over a dead line. The room rests instead, and the
   * chip's next tap — which IS a gesture — resumes and starts.
   */
  | { type: 'mic-suspended' }
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
    melodyLoaded: false,
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
      const entered = {
        ...ctx,
        active: true,
        muted: false,
        state:
          ctx.state === 'ended' && !event.hasSummary
            ? ('resting' as SingRoomState)
            : ctx.state,
      }
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

    case 'priming-cancel':
      return ctx.state === 'priming' ? { ...ctx, state: 'resting' } : ctx

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

    case 'mic-suspended':
      // Disarmed, so the next arrival does not walk straight back into the
      // same gestureless acquisition. "Sing a note" arms it again, and that
      // one always has a gesture behind it.
      return { ...ctx, permission: 'granted', armed: false, state: 'resting' }

    case 'toggle-mute':
      if (ctx.state !== 'live' && ctx.state !== 'paused') return ctx
      return { ...ctx, muted: !ctx.muted }

    case 'melody-play':
      // Play on a melody turns the mic on if it is off (owner answer 8).
      return {
        ...ctx,
        melody: true,
        melodyLoaded: true,
        muted: false,
        armed: true,
        state: 'live',
      }

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

/**
 * What a tap on the state chip DOES, or nothing.
 *
 * The chip is the room's one microphone control, and in three of the six
 * states it controls nothing: resting has no run to mute, and `ended` and
 * `denied` have no microphone at all. It used to invite the tap anyway —
 * "Microphone off. Tap to listen again", on a chip whose tap did nothing.
 *
 * Resting is the exception that is not dead: there the chip is the capsule,
 * because "tap the thing that says the mic is off to turn it on" is what
 * anybody would expect it to be.
 */
export type MicChipAction = 'mute' | 'listen' | 'start' | null

export function micChipAction(ctx: SingRoomContext): MicChipAction {
  if (ctx.state === 'resting') return 'start'
  if (ctx.state !== 'live') return null
  return ctx.muted ? 'listen' : 'mute'
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

/**
 * Does this move into a live run begin a NEW take?
 *
 * Three of the four ways of arriving at `live` do not, and a room that got
 * this wrong threw away the trail and restarted the take's clock on every
 * one of them. Measured in the probe: a mute and an unmute counted as two
 * more takes, and the second take of a session said it was the fourth.
 *
 *   undefined  the first read of a freshly mounted room. The context is
 *              module-scoped, so a remount lands mid-take on purpose.
 *   live       a mute, or any other event that left the state alone. The
 *              context is a new object every dispatch, which is what wakes
 *              the effect that asks this.
 *   paused     a resume continues the take it paused.
 */
export function startsNewTake(
  previous: SingRoomState | undefined,
  next: SingRoomState,
): boolean {
  if (next !== 'live') return false
  return previous !== undefined && previous !== 'live' && previous !== 'paused'
}

/** Is the room's run one the shell should draw a transport for? */
export function runIsLive(ctx: SingRoomContext): boolean {
  return ctx.state === 'live'
}

export function runIsPaused(ctx: SingRoomContext): boolean {
  return ctx.state === 'paused'
}
