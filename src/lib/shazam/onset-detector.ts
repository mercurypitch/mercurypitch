// ============================================================
// Onset Detector — Note boundary detection from pitch frames
// Phase 2 of Shazam Sing
//
// Detects note onsets from a stream of timestamped pitch frames
// using three heuristics:
//   1. Clarity drop → silence boundary
//   2. Pitch jump → note change
//   3. Prolonged silence → end of phrase
// ============================================================

import type { DetectedPitch } from '@/lib/pitch-detector'
import { freqToMidi } from '@/lib/scale-data'
import type { OnsetDetectorOptions, OnsetEvent, TimestampedPitch, } from './types'

const DEFAULT_OPTIONS: Required<OnsetDetectorOptions> = {
  minSilenceSec: 0.15,
  minPitchJumpSemitones: 1,
  minStableSec: 0.08,
  silenceClarityThreshold: 0.3,
}

/**
 * Convert a frequency to the nearest MIDI number.
 * Returns null if frequency is 0 (silence).
 */
function toMidi(pitch: DetectedPitch): number | null {
  if (pitch.frequency <= 0 || pitch.clarity <= 0) return null
  if (!Number.isFinite(pitch.frequency) || !Number.isFinite(pitch.clarity))
    return null
  return freqToMidi(pitch.frequency)
}

/**
 * Median of an array of numbers — more robust to outliers than mean.
 */
function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

/**
 * Detect note onset events from a sequence of timestamped pitch frames.
 *
 * Works as a batch processor — call once you have all frames.
 * This is NOT real-time streaming; it's designed to run after
 * the user stops singing, on the complete frame buffer.
 */
export function detectOnsets(
  frames: TimestampedPitch[],
  options: OnsetDetectorOptions = {},
): OnsetEvent[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const events: OnsetEvent[] = []

  if (frames.length === 0) return events

  // Convert frame timing to seconds-per-frame for threshold calculations
  const frameInterval =
    frames.length > 1 ? frames[1].time - frames[0].time : 0.01
  const minSilenceFrames = Math.max(
    1,
    Math.round(opts.minSilenceSec / Math.max(frameInterval, 0.001)),
  )
  const minStableFrames = Math.max(
    1,
    Math.round(opts.minStableSec / Math.max(frameInterval, 0.001)),
  )

  // State machine: track whether we're in a voiced or silent region
  let inVoiced = false
  let silenceCount = 0
  let voicedSince: number | null = null
  let lastMidi: number | null = null
  let voicedMidiBuffer: number[] = []

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    const midi = toMidi(frame.pitch)

    if (midi === null) {
      // Silent frame
      silenceCount++
      if (inVoiced) {
        // Check if silence has lasted long enough to mark a note boundary
        if (silenceCount >= minSilenceFrames) {
          inVoiced = false
          voicedSince = null
          lastMidi = null
          voicedMidiBuffer = []
          // Don't emit 'end-of-phrase' yet — user may resume singing
        }
      } else {
        // Prolonged silence — check if it's been very long
        if (silenceCount >= minSilenceFrames * 6) {
          // Only emit end-of-phrase once
          const lastEvent = events[events.length - 1]
          if (lastEvent === undefined || lastEvent.type !== 'end-of-phrase') {
            events.push({
              time: frame.time,
              type: 'end-of-phrase',
              confidence: 0.6,
            })
          }
        }
      }
      continue
    }

    // Voiced frame
    silenceCount = 0

    if (!inVoiced) {
      // Transition: silence → voiced = note start
      inVoiced = true
      voicedSince = frame.time
      voicedMidiBuffer = [midi]
      events.push({
        time: frame.time,
        type: 'note-start',
        confidence: 0.7,
      })
      lastMidi = midi
      continue
    }

    // Still voiced — track pitch stability
    voicedMidiBuffer.push(midi)
    const stableDuration = frame.time - (voicedSince ?? frame.time)

    if (
      lastMidi !== null &&
      voicedMidiBuffer.length >= minStableFrames &&
      stableDuration >= opts.minStableSec
    ) {
      const stableMidi = median(voicedMidiBuffer)
      const jump = Math.abs(stableMidi - lastMidi)

      if (jump >= opts.minPitchJumpSemitones) {
        events.push({
          time: frame.time,
          type: 'note-change',
          confidence: Math.min(0.9, 0.5 + jump * 0.1),
        })
        lastMidi = stableMidi
        voicedSince = frame.time
        voicedMidiBuffer = [midi]
      }
    }
  }

  return events
}

/**
 * Segment a pitch frame sequence into discrete notes using onset events.
 * Each note is represented by the median MIDI of its constituent frames.
 * Returns arrays suitable for DTW matching.
 */
export function segmentNotes(
  frames: TimestampedPitch[],
  onsets: OnsetEvent[],
): {
  noteSequence: number[]
  ioiSequence: number[]
  noteDurations: number[]
} {
  if (frames.length === 0 || onsets.length === 0) {
    return { noteSequence: [], ioiSequence: [], noteDurations: [] }
  }

  const noteSequence: number[] = []
  const noteDurations: number[] = []
  const onsetTimes: number[] = []

  // Collect MIDI values between each onset using a single-pass
  // frame pointer (frames are sorted by time, so no need to rescan).
  let frameIdx = 0
  for (let oi = 0; oi < onsets.length; oi++) {
    const onset = onsets[oi]
    const nextOnsetTime =
      oi < onsets.length - 1 ? onsets[oi + 1].time : Infinity

    // Advance past frames before this onset
    while (frameIdx < frames.length && frames[frameIdx].time < onset.time) {
      frameIdx++
    }

    const midis: number[] = []
    let scanIdx = frameIdx
    while (scanIdx < frames.length && frames[scanIdx].time < nextOnsetTime) {
      const m = toMidi(frames[scanIdx].pitch)
      if (m !== null && Number.isFinite(m)) midis.push(m)
      scanIdx++
    }

    if (midis.length > 0) {
      noteSequence.push(median(midis))
      onsetTimes.push(onset.time)
      // Duration from this onset to next (or to last frame)
      const endTime =
        oi < onsets.length - 1
          ? onsets[oi + 1].time
          : frames[frames.length - 1].time
      noteDurations.push(Math.max(0.05, endTime - onset.time))
    }
  }

  // IOI sequence
  const ioiSequence: number[] = []
  for (let i = 1; i < onsetTimes.length; i++) {
    ioiSequence.push(onsetTimes[i] - onsetTimes[i - 1])
  }

  return { noteSequence, ioiSequence, noteDurations }
}
