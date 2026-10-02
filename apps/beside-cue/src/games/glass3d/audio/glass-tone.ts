// The glass, answering.
// ============================================================
//
// The plan's rule (§7): the glass has to ANSWER the voice — the audible
// feedback loop is the mechanic, not decoration. This module is that
// answer for the 3D stages: a modal ring that swells with the charge,
// trembles with the player's vibrato, and breaks in layers.
//
// The pitched resonance remains synthesized; fracture uses independently
// generated recordings at their native pitch, prepared before capture.
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

import type { SharedAudioLease } from '@irchiinnuss/audio-io'
import { acquireSharedAudioContext } from '@irchiinnuss/audio-io'
import { glassGameAssetUrl } from '@irchiinnuss/glass-game/assets'
import type { GlassShatterProfile } from '@irchiinnuss/glass-game/fracture-audio'
import { createRecordedGlassFracture, readGlassEffectsVolume, } from '@irchiinnuss/glass-game/fracture-audio'

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
  /** Optional recordings finish decoding before live scoring begins. */
  prepareBreak(): Promise<void>
  /** A protected concurrent judge supplies zero safe seconds. */
  shatter(accuracy: number, safeSeconds?: number): void
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

export const createGlassTone = (
  targetHz: number,
  profile: GlassShatterProfile = {
    form: 'bowl',
    size: 'small',
    material: 'thick-crystal',
  },
): GlassTone => {
  const lease: SharedAudioLease = acquireSharedAudioContext('glass3d-stage')
  let base = targetHz * 2 // the octave-away rule, see header

  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let ringGain: GainNode | null = null
  let tremoloDepth: GainNode | null = null
  let filters: BiquadFilterNode[] = []
  let noise: AudioBufferSourceNode | null = null
  let lfo: OscillatorNode | null = null
  let broken = false
  let disposed = false
  let breakCount = 0
  let fracture: ReturnType<typeof createRecordedGlassFracture> | null = null

  /** One noise buffer excites the modal ring, built once during gesture
   * preparation. Fractures use their separate decoded recordings. */
  let noiseCache: AudioBuffer | null = null
  const noiseBuffer = (c: AudioContext): AudioBuffer => {
    if (noiseCache !== null) return noiseCache
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    noiseCache = buf
    return buf
  }

  return {
    start(): void {
      const c = lease.ensure()
      if (disposed || c === null || master !== null) return
      void lease.unlock()
      ctx = c

      master = c.createGain()
      master.gain.value = 1
      master.connect(c.destination)
      fracture = createRecordedGlassFracture({
        context: c,
        output: master,
        assetUrl: (id) => glassGameAssetUrl(id, 'games/'),
        profile,
        volume: () => readGlassEffectsVolume('beside-cue:glass-adventure'),
        seed: Math.round(targetHz),
      })
      void fracture.prepare()

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

    prepareBreak(): Promise<void> {
      return fracture?.prepare() ?? Promise.resolve()
    },

    shatter(_accuracy: number, safeSeconds = 4): void {
      if (ctx === null || master === null || broken) return
      broken = true
      const c = ctx
      const t = c.currentTime

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

      fracture?.play(`glass3d-${breakCount++}`, safeSeconds)
    },

    retune(nextHz: number): void {
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
      void fracture?.silence()
      if (ctx === null || ringGain === null) return
      // Start from silence rather than from wherever the settle left it,
      // so the next hold swells from nothing exactly as the first did.
      const t = ctx.currentTime
      ringGain.gain.cancelScheduledValues(t)
      ringGain.gain.setValueAtTime(0, t)
    },

    dispose(): void {
      if (disposed) return
      disposed = true
      broken = true
      void fracture?.dispose()
      fracture = null
      const retiringMaster = master
      const running = ctx?.state === 'running'
      const stopAt = (ctx?.currentTime ?? 0) + (running ? 0.24 : 0)
      if (ctx !== null && retiringMaster !== null) {
        retiringMaster.gain.cancelScheduledValues(ctx.currentTime)
        retiringMaster.gain.setTargetAtTime(0, ctx.currentTime, 0.036)
      }
      try {
        noise?.stop(stopAt)
      } catch {
        // Never started, or the context already went away with the page.
      }
      try {
        lfo?.stop(stopAt)
      } catch {
        // Never started, or the context already went away with the page.
      }
      const finish = (): void => {
        retiringMaster?.disconnect()
        lease.release()
      }
      if (running) setTimeout(finish, 240)
      else finish()
      master = null
      ringGain = null
      tremoloDepth = null
      filters = []
      noise = null
      lfo = null
      noiseCache = null
      ctx = null
    },
  }
}
