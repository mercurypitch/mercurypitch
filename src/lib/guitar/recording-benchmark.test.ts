// Recorder benchmarks guard real production DSP, fixture truth and metric honesty.
import { describe, expect, it } from 'vitest'
import { PitchDetector } from '@/lib/pitch-detector'
import { createGuitarPitchDetector, guitarPitchConfiguration, } from './guitar-pitch-evidence'
import { GUITAR_RECORDING_BENCHMARK_CASES, runGuitarRecordingBenchmark, scoreGuitarRecordingNotes, } from './recording-benchmark'
import { createGuitarRecordingBenchmarkFixtures } from './recording-benchmark-fixtures'
import type { GuitarRecordedNote } from './recording-types'

const fixtures = createGuitarRecordingBenchmarkFixtures()
const fixture = (id: string) => fixtures.find((value) => value.id === id)!
const note = (midi: number, startFrame: number): GuitarRecordedNote => ({
  id: `${midi}:${startFrame}`,
  midi,
  startFrame,
  endFrame: startFrame + 100,
  clarity: 1,
  onset: 'attack',
})

describe('guitar evidence profiles', () => {
  it.each(['recording', 'rehearsal'] as const)(
    'preserves the existing %s detector on the same sequential PCM',
    (profile) => {
      const legacy = new PitchDetector(
        profile === 'recording'
          ? {
              sampleRate: 48000,
              bufferSize: 4096,
              algorithm: 'yin',
              minFrequency: 28,
              maxFrequency: 2200,
              minAmplitude: 0.006,
              minConfidence: 0.65,
              stabilize: false,
              telemetry: 'off',
            }
          : {
              sampleRate: 48000,
              bufferSize: 4096,
              algorithm: 'mpm',
              minFrequency: 55,
              maxFrequency: 1600,
              minAmplitude: 0.018,
              minConfidence: 0.38,
            },
      )
      const shared = createGuitarPitchDetector(
        48000,
        guitarPitchConfiguration(profile),
      )
      const samples = fixture('harmonic-run-100ms').samples
      const expected = []
      const actual = []
      for (let start = 0; start + 4096 <= samples.length; start += 1024) {
        const window = samples.subarray(start, start + 4096)
        expected.push(legacy.detect(window))
        actual.push(shared.detect(window))
      }
      expect(actual).toEqual(expected)
    },
  )

  it('does not mutate another session when overriding tuner or benchmark options', () => {
    expect(
      guitarPitchConfiguration('rehearsal', {
        bufferSize: 8192,
        minFrequency: 25,
      }),
    ).toMatchObject({ bufferSize: 8192, minFrequency: 25, stabilize: true })
    expect(guitarPitchConfiguration('rehearsal')).toMatchObject({
      bufferSize: 4096,
      minFrequency: 55,
      stabilize: true,
    })
    expect(guitarPitchConfiguration('recording')).toMatchObject({
      algorithm: 'yin',
      minConfidence: 0.65,
      stabilize: false,
    })
  })
})

describe('final-note benchmark metrics', () => {
  it('does not steal the next repeated note when onset windows overlap', () => {
    expect(
      scoreGuitarRecordingNotes(
        [
          { midi: 52, startSeconds: 0.2, endSeconds: 0.3 },
          { midi: 52, startSeconds: 0.3, endSeconds: 0.4 },
        ],
        [note(52, 149), note(52, 249)],
        1000,
      ),
    ).toMatchObject({ matched: 2, precision: 1, recall: 1 })
  })
  it('counts a duplicate, wrong octave and missing note instead of forgiving them', () => {
    const result = scoreGuitarRecordingNotes(
      [
        { midi: 52, startSeconds: 0.2, endSeconds: 0.3 },
        { midi: 55, startSeconds: 0.4, endSeconds: 0.5 },
        { midi: 57, startSeconds: 0.6, endSeconds: 0.7 },
      ],
      [note(52, 205), note(52, 220), note(67, 400)],
      1000,
    )
    expect(result).toMatchObject({
      expected: 3,
      detected: 3,
      matched: 1,
      missed: 2,
      falseNotes: 2,
      precision: 1 / 3,
      recall: 1 / 3,
    })
    expect(result.onsetAbsoluteMedianMs).toBeCloseTo(5, 8)
  })

  it('does not call empty ground truth perfect accuracy', () => {
    expect(scoreGuitarRecordingNotes([], [], 48000)).toMatchObject({
      precision: null,
      recall: null,
      falseNotes: 0,
    })
    expect(scoreGuitarRecordingNotes([], [note(52, 200)], 1000)).toMatchObject({
      precision: 0,
      recall: null,
      falseNotes: 1,
    })
  })

  it('keeps generated note truth independent of the detector', () => {
    for (const milliseconds of [80, 100, 150]) {
      const input = fixture(`harmonic-run-${milliseconds}ms`)
      expect(input.notes?.map((value) => value.midi)).toEqual([
        40, 43, 45, 47, 52, 55, 59, 64,
      ])
      expect(
        input.notes![0].endSeconds - input.notes![0].startSeconds,
      ).toBeCloseTo(milliseconds / 1000, 8)
    }
  })
})

describe.each(GUITAR_RECORDING_BENCHMARK_CASES)('same-PCM $id', (candidate) => {
  it('recognizes isolated harmonic string pitches without octave folding or extra notes', () => {
    const result = runGuitarRecordingBenchmark(
      fixture('harmonic-isolated-strings'),
      candidate,
    )
    expect(result.emittedNotes.map((value) => value.midi)).toEqual([
      40, 45, 50, 55, 59, 64,
    ])
    expect(result.noteMetrics).toMatchObject({
      precision: 1,
      recall: 1,
      falseNotes: 0,
    })
    expect(result.noteMetrics!.onsetAbsoluteP95Ms).toBeLessThan(10)
  })

  it('produces identical notes, attacks and frame metrics across 2048/8192 PCM delivery', () => {
    const input = fixture('damped-repeated-picks-100ms')
    const small = runGuitarRecordingBenchmark(input, candidate, 2048)
    const large = runGuitarRecordingBenchmark(input, candidate, 8192)
    expect(small.emittedNotes).toEqual(large.emittedNotes)
    expect(small.detectedAttacks).toBe(large.detectedAttacks)
    expect(small.noteMetrics).toEqual(large.noteMetrics)
    expect(small.pitchMetrics).toEqual(large.pitchMetrics)
  })

  it('does not emit a note in silence', () => {
    const result = runGuitarRecordingBenchmark(fixture('silence'), candidate)
    expect(result.emittedNotes).toEqual([])
    expect(result.pitchMetrics).toMatchObject({
      detected: 0,
      falseVoiced: 0,
      precision: null,
      recall: null,
    })
  })

  it('reports contours and chords without inventing note-label ground truth', () => {
    const bend = runGuitarRecordingBenchmark(
      fixture('whole-step-bend'),
      candidate,
    )
    expect(bend.noteMetrics).toBeNull()
    expect(bend.pitchMetrics!.absoluteP95Cents).toBeLessThan(10)
    const chord = runGuitarRecordingBenchmark(fixture('chord-onset'), candidate)
    expect(chord.noteMetrics).toBeNull()
    expect(chord.pitchMetrics).toBeNull()
    expect(chord.limitation).toContain('Monophonic')
  })
})
