// Camera heading intent — distinguish steady steering from a deliberate sustained lateral turn.

import type { MovementReferenceKind } from '../contracts'
import { shortestAngleDelta } from './angular-response'

const LATERAL_FOLLOW_DWELL_SECONDS = 0.4
const STICK_COMMIT_SECONDS = 0.4
const LATERAL_HEADING_MINIMUM = Math.PI / 3
const LATERAL_HEADING_MAXIMUM = (Math.PI * 2) / 3

export interface CameraHeadingIntentSample {
  elapsedSeconds: number
  facingYaw: number
  movementActive: boolean
  movementReferenceYaw: number
  moving: boolean
}

/**
 * Direct camera integrations retain immediate heading follow. A movement-basis
 * rebase marks a real player direction change: forward-biased key chords then
 * act as steering. Stick contact keeps the view fixed for the complete held
 * gesture; only its final direction becomes eligible after a sustained gesture
 * ends, so a continuously steered thumb cannot make the camera autocircle.
 */
export function createCameraHeadingIntent() {
  let mode: 'immediate' | 'keyboard' | 'stick' | 'confirmed' | 'settled' =
    'immediate'
  let lateralSeconds = 0
  let stickSeconds = 0
  let stickHeading: number | null = null

  return {
    rebase(kind: MovementReferenceKind) {
      mode = kind
      lateralSeconds = 0
      stickSeconds = 0
      stickHeading = null
    },
    reset() {
      mode = 'immediate'
      lateralSeconds = 0
      stickSeconds = 0
      stickHeading = null
    },
    target(sample: CameraHeadingIntentSample): number | null {
      if (mode === 'stick') {
        if (sample.movementActive) {
          if (sample.moving) {
            stickSeconds += sample.elapsedSeconds
            stickHeading = sample.facingYaw
          }
          return null
        }
        mode = 'settled'
        if (stickSeconds < STICK_COMMIT_SECONDS) return null
        return stickHeading
      }
      if (!sample.movementActive || !sample.moving) return null
      if (mode === 'immediate' || mode === 'confirmed') return sample.facingYaw

      if (mode === 'settled') return null

      const offset = Math.abs(
        shortestAngleDelta(sample.movementReferenceYaw, sample.facingYaw),
      )
      if (
        offset >= LATERAL_HEADING_MINIMUM &&
        offset <= LATERAL_HEADING_MAXIMUM
      )
        lateralSeconds += sample.elapsedSeconds
      else lateralSeconds = 0

      if (lateralSeconds < LATERAL_FOLLOW_DWELL_SECONDS) return null
      mode = 'confirmed'
      return sample.facingYaw
    },
  }
}
