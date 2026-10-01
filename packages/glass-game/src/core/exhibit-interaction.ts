// ============================================================
// Exhibit interaction geometry — one authority for manual reach, visible rings and automatic singing contact.
// ============================================================

import type { Vec3 } from '../contracts'
import { MOVEMENT } from './movement'

/** Manual Sing stays forgiving even when automatic singing uses the visible pad. */
export const BREAKABLE_INTERACTION_RADIUS = 1.1
export const BREAKABLE_INTERACTION_HEIGHT_TOLERANCE = 0.05

export const EXHIBIT_APPROACH_RING_INNER_RADIUS = 0.42
export const EXHIBIT_APPROACH_RING_OUTER_RADIUS = 0.46

/** Merc enters automatic singing when his footprint first touches the ring. */
export const AUTOMATIC_SINGING_CONTACT_RADIUS =
  EXHIBIT_APPROACH_RING_OUTER_RADIUS + MOVEMENT.radius

type HorizontalPoint = Pick<Vec3, 'x' | 'z'>
// Treat one rounding-width at an authored boundary as contact without adding a
// meaningful amount of world-space reach.
const GEOMETRY_EPSILON = Number.EPSILON * 4

function horizontalDistance(a: HorizontalPoint, b: HorizontalPoint): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

export function isWithinBreakableInteractionCircle(
  position: HorizontalPoint,
  anchor: HorizontalPoint,
): boolean {
  return (
    horizontalDistance(position, anchor) <=
    BREAKABLE_INTERACTION_RADIUS + GEOMETRY_EPSILON
  )
}

export function isAtBreakableInteractionElevation(
  position: Pick<Vec3, 'y'>,
  anchor: Pick<Vec3, 'y'>,
): boolean {
  return (
    Math.abs(position.y - anchor.y) < BREAKABLE_INTERACTION_HEIGHT_TOLERANCE
  )
}

export function isWithinAutomaticSingingFootprint(
  position: HorizontalPoint,
  anchor: HorizontalPoint,
): boolean {
  return (
    horizontalDistance(position, anchor) <=
    AUTOMATIC_SINGING_CONTACT_RADIUS + GEOMETRY_EPSILON
  )
}

export function isWithinAutomaticSingingContact(
  position: Pick<Vec3, 'x' | 'y' | 'z'>,
  anchor: Pick<Vec3, 'x' | 'y' | 'z'>,
): boolean {
  return (
    isAtBreakableInteractionElevation(position, anchor) &&
    isWithinAutomaticSingingFootprint(position, anchor)
  )
}
