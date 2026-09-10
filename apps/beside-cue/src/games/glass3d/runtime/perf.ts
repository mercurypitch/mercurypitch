// What a frame costs, and what a stage cost to open.
// ============================================================
//
// §8 of glass-3d.md: the HUD is frame rate and frame time, read in the
// page, because GPU time cannot be measured where it matters -- Android
// withholds the timer query -- and the phone is where the numbers have
// to be read. So every stage carries a chip, and this is the arithmetic
// behind it, kept pure so it can be tested without a clock or a GPU.
//
// Three kinds of number, each for a question maff asks on the device:
//
//   frames   fps, main-thread milliseconds per drawn frame (mean and
//            worst), and how much of each second the loop kept the main
//            thread busy -- the last is the one calm mode moves, since
//            calm draws fewer frames and not cheaper ones.
//   f0       detector frames a second. On a phone the interesting failure
//            is a renderer that is fine and an audio thread that is
//            starved, and the two are indistinguishable from "slow"
//            without it.
//   load     where the wait between tapping a card and the first frame
//            went, and then the microphone's own wait (P7: measure
//            before warming anything).
//
// The chip is for measuring, not for players: a development build shows
// it, and a production build only with `?perf` in the address.

export interface FrameWindow {
  /** Frames drawn a second. */
  fps: number
  /** Mean main-thread milliseconds per DRAWN frame: the simulation, the
   * scene update and the draw call, as the CPU sees them. */
  cpuMs: number
  /** The worst drawn frame in the window. P2's gate is on this side. */
  cpuMaxMs: number
  /** Share of the window the frame loop kept the main thread busy, drawn
   * frames and skipped ones together, 0..1. */
  busy: number
  /** Detector frames a second. */
  f0Hz: number
}

export interface FrameMeter {
  /** One pass of the frame loop: when it started, how long it took, and
   * whether it drew. Returns the window's summary when one closes. */
  frame(nowMs: number, cpuMs: number, drew: boolean): FrameWindow | null
  /** The detector level as the stage just read it. A change is a new f0
   * frame: one frame is read many times over, so reads are not frames. */
  level(value: number): void
}

/** Rates over a whole second: anything shorter is noise, and this is a
 * number a human reads off a phone held in the other hand. */
export const createFrameMeter = (windowMs = 1000): FrameMeter => {
  let startedAt = Number.NaN
  let drawn = 0
  let cpuSum = 0
  let cpuMax = 0
  let busy = 0
  let f0Frames = 0
  let lastLevel = Number.NaN

  const reset = (at: number): void => {
    startedAt = at
    drawn = 0
    cpuSum = 0
    cpuMax = 0
    busy = 0
    f0Frames = 0
  }

  return {
    frame(nowMs, cpuMs, drew) {
      if (!Number.isFinite(nowMs)) return null
      // A clock that went backwards opens a new window rather than
      // reporting a negative second.
      if (Number.isNaN(startedAt) || nowMs < startedAt) reset(nowMs)
      const cost = Number.isFinite(cpuMs) && cpuMs > 0 ? cpuMs : 0
      busy += cost
      if (drew) {
        drawn += 1
        cpuSum += cost
        if (cost > cpuMax) cpuMax = cost
      }
      const span = nowMs - startedAt
      if (span < windowMs) return null
      const seconds = span / 1000
      const summary: FrameWindow = {
        fps: Math.round(drawn / seconds),
        cpuMs: drawn === 0 ? 0 : cpuSum / drawn,
        cpuMaxMs: cpuMax,
        busy: Math.min(1, busy / span),
        f0Hz: Math.round(f0Frames / seconds),
      }
      reset(nowMs)
      return summary
    },
    level(value) {
      if (!Number.isFinite(value) || value <= 0) return
      if (value !== lastLevel) f0Frames += 1
      lastLevel = value
    },
  }
}

/** The waits a stage is made of, in the order they happen. */
export type LoadPhase =
  /** Building the scene before anything is fetched: the materials, the
   * lights, and the environment map, which is painted on a canvas. */
  | 'scene'
  /** `renderer.init()`: the WebGPU device or the WebGL2 context. */
  | 'gpu'
  /** Merc's glb, fetched, parsed and dressed. */
  | 'merc'
  /** The glass: the Cabinet's bowl and shards, a pane's shards. */
  | 'glass'
  /** Linking the shard program before it is needed. */
  | 'compile'
  /** The first drawn frame's own cost. Whatever the scene has not drawn
   * before is compiled on first use, so this is where a cold start's
   * shader work lands -- most of the wait that is not a file. */
  | 'draw'
  /** From the stage mounting to its first drawn frame: the card tap. */
  | 'first'
  /** From the tap on the gate to a live microphone. The first time, that
   * includes however long the permission prompt was up. */
  | 'mic'
  /** From a live microphone to the first detector frame. */
  | 'f0'

export type LoadTimes = Partial<Record<LoadPhase, number>>

/** How a renderer reports a phase of its own `init` as it finishes. */
export type LoadMark = (phase: LoadPhase, ms: number) => void

/** For a caller that is not measuring. */
export const NO_MARK: LoadMark = () => {}

const SCENE_PHASES: readonly LoadPhase[] = [
  'scene',
  'gpu',
  'merc',
  'glass',
  'compile',
  'draw',
  'first',
]
const MIC_PHASES: readonly LoadPhase[] = ['mic', 'f0']

const phaseLine = (load: LoadTimes, phases: readonly LoadPhase[]): string => {
  const parts = phases
    .filter((p) => load[p] !== undefined)
    .map((p) => `${p} ${Math.round(load[p]!)}`)
  return parts.length === 0 ? '' : `${parts.join(' · ')} ms`
}

/**
 * The chip, as lines.
 *
 * The first line is the frame, the second the scene's load, the third
 * the microphone's; a line with nothing in it yet is left out, so the
 * chip grows as the stage comes up rather than showing empty slots.
 */
export const chipLines = (
  backend: string,
  frames: FrameWindow | null,
  calm: boolean,
  load: LoadTimes,
): string[] => {
  const head = [backend]
  if (frames !== null) {
    head.push(
      `${frames.fps} fps`,
      `cpu ${frames.cpuMs.toFixed(1)}/${frames.cpuMaxMs.toFixed(1)} ms`,
      `${Math.round(frames.busy * 100)}%`,
    )
    if (frames.f0Hz > 0) head.push(`f0 ${frames.f0Hz} Hz`)
  }
  if (calm) head.push('calm')
  return [
    head.join(' · '),
    phaseLine(load, SCENE_PHASES),
    phaseLine(load, MIC_PHASES),
  ].filter((line) => line !== '')
}

export interface PerfEnvironment {
  readonly DEV?: boolean
}

/**
 * Whether this build shows the chip. A development build always does; a
 * production build only with `?perf` in the address, which is how maff
 * reads it off a production build on his phone -- and why a player, who
 * has no reason to type that, never sees it.
 */
export const isPerfChipEnabled = (
  env: PerfEnvironment,
  search: string,
): boolean => env.DEV === true || new URLSearchParams(search).has('perf')

/**
 * Run some async work and report how long it took to resolve.
 *
 * Takes the work as a function so the clock starts when the work does:
 * handed a promise, the timer would start whenever this happened to be
 * called, which for two loads racing each other is not the same moment.
 */
export const timed = async <T>(
  work: () => Promise<T>,
  report: (ms: number) => void,
  now: () => number = () => performance.now(),
): Promise<T> => {
  const start = now()
  const value = await work()
  report(now() - start)
  return value
}
