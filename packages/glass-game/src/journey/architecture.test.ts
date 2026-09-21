// Journey architecture tests — preserve landmark heights and progress-owned decoration seams.

import type { BufferGeometry } from 'three'
import { DoubleSide, Group, InstancedMesh, Mesh, MeshBasicMaterial, PlaneGeometry, Raycaster, Vector3, } from 'three'
import { describe, expect, it } from 'vitest'
import { FLOATING_MUSEUM_JOURNEY } from '../content/museum-journey'
import type { JourneyArchitectureMaterials } from './architecture'
import { createJourneyArchitecture, JOURNEY_PORTRAIT_INSET_MATERIAL, } from './architecture'
import { JOURNEY_MEDALLION_FACE_Y, JOURNEY_MEDALLION_SURFACE_Y, } from './landmarks'

function createFixture(
  sculptural = false,
  includePortraitInset = true,
  architectural = false,
) {
  const material = new MeshBasicMaterial({ side: DoubleSide })
  const frameMaterial = new MeshBasicMaterial({ side: DoubleSide })
  frameMaterial.name = JOURNEY_PORTRAIT_INSET_MATERIAL
  const frameOccluderMaterial = new MeshBasicMaterial({ side: DoubleSide })
  frameOccluderMaterial.name = 'map_frame_atlas_01'
  const frameInsetGeometry = new PlaneGeometry(
    0.394637138 - -0.394941539,
    1.634246707 - 0.135226727,
  )
  frameInsetGeometry.translate(
    (-0.394941539 + 0.394637138) / 2,
    (0.135226727 + 1.634246707) / 2,
    -0.017141126,
  )
  const uvs = frameInsetGeometry.getAttribute('uv')
  for (let index = 0; index < uvs.count; index++)
    uvs.setX(index, 0.104952559 + uvs.getX(index) * (0.895047426 - 0.104952559))
  const frameOccluderGeometry = new PlaneGeometry(1.116257787, 1.805967331)
  frameOccluderGeometry.translate(0, 0.902983666, -0.051449)
  const materials: JourneyArchitectureMaterials = {
    gold: material,
    jade: material,
    ivory: material,
    amber: material,
    celadon: material,
    clearGlass: material,
    shadow: material,
    crystal: material,
  }
  const ownedGeometries = new Set<BufferGeometry>()
  const requestedSculptures: string[] = []
  const requestedArchitecture: string[] = []
  const portraitInsets: Mesh[] = []
  const disposeResources = (): void => {
    for (const geometry of ownedGeometries) geometry.dispose()
    frameInsetGeometry.dispose()
    frameOccluderGeometry.dispose()
    frameMaterial.dispose()
    frameOccluderMaterial.dispose()
    material.dispose()
  }
  let assembly: ReturnType<typeof createJourneyArchitecture>
  try {
    assembly = createJourneyArchitecture(
      FLOATING_MUSEUM_JOURNEY,
      (name) => {
        const unit = new Group()
        unit.name = name
        if (name === 'map_frame' && includePortraitInset) {
          const inset = new Mesh(frameInsetGeometry, frameMaterial)
          portraitInsets.push(inset)
          unit.add(
            new Mesh(frameOccluderGeometry, frameOccluderMaterial),
            inset,
          )
        }
        return unit
      },
      sculptural
        ? (name) => {
            requestedSculptures.push(name)
            if (name !== 'map_temple_amber' && name !== 'map_temple_teal')
              throw new Error(`Missing ${name}`)
            const unit = new Group()
            unit.name = name
            return unit
          }
        : undefined,
      architectural
        ? (name) => {
            requestedArchitecture.push(name)
            if (name !== 'map_twin_connector' && name !== 'map_conservatory')
              throw new Error(`Missing ${name}`)
            const unit = new Group()
            unit.name = name
            return unit
          }
        : undefined,
      materials,
      ownedGeometries,
    )
  } catch (error) {
    disposeResources()
    throw error
  }
  return {
    assembly,
    frameInsetGeometry,
    frameMaterial,
    material,
    portraitInsets,
    requestedSculptures,
    requestedArchitecture,
    dispose: disposeResources,
  }
}

describe('journey architecture', () => {
  it('keeps ornate medallions on the shared landmark heights', () => {
    const fixture = createFixture()
    try {
      for (const stage of FLOATING_MUSEUM_JOURNEY.stages) {
        const marker = fixture.assembly.root.getObjectByName(
          `${stage.id}-journey-medallion`,
        )
        expect(marker?.position.toArray()).toEqual(stage.position)
        expect(marker?.userData.journeyMedallionSurfaceY).toBe(
          JOURNEY_MEDALLION_SURFACE_Y,
        )
        expect(
          marker?.getObjectByName(`${stage.id}-medallion-face`)?.position.y,
        ).toBe(JOURNEY_MEDALLION_FACE_Y)
        expect(
          marker?.getObjectByName(`${stage.id}-medallion-ring`)?.position.y,
        ).toBe(JOURNEY_MEDALLION_SURFACE_Y)
        const pedestal = marker?.getObjectByName(`${stage.id}-path-medallion`)
        expect(pedestal?.position.y).toBe(0.11)
        expect(pedestal?.scale.y).toBe(1)
        expect(
          marker?.getObjectByName(`${stage.id}-engraved-inner-rim`),
        ).toBeDefined()
        expect(
          (
            marker?.getObjectByName(
              `${stage.id}-sun-and-route-inlay`,
            ) as InstancedMesh
          ).count,
        ).toBe(14)
      }
    } finally {
      fixture.dispose()
    }
  })

  it('exposes hidden earned stars and flat arched mystery artwork by stable id', () => {
    const fixture = createFixture()
    try {
      expect(fixture.assembly.starMarkers.size).toBe(
        FLOATING_MUSEUM_JOURNEY.stages.length,
      )
      for (const stage of FLOATING_MUSEUM_JOURNEY.stages) {
        const stars = fixture.assembly.starMarkers.get(stage.id)
        expect(stars).toHaveLength(3)
        stars?.forEach((star, index) => {
          expect(star.name).toBe(`${stage.id}-progress-star-${index + 1}`)
          expect(star.visible).toBe(false)
          expect(star.userData.journeyStageId).toBe(stage.id)
          expect(star.userData.journeyStarSlot).toBe(index + 1)
        })
      }

      const portraits = FLOATING_MUSEUM_JOURNEY.stages.flatMap((stage) =>
        stage.portrait === undefined ? [] : [stage.portrait],
      )
      expect([...fixture.assembly.portraitMysteries.keys()]).toEqual(
        portraits.map((portrait) => portrait.portraitId),
      )
      for (const [index, portrait] of portraits.entries()) {
        const surface = fixture.assembly.portraitSurfaces.get(
          portrait.portraitId,
        )
        expect(surface).not.toBe(fixture.portraitInsets[index])
        expect(surface?.geometry).toBe(fixture.frameInsetGeometry)
        expect(surface?.name).toBe(`${portrait.portraitId}-surface`)
        expect(surface?.material).toBe(fixture.material)
        expect(surface?.visible).toBe(false)
        expect(surface?.userData.journeyPortraitFrontZ).toBeCloseTo(
          -0.054449,
          8,
        )
        expect(surface?.userData.journeyPortraitUv).toBe('authored')
        expect(fixture.portraitInsets[index]?.material).toBe(
          fixture.frameMaterial,
        )
        expect(fixture.portraitInsets[index]?.visible).toBe(true)
        expect(
          fixture.assembly.portraitMysteries.get(portrait.portraitId)?.name,
        ).toBe(`${portrait.portraitId}-mystery`)

        const mystery = fixture.assembly.portraitMysteries.get(
          portrait.portraitId,
        ) as Mesh
        expect(mystery.isMesh).toBe(true)
        expect(mystery.geometry).toBe(surface?.geometry)
        expect(mystery.position.toArray()).toEqual(surface?.position.toArray())
        expect(mystery.quaternion.toArray()).toEqual(
          surface?.quaternion.toArray(),
        )
        expect(mystery.visible).toBe(true)
        expect(mystery.children).toHaveLength(0)

        surface!.visible = true
        const frame = surface!.parent!
        frame.updateWorldMatrix(true, true)
        const rayStart = new Vector3(0, 0.88, -0.2).applyMatrix4(
          frame.matrixWorld,
        )
        const rayEnd = new Vector3(0, 0.88, 0.2).applyMatrix4(frame.matrixWorld)
        const firstHit = new Raycaster(
          rayStart,
          rayEnd.sub(rayStart).normalize(),
          0,
          1,
        ).intersectObject(frame, true)[0]
        expect(firstHit?.object).toBe(surface)
        surface!.visible = false
      }
      fixture.frameInsetGeometry.computeBoundingBox()
      expect(fixture.frameInsetGeometry.boundingBox?.min.toArray()).toEqual([
        expect.closeTo(-0.394941539, 8),
        expect.closeTo(0.135226727, 8),
        expect.closeTo(-0.017141126, 8),
      ])
      expect(fixture.frameInsetGeometry.boundingBox?.max.toArray()).toEqual([
        expect.closeTo(0.394637138, 8),
        expect.closeTo(1.634246707, 8),
        expect.closeTo(-0.017141126, 8),
      ])
      const insetUvs = fixture.frameInsetGeometry.getAttribute('uv')
      const insetUs = Array.from({ length: insetUvs.count }, (_, index) =>
        insetUvs.getX(index),
      )
      expect(Math.min(...insetUs)).toBeCloseTo(0.104952559, 8)
      expect(Math.max(...insetUs)).toBeCloseTo(0.895047426, 8)
    } finally {
      fixture.dispose()
    }
  })

  it('rejects a map frame without its authored portrait inset', () => {
    expect(() => createFixture(false, false)).toThrow(
      'Journey map_frame must contain exactly one portrait inset using material map_frame_atlas_00; found 0.',
    )
  })

  it('requests the twin-finish temple variants', () => {
    const fixture = createFixture(true)
    try {
      expect(fixture.requestedSculptures).toEqual([
        'map_temple_teal',
        'map_temple_amber',
        'map_temple_teal',
      ])
      for (const bridge of FLOATING_MUSEUM_JOURNEY.bridges)
        expect(
          fixture.assembly.root.getObjectByName(
            `${bridge.id}-gilded-rail-finials`,
          ),
        ).toBeInstanceOf(InstancedMesh)
    } finally {
      fixture.dispose()
    }
  })

  it('replaces only the twin connector and conservatory with polish donors', () => {
    const fixture = createFixture(true, true, true)
    try {
      expect(fixture.requestedArchitecture).toEqual([
        'map_twin_connector',
        'map_conservatory',
      ])
      const connector =
        fixture.assembly.root.getObjectByName('map_twin_connector')
      expect(connector?.position.toArray()).toEqual([0, 0.02, 0.44])
      expect(connector?.scale.toArray()).toEqual([0.78, 0.78, 0.78])
      expect(
        fixture.assembly.root.getObjectByName('twin-gallery-canopy-arch'),
      ).toBeUndefined()
      expect(
        fixture.assembly.root.getObjectByName('map_conservatory'),
      ).toBeDefined()
      expect(
        fixture.assembly.root.getObjectByName('full-glass-dome'),
      ).toBeUndefined()
    } finally {
      fixture.dispose()
    }
  })
})
