// ============================================================
// Studio take run — one Record press across every armed lane: where the takes start, the count-in and song they share, and each lane's take
// ============================================================
//
// A DAW's Record records every armed track from one press. Here every armed
// lane's capture starts on the same clock frame, a tenth of a second past
// the press, under one count-in on the song's beat grid and one song start
// (take-plan.ts), and a punch or a loop applies to every lane alike. Each
// lane keeps a take of its own (lane-take.ts), placed by its own lane's path
// and journaled under its own id, so the run's takes become one clip on
// each lane.
import { STUDIO_SAMPLE_RATE } from '../model/types'
import { frameTime, wholeFrameAtOrAfter } from '../playback/whole-frame'
import type { createStudioClickScheduler } from './click-track'
import type { StudioLaneArm } from './lane-arms'
import type { StudioLaneTake } from './lane-take'
import { createStudioLaneTake } from './lane-take'
import type { StudioCapturedTake, StudioRecorderDeps } from './recorder-types'
import { createStudioTakeJournalFeed } from './take-journal-feed'
import type { StudioTakeCut } from './take-plan'
import { planStudioTake } from './take-plan'
import type { StudioTakeAnchor } from './take-timing'
import { studioClickBeats, studioHeardFirst, takeTimeOf } from './take-timing'

/** The longest take, as the Studio's import allows: five minutes. */
export const STUDIO_TAKE_MAX_SECONDS = 300
/** How far past the press a take's capture can begin. */
const START_LEAD_SECONDS = 0.1

/** A lane in a run, and the take it records. */
export interface StudioRunLane {
  readonly lane: StudioLaneArm
  readonly take: StudioLaneTake
}

/** One Record press across every armed lane: what they share, and each lane's take. */
export interface StudioTakeRun {
  readonly title: string
  readonly sampleRate: number
  readonly fromFrame: number | null
  /** Where Record started the song; null for one that played on. */
  readonly songFrom: number | null
  readonly cut: StudioTakeCut | null
  /** The song frame, on the run's count, where the captures stop by themselves. */
  readonly stopAt: number | null
  readonly countInEnd: number
  anchor: StudioTakeAnchor
  scheduler: ReturnType<typeof createStudioClickScheduler> | null
  timers: ReturnType<typeof setTimeout>[]
  /** Set by Stop: the song is not to start any more. */
  stopped: boolean
  takes: StudioRunLane[]
}

/** Its capture stopped, or was told to: it records no more. */
export const runLaneDone = ({ take }: StudioRunLane) =>
  take.ended || take.stopping

type RunDeps = Pick<
  StudioRecorderDeps,
  | 'settings'
  | 'takeCut'
  | 'transport'
  | 'tempoBpm'
  | 'title'
  | 'createId'
  | 'roundTrip'
  | 'journal'
>

/** The run a press starts now on `context`, and what starting it needs: when the captures start, the count-in, and whether the song plays on. */
export function planStudioRun(deps: RunDeps, context: AudioContext) {
  const rate = context.sampleRate
  const settings = deps.settings()
  const startTime = wholeFrameAtOrAfter(
    context.currentTime + START_LEAD_SECONDS,
    rate,
  )
  const cut = deps.takeCut?.() ?? null
  // A punch or a loop starts the song where its range needs it.
  const playingOn = cut === null && deps.transport.playing()
  const liveAnchor = playingOn ? deps.transport.anchor() : null
  // A song still starting has no place on the clock yet: start it over.
  if (liveAnchor === null && deps.transport.playing()) deps.transport.pause()
  const plan = planStudioTake({
    cut,
    playing: liveAnchor !== null,
    playheadFrame: deps.transport.playheadFrame(),
    countInBars: settings.countInBars,
    tempoBpm: deps.tempoBpm(),
  })
  const countInEnd = wholeFrameAtOrAfter(startTime + plan.countInSeconds, rate)
  const run: StudioTakeRun = {
    title: deps.title(),
    sampleRate: rate,
    fromFrame: plan.fromFrame,
    songFrom: plan.songFrom,
    cut,
    stopAt: plan.stopAt,
    countInEnd,
    anchor: liveAnchor ?? { frame: plan.songFrom ?? 0, time: countInEnd },
    scheduler: null,
    timers: [],
    stopped: false,
    takes: [],
  }
  return {
    run,
    settings,
    startTime,
    countIn: plan.countInSeconds,
    playing: liveAnchor !== null,
    maxFrames: Math.floor((STUDIO_TAKE_MAX_SECONDS - 0.01) * rate),
  }
}

/** Lane `lane`'s take of `run`, placed by the lane's own path, read now so an offset changed while armed is in it. */
export function createStudioRunTake(
  deps: RunDeps,
  run: StudioTakeRun,
  lane: StudioLaneArm,
  at: {
    readonly context: AudioContext
    readonly startTime: number
    readonly maxFrames: number
    readonly releaseMemory: () => void
  },
): StudioLaneTake {
  const rate = run.sampleRate
  const id = deps.createId()
  const roundTrip = deps.roundTrip(at.context, lane.input?.stream ?? null)
  return createStudioLaneTake({
    id,
    trackId: lane.trackId,
    sampleRate: rate,
    maxFrames: at.maxFrames,
    roundTrip,
    startFrame: Math.round(at.startTime * rate),
    releaseMemory: at.releaseMemory,
    journal: createStudioTakeJournalFeed(deps.journal, {
      id,
      trackId: lane.trackId,
      title: run.title,
      sampleRate: rate,
      fromFrame: run.fromFrame,
      heardFirst: studioHeardFirst(run.anchor, at.startTime, roundTrip),
      cut: run.cut,
    }),
  })
}

/** The count-in's ticks, on the song's beat grid before where the run starts it. */
export function studioCountInTicks(
  run: StudioTakeRun,
  countIn: number,
  tempoBpm: number,
): { readonly time: number; readonly accent: boolean }[] {
  const from = run.songFrom
  if (from === null) return []
  const beats = studioClickBeats(
    from - countIn * STUDIO_SAMPLE_RATE,
    from,
    tempoBpm,
  )
  const virtual = { frame: from, time: run.countInEnd }
  return beats.map((beat) => ({
    time: takeTimeOf(virtual, beat.frame),
    accent: beat.accent,
  }))
}

/** Where a lane's take sits on the song: its first sample's frame, by its own path. */
export function studioRunHeardFirst(
  run: StudioTakeRun,
  take: StudioLaneTake,
): number {
  return studioHeardFirst(
    run.anchor,
    frameTime(take.startFrame, take.sampleRate),
    take.roundTrip,
  )
}

/** A lane's finished take, ready to be kept like an imported file. */
export function studioCapturedTake(
  run: StudioTakeRun,
  take: StudioLaneTake,
  heardFirst: number,
): StudioCapturedTake {
  return {
    id: take.id,
    title: run.title,
    trackId: take.trackId,
    sampleRate: take.sampleRate,
    samples: take.buffer.assemble(),
    heardFirst,
    fromFrame: run.fromFrame,
    cut: run.cut,
    capturedFrom: frameTime(take.startFrame, take.sampleRate),
  }
}
