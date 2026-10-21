// Moving chunk fixtures — real input-only traversal from the authored entry floor.
import type { MovementInput, PlatformDefinition } from '../../contracts'
import { createGlassGame } from '../../core/game'
import { MOVEMENT } from '../../core/movement'
import { platformBoundsAtRuntime } from '../../core/platform-runtime'
import { testLevel } from '../../solver/solver.test-fixtures'
import { compileAssembledPlatform } from './chunk-envelopes'
import type { ProceduralChunk } from './contracts'

export function movingChunkFixture(chunk: ProceduralChunk) {
  const platforms = chunk.platforms.map(
    (platform) =>
      compileAssembledPlatform({
        ...platform,
        id: platform.localId,
        quarterTurns: platform.quarterTurns ?? 0,
      }).definition,
  )
  const level = testLevel({
    id: chunk.id,
    spawn: { position: { ...chunk.platforms[0].center }, facingYaw: 0 },
    platforms,
    breakables: [],
    movement: {
      walkSpeed: 1.65,
      runSpeed: 2.6,
      runDelaySeconds: 0.65,
      runRampSeconds: 0.85,
    },
  })
  const game = createGlassGame(level)
  const inputs: MovementInput[] = []
  const landings: { id: string; at: number }[] = []
  let previousSupport: string | null = null

  function step(moveX = 0, moveZ = 0, jumpDown = false) {
    const input = { moveX, moveZ, jumpDown }
    inputs.push(input)
    const events = game.step(input, MOVEMENT.fixedStep)
    if (events.some((event) => event.type === 'respawn'))
      throw new Error(`Traversal respawned at tick ${inputs.length}.`)
    const snapshot = game.snapshot()
    const support = snapshot.player.supportPlatformId ?? null
    if (support !== null && support !== previousSupport)
      landings.push({ id: support, at: snapshot.elapsedSeconds })
    previousSupport = support
    return snapshot
  }

  function live(platform: PlatformDefinition) {
    return platformBoundsAtRuntime(
      platform,
      game.snapshot().platformStates?.find((state) => state.id === platform.id),
    )
  }

  function waitFor(predicate: () => boolean, maxTicks = 2400) {
    for (let tick = 0; tick < maxTicks; tick++) {
      if (predicate()) return
      step()
    }
    throw new Error('Traversal exceeded its bounded wait.')
  }

  function waitSeconds(seconds: number) {
    const until = game.snapshot().elapsedSeconds + seconds
    waitFor(() => game.snapshot().elapsedSeconds >= until)
  }

  // Dynamic goals are platform-relative. A fixed world-space target would walk
  // backwards off a departing ferry, rather than test standing on that ferry.
  function walkTo(goal: () => { x: number; z: number }, maxTicks = 600) {
    for (let tick = 0; tick < maxTicks; tick++) {
      const { position, velocity } = game.snapshot().player
      const destination = goal()
      const dx = destination.x - position.x
      const dz = destination.z - position.z
      const distance = Math.hypot(dx, dz)
      if (distance < 0.025 && Math.hypot(velocity.x, velocity.z) < 0.12) return
      step(dx / Math.max(distance, 0.22), dz / Math.max(distance, 0.22))
    }
    throw new Error('Traversal exceeded its bounded walk.')
  }

  function walkToFront(platform: PlatformDefinition, inset = 0.05) {
    walkTo(() => {
      const bounds = live(platform)
      return { x: (bounds.minX + bounds.maxX) / 2, z: bounds.maxZ - inset }
    })
  }

  function runToFront(platform: PlatformDefinition, inset = 0.15) {
    for (let tick = 0; tick < 600; tick++) {
      const bounds = live(platform)
      const position = game.snapshot().player.position
      const dx = (bounds.minX + bounds.maxX) / 2 - position.x
      const dz = bounds.maxZ - inset - position.z
      if (dz <= 0.025) return
      const distance = Math.hypot(dx, dz)
      step(dx / distance, dz / distance)
    }
    throw new Error('Traversal exceeded its bounded run-up.')
  }

  function jumpTo(platform: PlatformDefinition) {
    let airborne = false
    for (let tick = 0; tick < 180; tick++) {
      const position = game.snapshot().player.position
      const bounds = live(platform)
      const dx = (bounds.minX + bounds.maxX) / 2 - position.x
      const dz = bounds.minZ + 0.25 - position.z
      const distance = Math.hypot(dx, dz)
      const snapshot = step(
        dx / Math.max(distance, 0.3),
        dz / Math.max(distance, 0.3),
        tick === 0,
      )
      if (!snapshot.player.grounded) airborne = true
      if (airborne && snapshot.player.grounded) {
        const support = snapshot.player.supportPlatformId ?? null
        if (
          support !== platform.id &&
          (support === null || !support.startsWith(`${platform.id}::`))
        )
          throw new Error(`Landed on ${support}, expected ${platform.id}.`)
        return
      }
    }
    throw new Error('Traversal exceeded its bounded jump.')
  }

  function waitNearDock(platform: PlatformDefinition) {
    if (platform.behavior?.kind !== 'glide') throw new Error('Expected ferry.')
    const cycle =
      2 * (platform.behavior.travelSeconds + platform.behavior.dwellSeconds)
    // Wait at a safe floor for a fresh near dwell, rather than boarding at the
    // last instant of a dwell. This observes time; it does not reset the clock.
    waitFor(() => game.snapshot().elapsedSeconds % cycle < 0.02)
  }

  function rideToFarDock(platform: PlatformDefinition) {
    if (platform.behavior?.kind !== 'glide') throw new Error('Expected ferry.')
    walkToFront(platform, 0.15)
    const translation = platform.behavior.translation
    waitFor(() => live(platform).maxZ > platform.maxZ + translation.z - 0.01)
  }

  return {
    level,
    game,
    platforms,
    inputs,
    landings,
    step,
    live,
    waitFor,
    waitSeconds,
    walkTo,
    walkToFront,
    runToFront,
    jumpTo,
    waitNearDock,
    rideToFarDock,
  }
}
