// ============================================================
// V2 onboarding platter motion tests — canonical rigid-stop invariants
// ============================================================

import { describe, expect, it } from 'vitest'
import { advanceV2PlatterSpinAngle, createV2PlatterStopMotion, sampleV2PlatterStopMotion, V2_PLATTER_ANGULAR_VELOCITY_RAD_PER_SECOND, V2_PLATTER_CANONICAL_EPSILON_RAD, V2_PLATTER_TURN_RADIANS, } from './v2-onboarding-platter-motion'

describe('V2 onboarding platter motion', () => {
  it('advances one half turn per second at 30 rpm', () => {
    // Arrange
    const initialAngle = Math.PI / 4

    // Act
    const angle = advanceV2PlatterSpinAngle(initialAngle, 1)

    // Assert
    expect(V2_PLATTER_ANGULAR_VELOCITY_RAD_PER_SECOND).toBe(Math.PI)
    expect(angle).toBeCloseTo(initialAngle + Math.PI, 12)
  })

  it('sends an already canonical angle through one strict full-turn stop', () => {
    // Arrange
    const initialAngle = V2_PLATTER_TURN_RADIANS

    // Act
    const motion = createV2PlatterStopMotion(initialAngle)

    // Assert
    expect(motion.endpointAngleRad).toBe(2 * V2_PLATTER_TURN_RADIANS)
    expect(motion.distanceRad).toBe(V2_PLATTER_TURN_RADIANS)
    expect(motion.durationSeconds).toBeCloseTo(4, 12)
    expect(motion.angularAccelerationRadPerSecondSquared).toBeCloseTo(
      -Math.PI / 4,
      12,
    )
  })

  it('derives duration and deceleration from the remaining canonical distance', () => {
    // Arrange
    const initialAngle = (5 * Math.PI) / 2

    // Act
    const motion = createV2PlatterStopMotion(initialAngle)

    // Assert
    expect(motion.endpointAngleRad).toBe(4 * Math.PI)
    expect(motion.distanceRad).toBeCloseTo((3 * Math.PI) / 2, 12)
    expect(motion.durationSeconds).toBeCloseTo(3, 12)
    expect(motion.angularAccelerationRadPerSecondSquared).toBeCloseTo(
      -Math.PI / 3,
      12,
    )
  })

  it('does not mistake a floating-point near-endpoint for a useful stop', () => {
    // Arrange
    const initialAngle =
      V2_PLATTER_TURN_RADIANS - V2_PLATTER_CANONICAL_EPSILON_RAD / 2

    // Act
    const motion = createV2PlatterStopMotion(initialAngle)

    // Assert
    expect(motion.endpointAngleRad).toBe(2 * V2_PLATTER_TURN_RADIANS)
    expect(motion.distanceRad).toBeGreaterThan(
      V2_PLATTER_TURN_RADIANS - V2_PLATTER_CANONICAL_EPSILON_RAD,
    )
  })

  it('moves monotonically without reversing before the exact endpoint', () => {
    // Arrange
    const motion = createV2PlatterStopMotion(Math.PI / 3)
    const fractions = [0, 0.2, 0.4, 0.6, 0.8, 0.999]

    // Act
    const samples = fractions.map((fraction) =>
      sampleV2PlatterStopMotion(motion, motion.durationSeconds * fraction),
    )

    // Assert
    for (let index = 1; index < samples.length; index += 1) {
      const previous = samples[index - 1]
      const current = samples[index]
      expect(current?.angleRad).toBeGreaterThan(previous?.angleRad ?? 0)
    }
    for (const sample of samples) {
      expect(sample.angularVelocityRadPerSecond).toBeGreaterThan(0)
      expect(sample.angleRad).toBeLessThan(motion.endpointAngleRad)
      expect(sample.completed).toBe(false)
    }
  })

  it('clamps late samples onto the canonical endpoint with zero velocity', () => {
    // Arrange
    const motion = createV2PlatterStopMotion(Math.PI)

    // Act
    const sample = sampleV2PlatterStopMotion(
      motion,
      motion.durationSeconds + 20,
    )

    // Assert
    expect(sample).toEqual({
      angleRad: V2_PLATTER_TURN_RADIANS,
      angularVelocityRadPerSecond: 0,
      completed: true,
    })
  })

  it('rejects invalid clocks before they can corrupt the visual state', () => {
    // Arrange
    const motion = createV2PlatterStopMotion(0)

    // Act
    const negativeAdvance = () => advanceV2PlatterSpinAngle(0, -0.01)
    const infiniteSample = () =>
      sampleV2PlatterStopMotion(motion, Number.POSITIVE_INFINITY)

    // Assert
    expect(negativeAdvance).toThrow('elapsedSeconds must not be negative.')
    expect(infiniteSample).toThrow('elapsedSeconds must be finite.')
  })
})
