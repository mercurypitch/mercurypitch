// The Celestial Promenade tests — level composition, atmospheric fog, kinematic clearance, and solver reachability.

import { describe, expect, it } from 'vitest'
import { BREAKABLE_INTERACTION_RADIUS } from '../core/exhibit-interaction'
import { createGlassGame } from '../core/game'
import { resolveMelodyAttempt } from '../core/melody-attempt'
import { proveReachability } from '../solver/reachability-prover'
import { replayTrajectory } from '../solver/trajectory-stepper'
import { CLOUDWAY_PRISMATIC_CAUSEWAY } from './cloudway-prismatic-causeway'

const level = CLOUDWAY_PRISMATIC_CAUSEWAY

describe('The Celestial Promenade course definition', () => {
  it('compiles with expected structural entities, optional alcove discovery, and lesson linkage', () => {
    expect(level.id).toBe('cloudway-prismatic-causeway')
    expect(level.title).toBe('The Celestial Promenade')
    expect(level.platforms.length).toBe(41)
    expect(level.breakables.length).toBe(5)
    expect(level.checkpoints.length).toBe(4)
    expect(level.spawn.checkpointId).toBe('prisma-save-arrival')

    expect(level.melodyLesson).toBeDefined()
    expect(level.melodyLesson?.id).toBe('prismatic-arc-v1')
    expect(level.melodyLesson?.stations.length).toBe(3)
    expect(level.melodyLesson?.finaleEncounterId).toBe('prisma-portrait-finale')

    const optionalGoblet = level.breakables.find(
      (b) => b.id === 'prisma-goblet-alcove',
    )
    expect(optionalGoblet).toBeDefined()
    expect(optionalGoblet?.optional).toBe(true)
    expect(level.rewards?.discoveries).toEqual([
      {
        encounterId: 'prisma-goblet-alcove',
        coinIds: ['prisma-coin-starlight-goblet'],
      },
    ])
  })

  it('incorporates atmospheric linear fog and living crystal interior', () => {
    expect(level.presentation?.fog).toBeDefined()
    expect(level.presentation?.fog?.kind).toBe('linear')
    expect(level.presentation?.fog?.nearMeters).toBe(8)
    expect(level.presentation?.fog?.farMeters).toBe(24)

    expect(level.presentation?.crystalInteriors).toBeDefined()
    const interior = level.presentation?.crystalInteriors?.[0]
    expect(interior?.platformId).toBe('prisma-court-scroll')
    expect(interior?.preset).toBe('aurora-heart')
  })

  it('incorporates all diverse platform behaviors with exact kinematic properties', () => {
    const platformsById = new Map(level.platforms.map((p) => [p.id, p]))

    // Frost ice footing
    const frostLily = platformsById.get('prisma-frost-lily')
    expect(frostLily).toBeDefined()
    expect(frostLily?.surface?.kind).toBe('frost')

    // Hexagonal crackle stepping stones
    const hexStep1 = platformsById.get('prisma-hex-1')
    expect(hexStep1).toBeDefined()
    expect(hexStep1?.behavior?.kind).toBe('crackle')
    if (hexStep1?.behavior?.kind === 'crackle') {
      expect(hexStep1.behavior.warningSeconds).toBe(1.5)
    }

    const hexStep2 = platformsById.get('prisma-hex-2')
    expect(hexStep2).toBeDefined()
    expect(hexStep2?.behavior?.kind).toBe('crackle')

    // Scroll extending bridge
    const scrollPlatform = platformsById.get('prisma-court-scroll')
    expect(scrollPlatform).toBeDefined()
    expect(scrollPlatform?.behavior?.kind).toBe('scroll')

    // Aurora glide moving raft (exact translation across X without collision)
    const glidePlatform = platformsById.get('prisma-step-glide')
    expect(glidePlatform).toBeDefined()
    expect(glidePlatform?.behavior?.kind).toBe('glide')
    if (glidePlatform?.behavior?.kind === 'glide') {
      expect(glidePlatform.behavior.translation.x).toBeCloseTo(2.4, 1)
      expect(glidePlatform.behavior.translation.z).toBeCloseTo(0, 1)
    }
  })

  it('proves collision-free clearance for the aurora glide ferry', () => {
    const platformsById = new Map(level.platforms.map((p) => [p.id, p]))
    const launch = platformsById.get('prisma-launch-3')!
    const glide = platformsById.get('prisma-step-glide')!
    const catchDeck = platformsById.get('prisma-catch-1')!

    // Gap at rest: between launch deck and raft departure edge
    const gapAtRest = glide.minX - launch.maxX
    expect(gapAtRest).toBeCloseTo(0.55, 2)

    // At destination: translation by 2.4m
    const translationX =
      glide.behavior?.kind === 'glide' ? glide.behavior.translation.x : 0
    const raftMaxXAtDestination = glide.maxX + translationX
    const gapAtDestination = catchDeck.minX - raftMaxXAtDestination
    expect(gapAtDestination).toBeCloseTo(0.55, 2)
  })

  it('leaves at least two meters between singing anchors and frosted gates', () => {
    const gates = level.breakables.filter(
      (b) => b.presentation?.kind === 'barrier',
    )
    expect(gates.length).toBe(2)

    for (const gate of gates) {
      const distance = Math.hypot(
        gate.position.x - gate.anchor.x,
        gate.position.z - gate.anchor.z,
      )
      // Must have at least 2.0 meters of open marble between singing anchor and gate
      expect(distance).toBeGreaterThanOrEqual(2.0)
    }
  })

  it('maintains strict checkpoint dependency gates matching course progression', () => {
    const checkpointsById = new Map(level.checkpoints.map((c) => [c.id, c]))

    const arrival = checkpointsById.get('prisma-save-arrival')
    expect(arrival).toBeDefined()
    expect(arrival?.requiresCompleted).toBeUndefined()

    const court = checkpointsById.get('prisma-save-court')
    expect(court).toBeDefined()
    expect(court?.requiresCompleted).toEqual(['prisma-note-home'])

    const launch = checkpointsById.get('prisma-save-launch')
    expect(launch).toBeDefined()
    expect(launch?.requiresCompleted).toEqual(['prisma-gate-rise'])

    const pavilion = checkpointsById.get('prisma-save-pavilion')
    expect(pavilion).toBeDefined()
    expect(pavilion?.requiresCompleted).toEqual(['prisma-gate-rise'])
  })

  it('proves that the arrival note (The Opal Resonator) is reachable from spawn', () => {
    const note = level.breakables.find((b) => b.id === 'prisma-note-home')
    expect(note).toBeDefined()

    const proof = proveReachability(
      level,
      {
        id: note!.id,
        label: note!.label,
        anchor: note!.anchor,
        interactionRadius: BREAKABLE_INTERACTION_RADIUS,
      },
      {
        maxFrontierExpansions: 2000,
        macroTickDuration: 12,
      },
    )

    expect(proof.reachable).toBe(true)
    expect(proof.elapsedSeconds).toBeDefined()
    expect(proof.elapsedSeconds!).toBeGreaterThanOrEqual(0)
    expect(proof.witnessInputSequence).toBeDefined()
  })

  // These are saved-checkpoint legs, not continuous proof of the intervening
  // crackle, scroll and ferry route. The runtime must accept every saved prerequisite.
  it.each([
    [
      'rise gate',
      'prisma-gate-rise',
      'prisma-save-court',
      ['prisma-note-home'],
    ],
    [
      'return gate',
      'prisma-gate-return',
      'prisma-save-pavilion',
      ['prisma-note-home', 'prisma-gate-rise'],
    ],
    [
      'finale portrait',
      'prisma-portrait-finale',
      'prisma-save-pavilion',
      ['prisma-note-home', 'prisma-gate-rise', 'prisma-gate-return'],
    ],
  ] as const)(
    'replays a local saved-checkpoint leg to the %s',
    (_label, targetId, checkpointId, completedBreakableIds) => {
      const target = level.breakables.find(
        (candidate) => candidate.id === targetId,
      )!
      const checkpoint = level.checkpoints.find(
        (candidate) => candidate.id === checkpointId,
      )!
      const savedProgress = {
        version: 3,
        levelId: level.id,
        checkpointId,
        completedBreakableIds: [...completedBreakableIds],
        melodyAttempt: resolveMelodyAttempt(level, {
          attemptId: 'checkpoint-leg',
          comfortableMidi: 60,
        }).identity,
      }
      const initial = createGlassGame(level, savedProgress).snapshot()
      expect(initial.player.position).toEqual(checkpoint.position)
      expect(initial.completedBreakableIds).toEqual([...completedBreakableIds])
      const proof = proveReachability(
        level,
        { ...target, interactionRadius: BREAKABLE_INTERACTION_RADIUS },
        {
          savedProgress,
          maxFrontierExpansions: 2000,
          macroTickDuration: 12,
        },
      )
      expect(proof.status, proof.reason).toBe('reachable')
      expect(proof.witnessInputSequence).toBeDefined()
      const replay = replayTrajectory(
        level,
        savedProgress,
        proof.witnessInputSequence!,
      )
      expect(replay.fell).toBe(false)
      expect(replay.game.beginEncounter(targetId)).toBe(true)
    },
  )
})
