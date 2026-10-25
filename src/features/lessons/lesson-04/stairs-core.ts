// ============================================================
// Lesson 4 staircase core — one drawing, its moves and its lights
// ============================================================
//
// The object the lesson transforms is one object on the page: every copy of
// the staircase (the hero's, the cold open's compact one, the steps' stage
// and free play) is this core on its own canvas. It keeps the scene, eases
// each move (a slide's travel, Group's brackets, the white keys' overlay,
// the arrow from ti, the top stair's house) and lights a stair and its key
// while its note sounds. Under reduced motion every move lands at once; a
// played scale still sounds and lights its stairs in turn. Sound and words
// belong to whoever calls `play`: the core only draws.

import { clamp } from '@/features/lessons/kit/dom'
import type { Surface } from '@/features/lessons/kit/frame-loop'
import { addDrawer, surface } from '@/features/lessons/kit/frame-loop'
import { scaleNotes, whiteKeysFrom } from '@/features/lessons/kit/major-scale'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import type { NamesMode } from '@/features/lessons/kit/names-modes'
import { COLOR, hz } from '@/features/lessons/kit/notes'
import type { Voice, VoiceOptions } from '@/features/lessons/kit/sound'
import { Sound } from '@/features/lessons/kit/sound'
import type { NoteEvent } from './examples'
import { lengthOf } from './examples'
import type { StairLight, StairsScene } from './stairs-draw'
import { paintStairs } from './stairs-draw'
import type { StairsLayout, StairsMode } from './stairs-geometry'
import { fullMode, stairsLayout } from './stairs-geometry'
import { START_HI, START_LO } from './stairs-words'

export interface StairsCoreOptions {
  readonly canvas: HTMLCanvasElement
  /** Compact (the cold open, the hero) or full (the steps, free play: wide or narrow by width). */
  readonly compact: boolean
  /** When it draws: on screen, and on its step. */
  readonly active: () => boolean
  /** The names on the stairs (the compact staircase always shows do-re-mi). */
  readonly names?: () => NamesMode
  /** Hears every new layout, for the controls laid over the drawing. */
  readonly onLayout?: (layout: StairsLayout) => void
}

/** How a played run lights the drawing. */
export interface PlayLook {
  /** Whose voice: Merc's or Tavi's light, or chrome for the soft tone. */
  readonly color?: string
  /** The notes are Tavi's guess, the white keys: light the overlay's stairs. */
  readonly overlay?: boolean
  readonly kind?: VoiceOptions['kind']
  /** Hears each note as it starts. */
  readonly onNote?: (e: NoteEvent, i: number) => void
}

export interface StairsCore {
  readonly tonic: number
  readonly busy: boolean
  readonly layout: StairsLayout | null
  /** A slide: silent, the staircase keeping its shape. Starts run C4 to B4. */
  setTonic(midi: number): void
  /** Seconds a slide's travel takes (none under reduced motion). */
  readonly travel: number
  /** The scene's switches. */
  set(patch: Partial<SceneSwitches>): void
  readonly switches: Readonly<SceneSwitches>
  /** Flashes Group's two brackets in turn. */
  flashBrackets(): void
  /** Plays notes, lighting each stair and key as it sounds; resolves when the last ends. */
  play(
    events: readonly NoteEvent[],
    audible: boolean,
    look?: PlayLook,
  ): Promise<void>
  /** Stops a run in flight: its notes fall silent and its lights go out. */
  stop(): void
}

/** The parts of the scene a page turns on and off. */
export interface SceneSwitches {
  readonly steps: boolean
  readonly gold: boolean
  readonly group: boolean
  readonly white: boolean
  /** Stop on ti's wait: the top stair an outline, the arrow up from ti. */
  readonly waiting: boolean
  /** Land on do's arrival: the top stair's house lit. */
  readonly home: boolean
}

const OFF: SceneSwitches = {
  steps: false,
  gold: false,
  group: false,
  white: false,
  waiting: false,
  home: false,
}

/** Seconds of a slide's travel, of Group's brackets and the overlay fading in, and of the arrow drawing. */
const TRAVEL_SEC = 0.32
const FADE_SEC = 0.25
const ARROW_SEC = 0.45
const FLASH_SEC = 0.45

/** How long a stair stays lit after its note ends, seconds. */
const AFTERGLOW_SEC = 0.18

interface Lit {
  readonly stair: number
  readonly overlay: boolean
  readonly from: number
  readonly to: number
  readonly color: string
}

/** Eases `from` towards `to` by `dt` seconds of a `sec`-second move; lands at once under reduced motion. */
function approach(from: number, to: number, dt: number, sec: number): number {
  if (reducedMotion()) return to
  const step = dt / sec
  return from < to ? Math.min(to, from + step) : Math.max(to, from - step)
}

const smoothstep = (u: number): number => u * u * (3 - 2 * u)

export function mountStairs(opts: StairsCoreOptions): StairsCore {
  const cv: Surface = surface(opts.canvas)
  const coarse = window.matchMedia('(pointer: coarse)').matches
  let tonic = START_LO
  let view = START_LO
  let travelFrom = START_LO
  let travelU = 1
  let sw: SceneSwitches = OFF
  const eased = { group: 0, white: 0, arrow: 0, home: 0 }
  let whiteFrom: number | null = null
  let flashAt = -1
  let lits: Lit[] = []
  const pulses = new Map<number, number>()
  let voices: Voice[] = []
  let timers: number[] = []
  // the run in flight resolves early when another replaces it or it is stopped
  let finish: (() => void) | null = null
  let busy = false
  let layout: StairsLayout | null = null
  let lastKey = ''

  const now = (): number => performance.now() / 1000

  function modeFor(W: number, H: number): StairsMode {
    return opts.compact ? 'compact' : fullMode(W, H, coarse)
  }

  function lightOf(i: number, overlay: boolean, t: number): StairLight | null {
    let best: StairLight | null = null
    for (const l of lits) {
      if (l.stair !== i || l.overlay !== overlay || t < l.from) continue
      const amount = t <= l.to ? 1 : 1 - (t - l.to) / AFTERGLOW_SEC
      if (amount > 0 && (best === null || amount > best.amount))
        best = { amount, color: l.color }
    }
    return best
  }

  function scene(t: number): StairsScene {
    const flash = (g: number): number => {
      if (flashAt < 0) return 0
      const u = (t - flashAt - g * FLASH_SEC) / FLASH_SEC
      return u < 0 || u > 1 ? 0 : Math.sin(Math.PI * u)
    }
    return {
      tonic,
      names: opts.compact ? 'solfege' : (opts.names?.() ?? 'letters'),
      steps: sw.steps,
      gold: sw.gold,
      group: eased.group,
      groupFlash: [flash(0), flash(1)],
      white: eased.white,
      whiteFrom,
      whiteLit: (i) => lightOf(i, true, t)?.amount ?? 0,
      light: (i) => lightOf(i, false, t),
      keyPulse: (m) => {
        const at = pulses.get(m)
        return at === undefined ? 0 : Math.max(0, 1 - (t - at) / 0.7)
      },
      waiting: sw.waiting,
      arrow: smoothstep(eased.arrow),
      home: eased.home,
    }
  }

  function step(dt: number): void {
    travelU = approach(travelU, 1, dt, TRAVEL_SEC)
    view = travelFrom + (tonic - travelFrom) * smoothstep(travelU)
    eased.group = approach(eased.group, sw.group ? 1 : 0, dt, FADE_SEC)
    eased.white = approach(eased.white, sw.white ? 1 : 0, dt, FADE_SEC)
    eased.arrow = approach(eased.arrow, sw.waiting ? 1 : 0, dt, ARROW_SEC)
    eased.home = approach(eased.home, sw.home ? 1 : 0, dt, FADE_SEC)
  }

  function draw(_now: number, dt: number): void {
    step(dt)
    const { ctx, w, h } = cv.fit()
    layout = stairsLayout(modeFor(w, h), w, h, view)
    const key = `${layout.mode} ${w} ${h} ${view.toFixed(3)}`
    if (key !== lastKey) {
      lastKey = key
      opts.onLayout?.(layout)
    }
    paintStairs(ctx, layout, scene(now()), view)
    // the lights a run has finished with
    const t = now()
    lits = lits.filter((l) => t < l.to + AFTERGLOW_SEC)
  }

  addDrawer({ active: opts.active, draw })

  function clearRun(): void {
    timers.forEach((id) => window.clearTimeout(id))
    timers = []
    voices.forEach((v) => v.stop(0.08))
    voices = []
    lits = []
    busy = false
    const done = finish
    finish = null
    done?.()
  }

  function stairOf(midi: number, overlay: boolean): number {
    const notes = overlay ? (whiteKeysFrom(tonic) ?? []) : scaleNotes(tonic)
    return notes.indexOf(midi)
  }

  return {
    get tonic() {
      return tonic
    },
    get busy() {
      return busy
    },
    get layout() {
      return layout
    },
    get switches() {
      return sw
    },
    get travel() {
      return reducedMotion() ? 0 : TRAVEL_SEC
    },
    setTonic(midi) {
      const next = clamp(Math.round(midi), START_LO, START_HI)
      if (next === tonic) return
      travelFrom = view
      travelU = 0
      tonic = next
      // the overlay follows a slide (the toy turns it off for a black start)
      if (sw.white) whiteFrom = tonic
    },
    set(patch) {
      sw = { ...sw, ...patch }
      if (patch.white === true) whiteFrom = tonic
      if (patch.white === false) whiteFrom = null
    },
    flashBrackets() {
      flashAt = reducedMotion() ? -1 : now()
    },
    play(events, audible, look = {}) {
      clearRun()
      busy = true
      const t0 = now()
      const color = look.color ?? COLOR.chrome
      return new Promise<void>((resolve) => {
        finish = resolve
        events.forEach((e, i) => {
          const id = window.setTimeout(() => {
            if (audible) {
              const v = Sound.voice(hz(e.midi), { kind: look.kind, dur: e.dur })
              if (v !== null) voices.push(v)
            }
            pulses.set(e.midi, now())
            look.onNote?.(e, i)
          }, e.at * 1000)
          timers.push(id)
          const stair = stairOf(e.midi, look.overlay === true)
          if (stair >= 0)
            lits.push({
              stair,
              overlay: look.overlay === true,
              from: t0 + e.at,
              to: t0 + e.at + e.dur,
              color,
            })
        })
        timers.push(
          window.setTimeout(
            () => {
              busy = false
              voices = []
              timers = []
              finish = null
              resolve()
            },
            lengthOf(events) * 1000,
          ),
        )
      })
    },
    stop() {
      clearRun()
    },
  }
}
