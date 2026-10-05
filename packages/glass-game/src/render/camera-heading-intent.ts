// Camera heading intent — distinguish steady steering from a deliberate sustained lateral turn.

import type { MovementReferenceKind } from '../contracts'
import { MOVEMENT } from '../core/movement'
import { shortestAngleDelta } from './angular-response'

const LATERAL_FOLLOW_DWELL_SECONDS = 0.4
const STICK_COMMIT_SECONDS = 0.4
const LATERAL_HEADING_MINIMUM = Math.PI / 3
const ENCLOSED_DIAGONAL_HEADING_MINIMUM = Math.PI / 6
const LATERAL_HEADING_MAXIMUM = (Math.PI * 2) / 3

export interface CameraHeadingIntentSample {
  allowForwardDiagonalFollow?: boolean
  /** Reacquire a manually displaced view after any sustained travel heading. */
  reacquireManualView?: boolean
  /** Stable world heading captured from the keyboard contact, before physics. */
  keyboardHeading?: number | null
  /** Post-collision travel heading, used only after it stays corridor-stable. */
  effectiveHeading?: number | null
  /** Actual horizontal player displacement since the previous camera sample. */
  displacementDistance: number
  elapsedSeconds: number
  facingYaw: number
  movementActive: boolean
  movementReferenceYaw: number
  moving: boolean
}

/**
 * Direct camera integrations retain immediate heading follow. A movement-basis
 * rebase marks a real player direction change: forward-biased key chords then
 * act as steering. Stick contact keeps the view fixed in open navigation;
 * framed corridors may adopt a stable post-collision heading while held, and
 * release can commit the final direction without feeding camera yaw into travel.
 */
export function createCameraHeadingIntent() {
  let mode: 'immediate' | 'keyboard' | 'stick' | 'confirmed' | 'settled' =
    'immediate'
  let lateralSeconds = 0
  let stickSeconds = 0
  let stickHeading: number | null = null
  let stickFollowHeading: number | null = null
  let keyboardHeading: number | null = null
  let followingEffectiveHeading = false
  let effectiveHeadingCandidate: number | null = null
  let effectiveHeadingDistance = 0
  let effectiveHeadingSeconds = 0

  const resetEffectiveHeading = (): void => {
    effectiveHeadingCandidate = null
    effectiveHeadingDistance = 0
    effectiveHeadingSeconds = 0
  }

  const confirmEffectiveHeading = (
    sample: CameraHeadingIntentSample,
    effectiveHeading: number,
    confirmFromDisplacement: boolean,
  ): boolean => {
    if (
      effectiveHeadingCandidate === null ||
      Math.abs(
        shortestAngleDelta(effectiveHeadingCandidate, effectiveHeading),
      ) >= ENCLOSED_DIAGONAL_HEADING_MINIMUM
    ) {
      effectiveHeadingCandidate = effectiveHeading
      effectiveHeadingDistance = sample.displacementDistance
      effectiveHeadingSeconds = sample.elapsedSeconds
    } else {
      effectiveHeadingDistance += sample.displacementDistance
      effectiveHeadingSeconds += sample.elapsedSeconds
    }
    // Physics has already removed the blocked axis and turned Merc toward the
    // corridor. One collision footprint of real travel confirms that redirect
    // without making slow devices carry a time-based stale diagonal farther.
    return confirmFromDisplacement
      ? effectiveHeadingDistance >= MOVEMENT.radius
      : effectiveHeadingSeconds >= LATERAL_FOLLOW_DWELL_SECONDS
  }

  return {
    rebase(kind: MovementReferenceKind) {
      mode = kind
      lateralSeconds = 0
      stickSeconds = 0
      stickHeading = null
      stickFollowHeading = null
      keyboardHeading = null
      followingEffectiveHeading = false
      resetEffectiveHeading()
    },
    reset() {
      mode = 'immediate'
      lateralSeconds = 0
      stickSeconds = 0
      stickHeading = null
      stickFollowHeading = null
      keyboardHeading = null
      followingEffectiveHeading = false
      resetEffectiveHeading()
    },
    target(sample: CameraHeadingIntentSample): number | null {
      if (mode === 'stick') {
        if (sample.movementActive) {
          if (sample.moving || sample.reacquireManualView === true) {
            stickSeconds += sample.elapsedSeconds
            stickHeading = sample.facingYaw
          }
          const effectiveHeading =
            sample.allowForwardDiagonalFollow === true &&
            sample.effectiveHeading !== null &&
            sample.effectiveHeading !== undefined &&
            Number.isFinite(sample.effectiveHeading)
              ? sample.effectiveHeading
              : null
          const currentHeading =
            stickFollowHeading ?? sample.movementReferenceYaw
          if (
            effectiveHeading === null ||
            (!followingEffectiveHeading &&
              Math.abs(shortestAngleDelta(currentHeading, effectiveHeading)) <
                ENCLOSED_DIAGONAL_HEADING_MINIMUM)
          ) {
            resetEffectiveHeading()
            return stickFollowHeading
          }
          if (
            confirmEffectiveHeading(
              sample,
              effectiveHeading,
              stickFollowHeading !== null,
            )
          ) {
            stickFollowHeading = effectiveHeading
            followingEffectiveHeading = true
            resetEffectiveHeading()
          }
          return stickFollowHeading
        }
        mode = 'settled'
        if (stickSeconds < STICK_COMMIT_SECONDS) return null
        return stickHeading
      }
      // A brief wall slide can end before the corridor-heading dwell completes.
      // Keep that same dwell for the final blocked facing, so a held chord does
      // not leave Merc permanently diagonal to the view after reaching a corner.
      const blockedHeading =
        mode === 'confirmed' &&
        sample.allowForwardDiagonalFollow === true &&
        sample.reacquireManualView !== true &&
        !sample.moving &&
        Number.isFinite(sample.facingYaw)
          ? sample.facingYaw
          : null
      if (
        !sample.movementActive ||
        (!sample.moving &&
          sample.reacquireManualView !== true &&
          blockedHeading === null)
      )
        return null
      if (mode === 'immediate') return sample.facingYaw

      if (mode === 'confirmed') {
        const currentHeading = keyboardHeading ?? sample.facingYaw
        const effectiveHeading =
          blockedHeading !== null
            ? blockedHeading
            : sample.effectiveHeading !== null &&
                sample.effectiveHeading !== undefined &&
                Number.isFinite(sample.effectiveHeading)
              ? sample.effectiveHeading
              : null
        if (
          sample.allowForwardDiagonalFollow !== true ||
          effectiveHeading === null ||
          (!followingEffectiveHeading &&
            Math.abs(shortestAngleDelta(currentHeading, effectiveHeading)) <
              ENCLOSED_DIAGONAL_HEADING_MINIMUM)
        ) {
          resetEffectiveHeading()
          return currentHeading
        }
        if (
          confirmEffectiveHeading(
            sample,
            effectiveHeading,
            blockedHeading === null,
          )
        ) {
          keyboardHeading = effectiveHeading
          // A render sample can confirm an intermediate heading while Merc
          // accelerates out of a wall slide. Let that physical redirect settle
          // below the initial turn threshold, with the same travel/dwell guard.
          followingEffectiveHeading = true
          resetEffectiveHeading()
        }
        return keyboardHeading ?? currentHeading
      }

      if (mode === 'settled') return null

      const requestedHeading =
        sample.keyboardHeading !== null &&
        sample.keyboardHeading !== undefined &&
        Number.isFinite(sample.keyboardHeading)
          ? sample.keyboardHeading
          : sample.facingYaw
      const offset = Math.abs(
        shortestAngleDelta(sample.movementReferenceYaw, requestedHeading),
      )
      const minimumHeading =
        sample.allowForwardDiagonalFollow === true
          ? ENCLOSED_DIAGONAL_HEADING_MINIMUM
          : LATERAL_HEADING_MINIMUM
      if (
        sample.reacquireManualView === true ||
        (offset >= minimumHeading && offset <= LATERAL_HEADING_MAXIMUM)
      )
        lateralSeconds += sample.elapsedSeconds
      else lateralSeconds = 0

      if (lateralSeconds < LATERAL_FOLLOW_DWELL_SECONDS) return null
      mode = 'confirmed'
      keyboardHeading = requestedHeading
      return keyboardHeading
    },
  }
}
