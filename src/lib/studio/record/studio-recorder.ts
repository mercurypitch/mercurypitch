// ============================================================
// Studio recorder — arm a lane, count in, record a take on the song's clock, and hand the finished take over to be kept
// ============================================================
//
// Arming a lane opens the clock and the microphone inside the press (WebKit
// lets neither start outside one), the recorder worklet starts metering, and
// the armed lane shows the singer's level. Recording starts from the armed
// lane: the count-in is written on the song's beat grid before the playhead,
// the song is asked to start on the count-in's last frame (transport.play's
// notBefore), and the capture starts on the count-in's first frame, so a
// pickup sung into the count-in is kept in the take's trim. Stop pauses the
// song, keeps capturing for one round trip so the last sung note is not
// cut, and the take is handed over (`keep`) to be stored like an imported
// file. The lane stays armed after a take, as a DAW's armed track does, so
// the next Record starts the next take; the microphone is released when the
// lane is disarmed, when the microphone or the clock goes away, or when the
// Studio closes, and the mic icon goes off with it.
//
// Nothing here knows Solid or the Studio's storage: the hook
// (useStudioRecorder.ts) supplies the clock, the microphone, the transport
// and the store, and mirrors the view into signals. The take's audio is
// also journaled as it records (studio-take-journal.ts), so a closed tab
// leaves the take to be kept on the next visit.
//
// A lane can take one channel of its input: a guitar on input 2 of an
// interface. The arm hands the take and the monitor the same node, that
// channel alone (lane-channel.ts), and so does every capture it opens after.
import { audioOutputPathSeconds } from '@/lib/mic-latency'
import type { MicReleaseReason } from '@/lib/mic-manager'
import { STUDIO_MAX_CLIP_PASSES } from '../model/clip-passes'
import { STUDIO_SAMPLE_RATE } from '../model/types'
import { frameTime, wholeFrameAtOrAfter } from '../playback/whole-frame'
import type { StudioCaptureEvents, StudioCaptureHandle } from './capture-node'
import type { StudioClickTrack } from './click-track'
import { createStudioClickScheduler } from './click-track'
import type { StudioInputMonitor } from './input-monitor'
import type { StudioLaneChannel } from './lane-channel'
import { openStudioLaneChannel } from './lane-channel'
import type { StudioCaptureStop } from './pcm-capture'
import type { StudioRecordSettings } from './record-settings'
import type { StudioCapturedTake, StudioMicHold, StudioRecorderDeps, StudioRecorderView, } from './recorder-types'
import type { StudioLivePeaks } from './take-audio'
import { createStudioLivePeaks, createStudioTakeBuffer } from './take-audio'
import type { StudioTakeJournalFeed } from './take-journal-feed'
import { createStudioTakeJournalFeed } from './take-journal-feed'
import { studioTakeClip } from './take-passes'
import type { StudioTakeCut } from './take-plan'
import { planStudioTake } from './take-plan'
import type { StudioTakeAnchor } from './take-timing'
import { studioClickBeats, studioHeardFirst, takeFrameAt, takeTimeOf, } from './take-timing'

/** The longest take, as the Studio's import allows: five minutes. */
export const STUDIO_TAKE_MAX_SECONDS = 300
/** How far past the press a take's capture can begin. */
const START_LEAD_SECONDS = 0.1
/** How long past its stop frame a take waits for the worklet before finishing anyway. */
const STOP_WATCHDOG_MS = 2000

const STOP_NOTICES: Partial<Record<StudioCaptureStop, string>> = {
  'input-lost':
    'The microphone went quiet mid-take, so the take ends there. Studio kept what came before.',
  limit: 'Takes stop at five minutes. Studio kept this one.',
  'fell-behind':
    'Studio fell behind keeping this take, so it stopped there. Studio kept what came before.',
  interrupted:
    'Audio stopped for a moment, so the take ends there. Studio kept what came before.',
  'last-pass': `A loop keeps ${STUDIO_MAX_CLIP_PASSES} passes, so recording stopped after the last one.`,
}

/** A take that ended before the song reached it keeps nothing, and says so. */
const ENDED_BEFORE_THE_TAKE: Partial<Record<StudioCaptureStop, string>> = {
  'input-lost':
    'The microphone went quiet before the take began, so nothing was recorded. Press Record to try again.',
  'fell-behind':
    'Studio fell behind before the take began, so nothing was recorded. Press Record to try again.',
  interrupted:
    'Audio stopped for a moment before the take began, so nothing was recorded. Press Record to try again.',
}

export const MIC_LOST_MID_TAKE =
  'The microphone went away mid-take. Studio kept what it heard up to then.'
export const MIC_LOST_BEFORE_TAKE =
  'The microphone went away before the take began, so nothing was recorded. Plug it back in, then press Record again.'
export const MIC_LOST_ARMED =
  'The microphone went away. Plug it back in, then press Record again.'
/** An armed lane's microphone, let go by the app as the tab stayed in the background (mic-manager.ts). */
export const MIC_RELEASED_IN_BACKGROUND =
  'Studio let the microphone go while this tab was in the background. Arm the lane again.'
/** An armed lane's microphone, handed to another MercuryPitch tab that asked for it. */
export const MIC_TAKEN_BY_OTHER_TAB =
  'Another MercuryPitch tab took the microphone. Close it there, then arm the lane again.'

/** What an armed lane says when its microphone goes: the release's own reason, else a lost device. */
function lostWhileArmed(reason: MicReleaseReason | null): string {
  if (reason === 'background') return MIC_RELEASED_IN_BACKGROUND
  if (reason === 'other-tab') return MIC_TAKEN_BY_OTHER_TAB
  return MIC_LOST_ARMED
}
const AUDIO_DID_NOT_START = "Studio's audio didn't start. Press Record again."
const TAKE_TOO_SHORT = 'That take was too short to keep.'
const BEFORE_THE_IN_POINT =
  'Stopped before the range began, so nothing was recorded.'
/** A punch keeps a tenth of a second at least, a loop's first pass a second (take-passes.ts). */
const TOO_SOON_IN_RANGE =
  'Stopped just after the range began, so the take was too short to keep.'

interface Armed {
  readonly context: AudioContext
  /** Given back through itself only: a late release from an earlier arm cannot end it. */
  readonly mic: StudioMicHold
  readonly stream: MediaStream
  readonly source: AudioNode
  /** What the lane records and hears, its one channel or the whole source: every capture of the arm listens on its `input`. */
  readonly lane: StudioLaneChannel
  readonly capture: StudioCaptureHandle
  readonly monitor: Pick<StudioInputMonitor, 'set' | 'dispose'>
  readonly clicks: Pick<StudioClickTrack, 'schedule' | 'stop'>
}

interface Take {
  readonly id: string
  readonly title: string
  readonly trackId: string | null
  readonly sampleRate: number
  readonly buffer: ReturnType<typeof createStudioTakeBuffer>
  readonly peaks: StudioLivePeaks
  readonly fromFrame: number | null
  /** Where Record started the song; null for one that played on. */
  readonly songFrom: number | null
  readonly cut: StudioTakeCut | null
  /** The song frame, on the run's count, where the capture stops by itself. */
  readonly stopAt: number | null
  readonly countInEnd: number
  /** Taken off the take's start, in seconds; read as the take starts. */
  readonly roundTrip: number
  anchor: StudioTakeAnchor
  startFrame: number
  started: boolean
  releaseMemory: () => void
  scheduler: ReturnType<typeof createStudioClickScheduler> | null
  timers: ReturnType<typeof setTimeout>[]
  /** Set by Stop: the song is not to start any more. */
  stopped: boolean
  /** Finishes the take if the worklet never says it stopped. */
  watchdog: ReturnType<typeof setTimeout> | null
  readonly journal: StudioTakeJournalFeed
}

/** The take's length in the 48 kHz frames its import keeps. */
function takeFrames(current: Take): number {
  return Math.round(
    (current.buffer.frames * STUDIO_SAMPLE_RATE) / current.sampleRate,
  )
}

/** Whether the take keeps anything: past its trim, or enough of a punch's range or a loop's (take-passes.ts). */
function keepsSomething(current: Take, heardFirst: number): boolean {
  const take = { heardFirst, fromFrame: current.fromFrame, cut: current.cut }
  return studioTakeClip(take, takeFrames(current)) !== null
}

/** What a finished take says: why it ended, and whether anything was kept. */
function endNotice(
  kept: boolean,
  named: string | null,
  reason: StudioCaptureStop,
  cut: StudioTakeCut | null,
  /** The capture ran past the range's start. */
  inRange: boolean,
): string | null {
  if (kept) return named ?? STOP_NOTICES[reason] ?? null
  if (named === MIC_LOST_MID_TAKE) return MIC_LOST_BEFORE_TAKE
  const early = inRange ? TOO_SOON_IN_RANGE : BEFORE_THE_IN_POINT
  const stopped = cut !== null && reason === 'stopped' ? early : null
  return ENDED_BEFORE_THE_TAKE[reason] ?? stopped ?? TAKE_TOO_SHORT
}

export function createStudioRecorder(deps: StudioRecorderDeps) {
  let view: StudioRecorderView = {
    phase: 'idle',
    level: 0,
    countBeat: null,
    error: null,
    notice: null,
    targetTrackId: null,
    live: null,
  }
  let armed: Armed | null = null
  let take: Take | null = null
  let armToken = 0
  let disposed = false

  function set(next: Partial<StudioRecorderView>): void {
    view = { ...view, ...next }
    if (!disposed) deps.onChange(view)
  }

  // ── Arming ────────────────────────────────────────────────────

  /** Open the clock and the microphone for `trackId`; inside the press. */
  async function arm(trackId: string | null): Promise<boolean> {
    if (view.phase !== 'idle' || disposed) return false
    const token = ++armToken
    set({ phase: 'arming', error: null, notice: null, targetTrackId: trackId })
    // Both start before anything is awaited: the press must still be current.
    const unlocked = deps.unlock().catch(() => false)
    const mic = deps.acquireMic(trackId)
    let held: StudioMicHold
    try {
      held = await mic
    } catch (error) {
      if (token === armToken)
        set({ phase: 'idle', error: deps.describeError(error) })
      return false
    }
    try {
      if (!(await unlocked)) throw new Error(AUDIO_DID_NOT_START)
      const context = deps.clock()
      if (context === null || context.state !== 'running')
        throw new Error(AUDIO_DID_NOT_START)
      await deps.prepareWorklet(context)
      if (token !== armToken || disposed) throw new Error('disarmed')
      // The lane pressed last while the microphone opened.
      armed = open(context, held, view.targetTrackId)
      set({ phase: 'armed', level: 0 })
      return true
    } catch (error) {
      // This arm's own: an arm after it holds a microphone of its own.
      held.release()
      if (token === armToken && !disposed)
        set({
          phase: 'idle',
          error:
            error instanceof Error && error.message === 'disarmed'
              ? null
              : describeOpenError(error),
        })
      return false
    }
  }

  function describeOpenError(error: unknown): string {
    if (error instanceof Error && error.message === AUDIO_DID_NOT_START)
      return AUDIO_DID_NOT_START
    return deps.describeError(error)
  }

  function open(
    context: AudioContext,
    mic: StudioMicHold,
    trackId: string | null,
  ): Armed {
    const stream = mic.stream
    const source = deps.createSource(context, stream)
    const lane = openStudioLaneChannel(
      context,
      source,
      stream,
      mic.channel ?? null,
    )
    const capture = deps.openCapture(context, lane.input, captureEvents())
    const monitor = deps.createMonitor(context, lane.input)
    monitor.set(deps.monitorLevel(trackId))
    const { channels, channel, missingChannel } = lane
    deps.inputOpened?.({ stream, channels, channel, missingChannel })
    return {
      context,
      mic,
      stream,
      source,
      lane,
      capture,
      monitor,
      clicks: deps.createClicks(context),
    }
  }

  /** Close everything the arm opened and give the microphone back. */
  function closeArmed(): void {
    const closing = armed
    armed = null
    if (closing === null) return
    closing.capture.dispose()
    closing.monitor.dispose()
    closing.clicks.stop()
    closing.lane.split?.close()
    try {
      closing.source.disconnect()
    } catch {
      // Already apart.
    }
    closing.mic.release()
  }

  function disarm(): void {
    if (view.phase === 'arming') {
      armToken++
      set({ phase: 'idle', targetTrackId: null })
      return
    }
    if (view.phase !== 'armed') return
    closeArmed()
    set({ phase: 'idle', level: 0, targetTrackId: null })
  }

  // ── The worklet's messages ───────────────────────────────────

  function captureEvents(): StudioCaptureEvents {
    return {
      level: (peak) => {
        if (view.phase !== 'idle') set({ level: peak })
      },
      started: (frame) => onStarted(frame),
      chunk: (firstFrame, frames, buffer) =>
        onChunk(firstFrame, frames, buffer),
      stopped: (frames, reason) => void onStopped(frames, reason),
    }
  }

  function onStarted(frame: number): void {
    if (take === null) return
    take.startFrame = frame
    take.started = true
    placeLive(take)
  }

  function onChunk(firstFrame: number, frames: number, buffer: ArrayBuffer) {
    if (take === null) return
    const chunk = take.buffer.append(firstFrame, frames, buffer)
    take.peaks.push(chunk.samples)
    take.journal.push(chunk.samples)
    if (view.live !== null)
      set({ live: { ...view.live, count: take.peaks.count } })
  }

  // ── Recording ────────────────────────────────────────────────

  /** Start the take from the armed lane; inside the press. */
  function record(): boolean {
    if (view.phase !== 'armed' || armed === null) return false
    const settings = deps.settings()
    const context = armed.context
    const rate = context.sampleRate
    const maxFrames = Math.floor((STUDIO_TAKE_MAX_SECONDS - 0.01) * rate)
    let releaseMemory: () => void
    try {
      releaseMemory = deps.reserveMemory(maxFrames * 4)
    } catch (error) {
      set({ error: deps.describeError(error) })
      return false
    }
    const now = context.currentTime
    const startTime = wholeFrameAtOrAfter(now + START_LEAD_SECONDS, rate)
    const cut = deps.takeCut?.() ?? null
    // A punch or a loop starts the song where its range needs it.
    const playingOn = cut === null && deps.transport.playing()
    const liveAnchor = playingOn ? deps.transport.anchor() : null
    // A song still starting has no place on the clock yet: start it over.
    if (liveAnchor === null && deps.transport.playing()) deps.transport.pause()
    const playing = liveAnchor !== null
    const plan = planStudioTake({
      cut,
      playing,
      playheadFrame: deps.transport.playheadFrame(),
      countInBars: settings.countInBars,
      tempoBpm: deps.tempoBpm(),
    })
    const countIn = plan.countInSeconds
    const countInEnd = wholeFrameAtOrAfter(startTime + countIn, rate)
    const fromFrame = plan.fromFrame
    const anchor: StudioTakeAnchor = liveAnchor ?? {
      frame: plan.songFrom ?? 0,
      time: countInEnd,
    }
    const id = deps.createId()
    const title = deps.title()
    // Read now, so an offset changed while armed is in this take.
    const roundTrip = deps.roundTrip(context, armed.stream)
    take = {
      id,
      title,
      trackId: view.targetTrackId,
      sampleRate: rate,
      buffer: createStudioTakeBuffer(),
      peaks: createStudioLivePeaks(rate, maxFrames),
      fromFrame,
      songFrom: plan.songFrom,
      cut,
      stopAt: plan.stopAt,
      countInEnd,
      roundTrip,
      anchor,
      startFrame: Math.round(startTime * rate),
      started: false,
      releaseMemory,
      scheduler: null,
      timers: [],
      stopped: false,
      watchdog: null,
      journal: createStudioTakeJournalFeed(deps.journal, {
        id,
        trackId: view.targetTrackId,
        title,
        sampleRate: rate,
        fromFrame,
        heardFirst: studioHeardFirst(anchor, startTime, roundTrip),
        cut,
      }),
    }
    armed.capture.start(take.startFrame, maxFrames)
    if (countIn > 0) countInClicks(take, countIn)
    startSong(take, playing, settings)
    placeLive(take)
    set({
      phase: countIn > 0 ? 'counting' : 'recording',
      error: null,
      notice: null,
    })
    return true
  }

  /** The count-in: its ticks on the song's grid, and the beats left on screen. */
  function countInClicks(current: Take, countIn: number): void {
    const from = current.songFrom
    if (armed === null || from === null) return
    const tempo = deps.tempoBpm()
    const beats = studioClickBeats(
      from - countIn * STUDIO_SAMPLE_RATE,
      from,
      tempo,
    )
    const virtual = { frame: from, time: current.countInEnd }
    const ticks = beats.map((beat) => ({
      time: takeTimeOf(virtual, beat.frame),
      accent: beat.accent,
    }))
    armed.clicks.schedule(ticks)
    const context = armed.context
    const heardLate = audioOutputPathSeconds(context)
    ticks.forEach((tick, index) => {
      const wait = (tick.time + heardLate - context.currentTime) * 1000
      current.timers.push(
        setTimeout(
          () => {
            if (take === current && view.phase === 'counting')
              set({ countBeat: ticks.length - index })
          },
          Math.max(0, wait),
        ),
      )
    })
    const end = (current.countInEnd + heardLate - context.currentTime) * 1000
    current.timers.push(
      setTimeout(
        () => {
          if (take === current && view.phase === 'counting')
            set({ phase: 'recording', countBeat: null })
        },
        Math.max(0, end),
      ),
    )
  }

  /** Start the song on the count-in's last frame, or follow it if it plays already. */
  function startSong(
    current: Take,
    playing: boolean,
    settings: StudioRecordSettings,
  ): void {
    if (playing || !deps.transport.canPlay(current.songFrom ?? 0)) {
      scheduleStop(current)
      startClick(current, settings)
      return
    }
    void deps.transport
      .play(current.countInEnd, current.songFrom ?? 0)
      .catch(() => false)
      .then(() => {
        // Stopped while the song was still starting: it does not start now.
        if (current.stopped) {
          deps.transport.pause()
          return
        }
        if (take !== current) return
        // The song's real place on the clock, if it started; else as planned.
        current.anchor = deps.transport.anchor() ?? current.anchor
        placeLive(current)
        scheduleStop(current)
        startClick(current, settings)
      })
  }

  /** A punch stops at its out point, a loop after its last pass: the capture is told once the song's place is known. */
  function scheduleStop(current: Take): void {
    if (current.stopAt === null || armed === null || take !== current) return
    const time = takeTimeOf(current.anchor, current.stopAt) + current.roundTrip
    const reason = current.cut?.mode === 'punch' ? 'out-point' : 'last-pass'
    armed.capture.stop(Math.round(time * current.sampleRate), reason)
  }

  function startClick(current: Take, settings: StudioRecordSettings): void {
    if (!settings.click || armed === null || take !== current) return
    const context = armed.context
    const from =
      current.songFrom ?? takeFrameAt(current.anchor, context.currentTime)
    current.scheduler = createStudioClickScheduler({
      track: armed.clicks,
      tempoBpm: deps.tempoBpm(),
      fromFrame: from,
      anchor: () => current.anchor,
      now: () => context.currentTime,
      loop: current.cut?.mode === 'loop' ? current.cut.range : null,
    })
    current.scheduler.start()
  }

  /** Where the live waveform starts, once the first sample's place is known. */
  function placeLive(current: Take): void {
    if (armed === null) return
    const heardFirst = studioHeardFirst(
      current.anchor,
      frameTime(current.startFrame, current.sampleRate),
      current.roundTrip,
    )
    set({
      live: {
        title: current.title,
        heardFirst,
        fromFrame: current.fromFrame,
        peaks: current.peaks,
        sampleRate: current.sampleRate,
        count: current.peaks.count,
        cut: current.cut,
        anchor: current.anchor,
      },
    })
    if (current.started) current.journal.place(heardFirst)
  }

  /** Stop the take: Stop, Space, R or Escape. A count-in stopped keeps nothing. */
  function stop(): void {
    if (take === null || armed === null) return
    if (view.phase === 'counting') {
      cancel()
      return
    }
    if (view.phase !== 'recording') return
    const context = armed.context
    const until = Math.round(
      (context.currentTime + take.roundTrip) * context.sampleRate,
    )
    armed.capture.stop(Math.max(take.startFrame + 1, until), 'stopped')
    endSound(take)
    set({ phase: 'finishing', countBeat: null })
  }

  /** Finish with what arrived if the worklet never reports its stop (a closed clock). */
  function watch(current: Take, reason: StudioCaptureStop): void {
    if (current.watchdog !== null) return
    current.watchdog = setTimeout(
      () => {
        if (take === current) void onStopped(current.buffer.frames, reason)
      },
      STOP_WATCHDOG_MS + current.roundTrip * 1000,
    )
  }

  /** The song, the click and the count-in timers stop with the take. */
  function endSound(
    current: Take,
    reason: StudioCaptureStop = 'stopped',
  ): void {
    current.stopped = true
    watch(current, reason)
    current.scheduler?.stop()
    for (const timer of current.timers) clearTimeout(timer)
    current.timers = []
    armed?.clicks.stop()
    deps.transport.pause()
  }

  /** A count-in stopped before the take began: nothing is kept, the lane stays armed. */
  function cancel(): void {
    const current = take
    if (current === null || armed === null) return
    take = null
    endSound(current)
    clearTimeout(current.watchdog ?? undefined)
    current.releaseMemory()
    current.journal.discard()
    listenAgain()
    set({ phase: 'armed', countBeat: null, live: null })
  }

  /** A capture takes one start; the armed lane listens on through a fresh one, on the same channel. */
  function listenAgain(): void {
    if (armed === null) return
    armed.capture.dispose()
    armed = {
      ...armed,
      capture: deps.openCapture(
        armed.context,
        armed.lane.input,
        captureEvents(),
      ),
    }
  }

  /**
   * Whether the lane stays armed after a take that ended for `reason`: not
   * when the microphone or the clock went with it, or the Studio closed.
   */
  function staysArmed(reason: StudioCaptureStop): boolean {
    if (disposed || armed === null) return false
    if (reason === 'input-lost' || reason === 'interrupted') return false
    if (armed.context.state !== 'running') return false
    const tracks = armed.stream.getAudioTracks?.()
    return (
      tracks === undefined ||
      tracks.length === 0 ||
      tracks.some((track) => track.readyState === 'live')
    )
  }

  /** The worklet stopped: by Stop, or on its own (a limit, the input gone). */
  async function onStopped(frames: number, reason: StudioCaptureStop) {
    const current = take
    if (current === null) return
    if (view.phase === 'counting' || view.phase === 'recording') {
      endSound(current)
      set({ phase: 'finishing', countBeat: null })
    }
    clearTimeout(current.watchdog ?? undefined)
    // A loss already named (the microphone gone) says it best.
    const named = view.notice
    take = null
    await finish(current, frames, reason, named)
  }

  async function finish(
    current: Take,
    frames: number,
    reason: StudioCaptureStop,
    named: string | null,
  ): Promise<void> {
    // The armed lane listens on for the next take, or lets the microphone go.
    const after: Partial<StudioRecorderView> = staysArmed(reason)
      ? { phase: 'armed' }
      : { phase: 'idle', targetTrackId: null }
    if (after.phase === 'armed') listenAgain()
    else closeArmed()
    try {
      const heardFirst = studioHeardFirst(
        current.anchor,
        frameTime(current.startFrame, current.sampleRate),
        current.roundTrip,
      )
      const reached = current.started && keepsSomething(current, heardFirst)
      const notice = endNotice(
        reached && frames > 0,
        named,
        reason,
        current.cut,
        current.cut !== null &&
          heardFirst + takeFrames(current) > current.cut.range.startFrame,
      )
      if (!reached || frames <= 0) {
        current.journal.discard()
        set({ ...after, live: null, level: 0, notice })
        return
      }
      const captured: StudioCapturedTake = {
        id: current.id,
        title: current.title,
        trackId: current.trackId,
        sampleRate: current.sampleRate,
        samples: current.buffer.assemble(),
        heardFirst,
        fromFrame: current.fromFrame,
        cut: current.cut,
      }
      current.buffer.clear()
      const kept = await deps.keep(captured).catch(() => false)
      // Kept: the journal goes. Not kept: it holds the take for the next try.
      if (kept) current.journal.discard()
      else current.journal.flush()
      set({ ...after, live: null, level: 0, notice })
    } finally {
      current.releaseMemory()
    }
  }

  // ── Losses ───────────────────────────────────────────────────

  /**
   * The microphone went away: an armed lane disarms, saying why when the
   * app let it go (`reason`), and a take keeps what it has.
   */
  function micLost(reason: MicReleaseReason | null = null): void {
    if (view.phase === 'arming' || view.phase === 'idle') return
    if (view.phase === 'armed') {
      closeArmed()
      set({
        phase: 'idle',
        level: 0,
        targetTrackId: null,
        error: lostWhileArmed(reason),
      })
      return
    }
    if (view.phase === 'counting') {
      cancel()
      closeArmed()
      set({
        phase: 'idle',
        level: 0,
        targetTrackId: null,
        error: lostWhileArmed(reason),
      })
      return
    }
    if (view.phase !== 'recording' || armed === null) return
    armed.capture.stop(null, 'input-lost')
    if (take !== null) endSound(take, 'input-lost')
    set({ phase: 'finishing', notice: MIC_LOST_MID_TAKE })
  }

  /** The clock stopped running (an interruption): a take keeps what it has. */
  function clockStopped(): void {
    if (view.phase === 'recording' && armed !== null) {
      armed.capture.stop(null, 'interrupted')
      if (take !== null) endSound(take, 'interrupted')
      set({ phase: 'finishing' })
      return
    }
    if (view.phase === 'counting') cancel()
    disarm()
  }

  /** The Studio closed: what was recording stays in the journal for the next visit. */
  function dispose(): void {
    if (disposed) return
    const current = take
    take = null
    if (current !== null) {
      endSound(current)
      clearTimeout(current.watchdog ?? undefined)
      current.journal.flush()
      current.releaseMemory()
    }
    armToken++
    closeArmed()
    disposed = true
  }

  return {
    view: () => view,
    arm,
    disarm,
    record,
    stop,
    micLost,
    clockStopped,
    /** Move the arm to another lane before the take starts; the microphone stays open. */
    retarget(trackId: string | null): void {
      if (view.phase !== 'armed' && view.phase !== 'arming') return
      if (trackId === view.targetTrackId) return
      set({ targetTrackId: trackId })
      armed?.monitor.set(deps.monitorLevel(trackId))
    },
    /** The armed lane's monitoring follows the settings and the lane. */
    updateMonitor(): void {
      armed?.monitor.set(deps.monitorLevel(view.targetTrackId))
    },
    clearMessages(): void {
      if (view.error !== null || view.notice !== null)
        set({ error: null, notice: null })
    },
    dispose,
  }
}

export type StudioRecorder = ReturnType<typeof createStudioRecorder>
export type * from './recorder-types'
