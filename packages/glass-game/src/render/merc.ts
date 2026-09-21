// ============================================================
// Adventure Merc — the original skinned mascot, anchored to gameplay feet.
// ============================================================
// Adapted from BesideCue's games/glass3d/render/merc.ts. This package owns
// its loader and resources; it never imports either application's internals.

import type { AnimationAction } from 'three'
import { AnimationMixer, Group, LoopOnce, LoopRepeat, Vector3 } from 'three'
import type { GameSnapshot } from '../contracts'
import { MOVEMENT } from '../core/movement'
import { loadMercModel } from './merc-model'

const TURN_RESPONSE = 10
const MAXIMUM_TURN_RADIANS_PER_SECOND = 6
const MINIMUM_MOVE_TIME_SCALE = 0.35
const MAXIMUM_MOVE_TIME_SCALE = 2.4

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
    update(snapshot: GameSnapshot, dt: number, reducedMotion: boolean) {
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
      const desiredYaw = player.facingYaw + Math.PI
      const angle = Math.atan2(
        Math.sin(desiredYaw - root.rotation.y),
        Math.cos(desiredYaw - root.rotation.y),
      )
      const turnDt = Number.isFinite(dt) ? Math.max(0, Math.min(0.05, dt)) : 0
      const blended = angle * (1 - Math.exp(-TURN_RESPONSE * turnDt))
      const maximumStep = MAXIMUM_TURN_RADIANS_PER_SECOND * turnDt
      root.rotation.y += Math.max(-maximumStep, Math.min(maximumStep, blended))
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
