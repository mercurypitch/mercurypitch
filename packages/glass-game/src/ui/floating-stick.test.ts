// Floating stick policy regression — contact begins neutral and stays continuous through its radial remap.

import { describe, expect, it } from 'vitest'
import { FLOATING_STICK_DEAD_ZONE_FRACTION, FLOATING_STICK_TRAVEL_PX, sampleFloatingStick, } from './floating-stick'

describe('floating stick policy', () => {
  it('begins neutral wherever the contact lands', () => {
    expect(sampleFloatingStick({ x: 137, y: 412 }, { x: 137, y: 412 })).toEqual(
      { inputX: 0, inputY: 0, offsetX: 0, offsetY: 0 },
    )
  })

  it('moves the visible knob inside the dead zone without movement intent', () => {
    const deadZone =
      FLOATING_STICK_TRAVEL_PX * FLOATING_STICK_DEAD_ZONE_FRACTION
    const sample = sampleFloatingStick(
      { x: 0, y: 0 },
      { x: deadZone * 0.6, y: -deadZone * 0.8 },
    )

    expect(sample.inputX).toBe(0)
    expect(sample.inputY).toBe(-0)
    expect(Math.hypot(sample.offsetX, sample.offsetY)).toBeCloseTo(deadZone)
  })

  it('preserves direction while remapping fine control continuously to full input', () => {
    const deadZone =
      FLOATING_STICK_TRAVEL_PX * FLOATING_STICK_DEAD_ZONE_FRACTION
    const near = sampleFloatingStick(
      { x: 0, y: 0 },
      { x: deadZone + 0.01, y: 0 },
    )
    const middle = sampleFloatingStick(
      { x: 0, y: 0 },
      { x: FLOATING_STICK_TRAVEL_PX * 0.6, y: 0 },
    )
    const diagonal = sampleFloatingStick(
      { x: 0, y: 0 },
      {
        x: FLOATING_STICK_TRAVEL_PX,
        y: -FLOATING_STICK_TRAVEL_PX,
      },
    )

    expect(near.inputX).toBeGreaterThan(0)
    expect(near.inputX).toBeLessThan(middle.inputX)
    expect(middle.inputX).toBeLessThan(1)
    expect(Math.hypot(diagonal.inputX, diagonal.inputY)).toBeCloseTo(1)
    expect(diagonal.inputX).toBeCloseTo(-diagonal.inputY)
    expect(Math.hypot(diagonal.offsetX, diagonal.offsetY)).toBeCloseTo(
      FLOATING_STICK_TRAVEL_PX,
    )
  })
})
