// Loading the Cabinet's geometry, and reading the sim's input out of it.
// ============================================================
//
// The .glb files are produced by `art/glass/make_*.py` and optimized by
// `pnpm assets:glass`, which also copies them here.
//
// The important part of this module is `readShards`. `solveShatter`
// wants a list of centroids and does not care where they come from; in
// the shipped scene they come from each shard node's translation, which
// Blender wrote from the shard's own centre of volume. That convention
// is the entire asset contract, and `glass-assets.test.ts` pins it
// against the committed files — so a bad export fails in CI rather than
// on a device.

import type { AnimationClip, Mesh, Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { Vec3 } from './sim/shatter3d'

export interface ShardAsset {
  /** One mesh per shard, in shard_000.. order. */
  meshes: Mesh[]
  /** Where each shard sat in the intact glass — solveShatter's input. */
  centroids: Vec3[]
}

// Plain GLTFLoader, no compression extension. The assets are small
// enough that meshopt costs more in decoder bytes than it saves (see
// scripts/assets-glass.sh), and skipping it keeps the app off
// `wasm-unsafe-eval`.
const loader = (): GLTFLoader => new GLTFLoader()

const load = async (url: string): Promise<Object3D> => {
  const gltf = await loader().loadAsync(url)
  return gltf.scene
}

/** The intact glass and its foot, as one group. */
export const loadGlass = async (base = 'games/glass3d'): Promise<Object3D> =>
  load(`${base}/glass.glb`)

export interface MercAsset {
  scene: Object3D
  /** sing, listen, celebrate, fall, move — node-transform clips, no rig. */
  clips: AnimationClip[]
}

/** Merc: body, hands, face, rig and clips. Dressing him is render/merc.ts. */
export const loadMerc = async (base = 'games/glass3d'): Promise<MercAsset> => {
  const gltf = await loader().loadAsync(`${base}/merc.glb`)
  return { scene: gltf.scene, clips: gltf.animations }
}

/**
 * The shard set, ordered and paired with the centroids that drive the
 * shatter.
 *
 * Ordering is by node name rather than traversal order: the sim indexes
 * launches positionally against `meshes`, and glTF makes no promise
 * about the order a scene graph walks in.
 */
export const loadShards = (base = 'games/glass3d'): Promise<ShardAsset> =>
  loadShardSet(`${base}/shards.glb`, 'shard_')

/** The hallway pane's break, same contract under a different prefix. */
export const loadPaneShards = (base = 'games/glass3d'): Promise<ShardAsset> =>
  loadShardSet(`${base}/pane-shards.glb`, 'pane_')

const loadShardSet = async (
  url: string,
  prefix: string,
): Promise<ShardAsset> => {
  const scene = await load(url)

  const found: Mesh[] = []
  scene.traverse((o) => {
    if ((o as Mesh).isMesh === true && o.name.startsWith(prefix)) {
      found.push(o as Mesh)
    }
  })
  found.sort((a, b) => a.name.localeCompare(b.name))

  return {
    meshes: found,
    // The node's own translation, read before anything reparents it.
    centroids: found.map((m) => ({
      x: m.position.x,
      y: m.position.y,
      z: m.position.z,
    })),
  }
}
