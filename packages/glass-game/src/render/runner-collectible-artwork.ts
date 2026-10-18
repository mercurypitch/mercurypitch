// Runner collectible artwork — one owned camera-facing cutout follows its authored pickup's chunk lifetime.

import type { Camera, Object3D, Texture } from 'three'
import { Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion } from 'three'
import { COLLECTIBLE_ARTWORK_BASE_METERS, normalizeCollectibleArtworkScale, } from '../core/collectible-artwork'
import { RUNNER_COLLECTIBLE_ARTWORK } from '../runner/collectible-presentation'
import type { CompiledRunnerRewardDefinition, RunnerSnapshot, } from '../runner/contracts'

export function createRunnerCollectibleArtwork(
  pickup: CompiledRunnerRewardDefinition['pickups'][number],
  texture: Texture,
  initialScale?: number,
) {
  const geometry = new PlaneGeometry(
    COLLECTIBLE_ARTWORK_BASE_METERS,
    COLLECTIBLE_ARTWORK_BASE_METERS,
  )
  // Opaque alpha-cutout participates in Three's transmission source pass.
  // The transparent route paints after glass, which would omit this pickup
  // from refraction. Coverage keeps the cutout edge smooth on MSAA targets.
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: false,
    alphaTest: 0.5,
    alphaToCoverage: true,
    toneMapped: false,
    depthTest: true,
    depthWrite: true,
  })
  const mesh = new Mesh(geometry, material)
  mesh.name = 'runner-collectible-c01'
  mesh.userData.pickupId = pickup.id
  mesh.userData.artworkId = RUNNER_COLLECTIBLE_ARTWORK.assetId
  mesh.position.set(pickup.lateralX, 0.6, -pickup.courseDistanceMeters)
  mesh.scale.setScalar(normalizeCollectibleArtworkScale(initialScale))
  mesh.visible = false
  const cameraRotation = new Quaternion()
  const parentRotation = new Quaternion()
  let disposed = false

  return {
    pickupId: pickup.id,
    attach(group: Object3D, chunkId: string) {
      if (!disposed && chunkId === pickup.chunkId) group.add(mesh)
    },
    retireChunk(chunkId: string) {
      if (chunkId === pickup.chunkId) {
        mesh.removeFromParent()
        mesh.visible = false
      }
    },
    update(snapshot: RunnerSnapshot) {
      mesh.visible =
        !disposed &&
        mesh.parent !== null &&
        snapshot.residentChunkIds.includes(pickup.chunkId) &&
        !snapshot.collectedRewardIds.includes(pickup.id)
    },
    faceCamera(camera: Camera) {
      if (disposed || !mesh.parent) return
      camera.getWorldQuaternion(cameraRotation)
      mesh.parent.getWorldQuaternion(parentRotation)
      mesh.quaternion.copy(parentRotation.invert().multiply(cameraRotation))
    },
    setScale(scale: number) {
      if (!disposed)
        mesh.scale.setScalar(normalizeCollectibleArtworkScale(scale))
    },
    async withWarmupState(parent: Object3D, prepare: () => Promise<void>) {
      if (disposed) return
      const previousParent = mesh.parent
      const previousVisibility = mesh.visible
      // Its later course chunk need not be resident at the starting snapshot.
      // Temporarily include this one material in the existing loading draw so
      // its program and texture never first upload during a running approach.
      if (!previousParent) parent.add(mesh)
      mesh.visible = true
      try {
        await prepare()
      } finally {
        if (!disposed) {
          if (!previousParent) mesh.removeFromParent()
          mesh.visible = previousVisibility
        }
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      mesh.visible = false
      mesh.removeFromParent()
      geometry.dispose()
      material.dispose()
      // The renderer owns the loaded texture, including late-load cleanup.
    },
  }
}
