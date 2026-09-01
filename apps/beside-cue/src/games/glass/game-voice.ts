// The game's own note voice.
// ============================================================
//
// Every melody in the Journey — Ode to Joy, Twinkle Twinkle, Frère
// Jacques, Mountain King — was being played through `playTargetHum` from
// pitch-engine's demo-audio. That module says what it is in its own
// header: "examples, not performances", one master gain per call, and a
// handle "the caller MUST be able to stop: demos overlap otherwise".
//
// The game kept none of those handles. So a level's notes did not
// replace each other, they accumulated: at humSeconds 1.2 and a rhythm
// beat well under that, three or four notes are sounding at once, each
// one a PAIR of sines detuned four cents so it beats against itself.
// What comes out is a dense cluster of unrelated pitches with no attack
// to separate them — reported from a device as trombone-like, mushy and
// distorted at the same time, with the tune not recognisable inside it.
// All three descriptions are the same fact.
//
// So the game gets a voice of its own instead of borrowing a teaching
// aid. Three things demo-audio was never meant to provide:
//
//   An ATTACK. A struck-string envelope with decaying harmonics reads as
//   a note event. Two sustained sines read as a drone, and drones
//   overlapping is a chord, not a melody.
//
//   A VOICE LIMIT. Notes steal the oldest voice rather than piling up,
//   so the density is bounded no matter how fast the level plays.
//
//   A BUS WITH A CEILING. Everything lands on one compressor, so even
//   the worst overlap ducks instead of clipping the destination.
//
// It stays cheap: oscillators and gains, no samples, nothing to
// download, and it shares the app's one AudioContext like everything
// else.

import type { SharedAudioLease } from '@/audio/shared-audio-context'
import { acquireSharedAudioContext } from '@/audio/shared-audio-context'

/**
 * The timbre, as partials of the fundamental.
 *
 * `stretch` is deliberate inharmonicity: a real struck string is stiff,
 * so its upper partials sit slightly sharp of whole multiples. Without
 * it the stack is a perfect harmonic series, which the ear hears as an
 * organ. With it, the same three oscillators read as something hit.
 *
 * `decay` is a fraction of the note's length. Bright partials dying
 * first is most of what makes a struck instrument sound struck.
 */
const PARTIALS = [
  { ratio: 1, stretch: 1, gain: 1, decay: 1 },
  { ratio: 2, stretch: 1.0007, gain: 0.36, decay: 0.6 },
  { ratio: 3, stretch: 1.002, gain: 0.14, decay: 0.38 },
  { ratio: 4.16, stretch: 1, gain: 0.05, decay: 0.22 },
] as const

/** Peak of one note at the bus, before the compressor. */
const NOTE_PEAK = 0.22

/** Seconds to reach that peak. Short enough to read as a strike, long
 * enough not to click. */
const ATTACK_SECONDS = 0.006

/**
 * How many notes may sound at once. Four covers every legitimate
 * overlap in these levels (a note's tail under the next two) and caps
 * the damage when a level plays faster than its own hum length.
 */
const MAX_VOICES = 4

/** Above this the upper partials stop being musical and start being
 * hiss, so the tracking lowpass never opens past it. */
const BRIGHTNESS_CEILING_HZ = 6000

interface Voice {
  /** Everything this note owns, so stealing it is one disconnect. */
  readonly out: GainNode
  readonly oscillators: OscillatorNode[]
  /** Context time the note began — the stealing order. */
  readonly startedAt: number
  /** Context time it is scheduled to be silent. */
  endsAt: number
  stopped: boolean
}

export interface GameVoice {
  /** Build the graph and lift the context. Call inside a user gesture. */
  start(): void
  /** Play one note. Steals the oldest voice when full. */
  note(midi: number, seconds: number): void
  /** Silence everything now — leaving a screen, or muting. */
  stopAll(): void
  dispose(): void
}

const midiToHz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12)

export const createGameVoice = (owner = 'glass-journey'): GameVoice => {
  const lease: SharedAudioLease = acquireSharedAudioContext(owner)

  let ctx: AudioContext | null = null
  let bus: DynamicsCompressorNode | null = null
  let voices: Voice[] = []

  /** Free a voice's nodes. Safe to call on one already stopped. */
  const retire = (voice: Voice, at: number): void => {
    if (voice.stopped) return
    voice.stopped = true
    for (const osc of voice.oscillators) {
      try {
        osc.stop(at)
      } catch {
        // Already stopped, or the context went with the page.
      }
    }
    // Disconnect after the tail, not now: a voice cut at `at` still has
    // to be audible up to it.
    window.setTimeout(
      () => {
        try {
          voice.out.disconnect()
        } catch {
          // Context closed; the graph is already gone.
        }
      },
      Math.max(0, (at - (ctx?.currentTime ?? at)) * 1000) + 120,
    )
  }

  return {
    start(): void {
      const c = lease.ensure()
      if (c === null || bus !== null) return
      void lease.unlock()
      ctx = c

      // The ceiling. A high ratio and a low knee make this a limiter in
      // all but name: notes below the threshold pass untouched, and an
      // overlap that would have clipped the destination is held down
      // instead. This is what demo-audio never had, and the reason
      // overlapping notes there turned to distortion rather than just
      // getting louder.
      bus = c.createDynamicsCompressor()
      bus.threshold.value = -10
      bus.knee.value = 6
      bus.ratio.value = 12
      bus.attack.value = 0.003
      bus.release.value = 0.18
      bus.connect(c.destination)
    },

    note(midi: number, seconds: number): void {
      if (ctx === null || bus === null) return
      const c = ctx
      const t = c.currentTime
      const hz = midiToHz(midi)

      // Drop voices that have already finished, then steal the oldest if
      // the level is still asking for more than the cap allows.
      voices = voices.filter((v) => !v.stopped && v.endsAt > t)
      while (voices.length >= MAX_VOICES) {
        const oldest = voices.shift()
        // A 60 ms fade rather than a hard stop: stealing must not click.
        if (oldest !== undefined) {
          oldest.out.gain.cancelScheduledValues(t)
          oldest.out.gain.setValueAtTime(
            Math.max(0.0001, oldest.out.gain.value),
            t,
          )
          oldest.out.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
          retire(oldest, t + 0.08)
        }
      }

      const out = c.createGain()
      out.gain.value = 1
      // One lowpass per note, tracking its pitch: a high note keeps its
      // harmonics and a low one stays warm, which a fixed corner cannot
      // do. Capped, or the top of the range turns to hiss.
      const tone = c.createBiquadFilter()
      tone.type = 'lowpass'
      tone.frequency.value = Math.min(BRIGHTNESS_CEILING_HZ, hz * 6)
      tone.Q.value = 0.7
      out.connect(tone).connect(bus)

      const oscillators: OscillatorNode[] = []
      for (const p of PARTIALS) {
        const osc = c.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = hz * p.ratio * p.stretch

        const g = c.createGain()
        const peak = NOTE_PEAK * p.gain
        const life = Math.max(0.08, seconds * p.decay)
        // Exponential decay from the attack, never to true zero --
        // exponentialRampToValueAtTime cannot reach it.
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(peak, t + ATTACK_SECONDS)
        g.gain.exponentialRampToValueAtTime(0.0001, t + life)

        osc.connect(g).connect(out)
        osc.start(t)
        osc.stop(t + life + 0.05)
        oscillators.push(osc)
      }

      voices.push({
        out,
        oscillators,
        startedAt: t,
        endsAt: t + seconds + 0.1,
        stopped: false,
      })
    },

    stopAll(): void {
      if (ctx === null) return
      const t = ctx.currentTime
      for (const voice of voices) {
        voice.out.gain.cancelScheduledValues(t)
        voice.out.gain.setValueAtTime(Math.max(0.0001, voice.out.gain.value), t)
        voice.out.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
        retire(voice, t + 0.07)
      }
      voices = []
    },

    dispose(): void {
      this.stopAll()
      try {
        bus?.disconnect()
      } catch {
        // Context already closed.
      }
      bus = null
      ctx = null
      voices = []
      lease.release()
    },
  }
}
