// The Celestial Promenade tests — level composition, atmospheric fog, kinematic clearance, and solver reachability.

import { describe, expect, it } from 'vitest'
import { BREAKABLE_INTERACTION_RADIUS } from '../core/exhibit-interaction'
import { proveReachability } from '../solver/reachability-prover'
import { CLOUDWAY_PRISMATIC_CAUSEWAY } from './cloudway-prismatic-causeway'

const level = CLOUDWAY_PRISMATIC_CAUSEWAY

describe('The Celestial Promenade course definition', () => {
  it('compiles with expected structural entities and lesson linkage', () => {
    expect(level.id).toBe('cloudway-prismatic-causeway')
    expect(level.title).toBe('The Celestial Promenade')
    expect(level.platforms.length).toBe(39)
    expect(level.breakables.length).toBe(4)
    expect(level.checkpoints.length).toBe(4)
    expect(level.spawn.checkpointId).toBe('prisma-save-arrival')

    expect(level.melodyLesson).toBeDefined()
    expect(level.melodyLesson?.id).toBe('prismatic-arc-v1')
    expect(level.melodyLesson?.stations.length).toBe(3)
    expect(level.melodyLesson?.finaleEncounterId).toBe('prisma-portrait-finale')
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
    const translationX = glide.behavior?.kind === 'glide' ? glide.behavior.translation.x : 0
    const raftMaxXAtDestination = glide.maxX + translationX
    const gapAtDestination = catchDeck.minX - raftMaxXAtDestination
    expect(gapAtDestination).toBeCloseTo(0.55, 2)
  })

  it('guarantees clear forward sightlines and space in front of all frosted gates', () => {
    const gates = level.breakables.filter((b) => b.presentation?.kind === 'barrier')
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

  it('proves that the rise gate (The Roseveil Gate) is reachable from the court checkpoint', () => {
    const gate = level.breakables.find((b) => b.id === 'prisma-gate-rise')
    expect(gate).toBeDefined()

    const courtSpawnLevel = {
      ...level,
      spawn: {
        position: { x: 1.96, y: 0, z: 13.50 },
        facingYaw: -1.5707963267948966,
        checkpointId: 'prisma-save-court',
      },
    }

    const proof = proveReachability(
      courtSpawnLevel,
      {
        id: gate!.id,
        label: gate!.label,
        anchor: gate!.anchor,
        interactionRadius: BREAKABLE_INTERACTION_RADIUS,
      },
      {
        maxFrontierExpansions: 2000,
        macroTickDuration: 12,
      },
    )

    expect(proof.reachable).toBe(true)
    expect(proof.witnessInputSequence).toBeDefined()
  })

  it('proves that the return gate is reachable from the pavilion checkpoint', () => {
    const gate = level.breakables.find((b) => b.id === 'prisma-gate-return')
    expect(gate).toBeDefined()

    const pavilionSpawnLevel = {
      ...level,
      spawn: {
        position: { x: 18.426, y: 0, z: 10.82 },
        facingYaw: 0,
        checkpointId: 'prisma-save-pavilion',
      },
    }

    const proof = proveReachability(
      pavilionSpawnLevel,
      {
        id: gate!.id,
        label: gate!.label,
        anchor: gate!.anchor,
        interactionRadius: BREAKABLE_INTERACTION_RADIUS,
      },
      {
        maxFrontierExpansions: 2000,
        macroTickDuration: 12,
      },
    )

    expect(proof.reachable).toBe(true)
    expect(proof.witnessInputSequence).toBeDefined()
  })

  it('proves that the finale portrait is reachable from the post-gate pavilion court', () => {
    const finale = level.breakables.find((b) => b.id === 'prisma-portrait-finale')
    expect(finale).toBeDefined()

    const postGateSpawnLevel = {
      ...level,
      spawn: {
        position: { x: 18.426, y: 0, z: 7.22 },
        facingYaw: 0,
        checkpointId: 'prisma-save-pavilion',
      },
    }

    const proof = proveReachability(
      postGateSpawnLevel,
      {
        id: finale!.id,
        label: finale!.label,
        anchor: finale!.anchor,
        interactionRadius: BREAKABLE_INTERACTION_RADIUS,
      },
      {
        maxFrontierExpansions: 2000,
        macroTickDuration: 12,
      },
    )

    expect(proof.reachable).toBe(true)
    expect(proof.witnessInputSequence).toBeDefined()
  })
})
