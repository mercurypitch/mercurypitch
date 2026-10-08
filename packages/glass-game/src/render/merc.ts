// ============================================================
// Adventure Merc — the original skinned mascot, anchored to gameplay feet.
// ============================================================
// Adapted from BesideCue's games/glass3d/render/merc.ts. This package owns
// its loader and resources; it never imports either application's internals.

import type { AnimationAction } from 'three'
import { AnimationMixer, Group, LoopOnce, LoopRepeat, Vector3 } from 'three'
import type { BreakableSnapshot, PlayerState } from '../contracts'
import { MOVEMENT } from '../core/movement'
import { stepAngularResponse } from './angular-response'
import { loadMercModel } from './merc-model'
import { createMercPresentationPose } from './merc-presentation-pose'
import { createMercSlidePose } from './merc-slide-pose'
import { createSkinnedPosePublisher } from './skinned-pose'

const MAXIMUM_TURN_RADIANS_PER_SECOND = 6
const MAXIMUM_TURN_ACCELERATION = 72
const MAXIMUM_TURN_CATCH_UP_SECONDS = 0.25
const TURN_RESPONSE_SLICE_SECONDS = 0.05
const MINIMUM_MOVE_TIME_SCALE = 0.35
const MAXIMUM_MOVE_TIME_SCALE = 2.4

/** Narrow presentation contract shared by gallery and runner; no game-state casting. */
export interface AdventureMercSnapshot {
  readonly player: Pick<
    PlayerState,
    'position' | 'velocity' | 'grounded' | 'facingYaw'
  >
  readonly elapsedSeconds: number
  readonly breakables: readonly Pick<BreakableSnapshot, 'phase'>[]
}

export interface AdventureMercPresentation {
  /** Audio-clock narration envelope, distinct from the player's microphone. */
  narrationLevel?: number
  /** Driven by physical stance, never inferred from an animation or button. */
  slide?: { readonly progress: number; readonly heightRatio: number }
  /** Render-only root yaw toward the active exhibit. */
  facingYaw?: number | null
  /** Presentation clock, independent of a voice-paused simulation. */
  turnDeltaSeconds?: number
}

export interface AdventureMercLoadOptions {
  /** Render-only initial root yaw, before any presentation or simulation tick. */
  readonly initialFacingYaw?: number
}

export function mercMoveTimeScale(horizontalSpeed: number): number {
  const speed =
    Number.isFinite(horizontalSpeed) && horizontalSpeed > 0
      ? horizontalSpeed
      : MOVEMENT.speed
  return Math.max(
    MINIMUM_MOVE_TIME_SCALE,
    Math.min(MAXIMUM_MOVE_TIME_SCALE, speed / MOVEMENT.speed),
  )
}

export async function loadAdventureMerc(
  url: string,
  options: AdventureMercLoadOptions = {},
) {
  const asset = await loadMercModel(url, { castShadows: true })
  const body = asset.body
  const bounds = asset.bounds
  const height = bounds.getSize(new Vector3()).y
  const scale = 0.55 / Math.max(height, 0.001)
  // Merc's relaxed hands hang below the droplet body. Anchor the complete
  // visible rig so no grounded clip sends those hands through the floor.
  const visualGroundY = bounds.min.y
  const root = new Group()
  root.name = 'adventure-merc'
  const initialFacingYaw = options.initialFacingYaw ?? 0
  if (Number.isFinite(initialFacingYaw)) root.rotation.y = initialFacingYaw
  root.add(body)
  const publishPose = createSkinnedPosePublisher(root)
  const mixer = new AnimationMixer(body)
  const presentationPose = createMercPresentationPose(body)
  const slidePose = createMercSlidePose(body)
  const clips = new Map(asset.animations.map((clip) => [clip.name, clip]))
  let current: AnimationAction | undefined
  let clipName = ''
  let wasGrounded = true
  let squash = 0
  let celebrateUntil = 0
  let completed = 0
  let disposed = false
  const facingResponse = { angle: root.rotation.y, velocity: 0 }
  const play = (name: string, still: boolean, timeScale = 1) => {
    const clip = clips.get(name)
    if (!clip) return
    if (name !== clipName) {
      const previous = current
      current = mixer
        .clipAction(clip)
        .reset()
        .setLoop(name === 'celebrate' ? LoopOnce : LoopRepeat, Infinity)
        .play()
      current.clampWhenFinished = true
      if (previous) current.crossFadeFrom(previous, 0.16, false)
      clipName = name
    }
    if (current) current.timeScale = still ? 0 : timeScale
  }
  return {
    root,
    update(
      snapshot: AdventureMercSnapshot,
      dt: number,
      reducedMotion: boolean,
      presentation: AdventureMercPresentation = {},
    ) {
      if (disposed) return
      slidePose.restore()
      presentationPose.restoreMixerPose()
      const player = snapshot.player
      let count = 0
      let active = false
      for (const item of snapshot.breakables) {
        if (item.phase === 'complete') count++
        else if (item.phase === 'charging' || item.phase === 'listening')
          active = true
      }
      if (count > completed) celebrateUntil = snapshot.elapsedSeconds + 1.15
      completed = count
      const horizontalSpeed = Math.hypot(player.velocity.x, player.velocity.z)
      const moving = horizontalSpeed > 0.08
      // The authored fall clip topples into a puddle. Normal airborne travel
      // keeps the upright pose; physics and stretch carry the jump.
      const slideProgress = Math.max(
        0,
        Math.min(1, presentation.slide?.progress ?? 0),
      )
      const name =
        slideProgress > 0
          ? 'listen'
          : snapshot.elapsedSeconds < celebrateUntil
            ? 'celebrate'
            : !player.grounded
              ? 'listen'
              : active
                ? 'sing'
                : moving
                  ? 'move'
                  : 'listen'
      play(
        name,
        reducedMotion && !moving && !active,
        name === 'move' ? mercMoveTimeScale(horizontalSpeed) : 1,
      )
      const animationDt = Number.isFinite(dt) ? Math.max(0, dt) : 0
      mixer.update(animationDt)
      presentationPose.applyAfterMixer(
        animationDt,
        presentation.narrationLevel,
        name === 'listen' && player.grounded,
        reducedMotion,
      )
      slidePose.apply(slideProgress)
      if (player.grounded && !wasGrounded) squash = 0.18
      wasGrounded = player.grounded
      squash *= Math.exp(-13 * animationDt)
      const stretch = reducedMotion ? 1 : player.grounded ? 1 - squash : 1.07
      const slideStretch =
        slideProgress > 0
          ? Math.min(
              stretch,
              (presentation.slide?.heightRatio ?? 1) *
                (1 - Math.min(0.15, slideProgress * 0.3)),
            )
          : stretch
      body.scale.set(
        scale / Math.sqrt(stretch),
        scale * slideStretch,
        scale / Math.sqrt(stretch),
      )
      body.position.y = -visualGroundY * scale * slideStretch + 0.015
      root.position.copy(player.position)
      const desiredYaw = presentation.facingYaw ?? player.facingYaw + Math.PI
      const requestedTurnDt = presentation.turnDeltaSeconds ?? dt
      let remainingTurnSeconds = Number.isFinite(requestedTurnDt)
        ? Math.max(0, Math.min(MAXIMUM_TURN_CATCH_UP_SECONDS, requestedTurnDt))
        : 0
      while (remainingTurnSeconds > 1e-9) {
        const slice = Math.min(
          remainingTurnSeconds,
          TURN_RESPONSE_SLICE_SECONDS,
        )
        const settled = stepAngularResponse(facingResponse, desiredYaw, slice, {
          maximumSpeed: MAXIMUM_TURN_RADIANS_PER_SECOND,
          maximumAcceleration: MAXIMUM_TURN_ACCELERATION,
        })
        remainingTurnSeconds -= slice
        if (settled) break
      }
      root.rotation.y = facingResponse.angle
      publishPose()
    },
    dispose() {
      if (disposed) return
      disposed = true
      slidePose.restore()
      presentationPose.restoreMixerPose()
      mixer.stopAllAction()
      mixer.uncacheRoot(body)
      root.removeFromParent()
      root.remove(body)
      asset.dispose()
    },
  }
}
