// Resident exhibit lights — re-aiming moves the same two lights to the exhibit's front without adding or removing any.
import { describe, expect, it } from 'vitest'
import { createResidentExhibitLights, EXHIBIT_KEY_INTENSITY, } from './exhibit-lights'

describe('resident exhibit lights', () => {
  it('keys the exhibit from above its front and aims at its middle', () => {
    const lights = createResidentExhibitLights()
    lights.aim({ x: 2, y: 0.24, z: -3, facingYaw: 0, height: 0.36 })
    expect(lights.key.position.y).toBeCloseTo(2.54)
    expect(lights.key.position.z).toBeGreaterThan(-3)
    expect(lights.key.target.position.x).toBeCloseTo(2)
    expect(lights.key.target.position.y).toBeCloseTo(0.6)
    expect(lights.key.target.position.z).toBeCloseTo(-3)
    expect(lights.key.castShadow).toBe(false)
    expect(lights.glint.castShadow).toBe(false)
  })

  it('turns with the exhibit and dims by weight', () => {
    const lights = createResidentExhibitLights()
    lights.aim({ x: 0, y: 0, z: 0, facingYaw: Math.PI / 2, height: 0.3 }, 0.5)
    expect(lights.key.position.x).toBeGreaterThan(0.8)
    expect(lights.key.intensity).toBe(EXHIBIT_KEY_INTENSITY * 0.5)
    expect(lights.objects).toHaveLength(4)
  })
})
