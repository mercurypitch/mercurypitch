// Pearl court material — share existing marble maps with one continuous world-space grain.

import type { Material, MeshPhysicalMaterial } from 'three'

/** Borrow already-owned texture channels; only the cloned material is newly owned. */
export function createPearlCourtMaterial(
  marble: MeshPhysicalMaterial,
  owned: Set<Material>,
): MeshPhysicalMaterial {
  const material = marble.clone()
  material.name = 'PearlCourt_ContinuousMarble'
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>
      vec4 pearlWorldPosition = vec4( position, 1.0 );
      #ifdef USE_INSTANCING
        pearlWorldPosition = instanceMatrix * pearlWorldPosition;
      #endif
      pearlWorldPosition = modelMatrix * pearlWorldPosition;
      vec3 pearlWorldNormal = normal;
      #ifdef USE_INSTANCING
        pearlWorldNormal = mat3( instanceMatrix ) * pearlWorldNormal;
      #endif
      pearlWorldNormal = abs( mat3( modelMatrix ) * pearlWorldNormal );
      // Vertical closure faces need two-dimensional UV derivatives for normal maps.
      vec2 pearlCourtUv = pearlWorldNormal.y > 0.5 ? pearlWorldPosition.xz
        : ( pearlWorldNormal.x > 0.5 ? pearlWorldPosition.zy : pearlWorldPosition.xy );
      pearlCourtUv /= 3.2;
      #ifdef USE_MAP
        vMapUv = ( mapTransform * vec3( pearlCourtUv, 1.0 ) ).xy;
      #endif
      #ifdef USE_NORMALMAP
        vNormalMapUv = ( normalMapTransform * vec3( pearlCourtUv, 1.0 ) ).xy;
      #endif
      #ifdef USE_ROUGHNESSMAP
        vRoughnessMapUv = ( roughnessMapTransform * vec3( pearlCourtUv, 1.0 ) ).xy;
      #endif
      #ifdef USE_METALNESSMAP
        vMetalnessMapUv = ( metalnessMapTransform * vec3( pearlCourtUv, 1.0 ) ).xy;
      #endif
      #ifdef USE_AOMAP
        vAoMapUv = ( aoMapTransform * vec3( pearlCourtUv, 1.0 ) ).xy;
      #endif`,
    )
  }
  material.customProgramCacheKey = () => 'pearl-court-world-marble-v1'
  owned.add(material)
  return material
}
