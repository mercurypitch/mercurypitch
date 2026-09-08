// ============================================================
// Recorder fixtures provide deterministic harmonic PCM and independent note truth.
// ============================================================

import { createGuitarInputFixture } from './guitar-input-fixtures'

export interface GuitarRecordingNoteTruth {
  midi: number
  startSeconds: number
  endSeconds: number
}

export interface GuitarRecordingBenchmarkFixture {
  id: string
  sampleRate: number
  samples: Float32Array
  /** Null means note segmentation cannot honestly be scored for this fixture. */
  notes: readonly GuitarRecordingNoteTruth[] | null
  /** Null means no single fundamental truth (for example, a chord). */
  midiAt: ((seconds: number) => number | null) | null
  limitation: string | null
}

const RATE = 48_000
const midiFrequency = (midi: number): number => 440 * 2 ** ((midi - 69) / 12)

function noteSequence(
  midis: readonly number[],
  duration: number,
  gap = 0,
): GuitarRecordingNoteTruth[] {
  return midis.map((midi, index) => ({
    midi,
    startSeconds: 0.16 + index * (duration + gap),
    endSeconds: 0.16 + index * (duration + gap) + duration,
  }))
}

function harmonicFixture(
  id: string,
  notes: readonly GuitarRecordingNoteTruth[],
  options: { legato?: boolean; decay?: number; secondHarmonic?: number } = {},
): GuitarRecordingBenchmarkFixture {
  const duration = (notes.at(-1)?.endSeconds ?? 0.5) + 0.2
  const samples = new Float32Array(Math.ceil(duration * RATE))
  const midiAt = (time: number): number | null =>
    notes.find((note) => time >= note.startSeconds && time < note.endSeconds)
      ?.midi ?? null
  let phase = 0
  for (const note of notes) {
    const first = Math.round(note.startSeconds * RATE)
    const end = Math.round(note.endSeconds * RATE)
    if (options.legato !== true) phase = 0
    for (let index = first; index < end; index++) {
      const age = (index - first) / RATE
      phase += (2 * Math.PI * midiFrequency(note.midi)) / RATE
      const envelope =
        options.legato === true
          ? 1
          : Math.min(1, age / 0.002, (end - index) / (RATE * 0.002)) *
            Math.exp(-age / (options.decay ?? 0.4))
      const harmonic =
        Math.sin(phase) +
        (options.secondHarmonic ?? 0.55) * Math.sin(phase * 2 + 0.3) +
        0.3 * Math.sin(phase * 3 + 0.7) +
        0.12 * Math.sin(phase * 5)
      samples[index] = 0.2 * envelope * harmonic
    }
  }
  return { id, sampleRate: RATE, samples, notes, midiAt, limitation: null }
}

/** No recordings or private audio are bundled; these are algorithmic fixtures. */
export function createGuitarRecordingBenchmarkFixtures(): GuitarRecordingBenchmarkFixture[] {
  const clean = createGuitarInputFixture('clean-single-note')
  const bend = createGuitarInputFixture('whole-step-bend')
  const vibrato = createGuitarInputFixture('wide-vibrato')
  const chord = createGuitarInputFixture('chord-onset')
  const contourLimitation =
    'Continuous pitch truth only; emitted notes do not establish a bend or vibrato technique label.'
  return [
    {
      id: clean.id,
      sampleRate: clean.sampleRate,
      samples: clean.samples,
      notes: [{ midi: 45, startSeconds: 0.2, endSeconds: 0.9 }],
      midiAt: (time) => (time >= 0.2 && time < 0.9 ? 45 : null),
      limitation: null,
    },
    harmonicFixture(
      'harmonic-isolated-strings',
      noteSequence([40, 45, 50, 55, 59, 64], 0.36, 0.16),
    ),
    harmonicFixture('harmonic-sustain', noteSequence([40], 1.2)),
    harmonicFixture(
      'second-harmonic-dominant',
      noteSequence([40, 52, 64], 0.3, 0.12),
      { secondHarmonic: 1.7 },
    ),
    ...[0.08, 0.1, 0.15].map((duration) =>
      harmonicFixture(
        `harmonic-run-${duration * 1000}ms`,
        noteSequence([40, 43, 45, 47, 52, 55, 59, 64], duration),
      ),
    ),
    harmonicFixture(
      'damped-repeated-picks-100ms',
      noteSequence(Array<number>(8).fill(52), 0.1),
      { decay: 0.028 },
    ),
    harmonicFixture(
      'legato-150ms',
      noteSequence([52, 55, 57, 59, 57, 55, 52], 0.15),
      { legato: true },
    ),
    {
      id: bend.id,
      sampleRate: bend.sampleRate,
      samples: bend.samples,
      notes: null,
      midiAt: (time) =>
        time >= 0.18 && time < 1.05
          ? 69 +
            12 *
              Math.log2(
                (110 * (123.4708 / 110) ** Math.min(1, (time - 0.18) / 0.58)) /
                  440,
              )
          : null,
      limitation: contourLimitation,
    },
    {
      id: vibrato.id,
      sampleRate: vibrato.sampleRate,
      samples: vibrato.samples,
      notes: null,
      midiAt: (time) =>
        time >= 0.16 && time < 1
          ? 57 + 0.38 * Math.sin(2 * Math.PI * 5 * (time - 0.16))
          : null,
      limitation: contourLimitation,
    },
    {
      id: 'silence',
      sampleRate: RATE,
      samples: new Float32Array(RATE / 2),
      notes: [],
      midiAt: () => null,
      limitation: null,
    },
    {
      id: chord.id,
      sampleRate: chord.sampleRate,
      samples: chord.samples,
      notes: null,
      midiAt: null,
      limitation:
        'Monophonic detector output cannot prove the pitches in a chord.',
    },
  ]
}
