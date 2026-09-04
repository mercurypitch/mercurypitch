// The glass, answering.
// ============================================================
//
// The plan's rule (§7): the glass has to ANSWER the voice — the audible
// feedback loop is the mechanic, not decoration. This module is that
// answer for the 3D stages: a modal ring that swells with the charge,
// trembles with the player's vibrato, and breaks in layers.
//
// Synthesis rather than samples, for the reason §7 gives: a recording
// pitch-shifted more than three or four semitones reads as a chipmunk,
// and this tone has to sit relative to an arbitrary target note.
//
// Two constraints inherited from decisions elsewhere:
//
//   * One AudioContext in the whole app. This module takes a lease on
//     the shared context (`acquireSharedAudioContext`) and never
//     constructs its own — a test elsewhere asserts exactly one module
//     does.
//   * The tone must not be mistaken for the singer. Echo cancellation
//     stays off app-wide (honest pitch), so the glass answers an OCTAVE
//     ABOVE the target note — out of the register being measured, still
//     unmistakably the same pitch class to the ear.
//
// Scheduling: every break layer is placed against `ctx.currentTime`,
// never against rAF — §7's hard rule, because the audio clock keeps
// running at full rate when a WebView throttles the frame loop.

import type { SharedAudioLease } from '@/audio/shared-audio-context'
import { acquireSharedAudioContext } from '@/audio/shared-audio-context'

/**
 * Partial ratios for the ring. STK's published struck-vessel set
 * (1 : 2.13 : 4.17 : 5.06) is a ceramic mug; a wine glass's lowest two
 * modes sit further apart and the upper ones shimmer closer together.
 * These are ear-tuned around that shape. §7 wants them replaced by
 * measuring a real glass with our own pitch engine — until then, this.
 */
const PARTIALS: readonly { ratio: number; gain: number }[] = [
  { ratio: 1.0, gain: 1.0 }, // the singing mode — dominant, a rubbed glass is not struck
  { ratio: 2.32, gain: 0.28 },
  { ratio: 4.25, gain: 0.14 },
  { ratio: 5.68, gain: 0.08 },
]

/** How loud the ring gets at full charge. Deliberately modest: the tone
 * is feedback, not a reward for volume — and it feeds a room with an
 * open microphone. */
const RING_PEAK = 0.16

/** Tremolo rate once the player's vibrato is pumping, in Hz. Sits inside
 * the 4–7 Hz band the detector itself considers vibrato, so the glass
 * audibly wobbles "in kind". */
const TREMOLO_HZ = 5.5

export interface GlassTone {
  /** Build the graph. Call synchronously inside the user gesture that
   * starts the game — the same click that opens the microphone. */
  start(): void
  /** Feed the per-frame state. Cheap; params smooth themselves. */
  update(resonance: number, vibratoStrength: number): void
  /** The four-layer break (§7): crack, body, shard tail, settle. */
  shatter(accuracy: number): void
  /**
   * Point the ring at a different note.
   *
   * A room with one pane never needs this; a chamber has several, each
   * opened by a different mode, and a ring that stayed on the first
   * pane's note would answer the second one in the wrong key.
   */
  retune(targetHz: number): void
  /**
   * Let the glass ring again after a break.
   *
   * `shatter` deliberately silences the ring for good, because in a
   * one-pane room the charge it was tracking never returns to zero and
   * an un-silenced ring would sing on over its own wreckage. A chamber
   * has more glass to break, so it says so explicitly rather than the
   * tone guessing.
   */
  rearm(): void
  dispose(): void
}

export const createGlassTone = (targetHz: number): GlassTone => {
  const lease: SharedAudioLease = acquireSharedAudioContext('glass3d-stage')
  let voiceHz = targetHz
  let base = targetHz * 2 // the octave-away rule, see header

  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let ringGain: GainNode | null = null
  let tremoloDepth: GainNode | null = null
  let filters: BiquadFilterNode[] = []
  let noise: AudioBufferSourceNode | null = null
  let lfo: OscillatorNode | null = null
  let broken = false

  /** Two seconds of looped white noise — the excitation for everything
   * here, ring and break alike. One buffer, reused, which the code did
   * not actually do: every burst built its own, so a single shatter cut
   * nineteen two-second buffers and ran two million Math.random() calls
   * inside the frame that was also launching eighty shards. Noise is
   * noise; the same two seconds serve every voice. */
  let noiseCache: AudioBuffer | null = null
  const noiseBuffer = (c: AudioContext): AudioBuffer => {
    if (noiseCache !== null) return noiseCache
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    noiseCache = buf
    return buf
  }

  /** One short filtered-noise burst, scheduled absolutely. The building
   * block of both the crack and the shard tail. */
  const burst = (
    c: AudioContext,
    out: AudioNode,
    at: number,
    freq: number,
    q: number,
    peak: number,
    decay: number,
  ): void => {
    const src = c.createBufferSource()
    src.buffer = noiseBuffer(c)
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = freq
    bp.Q.value = q
    const g = c.createGain()
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(peak, at + 0.005)
    g.gain.exponentialRampToValueAtTime(0.001, at + decay)
    src.connect(bp).connect(g).connect(out)
    src.start(at)
    src.stop(at + decay + 0.05)
  }

  return {
    start(): void {
      const c = lease.ensure()
      if (c === null || master !== null) return
      void lease.unlock()
      ctx = c

      master = c.createGain()
      master.gain.value = 1
      master.connect(c.destination)

      // The ring: looped noise pushed through one bandpass per partial.
      // Narrow filters on noise ARE the modal model — each passes only
      // its mode's band, and raising Q at charge time literally lengthens
      // the ring, which is the swell §7 asks for.
      ringGain = c.createGain()
      ringGain.gain.value = 0
      ringGain.connect(master)

      noise = c.createBufferSource()
      noise.buffer = noiseBuffer(c)
      noise.loop = true

      filters = PARTIALS.map((p) => {
        const bp = c.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = base * p.ratio
        bp.Q.value = 25
        const g = c.createGain()
        // Q-normalised: a narrower bandpass passes less noise energy, so
        // without this the swell would get QUIETER as it sharpened.
        g.gain.value = p.gain * 2.2
        noise!.connect(bp)
        bp.connect(g)
        g.connect(ringGain!)
        return bp
      })
      noise.start()

      // Tremolo: an LFO scaled by the player's vibrato strength, added
      // onto the ring gain. Depth 0 = a steady sine of nothing.
      //
      // Held in a variable rather than left anonymous because shatter()
      // has to be able to silence it: this is a SECOND writer on
      // ringGain.gain, and the scheduled one cannot cancel it.
      lfo = c.createOscillator()
      lfo.frequency.value = TREMOLO_HZ
      tremoloDepth = c.createGain()
      tremoloDepth.gain.value = 0
      lfo.connect(tremoloDepth)
      tremoloDepth.connect(ringGain.gain)
      lfo.start()
    },

    update(resonance: number, vibratoStrength: number): void {
      if (ctx === null || ringGain === null || broken) return
      const t = ctx.currentTime
      // The curve is deliberately steeper than linear: near-silence at a
      // grazing hold, unmistakable at ring, urgent at the brink.
      const level = Math.pow(Math.max(0, resonance), 1.6) * RING_PEAK
      ringGain.gain.setTargetAtTime(level, t, 0.06)
      tremoloDepth?.gain.setTargetAtTime(
        level * 0.55 * vibratoStrength,
        t,
        0.08,
      )
      for (const [i, bp] of filters.entries()) {
        // Sharper as it charges — the ring audibly "comes into focus".
        bp.Q.setTargetAtTime(25 + resonance * 45 * (i === 0 ? 1 : 0.6), t, 0.1)
      }
    },

    shatter(accuracy: number): void {
      if (ctx === null || master === null || broken) return
      broken = true
      const c = ctx
      const t = c.currentTime
      const acc = Math.max(0, Math.min(1, accuracy))

      // Layer 4 first in code, first to matter: the ring must not keep
      // singing over its own wreckage. Fast settle, not a cut.
      //
      // Two writers reach ringGain.gain: the scheduler, and the tremolo
      // LFO connected to it as an a-rate input. cancelScheduledValues
      // only silences the first. Left alone, the second kept driving the
      // param up and down at TREMOLO_HZ for as long as the stage was
      // mounted -- a wobble that outlived the glass, and the reason the
      // sound never stopped after a break. Depth to zero, then the
      // oscillator itself, so nothing is left pushing on it.
      ringGain?.gain.cancelScheduledValues(t)
      ringGain?.gain.setTargetAtTime(0, t, 0.05)
      tremoloDepth?.gain.cancelScheduledValues(t)
      tremoloDepth?.gain.setValueAtTime(0, t)
      // The LFO is NOT stopped here, only silenced. Stopping it is
      // one-way in Web Audio, and a chamber has a second pane to charge:
      // an oscillator that can never be restarted would leave every
      // break after the first with no tremolo at all. Depth zero is what
      // actually stops it pushing on the gain, which was the bug.

      // Layer 1, the crack: bright, sharp, and centred well above the
      // ring so it reads as breakage rather than a louder note.
      burst(c, master, t, 3200, 1.2, 0.5 + 0.2 * acc, 0.09)
      // Layer 2, the body: the dull low thump a thick bowl gives before
      // the fragments. A plain decaying sine, one octave-ish below target.
      const thump = c.createOscillator()
      thump.frequency.value = voiceHz * 0.5
      const tg = c.createGain()
      tg.gain.setValueAtTime(0.3, t)
      tg.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
      thump.connect(tg).connect(master)
      thump.start(t)
      thump.stop(t + 0.3)

      // Layer 3, the shard tail: 1.5–3 s of thinning tinkles. Density
      // falls quadratically — the debris settles rather than stops.
      const tail = 1.6 + acc * 0.9
      const n = 18
      for (let i = 0; i < n; i++) {
        const u = (i + 1) / n
        const at = t + 0.04 + u * u * tail
        const freq = 2800 + Math.random() * 5600
        burst(c, master, at, freq, 14, 0.12 * (1 - u * 0.8), 0.16)
      }
    },

    retune(nextHz: number): void {
      voiceHz = nextHz
      base = nextHz * 2
      if (ctx === null) return
      const t = ctx.currentTime
      for (const [i, bp] of filters.entries()) {
        // Glided, not jumped. A bandpass whose centre teleports through
        // looped noise makes an audible click, and the ring is supposed
        // to be the calm thing in the room.
        bp.frequency.setTargetAtTime(base * PARTIALS[i]!.ratio, t, 0.05)
      }
    },

    rearm(): void {
      if (!broken) return
      broken = false
      if (ctx === null || ringGain === null) return
      // Start from silence rather than from wherever the settle left it,
      // so the next hold swells from nothing exactly as the first did.
      const t = ctx.currentTime
      ringGain.gain.cancelScheduledValues(t)
      ringGain.gain.setValueAtTime(0, t)
    },

    dispose(): void {
      broken = true
      try {
        noise?.stop()
      } catch {
        // Never started, or the context already went away with the page.
      }
      try {
        lfo?.stop()
      } catch {
        // Never started, or the context already went away with the page.
      }
      master?.disconnect()
      master = null
      ringGain = null
      tremoloDepth = null
      filters = []
      noise = null
      lfo = null
      noiseCache = null
      ctx = null
      lease.release()
    },
  }
}
