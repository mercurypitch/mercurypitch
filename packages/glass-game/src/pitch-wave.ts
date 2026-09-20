// Pitch-wave lesson configuration — bounded excursions around a comfortable settled note.

export interface PitchWaveDefinition {
  requiredCycles: number
  minimumExcursionCents: number
  maximumExcursionCents: number
  minimumCycleSeconds: number
  maximumCycleSeconds: number
  minimumWaveSeconds: number
  maximumCentsPerSecond: number
  smoothingSeconds: number
}
