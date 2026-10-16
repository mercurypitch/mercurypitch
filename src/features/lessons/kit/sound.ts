// ============================================================
// Lesson sound — every example synthesised at its exact frequency
// ============================================================
//
// One AudioContext, made on the first tap that asks for sound; nothing plays
// before a play button is pressed. The page boots no framework, so it keeps
// its own small graph rather than the app's audio engine, and follows the
// house envelope rules (.claude/memory/audio-pop-free-playback.md): every
// start is an exponential rise from the 1e-4 floor, every stop a
// setTargetAtTime decay (time constant release / 5) with the oscillators
// stopped only after the release plus 60 ms of slack.

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

function voice(freq: number, o: VoiceOptions = {}): Voice | null {
  if (ctx === null || master === null || state !== 'on') return null
  const context = ctx
  const t = context.currentTime
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
  rise(env.gain, t, 1, o.attack ?? (merc ? 0.09 : 0.035))
  osc.start(t)
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
      const rel = release ?? o.release ?? (merc ? 0.34 : 0.22)
      const now = context.currentTime
      env.gain.cancelScheduledValues(now)
      env.gain.setValueAtTime(env.gain.value, now)
      env.gain.setTargetAtTime(0, now, rel / 5)
      parts.forEach((p) => {
        try {
          p.stop(now + rel + SLACK)
        } catch {
          // already stopped
        }
      })
    },
  }
  live.add(handle)
  if (o.dur !== undefined) setTimeout(() => handle.stop(), o.dur * 1000)
  return handle
}

/** A plucked string: harmonic n at sin(n pi p) / n^2 for a pluck at p, the higher ones dying faster. */
function pluck(freq: number, gain = 0.3): void {
  if (ctx === null || master === null || state !== 'on') return
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
  if (ctx === null || master === null || state !== 'on') return
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
    if (state === 'off') {
      toast('Sound is off, so this one plays silently.', true)
      return false
    }
    if (state === 'unset') Sound.set('on')
    return ensure() !== null
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
