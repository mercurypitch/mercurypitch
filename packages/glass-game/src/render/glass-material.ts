// Glass material — owned glass looks on Three's physical material: studio refraction that never shows the room, or Three's own screen transmission.
import type { IUniform, MeshPhysicalMaterialParameters, Texture, WebGLProgramParametersWithUniforms, } from 'three'
import { Color, Matrix3, MeshPhysicalMaterial, ShaderChunk } from 'three'

/**
 * `studio` keeps Three's transmission at 0, so the object never enters the
 * transmission pass. It refracts its own studio environment instead of the
 * opaque room behind it. `screen` is Three's own transmission.
 */
export type GlassTechnique = 'studio' | 'screen'

export interface GlassOptics {
  readonly technique: GlassTechnique
  /** Share of the body's diffuse light replaced by light through the glass, 0-1. */
  readonly transmission: number
  readonly ior: number
  /** Beer-Lambert absorption: the colour left after `attenuationDistance` metres. */
  readonly attenuationColor: string
  readonly attenuationDistance: number
  /** Wall thickness in metres; a thickness map's green channel scales it. */
  readonly thickness: number
  /** studio: blur of the refracted studio, 0-1, separate from surface roughness. */
  readonly refractionRoughness?: number
  /** studio: gain on the refracted studio radiance. */
  readonly refractionGain?: number
  /** studio: light the glass carries, in proportion to its path length. */
  readonly glowColor?: string
  readonly glow?: number
  /** studio: path length in metres that reaches the full glow. */
  readonly glowThickness?: number
  /** studio: lamps behind the glass scattering through it toward the viewer. */
  readonly backLight?: number
  readonly backLightPower?: number
  readonly backLightDistortion?: number
}

export const DEFAULT_GLASS_OPTICS: GlassOptics = {
  technique: 'studio',
  transmission: 1,
  ior: 1.5,
  attenuationColor: '#ffffff',
  attenuationDistance: 1,
  thickness: 0.01,
}

type GlassUniforms = {
  glassTransmission: IUniform<number>
  glassIor: IUniform<number>
  glassAttenuationColor: IUniform<Color>
  glassAttenuationDistance: IUniform<number>
  glassThickness: IUniform<number>
  glassThicknessMap: IUniform<Texture | null>
  glassThicknessMapTransform: IUniform<Matrix3>
  glassRefractionRoughness: IUniform<number>
  glassRefractionGain: IUniform<number>
  glassGlowColor: IUniform<Color>
  glassGlow: IUniform<number>
  glassGlowThickness: IUniform<number>
  glassBackLight: IUniform<number>
  glassBackLightPower: IUniform<number>
  glassBackLightDistortion: IUniform<number>
}

// Every Three name the studio path reads. A release that renames one must be
// reviewed before glass renders again (r182 renamed the transmission fields).
const REQUIRED_CHUNKS: ReadonlyArray<
  readonly [keyof typeof ShaderChunk, string]
> = [
  ['lights_physical_fragment', 'material.specularColorBlended ='],
  ['lights_physical_fragment', 'material.diffuseColor ='],
  ['lights_fragment_begin', 'vec3 geometryViewDir ='],
  ['lights_fragment_begin', 'vec3 geometryPosition ='],
  ['lights_pars_begin', 'void getDirectionalLightInfo('],
  ['lights_pars_begin', 'void getSpotLightInfo('],
  ['lights_physical_pars_fragment', 'vec3 EnvironmentBRDF('],
  ['envmap_physical_pars_fragment', 'textureCubeUV( envMap, envMapRotation *'],
  ['common', 'vec3 transformDirectionByInverseViewMatrix('],
]

const STUDIO_PARS = /* glsl */ `
uniform float glassTransmission;
uniform float glassIor;
uniform vec3 glassAttenuationColor;
uniform float glassAttenuationDistance;
uniform float glassThickness;
uniform float glassRefractionRoughness;
uniform float glassRefractionGain;
uniform vec3 glassGlowColor;
uniform float glassGlow;
uniform float glassGlowThickness;
uniform float glassBackLight;
uniform float glassBackLightPower;
uniform float glassBackLightDistortion;
#ifdef GLASS_THICKNESS_MAP
	uniform sampler2D glassThicknessMap;
	varying vec2 vGlassThicknessUv;
#endif
`

// Replaces <transmission_fragment>, which does nothing at transmission 0.
const STUDIO_FRAGMENT = /* glsl */ `
#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
{
	float glassWall = glassThickness;
	#ifdef GLASS_THICKNESS_MAP
		glassWall *= texture2D( glassThicknessMap, vGlassThicknessUv ).g;
	#endif
	// The path through a wall grows toward grazing angles.
	float glassNdotV = saturate( dot( normal, geometryViewDir ) );
	float glassSinT2 = ( 1.0 - glassNdotV * glassNdotV ) / ( glassIor * glassIor );
	float glassPath = glassWall / sqrt( max( 1.0 - glassSinT2, 0.04 ) );
	vec3 glassAbsorption = - log( max( glassAttenuationColor, vec3( 1e-4 ) ) ) / max( glassAttenuationDistance, 1e-5 );
	vec3 glassTransmittance = exp( - glassAbsorption * glassPath );
	vec3 glassRay = transformDirectionByInverseViewMatrix( refract( - geometryViewDir, normal, 1.0 / glassIor ), viewMatrix );
	vec3 glassStudio = textureCubeUV( envMap, envMapRotation * glassRay, glassRefractionRoughness ).rgb * envMapIntensity * glassRefractionGain;
	vec3 glassReflectance = EnvironmentBRDF( normal, geometryViewDir, material.specularColorBlended, material.specularF90, material.roughness );
	vec3 glassBody = ( 1.0 - glassReflectance ) * material.diffuseColor * glassTransmittance * glassStudio;
	totalDiffuse = mix( totalDiffuse, glassBody, glassTransmission );
	// Light the glass carries: thick glass glows, thin rims stay reflective.
	totalEmissiveRadiance += glassGlowColor * glassGlow * saturate( glassPath / max( glassGlowThickness, 1e-5 ) );
	#ifdef GLASS_BACK_LIGHT
		vec3 glassBack = vec3( 0.0 );
		IncidentLight glassLight;
		#if NUM_DIR_LIGHTS > 0
			DirectionalLight glassDirectional;
			#pragma unroll_loop_start
			for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
				glassDirectional = directionalLights[ i ];
				getDirectionalLightInfo( glassDirectional, glassLight );
				glassBack += glassLight.color * pow( saturate( dot( geometryViewDir, - normalize( glassLight.direction + normal * glassBackLightDistortion ) ) ), glassBackLightPower );
			}
			#pragma unroll_loop_end
		#endif
		#if NUM_SPOT_LIGHTS > 0
			SpotLight glassSpot;
			#pragma unroll_loop_start
			for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
				glassSpot = spotLights[ i ];
				getSpotLightInfo( glassSpot, geometryPosition, glassLight );
				glassBack += glassLight.color * pow( saturate( dot( geometryViewDir, - normalize( glassLight.direction + normal * glassBackLightDistortion ) ) ), glassBackLightPower );
			}
			#pragma unroll_loop_end
		#endif
		totalEmissiveRadiance += glassBack * glassBackLight * glassTransmittance;
	#endif
}
#endif
`

const STUDIO_VERTEX_PARS = /* glsl */ `
#ifdef GLASS_THICKNESS_MAP
	uniform mat3 glassThicknessMapTransform;
	varying vec2 vGlassThicknessUv;
	#if GLASS_THICKNESS_UV == 1 && ! defined( USE_UV1 )
		attribute vec2 uv1;
	#endif
#endif
`

const STUDIO_VERTEX = /* glsl */ `
#ifdef GLASS_THICKNESS_MAP
	#if GLASS_THICKNESS_UV == 1
		vGlassThicknessUv = ( glassThicknessMapTransform * vec3( uv1, 1.0 ) ).xy;
	#else
		vGlassThicknessUv = ( glassThicknessMapTransform * vec3( uv, 1.0 ) ).xy;
	#endif
#endif
`

function replaceOnce(
  source: string,
  marker: string,
  replacement: string,
): string {
  if (source.split(marker).length !== 2)
    throw new Error(
      `Glass material requires a reviewed Three shader: ${marker}`,
    )
  return source.replace(marker, replacement)
}

/** Throws when an installed Three release no longer has a name the studio path reads. */
export function assertGlassShaderChunks(): void {
  for (const [name, needle] of REQUIRED_CHUNKS) {
    const chunk = ShaderChunk[name]
    if (typeof chunk !== 'string' || !chunk.includes(needle))
      throw new Error(
        `Glass material requires a reviewed Three shader: ${name}`,
      )
  }
}

/** Patches a physical-material program for the studio technique. */
export function patchStudioGlassShader(
  shader: WebGLProgramParametersWithUniforms,
  uniforms: GlassUniforms,
): void {
  assertGlassShaderChunks()
  Object.assign(shader.uniforms, uniforms)
  shader.vertexShader = replaceOnce(
    shader.vertexShader,
    'void main() {',
    `${STUDIO_VERTEX_PARS}\nvoid main() {`,
  )
  shader.vertexShader = replaceOnce(
    shader.vertexShader,
    '#include <uv_vertex>',
    `#include <uv_vertex>\n${STUDIO_VERTEX}`,
  )
  shader.fragmentShader = replaceOnce(
    shader.fragmentShader,
    'void main() {',
    `${STUDIO_PARS}\nvoid main() {`,
  )
  shader.fragmentShader = replaceOnce(
    shader.fragmentShader,
    '#include <transmission_fragment>',
    STUDIO_FRAGMENT,
  )
}

function createUniforms(): GlassUniforms {
  return {
    glassTransmission: { value: 1 },
    glassIor: { value: 1.5 },
    glassAttenuationColor: { value: new Color(1, 1, 1) },
    glassAttenuationDistance: { value: 1 },
    glassThickness: { value: 0.01 },
    glassThicknessMap: { value: null },
    glassThicknessMapTransform: { value: new Matrix3() },
    glassRefractionRoughness: { value: 0 },
    glassRefractionGain: { value: 1 },
    glassGlowColor: { value: new Color(0, 0, 0) },
    glassGlow: { value: 0 },
    glassGlowThickness: { value: 0.02 },
    glassBackLight: { value: 0 },
    glassBackLightPower: { value: 4 },
    glassBackLightDistortion: { value: 0.3 },
  }
}

/**
 * One owned glass look. The studio technique needs a prefiltered (PMREM)
 * `envMap`; without one it renders as Three's physical material at
 * transmission 0.
 */
export class GlassMaterial extends MeshPhysicalMaterial {
  readonly isGlassMaterial = true
  technique: GlassTechnique = 'studio'
  readonly glassUniforms: GlassUniforms = createUniforms()
  #thicknessUv: 0 | 1 = 0

  constructor(
    optics: GlassOptics = DEFAULT_GLASS_OPTICS,
    parameters: MeshPhysicalMaterialParameters = {},
  ) {
    // `type` stays MeshPhysicalMaterial: Three picks the shader program by it.
    super(parameters)
    this.setOptics(optics)
    this.onBeforeCompile = (shader) => {
      if (this.technique === 'studio')
        patchStudioGlassShader(shader, this.glassUniforms)
    }
  }

  setOptics(optics: GlassOptics): this {
    const previous = this.technique
    this.technique = optics.technique
    this.ior = optics.ior
    const u = this.glassUniforms
    u.glassTransmission.value = optics.transmission
    u.glassIor.value = optics.ior
    u.glassAttenuationColor.value.set(optics.attenuationColor)
    u.glassAttenuationDistance.value = optics.attenuationDistance
    u.glassThickness.value = optics.thickness
    u.glassRefractionRoughness.value = optics.refractionRoughness ?? 0
    u.glassRefractionGain.value = optics.refractionGain ?? 1
    u.glassGlowColor.value.set(optics.glowColor ?? '#000000')
    u.glassGlow.value = optics.glow ?? 0
    u.glassGlowThickness.value = optics.glowThickness ?? 0.02
    u.glassBackLight.value = optics.backLight ?? 0
    u.glassBackLightPower.value = optics.backLightPower ?? 4
    u.glassBackLightDistortion.value = optics.backLightDistortion ?? 0.3
    if (optics.technique === 'screen') {
      this.transmission = optics.transmission
      this.thickness = optics.thickness
      this.attenuationColor.set(optics.attenuationColor)
      this.attenuationDistance = optics.attenuationDistance
    } else this.transmission = 0
    this.#syncDefines()
    if (previous !== this.technique) this.needsUpdate = true
    return this
  }

  /** The vessel's own thickness map: green channel, on uv0 or uv1. */
  setThicknessMap(texture: Texture | null, channel: 0 | 1 = 0): this {
    this.#thicknessUv = channel
    this.glassUniforms.glassThicknessMap.value = texture
    if (texture !== null) {
      texture.updateMatrix()
      this.glassUniforms.glassThicknessMapTransform.value.copy(texture.matrix)
    }
    if (this.technique === 'screen') {
      this.thicknessMap = texture
      if (texture !== null) texture.channel = channel
    }
    this.#syncDefines()
    this.needsUpdate = true
    return this
  }

  get thicknessUvChannel(): 0 | 1 {
    return this.#thicknessUv
  }

  #syncDefines(): void {
    const defines = (this.defines ??= {}) as Record<string, string | number>
    delete defines.GLASS_STUDIO
    delete defines.GLASS_THICKNESS_MAP
    delete defines.GLASS_THICKNESS_UV
    delete defines.GLASS_BACK_LIGHT
    if (this.technique !== 'studio') return
    defines.GLASS_STUDIO = ''
    if (this.glassUniforms.glassThicknessMap.value !== null) {
      defines.GLASS_THICKNESS_MAP = ''
      defines.GLASS_THICKNESS_UV = this.#thicknessUv
    }
    if (this.glassUniforms.glassBackLight.value > 0)
      defines.GLASS_BACK_LIGHT = ''
  }

  override customProgramCacheKey(): string {
    const map = this.glassUniforms.glassThicknessMap.value !== null
    const back = this.glassUniforms.glassBackLight.value > 0
    return `glass-material-v1|${this.technique}|${map ? this.#thicknessUv : '-'}|${back ? 'back' : '-'}`
  }

  override copy(source: this): this {
    super.copy(source)
    if (!(source instanceof GlassMaterial)) return this
    this.technique = source.technique
    for (const key of Object.keys(
      this.glassUniforms,
    ) as (keyof GlassUniforms)[]) {
      const value = source.glassUniforms[key].value
      const target = this.glassUniforms[key]
      if (value instanceof Color || value instanceof Matrix3)
        (target.value as Color | Matrix3).copy(value as never)
      else target.value = value as never
    }
    this.#thicknessUv = source.thicknessUvChannel
    this.#syncDefines()
    return this
  }
}

export function isGlassMaterial(material: unknown): material is GlassMaterial {
  return material instanceof GlassMaterial
}
