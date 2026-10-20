// ============================================================
// Lesson sound — every example synthesised at its exact frequency
// ============================================================
//
// One AudioContext, made on the first tap that asks for sound; nothing plays
// before a play button is pressed. A page that listens through the
// microphone hands the same context to its analysis (`Sound.context()`),
// and holds every sound off while a take is open (`Sound.hush`). The page
// boots no framework, so it keeps its own small graph rather than the app's
// audio engine, and follows the
// house envelope rules (.claude/memory/audio-pop-free-playback.md): every
// start is an exponential rise from the 1e-4 floor, every stop a
// setTargetAtTime decay (time constant release / 5) with the oscillators
// stopped only after the release plus 60 ms of slack.
//
// A sung line (Merc's slide, a scale) is one voice along a contour: points
// of pitch and level, held where two points share a pitch and glided
// exponentially between them, all scheduled on the audio clock so the
// glides land on time whatever the main thread is doing. Its release is
// scheduled at the contour's last point, and an early stop releases from
// wherever the voice is.
//
// Noise is the one sound with no pitch (`playNoise`): band-passed, the air
// of an "h" before a note; white and 3 ms long, the click of a catch.

import { toast } from './toast'

export type SoundState = 'unset' | 'on' | 'off'

export interface VoiceOptions {
  /** 'merc' is Merc's "ooh": brighter partials and a 5.5 Hz vibrato. */
  kind?: 'soft' | 'merc'
  gain?: number
  /** Attack and release, seconds. */
  attack?: number
  release?: number
  /** Stop by itself after this many seconds. */
  dur?: number
  /**
   * Start this many seconds from now, on the audio clock (default now): a
   * note that begins under a burst of air (Lesson 5's three starts).
   */
  at?: number
}

export interface Voice {
  readonly alive: boolean
  setFreq(f: number, timeConstant?: number): void
  setGain(v: number, timeConstant?: number): void
  stop(release?: number): void
}

const FLOOR = 1e-4
const SLACK = 0.06

type AudioContextClass = typeof AudioContext

let ctx: AudioContext | null = null
let master: GainNode | null = null
let state: SoundState = 'unset'
// While a microphone take is open nothing may sound, or the take would hear
// the page instead of the singer (`Sound.hush`).
let hushed = false
const waves: { soft?: PeriodicWave; merc?: PeriodicWave } = {}
const listeners = new Set<(s: SoundState) => void>()
const live = new Set<Voice>()

function periodicWave(context: AudioContext, amps: number[]): PeriodicWave {
  const real = new Float32Array(amps.length + 1)
  const imag = new Float32Array(amps.length + 1)
  amps.forEach((a, i) => {
    imag[i + 1] = a
  })
  return context.createPeriodicWave(real, imag)
}

function ensure(): AudioContext | null {
  if (ctx === null) {
    const Ctor: AudioContextClass | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioContextClass })
        .webkitAudioContext
    if (Ctor === undefined) return null
    try {
      ctx = new Ctor()
    } catch {
      return null
    }
    master = ctx.createGain()
    master.gain.value = 0.9
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -16
    comp.knee.value = 12
    comp.ratio.value = 3
    comp.attack.value = 0.004
    comp.release.value = 0.25
    master.connect(comp)
    comp.connect(ctx.destination)
    // a soft, triangle-ish tone, and Merc's "ooh"
    waves.soft = periodicWave(ctx, [1, 0.3, 0.11, 0.05, 0.024, 0.012])
    waves.merc = periodicWave(
      ctx,
      [1, 0.62, 0.38, 0.24, 0.14, 0.08, 0.045, 0.025],
    )
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
  return ctx
}

function emit(): void {
  listeners.forEach((fn) => fn(state))
}

function stopAll(): void {
  live.forEach((v) => v.stop(0.06))
}

/** Exponential rise from the floor to `peak`, as the house envelopes do. */
function rise(
  param: AudioParam,
  at: number,
  peak: number,
  seconds: number,
): void {
  param.setValueAtTime(FLOOR, at)
  param.exponentialRampToValueAtTime(Math.max(FLOOR, peak), at + seconds)
}

/** One voice's nodes: oscillator, envelope, level, and everything to stop. */
interface Graph {
  readonly context: AudioContext
  readonly osc: OscillatorNode
  readonly env: GainNode
  readonly level: GainNode
  readonly parts: OscillatorNode[]
  /** When it started, on the audio clock. */
  readonly t: number
  readonly merc: boolean
  /** Attack and release, seconds. */
  readonly attack: number
  readonly release: number
}

/** Builds and starts a voice at `freq`, opening on the house attack; null while sound is not on. */
function build(freq: number, o: VoiceOptions): Graph | null {
  if (ctx === null || master === null || state !== 'on' || hushed) return null
  const context = ctx
  const t = context.currentTime + Math.max(0, o.at ?? 0)
  const merc = o.kind === 'merc'
  const osc = context.createOscillator()
  const wave = merc ? waves.merc : waves.soft
  if (wave !== undefined) osc.setPeriodicWave(wave)
  osc.frequency.setValueAtTime(freq, t)
  const lp = context.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = merc ? 2600 : 3400
  lp.Q.value = 0.5
  const env = context.createGain()
  const level = context.createGain()
  level.gain.value = o.gain ?? (merc ? 0.2 : 0.13)
  osc.connect(lp)
  lp.connect(env)
  env.connect(level)
  level.connect(master)
  const parts: OscillatorNode[] = [osc]
  if (merc) {
    // vibrato 5.5 Hz, +-14 cents, grown in over 0.35 s
    const lfo = context.createOscillator()
    const depth = context.createGain()
    lfo.frequency.value = 5.5
    depth.gain.setValueAtTime(0, t)
    depth.gain.linearRampToValueAtTime(14, t + 0.35)
    lfo.connect(depth)
    depth.connect(osc.detune)
    lfo.start(t)
    parts.push(lfo)
  }
  const attack = o.attack ?? (merc ? 0.09 : 0.035)
  rise(env.gain, t, 1, attack)
  osc.start(t)
  const release = o.release ?? (merc ? 0.34 : 0.22)
  return { context, osc, env, level, parts, t, merc, attack, release }
}

/** Stops every part of the voice once a release of `rel` from `at` has died away. */
function stopParts(g: Graph, at: number, rel: number): void {
  g.parts.forEach((p) => {
    try {
      p.stop(at + rel + SLACK)
    } catch {
      // already stopped
    }
  })
}

/** A voice's handle, and `retire` for a voice that has ended by itself. */
interface Live {
  readonly handle: Voice
  retire(): void
}

function handleOf(g: Graph): Live {
  const { context, osc, env, level } = g
  let alive = true
  const handle: Voice = {
    get alive() {
      return alive
    },
    setFreq(f, timeConstant = 0.02) {
      if (alive)
        osc.frequency.setTargetAtTime(f, context.currentTime, timeConstant)
    },
    setGain(v, timeConstant = 0.04) {
      if (alive)
        level.gain.setTargetAtTime(v, context.currentTime, timeConstant)
    },
    stop(release) {
      if (!alive) return
      alive = false
      live.delete(handle)
      const rel = release ?? g.release
      const now = context.currentTime
      env.gain.cancelScheduledValues(now)
      env.gain.setValueAtTime(env.gain.value, now)
      env.gain.setTargetAtTime(0, now, rel / 5)
      stopParts(g, now, rel)
    },
  }
  live.add(handle)
  return {
    handle,
    retire() {
      if (!alive) return
      alive = false
      live.delete(handle)
    },
  }
}

function voice(freq: number, o: VoiceOptions = {}): Voice | null {
  const g = build(freq, o)
  if (g === null) return null
  const { handle } = handleOf(g)
  if (o.dur !== undefined) setTimeout(() => handle.stop(), o.dur * 1000)
  return handle
}

/** A point of a sung line: the centre pitch, and the level, that the voice reaches at `t`. */
export interface ContourPoint {
  /** Seconds from the start of the line; the points run in time order. */
  readonly t: number
  /** Centre pitch, Hz (Merc's vibrato swings around it). */
  readonly hz: number
  /** Level, 0 to 1 of the voice's gain (default 1). */
  readonly level?: number
}

/** A stretch of a contour: hold the pitch for `hold` seconds, or glide to `to` Hz in `glide` seconds. */
export type ContourStep =
  | { readonly hold: number; readonly level?: number }
  | { readonly glide: number; readonly to: number; readonly level?: number }

/**
 * Holds and glides as contour points, from `hz` at time 0. Lesson 2's slide
 * on A3 (FACTS 50) is `contourOf(220, [{ hold: 1.2 }, { glide: 0.5, to:
 * 233.08 }, { hold: 1 }, { glide: 0.5, to: 220 }, { hold: 1 }])`.
 */
export function contourOf(
  hz: number,
  steps: readonly ContourStep[],
  level = 1,
): ContourPoint[] {
  const points: ContourPoint[] = [{ t: 0, hz, level }]
  let t = 0
  let f = hz
  let l = level
  for (const s of steps) {
    if ('glide' in s) {
      t += s.glide
      f = s.to
    } else t += s.hold
    l = s.level ?? l
    points.push({ t, hz: f, level: l })
  }
  return points
}

/** Seconds from a contour's start to its last point. */
export const contourLength = (points: readonly ContourPoint[]): number =>
  points.length === 0 ? 0 : points[points.length - 1].t

/**
 * One voice along `points`: pitch and level glide exponentially from point
 * to point (two points on one pitch hold it), all on the audio clock. It
 * opens on the house attack, and its release starts at the last point, the
 * oscillators stopping once the release has died away. Null while sound is
 * not on; `playContour` is the version that asks, for a play button.
 */
export function contourVoice(
  points: readonly ContourPoint[],
  o: VoiceOptions = {},
): Voice | null {
  const first = points[0]
  if (first === undefined) return null
  const g = build(first.hz, o)
  if (g === null) return null
  const { osc, env, level, t } = g
  const peak = level.gain.value
  const levelAt = (p: ContourPoint): number =>
    Math.max(FLOOR, peak * (p.level ?? 1))
  level.gain.setValueAtTime(levelAt(first), t)
  for (const p of points.slice(1)) {
    osc.frequency.exponentialRampToValueAtTime(p.hz, t + p.t)
    level.gain.exponentialRampToValueAtTime(levelAt(p), t + p.t)
  }
  const { handle, retire } = handleOf(g)
  // the release is part of the schedule, so the line ends on the audio clock
  const end = t + Math.max(contourLength(points), g.attack)
  env.gain.setValueAtTime(1, end)
  env.gain.setTargetAtTime(0, end, g.release / 5)
  stopParts(g, end, g.release)
  const settle = end - g.context.currentTime + g.release + SLACK
  setTimeout(retire, settle * 1000)
  return handle
}

/** A plucked string: harmonic n at sin(n pi p) / n^2 for a pluck at p, the higher ones dying faster. */
function pluck(freq: number, gain = 0.3): void {
  if (ctx === null || master === null || state !== 'on' || hushed) return
  const t = ctx.currentTime
  const out = ctx.createGain()
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 4200
  out.gain.value = gain
  out.connect(lp)
  lp.connect(master)
  const amps: number[] = []
  let norm = 0
  for (let n = 1; n <= 10; n++) {
    const a = Math.abs(Math.sin(n * Math.PI * 0.22)) / (n * n)
    amps.push(a)
    norm += a
  }
  amps.forEach((a, i) => {
    if (ctx === null) return
    const n = i + 1
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq * n * (1 + 0.0004 * n * n)
    rise(g.gain, t, a / norm, 0.004)
    g.gain.setTargetAtTime(0, t + 0.004, 0.55 / (1 + 0.45 * (n - 1)))
    osc.connect(g)
    g.connect(out)
    osc.start(t)
    osc.stop(t + 3.2)
  })
}

function tick(freq = 1500, gain = 0.09): void {
  if (ctx === null || master === null || state !== 'on' || hushed) return
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  rise(g.gain, t, gain, 0.003)
  g.gain.exponentialRampToValueAtTime(FLOOR, t + 0.07)
  osc.connect(g)
  g.connect(master)
  osc.start(t)
  osc.stop(t + 0.1)
}

/** A burst of noise: how long, how loud, its band and its envelope. */
export interface NoiseOptions {
  /** Seconds from its start to the start of its release. */
  readonly dur: number
  /** Peak level (default 0.06). */
  readonly gain?: number
  /** A band-pass around `hz` (an "h" is breath through an open mouth); white noise without one. */
  readonly band?: { readonly hz: number; readonly q: number }
  /** Attack and release, seconds (default 0.02 and 0.08). */
  readonly attack?: number
  readonly release?: number
  /** Seconds from now, on the audio clock (default now). */
  readonly at?: number
}

// One second of white noise per context, from a fixed seed, looped as long as a burst needs.
let noiseBuf: AudioBuffer | null = null

function noiseBuffer(context: AudioContext): AudioBuffer {
  if (noiseBuf !== null && noiseBuf.sampleRate === context.sampleRate)
    return noiseBuf
  const length = Math.round(context.sampleRate)
  const buf = context.createBuffer(1, length, context.sampleRate)
  const data = buf.getChannelData(0)
  let seed = 0x2f6b
  for (let i = 0; i < length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    data[i] = seed / 2147483648 - 1
  }
  noiseBuf = buf
  return buf
}

/**
 * Noise on the house envelope: an exponential attack from the floor, a
 * setTargetAtTime release, and the source stopped only once the release has
 * died away. The air of an "h" before a note, or a 3 ms click. Silent while
 * sound is not on or a take is open, like every other sound here.
 */
export function playNoise(o: NoiseOptions): void {
  if (ctx === null || master === null || state !== 'on' || hushed) return
  const context = ctx
  const t = context.currentTime + Math.max(0, o.at ?? 0)
  const attack = o.attack ?? 0.02
  const release = o.release ?? 0.08
  const peak = o.gain ?? 0.06
  const held = Math.max(attack, o.dur)
  const src = context.createBufferSource()
  src.buffer = noiseBuffer(context)
  src.loop = true
  const env = context.createGain()
  rise(env.gain, t, peak, attack)
  env.gain.setValueAtTime(peak, t + held)
  env.gain.setTargetAtTime(0, t + held, release / 5)
  let out: AudioNode = src
  if (o.band !== undefined) {
    const bp = context.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = o.band.hz
    bp.Q.value = o.band.q
    src.connect(bp)
    out = bp
  }
  out.connect(env)
  env.connect(master)
  src.start(t)
  src.stop(t + held + release + SLACK)
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopAll()
})

export const Sound = {
  get state(): SoundState {
    return state
  },
  set(next: SoundState): void {
    state = next
    if (next === 'on') ensure()
    if (next === 'off') stopAll()
    emit()
  },
  /**
   * Whether a tap may sound. The first tap turns sound on; with sound off it
   * says so, offering to turn it on, and the visuals play silently.
   */
  canPlay(): boolean {
    if (hushed) return false
    if (state === 'off') {
      toast("Sound is off, so you'll see this one but not hear it.", true)
      return false
    }
    if (state === 'unset') Sound.set('on')
    return ensure() !== null
  },
  /**
   * The page's one AudioContext, made now if no tap has made it yet, for a
   * consumer that listens rather than plays: the microphone's analysis runs
   * on the same clock as every note the page sings (kit/listen.ts). It is
   * made whatever the sound switch says, since listening plays nothing, and
   * must be asked for inside a tap. Null where the browser has no Web Audio.
   */
  context(): AudioContext | null {
    return ensure()
  },
  /**
   * Holds every sound off while `on`: a microphone take is open, and the
   * page must play nothing into it. Anything sounding stops at once; plays
   * meanwhile run their visuals silently, as with sound off, but say nothing.
   */
  hush(on: boolean): void {
    hushed = on
    if (on) stopAll()
  },
  get hushed(): boolean {
    return hushed
  },
  voice,
  pluck,
  tick,
  stopAll,
  subscribe(fn: (s: SoundState) => void): void {
    listeners.add(fn)
    fn(state)
  },
}

export interface ToneOptions extends VoiceOptions {
  /** Decided once by the caller, so a sequence is all sound or all silent. */
  audible?: boolean
}

/** A timed note whose visuals run even when sound is off; resolves when it ends. */
export function playTone(
  freq: number,
  dur: number,
  o: ToneOptions = {},
): Promise<Voice | null> {
  const audible = o.audible ?? Sound.canPlay()
  const v = audible ? voice(freq, { ...o, dur }) : null
  return new Promise((resolve) => setTimeout(() => resolve(v), dur * 1000))
}

/**
 * A sung line whose visuals run even when sound is off; resolves at its
 * last point, as its release begins.
 */
export function playContour(
  points: readonly ContourPoint[],
  o: ToneOptions = {},
): Promise<Voice | null> {
  const audible = o.audible ?? Sound.canPlay()
  const v = audible ? contourVoice(points, o) : null
  return new Promise((resolve) =>
    setTimeout(() => resolve(v), contourLength(points) * 1000),
  )
}
