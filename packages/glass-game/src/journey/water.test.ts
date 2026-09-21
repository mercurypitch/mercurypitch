// Journey water tests — authored placement, visible-time motion, budgets and ownership.

import type { BufferAttribute, BufferGeometry, InstancedMesh, Mesh, Points, ShaderMaterial, } from 'three'
import { Matrix4, QuadraticBezierCurve3, Quaternion, Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { FLOATING_MUSEUM_JOURNEY } from '../content/museum-journey'
import type { JourneyWaterSpillway } from './water'
import { createJourneyWater } from './water'

const SPILLWAYS = [
  {
    id: 'north-fall',
    position: [2, 5, -3],
    width: 1.4,
    height: 3.2,
    yaw: 0,
  },
  {
    id: 'east-fall',
    position: [-1, 4, 2],
    width: 0.9,
    height: 2.4,
    yaw: Math.PI / 2,
  },
] as const satisfies readonly JourneyWaterSpillway[]

function materialFor(
  water: ReturnType<typeof createJourneyWater>,
  name: string,
) {
  return (water.root.getObjectByName(name) as Mesh).material as ShaderMaterial
}

describe('journey water', () => {
  it('keeps authored source ponds clear of medallions and bridge decks', () => {
    for (const spillway of FLOATING_MUSEUM_JOURNEY.spillways) {
      const source = spillway.source
      if (source === undefined) continue
      const center = new Vector3(...source.position)
      const supportRadius = Math.max(source.width, source.length) * 0.5

      for (const stage of FLOATING_MUSEUM_JOURNEY.stages) {
        const markerDistance = Math.hypot(
          center.x - stage.position[0],
          center.z - stage.position[2],
        )
        expect(markerDistance).toBeGreaterThanOrEqual(supportRadius + 0.5)
      }

      for (const bridge of FLOATING_MUSEUM_JOURNEY.bridges) {
        const from = new Vector3(...bridge.from)
        const to = new Vector3(...bridge.to)
        const delta = to.clone().sub(from)
        const lateral = new Vector3(-delta.z, 0, delta.x).normalize()
        const midpoint = from.clone().lerp(to, 0.5)
        midpoint.addScaledVector(lateral, bridge.curve)
        const curve = new QuadraticBezierCurve3(from, midpoint, to)
        let routeDistance = Number.POSITIVE_INFINITY
        for (let sample = 0; sample <= 64; sample++) {
          const point = curve.getPoint(sample / 64)
          routeDistance = Math.min(
            routeDistance,
            Math.hypot(center.x - point.x, center.z - point.z),
          )
        }
        expect(routeDistance).toBeGreaterThanOrEqual(
          supportRadius + bridge.width * 0.5,
        )
      }
    }
  })

  it('places a pinned top edge at the authored origin and curves toward yaw', () => {
    const water = createJourneyWater(SPILLWAYS, { mist: false })
    const north = water.root.getObjectByName(
      'journey-water-sheet:north-fall',
    ) as Mesh<BufferGeometry>
    const east = water.root.getObjectByName(
      'journey-water-sheet:east-fall',
    ) as Mesh<BufferGeometry>
    north.updateMatrixWorld(true)
    east.updateMatrixWorld(true)

    const northPositions = north.geometry.getAttribute(
      'position',
    ) as BufferAttribute
    const eastPositions = east.geometry.getAttribute(
      'position',
    ) as BufferAttribute
    const topCenterIndex = 7
    const bottomCenterIndex = 24 * 15 + 7
    expect(
      new Vector3()
        .fromBufferAttribute(northPositions, topCenterIndex)
        .applyMatrix4(north.matrixWorld)
        .toArray(),
    ).toEqual([2, 5, -3])
    expect(
      new Vector3()
        .fromBufferAttribute(eastPositions, topCenterIndex)
        .applyMatrix4(east.matrixWorld)
        .toArray(),
    ).toEqual([-1, 4, 2])

    const northBottom = new Vector3()
      .fromBufferAttribute(northPositions, bottomCenterIndex)
      .applyMatrix4(north.matrixWorld)
    const eastBottom = new Vector3()
      .fromBufferAttribute(eastPositions, bottomCenterIndex)
      .applyMatrix4(east.matrixWorld)
    expect(northBottom.y).toBeCloseTo(1.8)
    expect(northBottom.z).toBeGreaterThan(-2.5)
    expect(eastBottom.y).toBeCloseTo(1.6)
    expect(eastBottom.x).toBeGreaterThan(-0.6)
    expect(eastBottom.z).toBeCloseTo(2)
    water.dispose()
  })

  it('advances only bounded visible-frame time and freezes reduced motion', () => {
    const water = createJourneyWater(SPILLWAYS)
    const material = materialFor(water, 'journey-water-sheet:north-fall')
    water.update(10, 1 / 60)
    expect(material.uniforms.uTime.value).toBe(0)
    water.update(10 + 1 / 60, 1 / 60)
    expect(material.uniforms.uTime.value).toBeCloseTo(1 / 60)
    water.update(40, 30)
    expect(material.uniforms.uTime.value).toBeCloseTo(1 / 60 + 0.1)

    water.setReducedMotion(true)
    const frozen = material.uniforms.uTime.value as number
    expect(material.uniforms.uMotion.value).toBe(0)
    expect(water.root.getObjectByName('journey-water-mist')?.visible).toBe(
      false,
    )
    water.update(41, 1)
    expect(material.uniforms.uTime.value).toBe(frozen)
    water.setReducedMotion(false)
    water.update(41 + 1 / 60, 1 / 60)
    expect(material.uniforms.uTime.value).toBeCloseTo(frozen + 1 / 60)
    expect(water.root.getObjectByName('journey-water-mist')?.visible).toBe(true)
    water.dispose()
  })

  it('keeps four falls within the map budget without a secondary render', () => {
    const spillways = [0, 1, 2, 3].map((index) => ({
      id: `fall-${index}`,
      position: [index * 2, 4, 0] as const,
      width: 1.2,
      height: 3,
      yaw: index * (Math.PI / 2),
    }))
    const water = createJourneyWater(spillways)

    expect(water.getMetrics()).toEqual({
      spillways: 4,
      sourcePools: 0,
      drawCalls: 6,
      triangles: 2880,
      geometries: 6,
      materials: 3,
      mistParticles: 128,
      secondaryRenderPasses: 0,
    })
    water.dispose()
  })

  it('can omit pooled mist while retaining animated sheet and basin draws', () => {
    const water = createJourneyWater(SPILLWAYS, { mist: false })

    expect(water.root.getObjectByName('journey-water-mist')).toBeUndefined()
    expect(water.root.getObjectByName('journey-water-basins')).toBeDefined()
    expect(water.getMetrics()).toMatchObject({
      drawCalls: 3,
      mistParticles: 0,
      materials: 2,
      secondaryRenderPasses: 0,
    })
    water.dispose()
  })

  it('omits only authored abyss basins and accounts for their resources', () => {
    const partial = createJourneyWater(
      [{ ...SPILLWAYS[0], basin: false }, SPILLWAYS[1]],
      { mist: false },
    )
    const partialBasins = partial.root.getObjectByName(
      'journey-water-basins',
    ) as InstancedMesh
    expect(partialBasins.count).toBe(1)
    expect(partial.getMetrics()).toEqual({
      spillways: 2,
      sourcePools: 0,
      drawCalls: 3,
      triangles: 1392,
      geometries: 3,
      materials: 2,
      mistParticles: 0,
      secondaryRenderPasses: 0,
    })
    partial.dispose()

    const abyss = createJourneyWater(
      SPILLWAYS.map((spillway) => ({ ...spillway, basin: false })),
      { mist: false },
    )
    expect(abyss.root.getObjectByName('journey-water-basins')).toBeUndefined()
    expect(abyss.getMetrics()).toEqual({
      spillways: 2,
      sourcePools: 0,
      drawCalls: 2,
      triangles: 1344,
      geometries: 2,
      materials: 1,
      mistParticles: 0,
      secondaryRenderPasses: 0,
    })
    expect(() => abyss.dispose()).not.toThrow()
  })

  it('authors one pooled source draw and dissolves into mixed mist and bubbles', () => {
    const sourceSpillway = {
      ...SPILLWAYS[0],
      visibleDrop: 2.1,
      basin: false,
      source: {
        position: [2, 5.04, -3.48],
        width: 1.4,
        length: 0.9,
      },
    } as const satisfies JourneyWaterSpillway
    const water = createJourneyWater([sourceSpillway])
    const sheet = water.root.getObjectByName(
      'journey-water-sheet:north-fall',
    ) as Mesh<BufferGeometry>
    const dissolves = sheet.geometry.getAttribute(
      'aDissolve',
    ) as BufferAttribute
    expect(dissolves.getX(0)).toBeCloseTo(2.1 / 3.2)

    const sources = water.root.getObjectByName(
      'journey-water-source-pools',
    ) as InstancedMesh
    const sourceMatrix = new Matrix4()
    sources.getMatrixAt(0, sourceMatrix)
    const sourcePosition = new Vector3()
    const sourceScale = new Vector3()
    sourceMatrix.decompose(sourcePosition, new Quaternion(), sourceScale)
    expect(sourcePosition.x).toBeCloseTo(2)
    expect(sourcePosition.y).toBeCloseTo(5.04)
    expect(sourcePosition.z).toBeCloseTo(-3.48)
    expect(sourceScale.x).toBeCloseTo(0.7)
    expect(sourceScale.y).toBeCloseTo(0.45)
    expect(sourceScale.z).toBeCloseTo(1)

    const mist = water.root.getObjectByName('journey-water-mist') as Points
    const kinds = mist.geometry.getAttribute('aKind') as BufferAttribute
    expect(kinds.count).toBe(32)
    expect(
      Array.from({ length: kinds.count }, (_, index) =>
        kinds.getX(index),
      ).filter((kind) => kind === 1),
    ).toHaveLength(10)
    expect(water.getMetrics()).toEqual({
      spillways: 1,
      sourcePools: 1,
      drawCalls: 3,
      triangles: 712,
      geometries: 3,
      materials: 3,
      mistParticles: 32,
      secondaryRenderPasses: 0,
    })
    water.dispose()
  })

  it('disposes every owned GPU resource once and tolerates late updates', () => {
    const water = createJourneyWater([
      {
        ...SPILLWAYS[0],
        source: {
          position: [2, 5.04, -3.48],
          width: 1.4,
          length: 0.9,
        },
      },
      SPILLWAYS[1],
    ])
    const basins = water.root.getObjectByName(
      'journey-water-basins',
    ) as InstancedMesh
    const basinDisposal = vi.fn()
    basins.addEventListener('dispose', basinDisposal)
    const geometries = new Set<BufferGeometry>()
    const materials = new Set<ShaderMaterial>()
    water.root.traverse((object) => {
      if ('geometry' in object) {
        const renderable = object as Mesh | Points
        geometries.add(renderable.geometry)
        const objectMaterials = Array.isArray(renderable.material)
          ? renderable.material
          : [renderable.material]
        objectMaterials.forEach((material) =>
          materials.add(material as ShaderMaterial),
        )
      }
    })
    const geometryDisposals = [...geometries].map((geometry) => {
      const listener = vi.fn()
      geometry.addEventListener('dispose', listener)
      return listener
    })
    const materialDisposals = [...materials].map((material) => {
      const listener = vi.fn()
      material.addEventListener('dispose', listener)
      return listener
    })

    water.dispose()
    water.dispose()
    water.update(1, 1)
    water.setReducedMotion(true)

    expect(water.root.children).toHaveLength(0)
    expect(basinDisposal).toHaveBeenCalledOnce()
    geometryDisposals.forEach((listener) =>
      expect(listener).toHaveBeenCalledOnce(),
    )
    materialDisposals.forEach((listener) =>
      expect(listener).toHaveBeenCalledOnce(),
    )
  })

  it('rejects invalid dimensions and duplicate IDs before allocating', () => {
    expect(() => createJourneyWater([{ ...SPILLWAYS[0], width: 0 }])).toThrow(
      'north-fall.width must be greater than zero',
    )
    expect(() => createJourneyWater([SPILLWAYS[0], SPILLWAYS[0]])).toThrow(
      'Duplicate journey water spillway ID: north-fall',
    )
    expect(() =>
      createJourneyWater([{ ...SPILLWAYS[0], visibleDrop: 3.3 }]),
    ).toThrow('north-fall.visibleDrop must be greater than zero')
    expect(() =>
      createJourneyWater([
        {
          ...SPILLWAYS[0],
          source: { position: [0, 0, 0], width: 0, length: 1 },
        },
      ]),
    ).toThrow('north-fall.source.width must be greater than zero')
    expect(() =>
      createJourneyWater([
        {
          ...SPILLWAYS[0],
          source: { position: [2, 5, -4], width: 1.4, length: 0.9 },
        },
      ]),
    ).toThrow('north-fall.source must overlap the waterfall lip')
  })
})
