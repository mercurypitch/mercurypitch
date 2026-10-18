// Dome materials — turn resident roof panes into glass without repainting their gold frames.

import type { Material, Object3D, Texture } from 'three'
import { Color, FrontSide, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, ShaderChunk, } from 'three'

type PaneMask = 'teal-atlas' | 'transmission-map'

/** Clear geometry-authored panes borrow the existing environment, without atlas smoke. */
export function createClearTemplePaneMaterial(): MeshPhysicalMaterial {
  const material = new MeshPhysicalMaterial({
    color: '#d7f5f4',
    metalness: 0,
    roughness: 0.055,
    transmission: 0.99,
    thickness: 0.012,
    ior: 1.45,
    envMapIntensity: 1.5,
    side: FrontSide,
  })
  material.name = 'first-light-separated-glass'
  return material
}

/** Keep authored gold and texture detail, muting only the exposed teal cornice paint. */
export function createTempleOrnamentMaterial(
  source: MeshStandardMaterial,
): MeshStandardMaterial {
  const material = new MeshStandardMaterial().copy(source)
  material.name = 'first-light-authored-dome-ornament'
  material.onBeforeCompile = (shader) => {
    shader.uniforms.museumPatinaTint = { value: new Color('#96b7aa') }
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 museumPatinaTint;',
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
#ifdef USE_MAP
float museumPatinaMask = smoothstep(0.06, 0.15, min(sampledDiffuseColor.g, sampledDiffuseColor.b) - sampledDiffuseColor.r);
float museumOrnamentLight = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
diffuseColor.rgb = mix(diffuseColor.rgb, museumPatinaTint * museumOrnamentLight, 0.8 * museumPatinaMask);
#endif`,
      )
  }
  material.customProgramCacheKey = () => 'first-light-ornament-patina-v1'
  return material
}

function createPaneMaterial(
  source: MeshStandardMaterial,
  mask: PaneMask,
  maskTexture: Texture,
  tint: string,
): MeshPhysicalMaterial {
  const material = new MeshPhysicalMaterial()
  if (source instanceof MeshPhysicalMaterial) material.copy(source)
  else {
    MeshStandardMaterial.prototype.copy.call(material, source)
    material.defines = { STANDARD: '', PHYSICAL: '' }
  }
  material.name = `${source.name}-museum-panes`
  material.transmission = 0.96
  material.thickness = 0.025
  // These closed temple donors self-occlude in the transmission backface pass.
  // Conservatory keeps its authored double-sided, open architectural shell.
  if (mask === 'teal-atlas') material.side = FrontSide
  // Keep resident texture ownership and the non-pane PBR response.
  // Both masks use existing atlas pixels; no extra texture or scene capture.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.museumPaneMaskMap = { value: maskTexture }
    shader.uniforms.museumPaneTint = { value: new Color(tint) }
    const maskExpression =
      mask === 'teal-atlas'
        ? 'smoothstep(0.06, 0.15, min(museumMaskTexel.g, museumMaskTexel.b) - museumMaskTexel.r)'
        : 'smoothstep(0.06, 0.3, museumMaskTexel.r)'
    const maskUv = mask === 'teal-atlas' ? 'vMapUv' : 'vTransmissionMapUv'
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D museumPaneMaskMap;
uniform vec3 museumPaneTint;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
vec3 museumMaskTexel = texture2D(museumPaneMaskMap, ${maskUv}).rgb;
float museumPaneMask = ${maskExpression};
diffuseColor.rgb = mix(diffuseColor.rgb, museumPaneTint, museumPaneMask);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.035, museumPaneMask);`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
metalnessFactor = mix(metalnessFactor, 0.0, museumPaneMask);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        ShaderChunk.normal_fragment_maps.replace(
          'mapN.xy *= normalScale;',
          'mapN.xy *= normalScale * mix(1.0, 0.025, museumPaneMask);',
        ),
      )
      .replace(
        '#include <aomap_fragment>',
        ShaderChunk.aomap_fragment.replace(
          'reflectedLight.indirectDiffuse *= ambientOcclusion;',
          'ambientOcclusion = mix(ambientOcclusion, 1.0, museumPaneMask);\n\treflectedLight.indirectDiffuse *= ambientOcclusion;',
        ),
      )
      .replace(
        '#include <transmission_fragment>',
        ShaderChunk.transmission_fragment.replace(
          'vec3 pos = vWorldPosition;',
          'material.transmission = transmission * museumPaneMask;\n\tvec3 pos = vWorldPosition;',
        ),
      )
    shader.fragmentShader = shader.fragmentShader.replace(
      'vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;',
      `reflectedLight.indirectSpecular *= mix(1.0, 2.0, museumPaneMask);
vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;`,
    )
    if (mask === 'teal-atlas') {
      // Fit the measured resident temple dome, excluding its rim and finial.
      // Keep nonPerturbedNormal: its derivatives retain the donor's fine ribs.
      const varying =
        'varying vec3 museumDomeNormal;\nvarying float museumDomeHeight;'
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${varying}`)
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
museumDomeNormal = normalMatrix * vec3(position.x / 0.8464, (position.y - 1.7) / 0.5625, (position.z + 0.16) / 0.7396);
museumDomeHeight = position.y;`,
        )
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${varying}`)
        .replace(
          '#include <clearcoat_normal_fragment_begin>',
          `float domePaneWeight = museumPaneMask * smoothstep(1.78, 1.88, museumDomeHeight) * (1.0 - smoothstep(2.38, 2.48, museumDomeHeight));
normal = normalize(mix(normal, normalize(museumDomeNormal) * faceDirection, domePaneWeight));
#include <clearcoat_normal_fragment_begin>`,
        )
    }
  }
  material.customProgramCacheKey = () => `museum-panes-v3-${mask}`
  return material
}

/** Return owned clones for assembly disposal; resident donor textures stay borrowed. */
export function createJourneyDomeMaterials(root: Object3D): Set<Material> {
  let tealAtlas: Texture | null = null
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material]
    for (const material of materials) {
      if (
        material instanceof MeshStandardMaterial &&
        material.name === 'map_temple_dome_teal_atlas'
      )
        tealAtlas = material.map
    }
  })
  const owned = new Set<Material>()
  for (const stageId of [
    'first-light-isle',
    'twin-galleries-isle',
    'resonance-conservatory-isle',
  ]) {
    const stage = root.getObjectByName(stageId)
    if (stage === undefined) continue
    const replacements = new Map<Material, Material>()
    const replace = (source: Material): Material => {
      const previous = replacements.get(source)
      if (previous !== undefined) return previous
      if (!(source instanceof MeshStandardMaterial)) return source
      let material: MeshPhysicalMaterial | undefined
      if (
        tealAtlas !== null &&
        source.map !== null &&
        (source.name === 'map_temple_dome_teal_atlas' ||
          source.name === 'map_temple_dome_amber_atlas')
      ) {
        const tint =
          source.name === 'map_temple_dome_amber_atlas'
            ? '#f7d493'
            : stageId === 'first-light-isle'
              ? '#b2e2e0'
              : '#9bdde5'
        material = createPaneMaterial(source, 'teal-atlas', tealAtlas, tint)
      } else if (
        source instanceof MeshPhysicalMaterial &&
        source.name === 'map_conservatory_atlas' &&
        source.transmissionMap !== null
      ) {
        material = createPaneMaterial(
          source,
          'transmission-map',
          source.transmissionMap,
          '#e6f5e9',
        )
      }
      if (material === undefined) return source
      replacements.set(source, material)
      owned.add(material)
      return material
    }
    stage.traverse((object) => {
      if (object instanceof Mesh)
        object.material = Array.isArray(object.material)
          ? object.material.map(replace)
          : replace(object.material)
    })
  }
  return owned
}
