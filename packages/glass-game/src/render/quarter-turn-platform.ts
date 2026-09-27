// Pearl quarter-turn renderer — install one validated compound visual over its exact two-box gameplay support.

import type { Mesh, Object3D, PerspectiveCamera } from 'three'
import { Group } from 'three'
import { PEARL_QUARTER_TURN_BUNDLE_IDS, PEARL_QUARTER_TURN_NODES, } from '../content/pearl-quarter-turn-profile'
import type { GameSnapshot, LevelDefinition } from '../contracts'
import { disposeObject } from './dispose'
import { createKitInstance, removeKitGeometry } from './kit-instance'
import type { MaterialLibrary } from './material-library'
import type { MuseumMaterials } from './materials'
import { validatePearlQuarterTurnDonor } from './quarter-turn-platform-contract'
import { resolvePearlQuarterTurnPlacements } from './quarter-turn-platform-layout'

function exactRoot(source: Object3D): Object3D {
  const matches: Object3D[] = []
  source.traverse((object) => {
    if (object.name === PEARL_QUARTER_TURN_NODES.root) matches.push(object)
  })
  if (matches.length !== 1)
    throw new Error(
      `Pearl quarter-turn renderer: expected one donor root; found ${matches.length}.`,
    )
  return matches[0]!
}

export function createPearlQuarterTurnPlatformRenderer(
  level: LevelDefinition,
  sceneRoot: Group,
  floors: ReadonlyMap<string, Group>,
  materials: MuseumMaterials,
  materialLibrary: MaterialLibrary,
) {
  const placements = resolvePearlQuarterTurnPlacements(level.platforms)
  const covered = new Set(
    placements.flatMap((placement) => placement.platformIds),
  )
  const root = new Group()
  root.name = 'pearl-quarter-turn-platform-art'
  sceneRoot.add(root)
  let installed:
    | readonly {
        readonly art: Group
        readonly placement: (typeof placements)[number]
      }[]
    | undefined

  return {
    install(sourceScene: Object3D, bundle: string): ReadonlySet<string> {
      if (
        placements.length === 0 ||
        bundle !== PEARL_QUARTER_TURN_BUNDLE_IDS.logical ||
        installed !== undefined
      )
        return new Set()
      for (const id of covered)
        if (!floors.has(id))
          throw new Error(
            `Pearl quarter-turn renderer: platform "${id}" has no fallback floor.`,
          )
      const source = exactRoot(sourceScene)
      validatePearlQuarterTurnDonor(source)
      const template = createKitInstance(source, materials, {}, materialLibrary)
      const transaction = new Group()
      try {
        const staged = placements.map((placement, index) => {
          const art = index === 0 ? template : template.clone(true)
          art.name = `pearl-quarter-turn-${placement.publicPlatformId}`
          art.position.set(
            placement.position.x,
            placement.position.y,
            placement.position.z,
          )
          art.rotation.y = placement.rotationY
          art.visible = false
          art.traverse((object) => {
            const mesh = object as Mesh
            if (!mesh.isMesh) return
            mesh.userData.excludeFromCameraCollision = true
            mesh.castShadow = false
            mesh.receiveShadow = true
          })
          transaction.add(art)
          return { art, placement }
        })
        root.add(transaction)
        for (const id of covered) removeKitGeometry(floors.get(id)!)
        installed = staged
        return covered
      } catch (error) {
        if (transaction.children.length === 0) transaction.add(template)
        disposeObject(transaction, materialLibrary.materials)
        throw error
      }
    },
    update(snapshot: GameSnapshot): void {
      if (installed === undefined) return
      const active = new Set(snapshot.enabledPlatformIds)
      for (const item of installed)
        item.art.visible = item.placement.platformIds.every((id) =>
          active.has(id),
        )
    },
    cullForView(_camera: PerspectiveCamera | undefined): boolean {
      return false
    },
    dispose(): void {
      disposeObject(root, materialLibrary.materials)
      installed = undefined
    },
  }
}
