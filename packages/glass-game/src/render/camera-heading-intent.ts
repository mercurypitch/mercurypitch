// Camera heading intent — distinguish steady steering from a deliberate sustained lateral turn.

import { shortestAngleDelta } from './angular-response'

const LATERAL_FOLLOW_DWELL_SECONDS = 0.24
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
 * rebase marks a real player direction change: forward-biased chords then act
 * as steering, while a held lateral contact earns follow after a short dwell.
 */
export function createCameraHeadingIntent() {
  let mode: 'immediate' | 'evaluating' | 'confirmed' = 'immediate'
  let lateralSeconds = 0

  return {
    rebase() {
      mode = 'evaluating'
      lateralSeconds = 0
    },
    reset() {
      mode = 'immediate'
      lateralSeconds = 0
    },
    target(sample: CameraHeadingIntentSample): number | null {
      if (!sample.movementActive || !sample.moving) return null
      if (mode === 'immediate' || mode === 'confirmed') return sample.facingYaw

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
