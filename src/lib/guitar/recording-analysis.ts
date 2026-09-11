// Frame-clock guitar transcription and PCM encoding run off the audio rendering thread.
import type { GuitarPitchConfiguration, GuitarPitchProfile, } from './guitar-pitch-evidence'
import { createGuitarPitchDetector, guitarPitchConfiguration, } from './guitar-pitch-evidence'
import { createGuitarMelodySegmenter } from './recording-evidence'

export {
  createGuitarMelodySegmenter,
  guitarWavHeader,
} from './recording-evidence'
import { createAttackDetector } from './attack-detector'
import type { GuitarPitchEvidence, GuitarRecordingChunk, } from './recording-types'

const WINDOW = 4096
const HOP = 1024

export interface GuitarRecordingAnalysisOptions {
  /** Headless A/B seam. Live recording retains its existing policy by default. */
  pitchProfile?: GuitarPitchProfile
  pitchOverrides?: Partial<Omit<GuitarPitchConfiguration, 'bufferSize'>>
}

/** Preserve sample values and ordering; Web Audio currentFrame anomalies are diagnostics only. */
export function encodeGuitarPcm16(
  samples: Float32Array,
  frames = samples.length,
): ArrayBuffer {
  const bytes = new ArrayBuffer(frames * 2)
  const view = new DataView(bytes)
  for (let index = 0; index < frames; index++) {
    const sample = Number.isFinite(samples[index])
      ? Math.max(-1, Math.min(1, samples[index]))
      : 0
    view.setInt16(
      index * 2,
      Math.round(sample * (sample < 0 ? 32768 : 32767)),
      true,
    )
  }
  return bytes
}

export function createGuitarRecordingAnalysis(
  recordingId: string,
  sampleRate: number,
  options: GuitarRecordingAnalysisOptions = {},
) {
  const pitchConfiguration = guitarPitchConfiguration(
    options.pitchProfile ?? 'recording',
    {
      ...options.pitchOverrides,
      bufferSize: WINDOW,
    },
  )
  const detector = createGuitarPitchDetector(sampleRate, pitchConfiguration)
  const attacks = createAttackDetector({ sampleRate, floorLevel: 0.012 })
  const segmenter = createGuitarMelodySegmenter(sampleRate)
  const ring = new Float32Array(WINDOW)
  const window = new Float32Array(WINDOW)
  const pendingAttacks: number[] = []
  let cursor = 0
  let frames = 0
  let emittedNotes = 0
  return {
    process(
      samples: Float32Array,
      count: number,
      sequence: number,
      firstFrame: number,
    ): GuitarRecordingChunk {
      if (firstFrame !== frames || count < 1 || count > samples.length)
        throw new Error('Recording audio is incomplete or out of order.')
      const attackFrames = attacks
        .process(samples.subarray(0, count))
        .map((attack) => firstFrame + attack.offsetSamples)
      pendingAttacks.push(...attackFrames)
      const pitches: GuitarPitchEvidence[] = []
      let peak = 0
      for (let index = 0; index < count; index++) {
        const sample = Number.isFinite(samples[index]) ? samples[index] : 0
        peak = Math.max(peak, Math.abs(sample))
        ring[cursor] = sample
        cursor = (cursor + 1) % WINDOW
        frames++
        if (frames < WINDOW || frames % HOP !== 0) continue
        window.set(ring.subarray(cursor))
        window.set(ring.subarray(0, cursor), WINDOW - cursor)
        const pitch = detector.detect(window)
        const frame = frames - WINDOW / 2
        const midi =
          pitch.frequency > 0 &&
          pitch.clarity >= pitchConfiguration.minConfidence
            ? 69 + 12 * Math.log2(pitch.frequency / 440)
            : null
        const evidence = { frame, midi, clarity: pitch.clarity }
        while (pendingAttacks.length && pendingAttacks[0] <= frame)
          segmenter.attack(pendingAttacks.shift()!)
        segmenter.push(evidence)
        pitches.push(evidence)
      }
      const notes = segmenter.notes()
      const chunk: GuitarRecordingChunk = {
        id: `${recordingId}:${sequence}`,
        recordingId,
        sequence,
        kind: 'audio',
        createdAt: '',
        updatedAt: '',
        firstFrame,
        frames: count,
        pcm: encodeGuitarPcm16(samples, count),
        pitches,
        attacks: attackFrames,
        notes: notes.slice(emittedNotes),
        peak,
      }
      emittedNotes = notes.length
      return chunk
    },
    finish: () => ({ frames, notes: segmenter.finish(frames) }),
    preview: segmenter.preview,
  }
}
