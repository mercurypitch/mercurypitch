// ============================================================
// Stem Fingerprinter — extract MelodyFingerprint from vocal stem
// Phase 5 of Shazam Sing
//
// Uses the same PitchDetector + mergeConsecutiveNotes pattern as
// midi-generator.ts, but builds a MelodyFingerprint for DTW
// matching instead of MIDI events.
// ============================================================

import type { PitchDetection } from '@/lib/midi-generator'
import { mergeConsecutiveNotes, MIDI_NOTE_RANGE, PITCH_DETECTOR_DEFAULTS, WINDOW_STEP_SEC, } from '@/lib/midi-generator'
import { PitchDetector } from '@/lib/pitch-detector'
import { freqToMidi, freqToNote } from '@/lib/scale-data'
import type { FingerprintError, MelodyFingerprint } from './types'

const YIELD_BATCH_SIZE = 100
const MIN_NOTE_COUNT = 3

export interface StemFingerprintOptions {
  maxGapSec?: number
  minDurationSec?: number
}

/**
 * Estimate tempo from merged notes using IOI mode.
 * Returns 120 BPM if fewer than 2 notes.
 */
function estimateBpm(mergedNotes: Array<{ startSec: number }>): number {
  if (mergedNotes.length < 2) return 120
  const iois: number[] = []
  for (let i = 1; i < mergedNotes.length; i++) {
    const delta = mergedNotes[i].startSec - mergedNotes[i - 1].startSec
    if (delta > 0) iois.push(delta)
  }
  if (iois.length === 0) return 120
  iois.sort((a, b) => a - b)
  const medianIoi = iois[Math.floor(iois.length / 2)]
  if (medianIoi <= 0) return 120
  const bps = 1 / medianIoi
  return Math.round(bps * 60)
}

/**
 * Extract a MelodyFingerprint from a vocal stem AudioBuffer.
 * Returns FingerprintError if fewer than MIN_NOTE_COUNT notes are detected.
 */
export async function extractStemFingerprint(
  audioBuffer: AudioBuffer,
  metadata: { sessionId: string; originalFileName: string; bpm?: number },
  options?: StemFingerprintOptions,
): Promise<MelodyFingerprint | FingerprintError> {
  const sampleRate = audioBuffer.sampleRate
  const audioData = audioBuffer.getChannelData(0)

  const detector = new PitchDetector({ sampleRate, ...PITCH_DETECTOR_DEFAULTS })
  const windowStepSamples = Math.floor(WINDOW_STEP_SEC * sampleRate)
  const totalFrames =
    Math.floor(
      (audioData.length - PITCH_DETECTOR_DEFAULTS.bufferSize) /
        windowStepSamples,
    ) + 1

  if (totalFrames <= 0) {
    return {
      melodyId: `stem:${metadata.sessionId}`,
      name: metadata.originalFileName,
      reason: 'Audio too short for pitch detection',
    }
  }

  const detections: PitchDetection[] = []

  for (let i = 0; i < totalFrames; i++) {
    const offset = i * windowStepSamples
    const chunk = audioData.slice(
      offset,
      offset + PITCH_DETECTOR_DEFAULTS.bufferSize,
    )
    const pitch = detector.detect(chunk)

    if (pitch.frequency > 0) {
      const midi = freqToMidi(pitch.frequency)
      if (midi >= MIDI_NOTE_RANGE.min && midi <= MIDI_NOTE_RANGE.max) {
        detections.push({
          midi,
          noteName: freqToNote(pitch.frequency).name,
          timeSec:
            offset / sampleRate +
            PITCH_DETECTOR_DEFAULTS.bufferSize / sampleRate / 2,
        })
      }
    }

    if (i % YIELD_BATCH_SIZE === 0 && i > 0) {
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  if (detections.length === 0) {
    return {
      melodyId: `stem:${metadata.sessionId}`,
      name: metadata.originalFileName,
      reason: 'No pitched notes detected in vocal stem',
    }
  }

  const maxGapSec = options?.maxGapSec ?? WINDOW_STEP_SEC + 0.02
  const minDurationSec = options?.minDurationSec ?? 0.08
  const merged = mergeConsecutiveNotes(detections, maxGapSec, minDurationSec)

  if (merged.length < MIN_NOTE_COUNT) {
    return {
      melodyId: `stem:${metadata.sessionId}`,
      name: metadata.originalFileName,
      reason: `Only ${merged.length} notes detected (minimum ${MIN_NOTE_COUNT})`,
    }
  }

  const pitchSequence: number[] = []
  const chromaSequence: number[] = []
  const intervalSequence: number[] = []
  const durations: number[] = []
  const ioiSequence: number[] = []

  for (let i = 0; i < merged.length; i++) {
    const note = merged[i]
    pitchSequence.push(note.midi)
    chromaSequence.push(note.midi % 12)
    durations.push(note.endSec - note.startSec)

    if (i > 0) {
      intervalSequence.push(note.midi - merged[i - 1].midi)
      ioiSequence.push(note.startSec - merged[i - 1].startSec)
    }
  }

  const bpm = metadata.bpm ?? estimateBpm(merged)
  const durationSec = merged[merged.length - 1].endSec

  return {
    melodyId: `stem:${metadata.sessionId}`,
    name: metadata.originalFileName,
    pitchSequence,
    chromaSequence,
    intervalSequence,
    durations,
    ioiSequence,
    bpm,
    key: 'C',
    durationSec,
    noteCount: merged.length,
    firstNoteStartSec: merged.length > 0 ? merged[0].startSec : 0,
  }
}
