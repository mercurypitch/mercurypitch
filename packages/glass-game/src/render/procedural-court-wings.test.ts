// Procedural court return proofs — the presentation stays below the unchanged wall and floor contact.

import { Box3, BoxGeometry, Matrix4, Mesh, MeshStandardMaterial, Raycaster, Vector3, } from 'three'
import { describe, expect, it } from 'vitest'
import type { PlatformDefinition, SolidPropDefinition } from '../contracts'
import { CLOUDWAY_LAB_PLATFORM_RENDER_IDS } from './cloudway-laboratory-catalog'
import { createProceduralCourtWingGeometry } from './procedural-court-wings'

type BoxSolid = Extract<SolidPropDefinition, { shape: 'box' }>

const floor: PlatformDefinition = {
  id: 'court',
  kind: 'deck',
  material: 'stone',
  minX: -1.6,
  maxX: 1.6,
  minZ: -0.36,
  maxZ: 0.36,
  top: 0,
  thickness: 0.34,
  renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.pearlRest,
}

function wing(sign: number): BoxSolid {
  return {
    id: `barrier:gate:court-${sign < 0 ? 'left' : 'right'}-wing`,
    kind: 'prop',
    shape: 'box',
    minX: sign < 0 ? -3.1 : 1.3,
    maxX: sign < 0 ? -1.3 : 3.1,
    minZ: -0.25,
    maxZ: 0.25,
    top: 1.2,
    thickness: 1.2,
    presentation: { role: 'wall', material: 'stone' },
  }
}

function worldMesh(solid: BoxSolid) {
  const geometry = createProceduralCourtWingGeometry(solid, [floor])!
  const mesh = new Mesh(geometry, new MeshStandardMaterial())
  mesh.position.set(
    (solid.minX + solid.maxX) / 2,
    solid.top - solid.thickness / 2,
    (solid.minZ + solid.maxZ) / 2,
  )
  mesh.updateMatrixWorld(true)
  return mesh
}

function hit(mesh: Mesh, origin: Vector3, direction: Vector3) {
  return new Raycaster(origin, direction).intersectObject(mesh)[0]?.distance
}

describe('generated court stone returns', () => {
  it.each([-1, 1])('keeps the exact above-floor cuboid on side %i', (sign) => {
    const solid = wing(sign)
    const before = JSON.stringify({ solid, floor })
    const mesh = worldMesh(solid)
    const original = new Mesh(new BoxGeometry(1.8, 1.2, 0.5), mesh.material)
    original.position.copy(mesh.position)
    original.updateMatrixWorld(true)
    for (const y of [0.001, 0.3, 0.9, 1.199]) {
      for (const x of [
        solid.minX + 0.001,
        (solid.minX + solid.maxX) / 2,
        solid.maxX - 0.001,
      ]) {
        const origin = new Vector3(x, y, 2)
        const direction = new Vector3(0, 0, -1)
        expect(hit(mesh, origin, direction)).toBeCloseTo(
          hit(original, origin, direction)!,
          6,
        )
      }
      for (const z of [-0.249, 0, 0.249]) {
        const origin = new Vector3(sign * 5, y, z)
        const direction = new Vector3(-sign, 0, 0)
        expect(hit(mesh, origin, direction)).toBeCloseTo(
          hit(original, origin, direction)!,
          6,
        )
      }
    }
    const bounds = new Box3().setFromObject(mesh)
    expect(bounds.min.x).toBeCloseTo(solid.minX, 6)
    expect(bounds.max.x).toBeCloseTo(solid.maxX, 6)
    expect(bounds.min.z).toBeCloseTo(solid.minZ, 6)
    expect(bounds.max.z).toBeCloseTo(solid.maxZ, 6)
    expect(bounds.min.y).toBeCloseTo(-0.65, 6)
    expect(bounds.max.y).toBeCloseTo(solid.top, 6)
    // The outer overhang slopes inward; the lower toe actually reaches the
    // slab, rather than leaving an unsupported horizontal shelf in the sky.
    expect(
      hit(mesh, new Vector3(sign * 1.5, -2, 0), new Vector3(0, 1, 0)),
    ).toBeCloseTo(1.35, 6)
    expect(
      hit(mesh, new Vector3(sign * 3, -2, 0), new Vector3(0, 1, 0)),
    ).toBeGreaterThan(1.9)
    expect(mesh.geometry.getAttribute('position').count / 3).toBe(16)
    expect(mesh.geometry.groups).toEqual([])
    expect(JSON.stringify({ solid, floor })).toBe(before)
    mesh.geometry.dispose()
    original.geometry.dispose()
    mesh.material.dispose()
  })

  it('retains ordinary box presentation when a real court foot cannot be identified', () => {
    const solid = wing(1)
    expect(
      createProceduralCourtWingGeometry({ ...solid, id: 'ordinary-wall' }, [
        floor,
      ]),
    ).toBeUndefined()
    expect(createProceduralCourtWingGeometry(solid, [])).toBeUndefined()
    expect(
      createProceduralCourtWingGeometry(solid, [{ ...floor, top: -0.1 }]),
    ).toBeUndefined()
    expect(
      createProceduralCourtWingGeometry(solid, [{ ...floor, maxX: 1.2 }]),
    ).toBeUndefined()
    expect(
      createProceduralCourtWingGeometry(solid, [{ ...floor, minZ: -0.1 }]),
    ).toBeUndefined()
    expect(
      createProceduralCourtWingGeometry(solid, [
        { ...floor, activation: { allCompleted: ['gate'] } },
      ]),
    ).toBeUndefined()
    expect(
      createProceduralCourtWingGeometry(solid, [
        { ...floor, unlockAfter: 'gate' },
      ]),
    ).toBeUndefined()
    expect(
      createProceduralCourtWingGeometry(solid, [
        { ...floor, parentPlatformId: 'moving-parent' },
      ]),
    ).toBeUndefined()
    expect(
      createProceduralCourtWingGeometry(solid, [
        {
          ...floor,
          behavior: {
            kind: 'glide',
            translation: { x: 1, y: 0, z: 0 },
            travelSeconds: 2,
            dwellSeconds: 0,
          },
        },
      ]),
    ).toBeUndefined()
  })

  it.each([0, 1, 2, 3])(
    'follows a translated court at cardinal turn %i without adding any above-floor art',
    (turn) => {
      const transform = new Matrix4().makeRotationY((turn * Math.PI) / 2)
      transform.setPosition(13, 4, -7)
      const moved = <T extends BoxSolid | PlatformDefinition>(item: T): T => {
        const points = [
          new Vector3(item.minX, item.top, item.minZ),
          new Vector3(item.minX, item.top, item.maxZ),
          new Vector3(item.maxX, item.top, item.minZ),
          new Vector3(item.maxX, item.top, item.maxZ),
        ].map((p) => p.applyMatrix4(transform))
        const bounds = new Box3().setFromPoints(points)
        return {
          ...item,
          minX: bounds.min.x,
          maxX: bounds.max.x,
          minZ: bounds.min.z,
          maxZ: bounds.max.z,
          top: bounds.max.y,
        }
      }
      const movedFloor = moved(floor)
      for (const sign of [-1, 1]) {
        const solid = moved(wing(sign))
        const geometry = createProceduralCourtWingGeometry(solid, [movedFloor])!
        expect(geometry).toBeDefined()
        const mesh = new Mesh(geometry, new MeshStandardMaterial())
        mesh.position.set(
          (solid.minX + solid.maxX) / 2,
          solid.top - solid.thickness / 2,
          (solid.minZ + solid.maxZ) / 2,
        )
        mesh.updateMatrixWorld(true)
        for (const y of [0.001, 0.6, 1.199]) {
          const origin = new Vector3(sign * 2.2, y, 2).applyMatrix4(transform)
          const direction = new Vector3(0, 0, -1).transformDirection(transform)
          expect(hit(mesh, origin, direction)).toBeCloseTo(1.75, 6)
        }
        const bounds = new Box3().setFromObject(mesh)
        expect(bounds.min.x).toBeCloseTo(solid.minX, 6)
        expect(bounds.max.x).toBeCloseTo(solid.maxX, 6)
        expect(bounds.min.z).toBeCloseTo(solid.minZ, 6)
        expect(bounds.max.z).toBeCloseTo(solid.maxZ, 6)
        expect(bounds.min.y).toBeCloseTo(movedFloor.top - 0.65, 6)
        const uv = geometry.getAttribute('uv')
        expect([...uv.array].every(Number.isFinite)).toBe(true)
        mesh.geometry.dispose()
        mesh.material.dispose()
      }
    },
  )
})
