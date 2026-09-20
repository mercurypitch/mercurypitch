// Resonance portal tests — readiness, rotation and finish motion follow the shared aperture.

import type { InstancedMesh, Mesh, MeshPhysicalMaterial } from 'three'
import { MeshPhysicalMaterial as PhysicalMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import { GLASSWORKS } from '../content/glassworks'
import type { GameSnapshot, LevelDefinition } from '../contracts'
import { createGlassGame } from '../core/game'
import type { MuseumMaterials } from './materials'
import { createResonancePortal } from './resonance-portal'

function materials(): MuseumMaterials {
  return { gold: new PhysicalMaterial() }
}

function snapshot(
  completedBreakableIds: readonly string[],
  complete = false,
): GameSnapshot {
  return {
    ...createGlassGame(GLASSWORKS).snapshot(),
    completedBreakableIds,
    complete,
  }
}

describe('resonance portal', () => {
  it('fits and rotates its visible aperture from the same authored bounds', () => {
    const exit: LevelDefinition['exit'] = {
      minX: 4.9,
      maxX: 5.1,
      minZ: -0.8,
      maxZ: 0.8,
      top: 0.25,
      requiresCompleted: [],
    }
    const portal = createResonancePortal(exit, materials(), false)
    const veil = portal.root.getObjectByName('resonance-veil-surface') as Mesh

    expect(portal.root.position.toArray()).toEqual([5, 1, 0])
    expect(portal.root.rotation.y).toBeCloseTo(Math.PI / 2)
    expect(veil.scale.toArray()).toEqual([1.6, 1.5, 1])
    expect((veil.material as MeshPhysicalMaterial).transmission).toBe(0)
    expect((veil.material as MeshPhysicalMaterial).forceSinglePass).toBe(true)
  })

  it('brightens only when requirements are ready and delivers one finish', () => {
    const portal = createResonancePortal(GLASSWORKS.exit, materials(), false)
    const veil = portal.root.getObjectByName('resonance-veil-surface') as Mesh
    const material = veil.material as MeshPhysicalMaterial
    const sparkles = portal.root.getObjectByName(
      'resonance-veil-sparkles',
    ) as InstancedMesh
    const completed = GLASSWORKS.exit.requiresCompleted

    expect(portal.update(snapshot([]), 0)).toBe(false)
    expect(material.opacity).toBe(0.06)
    expect(sparkles.visible).toBe(false)
    expect(portal.update(snapshot(completed), 0)).toBe(false)
    expect(material.opacity).toBe(0.34)
    expect(portal.update(snapshot(completed, true), 0)).toBe(false)
    expect(sparkles.visible).toBe(true)
    expect(portal.update(snapshot(completed, true), 0.6)).toBe(false)
    expect(sparkles.scale.x).toBeGreaterThan(1)
    expect(portal.update(snapshot(completed, true), 0.6)).toBe(true)
    expect(portal.update(snapshot(completed, true), 1)).toBe(false)
    expect(sparkles.visible).toBe(false)
  })

  it('keeps reduced-motion framing fixed during the brief finish cue', () => {
    const portal = createResonancePortal(GLASSWORKS.exit, materials(), true)
    const completed = GLASSWORKS.exit.requiresCompleted
    portal.update(snapshot(completed), 0)
    portal.update(snapshot(completed, true), 0)
    portal.update(snapshot(completed, true), 0.12)

    expect(
      portal.root.getObjectByName('resonance-veil-face')?.scale.toArray(),
    ).toEqual([1, 1, 1])
    expect(
      portal.root.getObjectByName('resonance-veil-sparkles')?.scale.toArray(),
    ).toEqual([1, 1, 1])
  })

  it('does not replay the finish flourish for restored completed progress', () => {
    const portal = createResonancePortal(GLASSWORKS.exit, materials(), false)
    const sparkles = portal.root.getObjectByName(
      'resonance-veil-sparkles',
    ) as InstancedMesh

    expect(
      portal.update(snapshot(GLASSWORKS.exit.requiresCompleted, true), 0.016),
    ).toBe(false)
    expect(sparkles.visible).toBe(false)
  })
})
