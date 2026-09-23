// ============================================================
// Stem key timing — what the listener hears, once the key shifts
// ============================================================
//
// The shifter adds its latency to every bus, so the song position that is
// being heard trails the rendered one by that much more, and the pitch it
// plays is the tapped pitch moved by the shift. The vocal analyser taps the
// guide BEFORE the shifter (at the playback rate), so the reference the
// singer is judged against is the tapped pitch times 2^(shift/12).

import type { DetectedPitch } from '@/lib/pitch-detector'
import { freqToMidiFloat } from '@/lib/pitch-pipeline/log-pitch'
import { midiToNote } from '@/lib/scale-data'

/**
 * Song position being heard. `audibleContextTime` is the context time that
 * is reaching the listener; the shifter latency is taken off in real time,
 * before the playback rate scales it into song time.
 */
export function audibleSongTime(
  bufferPlayStart: number,
  audibleContextTime: number,
  wallPlayStart: number,
  speed: number,
  extraLatencySec: number,
): number {
  return (
    bufferPlayStart +
    Math.max(0, audibleContextTime - extraLatencySec - wallPlayStart) * speed
  )
}

/** The reading moved by `semitones`; the same object at 0. */
export function shiftDetectedPitch(
  pitch: DetectedPitch,
  semitones: number,
): DetectedPitch {
  if (semitones === 0) return pitch
  const frequency = pitch.frequency * 2 ** (semitones / 12)
  const midiFloat = freqToMidiFloat(frequency)
  const rounded = Math.round(midiFloat)
  const { name, octave } = midiToNote(rounded)
  return {
    ...pitch,
    frequency,
    noteName: name,
    octave,
    cents: Math.round((midiFloat - rounded) * 100),
  }
}
