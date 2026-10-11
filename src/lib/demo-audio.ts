// ============================================================
// Audible guided demos (glass plan §17.4, decision 18).
//
// Every instruction demo must be HEARABLE, not just animated —
// users need to hear what a glide/hold/lock sounds like to know
// what to do with their voice. Synthesized on the caller's
// AudioContext (post-gesture), zero assets. Shared so the Voice
// Mirror's silent TaskDemo can adopt the same examples later.
//
// Each play* routes through one master gain and returns a handle
// the caller MUST be able to stop: demos overlap otherwise (a
// siren still ringing under the target hum, an approach sketch
// bleeding into the live sing). GlassApp stops the previous demo
// before starting the next and the moment recording begins.
// ============================================================

/** Master level for demo audio — examples, not performances. */
const DEMO_GAIN = 0.07

export interface DemoSound {
  /** Ramp down and stop immediately (safe to call more than once). */
  stop: () => void
}

interface SoundOptions {
  /** Where the master goes; the context's speakers by default. */
  destination?: AudioNode
  /**
   * Close over this many seconds, pop-free (anchor, then setTargetAtTime,
   * oscillators stopped after the tail), instead of the quick ramp.
   */
  release?: number
}

/** Wrap a routed master gain + its oscillators into a stoppable handle. */
function sound(
  ctx: AudioContext,
  options: SoundOptions = {},
): {
  master: GainNode
  track: (node: OscillatorNode) => void
  handle: DemoSound
} {
  const master = ctx.createGain()
  master.connect(options.destination ?? ctx.destination)
  const oscillators: OscillatorNode[] = []
  const release = options.release
  let stopped = false
  return {
    master,
    track: (node) => oscillators.push(node),
    handle: {
      stop: () => {
        if (stopped) return
        stopped = true
        const t = ctx.currentTime
        try {
          master.gain.cancelScheduledValues(t)
          master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t)
          if (release === undefined) {
            master.gain.linearRampToValueAtTime(0.0001, t + 0.04)
          } else {
            master.gain.setTargetAtTime(0, t, release / 5)
          }
        } catch {
          // Context closed mid-stop — the nodes are already dead.
        }
        for (const osc of oscillators) {
          try {
            osc.stop(t + (release ?? 0) + 0.06)
          } catch {
            // Already stopped.
          }
        }
      },
    },
  }
}

function envelope(
  gain: AudioParam,
  t: number,
  seconds: number,
  peak: number,
): void {
  gain.setValueAtTime(0.0001, t)
  gain.exponentialRampToValueAtTime(peak, t + 0.08)
  gain.setValueAtTime(peak, t + seconds - 0.15)
  gain.exponentialRampToValueAtTime(0.0001, t + seconds)
}

/**
 * "Like a siren": an exponential frequency sweep from `fromHz` to `toHz` — the
 * calibration glide's audible example. Direction-agnostic, so `fromHz > toHz`
 * sweeps downward (the Voice Mirror's glide-down cue). Defaults sweep low→high.
 */
export function playSirenSweep(
  ctx: AudioContext,
  { fromHz = 150, toHz = 640, seconds = 2.2 } = {},
): DemoSound {
  const { master, track, handle } = sound(ctx)
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(fromHz, t)
  osc.frequency.exponentialRampToValueAtTime(toHz, t + seconds)
  envelope(master.gain, t, seconds, DEMO_GAIN)
  osc.connect(master)
  osc.start(t)
  osc.stop(t + seconds + 0.05)
  track(osc)
  return handle
}

/** A steady example tone — "hold it like this". */
export function playHoldTone(
  ctx: AudioContext,
  hz: number,
  seconds = 1.6,
): DemoSound {
  const { master, track, handle } = sound(ctx)
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = hz
  envelope(master.gain, t, seconds, DEMO_GAIN)
  osc.connect(master)
  osc.start(t)
  osc.stop(t + seconds + 0.05)
  track(osc)
  return handle
}

/**
 * The glass's voice: two barely-detuned sines at its resonant note —
 * played when the target is announced ("this glass rings at G4").
 */
export function playTargetHum(
  ctx: AudioContext,
  hz: number,
  seconds = 1.8,
): DemoSound {
  const { master, track, handle } = sound(ctx)
  const t = ctx.currentTime
  envelope(master.gain, t, seconds, DEMO_GAIN * 0.9)
  for (const detune of [-4, 4]) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = hz * Math.pow(2, detune / 1200)
    osc.connect(master)
    osc.start(t)
    osc.stop(t + seconds + 0.05)
    track(osc)
  }
  return handle
}

/**
 * "This is what winning sounds like": wanders below the target, settles onto
 * it, and blooms — played once before the first rep.
 */
export function playApproachAndLock(
  ctx: AudioContext,
  targetHz: number,
  { seconds = 2.4 } = {},
): DemoSound {
  const { master, track, handle } = sound(ctx)
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  const start = targetHz * Math.pow(2, -5 / 12)
  const landAt = t + seconds * 0.45
  osc.frequency.setValueAtTime(start, t)
  osc.frequency.exponentialRampToValueAtTime(
    targetHz * 0.97,
    t + seconds * 0.25,
  )
  osc.frequency.exponentialRampToValueAtTime(
    targetHz * 1.015,
    t + seconds * 0.38,
  )
  osc.frequency.exponentialRampToValueAtTime(targetHz, landAt)
  envelope(master.gain, t, seconds, DEMO_GAIN)
  osc.connect(master)
  osc.start(t)
  osc.stop(t + seconds + 0.05)
  track(osc)

  // The bloom once locked: a soft fifth shimmering in above the note.
  const bloom = ctx.createOscillator()
  bloom.type = 'sine'
  bloom.frequency.value = targetHz * 1.5
  const bloomGain = ctx.createGain()
  bloomGain.gain.setValueAtTime(0.0001, t)
  bloomGain.gain.setValueAtTime(0.0001, landAt)
  bloomGain.gain.exponentialRampToValueAtTime(DEMO_GAIN * 0.4, landAt + 0.25)
  bloomGain.gain.exponentialRampToValueAtTime(0.0001, t + seconds)
  bloom.connect(bloomGain).connect(master)
  bloom.start(t)
  bloom.stop(t + seconds + 0.05)
  track(bloom)
  return handle
}

/** One moment of a sung line: cents off the note and loudness (0 = rest). */
export interface VoicePoint {
  /** Seconds after `startAt`. */
  t: number
  cents: number
  /** 0..1; 0 is silence between notes. */
  level: number
}

export interface VoiceContourOptions {
  /** The note the cents are measured from, Hz. */
  hz: number
  /** When point t = 0 sounds, on the context's clock; now by default. */
  startAt?: number
  /** The context's speakers by default. */
  destination?: AudioNode
  /**
   * A sine on the pitch: `cents` either side at `hz`, grown in linearly over
   * `rampSec` after each onset. Its phase is 0 at `startAt`.
   */
  vibrato?: { hz: number; cents: number; rampSec: number }
}

/**
 * A warm, round "ooh". The overtones carry it on a phone speaker, which
 * plays little of a low voice's fundamental (the Hear tone's own trick).
 */
const OOH_PARTIALS = [0, 1, 0.62, 0.38, 0.24, 0.14, 0.08, 0.045, 0.025]
const oohCache = new WeakMap<BaseAudioContext, PeriodicWave>()
/**
 * The voice at full level. A held note (level 0.8) measures level with the
 * room's Hear tone through a phone speaker's roll-off, within 0.7 dB, and
 * 1 dB under it full band: its richer overtones carry more where the
 * speaker drops the fundamental. A demo voice is a performance to copy, so
 * it does not sit at DEMO_GAIN.
 */
const VOICE_PEAK = 0.3
/** The house envelope (src/lib/preview-player.ts): open, close, slack. */
const VOICE_ATTACK = 0.09
const VOICE_RELEASE = 0.18
const STOP_SLACK = 0.06
const FLOOR = 0.0001

function oohWave(ctx: BaseAudioContext): PeriodicWave {
  const cached = oohCache.get(ctx)
  if (cached !== undefined) return cached
  const imag = new Float32Array(OOH_PARTIALS)
  const wave = ctx.createPeriodicWave(new Float32Array(imag.length), imag)
  oohCache.set(ctx, wave)
  return wave
}

interface VoiceRun {
  from: number
  /** Index of the last voiced point. */
  to: number
}

function voicedRuns(points: readonly VoicePoint[]): VoiceRun[] {
  const runs: VoiceRun[] = []
  let from = -1
  points.forEach((point, i) => {
    if (point.level > 0 && from < 0) from = i
    const last = i === points.length - 1 || points[i + 1].level <= 0
    if (point.level > 0 && last) {
      runs.push({ from, to: i })
      from = -1
    }
  })
  return runs
}

/** Loudness and pitch for one run: open, follow, close at its end. */
function scheduleRun(
  points: readonly VoicePoint[],
  run: VoiceRun,
  at: (t: number) => number,
  gain: AudioParam,
  detune: AudioParam,
): void {
  const first = points[run.from]
  const onset = at(first.t)
  gain.setValueAtTime(FLOOR, onset)
  gain.exponentialRampToValueAtTime(
    VOICE_PEAK * first.level,
    onset + VOICE_ATTACK,
  )
  detune.setValueAtTime(first.cents, onset)
  for (let i = run.from + 1; i <= run.to; i++) {
    const when = at(points[i].t)
    detune.linearRampToValueAtTime(points[i].cents, when)
    if (when > onset + VOICE_ATTACK) {
      gain.linearRampToValueAtTime(VOICE_PEAK * points[i].level, when)
    }
  }
  // The rest begins where the next point is silent.
  const last = points[run.to]
  const close = at(points[run.to + 1]?.t ?? last.t)
  gain.setValueAtTime(VOICE_PEAK * last.level, close)
  gain.setTargetAtTime(0, close, VOICE_RELEASE / 5)
}

/**
 * A sung line, as Merc would sing it: one "ooh" that follows `points` in
 * pitch and loudness, rests where the level is 0, with a natural vibrato on
 * top. Every onset opens and every rest closes on the house envelope.
 * Returns a handle that closes it pop-free at any moment.
 */
export function playVoiceContour(
  ctx: AudioContext,
  points: readonly VoicePoint[],
  options: VoiceContourOptions,
): DemoSound {
  const { master, track, handle } = sound(ctx, {
    destination: options.destination,
    release: VOICE_RELEASE,
  })
  const start = options.startAt ?? ctx.currentTime
  const at = (t: number): number => start + t
  const end = at(points.length === 0 ? 0 : points[points.length - 1].t)

  const voice = ctx.createOscillator()
  voice.setPeriodicWave(oohWave(ctx))
  voice.frequency.value = options.hz
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 2600
  filter.Q.value = 0.5
  const level = ctx.createGain()
  level.gain.setValueAtTime(FLOOR, start)
  voice.connect(filter)
  filter.connect(level)
  level.connect(master)

  const runs = voicedRuns(points)
  for (const run of runs) {
    scheduleRun(points, run, at, level.gain, voice.detune)
  }

  const stopAt = end + VOICE_RELEASE + STOP_SLACK
  const graph: AudioNode[] = [voice, filter, level, master]
  const vibrato = options.vibrato
  if (vibrato !== undefined) {
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = vibrato.hz
    const depth = ctx.createGain()
    depth.gain.setValueAtTime(0, start)
    for (const run of runs) {
      const onset = at(points[run.from].t)
      depth.gain.setValueAtTime(0, onset)
      depth.gain.linearRampToValueAtTime(vibrato.cents, onset + vibrato.rampSec)
    }
    lfo.connect(depth)
    depth.connect(voice.detune)
    lfo.start(start)
    lfo.stop(stopAt)
    track(lfo)
    graph.push(lfo, depth)
  }
  // Nothing of the voice stays in the graph once it has stopped.
  voice.onended = () => {
    for (const node of graph) node.disconnect()
  }
  voice.start(start)
  voice.stop(stopAt)
  track(voice)
  return handle
}
