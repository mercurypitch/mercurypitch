// Material finish bank — shared baked surfaces on independently owned runtime materials.
import type { Material, Texture } from 'three'
import { ClampToEdgeWrapping, Color, MeshPhysicalMaterial, NoColorSpace, RepeatWrapping, SRGBColorSpace, Vector2, } from 'three'
import type { MaterialFinishId } from '../content/material-finishes'
import { MATERIAL_FINISH_RECIPES } from '../content/material-finishes'

export interface MaterialFinishBank {
  apply(
    material: MeshPhysicalMaterial,
    id: MaterialFinishId,
    mapped?: boolean,
  ): void
  create(id: MaterialFinishId): MeshPhysicalMaterial
}

/** The caller owns textures. Materials borrow them until the renderer is disposed. */
export function createMaterialFinishBank(
  textures: ReadonlyMap<string, Texture>,
): MaterialFinishBank {
  for (const recipe of Object.values(MATERIAL_FINISH_RECIPES))
    for (const map of Object.values(recipe.maps)) {
      const texture = textures.get(map.assetId)
      if (!texture) continue
      texture.colorSpace =
        map.colorSpace === 'srgb' ? SRGBColorSpace : NoColorSpace
      texture.wrapS = texture.wrapT =
        map.wrap === 'repeat' ? RepeatWrapping : ClampToEdgeWrapping
      texture.repeat.set(map.repeat[0], map.repeat[1])
      texture.flipY = false
      texture.anisotropy = map.anisotropy
      texture.needsUpdate = true
    }
  const apply = (
    material: MeshPhysicalMaterial,
    id: MaterialFinishId,
    mapped = true,
  ) => {
    const recipe = MATERIAL_FINISH_RECIPES[id]
    // Partial banks avoid uploading maps for hosts without UVs. Fail before
    // changing the material when a mapped host requests an incomplete recipe.
    if (mapped)
      for (const map of Object.values(recipe.maps)) {
        if (!textures.has(map.assetId))
          throw new Error(`Missing material finish texture: ${map.assetId}`)
      }
    const {
      color,
      attenuationColor,
      normalScale,
      iridescenceThicknessRange,
      ...parameters
    } = {
      attenuationColor: '#ffffff',
      iridescenceThicknessRange: [100, 400] as readonly [number, number],
      ...recipe.parameters,
    }
    // Imported geometry has already had its material units converted to metres.
    // Keep its actual thickness; the preset's swatch thickness is not the host's.
    const thickness = material.thickness
    material.setValues({
      ...parameters,
      color: new Color(color),
      attenuationColor: new Color(attenuationColor),
      normalScale: new Vector2(...normalScale),
      iridescenceThicknessRange: [...iridescenceThicknessRange],
    })
    if (thickness > 0) material.thickness = thickness
    material.map =
      'baseColor' in recipe.maps && mapped
        ? textures.get(recipe.maps.baseColor.assetId)!
        : null
    material.roughnessMap = mapped
      ? textures.get(recipe.maps.roughness.assetId)!
      : null
    material.normalMap = mapped
      ? textures.get(recipe.maps.normal.assetId)!
      : null
    if (!mapped) {
      material.roughness = recipe.fallbackRoughness
      if ('fallbackColor' in recipe) material.color.set(recipe.fallbackColor)
    }
    material.needsUpdate = true
    material.userData.materialFinish = id
  }
  return {
    apply,
    create(id) {
      const material = new MeshPhysicalMaterial({ name: id })
      apply(material, id)
      return material
    },
  }
}

/** Semantic material names are part of the reviewed wall export contract. */
export function finishRunnerWallMaterial(
  material: Material,
  bank: MaterialFinishBank,
  mapped: boolean,
): void {
  if (!(material instanceof MeshPhysicalMaterial)) return
  if (/^W\d{2} optical glass$/.test(material.name)) {
    if (
      material.name === 'W06 optical glass' &&
      material.userData.runnerOpeningFinish === 'botanical-edge-v1'
    ) {
      const authoredRoughness = material.roughnessMap
      if (!mapped || authoredRoughness === null)
        throw new Error(
          'Botanical frost requires its authored wall UVs and roughness map.',
        )
      // The same wall-space image spans the intact pane and all fracture pieces.
      // A generic tiled swatch would erase its clear center and reveal shard seams.
      bank.apply(material, 'etched-frost-glass', false)
      material.roughnessMap = authoredRoughness
      material.roughness = 1
      material.normalMap = null
      return
    }
    bank.apply(
      material,
      material.name.startsWith('W06')
        ? 'etched-frost-glass'
        : 'champagne-crystal',
      mapped,
    )
  } else if (material.name === 'W04 colored border glass') {
    bank.apply(material, 'amethyst-cut-crystal', mapped)
  } else if (material.name === 'W08 colored border glass') {
    bank.apply(material, 'opal-ribbon-glass', mapped)
  } else if (/^W\d{2} warm gold$/.test(material.name)) {
    material.color.set('#e8c781')
    material.roughness = 0.26
    material.metalness = 1
    material.clearcoat = 0.15
    material.clearcoatRoughness = 0.18
  }
}
