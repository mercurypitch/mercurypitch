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
import { AnimationMixer, Box3, Group, LoopOnce, LoopRepeat, MeshPhysicalMaterial, Vector3, } from 'three'
import type { MercAsset } from '../assets'
import { loadMerc } from '../assets'
import { bodyLiftFor, feetBelowRoot } from './merc-anchor'

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
  /** The node to add to the scene, and the ONLY one a caller should
   * move. It carries no scale and no offset of its own, so a stage can
   * own `position` and `rotation` outright while `setShape` owns the
   * body inside it. */
  root: Object3D
  /**
   * Squash and stretch him, as multiples of the shape he was built at.
   *
   * `setShape(1, 1)` is the Merc `createMerc` handed back, posed at the
   * same scale to the last bit. Both factors are ratios rather than
   * metres on purpose: this module has no opinion about what a world
   * calls a puddle, and a world that does can keep its own numbers
   * without this file learning them.
   *
   * His FEET STAY WHERE THEY ARE. See the note in the body for why that
   * is not what falls out of scaling him, and why it is the one thing
   * a caller cannot reasonably do from outside.
   */
  setShape(widthScale: number, heightScale: number): void
  /**
   * The two facts a room needs about the space he occupies, in metres.
   *
   * `height` is the whole actor, mitts included -- the same box
   * `createMerc` scaled him by. `feetBelowRoot` is how far under
   * `root.position.y` his lowest point hangs, and it does NOT move when
   * the shape does: holding it still is what `setShape` is for.
   */
  metrics(): { height: number; feetBelowRoot: number }
  /** Play a clip by name. Unknown names are ignored, deliberately —
   * a missing clip should degrade to stillness, not to a crash.
   * `still` fades the clip in and holds its first frame: his idle
   * breathing under reduced motion (P6), reached without freezing the
   * pose he was leaving halfway through the fade. */
  play(
    name: string,
    opts?: { loop?: boolean; fade?: number; still?: boolean },
  ): void
  /** Advance the mixer. */
  update(dt: number): void
  dispose(): void
}

/**
 * His file, fetched and parsed before a stage asks for him.
 *
 * P7 (slice-5-polish-to-v1.md §2.1): the games list starts this while it
 * is read (runtime/warm.ts decides when), and the next `createMerc` takes
 * it instead of starting a load of its own. Held for ONE actor: dressing
 * him writes to the loaded scene -- his materials, his scale, the wrapper
 * he is parented to -- so a second actor built from the same load would
 * share, and fight over, the first one's body. The list warms again the
 * next time it is shown.
 */
let warmed: Promise<MercAsset> | null = null

/** Start loading him now, for the next `createMerc`. A warm already held
 * is kept rather than doubled. */
export const warmMerc = (): void => {
  if (warmed !== null) return
  const loading = loadMerc()
  // It may never be taken -- the Cabinet has no Merc -- and a failure
  // nobody took must not surface as an unhandled rejection. One that is
  // taken is retried in `takeMercAsset`, and that load reports its own.
  loading.catch(() => {})
  warmed = loading
}

/** Let go of a warm no stage took: the list was left for Home. */
export const dropWarmMerc = (): void => {
  warmed = null
}

const takeMercAsset = async (): Promise<MercAsset> => {
  const held = warmed
  warmed = null
  if (held !== null) {
    try {
      return await held
    } catch {
      // A warm that failed on the list is not this stage's answer: it
      // loads him itself, as every stage did before the warm existed.
    }
  }
  return loadMerc()
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
  const { scene, clips } = await takeMercAsset()

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

  // Scale to the asked-for height.
  //
  // Measured rather than hardcoded. The old constants (1.65 tall, base
  // at -0.689) were true of one export, and every re-rig, every added
  // eye, every shape key that moves a vertex makes them a little less
  // true -- silently, as a character who sinks into the floor or drifts
  // above it. Box3 asks the model instead.
  //
  // Measured on 2026-09-04, for anyone reading the numbers below:
  // the whole actor is 1.8274 x 1.9028 x 1.2639, and `bounds.min.y` is
  // -0.9519 -- almost exactly half the height, so THE ROOT ORIGIN SITS
  // AT HIS VERTICAL CENTRE, not at his feet.
  const bounds = new Box3().setFromObject(scene)
  const size = bounds.getSize(new Vector3())
  const rawHeight = size.y > 1e-6 ? size.y : 1
  const s = height / rawHeight
  scene.scale.setScalar(s)

  // Why he is wrapped, and why the hover that used to be on this line
  // is gone.
  // ------------------------------------------------------------
  //
  // There was a `scene.position.y = -bounds.min.y * s + height * 0.1`
  // here, meaning "lift him so his lowest point hovers just off the
  // floor". It never ran: EVERY caller -- both stages and the probe --
  // assigns `root.position.y` from the simulation on the very next
  // frame, so the offset was overwritten before it was ever seen. What
  // actually anchors him is the root origin, which is his centre, and
  // the floor is a non-occluding gradient (`depthWrite: false`), so
  // half a hovering droplet sitting under the floor line reads as
  // hovering rather than as sunk. That is the shipped look and this
  // change does not touch it.
  //
  // It becomes load-bearing the moment the shape moves. Anchored at his
  // centre, scaling his height grows him DOWNWARD as much as upward: a
  // squashed Merc rises off the floor and a stretched one sinks through
  // it, both silently, and neither reads as squash or stretch. The
  // player sees him bob.
  //
  // So the body lives inside a wrapper. The wrapper is `root` and
  // carries nothing but what the caller puts there; the body carries
  // the scale and a counter-offset that holds his lowest point exactly
  // where the rest shape left it. At `setShape(1, 1)` the offset is
  // zero and the result is the shipped Merc, unchanged.
  const body = scene
  const root = new Group()
  root.name = 'merc'
  root.add(body)

  // The arithmetic lives in merc-anchor.ts, pure and tested, because
  // the first version of it here had the sign backwards and a check at
  // rest could not tell.
  //
  // THE ANCHOR IS THE TORSO, not the whole box. His feet, as far as a
  // player can tell, are the bottom of his body: the mitts hang 25 cm
  // below it in the bind pose and beside it in every clip that plays,
  // so holding the box's bottom still holds a point nobody sees and
  // lets the body itself drift by the difference, scaled. 0.2023 m
  // under the root for this export; the whole box would say 0.2751.
  const torso = ((): Object3D | null => {
    let found: Object3D | null = null
    scene.traverse((o) => {
      if ((o as Mesh).isMesh === true && o.name === 'merc_body') found = o
    })
    return found
  })()
  const torsoBounds = torso === null ? bounds : new Box3().setFromObject(torso)
  const anchor = { rawMinY: torsoBounds.min.y, rawHeight, restHeight: height }
  const restFeet = feetBelowRoot(anchor)
  let shape = { width: 1, height: 1 }

  const setShape = (widthScale: number, heightScale: number): void => {
    const w = Number.isFinite(widthScale) ? Math.max(1e-3, widthScale) : 1
    const h = Number.isFinite(heightScale) ? Math.max(1e-3, heightScale) : 1
    shape = { width: w, height: h }
    body.scale.set(s * w, s * h, s * w)
    // Hold the feet: the lowest point would otherwise ride the centre.
    body.position.y = bodyLiftFor(anchor, h)
  }
  setShape(1, 1)

  const mixer = new AnimationMixer(body)
  const byName = new Map<string, AnimationClip>(clips.map((c) => [c.name, c]))
  let current: string | null = null

  return {
    root,
    setShape,
    metrics(): { height: number; feetBelowRoot: number } {
      return { height: height * shape.height, feetBelowRoot: restFeet }
    },
    play(name, opts = {}): void {
      const clip = byName.get(name)
      if (clip === undefined) return
      const action = mixer.clipAction(clip)
      // Held or moving is the clip's own clock. The fade is weighed on
      // the mixer's, so a held clip still fades in all the way.
      action.timeScale = opts.still === true ? 0 : 1
      // The same clip asked to hold or to move again: no restart, or
      // the fade would be seen twice.
      if (current === name) return
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
      body.traverse((o) => {
        const mesh = o as Mesh
        if (mesh.isMesh === true) mesh.geometry.dispose()
      })
    },
  }
}
