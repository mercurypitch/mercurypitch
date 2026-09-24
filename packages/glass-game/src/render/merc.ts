// ============================================================
// Adventure Merc — the original skinned mascot, anchored to gameplay feet.
// ============================================================
// Adapted from BesideCue's games/glass3d/render/merc.ts. This package owns
// its loader and resources; it never imports either application's internals.

import type { AnimationAction } from 'three'
import { AnimationMixer, Group, LoopOnce, LoopRepeat, Vector3 } from 'three'
import type { GameSnapshot } from '../contracts'
import { MOVEMENT } from '../core/movement'
import { stepAngularResponse } from './angular-response'
import { loadMercModel } from './merc-model'

const MAXIMUM_TURN_RADIANS_PER_SECOND = 6
const MAXIMUM_TURN_ACCELERATION = 72
const MINIMUM_MOVE_TIME_SCALE = 0.35
const MAXIMUM_MOVE_TIME_SCALE = 2.4

export interface AdventureMercPresentation {
  /** Render-only root yaw toward the active exhibit. */
  facingYaw?: number | null
  /** Presentation clock, independent of a voice-paused simulation. */
  turnDeltaSeconds?: number
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

export async function loadAdventureMerc(url: string) {
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
  root.add(body)
  const mixer = new AnimationMixer(body)
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
      snapshot: GameSnapshot,
      dt: number,
      reducedMotion: boolean,
      presentation: AdventureMercPresentation = {},
    ) {
      const player = snapshot.player
      const count = snapshot.breakables.filter(
        (item) => item.phase === 'complete',
      ).length
      if (count > completed) celebrateUntil = snapshot.elapsedSeconds + 1.15
      completed = count
      const active = snapshot.breakables.some(
        (item) => item.phase === 'charging' || item.phase === 'listening',
      )
      const horizontalSpeed = Math.hypot(player.velocity.x, player.velocity.z)
      const moving = horizontalSpeed > 0.08
      // The authored fall clip topples into a puddle. Normal airborne travel
      // keeps the upright pose; physics and stretch carry the jump.
      const name =
        snapshot.elapsedSeconds < celebrateUntil
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
      mixer.update(Math.max(0, dt))
      if (player.grounded && !wasGrounded) squash = 0.18
      wasGrounded = player.grounded
      squash *= Math.exp(-13 * dt)
      const stretch = reducedMotion ? 1 : player.grounded ? 1 - squash : 1.07
      body.scale.set(
        scale / Math.sqrt(stretch),
        scale * stretch,
        scale / Math.sqrt(stretch),
      )
      body.position.y = -visualGroundY * scale * stretch + 0.015
      root.position.copy(player.position)
      const desiredYaw = presentation.facingYaw ?? player.facingYaw + Math.PI
      const requestedTurnDt = presentation.turnDeltaSeconds ?? dt
      const turnDt = Number.isFinite(requestedTurnDt)
        ? Math.max(0, Math.min(0.05, requestedTurnDt))
        : 0
      stepAngularResponse(facingResponse, desiredYaw, turnDt, {
        maximumSpeed: MAXIMUM_TURN_RADIANS_PER_SECOND,
        maximumAcceleration: MAXIMUM_TURN_ACCELERATION,
      })
      root.rotation.y = facingResponse.angle
    },
    dispose() {
      if (disposed) return
      disposed = true
      mixer.stopAllAction()
      mixer.uncacheRoot(body)
      root.removeFromParent()
      root.remove(body)
      asset.dispose()
    },
  }
}
