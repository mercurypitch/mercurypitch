// Backdrop fog — blend late fog into the same fitted illustration rendered behind the scene.

import type { Material, Object3D, Texture, WebGLProgramParametersWithUniforms, WebGLRenderer, } from 'three'
import { Material as ThreeMaterial, Vector2 } from 'three'

const FOG_PARS = '#include <fog_pars_fragment>'
const FOG_FRAGMENT = '#include <fog_fragment>'
const FOG_VERTEX = '#include <fog_vertex>'
const CACHE_KEY = 'backdrop-fog-v1'

const backdropFogPars = /* glsl */ `
uniform sampler2D backdropFogMap;
uniform mat3 backdropFogUvTransform;
uniform vec2 backdropFogResolution;
`

// Three applies fog after tone mapping and output conversion. Convert the
// sampled sRGB backdrop to the output transfer only; applying ACES here would
// make fully fogged geometry darker than the toneMapped=false background.
const backdropFogFragment = /* glsl */ `
#ifdef USE_FOG

	#ifdef FOG_EXP2

		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );

	#else

		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );

	#endif

	vec2 backdropFogUv = gl_FragCoord.xy / backdropFogResolution;
	backdropFogUv = ( backdropFogUvTransform * vec3( backdropFogUv, 1.0 ) ).xy;
	vec4 backdropFogLinear = texture2D( backdropFogMap, backdropFogUv );
	vec3 backdropFogOutput = linearToOutputTexel( backdropFogLinear ).rgb;
	gl_FragColor.rgb = mix( gl_FragColor.rgb, backdropFogOutput, fogFactor );

#endif
`

// Axial view depth makes equally distant scenery lose fog as the camera orbits
// away from it. Cloudway uses distance fog, so keep the fade stable off-axis.
const radialFogVertex = /* glsl */ `
#ifdef USE_FOG

	vFogDepth = length( mvPosition.xyz );

#endif
`

interface BackdropFogInstallation {
  map: { value: Texture }
  uvTransform: { value: Texture['matrix'] }
}

const installations = new WeakMap<Material, BackdropFogInstallation>()

export function transformBackdropFogFragmentShader(source: string): string {
  if (!source.includes(FOG_PARS) || !source.includes(FOG_FRAGMENT))
    return source
  return source
    .replace(FOG_PARS, `${FOG_PARS}\n${backdropFogPars}`)
    .replace(FOG_FRAGMENT, backdropFogFragment)
}

export function transformBackdropFogVertexShader(source: string): string {
  if (!source.includes(FOG_VERTEX)) return source
  return source.replace(FOG_VERTEX, radialFogVertex)
}

function setPhysicalResolution(
  renderer: WebGLRenderer,
  resolution: Vector2,
): void {
  const target = renderer.getRenderTarget()
  if (target === null) {
    renderer.getDrawingBufferSize(resolution)
    return
  }
  const scale = 2 ** Math.max(0, renderer.getActiveMipmapLevel())
  resolution.set(
    Math.max(1, Math.floor(target.width / scale)),
    Math.max(1, Math.floor(target.height / scale)),
  )
}

function installMaterialBackdropFog(
  material: Material,
  texture: Texture,
): boolean {
  const existing = installations.get(material)
  if (existing !== undefined) {
    existing.map.value = texture
    existing.uvTransform.value = texture.matrix
    return false
  }

  const map = { value: texture }
  const uvTransform = { value: texture.matrix }
  const resolution = { value: new Vector2(1, 1) }
  const previousCompile = material.onBeforeCompile
  const previousRender = material.onBeforeRender
  const previousCacheKey = material.customProgramCacheKey
  const inheritedCacheKey =
    previousCacheKey === ThreeMaterial.prototype.customProgramCacheKey
      ? () => previousCompile.toString()
      : () => previousCacheKey.call(material)

  material.onBeforeCompile = (
    shader: WebGLProgramParametersWithUniforms,
    renderer: WebGLRenderer,
  ) => {
    previousCompile.call(material, shader, renderer)
    const transformed = transformBackdropFogFragmentShader(
      shader.fragmentShader,
    )
    if (transformed === shader.fragmentShader) return
    shader.fragmentShader = transformed
    shader.vertexShader = transformBackdropFogVertexShader(shader.vertexShader)
    setPhysicalResolution(renderer, resolution.value)
    shader.uniforms.backdropFogMap = map
    shader.uniforms.backdropFogUvTransform = uvTransform
    shader.uniforms.backdropFogResolution = resolution
  }
  material.onBeforeRender = (...parameters) => {
    previousRender.apply(material, parameters)
    setPhysicalResolution(parameters[0], resolution.value)
  }
  material.customProgramCacheKey = () => `${inheritedCacheKey()}|${CACHE_KEY}`
  material.needsUpdate = true
  installations.set(material, { map, uvTransform })
  return true
}

/** Install once per unique material after the scene's imported assets exist. */
export function installBackdropFog(root: Object3D, texture: Texture): number {
  const materials = new Set<Material>()
  root.traverse((object) => {
    const material = (
      object as Object3D & {
        material?: Material | readonly Material[]
      }
    ).material
    if (Array.isArray(material)) material.forEach((item) => materials.add(item))
    else if (material !== undefined) materials.add(material as Material)
  })
  let installed = 0
  materials.forEach((material) => {
    if (installMaterialBackdropFog(material, texture)) installed++
  })
  return installed
}
