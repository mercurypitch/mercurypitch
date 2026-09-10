// A stage's frame, paced and measured.
// ============================================================
//
// Every stage runs the same loop -- read the input, run the fixed-step
// simulation, update the HUD, draw -- and every one of them needs the
// same two things around it: calm mode deciding whether this frame is
// drawn (runtime/calm.ts), and the chip measuring what the frame cost
// and what the stage cost to open (runtime/perf.ts). This is those two,
// wired once, so the stages differ only in what they call activity.
//
// A stage calls it in this order, every frame:
//
//   begin(now)                    top of the rAF callback
//   ...simulation, HUD...
//   const dt = draw(activity)     null means skip the draw this frame
//   if (dt !== null) r.render(view, dt)
//   end()                         bottom, before the next rAF
//
// `dt` is the time since the last DRAWN frame, not since the last rAF.
// A renderer advances Merc's clip, the chase camera and its own pulses
// by it, and handing it one rAF's worth while calm skips every other
// frame would play them all at half speed.

import { createSignal } from 'solid-js'
import type { Activity, CalmConfig } from '../runtime/calm'
import { createCalmState, stepCalm } from '../runtime/calm'
import type { FrameWindow, LoadPhase, LoadTimes } from '../runtime/perf'
import { chipLines, createFrameMeter, isPerfChipEnabled } from '../runtime/perf'

export interface StageFrameStats {
  /** Frames the loop has run. */
  ticks: number
  /** Frames it drew. */
  drawn: number
  calm: boolean
  load: LoadTimes
  /** The last closed one-second window. */
  window: FrameWindow | null
}

export interface StageFrame {
  /** Whether this build shows the chip at all. */
  readonly chipOn: boolean
  /** The chip, as lines. */
  lines(): readonly string[]
  /** A load phase is done. */
  mark(phase: LoadPhase, ms: number): void
  /** Re-read the backend, once the renderer has said which it got. */
  refresh(): void
  begin(nowMs: number): void
  /** Whether to draw this frame; the renderer's dt if so. */
  draw(activity: Omit<Activity, 'input'> & { input?: boolean }): number | null
  end(): void
  /** The detector level, as a simulation step just read it. */
  level(value: number): void
  /** The gate was tapped; a microphone is being asked for. */
  micAsked(): void
  /** The microphone is live. */
  micLive(): void
  stats(): StageFrameStats
  dispose(): void
}

export interface StageFrameOptions {
  /** Read every frame, so a dial dragged mid-game is seen at once. */
  calm: () => CalmConfig
  backend: () => string
  /** What counts as being touched. The window, in a stage. */
  target?: Pick<Window, 'addEventListener' | 'removeEventListener'>
}

export const createStageFrame = (opts: StageFrameOptions): StageFrame => {
  const chipOn = isPerfChipEnabled(import.meta.env, window.location.search)
  const mountedAt = performance.now()
  const meter = createFrameMeter()
  const load: LoadTimes = {}
  const calm = createCalmState(mountedAt / 1000)
  const [lines, setLines] = createSignal<readonly string[]>([])

  let last: FrameWindow | null = null
  let wasCalm = false
  let ticks = 0
  let drawn = 0
  let frameAt = 0
  let cpuFrom = 0
  let drewThisFrame = false
  let lastDrawAt: number | null = null
  let askedAt: number | null = null
  let liveAt: number | null = null
  let heard = false

  const refresh = (): void => {
    if (chipOn) setLines(chipLines(opts.backend(), last, calm.calm, load))
  }
  const mark = (phase: LoadPhase, ms: number): void => {
    load[phase] = ms
    refresh()
  }

  // A touch anywhere or a key, since the last frame. Listened for on the
  // window in the capture phase, so a control that stops propagation --
  // the pad does, to keep the page from scrolling -- still counts.
  let poked = false
  const poke = (): void => {
    poked = true
  }
  const target = opts.target ?? window
  target.addEventListener('pointerdown', poke, { capture: true })
  target.addEventListener('keydown', poke, { capture: true })
  refresh()

  return {
    chipOn,
    lines,
    mark,
    refresh,

    begin(nowMs) {
      frameAt = nowMs
      cpuFrom = performance.now()
      drewThisFrame = false
      ticks += 1
    },

    draw(activity) {
      const input = poked || activity.input === true
      poked = false
      const draw = stepCalm(
        calm,
        frameAt / 1000,
        { input, voiced: activity.voiced, moving: activity.moving },
        opts.calm(),
      )
      if (calm.calm !== wasCalm) {
        wasCalm = calm.calm
        refresh()
      }
      if (!draw) return null
      const dt = lastDrawAt === null ? 0 : (frameAt - lastDrawAt) / 1000
      lastDrawAt = frameAt
      drewThisFrame = true
      drawn += 1
      return Math.max(0, dt)
    },

    end() {
      const done = performance.now()
      if (drewThisFrame && load.first === undefined) {
        // The first frame's own cost, apart from the wait before it:
        // measured on a desktop, the files are a fifth of that wait and
        // the first draw -- compiling what the scene has not drawn
        // before -- most of the rest.
        mark('draw', done - cpuFrom)
        mark('first', done - mountedAt)
      }
      if (liveAt !== null && heard && load.f0 === undefined) {
        mark('f0', done - liveAt)
      }
      const window = meter.frame(frameAt, done - cpuFrom, drewThisFrame)
      if (window !== null) {
        last = window
        refresh()
      }
    },

    level(value) {
      meter.level(value)
      if (value > 0) heard = true
    },

    micAsked() {
      askedAt = performance.now()
    },

    micLive() {
      const now = performance.now()
      if (askedAt !== null && load.mic === undefined) mark('mic', now - askedAt)
      if (liveAt === null) {
        liveAt = now
        heard = false
      }
    },

    stats() {
      return { ticks, drawn, calm: calm.calm, load: { ...load }, window: last }
    },

    dispose() {
      target.removeEventListener('pointerdown', poke, { capture: true })
      target.removeEventListener('keydown', poke, { capture: true })
    },
  }
}
