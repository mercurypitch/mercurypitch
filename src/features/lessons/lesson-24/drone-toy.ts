// ============================================================
// Lesson 24 drone toy — Lesson 5's band chart with a drone held under it
// ============================================================
//
// The steps' figure and free play's (WEB-SPEC, Toys 2): the drone chart in
// four states, each with its own window and controls (`data-part`;
// kit/step-parts.ts): close notes, the top note dragged against the drone,
// with Octave and three preset plays; the beads, with Piano · Pure and Play
// all three; the band on mi, mi dragged between its edges; and the wave.
// Every line comes from the schedule its play sounds and every brightness
// from the same frequencies (drone-picture.ts), so the drawing and the
// sound share one clock.
//
// Until the cold open's choice every control is disabled under the lock
// line and the chart draws only the drone's band (`unlock`); Step 2's
// controls, Steps 3 and 4's states and every play that sets the piano's mi
// or so over the drone wait for Step 2's choice too (`unlockStep2`), under
// the figure's own line in Steps 3 and 4, and in free play in Step 2 as
// well, where no predict sits beside it (FACTS 46).
//
// A drag plays the drone and the note together, following the drag for up
// to 6 s from the grab, and rings on at the pitch it was left on for 4 s
// after release; the arrow keys move it 0.5 Hz, Page Up and Page Down 2 Hz.
// Within 0.1 Hz of the drone (0.2 Hz of its octave) Step 1's note snaps to
// it, and the snap restarts the note in phase: the dragged voice releases
// over 0.05 s while a new one starts on a whole period of the drone's,
// counted from the drone's own start, so every partial of the two lines up
// and the still unison sounds whole (FACTS 44, 69). One sound plays at a
// time across the page (`NowPlaying`); opening another state stops what
// the toy plays. A play cut short leaves its lines as they last drew.

import type { BandChart } from '@/features/lessons/kit/band-chart'
import { mountBandChart } from '@/features/lessons/kit/band-chart'
import { paintDrone } from '@/features/lessons/kit/band-chart-drone'
import { colourLine, coloursOf, } from '@/features/lessons/kit/band-chart-drone-scene'
import { q, qa } from '@/features/lessons/kit/dom'
import type { Schedule } from '@/features/lessons/kit/drone-beats'
import { brightness, steady } from '@/features/lessons/kit/drone-beats'
import { addDrawer, wake } from '@/features/lessons/kit/frame-loop'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import type { SoundOwner } from '@/features/lessons/kit/now-playing'
import { playLights } from '@/features/lessons/kit/play-lights'
import type { Run } from '@/features/lessons/kit/run'
import type { Voice } from '@/features/lessons/kit/sound'
import { Sound } from '@/features/lessons/kit/sound'
import { showParts } from '@/features/lessons/kit/step-parts'
import type { Choices, DroneState, Settings, View } from './drone-picture'
import { heldBack, miHz, playOf, START, stillOf, viewOf } from './drone-picture'
import { dragWords, FIG, hzWords, miWords, playWords, readoutOf, stillWords, } from './drone-words'
import type { Play, PlayKey, Tuning } from './sounds'
import { DRONE_HZ, NOTE_GAIN, playFor, startPlay } from './sounds'

/** Which state each play draws on (WEB-SPEC, Toys 2 and 3). */
export const PLAY_STATE: Readonly<Record<PlayKey, DroneState>> = {
  pair: 1,
  slide: 1,
  '222': 1,
  '221': 1,
  '220.5': 1,
  '220': 1,
  octave: 1,
  fifth: 2,
  third: 2,
  mi: 2,
  so: 2,
  chord: 2,
  'mi-piano': 3,
  'mi-pure': 3,
  wave: 4,
  straight: 4,
}

/** Seconds a drag follows the note from its grab, and rings on after its release. */
export const FOLLOW_SEC = 6
export const RING_SEC = 4
/** How near the drone, Hz, Step 1's note snaps to it: its octave's is twice as wide. */
export const SNAP_HZ = 0.1
/** What the arrow keys and Page Up and Page Down move a dragged note, Hz. */
export const KEY_STEP = { arrow: 0.5, page: 2 } as const
/** Seconds the dragged voice releases over at a snap. */
const SNAP_RELEASE = 0.05
/** The chart's window at rest, seconds. */
const STILL_WINDOW = 4

const now = (): number => performance.now() / 1000

/** A note whose frequency a drag moves: its cycles carried on through each change, so its phase never jumps. */
class DraggedTone implements Schedule {
  readonly dur = Infinity
  private f: number
  private at: number
  private done: number
  constructor(f: number, at: number, done = 0) {
    this.f = f
    this.at = at
    this.done = done
  }
  hz(): number {
    return this.f
  }
  centre(): number {
    return this.f
  }
  cycles(t: number): number {
    return this.done + this.f * (t - this.at)
  }
  /** Moves it to `f` at `t`, its phase carried on. */
  retune(f: number, t: number): void {
    this.done = this.cycles(t)
    this.at = t
    this.f = f
  }
}

export interface DroneToyOptions {
  /** When the chart draws and its plays move: a deck's `toyActive(1)`, or while it is on screen. */
  readonly active: () => boolean
  /** The page's one sound (kit/now-playing.ts). */
  readonly owner: SoundOwner
  /** Free play: Step 2's state waits under the figure's own line too. */
  readonly free?: boolean
}

export interface DroneToy {
  readonly chart: BandChart
  readonly state: DroneState
  /** Opens a state: its controls, its window and its still; what the toy plays stops. */
  setState(n: DroneState): void
  /** Plays a play in its own state, with the sound the caller decided (a predict's); false if cut short. */
  play(key: PlayKey, audible?: boolean): Promise<boolean>
  /** The cold open's choice: Step 1's state and controls. */
  unlock(): void
  /** Step 2's choice: Step 2's controls, Steps 3 and 4's states. */
  unlockStep2(): void
  /** Stops what the toy plays, the lines left as they last drew. */
  stop(): void
}

/** One play on the chart: what it is, its run, its state, and where it reached once it ended. */
interface Drawing {
  readonly key: PlayKey
  readonly play: Play
  readonly state: DroneState
  readonly t0: number
  readonly run: Run
  ended: number | null
}

/** A drag sounding: the drone and the note, their schedules, and its timers. */
interface Drag {
  readonly state: DroneState
  readonly t0: number
  /** The drone's start on the audio clock, for a snap's restart in phase; null while silent. */
  readonly audioT0: number | null
  readonly drone: Voice | null
  note: Voice | null
  tone: DraggedTone
  follow: number | null
  ring: number | null
}

/** Mounts the toy on `root`, locked until the cold open's choice, in Step 1's state. */
export function mountDroneToy(root: HTMLElement, o: DroneToyOptions): DroneToy {
  const label = root.querySelector<HTMLElement>('[data-fig-label]')
  const readout = q('[data-drone-readout]', root)
  const said = q('[data-drone-said]', root)
  const lock = q('[data-drone-lock]', root)
  const lock2 = q('[data-drone-lock2]', root)
  const top = q<HTMLInputElement>('[data-drone-top]', root)
  const octaveBtn = q<HTMLButtonElement>('[data-drone-octave]', root)
  const mi = q<HTMLInputElement>('[data-drone-mi]', root)
  const light = playLights()

  let state: DroneState = 1
  let choices: Choices = { cold: false, step2: false }
  let settings: Settings = START
  let drawing: Drawing | null = null
  let drag: Drag | null = null
  let shown: View | null = null

  // the play's clock runs before the chart's drawer, so a frame draws the moment it reaches
  addDrawer({
    active: o.active,
    wants: () =>
      !reducedMotion() &&
      ((drawing !== null && drawing.ended === null) || drag !== null),
    draw: () => {
      paint()
    },
  })
  const chart = mountBandChart(q('[data-drone-viz]', root), {
    target: 57,
    axis: { span: [-40, 40] },
    window: STILL_WINDOW,
    ticks: [],
    centre: false,
    active: o.active,
    paintRungs: paintDrone,
  })

  /** Moves the chart to the window the state draws on, when it changes. */
  function applyView(): void {
    const v = viewOf(state, settings, choices)
    if (shown === v) return
    shown = v
    if (chart.target !== v.target) chart.setTarget(v.target)
    chart.setAxis({ span: v.span })
  }

  /** The drag's scene: the still, its note where the drag has it, and the beats as they sound. */
  function dragScene(d: Drag): ReturnType<typeof stillOf> {
    const still = stillOf(state, settings, choices, chart.window)
    const t = now() - d.t0
    return {
      ...still,
      bright: reducedMotion()
        ? { slow: null, fast: null }
        : brightness([steady(DRONE_HZ, Infinity), d.tone], t),
    }
  }

  /** Writes what the chart shows now into its scene. */
  function paint(): void {
    applyView()
    const d = drawing
    if (drag !== null) chart.scene.drone = dragScene(drag)
    else if (d !== null && d.state === state)
      chart.scene.drone = playOf(state, settings, choices, {
        key: d.key,
        play: d.play,
        t: d.ended ?? now() - d.t0,
        sounding: d.ended === null,
        reduced: reducedMotion(),
      })
    else chart.scene.drone = stillOf(state, settings, choices, chart.window)
    const words = readoutOf(
      state,
      settings,
      choices,
      d !== null && d.state === state && drag === null ? d : null,
    )
    readout.hidden = words === null
    readout.textContent = words ?? ''
  }

  /** Which choice a play waits for: Step 1's plays the cold open's, every other Step 2's. */
  const playOpen = (key: PlayKey): boolean =>
    PLAY_STATE[key] === 1 ? choices.cold : choices.step2

  /** Enables what the choices allow, and shows the lock lines for what they do not. */
  function syncControls(): void {
    for (const b of qa<HTMLButtonElement>('[data-drone-play]', root))
      b.disabled = !playOpen(b.dataset.dronePlay as PlayKey)
    top.disabled = !choices.cold
    octaveBtn.disabled = !choices.cold
    for (const b of qa<HTMLButtonElement>(
      '[data-drone-bead], [data-drone-tuning]',
      root,
    ))
      b.disabled = !choices.step2
    mi.disabled = !choices.step2
    lock.hidden = choices.cold
    const waits = o.free === true ? state >= 2 : state >= 3
    lock2.hidden = !(choices.cold && !choices.step2 && waits)
  }

  function describe(): void {
    chart.describe(stillWords(state, settings, choices))
  }

  // ---------------------------------------------------------------- plays

  function stopDrag(): void {
    const d = drag
    if (d === null) return
    drag = null
    for (const id of [d.follow, d.ring]) if (id !== null) clearTimeout(id)
    d.drone?.stop(0.08)
    d.note?.stop(0.08)
    o.owner.release(stopDrag)
    said.textContent = dragWords(d.state, d.tone.hz())
    paint()
  }

  function stop(): void {
    drawing?.run.stop()
    stopDrag()
  }

  function play(key: PlayKey, audible = Sound.canPlay()): Promise<boolean> {
    const n = PLAY_STATE[key]
    if (n !== state) setState(n)
    stop()
    if (n === 1) {
      // a preset sets Step 1's note, and its octave
      const octave = key === 'octave'
      const p0 = playFor(key)
      setOctave(octave)
      setTop(p0.notes[0].kind === 'level' ? p0.notes[0].hz : settings.top)
    }
    const p = playFor(key, settings.tuning)
    const run = startPlay(p, audible)
    const mine: Drawing = {
      key,
      play: p,
      state: n,
      t0: now(),
      run,
      ended: null,
    }
    drawing = mine
    const stopMine = (): void => {
      run.stop()
    }
    o.owner.claim(stopMine)
    chart.setWindow(p.sec)
    said.textContent = playWords(n, settings, choices, key, p)
    paint()
    wake()
    void run.done.then((heard) => {
      o.owner.release(stopMine)
      if (drawing !== mine) return
      mine.ended = heard ? p.sec : Math.min(p.sec, now() - mine.t0)
      paint()
      wake()
    })
    return run.done
  }

  // ---------------------------------------------------------------- drags

  /** The dragged note's frequency, from its slider: Step 1's in hertz, Step 3's in cents from the piano's mi. */
  const dragHz = (n: DroneState): number =>
    n === 3 ? miHz(settings.mi) : settings.top

  /** Starts the drag's sound and its picture, or takes the drag on if it already sounds. */
  function grab(n: DroneState): void {
    if (drag !== null && drag.state === n) {
      if (drag.ring !== null) clearTimeout(drag.ring)
      drag.ring = null
      if (drag.follow === null)
        drag.follow = window.setTimeout(() => release(), FOLLOW_SEC * 1000)
      return
    }
    stop()
    drawing = null
    const f = dragHz(n)
    const audible = Sound.canPlay()
    // the drone and the note in one task: one audio time, each partial at phase 0
    const audioT0 = audible ? (Sound.context()?.currentTime ?? null) : null
    const opts = { kind: 'merc' as const, vibrato: null, gain: NOTE_GAIN }
    const droneVoice = audible ? Sound.voice(DRONE_HZ, opts) : null
    const noteVoice = audible ? Sound.voice(f, opts) : null
    const t0 = now()
    drag = {
      state: n,
      t0,
      audioT0,
      drone: droneVoice,
      note: noteVoice,
      tone: new DraggedTone(f, 0),
      follow: window.setTimeout(() => release(), FOLLOW_SEC * 1000),
      ring: null,
    }
    o.owner.claim(stopDrag)
    wake()
  }

  /** Moves the dragged note; Step 1's snaps to the drone, or its octave, restarted in phase. */
  function move(n: DroneState): void {
    const d = drag
    if (d === null || d.follow === null) return
    const f = dragHz(n)
    const t = now() - d.t0
    const unison = settings.octave ? 2 * DRONE_HZ : DRONE_HZ
    if (f === d.tone.hz()) return
    if (n === 1 && f === unison) {
      // arrived on the drone: restarted in phase, its cycles the drone's own
      // (or its second harmonic's), counted from the drone's start
      d.note?.stop(SNAP_RELEASE)
      d.note = restartInPhase(d)
      d.tone = new DraggedTone(f, t, f * t)
      return
    }
    d.note?.setFreq(f)
    d.tone.retune(f, t)
  }

  /** A new voice on the drone, or its octave, from the drone's next whole period, counted from its start: every partial lines up with the drone's. */
  function restartInPhase(d: Drag): Voice | null {
    const ctx = Sound.context()
    if (d.audioT0 === null || ctx === null) return null
    const f = settings.octave ? 2 * DRONE_HZ : DRONE_HZ
    const lead = 0.02
    const k = Math.ceil((ctx.currentTime + lead - d.audioT0) * DRONE_HZ)
    const at = d.audioT0 + k / DRONE_HZ - ctx.currentTime
    return Sound.voice(f, {
      kind: 'merc',
      vibrato: null,
      gain: NOTE_GAIN,
      at,
    })
  }

  /** The grab let go: the drag rings on for 4 s at the pitch it was left on, then stops. */
  function release(): void {
    const d = drag
    if (d === null) return
    if (d.follow !== null) clearTimeout(d.follow)
    d.follow = null
    if (d.ring !== null) clearTimeout(d.ring)
    d.ring = window.setTimeout(stopDrag, RING_SEC * 1000)
  }

  // ---------------------------------------------------------------- settings

  function setTop(f: number): void {
    settings = { ...settings, top: f }
    top.value = String(f)
    top.setAttribute('aria-valuetext', `${Math.round(f * 10) / 10} hertz`)
    q('[data-drone-top-out]', root).textContent = hzWords(f)
  }

  function setOctave(on: boolean): void {
    if (settings.octave === on) return
    const f = on ? settings.top * 2 : settings.top / 2
    settings = { ...settings, octave: on }
    octaveBtn.setAttribute('aria-pressed', String(on))
    top.min = on ? '432' : '216'
    top.max = on ? '448' : '224'
    setTop(Math.round(f * 10) / 10)
  }

  function setTuning(t: Tuning): void {
    stop()
    drawing = null
    settings = { ...settings, tuning: t }
    for (const b of qa<HTMLButtonElement>('[data-drone-tuning]', root))
      b.setAttribute('aria-pressed', String(b.dataset.droneTuning === t))
    describe()
    paint()
  }

  function setMi(cents: number): void {
    settings = { ...settings, mi: cents }
    const where = miWords(cents)
    q('[data-drone-mi-out]', root).textContent = where
    mi.setAttribute('aria-valuetext', where.replace('tick', 'mi'))
  }

  function setState(n: DroneState): void {
    if (n === state) return
    stop()
    const before = coloursOf(stillOf(state, settings, choices, chart.window))
    drawing = null
    state = n
    showParts(root, n)
    if (label !== null) label.innerHTML = FIG[n]
    chart.setWindow(STILL_WINDOW)
    syncControls()
    describe()
    const after = coloursOf(stillOf(n, settings, choices, chart.window))
    // each change of colours gets its line (FACTS 40)
    said.textContent = heldBack(n, choices)
      ? ''
      : (colourLine(before, after) ?? '')
    paint()
  }

  // ---------------------------------------------------------------- the controls

  for (const b of qa<HTMLButtonElement>('button[data-drone-play]', root)) {
    const key = b.dataset.dronePlay as PlayKey
    b.addEventListener('click', () => {
      if (b.disabled) return
      light(b, play(key))
    })
  }
  for (const b of qa<HTMLButtonElement>('button[data-drone-bead]', root)) {
    const key = b.dataset.droneBead as PlayKey
    b.addEventListener('click', () => {
      if (b.disabled) return
      light(b, play(key))
    })
  }
  for (const b of qa<HTMLButtonElement>('button[data-drone-tuning]', root))
    b.addEventListener('click', () => {
      if (b.disabled) return
      setTuning(b.dataset.droneTuning === 'pure' ? 'pure' : 'piano')
    })
  octaveBtn.addEventListener('click', () => {
    if (octaveBtn.disabled) return
    stop()
    drawing = null
    setOctave(settings.octave !== true)
    describe()
    paint()
  })

  /** A slider dragged: Step 1's top note, which snaps to the drone, or Step 3's mi. */
  function wire(input: HTMLInputElement, n: DroneState): void {
    const set = (v: number): void => {
      if (n === 3) setMi(v)
      else {
        const unison = settings.octave ? 2 * DRONE_HZ : DRONE_HZ
        const snap = settings.octave ? 2 * SNAP_HZ : SNAP_HZ
        setTop(Math.abs(v - unison) <= snap + 1e-9 ? unison : v)
      }
    }
    const moved = (v: number): void => {
      set(v)
      if (drag === null || drag.state !== n || drag.follow === null) grab(n)
      move(n)
      describe()
      paint()
    }
    input.addEventListener('pointerdown', () => {
      if (!input.disabled) grab(n)
    })
    input.addEventListener('input', () => {
      if (!input.disabled) moved(Number(input.value))
    })
    for (const type of ['change', 'pointerup', 'pointercancel'])
      input.addEventListener(type, () => {
        release()
      })
    input.addEventListener('keydown', (e) => {
      const steps: Record<string, number> = {
        ArrowUp: KEY_STEP.arrow,
        ArrowRight: KEY_STEP.arrow,
        ArrowDown: -KEY_STEP.arrow,
        ArrowLeft: -KEY_STEP.arrow,
        PageUp: KEY_STEP.page,
        PageDown: -KEY_STEP.page,
      }
      const step = steps[e.key]
      if (step === undefined || input.disabled) return
      e.preventDefault()
      const lo = Number(input.min)
      const hi = Number(input.max)
      const v = Math.min(hi, Math.max(lo, Number(input.value) + step))
      input.value = String(v)
      moved(v)
      release()
    })
  }
  wire(top, 1)
  wire(mi, 3)

  showParts(root, 1)
  syncControls()
  paint()

  return {
    chart,
    get state() {
      return state
    },
    setState,
    play,
    unlock() {
      if (choices.cold) return
      choices = { ...choices, cold: true }
      syncControls()
      describe()
      paint()
    },
    unlockStep2() {
      if (choices.step2) return
      choices = { ...choices, step2: true }
      syncControls()
      describe()
      paint()
    },
    stop,
  }
}
