// Glass bench looks — what a shot's glass wears: the materials as authored in the GLB, or a draft of a library look.
import type { Material, Object3D, Texture } from 'three'
import { Mesh, MeshBasicMaterial, MeshPhysicalMaterial } from 'three'
import type { GlassOptics } from '../render/glass-material'
import { GlassMaterial } from '../render/glass-material'

/**
 * Phase 1's amber candidates (docs/plans/glass-look-system-2026-10-23.md):
 * - `authored`: A, the vessel's own materials as the game draws them today;
 * - `screen-amber`: B, Three's transmission over a lit liner inside the vessel;
 * - `studio-amber`: C, glass that carries its own light: studio refraction, a
 *   glow that grows with the path through it, and back-light.
 */
export type BenchLookId = 'authored' | 'screen-amber' | 'studio-amber'

export const BENCH_LOOKS: readonly BenchLookId[] = [
  'authored',
  'screen-amber',
  'studio-amber',
]

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

// The urn's thickness map runs about 4:1 from crease to lobe. Both candidates
// keep 40% of its factor over a 35 mm floor, under 2:1, so the lobes read gold
// and the creases deeper amber instead of pale yellow against orange.
const MAP_SCALE = 0.4
const MAP_FLOOR = 0.035

/** C, round 1. White base, amber absorption only (never both tints). */
export const STUDIO_AMBER_V1: GlassOptics = {
  technique: 'studio',
  transmission: 0.96,
  ior: 1.52,
  attenuationColor: '#f2a93b',
  attenuationDistance: 0.055,
  thickness: 0.02,
  thicknessFloor: MAP_FLOOR,
  refractionRoughness: 0.16,
  refractionGain: 1,
  refractionStrength: 0.3,
  glowColor: '#f2a93b',
  glow: 0.3,
  glowThickness: 0.08,
  backLight: 0.5,
  backLightPower: 3,
  backLightDistortion: 0.35,
}

/** B, round 1. Three's transmission; the lit liner behind the glass is its light. */
export const SCREEN_AMBER_V1: GlassOptics = {
  technique: 'screen',
  transmission: 0.96,
  ior: 1.52,
  attenuationColor: '#f2a93b',
  attenuationDistance: 0.055,
  thickness: 0.02,
  thicknessFloor: MAP_FLOOR,
}

export type AmberLookId = Exclude<BenchLookId, 'authored'>

export function amberLook(
  look: AmberLookId,
  studio: Texture,
  optics: Partial<GlassOptics> = {},
): GlassMaterial {
  const base = look === 'studio-amber' ? STUDIO_AMBER_V1 : SCREEN_AMBER_V1
  const material = new GlassMaterial(
    { ...base, ...optics },
    {
      color: 0xffffff,
      roughness: 0.06,
      clearcoat: 0.6,
      clearcoatRoughness: 0.03,
    },
  )
  material.envMap = studio
  material.name = `glass.amber (${look === 'studio-amber' ? 'C studio' : 'B screen'} v1)`
  return material
}

const MASK = new MeshBasicMaterial({ color: 0xffffff, toneMapped: false })

/** Swaps materials by look and restores the authored ones on demand. */
export function createLookDresser(studio: () => Texture) {
  const authored = new WeakMap<Mesh, Material | Material[]>()
  const drafts = new Map<AmberLookId, Map<Material, Material>>()

  function draftFor(look: AmberLookId, source: Material): Material {
    let cache = drafts.get(look)
    if (cache === undefined) drafts.set(look, (cache = new Map()))
    const cached = cache.get(source)
    if (cached !== undefined) return cached
    if (!/amber/i.test(source.name)) return source
    const physical = source instanceof MeshPhysicalMaterial ? source : undefined
    const map = physical?.thicknessMap ?? null
    const cut = /cut/i.test(source.name)
    const base = look === 'studio-amber' ? STUDIO_AMBER_V1 : SCREEN_AMBER_V1
    // Keep the vessel's own thickness map, at the looks' share of its factor.
    const draft = amberLook(look, studio(), {
      thickness:
        map !== null && physical !== undefined
          ? physical.thickness * MAP_SCALE
          : base.thickness,
      attenuationDistance: base.attenuationDistance * (cut ? 0.6 : 1),
    })
    if (map !== null) draft.setThicknessMap(map, map.channel === 1 ? 1 : 0)
    if (cut) draft.roughness = 0.08
    cache.set(source, draft)
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
            ? original.map((m) => draftFor(look, m))
            : draftFor(look, original)
      })
    },
  }
}
