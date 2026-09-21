// Journey Merc — normalize the mascot and settle his feet on the selected medallion.

import type { Material, Mesh } from 'three'
import { AnimationMixer, Box3, Group, MeshPhysicalMaterial, Vector3, } from 'three'
import type { MuseumJourneyStage } from '../content/museum-journey'
import { JOURNEY_MEDALLION_CLEARANCE_Y, journeyMarkerPoint } from './landmarks'
import type { JourneyGltfDocument } from './resources'

export function createJourneyMerc(
  document: JourneyGltfDocument,
  first: MuseumJourneyStage,
) {
  const body = document.scene
  const bounds = new Box3().setFromObject(body)
  const height = Math.max(0.001, bounds.getSize(new Vector3()).y)
  const centre = bounds.getCenter(new Vector3())
  const scale = 0.68 / height
  body.scale.setScalar(scale)
  // A donor's origin is not necessarily the centre of its rendered footprint.
  // Normalizing the child leaves the parent at the actual standing point.
  body.position.set(-centre.x * scale, -bounds.min.y * scale, -centre.z * scale)
  const metal = new MeshPhysicalMaterial({
    color: 0xf4f7f8,
    metalness: 1,
    roughness: 0.07,
    iridescence: 0.8,
    iridescenceIOR: 1.65,
    iridescenceThicknessRange: [120, 460],
    envMapIntensity: 1.25,
  })
  const replacedMaterials = new Map<Mesh, Material | Material[]>()
  body.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    if (mesh.name === 'merc_body' || mesh.name.startsWith('merc_hand')) {
      replacedMaterials.set(mesh, mesh.material)
      mesh.material = metal
    }
    mesh.castShadow = true
    mesh.receiveShadow = true
  })
  const root = new Group()
  root.name = 'journey-merc'
  root.add(body)
  const target = new Vector3().fromArray(
    journeyMarkerPoint(first, JOURNEY_MEDALLION_CLEARANCE_Y),
  )
  root.position.copy(target)
  const mixer = new AnimationMixer(body)
  const idle =
    document.animations.find((clip) => /listen|idle/i.test(clip.name)) ??
    document.animations[0]
  if (idle !== undefined) mixer.clipAction(idle).play()
  let disposed = false
  return {
    root,
    setTarget(stage: MuseumJourneyStage, immediate: boolean) {
      if (disposed) return
      target.fromArray(journeyMarkerPoint(stage, JOURNEY_MEDALLION_CLEARANCE_Y))
      if (immediate) root.position.copy(target)
    },
    update(dt: number, reducedMotion: boolean) {
      if (disposed) return
      const safeDt = Math.max(0, Math.min(0.05, dt))
      mixer.update(reducedMotion ? 0 : safeDt)
      if (reducedMotion) root.position.copy(target)
      else {
        root.position.lerp(target, 1 - Math.exp(-4.8 * safeDt))
        if (root.position.distanceToSquared(target) < 1e-10)
          root.position.copy(target)
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      mixer.stopAllAction()
      mixer.uncacheRoot(body)
      // Restore the donor graph so its document can retire original materials
      // and shared textures once, including maps the metallic override hid.
      replacedMaterials.forEach((material, mesh) => {
        mesh.material = material
      })
      replacedMaterials.clear()
      metal.dispose()
      document.dispose()
    },
  }
}
