// Local court controls compile real factory geometry; these do not certify an entire generated course.
import { describe, expect, it } from 'vitest'
import { CLOUDWAY_STUDIO_PROFILES } from '../authoring/cloudway-studio'
import { compileEncounter } from '../authoring/compile-cloudway-encounters'
import { compilePlatform } from '../authoring/compile-cloudway-platforms'
import { createVocalSanctuaryChunk } from '../authoring/procedural/chunk-library'
import { transformPoint, transformYaw } from '../authoring/transform'
import type { GlassGame, PlatformRenderQuarterTurns, Vec3 } from '../contracts'
import { createGlassGame } from '../core/game'
import { proveBarrierSecurity } from './sequence-break-prover'
import { testLevel } from './solver.test-fixtures'
import { verifyMovementRoute } from './trajectory-stepper'

function court(
  profileId: 'frosted-scroll-wall' | 'frost-gold-arch-breakwall-a',
  turn: 'none' | 'east' | 'west',
  quarterTurns: PlatformRenderQuarterTurns,
) {
  const chunk = createVocalSanctuaryChunk('probe', 'home', turn, {
    barrierProfileId: profileId,
  })
  const placement = {
    translate: { x: 0, y: 0, z: 0 },
    yawQuarterTurns: quarterTurns,
  }
  const transformed = (point: Vec3) => transformPoint(point, placement)
  const platforms = chunk.platforms.map(
    (p) =>
      compilePlatform(
        {
          id: p.localId,
          profileId: p.profileId,
          center: transformed(p.center),
          quarterTurns,
        },
        CLOUDWAY_STUDIO_PROFILES,
        'probe.platform',
      ).definition,
  )
  const source = chunk.encounters?.[0]
  if (source === undefined)
    throw new Error('Court fixture requires its real gate encounter.')
  const gate = compileEncounter(
    {
      id: source.localId,
      label: source.label,
      variant: source.variant,
      position: transformed(source.position),
      anchor: transformed(source.anchor),
      optional: false,
      challengeProfileId: 'comfortable-hold',
      presentation: {
        kind: 'barrier',
        profileId: source.presentationBarrier!.profileId,
        facingYaw: transformYaw(
          source.presentationBarrier!.facingYaw,
          quarterTurns,
        ),
      },
    },
    CLOUDWAY_STUDIO_PROFILES,
    'probe.gate',
  )
  const level = testLevel({
    id: `court-${profileId}-${turn}-${quarterTurns}`,
    spawn: { position: gate.definition.anchor, facingYaw: 0 },
    platforms,
    solids: gate.solids,
    breakables: [gate.definition],
    movement: {
      walkSpeed: 1.65,
      runSpeed: 2.6,
      runDelaySeconds: 0.65,
      runRampSeconds: 0.85,
    },
    exit: {
      minX: 50,
      maxX: 51,
      minZ: 50,
      maxZ: 51,
      top: 0,
      requiresCompleted: [gate.definition.id],
    },
  })
  return {
    level,
    gate: gate.definition,
    forward: transformed({ x: 0, y: 0, z: 1 }),
    transformed,
    exit: transformed(chunk.exitSocket.position),
  }
}

function steerTo(
  game: GlassGame,
  target: Parameters<typeof verifyMovementRoute>[2][number],
): boolean {
  for (let tick = 0; tick < 360; tick++) {
    const position = game.snapshot().player.position
    const dx = target.anchor.x - position.x
    const dz = target.anchor.z - position.z
    const length = Math.hypot(dx, dz)
    const result = verifyMovementRoute(
      game,
      [
        {
          moveX: dx / Math.max(length, 0.3),
          moveZ: dz / Math.max(length, 0.3),
          jumpDown: false,
        },
      ],
      [target],
    )
    if (result.fell) return false
    if (result.status === 'reached') return true
  }
  return false
}

const cases = (
  ['frosted-scroll-wall', 'frost-gold-arch-breakwall-a'] as const
).flatMap((profile) =>
  (['none', 'east', 'west'] as const).flatMap((turn) =>
    ([0, 1, 2, 3] as const).map((quarterTurns) => ({
      profile,
      turn,
      quarterTurns,
    })),
  ),
)

describe('compiled sanctuary gate controls', () => {
  it.each(cases)(
    '$profile / $turn / quarter turn $quarterTurns has closed walking/jump samples and an open route',
    ({ profile, turn, quarterTurns }) => {
      const { level, gate, forward, transformed, exit } = court(
        profile,
        turn,
        quarterTurns,
      )
      const closed = proveBarrierSecurity(
        level,
        gate.id,
        level.spawn.position,
        {
          angleSpreadDeg: 45,
          coyoteWindowTicks: 4,
          maxTrajectoryTicks: 600,
          direction: forward,
        },
      )
      expect(closed.status).toBe('inconclusive')
      expect(closed.reachedBoundaryTrajectoriesCount).toBeGreaterThan(0)
      expect(closed.exploitWitnessSequence).toBeUndefined()
      // Both side exits now lie beyond the intact gate; the former turn-before-gate escape fails this check.
      expect(exit.x * forward.x + exit.z * forward.z).toBeGreaterThan(
        gate.position.x * forward.x + gate.position.z * forward.z + 0.5,
      )
      const progress = {
        version: 2,
        levelId: level.id,
        checkpointId: '',
        completedBreakableIds: [gate.id],
      }
      const game = createGlassGame(level, progress)
      const far = {
        id: 'far-court',
        label: 'Far court',
        kind: 'position' as const,
        anchor: transformed({ x: 0, y: 0, z: 6.84 }),
        interactionRadius: 0.05,
      }
      const walk = Array.from({ length: 600 }, () => ({
        moveX: forward.x,
        moveZ: forward.z,
        jumpDown: false,
      }))
      expect(verifyMovementRoute(game, walk, [far]).status).toBe('reached')
      if (turn !== 'none') {
        const turnGoal = {
          ...far,
          id: 'side-exit',
          anchor: transformed({
            x: turn === 'east' ? 1.3 : -1.3,
            y: 0,
            z: 6.84,
          }),
          interactionRadius: 0.1,
        }
        expect(steerTo(game, turnGoal)).toBe(true)
      }
    },
  )
})
