// Merc, in the scene.
// ============================================================
//
// The asset is three untextured shells, a face, a five-bone skin and
// five clips (§6.4a): the Meshy 7 export carries no UVs, no materials
// and no images, and that is fine, because the locked art direction is
// iridescent mercury — a MATERIAL, not a texture. Metal at mirror
// roughness with a thin-film layer, and the environment does all the
// painting. He is lit by the same rig as the glass, which is what makes
// him belong in the room.
//
// The face belongs to the ASSET, not to this file. That is a reversal,
// and it is worth saying why so nobody re-adds what was removed.
//
// This module used to paint a face onto a small plane and float it in
// front of him, because the Meshy export has no textures and a chrome
// droplet cannot show an expression. The trouble is that the sculpt
// carries a face of its own -- eye sockets and a mouth, pressed into the
// body -- so he had two, at different sizes, in different places. It was
// invisible while he was a dark lump and obvious the moment the room
// got lit.
//
// Removing the plane is not enough on its own, and a roughness sweep is
// what settled it: from mirror (0.15) through matte (0.55), and from
// full metal down to 0.2, the sculpted sockets never stop being faint
// white-on-white outlines. That is not a tuning failure, it is what a
// mirror IS -- it shows the room, not its own shape, so shallow relief
// has nothing to shade. No material setting recovers a face carved into
// chrome.
//
// So the eyes have to be their own geometry with their own dark
// material, which is how games have always done stylised eyes, and they
// have to come out of Blender inside the glb. This file's job is to
// dress the body and stay out of the way of anything the file already
// dresses itself -- see `applyBody` below.

import type { AnimationClip, Material, Mesh, Object3D, Texture } from 'three'
import { AnimationMixer, Box3, LoopOnce, LoopRepeat, MeshPhysicalMaterial, Vector3, } from 'three'
import { loadMerc } from '../assets'

/**
 * The body: mercury. Full metal, near-mirror, and a thin-film layer for
 * the oil-slick shimmer the concept sheet has. Everything visible on
 * him is the room, bent — exactly like the glass, one register shinier.
 *
 * The environment is passed in rather than inherited from the scene,
 * and that is not a style preference. three resolves the strength of
 * image-based lighting as `material.envMap ? material.envMapIntensity :
 * scene.environmentIntensity` (`nodes/accessors/MaterialProperties.js`),
 * so a material with no `envMap` of its own has its `envMapIntensity`
 * silently ignored — which is what happened to the 1.15 that was meant
 * to make Merc read shinier than the glass around him. Handing him the
 * texture makes the number mean something again.
 *
 * `roughness` is a liquid's, not a polished solid's. At 0.12 he was a
 * ball bearing; mercury holds a sharp enough reflection to show the
 * horizon line, and now that there is a horizon in the map to show,
 * that is worth spending.
 */
export const mercMaterial = (
  envMap: Texture | null = null,
): MeshPhysicalMaterial =>
  new MeshPhysicalMaterial({
    color: 0xf4f7f8,
    metalness: 1,
    roughness: 0.06,
    iridescence: 0.85,
    iridescenceIOR: 1.65,
    iridescenceThicknessRange: [120, 480],
    envMap,
    envMapIntensity: 1.25,
  })

export interface MercActor {
  /** The root to add to the scene. Scaled so Merc stands `height` tall. */
  root: Object3D
  /** Play a clip by name. Unknown names are ignored, deliberately —
   * a missing clip should degrade to stillness, not to a crash. */
  play(name: string, opts?: { loop?: boolean; fade?: number }): void
  /** Advance the mixer. */
  update(dt: number): void
  dispose(): void
}

/**
 * Load Merc, dress him, and hand back something a stage can direct.
 *
 * `height` is his standing height in metres — the raw asset is ~1.65
 * units tall (Meshy normalises to its own box), which is the size of a
 * person, and he is a creature that fits beside a wine glass.
 *
 * `envMap` is the room he reflects. Pass the stage's own environment;
 * without it he falls back to the scene's, at the scene's strength.
 */
export const createMerc = async (
  height = 0.55,
  envMap: Texture | null = null,
): Promise<MercActor> => {
  const { scene, clips } = await loadMerc()

  const bodyMaterial = mercMaterial(envMap)
  // Mercury goes on what the file left bare, and ONLY on that. The body
  // and hands arrive with no material and get it; the face arrives with
  // its own dark dielectric (`merc_eye`, built in art/merc/make_merc.py)
  // and keeps it. Painting mercury over everything would turn the eyes
  // back into chrome, which is the exact failure this file exists to
  // avoid. Deferring to the asset is what lets the model gain parts
  // without this file being edited again.
  scene.traverse((o) => {
    const mesh = o as Mesh
    if (mesh.isMesh !== true) return
    const existing = mesh.material as Material | Material[] | undefined
    const bare =
      existing === undefined ||
      (Array.isArray(existing) ? existing.length === 0 : !existing.isMaterial)
    if (bare) mesh.material = bodyMaterial
  })

  // Scale to the asked-for height and lift so his lowest point hovers
  // just off the floor -- he floats, that is the body plan.
  //
  // Measured rather than hardcoded. The old constants (1.65 tall, base
  // at -0.689) were true of one export, and every re-rig, every added
  // eye, every shape key that moves a vertex makes them a little less
  // true -- silently, as a character who sinks into the floor or drifts
  // above it. Box3 asks the model instead.
  const bounds = new Box3().setFromObject(scene)
  const size = bounds.getSize(new Vector3())
  const rawHeight = size.y > 1e-6 ? size.y : 1
  const s = height / rawHeight
  scene.scale.setScalar(s)
  scene.position.y = -bounds.min.y * s + height * 0.1

  const mixer = new AnimationMixer(scene)
  const byName = new Map<string, AnimationClip>(clips.map((c) => [c.name, c]))
  let current: string | null = null

  return {
    root: scene,
    play(name, opts = {}): void {
      if (current === name) return
      const clip = byName.get(name)
      if (clip === undefined) return
      const action = mixer.clipAction(clip)
      action.reset()
      action.setLoop(
        opts.loop === false ? LoopOnce : LoopRepeat,
        opts.loop === false ? 1 : Infinity,
      )
      action.clampWhenFinished = true
      const fade = opts.fade ?? 0.25
      mixer.stopAllAction()
      action.fadeIn(fade).play()
      current = name
    },
    update(dt): void {
      mixer.update(dt)
    },
    dispose(): void {
      mixer.stopAllAction()
      bodyMaterial.dispose()
      scene.traverse((o) => {
        const mesh = o as Mesh
        if (mesh.isMesh === true) mesh.geometry.dispose()
      })
    },
  }
}
