// ============================================================
// Studio recorder — arm a lane, count in, record a take on the song's clock, and hand the finished take over to be kept
// ============================================================
//
// One press arms: the clock and the microphone open inside it (WebKit lets
// neither start outside a press), the recorder worklet starts metering, and
// the armed lane shows the singer's level. The next press records: the
// count-in is written on the song's beat grid before the playhead, the song
// is asked to start on the count-in's last frame (transport.play's
// notBefore), and the capture starts on the count-in's first frame, so a
// pickup sung into the count-in is kept in the take's trim. Stop pauses the
// song, keeps capturing for one round trip so the last sung note is not
// cut, and the take is handed over (`keep`) to be stored like an imported
// file. After a take, or when the microphone goes away, the microphone is
// released and the mic icon goes off.
//
// Nothing here knows Solid or the Studio's storage: the hook
// (useStudioRecorder.ts) supplies the clock, the microphone, the transport
// and the store, and mirrors the view into signals. The take's audio is
// also journaled as it records (studio-take-journal.ts), so a closed tab
// leaves the take to be kept on the next visit.
import { audioOutputPathSeconds } from '@/lib/mic-latency'
import { STUDIO_SAMPLE_RATE } from '../model/types'
import { frameTime, wholeFrameAtOrAfter } from '../playback/whole-frame'
import type { StudioCaptureEvents, StudioCaptureHandle } from './capture-node'
import type { StudioClickTrack } from './click-track'
import { createStudioClickScheduler } from './click-track'
import type { StudioInputMonitor } from './input-monitor'
import type { StudioCaptureStop } from './pcm-capture'
import type { StudioRecordSettings } from './record-settings'
import type { StudioCapturedTake, StudioRecorderDeps, StudioRecorderView, } from './recorder-types'
import type { StudioLivePeaks } from './take-audio'
import { createStudioLivePeaks, createStudioTakeBuffer } from './take-audio'
import type { StudioTakeJournalFeed } from './take-journal-feed'
import { createStudioTakeJournalFeed } from './take-journal-feed'
import type { StudioTakeAnchor } from './take-timing'
import { studioClickBeats, studioCountInSeconds, studioHeardFirst, takeFrameAt, takeTimeOf, } from './take-timing'

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
}

export const MIC_LOST_MID_TAKE =
  'The microphone went away mid-take. Studio kept what it heard up to then.'
export const MIC_LOST_ARMED =
  'The microphone went away. Plug it back in, then press Record again.'
const AUDIO_DID_NOT_START = "Studio's audio didn't start. Press Record again."
const TAKE_TOO_SHORT = 'That take was too short to keep.'

interface Armed {
  readonly context: AudioContext
  readonly stream: MediaStream
  readonly source: AudioNode
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
    const mic = deps.acquireMic()
    let stream: MediaStream
    try {
      stream = await mic
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
      armed = open(context, stream, trackId)
      set({ phase: 'armed', level: 0 })
      return true
    } catch (error) {
      deps.releaseMic()
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
    stream: MediaStream,
    trackId: string | null,
  ): Armed {
    const source = deps.createSource(context, stream)
    const capture = deps.openCapture(context, source, captureEvents())
    const monitor = deps.createMonitor(context, source)
    monitor.set(deps.monitorLevel(trackId))
    return {
      context,
      stream,
      source,
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
    try {
      closing.source.disconnect()
    } catch {
      // Already apart.
    }
    deps.releaseMic()
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
    const liveAnchor = deps.transport.playing() ? deps.transport.anchor() : null
    // A song still starting has no place on the clock yet: start it over.
    if (liveAnchor === null && deps.transport.playing()) deps.transport.pause()
    const playing = liveAnchor !== null
    const countIn =
      playing || settings.countInBars === 0
        ? 0
        : studioCountInSeconds(deps.tempoBpm(), settings.countInBars)
    const countInEnd = wholeFrameAtOrAfter(startTime + countIn, rate)
    const fromFrame = playing ? null : deps.transport.playheadFrame()
    const anchor: StudioTakeAnchor = liveAnchor ?? {
      frame: fromFrame ?? 0,
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
    if (armed === null || current.fromFrame === null) return
    const tempo = deps.tempoBpm()
    const beats = studioClickBeats(
      current.fromFrame - countIn * STUDIO_SAMPLE_RATE,
      current.fromFrame,
      tempo,
    )
    const virtual = { frame: current.fromFrame, time: current.countInEnd }
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
    if (playing) {
      startClick(current, settings)
      return
    }
    const from = current.fromFrame ?? 0
    if (!deps.transport.canPlay(from)) {
      startClick(current, settings)
      return
    }
    void deps.transport
      .play(current.countInEnd)
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
        startClick(current, settings)
      })
  }

  function startClick(current: Take, settings: StudioRecordSettings): void {
    if (!settings.click || armed === null || take !== current) return
    const context = armed.context
    const from =
      current.fromFrame ?? takeFrameAt(current.anchor, context.currentTime)
    current.scheduler = createStudioClickScheduler({
      track: armed.clicks,
      tempoBpm: deps.tempoBpm(),
      fromFrame: from,
      anchor: () => current.anchor,
      now: () => context.currentTime,
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
        heardFirst,
        fromFrame: current.fromFrame,
        peaks: current.peaks,
        sampleRate: current.sampleRate,
        count: current.peaks.count,
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
    // A capture takes one start; the armed lane listens on through a fresh one.
    armed.capture.dispose()
    armed = {
      ...armed,
      capture: deps.openCapture(armed.context, armed.source, captureEvents()),
    }
    set({ phase: 'armed', countBeat: null, live: null })
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
    const notice = view.notice ?? STOP_NOTICES[reason] ?? null
    take = null
    await finish(current, frames, notice)
  }

  async function finish(
    current: Take,
    frames: number,
    notice: string | null,
  ): Promise<void> {
    closeArmed()
    try {
      if (!current.started || frames <= 0) {
        current.journal.discard()
        set({
          phase: 'idle',
          live: null,
          level: 0,
          notice: notice ?? TAKE_TOO_SHORT,
        })
        return
      }
      const captured: StudioCapturedTake = {
        id: current.id,
        title: current.title,
        trackId: current.trackId,
        sampleRate: current.sampleRate,
        samples: current.buffer.assemble(),
        heardFirst: studioHeardFirst(
          current.anchor,
          frameTime(current.startFrame, current.sampleRate),
          current.roundTrip,
        ),
        fromFrame: current.fromFrame,
      }
      current.buffer.clear()
      const kept = await deps.keep(captured).catch(() => false)
      // Kept: the journal goes. Not kept: it holds the take for the next try.
      if (kept) current.journal.discard()
      else current.journal.flush()
      set({ phase: 'idle', live: null, level: 0, notice })
    } finally {
      current.releaseMemory()
    }
  }

  // ── Losses ───────────────────────────────────────────────────

  /** The microphone went away: an armed lane disarms, a take keeps what it has. */
  function micLost(): void {
    if (view.phase === 'arming' || view.phase === 'idle') return
    if (view.phase === 'armed') {
      closeArmed()
      set({
        phase: 'idle',
        level: 0,
        targetTrackId: null,
        error: MIC_LOST_ARMED,
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
        error: MIC_LOST_ARMED,
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
    /** An armed lane follows the selection until the take starts. */
    retarget(trackId: string | null): void {
      if (view.phase !== 'armed' || trackId === view.targetTrackId) return
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
