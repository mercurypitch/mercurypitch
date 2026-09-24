// Resonance portal tests — readiness, rotation and finish motion follow the shared aperture.

import type { InstancedMesh, Mesh, MeshPhysicalMaterial } from 'three'
import { Box3, MeshPhysicalMaterial as PhysicalMaterial } from 'three'
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
  it('keeps its complete rim above the floor while idle, pulsing and celebrating', () => {
    const exit = { ...GLASSWORKS.exit, top: 0.24 }
    const portal = createResonancePortal(exit, materials(), false)
    const halo = portal.root.getObjectByName('resonance-veil-outer-halo')!
    const sparkles = portal.root.getObjectByName('resonance-veil-sparkles')!
    const checkClearance = () => {
      portal.root.updateMatrixWorld(true)
      expect(new Box3().setFromObject(halo).min.y).toBeGreaterThanOrEqual(
        exit.top + 0.05,
      )
      if (sparkles.visible)
        expect(new Box3().setFromObject(sparkles).min.y).toBeGreaterThanOrEqual(
          exit.top + 0.05,
        )
    }
    checkClearance()
    for (let i = 0; i < 30; i++) {
      portal.update(
        { ...snapshot(exit.requiresCompleted), elapsedSeconds: i * 0.21 },
        0.016,
      )
      checkClearance()
    }
    portal.update(snapshot(exit.requiresCompleted, true), 0)
    for (let i = 0; i < 20; i++) {
      portal.update(snapshot(exit.requiresCompleted, true), 0.06)
      checkClearance()
    }
  })
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

  it('opens its opaque seal only after every required exhibit and delivers one finish', () => {
    const portal = createResonancePortal(GLASSWORKS.exit, materials(), false)
    const veil = portal.root.getObjectByName('resonance-veil-surface') as Mesh
    const material = veil.material as MeshPhysicalMaterial
    const sparkles = portal.root.getObjectByName(
      'resonance-veil-sparkles',
    ) as InstancedMesh
    const completed = GLASSWORKS.exit.requiresCompleted

    expect(portal.update(snapshot([]), 0)).toBe(false)
    expect(material.opacity).toBeGreaterThan(0.6)
    expect(sparkles.visible).toBe(false)
    portal.update(snapshot(completed.slice(0, -1)), 1)
    expect(material.opacity).toBeGreaterThan(0.6)
    expect(portal.update(snapshot(completed), 0)).toBe(false)
    expect(material.opacity).toBeGreaterThan(0.6)
    portal.update(snapshot(completed), 0.25)
    expect(material.opacity).toBeGreaterThan(0.34)
    expect(material.opacity).toBeLessThan(0.7)
    portal.update(snapshot(completed), 0.5)
    expect(material.opacity).toBe(0.34)
    expect(portal.update(snapshot(completed, true), 0)).toBe(false)
    expect(sparkles.visible).toBe(true)
    expect(portal.update(snapshot(completed, true), 0.6)).toBe(false)
    expect(sparkles.scale.x).toBeGreaterThan(1)
    expect(portal.update(snapshot(completed, true), 0.6)).toBe(true)
    expect(portal.update(snapshot(completed, true), 1)).toBe(false)
    expect(sparkles.visible).toBe(false)
  })

  it('shows one seal marker per requirement and removes them after unlocking', () => {
    const portal = createResonancePortal(GLASSWORKS.exit, materials(), false)
    const seals = portal.root.getObjectByName(
      'resonance-veil-seals',
    ) as InstancedMesh
    expect(seals.count).toBe(GLASSWORKS.exit.requiresCompleted.length)
    portal.update(snapshot([]), 0)
    expect(seals.visible).toBe(true)
    portal.update(snapshot(GLASSWORKS.exit.requiresCompleted), 1)
    expect(seals.visible).toBe(false)
  })

  it('restores an already unlocked exit without replaying the seal opening', () => {
    const portal = createResonancePortal(GLASSWORKS.exit, materials(), false)
    const veil = portal.root.getObjectByName('resonance-veil-surface') as Mesh
    portal.update(snapshot(GLASSWORKS.exit.requiresCompleted), 0)
    expect((veil.material as MeshPhysicalMaterial).opacity).toBe(0.34)
    expect(portal.root.getObjectByName('resonance-veil-seals')?.visible).toBe(
      false,
    )
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
