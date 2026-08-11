// Named deterministic input fixtures make detector changes comparable without hardware claims.
// ============================================================

export type GuitarInputFixtureId =
  | 'clean-single-note'
  | 'fast-alternate-picking'
  | 'noisy-room-picking'
  | 'whole-step-bend'
  | 'legato-slide'
  | 'wide-vibrato'
  | 'chord-onset'
  | 'clipped-input'

export interface GuitarPitchTruthPoint {
  atSeconds: number
  frequencyHz: number
}

export type GuitarFixturePitchTruth =
  | {
      kind: 'monophonic'
      points: readonly GuitarPitchTruthPoint[]
    }
  | {
      kind: 'unavailable'
      reason: string
    }

export interface GuitarInputFixture {
  id: GuitarInputFixtureId
  title: string
  origin: 'synthetic'
  sampleRate: number
  samples: Float32Array
  expectedAttackSeconds: readonly number[]
  pitchTruth: GuitarFixturePitchTruth
}

const SAMPLE_RATE = 48_000

interface SyntheticVoice {
  atSeconds: number
  endSeconds: number
  amplitude: number
  decaySeconds: number | null
  frequencyAt(elapsedSeconds: number): number
}

function deterministicNoise(index: number): number {
  const value = Math.sin(index * 12.9898) * 43_758.5453
  return value - Math.floor(value) - 0.5
}

function staticVoice(
  atSeconds: number,
  frequencyHz: number,
  amplitude: number,
  decaySeconds: number,
  endSeconds = 1.5,
): SyntheticVoice {
  return {
    atSeconds,
    endSeconds,
    amplitude,
    decaySeconds,
    frequencyAt: () => frequencyHz,
  }
}

function renderFixture(
  durationSeconds: number,
  voices: readonly SyntheticVoice[],
  noiseAmplitude: number,
): Float32Array {
  const samples = new Float32Array(Math.round(durationSeconds * SAMPLE_RATE))
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = deterministicNoise(index) * noiseAmplitude
  }
  for (const voice of voices) {
    const start = Math.round(voice.atSeconds * SAMPLE_RATE)
    const end = Math.min(
      samples.length,
      Math.round(voice.endSeconds * SAMPLE_RATE),
    )
    let phase = 0
    for (let index = start; index < end; index += 1) {
      const elapsed = (index - start) / SAMPLE_RATE
      const envelope =
        voice.decaySeconds === null
          ? 1
          : Math.exp(-elapsed / voice.decaySeconds)
      phase += (2 * Math.PI * voice.frequencyAt(elapsed)) / SAMPLE_RATE
      samples[index] += voice.amplitude * envelope * Math.sin(phase)
    }
  }
  return samples
}

function frequencyBetween(
  startHz: number,
  endHz: number,
  elapsedSeconds: number,
  travelSeconds: number,
): number {
  const progress = Math.min(1, Math.max(0, elapsedSeconds / travelSeconds))
  return startHz * Math.pow(endHz / startHz, progress)
}

export function createGuitarInputFixture(
  id: GuitarInputFixtureId,
): GuitarInputFixture {
  if (id === 'clean-single-note') {
    return {
      id,
      title: 'Clean single note',
      origin: 'synthetic',
      sampleRate: SAMPLE_RATE,
      samples: renderFixture(
        0.9,
        [staticVoice(0.2, 110, 0.5, 0.35, 0.9)],
        0.001,
      ),
      expectedAttackSeconds: [0.2],
      pitchTruth: {
        kind: 'monophonic',
        points: [
          { atSeconds: 0.34, frequencyHz: 110 },
          { atSeconds: 0.5, frequencyHz: 110 },
        ],
      },
    }
  }

  if (id === 'fast-alternate-picking') {
    const attacks = Array.from({ length: 8 }, (_, index) => 0.16 + index * 0.1)
    return {
      id,
      title: 'Fast alternate picking',
      origin: 'synthetic',
      sampleRate: SAMPLE_RATE,
      samples: renderFixture(
        1.25,
        attacks.map((atSeconds, index) =>
          staticVoice(
            atSeconds,
            index % 2 === 0 ? 146.83 : 164.81,
            0.52,
            0.22,
            1.25,
          ),
        ),
        0.0015,
      ),
      expectedAttackSeconds: attacks,
      pitchTruth: {
        kind: 'unavailable',
        reason:
          'Overlapping ringing notes make this attack fixture non-monophonic.',
      },
    }
  }

  if (id === 'noisy-room-picking') {
    const attacks = [0.2, 0.47, 0.74, 1.01]
    return {
      id,
      title: 'Noisy room picking',
      origin: 'synthetic',
      sampleRate: SAMPLE_RATE,
      samples: renderFixture(
        1.45,
        attacks.map((atSeconds, index) =>
          staticVoice(atSeconds, 110 + index * 18, 0.42, 0.2, 1.45),
        ),
        0.009,
      ),
      expectedAttackSeconds: attacks,
      pitchTruth: {
        kind: 'unavailable',
        reason:
          'This fixture validates attack rejection in deterministic noise.',
      },
    }
  }

  if (id === 'whole-step-bend') {
    const startHz = 110
    const endHz = 123.4708
    const travelSeconds = 0.58
    const frequencyAt = (elapsedSeconds: number): number =>
      frequencyBetween(startHz, endHz, elapsedSeconds, travelSeconds)
    const pointTimes = [0.36, 0.56, 0.76]
    return {
      id,
      title: 'Whole-step bend',
      origin: 'synthetic',
      sampleRate: SAMPLE_RATE,
      samples: renderFixture(
        1.05,
        [
          {
            atSeconds: 0.18,
            endSeconds: 1.05,
            amplitude: 0.46,
            decaySeconds: 1.2,
            frequencyAt,
          },
        ],
        0.001,
      ),
      expectedAttackSeconds: [0.18],
      pitchTruth: {
        kind: 'monophonic',
        points: pointTimes.map((atSeconds) => ({
          atSeconds,
          frequencyHz: frequencyAt(atSeconds - 0.18),
        })),
      },
    }
  }

  if (id === 'legato-slide') {
    const startHz = 146.8324
    const endHz = 195.9977
    const travelSeconds = 0.42
    const frequencyAt = (elapsedSeconds: number): number =>
      frequencyBetween(startHz, endHz, elapsedSeconds, travelSeconds)
    const pointTimes = [0.3, 0.44, 0.58, 0.75]
    return {
      id,
      title: 'Legato slide',
      origin: 'synthetic',
      sampleRate: SAMPLE_RATE,
      samples: renderFixture(
        1,
        [
          {
            atSeconds: 0.16,
            endSeconds: 1,
            amplitude: 0.44,
            decaySeconds: 1.4,
            frequencyAt,
          },
        ],
        0.001,
      ),
      expectedAttackSeconds: [0.16],
      pitchTruth: {
        kind: 'monophonic',
        points: pointTimes.map((atSeconds) => ({
          atSeconds,
          frequencyHz: frequencyAt(atSeconds - 0.16),
        })),
      },
    }
  }

  if (id === 'wide-vibrato') {
    const centerHz = 220
    const depthCents = 38
    const frequencyAt = (elapsedSeconds: number): number =>
      centerHz *
      Math.pow(
        2,
        (depthCents * Math.sin(2 * Math.PI * 5 * elapsedSeconds)) / 1200,
      )
    const pointTimes = [0.32, 0.43, 0.54, 0.65, 0.76]
    return {
      id,
      title: 'Wide vibrato',
      origin: 'synthetic',
      sampleRate: SAMPLE_RATE,
      samples: renderFixture(
        1,
        [
          {
            atSeconds: 0.16,
            endSeconds: 1,
            amplitude: 0.42,
            decaySeconds: 1.5,
            frequencyAt,
          },
        ],
        0.001,
      ),
      expectedAttackSeconds: [0.16],
      pitchTruth: {
        kind: 'monophonic',
        points: pointTimes.map((atSeconds) => ({
          atSeconds,
          frequencyHz: frequencyAt(atSeconds - 0.16),
        })),
      },
    }
  }

  if (id === 'chord-onset') {
    return {
      id,
      title: 'Chord onset',
      origin: 'synthetic',
      sampleRate: SAMPLE_RATE,
      samples: renderFixture(
        1,
        [110, 138.5913, 164.8138].map((frequencyHz) =>
          staticVoice(0.2, frequencyHz, 0.2, 0.5, 1),
        ),
        0.001,
      ),
      expectedAttackSeconds: [0.2],
      pitchTruth: {
        kind: 'unavailable',
        reason:
          'The current listening pitch path is monophonic, so chord pitch scoring is intentionally unavailable.',
      },
    }
  }

  return {
    id,
    title: 'Clipped input',
    origin: 'synthetic',
    sampleRate: SAMPLE_RATE,
    samples: renderFixture(0.9, [staticVoice(0.2, 110, 1.35, 0.5, 0.9)], 0.001),
    expectedAttackSeconds: [0.2],
    pitchTruth: {
      kind: 'unavailable',
      reason:
        'Clipped input is a health failure, so pitch accuracy is intentionally unavailable.',
    },
  }
}

export const GUITAR_INPUT_FIXTURE_IDS: readonly GuitarInputFixtureId[] = [
  'clean-single-note',
  'fast-alternate-picking',
  'noisy-room-picking',
  'whole-step-bend',
  'legato-slide',
  'wide-vibrato',
  'chord-onset',
  'clipped-input',
]
