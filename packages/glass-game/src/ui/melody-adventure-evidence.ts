// Melody adventure evidence — rejects stale detector frames and finds one steady setup note.

import type { PitchObservation } from '../contracts'

const CONFIDENCE_FLOOR = 0.5
const MAXIMUM_SAMPLE_AGE_MS = 150
const MAXIMUM_SAMPLE_GAP_SECONDS = 0.1
const MAXIMUM_CALIBRATION_DRIFT = 0.8
const MINIMUM_CALIBRATION_SAMPLES = 12
const MINIMUM_CALIBRATION_SECONDS = 0.45

export interface AcceptedMelodyObservation {
  observation: PitchObservation
  voicedMidi: number | null
}

export interface MelodyAdventureEvidence {
  reset(): void
  markBoundary(latest: PitchObservation | null, nowMs: number): void
  accept(
    observation: PitchObservation,
    observedAtMs: number,
  ): AcceptedMelodyObservation | null
  calibrationCandidate(midi: number, captureSeconds: number): number | null
  resetCalibration(): void
}

function finite(value: number): boolean {
  return Number.isFinite(value)
}

export function createMelodyAdventureEvidence(range: {
  minimumMidi: number
  maximumMidi: number
}): MelodyAdventureEvidence {
  let calibrationSamples: Array<{ midi: number; captureSeconds: number }> = []
  let lastSequence = -Infinity
  let lastCaptureSeconds = -Infinity
  let capturedAfterMs = -Infinity

  const resetCalibration = (): void => {
    calibrationSamples = []
  }

  const reset = (): void => {
    resetCalibration()
    lastSequence = -Infinity
    lastCaptureSeconds = -Infinity
    capturedAfterMs = -Infinity
  }

  return {
    reset,
    markBoundary(latest, nowMs) {
      capturedAfterMs = nowMs
      if (latest === null) return
      if (finite(latest.sequence))
        lastSequence = Math.max(lastSequence, latest.sequence)
      if (finite(latest.captureSeconds))
        lastCaptureSeconds = Math.max(lastCaptureSeconds, latest.captureSeconds)
    },
    accept(observation, observedAtMs) {
      if (
        !finite(observation.sequence) ||
        !finite(observation.captureSeconds) ||
        !finite(observation.capturedAtMs) ||
        observation.capturedAtMs < capturedAfterMs ||
        observation.sequence <= lastSequence ||
        observation.captureSeconds <= lastCaptureSeconds
      )
        return null

      lastSequence = observation.sequence
      lastCaptureSeconds = observation.captureSeconds
      const age = observedAtMs - observation.capturedAtMs
      const voiced =
        finite(age) &&
        age >= -5 &&
        age <= MAXIMUM_SAMPLE_AGE_MS &&
        observation.midi !== null &&
        finite(observation.midi) &&
        finite(observation.confidence) &&
        observation.confidence >= CONFIDENCE_FLOOR
      return {
        observation,
        voicedMidi: voiced ? observation.midi : null,
      }
    },
    calibrationCandidate(midi, captureSeconds) {
      if (midi < range.minimumMidi || midi > range.maximumMidi) {
        resetCalibration()
        return null
      }
      const previous = calibrationSamples.at(-1)
      if (
        previous !== undefined &&
        (captureSeconds - previous.captureSeconds >
          MAXIMUM_SAMPLE_GAP_SECONDS ||
          Math.abs(midi - previous.midi) > MAXIMUM_CALIBRATION_DRIFT)
      )
        resetCalibration()
      calibrationSamples.push({ midi, captureSeconds })
      if (calibrationSamples.length > 30) calibrationSamples.shift()
      if (
        calibrationSamples.length < MINIMUM_CALIBRATION_SAMPLES ||
        captureSeconds - calibrationSamples[0].captureSeconds <
          MINIMUM_CALIBRATION_SECONDS
      )
        return null
      const values = calibrationSamples
        .map((sample) => sample.midi)
        .sort((left, right) => left - right)
      return Math.round(values[Math.floor(values.length / 2)])
    },
    resetCalibration,
  }
}
