// ============================================================
// Merc's sung voice: one synthesised line on the house envelope.
//
// The "ooh" (or hum, or lip buzz) that the rooms' demos and the Sing
// tab's Show me more sing with: one voice that follows a contour of
// points in pitch and loudness and opens and closes pop-free, on the
// demo cues' stoppable `sound` (demo-audio.ts). It is a module of its
// own so that the pages that play only those cues (the Voice Mirror, its
// range pages and Glass, which load them with their first paint) do not
// carry it.
// ============================================================

import type { DemoSound } from '@/lib/demo-audio'
import { sound } from '@/lib/demo-audio'
import { lowNoteOctaveLevel, normalizedFundamental, } from '@/lib/low-note-reinforcement'

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
  /** The voice's colour: an open "ooh" (the default), or a closed hum. */
  timbre?: VoiceTimbre
  /**
   * A lip buzz: the loudness flutters `hz` times a second, each time down
   * to `1 - depth` of the line's level, as the lips open and close.
   */
  flutter?: VoiceFlutter
  /**
   * Wherever the line is below C3, a sine an octave up fades in under the
   * voice's own filter and envelope, at the classic engine's level relative
   * to the voice's fundamental (low-note-reinforcement.ts, which says what
   * it measures as). The premium rooms ask for it.
   */
  lowNoteOctave?: boolean
}

export interface VoiceFlutter {
  readonly hz: number
  /** 0..1: how far each closing dips the loudness. */
  readonly depth: number
}

/**
 * Lip roll's "brrr" (DESIGN-lip-roll.md 4): a trill's lips open and close
 * about 25 times a second. Too slow to hear as a pitch, too fast to hear as
 * a rhythm: it reads as a buzz, and a phone speaker carries it, because it
 * moves the loudness of the overtones, not a note of its own.
 */
export const LIP_FLUTTER: VoiceFlutter = { hz: 25, depth: 0.85 }

/**
 * The flutter's shape: a rounded sawtooth, so each closing is quick and
 * each opening swells, as lips do in a trill. Normalised to a peak of 1.
 */
const FLUTTER_PARTIALS = [0, 1, 0.45, 0.2]

/** Points per period where flutterMakeup reads the shape. */
const FLUTTER_SAMPLES = 4096

/**
 * The gain that gives a line with `flutter` the loudness of the line
 * without it. The flutter dips the level and never lifts it, so a buzzed
 * line is quieter (by 4.0 dB with LIP_FLUTTER: 1 over the RMS of the
 * swing). The shape is read as Web Audio plays it, scaled to a peak of 1.
 */
export function flutterMakeup(flutter: VoiceFlutter): number {
  const swing = Math.max(0, Math.min(1, flutter.depth)) / 2
  const shape: number[] = []
  let peak = 0
  for (let i = 0; i < FLUTTER_SAMPLES; i++) {
    const x = (2 * Math.PI * i) / FLUTTER_SAMPLES
    let value = 0
    FLUTTER_PARTIALS.forEach((amount, k) => {
      value += amount * Math.sin(k * x)
    })
    shape.push(value)
    peak = Math.max(peak, Math.abs(value))
  }
  let power = 0
  for (const value of shape) {
    const gain = 1 - swing + (swing * value) / peak
    power += gain * gain
  }
  return 1 / Math.sqrt(power / FLUTTER_SAMPLES)
}

/**
 * How the voice is coloured: an open "ooh", or "hum", the same partials
 * through a lower, slightly resonant filter, the dull, closed sound of a
 * hum on "ng" (Ng slides' demo). Both keep the overtones a phone speaker
 * needs to carry a low note.
 */
export type VoiceTimbre = 'ooh' | 'hum'

const TIMBRE_FILTERS: Readonly<
  Record<VoiceTimbre, { readonly hz: number; readonly q: number }>
> = {
  ooh: { hz: 2600, q: 0.5 },
  hum: { hz: 950, q: 0.9 },
}

/**
 * A warm, round "ooh". The overtones carry it on a phone speaker, which
 * plays little of a low voice's fundamental (the Hear tone's own trick).
 */
const OOH_PARTIALS = [0, 1, 0.62, 0.38, 0.24, 0.14, 0.08, 0.045, 0.025]
/** The fundamental's amplitude in the "ooh", as Web Audio plays it. */
const OOH_FUNDAMENTAL = normalizedFundamental(OOH_PARTIALS)
const oohCache = new WeakMap<BaseAudioContext, PeriodicWave>()
/**
 * The voice at full level. A held note (level 0.8) measures level with the
 * room's Hear tone through a phone speaker's roll-off, within 0.7 dB, and
 * 1 dB under it full band: its richer overtones carry more where the
 * speaker drops the fundamental. A demo voice is a performance to copy, so
 * it does not sit at the cues' DEMO_GAIN (demo-audio.ts).
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
  detunes: readonly AudioParam[],
): void {
  const first = points[run.from]
  const onset = at(first.t)
  gain.setValueAtTime(FLOOR, onset)
  gain.exponentialRampToValueAtTime(
    VOICE_PEAK * first.level,
    onset + VOICE_ATTACK,
  )
  for (const detune of detunes) detune.setValueAtTime(first.cents, onset)
  for (let i = run.from + 1; i <= run.to; i++) {
    const when = at(points[i].t)
    for (const detune of detunes) {
      detune.linearRampToValueAtTime(points[i].cents, when)
    }
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
 * The flutter between `from` and `to`: a gain swung by a 25 Hz shape about
 * its middle, so the loudness runs from full down to `1 - depth`. Returns
 * the nodes it made, for the voice's own clean-up.
 */
function addFlutter(
  ctx: AudioContext,
  from: AudioNode,
  to: AudioNode,
  flutter: VoiceFlutter,
  start: number,
  stopAt: number,
  track: (node: OscillatorNode) => void,
): AudioNode[] {
  const swing = Math.max(0, Math.min(1, flutter.depth)) / 2
  const lips = ctx.createGain()
  lips.gain.value = 1 - swing
  const shape = ctx.createOscillator()
  const imag = new Float32Array(FLUTTER_PARTIALS)
  shape.setPeriodicWave(
    ctx.createPeriodicWave(new Float32Array(imag.length), imag),
  )
  shape.frequency.value = flutter.hz
  const amount = ctx.createGain()
  amount.gain.value = swing
  shape.connect(amount)
  amount.connect(lips.gain)
  from.connect(lips)
  lips.connect(to)
  shape.start(start)
  shape.stop(stopAt)
  track(shape)
  return [lips, shape, amount]
}

/**
 * A sung line, as Merc would sing it: one "ooh" that follows `points` in
 * pitch and loudness, rests where the level is 0, with a natural vibrato on
 * top, or a lip buzz's flutter (`flutter`, Lip roll's demo). Every onset
 * opens and every rest closes on the house envelope. Returns a handle that
 * closes it pop-free at any moment.
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
  const colour = TIMBRE_FILTERS[options.timbre ?? 'ooh']
  filter.type = 'lowpass'
  filter.frequency.value = colour.hz
  filter.Q.value = colour.q
  const level = ctx.createGain()
  level.gain.setValueAtTime(FLOOR, start)
  voice.connect(filter)
  filter.connect(level)

  const stopAt = end + VOICE_RELEASE + STOP_SLACK
  const graph: AudioNode[] = [voice, filter, level, master]
  const voices: OscillatorNode[] = [voice]
  const octave =
    options.lowNoteOctave === true
      ? lowOctave(ctx, points, options.hz, at)
      : null
  if (octave !== null) {
    octave.level.connect(filter)
    voices.push(octave.voice)
    graph.push(octave.voice, octave.level)
  }

  const runs = voicedRuns(points)
  const detunes = voices.map((each) => each.detune)
  for (const run of runs) {
    scheduleRun(points, run, at, level.gain, detunes)
  }
  const flutter = options.flutter
  if (flutter === undefined) level.connect(master)
  else {
    graph.push(...addFlutter(ctx, level, master, flutter, start, stopAt, track))
  }
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
    for (const detune of detunes) depth.connect(detune)
    lfo.start(start)
    lfo.stop(stopAt)
    track(lfo)
    graph.push(lfo, depth)
  }
  // Nothing of the voice stays in the graph once it has stopped.
  voice.onended = () => {
    for (const node of graph) node.disconnect()
  }
  for (const each of voices) {
    each.start(start)
    each.stop(stopAt)
    track(each)
  }
  return handle
}

/**
 * The low-note octave of a line (VoiceContourOptions.lowNoteOctave): a sine
 * at twice `hz`, whose level follows the line's pitch point by point, or
 * null for a line that never goes below C3. Its pitch follows the line
 * through the same detune as the voice.
 */
function lowOctave(
  ctx: AudioContext,
  points: readonly VoicePoint[],
  hz: number,
  at: (t: number) => number,
): { voice: OscillatorNode; level: GainNode } | null {
  const levels = points.map(
    (point) =>
      lowNoteOctaveLevel(hz * 2 ** (point.cents / 1200)) * OOH_FUNDAMENTAL,
  )
  if (!levels.some((value) => value > 0)) return null
  const voice = ctx.createOscillator()
  voice.type = 'sine'
  voice.frequency.value = hz * 2
  const level = ctx.createGain()
  levels.forEach((value, i) => {
    const when = at(points[i].t)
    if (i === 0) level.gain.setValueAtTime(value, when)
    else level.gain.linearRampToValueAtTime(value, when)
  })
  voice.connect(level)
  return { voice, level }
}
