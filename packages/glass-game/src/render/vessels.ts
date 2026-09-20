// ============================================================
// Adventure vessels — dimensional glass, an earned stress glow and bounded shatter.
// ============================================================

import type { BufferGeometry, Material, Texture } from 'three'
import { BoxGeometry, DoubleSide, EdgesGeometry, Group, LatheGeometry, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, PlaneGeometry, RingGeometry, Vector2, Vector3, } from 'three'
import type { BreakableDefinition, BreakableSnapshot } from '../contracts'
import { getBreakableRenderRecipe } from './catalog'
import { disposeObject } from './dispose'
import type { FracturePiece } from './fracture'
import { fractureGeometry } from './fracture'
import { createMaterialLibrary } from './material-library'

/** Fallbacks and authored GLBs share the same recipe-sized, floor-based envelope. */
function fitDisplayHeight(
  geometry: BufferGeometry,
  height: number,
): BufferGeometry {
  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox!
  const scale = height / Math.max(0.001, bounds.max.y - bounds.min.y)
  geometry.translate(0, -bounds.min.y, 0)
  geometry.scale(scale, scale, scale)
  return geometry
}

export function createVesselGeometry(variant: string): BufferGeometry {
  const recipe = getBreakableRenderRecipe(variant)
  const shape = recipe.fallbackShape
  if (shape === 'slab') {
    const geometry = new BoxGeometry(0.52, 0.75, 0.09, 6, 8, 1)
    geometry.translate(0, 0.375, 0)
    return fitDisplayHeight(geometry, recipe.displayHeight)
  }
  const profile =
    shape === 'goblet'
      ? [
          [0, 0],
          [0.14, 0],
          [0.16, 0.025],
          [0.055, 0.05],
          [0.025, 0.09],
          [0.025, 0.3],
          [0.095, 0.33],
          [0.17, 0.4],
          [0.2, 0.53],
          [0.19, 0.66],
          [0.177, 0.66],
          [0.185, 0.53],
          [0.155, 0.41],
          [0.08, 0.35],
          [0, 0.34],
        ]
      : shape === 'fluted'
        ? [
            [0, 0],
            [0.12, 0],
            [0.17, 0.05],
            [0.13, 0.18],
            [0.11, 0.42],
            [0.13, 0.65],
            [0.19, 0.78],
            [0.173, 0.78],
            [0.115, 0.64],
            [0.095, 0.42],
            [0.115, 0.18],
            [0.15, 0.065],
            [0, 0.035],
          ]
        : [
            [0, 0],
            [0.11, 0],
            [0.19, 0.045],
            [0.25, 0.19],
            [0.235, 0.35],
            [0.15, 0.45],
            [0.085, 0.49],
            [0.085, 0.57],
            [0.11, 0.6],
            [0.092, 0.6],
            [0.07, 0.56],
            [0.07, 0.485],
            [0.135, 0.435],
            [0.218, 0.34],
            [0.232, 0.19],
            [0.17, 0.06],
            [0, 0.03],
          ]
  const geometry = new LatheGeometry(
    profile.map(([x, y]) => new Vector2(x, y)),
    48,
  )
  if (shape === 'fluted') {
    const attribute = geometry.getAttribute('position')
    for (let i = 0; i < attribute.count; i++) {
      const angle = Math.atan2(attribute.getX(i), attribute.getZ(i))
      const scale = 1 + Math.cos(angle * 12) * 0.055
      attribute.setX(i, attribute.getX(i) * scale)
      attribute.setZ(i, attribute.getZ(i) * scale)
    }
    geometry.computeVertexNormals()
  }
  return fitDisplayHeight(geometry, recipe.displayHeight)
}

export function createVessel(
  target: BreakableDefinition,
  reducedMotion: boolean,
) {
  const recipe = getBreakableRenderRecipe(target.variant)
  const root = new Group()
  const materialLibrary = createMaterialLibrary()
  root.name = `vessel-${target.id}`
  root.position.copy(target.position)
  root.position.y += target.mount?.height ?? 0.255
  if (target.mount !== undefined) root.rotation.y = target.mount.facingYaw
  if (recipe.faceAnchor === true)
    root.rotation.y = Math.atan2(
      target.anchor.x - target.position.x,
      target.anchor.z - target.position.z,
    )
  const glass = new MeshPhysicalMaterial({
    color: recipe.tint,
    metalness: 0,
    roughness: recipe.roughness,
    transmission: recipe.transmission,
    thickness: recipe.thickness,
    ior: 1.48,
    iridescence: 0.8,
    iridescenceThicknessRange: [150, 480],
    clearcoat: 1,
    envMapIntensity: 1.5,
    side: DoubleSide,
    emissive: 0x3fccbe,
    emissiveIntensity: 0,
  })
  const portrait = new MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.24,
    metalness: 0.14,
    clearcoat: 1,
    side: DoubleSide,
  })
  let material: Material | Material[] =
    recipe.portraitTexture !== undefined &&
    recipe.persistentPortrait === undefined
      ? [glass, portrait]
      : glass
  const persistentPortraitRecipe = recipe.persistentPortrait
  let persistentPortrait: Mesh | undefined
  if (persistentPortraitRecipe !== undefined) {
    persistentPortrait = new Mesh(
      new PlaneGeometry(
        persistentPortraitRecipe.width,
        persistentPortraitRecipe.height,
      ),
      portrait,
    )
    persistentPortrait.name = `persistent-portrait-${target.id}`
    persistentPortrait.position.set(
      0,
      persistentPortraitRecipe.centerY,
      persistentPortraitRecipe.z,
    )
    persistentPortrait.visible = false
    root.add(persistentPortrait)
  }
  let intact: Mesh
  let shardMeshes: {
    mesh: Mesh
    origin: Vector3
    velocity: Vector3
    spin: Vector3
  }[] = []
  let cracks: LineSegments[] = []
  const crackMaterial = new LineBasicMaterial({
    color: 0xcaffee,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })
  const shardGroup = new Group()
  shardGroup.name = `vessel-shards-${target.id}`
  root.add(shardGroup)

  function install(geometry: BufferGeometry, authoredPieces?: FracturePiece[]) {
    if (intact !== undefined) {
      intact.geometry.dispose()
      root.remove(intact)
    }
    for (const shard of shardMeshes) shard.mesh.geometry.dispose()
    for (const crack of cracks) {
      crack.geometry.dispose()
      root.remove(crack)
    }
    shardGroup.clear()
    shardMeshes = []
    cracks = []
    intact = new Mesh(geometry, material)
    intact.name = `vessel-intact-${target.id}`
    intact.castShadow = true
    root.add(intact)
    const pieces =
      authoredPieces ?? fractureGeometry(geometry, recipe.fragmentBudget)
    pieces.forEach((piece, i) => {
      const mesh = new Mesh(piece.geometry, material)
      mesh.position.copy(piece.centre)
      mesh.castShadow = true
      const outward = new Vector3(piece.centre.x, 0, piece.centre.z)
      if (outward.lengthSq() < 0.001)
        outward.set(Math.sin(i * 2.4), 0, Math.cos(i * 2.4))
      outward.normalize().multiplyScalar(0.6 + (i % 5) * 0.1)
      outward.y = 0.85 + (i % 4) * 0.12
      shardMeshes.push({
        mesh,
        origin: piece.centre,
        velocity: outward,
        spin: new Vector3(
          Math.sin(i * 2.1),
          Math.cos(i * 1.4),
          Math.sin(i + 1),
        ).multiplyScalar(2.4),
      })
      shardGroup.add(mesh)
      const crack = new LineSegments(
        new EdgesGeometry(piece.geometry, 22),
        crackMaterial,
      )
      crack.position.copy(piece.centre)
      cracks.push(crack)
      root.add(crack)
    })
  }
  const initialGeometry = createVesselGeometry(target.variant)
  if (
    recipe.portraitTexture !== undefined &&
    recipe.persistentPortrait === undefined
  )
    initialGeometry.groups.forEach((group) => {
      group.materialIndex = (group.materialIndex ?? 0) >= 4 ? 1 : 0
    })
  install(initialGeometry)
  shardGroup.visible = false
  const waveMaterial = new MeshBasicMaterial({
    color: 0xb9fff2,
    transparent: true,
    opacity: 0,
    side: DoubleSide,
    depthWrite: false,
  })
  const wave = new Mesh(new RingGeometry(0.22, 0.245, 64), waveMaterial)
  wave.rotation.x = -Math.PI / 2
  wave.position.y = 0.015
  root.add(wave)
  let latest: BreakableSnapshot | undefined
  return {
    root,
    materialLibrary,
    addPersistent(object: Group) {
      root.add(object)
    },
    setGeometry(
      geometry: BufferGeometry,
      authoredPieces?: FracturePiece[],
      authoredMaterials?: Material[],
    ) {
      // A late cosmetic download cannot rewind an already presented break.
      if (latest?.brokenAt !== null && latest?.brokenAt !== undefined) {
        geometry.dispose()
        authoredPieces?.forEach((piece) => piece.geometry.dispose())
        return
      }
      if (authoredMaterials) {
        if (recipe.persistentPortrait === undefined) {
          material = authoredMaterials
          for (const imported of authoredMaterials) {
            if (imported.name !== recipe.portraitMaterial || !portrait.map)
              continue
            const face = imported as MeshPhysicalMaterial
            face.map = portrait.map
            face.needsUpdate = true
          }
        } else {
          material = authoredMaterials.map((imported) =>
            imported.name === recipe.portraitMaterial ? glass : imported,
          )
        }
      }
      install(geometry, authoredPieces)
    },
    setPortrait(texture: Texture) {
      portrait.map = texture
      portrait.needsUpdate = true
      if (persistentPortrait !== undefined) persistentPortrait.visible = true
      // The same image binding survives onto authored intact and fragment slots.
      if (recipe.persistentPortrait !== undefined) return
      for (const imported of materialLibrary.materials) {
        if (imported.name !== recipe.portraitMaterial) continue
        const face = imported as MeshPhysicalMaterial
        face.map = texture
        face.needsUpdate = true
      }
    },
    update(state: BreakableSnapshot, now: number) {
      latest = state
      const restored = state.phase === 'complete' && state.brokenAt === null
      const age =
        state.brokenAt === null ? -1 : Math.max(0, now - state.brokenAt)
      const delay = reducedMotion ? 0 : 0.1
      const shattered = age >= delay && age >= 0
      intact.visible = !restored && !shattered
      const stress =
        age < 0
          ? state.charge * state.charge * 0.8
          : age < delay
            ? 1.5
            : Math.max(0, 0.45 - (age - delay) * 3)
      glass.emissiveIntensity = stress
      for (const imported of materialLibrary.materials) {
        const surface = imported as MeshPhysicalMaterial
        if (!(surface.transmission > 0)) continue
        surface.emissive.setHex(0x3fccbe)
        surface.emissiveIntensity = stress
      }
      crackMaterial.opacity = Math.max(0, state.charge - 0.35) * 0.9
      for (const crack of cracks)
        crack.visible = intact.visible && state.charge > 0.35
      if (!reducedMotion && intact.visible && state.charge > 0.6) {
        intact.rotation.z = Math.sin(now * 48) * (state.charge - 0.6) * 0.018
      } else intact.rotation.z = 0
      const flight = Math.max(0, age - delay)
      shardGroup.visible =
        shattered && !restored && flight < (reducedMotion ? 0.45 : 2.2)
      if (shardGroup.visible)
        for (const shard of shardMeshes) {
          const t = reducedMotion ? flight * 0.14 : flight
          shard.mesh.position
            .copy(shard.origin)
            .addScaledVector(shard.velocity, t)
          shard.mesh.position.y -= 1.7 * t * t
          shard.mesh.rotation.set(
            shard.spin.x * t,
            shard.spin.y * t,
            shard.spin.z * t,
          )
          shard.mesh.scale.setScalar(
            Math.max(0.001, 1 - Math.max(0, flight - 1.45) / 0.75),
          )
        }
      wave.visible = !reducedMotion && shattered && flight < 0.55
      wave.scale.setScalar(1 + flight * 4)
      waveMaterial.opacity = wave.visible ? (1 - flight / 0.55) * 0.65 : 0
    },
    dispose() {
      glass.envMap = null
      disposeObject(
        root,
        new Set([...materialLibrary.materials, glass, portrait, crackMaterial]),
      )
      materialLibrary.dispose()
      glass.dispose()
      portrait.map?.dispose()
      portrait.dispose()
      crackMaterial.dispose()
    },
  }
}
