// ============================================================
// Glass — the resonance + cumulative-fatigue model (spec §3.3).
//
// Pure per-tick physics of the game: resonance rises while the
// singer holds the band and decays outside it; fatigue only ever
// rises (near-misses leave permanent damage) and persists across
// reps, honestly lowering the shatter wall so persistence always
// wins. Prototype-validated constants live in GLASS_CONFIG.
// ============================================================

import type { GlassConfig } from './config'
import { GLASS_CONFIG } from './config'

export interface GlassPhysicsState {
  /** 0..1 — the shatter charge; resets each rep. */
  resonance: number
  /** Seconds of continuous in-band lock; resets on any exit. */
  lockRun: number
  /** 0..1 — permanent damage; persists across reps within one glass. */
  fatigue: number
  /** How many CRACK_STEPS thresholds have been crossed (cracks spawned). */
  crackStep: number
}

export function initialPhysics(): GlassPhysicsState {
  return { resonance: 0, lockRun: 0, fatigue: 0, crackStep: 0 }
}

/** A new rep on the same glass: charge resets, damage stays. */
export function startRep(state: GlassPhysicsState): GlassPhysicsState {
  return { ...state, resonance: 0, lockRun: 0 }
}

export interface PhysicsTick {
  /** Offset from the target in cents, or null while unvoiced. */
  offCents: number | null
  /** Input RMS level 0..1 (fatigue stress scales with loudness). */
  level: number
  /** Seconds since the previous tick. */
  dt: number
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))

export function tickPhysics(
  state: GlassPhysicsState,
  tick: PhysicsTick,
  config: GlassConfig = GLASS_CONFIG,
): GlassPhysicsState {
  const { resonance: res, fatigue } = state
  const { offCents, level, dt } = tick
  const { rise, riseAccel, fall, edgeSoftening } = config.resonance
  const tol = config.target.tolCents

  if (offCents === null) {
    return {
      ...state,
      resonance: clamp01(res - dt * fall),
      lockRun: 0,
    }
  }

  const absOff = Math.abs(offCents)
  const inBand = absOff <= tol

  const nextResonance = inBand
    ? clamp01(
        res +
          dt * (rise + riseAccel * res) * (1 - edgeSoftening * (absOff / tol)),
      )
    : clamp01(res - dt * fall)

  // Cumulative damage: proximity² × loudness — near-misses count, far
  // wandering doesn't. Fatigue never decreases.
  const proximity = Math.max(0, 1 - absOff / config.fatigue.proximityFloorCents)
  const nextFatigue = clamp01(
    fatigue + dt * config.fatigue.rate * level * proximity * proximity,
  )

  let crackStep = state.crackStep
  const steps = config.fatigue.crackSteps
  while (crackStep < steps.length && nextFatigue >= steps[crackStep]) {
    crackStep++
  }

  return {
    resonance: nextResonance,
    lockRun: inBand ? state.lockRun + dt : 0,
    fatigue: nextFatigue,
    crackStep,
  }
}

/** The resonance level required to shatter, honestly lowered by damage. */
export function shatterThreshold(
  fatigue: number,
  config: GlassConfig = GLASS_CONFIG,
): number {
  return 1 - config.fatigue.assist * fatigue
}

/** True when this tick's state has earned the shatter. */
export function shatterReady(
  state: GlassPhysicsState,
  config: GlassConfig = GLASS_CONFIG,
): boolean {
  return (
    state.resonance >= shatterThreshold(state.fatigue, config) &&
    state.lockRun >= config.resonance.lockForShatterSec
  )
}
