// Glass bench looks — what a shot's glass wears: the materials as authored in the GLB, or a draft of a library look.
import type { Material, Object3D, Texture } from 'three'
import { Mesh, MeshBasicMaterial, MeshPhysicalMaterial } from 'three'
import type { GlassOptics } from '../render/glass-material'
import { GlassMaterial } from '../render/glass-material'

export type BenchLookId = 'authored' | 'studio-amber'

export const BENCH_LOOKS: readonly BenchLookId[] = ['authored', 'studio-amber']

/**
 * Today's amber on the swatches: the procedural urn's own `amber_glass`
 * (art/glass-adventure/procedural/amber-cadence-urn/build.py and optics.json).
 */
export function todaysAmber(thickness: number): MeshPhysicalMaterial {
  const material = new MeshPhysicalMaterial({
    color: 0xffcc4d,
    roughness: 0.4,
    transmission: 0.9,
    ior: 1.52,
    clearcoat: 0.5,
    clearcoatRoughness: 0.03,
    thickness,
    attenuationDistance: 0.06,
  })
  material.attenuationColor.setRGB(0.965, 0.745, 0.254)
  material.name = 'amber_glass (today)'
  return material
}

/**
 * A first, untuned draft of the studio amber. White base, amber absorption
 * (never both tints), a glow that grows with the path through the glass, and
 * back-light from lamps behind it.
 */
export const STUDIO_AMBER_DRAFT: GlassOptics = {
  technique: 'studio',
  transmission: 0.96,
  ior: 1.52,
  attenuationColor: '#f2a93b',
  attenuationDistance: 0.02,
  thickness: 0.02,
  refractionRoughness: 0.12,
  refractionGain: 1,
  glowColor: '#f2a93b',
  glow: 0.18,
  glowThickness: 0.04,
  backLight: 0.5,
  backLightPower: 3,
  backLightDistortion: 0.35,
}

export function studioAmber(
  studio: Texture,
  optics: Partial<GlassOptics> = {},
): GlassMaterial {
  const material = new GlassMaterial(
    { ...STUDIO_AMBER_DRAFT, ...optics },
    {
      color: 0xffffff,
      roughness: 0.06,
      clearcoat: 0.6,
      clearcoatRoughness: 0.03,
    },
  )
  material.envMap = studio
  material.name = 'glass.amber (studio draft)'
  return material
}

const MASK = new MeshBasicMaterial({ color: 0xffffff, toneMapped: false })

/** Swaps materials by look and restores the authored ones on demand. */
export function createLookDresser(studio: () => Texture) {
  const authored = new WeakMap<Mesh, Material | Material[]>()
  const drafts = new Map<Material, Material>()

  function draftFor(source: Material): Material {
    const cached = drafts.get(source)
    if (cached !== undefined) return cached
    if (!/amber/i.test(source.name)) return source
    const physical = source instanceof MeshPhysicalMaterial ? source : undefined
    const map = physical?.thicknessMap ?? null
    const cut = /cut/i.test(source.name)
    // Keep the vessel's thickness map; tint density follows its own factor.
    const thickness =
      map !== null && physical !== undefined
        ? physical.thickness
        : STUDIO_AMBER_DRAFT.thickness
    const draft = studioAmber(studio(), {
      thickness,
      attenuationDistance:
        (map !== null
          ? thickness * 0.5
          : STUDIO_AMBER_DRAFT.attenuationDistance) * (cut ? 0.6 : 1),
    })
    if (map !== null) draft.setThicknessMap(map, map.channel === 1 ? 1 : 0)
    if (cut) draft.roughness = 0.08
    drafts.set(source, draft)
    return draft
  }

  return {
    wear(root: Object3D, look: BenchLookId | 'mask'): void {
      root.traverse((object) => {
        if (!(object instanceof Mesh)) return
        if (!authored.has(object)) authored.set(object, object.material)
        const original = authored.get(object) as Material | Material[]
        if (look === 'authored') object.material = original
        else if (look === 'mask') object.material = MASK
        else
          object.material = Array.isArray(original)
            ? original.map(draftFor)
            : draftFor(original)
      })
    },
  }
}
