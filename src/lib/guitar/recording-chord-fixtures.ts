// Labelled synthetic chord fixtures provide known pitches and timing without private or licensed audio.
import type { GuitarRecordingBenchmarkFixture, GuitarRecordingNoteTruth, } from './recording-benchmark-fixtures'

export interface GuitarChordFixture extends GuitarRecordingBenchmarkFixture {
  notes: readonly GuitarRecordingNoteTruth[]
  probes: { seconds: number; midis: number[] }[]
}

const RATE = 48000

function chord(
  midis: number[],
  startSeconds = 0.2,
  endSeconds = 1.2,
  strumSeconds = 0,
): GuitarRecordingNoteTruth[] {
  return midis.map((midi, index) => ({
    midi,
    startSeconds: startSeconds + index * strumSeconds,
    endSeconds,
  }))
}

function render(
  id: string,
  notes: GuitarRecordingNoteTruth[],
  probes: number[],
  options: { harmonic2?: number; noise?: number } = {},
): GuitarChordFixture {
  const samples = new Float32Array(
    Math.ceil((Math.max(0.5, ...notes.map((n) => n.endSeconds)) + 0.3) * RATE),
  )
  for (const note of notes) {
    const start = Math.round(note.startSeconds * RATE)
    const end = Math.round(note.endSeconds * RATE)
    const hz = 440 * 2 ** ((note.midi - 69) / 12)
    for (let i = start; i < end; i++) {
      const age = (i - start) / RATE
      const phase = 2 * Math.PI * hz * age
      const envelope =
        Math.min(1, age / 0.003, (end - i) / (0.008 * RATE)) *
        Math.exp(-age / 1.5)
      // Add, do not overwrite other strings. Each fixture has the same fixed
      // per-voice level; no model-aware chord loudness or pitch filtering.
      samples[i] +=
        0.07 *
        envelope *
        (Math.sin(phase) +
          (options.harmonic2 ?? 0.5) * Math.sin(2 * phase + 0.3) +
          0.25 * Math.sin(3 * phase + 0.7) +
          0.12 * Math.sin(5 * phase))
    }
  }
  if (options.noise !== undefined && options.noise > 0) {
    let seed = 1234567
    for (let i = 0; i < samples.length; i++) {
      seed = (1664525 * seed + 1013904223) >>> 0
      samples[i] += (seed / 0xffffffff - 0.5) * options.noise
    }
  }
  return {
    id,
    sampleRate: RATE,
    samples,
    notes,
    midiAt: null,
    probes: probes.map((seconds) => ({
      seconds,
      midis: [
        ...new Set(
          notes
            .filter(
              (note) =>
                note.startSeconds <= seconds && note.endSeconds > seconds,
            )
            .map((note) => note.midi),
        ),
      ].sort((a, b) => a - b),
    })),
    limitation:
      'Synthetic harmonic strings, not dry-DI hardware validation. Probe sets test sustained pitches; onset metrics separately include every attack.',
  }
}

export function createGuitarChordFixtures(): GuitarChordFixture[] {
  return [
    render('dyad-perfect-fifth', chord([40, 47]), [0.5, 0.9, 1.4]),
    render('dyad-major-third', chord([52, 56]), [0.5, 0.9]),
    render('power-chord', chord([40, 47, 52]), [0.5, 0.9]),
    render('open-e-minor', chord([40, 47, 52, 55, 59, 64]), [0.5, 0.9]),
    render(
      'open-c-major-strum',
      chord([48, 52, 55, 60, 64], 0.2, 1.3, 0.025),
      [0.55, 1],
    ),
    render('barre-f-major', chord([41, 48, 53, 57, 60, 65]), [0.5, 0.9]),
    render(
      'barre-b-minor',
      chord([47, 54, 59, 62, 66], 0.2, 1.3, 0.018),
      [0.55, 1],
    ),
    render(
      'independent-releases',
      [
        { midi: 40, startSeconds: 0.2, endSeconds: 1.6 },
        { midi: 47, startSeconds: 0.2, endSeconds: 0.8 },
        { midi: 52, startSeconds: 0.2, endSeconds: 1.1 },
      ],
      [0.5, 0.95, 1.4],
    ),
    render(
      'overlapping-arpeggio',
      [40, 47, 52, 55, 59, 64].map((midi, i) => ({
        midi,
        startSeconds: 0.2 + i * 0.13,
        endSeconds: 1.5 + i * 0.1,
      })),
      [0.5, 1, 1.75],
    ),
    render(
      'repeated-power-chords',
      [0.2, 0.7, 1.2].flatMap((start) =>
        chord([40, 47, 52], start, start + 0.4),
      ),
      [0.45, 0.95, 1.45],
    ),
    render('single-low-e', chord([40]), [0.5, 0.9]),
    render('single-harmonic-dominant', chord([40]), [0.5, 0.9], {
      harmonic2: 1.7,
    }),
    render(
      'single-fast-run',
      [40, 43, 45, 47, 52, 55, 59, 64].map((midi, i) => ({
        midi,
        startSeconds: 0.2 + i * 0.1,
        endSeconds: 0.3 + i * 0.1,
      })),
      [0.25, 0.55, 0.85],
    ),
    render(
      'single-held-across-windows',
      chord([52], 0.2, 5.5),
      [0.5, 1.8, 3.4, 5],
    ),
    render('silence', [], [0.2, 0.5]),
    render('muted-noise-control', [], [0.2, 0.5], { noise: 0.01 }),
  ]
}
