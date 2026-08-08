// Stem-transcription tests hold the bass profile to what it can actually hear.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { TranscriptionFrame } from './stem-transcription'
import { BASS_TRANSCRIPTION_PROFILE, profileWindowSamples, repairOctaveSlips, transcribeFrames, transcribeStemSamples, } from './stem-transcription'

const PROFILE = BASS_TRANSCRIPTION_PROFILE

function frames(
  entries: readonly [seconds: number, midi: number, clarity?: number][],
): TranscriptionFrame[] {
  return entries.map(([timeSeconds, midi, clarity]) => ({
    timeSeconds,
    midi,
    clarity: clarity ?? 0.9,
  }))
}

function steady(
  midi: number,
  count: number,
  startSeconds = 0,
  clarity = 0.9,
): TranscriptionFrame[] {
  return Array.from({ length: count }, (_, index) => ({
    timeSeconds: startSeconds + index * PROFILE.stepSeconds,
    midi,
    clarity,
  }))
}

describe('transcribeFrames', () => {
  it('merges steady frames into one sustained note', () => {
    const result = transcribeFrames(steady(40, 10), PROFILE)

    expect(result.notes).toHaveLength(1)
    expect(result.notes[0].midi).toBe(40)
    expect(result.notes[0].startSeconds).toBeCloseTo(0, 5)
    expect(result.notes[0].durationSeconds).toBeCloseTo(10 * 0.04, 5)
    expect(result.coverage).toBe(1)
  })

  it('splits on a pitch change', () => {
    const result = transcribeFrames(
      [...steady(40, 6), ...steady(45, 6, 6 * PROFILE.stepSeconds)],
      PROFILE,
    )

    expect(result.notes.map((note) => note.midi)).toEqual([40, 45])
  })

  it('splits on a silent gap between notes', () => {
    const result = transcribeFrames(
      [...steady(40, 6), ...steady(40, 6, 3)],
      PROFILE,
    )

    expect(result.notes).toHaveLength(2)
    expect(result.notes[1].startSeconds).toBeCloseTo(3, 5)
  })

  it('drops a blip too short to be a played note', () => {
    const result = transcribeFrames(
      [...steady(40, 6), ...steady(52, 1, 1), ...steady(40, 6, 2)],
      PROFILE,
    )

    expect(result.notes.map((note) => note.midi)).toEqual([40, 40])
  })

  it('ignores frames under the confidence floor and reports the gap as coverage', () => {
    const result = transcribeFrames(
      [...steady(40, 10), ...steady(45, 10, 1, 0.1)],
      PROFILE,
    )

    expect(result.notes).toHaveLength(1)
    expect(result.coverage).toBeCloseTo(0.5, 5)
  })

  it('reports nothing rather than guessing when no frame is confident', () => {
    const result = transcribeFrames(steady(40, 10, 0, 0.1), PROFILE)

    expect(result.notes).toEqual([])
    expect(result.coverage).toBe(0)
  })

  it('keeps a note out of range from entering the line', () => {
    const result = transcribeFrames(frames([[0, 90, 0.95]]), PROFILE)

    expect(result.notes).toEqual([])
  })
})

describe('repairOctaveSlips', () => {
  it('pulls a lone octave jump back onto the line', () => {
    const line = [40, 40, 40, 40, 52, 40, 40]

    expect(repairOctaveSlips(line, PROFILE)).toEqual([
      40, 40, 40, 40, 40, 40, 40,
    ])
  })

  it('leaves a genuine leap alone', () => {
    const line = [40, 40, 40, 40, 45, 45, 45]

    expect(repairOctaveSlips(line, PROFILE)).toEqual([
      40, 40, 40, 40, 45, 45, 45,
    ])
  })

  it('never repairs a note out of the instrument range', () => {
    const repaired = repairOctaveSlips([28, 28, 28, 28, 40], {
      ...PROFILE,
      minMidi: 28,
      maxMidi: 40,
    })

    expect(repaired.every((midi) => midi >= 28 && midi <= 40)).toBe(true)
  })
})

describe('transcribeStemSamples', () => {
  it('hears a low E the vocal profile would have filtered out', async () => {
    const sampleRate = 44100
    const seconds = 1.5
    const frequency = 41.203 // E1, below the vocal path's 65 Hz floor
    const samples = new Float32Array(Math.floor(sampleRate * seconds))
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] =
        0.5 * Math.sin((2 * Math.PI * frequency * index) / sampleRate)
    }

    const result = await transcribeStemSamples(samples, sampleRate)

    expect(result.notes.length).toBeGreaterThan(0)
    expect(result.notes[0].midi).toBe(28)
    expect(result.notes[0].noteName).toBe('E1')
    expect(result.coverage).toBeGreaterThan(0.8)
  })

  it('hears the same note at the cheap analysis rate the room actually uses', async () => {
    // Production decodes to 8 kHz: a tenth of the samples, and the pitch
    // search runs over a tenth of the lags. The answer must not change.
    const sampleRate = BASS_TRANSCRIPTION_PROFILE.analysisSampleRate
    const samples = new Float32Array(Math.floor(sampleRate * 1.5))
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] =
        0.5 * Math.sin((2 * Math.PI * 41.203 * index) / sampleRate)
    }

    const result = await transcribeStemSamples(samples, sampleRate)

    expect(result.notes[0]?.midi).toBe(28)
    expect(result.coverage).toBeGreaterThan(0.8)
  })

  it('sizes the analysis window in time, not in samples', () => {
    expect(
      profileWindowSamples(BASS_TRANSCRIPTION_PROFILE, 44100),
    ).toBeGreaterThan(profileWindowSamples(BASS_TRANSCRIPTION_PROFILE, 8000))
    // Same span of music either way.
    expect(
      profileWindowSamples(BASS_TRANSCRIPTION_PROFILE, 8000) / 8000,
    ).toBeCloseTo(BASS_TRANSCRIPTION_PROFILE.windowSeconds, 2)
  })

  it('returns nothing for a clip shorter than one analysis window', async () => {
    const result = await transcribeStemSamples(new Float32Array(512), 44100)

    expect(result.notes).toEqual([])
    expect(result.coverage).toBe(0)
  })
})
