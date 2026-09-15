// ============================================================
// Adventure Merc — the original skinned mascot, anchored to gameplay feet.
// ============================================================
// Adapted from BesideCue's games/glass3d/render/merc.ts. This package owns
// its loader and resources; it never imports either application's internals.

import type { AnimationAction, Mesh, Texture } from 'three'
import { AnimationMixer, Box3, Group, LoopOnce, LoopRepeat, MeshPhysicalMaterial, Vector3, } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { GameSnapshot } from '../contracts'
import { disposeObject } from './dispose'

export async function loadAdventureMerc(url: string, environment: Texture) {
  const gltf = await new GLTFLoader().loadAsync(url)
  const body = gltf.scene
  const bounds = new Box3().setFromObject(body)
  const height = bounds.getSize(new Vector3()).y
  const scale = 0.55 / Math.max(height, 0.001)
  const torso = body.getObjectByName('merc_body') ?? body
  const feetY = new Box3().setFromObject(torso).min.y
  const metal = new MeshPhysicalMaterial({
    color: 0xf4f7f8,
    metalness: 1,
    roughness: 0.065,
    iridescence: 0.85,
    iridescenceIOR: 1.65,
    iridescenceThicknessRange: [120, 480],
    envMap: environment,
    envMapIntensity: 1.25,
  })
  body.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    // GLTFLoader creates an unnamed default material for unassigned shells.
    // The exported merc_eye material belongs to the authored face and stays.
    if (mesh.name === 'merc_body' || mesh.name.startsWith('merc_hand')) {
      for (const material of Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material])
        material.dispose()
      mesh.material = metal
    }
    mesh.castShadow = true
    mesh.receiveShadow = true
  })
  const root = new Group()
  root.name = 'adventure-merc'
  root.add(body)
  const mixer = new AnimationMixer(body)
  const clips = new Map(gltf.animations.map((clip) => [clip.name, clip]))
  let current: AnimationAction | undefined
  let clipName = ''
  let wasGrounded = true
  let squash = 0
  let celebrateUntil = 0
  let completed = 0
  const play = (name: string, still: boolean) => {
    const clip = clips.get(name)
    if (!clip) return
    if (name !== clipName) {
      const previous = current
      current = mixer
        .clipAction(clip)
        .reset()
        .setLoop(name === 'celebrate' ? LoopOnce : LoopRepeat, Infinity)
        .play()
      current.clampWhenFinished = true
      if (previous) current.crossFadeFrom(previous, 0.16, false)
      clipName = name
    }
    if (current) current.timeScale = still ? 0 : 1
  }
  return {
    root,
    update(snapshot: GameSnapshot, dt: number, reducedMotion: boolean) {
      const player = snapshot.player
      const count = snapshot.breakables.filter(
        (item) => item.phase === 'complete',
      ).length
      if (count > completed) celebrateUntil = snapshot.elapsedSeconds + 1.15
      completed = count
      const active = snapshot.breakables.some(
        (item) => item.phase === 'charging' || item.phase === 'listening',
      )
      const moving = Math.hypot(player.velocity.x, player.velocity.z) > 0.08
      const name =
        snapshot.elapsedSeconds < celebrateUntil
          ? 'celebrate'
          : !player.grounded
            ? 'fall'
            : active
              ? 'sing'
              : moving
                ? 'move'
                : 'listen'
      play(name, reducedMotion && !moving && !active)
      mixer.update(Math.max(0, dt))
      if (player.grounded && !wasGrounded) squash = 0.18
      wasGrounded = player.grounded
      squash *= Math.exp(-13 * dt)
      const stretch = reducedMotion ? 1 : player.grounded ? 1 - squash : 1.07
      body.scale.set(
        scale / Math.sqrt(stretch),
        scale * stretch,
        scale / Math.sqrt(stretch),
      )
      body.position.y = -feetY * scale * stretch + 0.015
      root.position.copy(player.position)
      const desiredYaw = player.facingYaw + Math.PI
      const angle = Math.atan2(
        Math.sin(desiredYaw - root.rotation.y),
        Math.cos(desiredYaw - root.rotation.y),
      )
      root.rotation.y += angle * Math.min(1, dt * 15)
    },
    dispose() {
      mixer.stopAllAction()
      mixer.uncacheRoot(body)
      // Environment belongs to the scene, not this actor.
      metal.envMap = null
      disposeObject(root)
    },
  }
}
