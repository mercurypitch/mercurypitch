// Drum velocity contract — one curve implementation for curation and playback.
// ============================================================
//
// This module intentionally stays plain ESM: the browser runtime imports it,
// and the Node-only sample curator imports the exact same implementation.

export const DRUM_VELOCITY_CONTRACT_VERSION = 1
export const DRUM_VELOCITY_GAIN_FLOOR = 0.02
export const DRUM_VELOCITY_DRUM_EXPONENT = 2
export const DRUM_VELOCITY_METAL_EXPONENT = 1.6
export const DRUM_MAXIMUM_POWER_CORRECTION_DB = 3

const MINIMUM_POWER_CORRECTION = 10 ** (-DRUM_MAXIMUM_POWER_CORRECTION_DB / 20)
const MAXIMUM_POWER_CORRECTION = 10 ** (DRUM_MAXIMUM_POWER_CORRECTION_DB / 20)

const METAL_ARTICULATIONS = new Set([
  'hh-closed',
  'hh-pedal',
  'hh-open',
  'crash',
  'ride',
])

export function normalizeDrumVelocity(velocity) {
  if (!Number.isFinite(velocity)) return 1
  return Math.min(127, Math.max(1, velocity))
}

export function drumVelocityUnit(velocity) {
  return (normalizeDrumVelocity(velocity) - 1) / 126
}

/** Resolve an audited override, or the shared acoustic/metal fallback curve. */
export function resolveDrumVelocityTarget(articulation, velocity, curve) {
  if (curve === undefined) {
    const exponent = METAL_ARTICULATIONS.has(articulation)
      ? DRUM_VELOCITY_METAL_EXPONENT
      : DRUM_VELOCITY_DRUM_EXPONENT
    const shaped = drumVelocityUnit(velocity) ** exponent
    return DRUM_VELOCITY_GAIN_FLOOR + (1 - DRUM_VELOCITY_GAIN_FLOOR) * shaped
  }

  const boundedVelocity = normalizeDrumVelocity(velocity)
  for (let index = 1; index < curve.length; index += 1) {
    const right = curve[index]
    if (boundedVelocity > right[0]) continue
    const left = curve[index - 1]
    const span = right[0] - left[0]
    if (span <= 0) return left[1]
    const mix = (boundedVelocity - left[0]) / span
    return left[1] + (right[1] - left[1]) * mix
  }
  return curve.at(-1)?.[1] ?? DRUM_VELOCITY_GAIN_FLOOR
}

export function resolveDrumPowerCorrection(samplePower) {
  if (!Number.isFinite(samplePower) || samplePower <= 0) return 1
  return Math.min(
    MAXIMUM_POWER_CORRECTION,
    Math.max(MINIMUM_POWER_CORRECTION, 1 / samplePower),
  )
}

/** Exact post-calibration gain used by runtime playback and offline reports. */
export function resolveDrumHitGain(articulation, velocity, curve, samplePower) {
  const target = resolveDrumVelocityTarget(articulation, velocity, curve)
  if (target <= 0) return 0
  return target * resolveDrumPowerCorrection(samplePower)
}

/** Stable metadata embedded in the calibration report and catalog contract. */
export function drumVelocityContractSnapshot() {
  return Object.freeze({
    version: DRUM_VELOCITY_CONTRACT_VERSION,
    velocityMinimum: 1,
    velocityMaximum: 127,
    gainFloor: DRUM_VELOCITY_GAIN_FLOOR,
    drumExponent: DRUM_VELOCITY_DRUM_EXPONENT,
    metalExponent: DRUM_VELOCITY_METAL_EXPONENT,
    maximumPowerCorrectionDb: DRUM_MAXIMUM_POWER_CORRECTION_DB,
  })
}
