// ============================================================
// Studio lane arms — every armed lane of the recorder: its input opened in its own press, its capture and its monitor, on the one clock
// ============================================================
//
// A DAW arms its tracks one at a time, and one Record press records every
// armed track. Each lane's arm here opens its own input inside its own
// press (WebKit opens a microphone and starts a clock only inside one), on
// the Studio's one clock: its pick of a microphone the lanes on it share,
// or an instrument's sound (armed-input.ts). Each armed lane listens through
// a capture of its own (capture-node.ts), which takes one start, so a fresh
// one listens after every take, and hears itself through a monitor of its
// own, through its lane's effects and faders (input-monitor.ts): a lane is
// heard once, and lanes armed on one input are heard together, as a DAW
// sums its armed tracks. A lane's monitor rises a quarter of a second after
// its capture first meters a sound, past a new microphone's first moments;
// an instrument's rises at once, and so does that of a lane joining a
// microphone already flowing (armed-input.ts). Disarming one lane leaves the
// others armed; a lane disarmed before its input opened lets that input go
// as it arrives, and one disarmed while its monitor is heard keeps its input
// until the monitor has glided out on it, a quarter of a second, so the
// singer hears a release, not a cut; disarmed before its monitor rose, it
// was not heard, and lets its input go at once. A re-arm on another input
// device ends the old input at once all the same: MicManager ends the hold
// the new device replaces before opening it, and WebKit keeps one capture
// at a time anyway (mic-manager.ts `acquireFrom`), so the release does not
// cover a device change. An instrument goes at once, its port free for the
// next lane. The click track is the clock's, shared by every lane.
import type { StudioArmedInput } from './armed-input'
import { createStudioArmedInputs } from './armed-input'
import type { StudioCaptureEvents, StudioCaptureHandle } from './capture-node'
import type { StudioClickTrack } from './click-track'
import type { StudioInputMonitor } from './input-monitor'
import type { StudioInputTap } from './lane-channel'
import type { StudioLaneTake } from './lane-take'
import type { StudioInputHold, StudioLiveTake, StudioRecorderDeps, } from './recorder-types'

export const AUDIO_DID_NOT_START =
  "Studio's audio didn't start. Press Record again."
const DISARMED = 'disarmed'

export interface StudioLaneArm {
  /** The lane, or null for a take that gets a lane of its own. */
  readonly trackId: string | null
  /** Its input is still opening. */
  arming: boolean
  input: StudioArmedInput | null
  capture: StudioCaptureHandle | null
  monitor: Pick<StudioInputMonitor, 'set' | 'inputArrived' | 'dispose'> | null
  /** The loudest input sample lately, 0 to 1. */
  level: number
  /** Its take as it records, for the waveform growing in its lane. */
  live: StudioLiveTake | null
  /** The take its capture records now. */
  take: StudioLaneTake | null
}

type LaneArmDeps = Pick<
  StudioRecorderDeps,
  | 'unlock'
  | 'clock'
  | 'acquireMic'
  | 'acquireInstrument'
  | 'prepareWorklet'
  | 'openCapture'
  | 'createSource'
  | 'createClicks'
  | 'createMonitor'
  | 'monitorSound'
  | 'inputOpened'
  | 'describeError'
>

export interface StudioLaneArmsOptions {
  readonly deps: LaneArmDeps
  /** What a lane's capture says, for the recorder: only its newest capture is heard. */
  events(lane: StudioLaneArm): StudioCaptureEvents
  /** An arm began, opened, failed or closed: a new arm clears what the last one said, and a failed one says why. */
  changed(change?: {
    readonly error?: string | null
    readonly notice?: null
  }): void
}

export function createStudioLaneArms(options: StudioLaneArmsOptions) {
  const { deps } = options
  const lanes: StudioLaneArm[] = []
  const inputs = createStudioArmedInputs(deps.createSource)
  let clock: {
    readonly context: AudioContext
    readonly clicks: Pick<StudioClickTrack, 'schedule' | 'stop'>
  } | null = null

  const has = (lane: StudioLaneArm) => lanes.includes(lane)

  function describeOpenError(error: unknown): string | null {
    if (!(error instanceof Error)) return deps.describeError(error)
    if (error.message === DISARMED) return null
    if (error.message === AUDIO_DID_NOT_START) return AUDIO_DID_NOT_START
    return deps.describeError(error)
  }

  /** The clock, started inside the press, with the recorder's worklet ready on it. */
  async function openClock(unlocked: Promise<boolean>): Promise<AudioContext> {
    if (!(await unlocked)) throw new Error(AUDIO_DID_NOT_START)
    const context = deps.clock()
    if (context === null || context.state !== 'running')
      throw new Error(AUDIO_DID_NOT_START)
    await deps.prepareWorklet(context)
    return context
  }

  /** A capture of the lane's own on its node; one that a fresh one replaced is no longer heard. Its first sound tells the lane's monitor the input has arrived. */
  function listen(
    lane: StudioLaneArm,
    context: AudioContext,
    input: StudioArmedInput,
  ): void {
    const events = options.events(lane)
    let capture: StudioCaptureHandle | null = null
    const heard = () => capture !== null && lane.capture === capture
    capture = deps.openCapture(context, input.node, {
      level: (peak, frame) => {
        if (peak > 0) lane.monitor?.inputArrived()
        if (heard()) events.level(peak, frame)
      },
      started: (frame) => {
        if (heard()) events.started(frame)
      },
      chunk: (firstFrame, frames, buffer) => {
        if (heard()) events.chunk(firstFrame, frames, buffer)
      },
      stopped: (frames, reason) => {
        if (heard()) events.stopped(frames, reason)
      },
    })
    lane.capture = capture
  }

  function open(
    lane: StudioLaneArm,
    context: AudioContext,
    held: StudioInputHold,
  ): void {
    clock ??= { context, clicks: deps.createClicks(context) }
    const input = inputs.open(clock.context, held)
    lane.input = input
    lane.arming = false
    lane.level = 0
    listen(lane, clock.context, input)
    // An instrument the page plays sounds cleanly from its first note, and a
    // microphone source a lane's monitor heard settle has no onset left: a
    // lane on either rises at once. Settled here, the source is flowing for
    // the lanes that join it after.
    lane.monitor = deps.createMonitor(clock.context, input.node, {
      settled: input.flowing,
      onSettled: () => input.settled(),
    })
    lane.monitor.set(deps.monitorSound(lane.trackId))
    if (input.opened !== null)
      deps.inputOpened?.({ ...input.opened, trackId: lane.trackId })
  }

  /** Take the lane out: its capture, its monitor, and its input, which goes with the last lane on it once a heard monitor has glided out. */
  function close(lane: StudioLaneArm): void {
    const index = lanes.indexOf(lane)
    if (index < 0) return
    lanes.splice(index, 1)
    const { input, monitor } = lane
    lane.capture?.dispose()
    lane.capture = null
    lane.monitor = null
    // Closed under a heard monitor, the input would cut its release
    // (CONVENTIONS.md 5b). Late, this closes only this lane's own pick and
    // hold: a lane armed on the input since holds its own (armed-input.ts),
    // and a hold ends only through itself (studio-mic-share.ts). Closed
    // late, the recorder shows its lanes again: the input they shared may
    // be gone with it (`capture`).
    if (monitor === null) input?.close()
    else if (input !== null && input.stream === null) {
      // An instrument goes at once, as it did: its sound is its arm's own,
      // and its port must be free for the next lane, since a port plays one
      // lane at a time (studio-midi-lanes.ts). Its monitor glides out on
      // what the lane's effects still ring with.
      monitor.dispose()
      input.close()
    } else {
      let late = false
      monitor.dispose(() => {
        input?.close()
        if (late) options.changed()
      })
      late = true
    }
    if (lanes.length > 0 || clock === null) return
    clock.clicks.stop()
    clock = null
  }

  /** Arm `trackId` beside the lanes armed already; inside the press. */
  async function arm(trackId: string | null): Promise<boolean> {
    if (lanes.some((lane) => lane.trackId === trackId)) return false
    const lane: StudioLaneArm = {
      trackId,
      arming: true,
      input: null,
      capture: null,
      monitor: null,
      level: 0,
      live: null,
      take: null,
    }
    lanes.push(lane)
    options.changed({ error: null, notice: null })
    // Both start before anything is awaited: the press must still be current.
    // A MIDI lane's instrument opens in place of a microphone, never beside one.
    const unlocked = deps.unlock().catch(() => false)
    const asked = deps.acquireInstrument?.(trackId) ?? deps.acquireMic(trackId)
    let held: StudioInputHold
    try {
      held = await asked
    } catch (error) {
      if (has(lane)) {
        close(lane)
        options.changed({ error: deps.describeError(error) })
      }
      return false
    }
    try {
      const context = await openClock(unlocked)
      if (!has(lane)) throw new Error(DISARMED)
      open(lane, context, held)
      options.changed()
      return true
    } catch (error) {
      // This arm's own: an arm after it holds an input of its own.
      held.release()
      if (has(lane)) {
        close(lane)
        options.changed({ error: describeOpenError(error) })
      }
      return false
    }
  }

  return {
    arm,
    close,
    has,
    /** Every armed lane, and every lane whose input is still opening, in the order they were pressed. */
    list: (): readonly StudioLaneArm[] => lanes,
    /** The clock the lanes are armed on; null while none is. */
    context: () => clock?.context ?? null,
    clicks: () => clock?.clicks ?? null,
    /** Disarm `trackId`, or every lane when none is named; true when one was. */
    disarm(trackId?: string | null): boolean {
      const leaving = lanes.filter(
        (lane) => trackId === undefined || lane.trackId === trackId,
      )
      for (const lane of leaving) close(lane)
      return leaving.length > 0
    },
    /** After a take or a cancelled count-in: a capture takes one start, so the lane listens on through a fresh one, on the same node. */
    listenAgain(lane: StudioLaneArm): void {
      if (!has(lane) || clock === null || lane.input === null) return
      lane.capture?.dispose()
      listen(lane, clock.context, lane.input)
    },
    /** Each lane's monitoring follows the settings and its lane. */
    updateMonitors(): void {
      for (const lane of lanes)
        lane.monitor?.set(deps.monitorSound(lane.trackId))
    },
    tap: (): StudioInputTap | null => inputs.tap(),
    capture: (): number | null => inputs.capture(),
    dispose(): void {
      for (const lane of [...lanes]) close(lane)
    },
  }
}

export type StudioLaneArms = ReturnType<typeof createStudioLaneArms>
