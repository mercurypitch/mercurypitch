// ============================================================
// Floating stick policy — stable-origin radial dead zone and fine-control remap.
// ============================================================

export const FLOATING_STICK_TRAVEL_PX = 42
export const FLOATING_STICK_DEAD_ZONE_FRACTION = 0.15
const FLOATING_STICK_RESPONSE_EXPONENT = 1.35

export interface FloatingStickPoint {
  x: number
  y: number
}

export interface FloatingStickSample {
  inputX: number
  inputY: number
  offsetX: number
  offsetY: number
}

/**
 * The contact origin stays fixed for the whole gesture. The remap begins at
 * zero outside a radial dead zone and reaches full input at the visual throw.
 */
export function sampleFloatingStick(
  origin: FloatingStickPoint,
  contact: FloatingStickPoint,
): FloatingStickSample {
  const deltaX = contact.x - origin.x
  const deltaY = contact.y - origin.y
  const distance = Math.hypot(deltaX, deltaY)
  if (distance === 0) return { inputX: 0, inputY: 0, offsetX: 0, offsetY: 0 }

  const directionX = deltaX / distance
  const directionY = deltaY / distance
  const clampedDistance = Math.min(distance, FLOATING_STICK_TRAVEL_PX)
  const deadZonePx =
    FLOATING_STICK_TRAVEL_PX * FLOATING_STICK_DEAD_ZONE_FRACTION
  const distanceOutsideDeadZone = Math.max(0, clampedDistance - deadZonePx)
  const activeTravel = FLOATING_STICK_TRAVEL_PX - deadZonePx
  const magnitude = Math.pow(
    distanceOutsideDeadZone / activeTravel,
    FLOATING_STICK_RESPONSE_EXPONENT,
  )

  return {
    inputX: directionX * magnitude,
    inputY: directionY * magnitude,
    offsetX: directionX * clampedDistance,
    offsetY: directionY * clampedDistance,
  }
}
