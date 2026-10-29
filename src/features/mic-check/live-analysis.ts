// ============================================================
// Live analysis — the level, the bands and the held note, frame by frame
// ============================================================
//
// What a mic stage paints, read off a capture once per animation frame: the
// level and the peak, the three bands the ribbon answers, and the note a
// voice is holding. The Settings mic check and First Light's waiting screen
// feed the same stage from it.
//
// The note comes from a YIN pass of the analysis's own, or from a pitch the
// caller already has for the frame. First Light's voice session runs YIN for
// its take anyway, and a second pass over the same audio would cost a phone
// twice the work for the same answer.

import { PitchDetector } from '@/lib/pitch-detector'
import type { HeldNote, NoteTrackerState } from './note-tracker'
import { initialNoteTracker, trackNote } from './note-tracker'
import { bandLevel } from './voice-ribbon'

const FFT_SIZE = 2048

/**
 * The analysis of the latest frame. A plain mutable object, not signals:
 * the stage reads it every animation frame, and sixty signal writes a second
 * would re-run every effect that touches it.
 */
export interface MicCheckLive {
  /** True while a capture graph is feeding these numbers. */
  active: boolean
  rms: number
  peak: number
  low: number
  mid: number
  high: number
  note: HeldNote | null
  /** Counts landed notes, so a renderer can tell a new note from a held one. */
  onsets: number
}

export const createMicLive = (): MicCheckLive => ({
  active: false,
  rms: 0,
  peak: 0,
  low: 0,
  mid: 0,
  high: 0,
  note: null,
  onsets: 0,
})

/** Back to rest: what a stage reads once nothing feeds it. */
export function quietMicLive(live: MicCheckLive): void {
  live.active = false
  live.rms = 0
  live.peak = 0
  live.low = 0
  live.mid = 0
  live.high = 0
  live.note = null
}

/** A pitch the caller already has for this frame. */
export interface PitchInput {
  /** Hz, 0 when unvoiced. */
  f0: number
  /** Detector clarity, 0..1. */
  clarity: number
}

export const UNVOICED: PitchInput = { f0: 0, clarity: 0 }

export interface MicAnalysis {
  readonly context: AudioContext
  readonly stream: MediaStream
  /**
   * Analyse the latest buffer into `live`. `pitch` takes the place of the
   * analysis's own YIN pass when given. True on the frame a note lands.
   */
  read: (live: MicCheckLive, at: number, pitch?: PitchInput) => boolean
  dispose: () => void
}

export interface MicAnalysisOptions {
  /** Run a YIN pass of its own. Off for a caller that passes its pitch. */
  detectPitch?: boolean
}

export function createMicAnalysis(
  context: AudioContext,
  stream: MediaStream,
  options: MicAnalysisOptions = {},
): MicAnalysis {
  const source = context.createMediaStreamSource(stream)
  const analyser = context.createAnalyser()
  analyser.fftSize = FFT_SIZE
  analyser.smoothingTimeConstant = 0.42
  analyser.minDecibels = -85
  analyser.maxDecibels = -15
  source.connect(analyser)
  // Muted sink: some WebKit versions only pull an analyser that reaches the
  // destination (see pitch-f0-stream.ts). Zero gain keeps it silent.
  const sink = context.createGain()
  sink.gain.value = 0
  analyser.connect(sink)
  sink.connect(context.destination)

  const detector =
    options.detectPitch === false
      ? null
      : new PitchDetector({
          sampleRate: context.sampleRate,
          bufferSize: FFT_SIZE,
          algorithm: 'yin',
          // The settings pitch-f0-stream uses for a voice captured with AGC
          // off: a singing range with headroom and a low amplitude gate.
          minFrequency: 60,
          maxFrequency: 1600,
          minAmplitude: 0.005,
        })
  const time = new Float32Array(FFT_SIZE)
  const spectrum = new Uint8Array(analyser.frequencyBinCount)
  let notes: NoteTrackerState = initialNoteTracker()

  const ownPitch = (): PitchInput => {
    if (detector === null) return UNVOICED
    const detected = detector.detect(time)
    return detected.frequency > 0
      ? { f0: detected.frequency, clarity: detected.clarity }
      : UNVOICED
  }

  return {
    context,
    stream,
    read(live, at, pitch) {
      analyser.getFloatTimeDomainData(time)
      let squares = 0
      let peak = 0
      for (let i = 0; i < time.length; i++) {
        const sample = time[i]
        squares += sample * sample
        const magnitude = sample < 0 ? -sample : sample
        if (magnitude > peak) peak = magnitude
      }
      const rms = Math.sqrt(squares / time.length)
      analyser.getByteFrequencyData(spectrum)
      const rate = context.sampleRate
      live.active = true
      live.rms = rms
      live.peak = peak
      live.low = bandLevel(spectrum, rate, FFT_SIZE, 60, 350)
      live.mid = bandLevel(spectrum, rate, FFT_SIZE, 350, 2600)
      live.high = bandLevel(spectrum, rate, FFT_SIZE, 2600, 10000)

      const heard = pitch ?? ownPitch()
      const step = trackNote(notes, {
        f0: heard.f0,
        clarity: heard.clarity,
        rms,
        at,
      })
      notes = step.state
      if (step.onset) live.onsets++
      live.note = notes.held
      return step.onset
    },
    dispose() {
      source.disconnect()
      analyser.disconnect()
      sink.disconnect()
    },
  }
}
