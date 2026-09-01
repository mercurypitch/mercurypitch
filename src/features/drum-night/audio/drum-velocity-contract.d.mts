// Type boundary for the shared browser-and-Node Drum Night velocity contract.
// ============================================================

export type SharedDrumVelocityCurve = readonly (readonly [
  velocity: number,
  output: number,
])[]

export const DRUM_VELOCITY_CONTRACT_VERSION: 1
export const DRUM_VELOCITY_GAIN_FLOOR: 0.02
export const DRUM_VELOCITY_DRUM_EXPONENT: 2
export const DRUM_VELOCITY_METAL_EXPONENT: 1.6
export const DRUM_MAXIMUM_POWER_CORRECTION_DB: 3

export function normalizeDrumVelocity(velocity: number): number
export function drumVelocityUnit(velocity: number): number
export function resolveDrumVelocityTarget(
  articulation: string,
  velocity: number,
  curve?: SharedDrumVelocityCurve,
): number
export function resolveDrumPowerCorrection(samplePower?: number): number
export function resolveDrumHitGain(
  articulation: string,
  velocity: number,
  curve?: SharedDrumVelocityCurve,
  samplePower?: number,
): number
export function drumVelocityContractSnapshot(): Readonly<{
  version: 1
  velocityMinimum: 1
  velocityMaximum: 127
  gainFloor: 0.02
  drumExponent: 2
  metalExponent: 1.6
  maximumPowerCorrectionDb: 3
}>
