// Merc, in the scene.
// ============================================================
//
// The asset is three untextured shells and four node-transform clips
// (§6.4a): the Meshy 7 export carries no UVs, no materials and no
// images, and that is fine, because the locked art direction is
// iridescent mercury — a MATERIAL, not a texture. Metal at mirror
// roughness with a thin-film layer, and the environment does all the
// painting. He is lit by the same rig as the glass, which is what makes
// him belong in the room.
//
// The face is the one thing a material cannot supply: it is painted in
// the concept art, not sculpted, so an untextured droplet has no eyes.
// It rides as a decal — a small alpha-mapped plane parented to the body
// node, drawn by canvas code rather than shipped as a file. A decal
// because that makes expression a runtime variable (§6.4a): the same
// plane can blink, listen, and wince when the glass goes.

import type { AnimationClip, Object3D, Texture } from 'three'
import { AnimationMixer, CanvasTexture, DoubleSide, LoopOnce, LoopRepeat, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, PlaneGeometry, SRGBColorSpace, } from 'three'
import { loadMerc } from '../assets'

const INK = '#241913'

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

/**
 * The face, drawn. Two tall friendly ink ovals with a highlight, and a
 * small open smile — the concept sheet's face, reduced to what a decal
 * can carry. 256px is plenty for something a hand's width across.
 */
const faceTexture = (): CanvasTexture => {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext('2d')
  if (g !== null) {
    g.clearRect(0, 0, size, size)

    const eye = (cx: number): void => {
      g.fillStyle = INK
      g.beginPath()
      g.ellipse(cx, 108, 26, 38, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = 'rgba(255,255,255,0.9)'
      g.beginPath()
      g.ellipse(cx + 8, 94, 8, 11, 0, 0, Math.PI * 2)
      g.fill()
    }
    eye(86)
    eye(170)

    g.strokeStyle = INK
    g.lineWidth = 10
    g.lineCap = 'round'
    g.beginPath()
    g.arc(128, 158, 30, Math.PI * 0.2, Math.PI * 0.8)
    g.stroke()
  }
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

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
  let body: Mesh | null = null
  scene.traverse((o) => {
    const mesh = o as Mesh
    if (mesh.isMesh === true) {
      mesh.material = bodyMaterial
      if (mesh.name === 'merc_body') body = mesh
    }
  })

  // Scale to the asked-for height, and lift so the body's lowest point
  // hovers just off the floor -- he floats, that is the body plan.
  const RAW_HEIGHT = 1.65
  const RAW_MIN_Y = -0.689
  const s = height / RAW_HEIGHT
  scene.scale.setScalar(s)
  scene.position.y = -RAW_MIN_Y * s + height * 0.1

  // The face decal, parented to the body NODE so every clip that moves
  // the body carries the face with it. The model faces +z after the
  // Y-up export (Blender -y forward). Slightly proud of the surface and
  // depth-tested but not depth-written, so it hugs the curve without
  // z-fighting it.
  const faceMaterial = new MeshBasicMaterial({
    map: faceTexture(),
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
  })
  const face = new Mesh(new PlaneGeometry(0.62, 0.62), faceMaterial)
  // Proud of the surface (body z tops out at 0.62): let into it, the
  // depth test eats the decal's edges where the droplet curves away.
  face.position.set(0, 0.28, 0.66)
  face.renderOrder = 1
  if (body !== null) (body as Mesh).add(face)

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
      faceMaterial.map?.dispose()
      faceMaterial.dispose()
      face.geometry.dispose()
      scene.traverse((o) => {
        const mesh = o as Mesh
        if (mesh.isMesh === true) mesh.geometry.dispose()
      })
    },
  }
}
