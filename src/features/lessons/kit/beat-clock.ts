// ============================================================
// Beat clock — a lookahead scheduler on the audio clock
// ============================================================
//
// A run is bars of hits (a click, a drum hit, a sung note, a Merc's hop),
// each at a beat of its bar, at a tempo read beat by beat, so a change of
// tempo applies from the next beat. It starts a lead after the tap that
// starts it (0.1 s, or a take's 0.6 s). On every frame of the kit's frame
// loop it books each hit that falls within the next 0.1 s at its exact time
// on the audio clock (`start(when)`, through `book`); a hit whose time has
// already passed when it comes up is skipped, never played late. Each run
// plays into its own bus on the kit's master (kit/sound-ahead.ts), so Stop fades
// that bus out over 30 ms and drops it, and every hit already booked goes
// silent with it: leaving a step cancels what it booked, not only what is
// sounding. The Sound switch, the hush and a hidden page close the bus too,
// and the run ends with it. Nothing is started or stopped by a timer.
//
// The two clocks. What the page draws (a lit beat, the metronome's arm, a
// Merc's hop) follows the sound as heard: an audio-clock time is mapped
// onto the page's clock by the context's output timestamp, read on every
// frame, the latest reading whose `performanceTime` is above 0; with none,
// by `currentTime` and `performance.now()` read together as the run starts,
// as the Ear Lab's Pulse does. A run with no sound (sound off) keeps time on
// the page's clock alone and still draws every hit.
//
// Lesson 8's page drives every sound it makes through this clock; the clock
// is generic, so a later rhythm lesson can drive its own.

import { addDrawer, wake } from './frame-loop'
import { Sound } from './sound'
import type { Bus } from './sound-ahead'
import { openBus } from './sound-ahead'

/** One hit of a bar: its beat from the bar's first (fractional for an eighth; below 0 before it) and what it is. */
export interface Hit<T> {
  readonly beat: number
  readonly data: T
}

/** A bar: how many beats, and its hits. */
export interface Bar<T> {
  readonly beats: number
  readonly hits: readonly Hit<T>[]
}

/** Where a run is: its bar (from 0), the beat in it (from 0) and the beats since its start. */
export interface Spot {
  readonly bar: number
  readonly beat: number
  /** Beats since the run's first, fractional between beats. */
  readonly beats: number
}

export interface RunOptions<T> {
  /** The bar at `index` (from 0), asked for as it comes up; null ends the run there. */
  readonly bar: (index: number) => Bar<T> | null
  /** The tempo, beats per minute, read as each beat comes up. */
  readonly bpm: () => number
  /** Whether it sounds: decided once by the caller, from `Sound.canPlay()`. */
  readonly audible: boolean
  /** Seconds from the tap to the first beat (default 0.1). */
  readonly lead?: number
  /** Seconds held after the last bar's end before the run ends (default 0). */
  readonly tail?: number
  /** How far ahead of a beat a hit may fall (a hop before its clap), seconds (default 0). */
  readonly early?: number
  /** Books a hit's sound at `when` on the audio clock, into the run's bus. */
  readonly book?: (data: T, when: number, bus: Bus) => void
  /** A hit's moment as heard (skipped hits are never shown). */
  readonly onHit?: (data: T, spot: Spot) => void
  /** Each beat's moment as heard. */
  readonly onBeat?: (spot: Spot) => void
  /** Every frame while it runs: where it is, as heard. */
  readonly onFrame?: (spot: Spot) => void
}

export interface Run {
  /** True once it has played to its end; false when it was stopped, by its owner or by the page. */
  readonly done: Promise<boolean>
  readonly running: boolean
  /** Stops it: its bus fades over 30 ms and drops, and nothing more is booked. */
  stop(): void
  /** When beat `n` (from 0) sounded or will sound, ms on the page's clock; null for a beat not yet timed. */
  pageTimeOfBeat(n: number): number | null
}

/** A moment on the audio timeline paired with when the device played it. */
export interface OutputStamp {
  readonly contextTime: number
  readonly performanceTime: number
}

/** What a beat clock reads: the page's clock, the audio clock and a bus. */
export interface ClockEnv {
  /** The page's clock, ms (performance.now()). */
  now(): number
  /** The audio clock, seconds, or null where there is none. */
  audioTime(): number | null
  /** The context's latest output timestamp, or null. */
  outputStamp(): OutputStamp | null
  /** A bus for a run, or null while sound is not on. */
  bus(onClose: () => void): Bus | null
}

/** Booked lookahead, seconds: a hit is booked once it falls within this. */
export const LOOKAHEAD = 0.1

/** The fade on a run's bus once it has played to its end, seconds: its last releases ring out. */
const RING_OUT = 0.5

/** A timed beat: where, when on the run's clock, and its length. */
interface Timed {
  readonly spot: Spot
  readonly t: number
  readonly spb: number
}

/** A timed hit, waiting to be booked and then shown. */
interface Pending<T> {
  readonly data: T
  readonly t: number
  readonly spot: Spot
  booked: boolean
  skipped: boolean
}

/** Maps a run's clock (seconds) to the page's (ms) and back. */
interface ClockMap {
  toPage(t: number): number
  toRun(ms: number): number
}

function silentMap(): ClockMap {
  return { toPage: (t) => t * 1000, toRun: (ms) => ms / 1000 }
}

/** The audio clock against the page's, from the latest usable output timestamp, else from a pair read now. */
function audioMap(env: ClockEnv): ClockMap & { refresh(): void } {
  const t0 = env.audioTime() ?? 0
  const ms0 = env.now()
  let base = { audio: t0, page: ms0 }
  return {
    toPage: (t) => base.page + (t - base.audio) * 1000,
    toRun: (ms) => base.audio + (ms - base.page) / 1000,
    refresh() {
      const s = env.outputStamp()
      if (s !== null && s.performanceTime > 0)
        base = { audio: s.contextTime, page: s.performanceTime }
    },
  }
}

/** The hits of `bar` that start in its beat `beat` (beat 0 also takes those before the bar). */
function hitsOfBeat<T>(bar: Bar<T>, beat: number): Hit<T>[] {
  return bar.hits.filter((h) =>
    beat === 0 ? h.beat < 1 : Math.floor(h.beat) === beat,
  )
}

/** One run, pumped by its clock on every frame. */
class BeatRun<T> implements Run {
  readonly done: Promise<boolean>
  private resolve: (finished: boolean) => void = () => undefined
  private live = true
  private readonly bus: Bus | null
  private readonly map: ClockMap & { refresh?(): void }
  private readonly timed: Timed[] = []
  private pending: Pending<T>[] = []
  private barIndex = 0
  private current: Bar<T> | null
  private beatInBar = 0
  private beatCount = 0
  private nextT: number
  private endT: number | null = null
  private shownBeats = 0

  constructor(
    private readonly env: ClockEnv,
    private readonly o: RunOptions<T>,
  ) {
    this.done = new Promise((r) => {
      this.resolve = r
    })
    this.bus = o.audible ? env.bus(() => this.finish(false)) : null
    const audio = this.bus === null ? null : env.audioTime()
    this.map = audio === null ? silentMap() : audioMap(env)
    const start = audio ?? env.now() / 1000
    this.nextT = start + (o.lead ?? 0.1)
    this.current = o.bar(0)
    if (this.current === null) this.endT = this.nextT
  }

  get running(): boolean {
    return this.live
  }

  stop(): void {
    this.finish(false)
  }

  pageTimeOfBeat(n: number): number | null {
    const b = this.timed[n]
    return b === undefined ? null : this.map.toPage(b.t)
  }

  /** The run's clock now: the audio clock, or the page's for a silent run. */
  private clockNow(): number {
    if (this.bus === null) return this.env.now() / 1000
    return this.env.audioTime() ?? this.env.now() / 1000
  }

  /** Times the beats that come up by `until`, and their hits. */
  private extend(until: number): void {
    while (this.endT === null && this.nextT <= until) {
      const bar = this.current
      if (bar === null) break
      const spb = 60 / this.o.bpm()
      const spot: Spot = {
        bar: this.barIndex,
        beat: this.beatInBar,
        beats: this.beatCount,
      }
      const t = this.nextT
      this.timed.push({ spot, t, spb })
      for (const h of hitsOfBeat(bar, this.beatInBar))
        this.pending.push({
          data: h.data,
          t: t + (h.beat - this.beatInBar) * spb,
          spot: { ...spot, beats: this.beatCount + (h.beat - this.beatInBar) },
          booked: false,
          skipped: false,
        })
      this.nextT = t + spb
      this.beatCount += 1
      this.beatInBar += 1
      if (this.beatInBar >= bar.beats) this.nextBar()
    }
  }

  private nextBar(): void {
    this.barIndex += 1
    this.beatInBar = 0
    this.current = this.o.bar(this.barIndex)
    if (this.current === null) this.endT = this.nextT
  }

  /** Books what falls within the lookahead; skips what has already passed. */
  private book(now: number): void {
    for (const p of this.pending) {
      if (p.booked || p.t > now + LOOKAHEAD) continue
      p.booked = true
      if (p.t < now) p.skipped = true
      else if (this.bus !== null) this.o.book?.(p.data, p.t, this.bus)
    }
  }

  /** Shows what has been heard by `heard`, on the run's clock. */
  private show(heard: number): void {
    const due = this.pending.filter((p) => p.booked && p.t <= heard)
    this.pending = this.pending.filter((p) => !(p.booked && p.t <= heard))
    while (this.shownBeats < this.timed.length) {
      const b = this.timed[this.shownBeats]
      if (b.t > heard) break
      this.shownBeats += 1
      this.o.onBeat?.(b.spot)
    }
    for (const p of due) if (!p.skipped) this.o.onHit?.(p.data, p.spot)
    if (!this.live) return
    this.o.onFrame?.(this.spotAt(heard))
  }

  /** Where the run is at `heard`: the last beat begun, and how far into it. */
  private spotAt(heard: number): Spot {
    let last: Timed | undefined
    for (let i = this.timed.length - 1; i >= 0; i--)
      if (this.timed[i].t <= heard) {
        last = this.timed[i]
        break
      }
    if (last === undefined) return { bar: 0, beat: 0, beats: 0 }
    const into = Math.min(0.999, Math.max(0, (heard - last.t) / last.spb))
    return { ...last.spot, beats: last.spot.beats + into }
  }

  /** One frame: books ahead, shows what was heard, and ends the run at its end. */
  pump(): void {
    if (!this.live) return
    this.map.refresh?.()
    const now = this.clockNow()
    this.extend(now + LOOKAHEAD + (this.o.early ?? 0))
    this.book(now)
    const heard = this.map.toRun(this.env.now())
    this.show(heard)
    if (this.endT !== null && heard >= this.endT + (this.o.tail ?? 0))
      this.finish(true)
  }

  private finish(finished: boolean): void {
    if (!this.live) return
    this.live = false
    this.pending = []
    // a run that played to its end lets its last releases ring out first
    this.bus?.close(finished ? RING_OUT : undefined)
    this.resolve(finished)
  }
}

/** A beat clock over `env`: `start` begins a run, and `pump` (once a frame) drives every run. */
export function createBeatClock(env: ClockEnv): {
  start<T>(o: RunOptions<T>): Run
  pump(): void
  stopAll(): void
  readonly busy: boolean
} {
  const runs = new Set<BeatRun<unknown>>()
  // a run whose page code throws stops, and the others keep time
  const pumpOne = (r: BeatRun<unknown>): void => {
    try {
      r.pump()
    } catch (err) {
      r.stop()
      console.error(err)
    }
  }
  return {
    start<T>(o: RunOptions<T>): Run {
      const run = new BeatRun<T>(env, o) as BeatRun<unknown>
      runs.add(run)
      void run.done.then(() => runs.delete(run))
      pumpOne(run)
      return run
    },
    pump() {
      for (const r of [...runs]) pumpOne(r)
    },
    stopAll() {
      for (const r of [...runs]) r.stop()
    },
    get busy() {
      return runs.size > 0
    },
  }
}

/** The page's clock on the page's audio context. */
const pageEnv: ClockEnv = {
  now: () => performance.now(),
  audioTime: () => Sound.context()?.currentTime ?? null,
  outputStamp() {
    const c = Sound.context()
    if (c === null || typeof c.getOutputTimestamp !== 'function') return null
    const s = c.getOutputTimestamp()
    return s.contextTime === undefined || s.performanceTime === undefined
      ? null
      : { contextTime: s.contextTime, performanceTime: s.performanceTime }
  },
  bus: (onClose) => openBus(onClose),
}

const clock = createBeatClock(pageEnv)
let drawing = false

/** The page's beat clock, on the kit's frame loop; a hidden page stops every run, silent ones too. */
export const BeatClock = {
  start<T>(o: RunOptions<T>): Run {
    if (!drawing) {
      drawing = true
      addDrawer({
        active: () => clock.busy,
        wants: () => clock.busy,
        draw: () => clock.pump(),
      })
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) clock.stopAll()
      })
    }
    const run = clock.start(o)
    wake()
    return run
  },
}

/** A run of these bars in order, then its end. */
export const bars =
  <T>(list: readonly Bar<T>[]) =>
  (index: number): Bar<T> | null =>
    list[index] ?? null
