// Living-crystal interior animation — one opaque dimensional root shader with deterministic travelling light.

import { Color, ShaderMaterial, UniformsLib, UniformsUtils } from 'three'
import type { LivingCrystalPalette, LivingCrystalVariant, } from '../content/living-crystal-profile'
import { LIVING_CRYSTAL_VARIANTS } from '../content/living-crystal-profile'

export interface LivingCrystalInteriorOptions {
  readonly variant: LivingCrystalVariant
  readonly seed: number
  readonly intensity?: number
  readonly speed?: number
  readonly palette?: Partial<LivingCrystalPalette>
  readonly reducedMotion?: boolean
}

export interface LivingCrystalInteriorUpdate {
  readonly deltaSeconds: number
  readonly paused?: boolean
}

export interface LivingCrystalInteriorSettings {
  readonly variant: LivingCrystalVariant
  readonly seed: number
  readonly intensity: number
  readonly speed: number
  readonly palette: LivingCrystalPalette
  readonly reducedMotion: boolean
}

const VERTEX_SHADER = /* glsl */ `
  attribute vec4 color;
  varying vec4 vPathData;
  varying vec3 vViewNormal;
  varying vec3 vViewPosition;
  #include <fog_pars_vertex>

  void main() {
    vPathData = color;
    vec3 objectNormal = normal;
    vec4 objectPosition = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      mat3 instanceNormal = mat3(instanceMatrix);
      objectNormal /= vec3(dot(instanceNormal[0], instanceNormal[0]), dot(instanceNormal[1], instanceNormal[1]), dot(instanceNormal[2], instanceNormal[2]));
      objectNormal = instanceNormal * objectNormal;
      objectPosition = instanceMatrix * objectPosition;
    #endif
    vViewNormal = normalize(normalMatrix * objectNormal);
    vec4 mvPosition = modelViewMatrix * objectPosition;
    vViewPosition = mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform vec3 uAccent;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uMotion;
  uniform float uSeedPhase;

  varying vec4 vPathData;
  varying vec3 vViewNormal;
  varying vec3 vViewPosition;
  #include <fog_pars_fragment>

  float pulseBand(float phase, float centre, float width) {
    float wrapped = abs(fract(phase - centre + 0.5) - 0.5);
    return 1.0 - smoothstep(width * 0.32, width, wrapped);
  }

  void main() {
    vec3 normal = normalize(vViewNormal);
    vec3 viewDirection = normalize(-vViewPosition);
    vec3 keyDirection = normalize(vec3(-0.42, 0.72, 0.55));
    float diffuse = 0.28 + 0.72 * max(dot(normal, keyDirection), 0.0);
    float rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.4);
    float phase = fract(vPathData.r + uSeedPhase);
    float clock = uTime * uMotion;
    float primaryPulse = pulseBand(phase, fract(clock * 0.115), 0.12);
    float echoPulse = pulseBand(phase, fract(clock * 0.115 - 0.38), 0.075);
    float pearl = smoothstep(0.72, 0.98, vPathData.b);
    float depthWarmth = smoothstep(0.05, 0.95, vPathData.g);
    vec3 base = mix(uSecondary, uPrimary, 0.18 + depthWarmth * 0.38);
    base = mix(base, uPrimary, pearl * 0.82);
    float travelling = primaryPulse + echoPulse * 0.48;
    vec3 light = uAccent * travelling * uIntensity;
    light += uAccent * pearl * (0.42 + primaryPulse * 0.58) * uIntensity;
    vec3 finalColor = base * diffuse + base * rim * 0.46 + light;
    gl_FragColor = vec4(finalColor, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`

function finiteInRange(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  return value === undefined || !Number.isFinite(value)
    ? fallback
    : Math.min(maximum, Math.max(minimum, value))
}

function seedPhase(seed: number): number {
  const value = Number.isFinite(seed) ? Math.trunc(seed) : 0
  let hashed = value ^ 0x9e3779b9
  hashed = Math.imul(hashed ^ (hashed >>> 16), 0x21f0aaad)
  hashed = Math.imul(hashed ^ (hashed >>> 15), 0x735a2d97)
  return ((hashed ^ (hashed >>> 15)) >>> 0) / 0x1_0000_0000
}

function settings(
  options: LivingCrystalInteriorOptions,
): LivingCrystalInteriorSettings {
  const authored = LIVING_CRYSTAL_VARIANTS[options.variant]
  return {
    variant: options.variant,
    seed: Number.isFinite(options.seed) ? Math.trunc(options.seed) : 0,
    intensity: finiteInRange(options.intensity, authored.intensity, 0.2, 3),
    speed: finiteInRange(options.speed, authored.speed, 0.05, 1.5),
    palette: {
      primary: options.palette?.primary ?? authored.palette.primary,
      secondary: options.palette?.secondary ?? authored.palette.secondary,
      accent: options.palette?.accent ?? authored.palette.accent,
    },
    reducedMotion: options.reducedMotion ?? false,
  }
}

export function createLivingCrystalInteriorAnimation(
  options: LivingCrystalInteriorOptions,
) {
  let current = settings(options)
  let elapsedSeconds = 0
  let paused = false
  let disposed = false
  const uniforms = {
    ...UniformsUtils.clone(UniformsLib.fog),
    uPrimary: { value: new Color(current.palette.primary) },
    uSecondary: { value: new Color(current.palette.secondary) },
    uAccent: { value: new Color(current.palette.accent) },
    uTime: { value: 0 },
    uIntensity: { value: current.intensity },
    uMotion: { value: current.reducedMotion ? 0 : 1 },
    uSeedPhase: { value: seedPhase(current.seed) },
  }
  const material = new ShaderMaterial({
    name: `LivingCrystalV2_${current.variant}`,
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    depthTest: true,
    depthWrite: true,
    transparent: false,
    toneMapped: true,
    fog: true,
  })

  function synchronizeSettings(): void {
    uniforms.uPrimary.value.set(current.palette.primary)
    uniforms.uSecondary.value.set(current.palette.secondary)
    uniforms.uAccent.value.set(current.palette.accent)
    uniforms.uIntensity.value = current.intensity
    uniforms.uMotion.value = current.reducedMotion ? 0 : 1
    uniforms.uSeedPhase.value = seedPhase(current.seed)
    material.name = `LivingCrystalV2_${current.variant}`
  }

  function synchronizeTime(): void {
    uniforms.uTime.value = elapsedSeconds * current.speed
  }

  synchronizeSettings()
  synchronizeTime()

  return {
    material,
    update(update: LivingCrystalInteriorUpdate): void {
      if (disposed) throw new Error('Living-crystal interior is disposed.')
      paused = update.paused ?? paused
      const delta = finiteInRange(update.deltaSeconds, 0, 0, 0.25)
      if (!paused && !current.reducedMotion) elapsedSeconds += delta
      synchronizeTime()
    },
    configure(next: Partial<LivingCrystalInteriorOptions>): void {
      if (disposed) throw new Error('Living-crystal interior is disposed.')
      const variantChanged =
        next.variant !== undefined && next.variant !== current.variant
      current = settings(
        variantChanged
          ? {
              variant: next.variant!,
              seed: next.seed ?? current.seed,
              reducedMotion: next.reducedMotion ?? current.reducedMotion,
              intensity: next.intensity,
              speed: next.speed,
              palette: next.palette,
            }
          : {
              ...current,
              ...next,
              palette: { ...current.palette, ...next.palette },
            },
      )
      synchronizeSettings()
      synchronizeTime()
    },
    reset(): void {
      if (disposed) throw new Error('Living-crystal interior is disposed.')
      elapsedSeconds = 0
      paused = false
      synchronizeTime()
    },
    snapshot() {
      return {
        elapsedSeconds,
        paused,
        settings: current,
        opaque: !material.transparent && material.depthWrite,
      }
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      material.dispose()
    },
  }
}

export type LivingCrystalInteriorAnimation = ReturnType<
  typeof createLivingCrystalInteriorAnimation
>
