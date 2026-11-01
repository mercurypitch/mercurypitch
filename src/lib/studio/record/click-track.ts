// ============================================================
// Studio click track — the count-in and the click: short ticks on the song's beat grid, to the speakers and never into a take
// ============================================================
//
// Each tick is rendered once into a buffer whose own samples open with a
// raised cosine and close to exactly zero, so starting one never steps the
// waveform. Ticks go to the clock's destination alone: the take is captured
// from the microphone, so a click reaches it only as speaker bleed, which is
// why the Studio suggests headphones.
//
// A tick starts on a whole frame (whole-frame.ts), and none is written for
// a time the clock may already have passed (MISTAKES.md, a value curve
// scheduled in the past): a tick due within two render quanta is skipped.
// Stopping closes the shared level with the house release, setTargetAtTime
// to zero, and stops every tick only after it, so a tick cut short fades.
import { frameTime } from '../playback/whole-frame'
import type { StudioTakeAnchor } from './take-timing'
import { STUDIO_BEATS_PER_BAR, studioBeatFrames, takeFrameAt, takeTimeOf, } from './take-timing'

/** A tick's length. */
export const STUDIO_CLICK_SECONDS = 0.03
const ATTACK_SECONDS = 0.0015
const DECAY_SECONDS = 0.006
const CLOSE_SECONDS = 0.004
/** The house release, and the slack before a stop after it. */
const RELEASE_SECONDS = 0.02
const RELEASE_SLACK_SECONDS = 0.01
const QUANTUM = 128

/** A tick: a bar's first beat is higher and a little louder. */
export function renderStudioClick(
  sampleRate: number,
  accent: boolean,
): Float32Array {
  const length = Math.round(STUDIO_CLICK_SECONDS * sampleRate)
  const attack = Math.max(1, Math.round(ATTACK_SECONDS * sampleRate))
  const close = Math.max(1, Math.round(CLOSE_SECONDS * sampleRate))
  const hz = accent ? 1568 : 1175
  const level = accent ? 0.42 : 0.3
  const out = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate
    const opening = i < attack ? Math.sin((Math.PI / 2) * (i / attack)) ** 2 : 1
    const left = length - 1 - i
    const closing =
      left < close ? Math.sin((Math.PI / 2) * (left / close)) ** 2 : 1
    const body = Math.exp(-Math.max(0, t - ATTACK_SECONDS) / DECAY_SECONDS)
    out[i] = level * opening * closing * body * Math.sin(2 * Math.PI * hz * t)
  }
  return out
}

/** A tick due at a clock time. */
export interface StudioClickTime {
  readonly time: number
  readonly accent: boolean
}

export function createStudioClickTrack(ctx: BaseAudioContext) {
  const buffers = new Map<boolean, AudioBuffer>()
  const sources = new Set<AudioBufferSourceNode>()
  let output: GainNode | null = null

  const buffer = (accent: boolean): AudioBuffer => {
    let made = buffers.get(accent)
    if (made === undefined) {
      const samples = renderStudioClick(ctx.sampleRate, accent)
      made = ctx.createBuffer(1, samples.length, ctx.sampleRate)
      made.getChannelData(0).set(samples)
      buffers.set(accent, made)
    }
    return made
  }

  const level = (): GainNode => {
    if (output === null) {
      output = ctx.createGain()
      output.connect(ctx.destination)
    }
    return output
  }

  return {
    /** Ticks at these clock times; one due within two quanta of now is skipped. */
    schedule(ticks: readonly StudioClickTime[]): void {
      const soonest = ctx.currentTime + (2 * QUANTUM) / ctx.sampleRate
      for (const tick of ticks) {
        if (!(tick.time >= soonest)) continue
        const source = ctx.createBufferSource()
        source.buffer = buffer(tick.accent)
        source.connect(level())
        source.start(
          frameTime(Math.round(tick.time * ctx.sampleRate), ctx.sampleRate),
        )
        sources.add(source)
        source.onended = () => {
          sources.delete(source)
          source.disconnect()
        }
      }
    },
    /** Silence every tick: one sounding fades, one still due never plays. */
    stop(): void {
      const closing = output
      if (closing === null) return
      output = null
      const now = ctx.currentTime
      closing.gain.setTargetAtTime(0, now, RELEASE_SECONDS / 5)
      const end = now + RELEASE_SECONDS + RELEASE_SLACK_SECONDS
      for (const source of sources) {
        try {
          source.stop(end)
        } catch {
          // Already stopped.
        }
      }
      sources.clear()
      setTimeout(() => closing.disconnect(), (end - now) * 1000 + 50)
    },
  }
}

export type StudioClickTrack = ReturnType<typeof createStudioClickTrack>

export interface StudioClickSchedulerOptions {
  readonly track: Pick<StudioClickTrack, 'schedule'>
  readonly tempoBpm: number
  /** The first song frame ticked: the playhead the take started from. */
  readonly fromFrame: number
  /** Where the song sits on the clock now. */
  anchor(): StudioTakeAnchor
  now(): number
  /** Ticks written this far ahead: enough to ride out a hidden tab's slow timers. */
  readonly lookaheadSeconds?: number
  readonly intervalMs?: number
}

/**
 * The click while a take records: ticks on the song's beats from the
 * playhead on, written a little ahead of the clock on a slow timer rather
 * than every frame.
 */
export function createStudioClickScheduler(
  options: StudioClickSchedulerOptions,
) {
  const lookahead = options.lookaheadSeconds ?? 1.5
  const beat = studioBeatFrames(options.tempoBpm)
  // Counted in beats, not frames, so no beat is written twice or skipped.
  let next = Math.ceil(options.fromFrame / beat - 1e-9)
  let timer: ReturnType<typeof setInterval> | null = null

  function fill(): void {
    const anchor = options.anchor()
    const until = takeFrameAt(anchor, options.now() + lookahead)
    const ticks: StudioClickTime[] = []
    for (; next * beat < until; next++)
      ticks.push({
        time: takeTimeOf(anchor, next * beat),
        accent: next % STUDIO_BEATS_PER_BAR === 0,
      })
    if (ticks.length > 0) options.track.schedule(ticks)
  }

  return {
    start(): void {
      if (timer !== null) return
      fill()
      timer = setInterval(fill, options.intervalMs ?? 250)
    },
    stop(): void {
      if (timer !== null) clearInterval(timer)
      timer = null
    },
  }
}
