// Journey medallions — supported marble plinths, enamel faces and progress-owned front badges.

import type { BufferGeometry, Material, Object3D } from 'three'
import { Color, CylinderGeometry, Float32BufferAttribute, Group, LatheGeometry, Mesh, Shape, ShapeGeometry, Vector2, } from 'three'
import type { MuseumJourneyStage } from '../content/museum-journey'
import { JOURNEY_MEDALLION_FACE_Y, JOURNEY_MEDALLION_SURFACE_Y, } from './landmarks'

export type JourneyProgressStars = readonly [Object3D, Object3D, Object3D]

export interface JourneyMedallionMaterials {
  ivory: Material
  gold: Material
  jade: Material
  medallionGold?: Material
  medallionGlass?: Material
}

export interface JourneyMedallionGeometry {
  plinth: LatheGeometry
  crown: LatheGeometry
  face: LatheGeometry
  compass: ShapeGeometry
  fascia: CylinderGeometry
  star: ShapeGeometry
}

function radialShape(
  points: number,
  radius: (point: number) => number,
): ShapeGeometry {
  const shape = new Shape()
  for (let point = 0; point < points; point++) {
    const angle = Math.PI / 2 + (point * Math.PI * 2) / points
    const x = Math.cos(angle) * radius(point)
    const y = Math.sin(angle) * radius(point)
    if (point === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  return new ShapeGeometry(shape)
}

/** Shared shapes are retired by the assembly, never by individual stage markers. */
export function createJourneyMedallionGeometry(
  owned: Set<BufferGeometry>,
): JourneyMedallionGeometry {
  const own = <T extends BufferGeometry>(geometry: T): T => {
    owned.add(geometry)
    return geometry
  }
  const lathe = (
    profile: readonly (readonly [number, number])[],
    segments: number,
  ): LatheGeometry =>
    own(
      new LatheGeometry(
        profile.map(([radius, y]) => new Vector2(radius, y)),
        segments,
      ),
    )
  // A flat standing area rolls into a rounded shoulder. These changing
  // normals catch the resident environment without a transmission pass.
  const face = lathe(
    [
      [0, -0.04],
      [0.416, -0.04],
      [0.416, -0.015],
      [0.397, -0.005],
      [0.343, 0.004],
      [0.24, 0.007],
      [0, 0.007],
    ],
    36,
  )
  const positions = face.getAttribute('position')
  const colors = new Float32Array(positions.count * 3)
  const center = new Color(0x2b9182)
  const standingEdge = new Color(0x176b61)
  const shoulder = new Color(0x083e3a)
  const tint = new Color()
  for (let vertex = 0; vertex < positions.count; vertex++) {
    const radius = Math.hypot(positions.getX(vertex), positions.getZ(vertex))
    // Three.Color converts these authored sRGB colours to linear values before
    // interpolation. Only the enamel material consumes this colour attribute.
    if (radius <= 0.24) tint.lerpColors(center, standingEdge, radius / 0.24)
    else
      tint.lerpColors(
        standingEdge,
        shoulder,
        Math.min(1, (radius - 0.24) / 0.176),
      )
    tint.toArray(colors, vertex * 3)
  }
  face.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return {
    // The terrace is below the marker origin. This closed footing reaches it;
    // the rounded upper lip stays below Merc's existing standing datum.
    plinth: lathe(
      [
        [0, -0.065],
        [0.342, -0.065],
        [0.382, -0.052],
        [0.426, -0.014],
        [0.426, 0.105],
        [0.445, 0.123],
        [0, 0.123],
      ],
      32,
    ),
    crown: lathe(
      [
        [0.408, 0.133],
        [0.425, 0.114],
        [0.481, 0.117],
        [0.493, 0.148],
        [0.471, 0.166],
        [0.443, 0.15],
        [0.423, 0.159],
        [0.412, 0.148],
        [0.408, 0.133],
      ],
      40,
    ),
    face,
    compass: own(
      radialShape(16, (point) =>
        point % 2 === 1 ? 0.026 : point % 4 === 0 ? 0.215 : 0.128,
      ),
    ),
    fascia: own(
      new CylinderGeometry(0.432, 0.432, 0.112, 20, 1, true, -0.48, 0.96),
    ),
    star: own(radialShape(10, (point) => (point % 2 === 0 ? 0.052 : 0.023))),
  }
}

export function createJourneyMedallion(
  stage: MuseumJourneyStage,
  variantIndex: number,
  geometry: JourneyMedallionGeometry,
  materials: JourneyMedallionMaterials,
): { root: Group; stars: JourneyProgressStars } {
  const root = new Group()
  root.name = `${stage.id}-journey-medallion`
  root.position.fromArray(stage.position)
  root.userData.journeyMedallionSurfaceY = JOURNEY_MEDALLION_SURFACE_Y
  const gold = materials.medallionGold ?? materials.gold

  const plinth = new Mesh(geometry.plinth, materials.ivory)
  plinth.name = `${stage.id}-path-medallion`
  plinth.castShadow = true
  plinth.receiveShadow = true
  const crown = new Mesh(geometry.crown, gold)
  crown.name = `${stage.id}-medallion-ring`
  crown.receiveShadow = true
  const face = new Mesh(
    geometry.face,
    materials.medallionGlass ?? materials.jade,
  )
  face.name = `${stage.id}-medallion-face`
  face.position.y = JOURNEY_MEDALLION_FACE_Y
  face.receiveShadow = true
  const compass = new Mesh(geometry.compass, gold)
  compass.name = `${stage.id}-sun-and-route-inlay`
  compass.rotation.set(-Math.PI / 2, 0, (variantIndex * Math.PI) / 16)
  compass.position.y = JOURNEY_MEDALLION_SURFACE_Y + 0.001
  const fascia = new Mesh(geometry.fascia, materials.ivory)
  fascia.name = `${stage.id}-progress-fascia`
  fascia.position.y = 0.045
  fascia.receiveShadow = true

  const earnedStars = new Group()
  earnedStars.name = `${stage.id}-earned-stars`
  const createStar = (slot: 1 | 2 | 3): Mesh => {
    const angle = (slot - 2) * 0.28
    const star = new Mesh(geometry.star, gold)
    star.name = `${stage.id}-progress-star-${slot}`
    star.position.set(Math.sin(angle) * 0.437, 0.045, Math.cos(angle) * 0.437)
    star.rotation.y = angle
    star.visible = false
    star.userData.journeyStarSlot = slot
    return star
  }
  const stars: JourneyProgressStars = [
    createStar(1),
    createStar(2),
    createStar(3),
  ]
  earnedStars.add(...stars)
  root.add(plinth, crown, face, compass, fascia, earnedStars)
  root.traverse((object) => {
    object.userData.journeyStageId = stage.id
  })
  return { root, stars }
}
