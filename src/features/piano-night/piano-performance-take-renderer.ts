// ============================================================
// Piano performance take renderer — deterministic bounded felt-synth PCM
// ============================================================
//
// Player note lifetimes are rendered directly into mono PCM. This preserves a
// stable replay across browsers without opening another live AudioContext or
// admitting the Score/Hear arrangement into the saved take.

import type { PreparedPerformanceTakeAudio } from '@/lib/domain/performance-take'
import { preparePcmPerformanceTake } from '@/lib/performance-take-audio'
import type { PianoPerformanceTakeCapture, PianoPerformanceTakeNote, } from './piano-performance-take'
import { PIANO_PERFORMANCE_TAKE_MAX_DURATION_MS, PIANO_PERFORMANCE_TAKE_MAX_NOTES, } from './piano-performance-take'

export const PIANO_PERFORMANCE_TAKE_SAMPLE_RATE = 24_000
export const PIANO_PERFORMANCE_TAKE_MAX_RENDERED_NOTE_MS = 30 * 60 * 1000

const RELEASE_MS = 85
const TAIL_MS = RELEASE_MS + 20
const MINIMUM_GAIN = 0.0001
const MASTER_GAIN = 0.72

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}

function frequencyForMidi(midi: number): number {
  return 440 * Math.pow(2, (Math.round(midi) - 69) / 12)
}

function strikeGain(note: PianoPerformanceTakeNote): number {
  const curvedVelocity = Math.pow(clamp01(note.velocity), 1.35)
  const softScale = 1 - clamp01(note.softPedalValue) * 0.42
  return Math.max(MINIMUM_GAIN, curvedVelocity * softScale * 0.13)
}

function heldEnvelope(elapsedSeconds: number, peak: number): number {
  if (elapsedSeconds < 0.008) {
    return MINIMUM_GAIN + (peak - MINIMUM_GAIN) * (elapsedSeconds / 0.008)
  }
  if (elapsedSeconds < 0.24) {
    const progress = (elapsedSeconds - 0.008) / (0.24 - 0.008)
    return peak * (1 - progress * 0.42)
  }
  const progress = Math.min(1, (elapsedSeconds - 0.24) / (4 - 0.24))
  return peak * (0.58 - progress * 0.28)
}

function triangle(phase: number): number {
  return (2 / Math.PI) * Math.asin(Math.sin(phase))
}

function renderNote(
  samples: Float32Array,
  note: PianoPerformanceTakeNote,
): void {
  const sampleRate = PIANO_PERFORMANCE_TAKE_SAMPLE_RATE
  const startFrame = Math.max(0, Math.floor((note.startMs / 1000) * sampleRate))
  const releaseFrame = Math.max(
    startFrame + 1,
    Math.floor((note.endMs / 1000) * sampleRate),
  )
  const stopFrame = Math.min(
    samples.length,
    releaseFrame + Math.ceil((RELEASE_MS / 1000) * sampleRate),
  )
  const peak = strikeGain(note)
  const frequency = frequencyForMidi(note.midi)
  const releaseElapsedSeconds = (releaseFrame - startFrame) / sampleRate
  const releaseGain = heldEnvelope(releaseElapsedSeconds, peak)

  for (let frame = startFrame; frame < stopFrame; frame += 1) {
    const elapsedSeconds = (frame - startFrame) / sampleRate
    const envelope =
      frame < releaseFrame
        ? heldEnvelope(elapsedSeconds, peak)
        : Math.max(
            MINIMUM_GAIN,
            releaseGain *
              (1 -
                (frame - releaseFrame) / Math.max(1, stopFrame - releaseFrame)),
          )
    const phase = Math.PI * 2 * frequency * elapsedSeconds
    const voice = triangle(phase - 0.000_4) + Math.sin(phase * 2 + 0.000_4)
    samples[frame] = (samples[frame] ?? 0) + voice * envelope * MASTER_GAIN
  }
}

/** Render one completed player-only pass into a persistable WAV take. */
export function renderPianoPerformanceTake(
  capture: PianoPerformanceTakeCapture,
  capturedAt: string,
): PreparedPerformanceTakeAudio | null {
  if (
    capture.notes.length === 0 ||
    capture.notes.length > PIANO_PERFORMANCE_TAKE_MAX_NOTES ||
    !Number.isFinite(capture.durationMs) ||
    capture.durationMs <= 0 ||
    capture.durationMs > PIANO_PERFORMANCE_TAKE_MAX_DURATION_MS
  ) {
    return null
  }
  let renderedNoteMs = 0
  for (const note of capture.notes) {
    if (
      !Number.isFinite(note.startMs) ||
      !Number.isFinite(note.endMs) ||
      !Number.isFinite(note.midi) ||
      note.midi < 0 ||
      note.midi > 127 ||
      note.startMs < 0 ||
      note.endMs <= note.startMs ||
      note.endMs > capture.durationMs
    ) {
      return null
    }
    renderedNoteMs += note.endMs - note.startMs + RELEASE_MS
    if (renderedNoteMs > PIANO_PERFORMANCE_TAKE_MAX_RENDERED_NOTE_MS) {
      return null
    }
  }
  const durationMs = Math.min(
    PIANO_PERFORMANCE_TAKE_MAX_DURATION_MS + TAIL_MS,
    capture.durationMs + TAIL_MS,
  )
  const frameCount = Math.max(
    1,
    Math.ceil((durationMs / 1000) * PIANO_PERFORMANCE_TAKE_SAMPLE_RATE),
  )
  const samples = new Float32Array(frameCount)
  for (const note of capture.notes) renderNote(samples, note)

  // A deterministic soft limiter keeps dense chords inside PCM bounds without
  // normalizing away the player's velocity differences.
  for (let frame = 0; frame < samples.length; frame += 1) {
    samples[frame] = Math.tanh((samples[frame] ?? 0) * 1.1) / Math.tanh(1.1)
  }
  return preparePcmPerformanceTake({
    samples,
    sampleRate: PIANO_PERFORMANCE_TAKE_SAMPLE_RATE,
    capturedAt,
  })
}
