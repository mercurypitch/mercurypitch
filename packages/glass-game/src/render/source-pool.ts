// Source pool surface — share Journey's shallow animated water with fog-aware runner scenery.

import type { BufferAttribute, BufferGeometry, IUniform } from 'three'
import { CircleGeometry, DoubleSide, NormalBlending, ShaderMaterial, UniformsLib, UniformsUtils, } from 'three'

export const SOURCE_POOL_TRIANGLES_PER_INSTANCE = 40

const SOURCE_POOL_MOUTH_EXTENSION = 0.9

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

interface SourcePoolUniforms {
  [uniform: string]: IUniform
  uMotion: { value: number }
  uTime: { value: number }
}

export interface SourcePoolSurfaceOptions {
  /** Blend the transparent surface into the scene's installed backdrop fog. */
  readonly fog?: boolean
}

export interface SourcePoolSurface {
  readonly geometry: BufferGeometry
  readonly material: ShaderMaterial
  /** Copies the caller-owned presentation clock without allocating per frame. */
  setPresentation(timeSeconds: number, reducedMotion: boolean): void
  dispose(): void
}

const SOURCE_POOL_VERTEX_SHADER = /* glsl */ `
  #include <fog_pars_vertex>

  varying vec2 vBasinUv;

  void main() {
    vBasinUv = uv;
    vec4 localPosition = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      localPosition = instanceMatrix * localPosition;
    #endif
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * localPosition;
    #ifdef USE_FOG
      vec4 mvPosition = viewMatrix * modelMatrix * localPosition;
    #endif
    #include <fog_vertex>
  }
`

const SOURCE_POOL_FRAGMENT_SHADER = /* glsl */ `
  #include <fog_pars_fragment>

  uniform float uTime;
  uniform float uMotion;
  varying vec2 vBasinUv;

  float pondHash(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float pondNoise(vec2 point) {
    vec2 cell = floor(point);
    vec2 fraction = fract(point);
    fraction = fraction * fraction * (3.0 - 2.0 * fraction);
    return mix(
      mix(pondHash(cell), pondHash(cell + vec2(1.0, 0.0)), fraction.x),
      mix(pondHash(cell + vec2(0.0, 1.0)), pondHash(cell + 1.0), fraction.x),
      fraction.y
    );
  }

  void main() {
    vec2 centered = vBasinUv - 0.5;
    float radius = length(centered) * 2.0;
    if (radius > 1.0) discard;
    float time = uTime * uMotion;
    float current = pondNoise(vec2(
      centered.x * 8.0 + time * 0.18,
      centered.y * 6.0 - time * 0.32
    ));
    float ripple = 0.5 + 0.5 * sin(
      radius * 31.0 - time * 1.8 + current * 3.2
    );
    float rim = smoothstep(0.72, 0.91, radius) *
      (1.0 - smoothstep(0.91, 1.0, radius));
    float mouthFoam = smoothstep(0.05, 0.42, -centered.y) *
      smoothstep(0.28, 0.82, radius) *
      (1.0 - smoothstep(0.82, 1.0, radius));
    float glint = smoothstep(0.88, 0.985, current) *
      smoothstep(0.45, 0.92, ripple);
    float edgeFade = 1.0 - smoothstep(0.94, 1.0, radius);
    vec3 deepJade = vec3(0.015, 0.29, 0.31);
    vec3 turquoise = vec3(0.075, 0.58, 0.57);
    vec3 pearl = vec3(0.76, 0.98, 0.91);
    vec3 outgoingLight = mix(deepJade, turquoise, 0.4 + current * 0.32);
    outgoingLight = mix(
      outgoingLight,
      pearl,
      clamp(rim * 0.38 + mouthFoam * 0.48 + glint * 0.46, 0.0, 0.82)
    );
    float alpha = edgeFade *
      (0.62 + ripple * 0.08 + rim * 0.16 + mouthFoam * 0.14);
    gl_FragColor = vec4(outgoingLight, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`

function createGeometry(): BufferGeometry {
  const geometry = new CircleGeometry(1, SOURCE_POOL_TRIANGLES_PER_INSTANCE)
  geometry.name = 'journey-water-source-pool-shared'
  const positions = geometry.getAttribute('position') as BufferAttribute
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index)
    const y = positions.getY(index)
    if (y >= 0) continue
    const downstream = clamp(-y, 0, 1)
    const centerWeight = Math.pow(clamp(1 - Math.abs(x), 0, 1), 3)
    const mouthWeight = centerWeight * downstream * downstream
    positions.setY(index, y - SOURCE_POOL_MOUTH_EXTENSION * mouthWeight)
  }
  positions.needsUpdate = true
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

/** Creates one owned geometry/material pair for a fixed-capacity pool mesh. */
export function createSourcePoolSurface(
  options: SourcePoolSurfaceOptions = {},
): SourcePoolSurface {
  const geometry = createGeometry()
  const uniforms = UniformsUtils.merge([
    UniformsLib.fog,
    {
      uTime: { value: 0 },
      uMotion: { value: 1 },
    },
  ]) as SourcePoolUniforms
  const material = new ShaderMaterial({
    name: 'journey-water-source-material',
    uniforms,
    vertexShader: SOURCE_POOL_VERTEX_SHADER,
    fragmentShader: SOURCE_POOL_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: NormalBlending,
    toneMapped: true,
  })
  material.fog = options.fog === true
  material.forceSinglePass = true
  let disposed = false

  return {
    geometry,
    material,
    setPresentation(timeSeconds, reducedMotion) {
      if (disposed) return
      uniforms.uTime.value = Number.isFinite(timeSeconds)
        ? Math.max(0, timeSeconds)
        : 0
      uniforms.uMotion.value = reducedMotion ? 0 : 1
    },
    dispose() {
      if (disposed) return
      disposed = true
      geometry.dispose()
      material.dispose()
    },
  }
}
