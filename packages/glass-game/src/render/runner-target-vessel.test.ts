// Runner target vessel regressions — earned cracks persist while live stress waits for accepted input.

import type { LineSegments, Mesh, MeshPhysicalMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import type { BreakableSnapshot } from '../contracts'
import type { VesselDefinition } from './vessels'
import { createVessel } from './vessels'

const TARGET: VesselDefinition = {
  id: 'runner-feedback-gate',
  position: { x: 0, y: 0, z: 0 },
  anchor: { x: 0, y: 0, z: 1 },
  presentation: { kind: 'barrier', facingYaw: 0 },
  variant: 'frost-gold-arch-breakwall-a',
}

const CHARGED: BreakableSnapshot = {
  id: TARGET.id,
  charge: 0.8,
  phase: 'charging',
  brokenAt: null,
}

function presentation(vessel: ReturnType<typeof createVessel>) {
  const intact = vessel.root.getObjectByName(
    `vessel-intact-${TARGET.id}`,
  ) as Mesh
  const material = intact.material as MeshPhysicalMaterial
  const cracks = intact.children as LineSegments[]
  return { intact, material, cracks }
}

describe('runner target vessel charge presentation', () => {
  it('holds earned cracks without stress or tremor until input is accepted', () => {
    const vessel = createVessel(TARGET, false)
    const { intact, material, cracks } = presentation(vessel)

    vessel.update(CHARGED, 0.03, true, {
      surfaceStressActive: false,
      tremorActive: false,
    })
    expect(cracks.some((crack) => crack.visible)).toBe(true)
    expect(material.emissiveIntensity).toBe(0)
    expect(intact.rotation.z).toBe(0)

    vessel.update(CHARGED, 0.04, true, {
      surfaceStressActive: true,
      tremorActive: true,
    })
    expect(material.emissiveIntensity).toBeGreaterThan(0)
    expect(intact.rotation.z).not.toBe(0)

    vessel.update(CHARGED, 0.05, true, {
      surfaceStressActive: false,
      tremorActive: false,
    })
    expect(cracks.some((crack) => crack.visible)).toBe(true)
    expect(material.emissiveIntensity).toBe(0)
    expect(intact.rotation.z).toBe(0)
    vessel.dispose()
  })

  it('preserves the generic vessel stress and tremor defaults', () => {
    const vessel = createVessel(TARGET, false)
    const { intact, material } = presentation(vessel)

    vessel.update(CHARGED, 0.04)

    expect(material.emissiveIntensity).toBeGreaterThan(0)
    expect(intact.rotation.z).not.toBe(0)
    vessel.dispose()
  })
})
