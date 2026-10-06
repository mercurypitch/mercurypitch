// Skinned pose publishing — keep animated actors current independently of cached shadow passes.

import type { Object3D, Skeleton } from 'three'
import { SkinnedMesh } from 'three'

/** Capture shared skeletons once; call after the actor's pose and root transform settle. */
export function createSkinnedPosePublisher(root: Object3D): () => void {
  const skeletons = new Set<Skeleton>()
  root.traverse((object) => {
    if (object instanceof SkinnedMesh) skeletons.add(object.skeleton)
  })
  return () => {
    if (skeletons.size === 0) return
    // Three r185 projects skinned meshes before incrementing its frame ID,
    // then updates shadow casters using the new ID. When the next frame
    // reuses shadows, its object cache can retain the preceding bone texture.
    // Publish this tiny actor palette explicitly, without rendering shadows
    // again or modifying the renderer's private frame/cache state.
    root.updateWorldMatrix(true, false)
    root.updateMatrixWorld(true)
    skeletons.forEach((skeleton) => skeleton.update())
  }
}
