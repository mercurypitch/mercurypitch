// ============================================================
// Sing It in Time's sound: the beat clock on the app's audio context
// ============================================================
//
// The lessons' beat clock (kit/beat-clock-core.ts) books each hit a
// lookahead before it sounds, at its exact time on the audio clock, into a
// bus of the run's own, and says when each beat is heard by the context's
// output timestamp. Here it runs on the app's audio context (the engine's,
// which the microphone shares, so the clicks, Merc's notes and every frame
// the run hears keep one clock), where a lesson page runs it on its own.
//
// What it books, all into the run's bus and each on the house envelope
// (.claude/memory/audio-pop-free-playback.md): an exponential rise from the
// 1e-4 floor and a setTargetAtTime release, each source stopped only after
// its release and some slack.
//
// - Merc's do and a tune's notes (Hear it first, Hear it again): a warm
//   voice, a sine with a little of its second and third harmonics.
// - The click: a burst of band-passed noise, brighter on the bar's first
//   beat. Noise has no pitch, so where the click sounds under the singing
//   ("Click while I sing") the pitch detector does not read it as a sung
//   note, as it would a pitched woodblock: a raw microphone hears the click
//   (Lesson 18 FACTS 52).
//
// The bus sits at the app's volume, and the clicks at its metronome level
// too. Stopping a run closes its bus over 30 ms, which silences what it had
// already booked.

import type { Bar, ClockEnv } from './in-time-kit'
import type { Tune } from './tune-plan'
import { beatSeconds, TUNE_BEATS } from './tune-plan'

/** A run's own bus: what it books plays into `node`, so `close` silences it all. */
type Bus = NonNullable<ReturnType<ClockEnv['bus']>>

/** What the clock books: Merc's do, a click, or a note of the tune. */
export type InTimeHit =
  | { readonly kind: 'do'; readonly midi: number; readonly seconds: number }
  | {
      readonly kind: 'click'
      /** The bar's first beat. */
      readonly accent: boolean
      /** A count-in click: at full level; one under the singing is softer. */
      readonly count: boolean
    }
  | {
      readonly kind: 'note'
      readonly index: number
      readonly midi: number
      readonly seconds: number
    }

/** As much of the audio engine as the sound needs. */
export interface InTimeEngine {
  getAudioContext(): AudioContext | null
  getVolume(): number
  getMetronomeVolume(): number
}

/** Beats before bar 1: Merc's do (two beats), then the count-in's bar. */
export const DO_BEATS = 2
export const COUNT_BEATS = 4
export const LEAD_BEATS = DO_BEATS + COUNT_BEATS

/** How a tune is played: which parts, and whether its notes sound. */
export interface TuneBarsOptions {
  /** Merc's do, then the count-in, before bar 1; false for a tune alone. */
  readonly lead: boolean
  /** Clicks under the tune's bars. */
  readonly click: boolean
  /** The tune's own notes sound (Merc sings it), or only the clicks and the singer. */
  readonly voiced: boolean
  /** The bars of the tune itself; false plays only the lead's do (Hear do). */
  readonly tune: boolean
}

/** Merc's do lasts most of its two beats, with a breath before the count-in. */
const DO_SHARE = 0.8
/** A sung note lasts most of its value, so a repeated rhythm still sounds its beats. */
const NOTE_SHARE = 0.9

/** The bars a tune is played as: the lead's do and count-in, then its two bars. */
export function tuneBars(tune: Tune, o: TuneBarsOptions): Bar<InTimeHit>[] {
  const spb = beatSeconds(tune)
  const list: Bar<InTimeHit>[] = []
  if (o.lead) {
    list.push({
      beats: DO_BEATS,
      hits: [
        {
          beat: 0,
          data: {
            kind: 'do',
            midi: tune.doMidi,
            seconds: DO_BEATS * spb * DO_SHARE,
          },
        },
      ],
    })
    if (o.tune)
      list.push({
        beats: COUNT_BEATS,
        hits: Array.from({ length: COUNT_BEATS }, (_, beat) => ({
          beat,
          data: { kind: 'click', accent: beat === 0, count: true },
        })),
      })
  }
  if (!o.tune) return list
  for (let bar = 0; bar < TUNE_BEATS / 4; bar++) {
    const from = bar * 4
    const hits: { beat: number; data: InTimeHit }[] = []
    if (o.click)
      for (let beat = 0; beat < 4; beat++)
        hits.push({
          beat,
          data: { kind: 'click', accent: beat === 0, count: false },
        })
    if (o.voiced)
      tune.notes.forEach((n, index) => {
        if (n.beat < from - 1e-9 || n.beat >= from + 4 - 1e-9) return
        hits.push({
          beat: n.beat - from,
          data: {
            kind: 'note',
            index,
            midi: n.midi,
            seconds: n.beats * spb * NOTE_SHARE,
          },
        })
      })
    list.push({ beats: 4, hits })
  }
  return list
}

/** Slack after a release before its source stops, s: the house's 60 ms. */
const SLACK = 0.06
/** The envelope's floor: exponential ramps cannot start from zero. */
const FLOOR = 1e-4

/** Hz of a MIDI note. */
const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12)

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>()

/** A tenth of a second of white noise, made once per context. */
function noiseOf(ctx: BaseAudioContext): AudioBuffer {
  const made = noiseBuffers.get(ctx)
  if (made !== undefined) return made
  const buffer = ctx.createBuffer(
    1,
    Math.ceil(ctx.sampleRate * 0.1),
    ctx.sampleRate,
  )
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  noiseBuffers.set(ctx, buffer)
  return buffer
}

/** The click: noise through a band, rising in 1.5 ms and gone in about 60. */
export function bookClick(
  bus: Bus,
  when: number,
  o: { readonly accent: boolean; readonly level: number },
): void {
  const ctx = bus.context
  const src = ctx.createBufferSource()
  src.buffer = noiseOf(ctx)
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.setValueAtTime(o.accent ? 3200 : 2200, when)
  band.Q.setValueAtTime(2.2, when)
  const env = ctx.createGain()
  const peak = (o.accent ? 0.9 : 0.6) * o.level
  env.gain.setValueAtTime(FLOOR, when)
  env.gain.exponentialRampToValueAtTime(
    Math.max(peak, FLOOR * 2),
    when + 0.0015,
  )
  env.gain.setTargetAtTime(0, when + 0.0015, 0.012)
  src.connect(band)
  band.connect(env)
  env.connect(bus.node)
  src.start(when)
  src.stop(when + 0.06 + SLACK)
}

/** A sung note: a sine with a little of its second and third harmonics, from `when` for `seconds`. */
export function bookNote(
  bus: Bus,
  when: number,
  o: {
    readonly midi: number
    readonly seconds: number
    readonly level: number
  },
): void {
  const ctx = bus.context
  const f = hz(o.midi)
  const env = ctx.createGain()
  const attack = 0.025
  // a release long enough to span two of its own periods, at any pitch
  const release = Math.max(0.12, 10 / f)
  const end = when + Math.max(o.seconds, attack)
  env.gain.setValueAtTime(FLOOR, when)
  env.gain.exponentialRampToValueAtTime(o.level, when + attack)
  env.gain.setTargetAtTime(o.level * 0.7, when + attack, 0.25)
  env.gain.setTargetAtTime(0, end, release / 5)
  env.connect(bus.node)
  const partials: readonly [number, number][] = [
    [1, 1],
    [2, 0.22],
    [3, 0.08],
  ]
  for (const [k, level] of partials) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(f * k, when)
    const g = ctx.createGain()
    g.gain.setValueAtTime(level, when)
    osc.connect(g)
    g.connect(env)
    osc.start(when)
    osc.stop(end + release + SLACK)
  }
}

/** Merc's notes' level against the clicks', before the app's volume. */
const NOTE_LEVEL = 0.32

/**
 * The beat clock's world on the app's audio context, and what it books.
 * Silent, with no bus, while the context is missing or not running: a run
 * then keeps time on the page's clock and still draws every beat.
 */
export function createInTimeSound(engine: InTimeEngine) {
  const env: ClockEnv = {
    now: () => performance.now(),
    audioTime: () => {
      const ctx = engine.getAudioContext()
      return ctx === null || ctx.state !== 'running' ? null : ctx.currentTime
    },
    outputStamp() {
      const ctx = engine.getAudioContext()
      if (ctx === null || typeof ctx.getOutputTimestamp !== 'function')
        return null
      const s = ctx.getOutputTimestamp()
      return s.contextTime === undefined || s.performanceTime === undefined
        ? null
        : { contextTime: s.contextTime, performanceTime: s.performanceTime }
    },
    bus(onClose) {
      const ctx = engine.getAudioContext()
      if (ctx === null || ctx.state !== 'running') return null
      const node = ctx.createGain()
      node.gain.setValueAtTime(
        Math.max(0, Math.min(1, engine.getVolume())),
        ctx.currentTime,
      )
      node.connect(ctx.destination)
      let open = true
      return {
        context: ctx,
        node,
        get open() {
          return open
        },
        close(seconds = 0.03) {
          if (!open) return
          open = false
          const now = ctx.currentTime
          node.gain.cancelScheduledValues(now)
          node.gain.setValueAtTime(node.gain.value, now)
          node.gain.setTargetAtTime(0, now, seconds / 5)
          // dropped once silent: nothing booked into it can sound after this
          setTimeout(() => node.disconnect(), (seconds + SLACK) * 1000)
          onClose()
        },
      }
    },
  }

  /** Whether a run can sound now: the context is there and running. */
  const audible = (): boolean => engine.getAudioContext()?.state === 'running'

  /** Books one hit into the run's bus at `when` on the audio clock. */
  function book(hit: InTimeHit, when: number, bus: Bus): void {
    if (hit.kind === 'click') {
      const metronome = Math.max(0, Math.min(1, engine.getMetronomeVolume()))
      bookClick(bus, when, {
        accent: hit.accent,
        level: (hit.count ? 1 : 0.55) * metronome,
      })
      return
    }
    bookNote(bus, when, {
      midi: hit.midi,
      seconds: hit.seconds,
      level: NOTE_LEVEL,
    })
  }

  return { env, audible, book }
}

export type InTimeSound = ReturnType<typeof createInTimeSound>
