// ============================================================
// Studio recorder — arm lanes, count in, record every armed lane's take on the song's clock, and hand each take over to be kept
// ============================================================
//
// Arming a lane opens the clock and its input inside the press (WebKit lets
// neither start outside one), the recorder worklet starts metering, and the
// armed lane shows its level. Lanes are armed one at a time, as a DAW's
// tracks are (lane-arms.ts), and one Record press records every armed lane:
// the count-in is written on the song's beat grid before the playhead, the
// song is asked to start on the count-in's last frame (transport.play's
// notBefore), and every lane's capture starts on the count-in's first
// frame, the same frame for all, so a pickup sung into the count-in is kept
// in the take's trim. Stop pauses the song, keeps capturing for one round
// trip so the last sung note is not cut, and each lane's take is handed
// over (`keep`) to be stored like an imported file. The lanes stay armed
// after a take, as a DAW's armed tracks do, so the next Record starts the
// next take; an input is released when its last lane is disarmed, when it
// or the clock goes away, or when the Studio closes, and the mic icon goes
// off with it.
//
// Nothing here knows Solid or the Studio's storage: the hook
// (useStudioRecorder.ts) supplies the clock, the inputs, the transport and
// the store, and mirrors the view into signals. Each lane's take is also
// journaled as it records (studio-take-journal.ts), so a closed tab leaves
// every lane's take to be kept on the next visit.
//
// A lane records one input of its capture, or an aligned pair mixed to
// mono (lane-channel.ts), or, on a MIDI lane, an instrument's sound with no
// microphone at all (armed-input.ts). Each take is placed by its own lane's
// path, and a lost input ends only the takes that recorded from it
// (lane-take.ts).
import { audioOutputPathSeconds } from '@/lib/mic-latency'
import type { MicReleaseReason } from '@/lib/mic-manager'
import { createStudioClickScheduler } from './click-track'
import type { StudioLaneArm } from './lane-arms'
import { createStudioLaneArms } from './lane-arms'
import type { StudioInputTap } from './lane-channel'
import type { StudioLaneTake } from './lane-take'
import { endNotice, keepsSomething, studioMicLostWords, takeFrames, } from './lane-take'
import type { StudioCaptureStop } from './pcm-capture'
import type { StudioRecordSettings } from './record-settings'
import type { StudioInputLostWords, StudioRecorderDeps, StudioRecorderView, StudioRecordLane, StudioRecordNotice, StudioRecordPhase, } from './recorder-types'
import type { StudioRunLane as RunLane, StudioTakeRun as Run } from './take-run'
import { createStudioRunTake, planStudioRun, runLaneDone as ended, STUDIO_TAKE_MAX_SECONDS, studioCapturedTake, studioCountInTicks, studioRunHeardFirst, } from './take-run'
import { takeFrameAt, takeTimeOf } from './take-timing'

export {
  MIC_LOST_ARMED,
  MIC_LOST_BEFORE_TAKE,
  MIC_LOST_MID_TAKE,
  MIC_RELEASED_IN_BACKGROUND,
  MIC_TAKEN_BY_OTHER_TAB,
} from './lane-take'
export { STUDIO_TAKE_MAX_SECONDS } from './take-run'

/** How long past its stop frame a take waits for the worklet before finishing anyway. */
const STOP_WATCHDOG_MS = 2000

type RunPhase = Extract<
  StudioRecordPhase,
  'counting' | 'recording' | 'finishing'
>

function laneView(lane: StudioLaneArm): StudioRecordLane {
  return {
    trackId: lane.trackId,
    arming: lane.arming,
    level: lane.level,
    live: lane.live,
    microphone: lane.input !== null && lane.input.stream !== null,
  }
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
    lanes: [],
    notices: [],
  }
  let run: Run | null = null
  let runPhase: RunPhase | null = null
  let notices: readonly StudioRecordNotice[] = []
  let disposed = false

  const arms = createStudioLaneArms({
    deps,
    events: (lane) => ({
      level: (peak) => {
        lane.level = peak
        publish()
      },
      started: (frame) => onStarted(lane, frame),
      chunk: (firstFrame, frames, buffer) =>
        onChunk(lane, firstFrame, frames, buffer),
      stopped: (frames, reason) => {
        if (lane.take !== null) void onStopped(lane, lane.take, frames, reason)
      },
    }),
    changed: (change) => publish(change),
  })

  function phase(): StudioRecordPhase {
    if (runPhase !== null) return runPhase
    const lanes = arms.list()
    if (lanes.some((lane) => lane.arming)) return 'arming'
    return lanes.length > 0 ? 'armed' : 'idle'
  }

  /** Show the lanes as they are now, with what changed. */
  function publish(
    next: Partial<
      Pick<StudioRecorderView, 'error' | 'notice' | 'countBeat'>
    > = {},
  ): void {
    if (next.notice === null) notices = []
    const lanes = arms.list()
    const first = lanes[0]
    view = {
      ...view,
      ...next,
      phase: phase(),
      targetTrackId: first?.trackId ?? null,
      level: first?.level ?? 0,
      live: first?.live ?? null,
      lanes: lanes.map(laneView),
      notices,
    }
    if (!disposed) deps.onChange(view)
  }

  // ── Arming ────────────────────────────────────────────────────

  /** Open the clock and the input for `trackId`, beside the lanes armed already; inside the press. */
  async function arm(trackId: string | null): Promise<boolean> {
    if (run !== null || disposed) return false
    return arms.arm(trackId)
  }

  /** Disarm lane `trackId`, or every lane when none is named; not while a take runs. */
  function disarm(trackId?: string | null): void {
    if (run !== null) return
    if (arms.disarm(trackId)) publish()
  }

  // ── The worklet's messages ───────────────────────────────────

  function onStarted(lane: StudioLaneArm, frame: number): void {
    const take = lane.take
    if (take === null || run === null) return
    take.startFrame = frame
    take.started = true
    place(run, { lane, take })
    publish()
  }

  function onChunk(
    lane: StudioLaneArm,
    firstFrame: number,
    frames: number,
    buffer: ArrayBuffer,
  ) {
    const take = lane.take
    if (take === null) return
    const chunk = take.buffer.append(firstFrame, frames, buffer)
    take.peaks.push(chunk.samples)
    take.journal.push(chunk.samples)
    if (lane.live === null) return
    lane.live = { ...lane.live, count: take.peaks.count }
    publish()
  }

  // ── Recording ────────────────────────────────────────────────

  /** Hold memory for every lane's take, or none: a lane that cannot record stops them all. */
  function reserveEach(count: number, bytes: number): (() => void)[] | null {
    const releases: (() => void)[] = []
    try {
      for (let lane = 0; lane < count; lane += 1)
        releases.push(deps.reserveMemory(bytes))
      return releases
    } catch (error) {
      for (const release of releases) release()
      publish({ error: deps.describeError(error) })
      return null
    }
  }

  /** Start a take on every armed lane, from the same frame; inside the press. */
  function record(): boolean {
    const context = arms.context()
    const lanes = arms.list()
    if (phase() !== 'armed' || context === null || disposed) return false
    const maxFrames = Math.floor(
      (STUDIO_TAKE_MAX_SECONDS - 0.01) * context.sampleRate,
    )
    const releases = reserveEach(lanes.length, maxFrames * 4)
    if (releases === null) return false
    const planned = planStudioRun(deps, context)
    const current = planned.run
    current.takes = lanes.map((lane, index) => ({
      lane,
      take: createStudioRunTake(deps, current, lane, {
        context,
        startTime: planned.startTime,
        maxFrames,
        releaseMemory: releases[index],
      }),
    }))
    run = current
    for (const { lane, take } of current.takes) {
      lane.take = take
      lane.capture?.start(take.startFrame, maxFrames)
    }
    if (planned.countIn > 0) countInClicks(current, planned.countIn)
    startSong(current, planned.playing, planned.settings)
    for (const each of current.takes) place(current, each)
    runPhase = planned.countIn > 0 ? 'counting' : 'recording'
    publish({ error: null, notice: null })
    return true
  }

  /** The count-in: its ticks on the song's grid, and the beats left on screen. */
  function countInClicks(current: Run, countIn: number): void {
    const context = arms.context()
    const clicks = arms.clicks()
    if (context === null || clicks === null || current.songFrom === null) return
    const ticks = studioCountInTicks(current, countIn, deps.tempoBpm())
    clicks.schedule(ticks)
    const heardLate = audioOutputPathSeconds(context)
    const counting = () => run === current && runPhase === 'counting'
    ticks.forEach((tick, index) => {
      const wait = (tick.time + heardLate - context.currentTime) * 1000
      current.timers.push(
        setTimeout(
          () => {
            if (counting()) publish({ countBeat: ticks.length - index })
          },
          Math.max(0, wait),
        ),
      )
    })
    const end = (current.countInEnd + heardLate - context.currentTime) * 1000
    current.timers.push(
      setTimeout(
        () => {
          if (!counting()) return
          runPhase = 'recording'
          publish({ countBeat: null })
        },
        Math.max(0, end),
      ),
    )
  }

  /** Start the song on the count-in's last frame, or follow it if it plays already. */
  function startSong(
    current: Run,
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
        if (run !== current) return
        // The song's real place on the clock, if it started; else as planned.
        current.anchor = deps.transport.anchor() ?? current.anchor
        for (const each of current.takes) place(current, each)
        publish()
        scheduleStop(current)
        startClick(current, settings)
      })
  }

  /** A punch stops at its out point, a loop after its last pass: each capture is told once the song's place is known, one round trip of its own later. */
  function scheduleStop(current: Run): void {
    if (current.stopAt === null || run !== current) return
    const reason = current.cut?.mode === 'punch' ? 'out-point' : 'last-pass'
    const at = takeTimeOf(current.anchor, current.stopAt)
    for (const { lane, take } of current.takes) {
      if (take.ended || take.stopping) continue
      const frame = Math.round((at + take.roundTrip) * current.sampleRate)
      lane.capture?.stop(frame, reason)
    }
  }

  function startClick(current: Run, settings: StudioRecordSettings): void {
    const context = arms.context()
    const clicks = arms.clicks()
    if (!settings.click || context === null || clicks === null) return
    if (run !== current) return
    const from =
      current.songFrom ?? takeFrameAt(current.anchor, context.currentTime)
    current.scheduler = createStudioClickScheduler({
      track: clicks,
      tempoBpm: deps.tempoBpm(),
      fromFrame: from,
      anchor: () => current.anchor,
      now: () => context.currentTime,
      loop: current.cut?.mode === 'loop' ? current.cut.range : null,
    })
    current.scheduler.start()
  }

  /** Where a lane's live waveform starts, once its first sample's place is known; journaled from then. */
  function place(current: Run, { lane, take }: RunLane): void {
    if (take.ended) return
    const heardFirst = studioRunHeardFirst(current, take)
    lane.live = {
      title: current.title,
      heardFirst,
      fromFrame: current.fromFrame,
      peaks: take.peaks,
      sampleRate: take.sampleRate,
      count: take.peaks.count,
      cut: current.cut,
      anchor: current.anchor,
    }
    if (take.started) take.journal.place(heardFirst)
  }

  /** Stop every lane's take: Stop, Space, R or Escape. A count-in stopped keeps nothing. */
  function stop(): void {
    const current = run
    const context = arms.context()
    if (current === null || context === null) return
    if (runPhase === 'counting') {
      cancel()
      return
    }
    if (runPhase !== 'recording') return
    for (const each of current.takes) {
      if (ended(each)) continue
      const { lane, take } = each
      const until = Math.round(
        (context.currentTime + take.roundTrip) * context.sampleRate,
      )
      lane.capture?.stop(Math.max(take.startFrame + 1, until), 'stopped')
      take.stopping = true
    }
    endSound(current)
    runPhase = 'finishing'
    publish({ countBeat: null })
  }

  /** Finish with what arrived if the worklet never reports its stop (a closed clock). */
  function watch({ lane, take }: RunLane, reason: StudioCaptureStop): void {
    if (take.watchdog !== null) return
    take.watchdog = setTimeout(
      () => void onStopped(lane, take, take.buffer.frames, reason),
      STOP_WATCHDOG_MS + take.roundTrip * 1000,
    )
  }

  /** The song, the click and the count-in timers stop with the run. */
  function endSound(current: Run, reason: StudioCaptureStop = 'stopped'): void {
    current.stopped = true
    for (const each of current.takes) if (!each.take.ended) watch(each, reason)
    current.scheduler?.stop()
    for (const timer of current.timers) clearTimeout(timer)
    current.timers = []
    arms.clicks()?.stop()
    deps.transport.pause()
  }

  /** Let a take go that kept nothing: a count-in stopped, or its lane lost in it. */
  function letGo({ lane, take }: RunLane): void {
    clearTimeout(take.watchdog ?? undefined)
    take.ended = true
    take.finished = true
    take.releaseMemory()
    take.journal.discard()
    lane.take = null
    lane.live = null
  }

  /** A count-in stopped before the take began: nothing is kept, the lanes stay armed. */
  function cancel(): void {
    const current = run
    if (current === null) return
    run = null
    runPhase = null
    endSound(current)
    for (const each of current.takes) {
      letGo(each)
      arms.listenAgain(each.lane)
    }
    publish({ countBeat: null })
  }

  /**
   * Whether a lane stays armed after its take ended for `reason`: not when
   * its input or the clock went with it, or the Studio closed.
   */
  function staysArmed(lane: StudioLaneArm, reason: StudioCaptureStop): boolean {
    if (disposed || !arms.has(lane)) return false
    if (reason === 'input-lost' || reason === 'interrupted') return false
    return arms.context()?.state === 'running' && lane.input?.live() === true
  }

  /** A lane's capture stopped: by Stop, or on its own (a limit, its input gone). */
  async function onStopped(
    lane: StudioLaneArm,
    take: StudioLaneTake,
    frames: number,
    reason: StudioCaptureStop,
  ) {
    const current = run
    if (current === null || take.ended) return
    take.ended = true
    if (lane.take === take) lane.take = null
    clearTimeout(take.watchdog ?? undefined)
    // The run ends as its last lane stops.
    const running = runPhase === 'counting' || runPhase === 'recording'
    if (running && current.takes.every(ended)) {
      endSound(current)
      runPhase = 'finishing'
      publish({ countBeat: null })
    }
    await finish(current, { lane, take }, frames, reason)
  }

  async function finish(
    current: Run,
    { lane, take }: RunLane,
    frames: number,
    reason: StudioCaptureStop,
  ): Promise<void> {
    // The lane listens on for the next take, or lets its input go.
    if (staysArmed(lane, reason)) arms.listenAgain(lane)
    else arms.close(lane)
    let notice: string | null = null
    try {
      const heardFirst = studioRunHeardFirst(current, take)
      const placed = {
        heardFirst,
        fromFrame: current.fromFrame,
        cut: current.cut,
      }
      const reached = take.started && frames > 0 && keepsSomething(take, placed)
      // A loss already named (the input gone) says it best.
      notice = endNotice(
        reached,
        take.lost?.midTake ?? null,
        reason,
        current.cut,
        current.cut !== null &&
          heardFirst + takeFrames(take) > current.cut.range.startFrame,
        take.lost,
      )
      if (reached) await keep(current, take, heardFirst)
      else take.journal.discard()
    } finally {
      take.releaseMemory()
      finished(current, { lane, take }, notice)
    }
  }

  /** Hand the take over to be stored; its journal goes once it is kept, and holds it for the next try if not. */
  async function keep(
    current: Run,
    take: StudioLaneTake,
    heardFirst: number,
  ): Promise<void> {
    const captured = studioCapturedTake(current, take, heardFirst)
    take.buffer.clear()
    const kept = await deps.keep(captured).catch(() => false)
    if (kept) take.journal.discard()
    else take.journal.flush()
  }

  /** A lane's take is done; the run is over once every lane's is. */
  function finished(
    current: Run,
    { lane, take }: RunLane,
    notice: string | null,
  ): void {
    take.finished = true
    // Its waveform stayed in the lane until the take was kept.
    lane.live = null
    lane.level = 0
    if (notice !== null)
      notices = [...notices, { trackId: take.trackId, text: notice }]
    if (run === current && current.takes.every((each) => each.take.finished)) {
      run = null
      runPhase = null
    }
    publish(notice === null ? {} : { notice })
  }

  // ── Losses ───────────────────────────────────────────────────

  /** Lanes whose input went while a count-in runs: alone, the count-in ends; beside others, their takes go and the rest count on. */
  function loseInCountIn(current: Run, lost: readonly StudioLaneArm[]): void {
    if (current.takes.every(({ lane }) => lost.includes(lane))) {
      cancel()
      return
    }
    const gone = current.takes.filter(({ lane }) => lost.includes(lane))
    for (const each of gone) letGo(each)
    current.takes = current.takes.filter((each) => !gone.includes(each))
  }

  /** Lanes whose input went mid-take: each keeps what it had, and the others record on. */
  function loseMidTake(
    current: Run,
    lost: readonly StudioLaneArm[],
    words: StudioInputLostWords,
  ): void {
    for (const each of current.takes) {
      if (!lost.includes(each.lane) || ended(each)) continue
      each.lane.capture?.stop(null, 'input-lost')
      each.take.stopping = true
      each.take.lost = words
      watch(each, 'input-lost')
    }
    if (current.takes.every(ended)) {
      endSound(current, 'input-lost')
      runPhase = 'finishing'
    }
    publish({ notice: words.midTake })
  }

  /** The inputs of the lanes `hit` names went away: an armed lane disarms and says so in `words`, and a take keeps what it has. */
  function lose(
    words: StudioInputLostWords,
    hit: (lane: StudioLaneArm) => boolean,
  ): void {
    const lost = arms.list().filter((lane) => !lane.arming && hit(lane))
    const current = run
    if (lost.length === 0) return
    if (current !== null && runPhase === 'recording') {
      loseMidTake(current, lost, words)
      return
    }
    if (current !== null && runPhase !== 'counting') return
    if (current !== null) loseInCountIn(current, lost)
    for (const lane of lost) arms.close(lane)
    publish({ error: words.armed })
  }

  /** Lane `trackId`'s input went away, or every lane's when none is named. */
  function inputLost(
    words: StudioInputLostWords,
    trackId?: string | null,
  ): void {
    lose(words, (lane) => trackId === undefined || lane.trackId === trackId)
  }

  /** The microphone went away, saying why when the app let it go (`reason`): every lane on it, and no instrument. */
  function micLost(reason: MicReleaseReason | null = null): void {
    lose(
      studioMicLostWords(reason),
      (lane) => lane.input !== null && lane.input.stream !== null,
    )
  }

  /** The clock stopped running (an interruption): every take keeps what it has. */
  function clockStopped(): void {
    const current = run
    if (current !== null && runPhase === 'recording') {
      for (const each of current.takes) {
        if (ended(each)) continue
        each.lane.capture?.stop(null, 'interrupted')
        each.take.stopping = true
      }
      endSound(current, 'interrupted')
      runPhase = 'finishing'
      publish()
      return
    }
    if (runPhase === 'counting') cancel()
    disarm()
  }

  /** The Studio closed: what was recording stays in the journal for the next visit. */
  function dispose(): void {
    if (disposed) return
    const current = run
    run = null
    runPhase = null
    if (current !== null) {
      endSound(current)
      for (const { take } of current.takes) {
        if (take.ended) continue
        clearTimeout(take.watchdog ?? undefined)
        take.journal.flush()
        take.releaseMemory()
      }
    }
    arms.dispose()
    disposed = true
  }

  return {
    view: () => view,
    arm,
    disarm,
    record,
    stop,
    micLost,
    inputLost,
    clockStopped,
    /** Move lane `from`'s arm (the first lane's when none is named) to `trackId` before the take starts; its input stays open. */
    retarget(trackId: string | null, from?: string | null): void {
      if (run !== null) return
      const moving = from === undefined ? view.targetTrackId : from
      if (trackId !== moving && arms.retarget(trackId, moving)) publish()
    },
    /** Each armed lane's monitoring follows the settings and its lane. */
    updateMonitor(): void {
      arms.updateMonitors()
    },
    /** The armed microphone, for meters beside the take on its own split; null while no lane holds one. */
    inputTap(): StudioInputTap | null {
      return arms.tap()
    },
    clearMessages(): void {
      if (view.error !== null || view.notice !== null)
        publish({ error: null, notice: null })
    },
    dispose,
  }
}

export type StudioRecorder = ReturnType<typeof createStudioRecorder>
export type * from './recorder-types'
