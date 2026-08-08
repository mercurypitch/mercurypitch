// Stem-transcription tests hold the bass profile to what it can actually hear.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { TranscriptionFrame } from './stem-transcription'
import { BASS_TRANSCRIPTION_PROFILE, harmonicCorrectedMidi, profileWindowSamples, repairOctaveSlips, resolvableMinFrequency, toneMagnitude, transcribeFrames, transcribeStemSamples, } from './stem-transcription'

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
    expect(result.notes[0].durationSeconds).toBeCloseTo(
      10 * PROFILE.stepSeconds,
      5,
    )
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

describe('resolvableMinFrequency', () => {
  it('is a floor the shipped bass profile stays above', () => {
    // Window length and minimum frequency are not independent. Whichever one
    // moves, this fails until the other moves with it.
    expect(BASS_TRANSCRIPTION_PROFILE.minFrequency).toBeGreaterThanOrEqual(
      resolvableMinFrequency(BASS_TRANSCRIPTION_PROFILE.windowSeconds),
    )
  })

  it('falls as the window lengthens', () => {
    expect(resolvableMinFrequency(0.1)).toBeLessThan(
      resolvableMinFrequency(0.05),
    )
  })
})

describe('toneMagnitude', () => {
  const SAMPLE_RATE = 8000

  function tone(frequency: number, seconds: number, amplitude = 0.5) {
    const samples = new Float32Array(Math.round(seconds * SAMPLE_RATE))
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] =
        amplitude * Math.sin((2 * Math.PI * frequency * index) / SAMPLE_RATE)
    }
    return samples
  }

  it('finds energy at the frequency that is there, and not at one that is not', () => {
    const samples = tone(82.41, 0.5)
    const atPitch = toneMagnitude(
      samples,
      SAMPLE_RATE,
      82.41,
      0,
      samples.length,
    )
    const atOther = toneMagnitude(samples, SAMPLE_RATE, 123, 0, samples.length)
    expect(atPitch).toBeGreaterThan(atOther * 5)
  })

  it('refuses spans too short to mean anything', () => {
    expect(toneMagnitude(tone(82, 0.5), SAMPLE_RATE, 82, 0, 4)).toBe(0)
  })
})

describe('harmonicCorrectedMidi', () => {
  const SAMPLE_RATE = 8000

  /** A string whose fundamental is E2, with the harmonics a real one has. */
  function pluckedE2(seconds = 0.4) {
    const samples = new Float32Array(Math.round(seconds * SAMPLE_RATE))
    for (let index = 0; index < samples.length; index += 1) {
      const time = index / SAMPLE_RATE
      samples[index] =
        0.5 * Math.sin(2 * Math.PI * 82.41 * time) +
        0.3 * Math.sin(2 * Math.PI * 164.81 * time) +
        0.15 * Math.sin(2 * Math.PI * 247.2 * time)
    }
    return samples
  }

  it('pulls a sub-octave reading back up to the note that is sounding', () => {
    const samples = pluckedE2()
    // 28 is E1 — the octave below, which is what YIN reports when it locks
    // onto twice the true period.
    expect(
      harmonicCorrectedMidi(
        samples,
        SAMPLE_RATE,
        28,
        0,
        samples.length,
        BASS_TRANSCRIPTION_PROFILE,
      ),
    ).toBe(40)
  })

  it('leaves a correct reading alone, harmonics and all', () => {
    const samples = pluckedE2()
    expect(
      harmonicCorrectedMidi(
        samples,
        SAMPLE_RATE,
        40,
        0,
        samples.length,
        BASS_TRANSCRIPTION_PROFILE,
      ),
    ).toBe(40)
  })

  it('never shifts a note out of the profile it belongs to', () => {
    const samples = pluckedE2()
    expect(
      harmonicCorrectedMidi(
        samples,
        SAMPLE_RATE,
        BASS_TRANSCRIPTION_PROFILE.maxMidi,
        0,
        samples.length,
        BASS_TRANSCRIPTION_PROFILE,
      ),
    ).toBe(BASS_TRANSCRIPTION_PROFILE.maxMidi)
  })
})

describe('transcribeFrames with onsets', () => {
  const profile = BASS_TRANSCRIPTION_PROFILE

  /** Ten frames of an unwavering E2 — one pitch contour, no pitch change. */
  const heldFrames = Array.from({ length: 10 }, (_, index) => ({
    timeSeconds: index * profile.stepSeconds,
    midi: 40,
    clarity: 0.9,
  }))

  it('reads a repeated note as one note when nothing says it was struck', () => {
    expect(transcribeFrames(heldFrames, profile).notes).toHaveLength(1)
  })

  it('splits it where the string was struck again', () => {
    // Two strikes inside the contour: the classic repeated bass note that
    // pitch alone has no way to count.
    const notes = transcribeFrames(
      heldFrames,
      profile,
      heldFrames.length,
      heldFrames.length * profile.stepSeconds,
      [profile.stepSeconds * 3.5, profile.stepSeconds * 6.5],
    ).notes
    expect(notes).toHaveLength(3)
    expect(notes.every((note) => note.midi === 40)).toBe(true)
  })

  it('ignores an onset that lands outside the frames it has', () => {
    expect(
      transcribeFrames(heldFrames, profile, heldFrames.length, 1, [99]).notes,
    ).toHaveLength(1)
  })
})

describe('the fine window', () => {
  const SAMPLE_RATE = 8000

  function tone(frequency: number, seconds: number) {
    const samples = new Float32Array(Math.round(seconds * SAMPLE_RATE))
    for (let index = 0; index < samples.length; index += 1) {
      const time = index / SAMPLE_RATE
      samples[index] =
        0.5 * Math.sin(2 * Math.PI * frequency * time) +
        0.25 * Math.sin(2 * Math.PI * frequency * 2 * time)
    }
    return samples
  }

  it('is off by default, and that is a measured choice not an oversight', () => {
    expect(BASS_TRANSCRIPTION_PROFILE.fineWindowSeconds).toBeNull()
  })

  it('still transcribes when switched on, so the path is not dead', async () => {
    const result = await transcribeStemSamples(tone(110, 1.2), SAMPLE_RATE, {
      profile: { ...BASS_TRANSCRIPTION_PROFILE, fineWindowSeconds: 0.045 },
    })
    expect(result.notes.length).toBeGreaterThan(0)
    expect(result.notes[0].midi).toBe(45)
  })
})
