// ============================================================
// Tiny monophonic synth for auditioning the detected vocal melody. A single
// oscillator + gain follows the playhead: setNote(midi) glides to the note and
// fades in, setNote(null) fades out. Lazily creates its own AudioContext on
// first enable (from a user gesture) so autoplay policies are satisfied.
// ============================================================

export interface MelodySynth {
  /** Ensure the audio graph exists and the context is running (call from a
   *  user gesture — e.g. the toggle click). */
  resume(): void
  /** Play the given MIDI note, or silence when null. */
  setNote(midi: number | null): void
  dispose(): void
}

const midiToFreq = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12)

export function createMelodySynth(level = 0.12): MelodySynth {
  let ctx: AudioContext | null = null
  let osc: OscillatorNode | null = null
  let gain: GainNode | null = null
  let current: number | null = null

  const ensure = (): void => {
    if (ctx !== null) return
    ctx = new AudioContext()
    osc = ctx.createOscillator()
    gain = ctx.createGain()
    gain.gain.value = 0
    osc.type = 'triangle'
    osc.frequency.value = 440
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
  }

  return {
    resume(): void {
      ensure()
      void ctx?.resume()
    },
    setNote(midi: number | null): void {
      if (midi === null) {
        if (ctx !== null && gain !== null) {
          gain.gain.setTargetAtTime(0, ctx.currentTime, 0.03)
        }
        current = null
        return
      }
      ensure()
      const now = ctx!.currentTime
      if (midi !== current) {
        osc!.frequency.setTargetAtTime(midiToFreq(midi), now, 0.012)
        current = midi
      }
      gain!.gain.setTargetAtTime(level, now, 0.02)
    },
    dispose(): void {
      try {
        osc?.stop()
      } catch {
        // already stopped
      }
      void ctx?.close()
      ctx = null
      osc = null
      gain = null
      current = null
    },
  }
}
