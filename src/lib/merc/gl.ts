// ============================================================
// Merc GL helpers — programs, render targets, camera and uniform data
// ============================================================
//
// Everything here is either a GL object factory with a matching release, or
// plain data prepared for uniforms. The factories clean up after themselves
// when they fail (a failed compile or link leaves no shader or program
// behind), because the stage retries nothing: a failure means Merc is not
// drawn and the exercise carries on without him.

import type { MercLook, MercPalette, MercQuality, MercQualitySpec, MercView, } from './constants'
import { GRAD_N, QUALITY } from './constants'
import { POST_BLUR, POST_COMPOSITE, POST_DOWN } from './post-shaders'
import { cross3, norm3 } from './rest-space'
import { fragSource, VERT } from './scene-shader'

// ------------------------------------------------------------ colour

export const srgbToLin = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4

export const hexLin = (h: string): [number, number, number] => [
  srgbToLin(parseInt(h.slice(1, 3), 16) / 255),
  srgbToLin(parseInt(h.slice(3, 5), 16) / 255),
  srgbToLin(parseInt(h.slice(5, 7), 16) / 255),
]

export interface PaletteUniforms {
  /** Stop heights, padded past 1. */
  readonly h: Float32Array
  /** Stop colours, linear. */
  readonly c: Float32Array
  /** The feet, deep and light, linear. */
  readonly bead: Float32Array
}

// A palette as uniform arrays: stop heights padded past 1 and linear colours.
export function paletteUniforms(P: MercPalette): PaletteUniforms {
  const h = new Float32Array(GRAD_N)
  const c = new Float32Array(GRAD_N * 3)
  for (let i = 0; i < GRAD_N; i++) {
    const st = P.stops[Math.min(i, P.stops.length - 1)]
    h[i] = i < P.stops.length ? st[0] : 1 + 0.1 * (i - P.stops.length + 1)
    c.set(hexLin(st[1]), i * 3)
  }
  return {
    h,
    c,
    bead: new Float32Array([...hexLin(P.bead[0]), ...hexLin(P.bead[1])]),
  }
}

export interface LookUniforms {
  readonly edge: Float32Array
  readonly edge2: Float32Array
  readonly crown: Float32Array
  readonly shoulder: Float32Array
  readonly k: Float32Array
  /** The streaks' colour, linear. */
  readonly tint: Float32Array
  /** The edge's tint low down, linear. */
  readonly tint2: Float32Array
}

// The look packed once per change (WebGL rounds a JS array to float32 the
// same way, so this changes no value).
export function lookUniforms(look: MercLook): LookUniforms {
  return {
    edge: new Float32Array(look.edge),
    edge2: new Float32Array(look.edge2),
    crown: new Float32Array(look.crown),
    shoulder: new Float32Array(look.shoulder),
    k: new Float32Array(look.k),
    tint: new Float32Array(hexLin(look.tint)),
    tint2: new Float32Array(hexLin(look.tint2)),
  }
}

// ------------------------------------------------------------ camera

type V3 = [number, number, number]

export interface Camera {
  readonly pos: V3
  readonly fw: V3
  readonly right: V3
  readonly up: V3
  readonly focal: number
}

export function cameraFor(view: MercView): Camera {
  const { yaw, pitch, dist, target, fov } = view
  const cp = Math.cos(pitch)
  const pos: V3 = [
    target[0] + dist * cp * Math.sin(yaw),
    target[1] + dist * Math.sin(pitch),
    target[2] + dist * cp * Math.cos(yaw),
  ]
  const fw = norm3([target[0] - pos[0], target[1] - pos[1], target[2] - pos[2]])
  const right = norm3(cross3(fw, [0, 1, 0]))
  const up = cross3(right, fw)
  return { pos, fw, right, up, focal: 1 / Math.tan((fov * Math.PI) / 180 / 2) }
}

// n entries of width floats each, packed for a uniform array.
export const flat = (
  arr: readonly (readonly number[])[],
  n: number,
  width: number,
): Float32Array => {
  const out = new Float32Array(n * width)
  arr.slice(0, n).forEach((v, i) => out.set(v.slice(0, width), i * width))
  return out
}

// ------------------------------------------------------------ programs

const SCENE_UNIFORMS = [
  'uRes',
  'uCamPos',
  'uCamR',
  'uCamU',
  'uCamF',
  'uFocal',
  'uBound',
  'uTime',
  'uRoot',
  'uShape',
  'uLip',
  'uLean',
  'uFeet',
  'uRipple',
  'uWave',
  'uNub',
  'uEyeC[0]',
  'uEyeX[0]',
  'uEyeZ[0]',
  'uEyeFrz',
  'uEyeA',
  'uEyeB',
  'uMouth',
  'uColor',
  'uCore',
  'uRing',
  'uArcs',
  'uArcs2',
  'uDropN',
  'uDrops[0]',
  'uSparkN',
  'uSparks[0]',
  'uDotN',
  'uDots[0]',
  'uStops',
  'uGhost[0]',
  'uGhostSq',
  'uSpeed',
  'uArrow',
  'uCamAz',
  'uDebug',
  'uGradH[0]',
  'uGradC[0]',
  'uBead[0]',
  'uLookE',
  'uLookE2',
  'uLookS1',
  'uLookS2',
  'uLookK',
  'uLookT',
  'uLookT2',
] as const

const POST_UNIFORMS = [
  'uSrc',
  'uSrcTexel',
  'uDstRes',
  'uDir',
  'uScene',
  'uA',
  'uB',
  'uRes',
  'uBg',
  'uOpaque',
  'uBloomK',
  'uCov',
  'uRim',
  'uRimY',
] as const

// 'uEyeC[0]' is looked up by its array name, 'uEyeC'.
type UniformKey<N extends string> = N extends `${infer A}[0]` ? A : N

export type UniformLocations<N extends string> = Readonly<
  Record<UniformKey<N>, WebGLUniformLocation | null>
>

export interface LinkedProgram<N extends string> {
  readonly p: WebGLProgram
  readonly loc: UniformLocations<N>
}

export type SceneProgram = LinkedProgram<(typeof SCENE_UNIFORMS)[number]> & {
  readonly q: MercQualitySpec
}
export type PostProgram = LinkedProgram<(typeof POST_UNIFORMS)[number]>

export interface PostPrograms {
  readonly down: PostProgram
  readonly blur: PostProgram
  readonly comp: PostProgram
}

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
): WebGLShader {
  const sh = gl.createShader(type)
  if (!sh) throw new Error('Shader compile failed: no shader object')
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (gl.getShaderParameter(sh, gl.COMPILE_STATUS) !== true) {
    const log = gl.getShaderInfoLog(sh)
    gl.deleteShader(sh)
    throw new Error(`Shader compile failed: ${log}`)
  }
  return sh
}

function link<N extends string>(
  gl: WebGL2RenderingContext,
  fragSrc: string,
  names: readonly N[],
): LinkedProgram<N> {
  const shaders: WebGLShader[] = []
  // Null on a lost context, whatever the DOM typings say.
  const p = gl.createProgram()
  try {
    if (p === null) throw new Error('Program link failed: no program object')
    shaders.push(compile(gl, gl.VERTEX_SHADER, VERT))
    shaders.push(compile(gl, gl.FRAGMENT_SHADER, fragSrc))
    for (const sh of shaders) gl.attachShader(p, sh)
    gl.linkProgram(p)
    if (gl.getProgramParameter(p, gl.LINK_STATUS) !== true) {
      throw new Error(`Program link failed: ${gl.getProgramInfoLog(p)}`)
    }
  } catch (err) {
    if (p !== null) gl.deleteProgram(p)
    throw err
  } finally {
    // A linked program keeps what it needs; flagged shaders go with it.
    for (const sh of shaders) gl.deleteShader(sh)
  }
  const loc: Partial<Record<string, WebGLUniformLocation | null>> = {}
  for (const n of names) loc[n.replace('[0]', '')] = gl.getUniformLocation(p, n)
  return { p, loc: loc as UniformLocations<N> }
}

export function createSceneProgram(
  gl: WebGL2RenderingContext,
  quality: MercQuality,
): SceneProgram {
  const q = QUALITY[quality]
  return { ...link(gl, fragSource(q), SCENE_UNIFORMS), q }
}

export function createPostPrograms(gl: WebGL2RenderingContext): PostPrograms {
  const made: PostProgram[] = []
  try {
    const down = link(gl, POST_DOWN, POST_UNIFORMS)
    made.push(down)
    const blur = link(gl, POST_BLUR, POST_UNIFORMS)
    made.push(blur)
    const comp = link(gl, POST_COMPOSITE, POST_UNIFORMS)
    return { down, blur, comp }
  } catch (err) {
    for (const prg of made) gl.deleteProgram(prg.p)
    throw err
  }
}

// ------------------------------------------------------------ render targets

// The scene and its glow at the render size (two colour attachments), then a
// quarter-size and an eighth-size pair for the bloom.
export interface RenderTargets {
  readonly w: number
  readonly h: number
  readonly aw: number
  readonly ah: number
  readonly bw: number
  readonly bh: number
  readonly scene: WebGLTexture
  readonly glow: WebGLTexture
  readonly a0: WebGLTexture
  readonly a1: WebGLTexture
  readonly b0: WebGLTexture
  readonly b1: WebGLTexture
  readonly main: WebGLFramebuffer
  readonly fa0: WebGLFramebuffer
  readonly fa1: WebGLFramebuffer
  readonly fb0: WebGLFramebuffer
  readonly fb1: WebGLFramebuffer
  readonly texs: readonly WebGLTexture[]
  readonly fbs: readonly WebGLFramebuffer[]
}

export function deleteRenderTargets(
  gl: WebGL2RenderingContext,
  targets: Pick<RenderTargets, 'texs' | 'fbs'>,
): void {
  for (const t of targets.texs) gl.deleteTexture(t)
  for (const f of targets.fbs) gl.deleteFramebuffer(f)
}

export function createRenderTargets(
  gl: WebGL2RenderingContext,
  w: number,
  h: number,
): RenderTargets {
  const texs: WebGLTexture[] = []
  const fbs: WebGLFramebuffer[] = []
  const tex = (tw: number, th: number): WebGLTexture => {
    // Null on a lost context, whatever the DOM typings say.
    const t = gl.createTexture()
    if (t === null) throw new Error('Texture allocation failed')
    texs.push(t)
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, tw, th)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return t
  }
  const fbo = (...attach: WebGLTexture[]): WebGLFramebuffer => {
    const fb = gl.createFramebuffer()
    if (fb === null) throw new Error('Framebuffer allocation failed')
    fbs.push(fb)
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    attach.forEach((t, i) =>
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0 + i,
        gl.TEXTURE_2D,
        t,
        0,
      ),
    )
    gl.drawBuffers(attach.map((_, i) => gl.COLOR_ATTACHMENT0 + i))
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('Framebuffer incomplete')
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return fb
  }
  try {
    const aw = Math.max(1, Math.round(w / 4))
    const ah = Math.max(1, Math.round(h / 4))
    const bw = Math.max(1, Math.round(w / 8))
    const bh = Math.max(1, Math.round(h / 8))
    const scene = tex(w, h)
    const glow = tex(w, h)
    const a0 = tex(aw, ah)
    const a1 = tex(aw, ah)
    const b0 = tex(bw, bh)
    const b1 = tex(bw, bh)
    const main = fbo(scene, glow)
    const fa0 = fbo(a0)
    const fa1 = fbo(a1)
    const fb0 = fbo(b0)
    const fb1 = fbo(b1)
    return {
      w,
      h,
      aw,
      ah,
      bw,
      bh,
      scene,
      glow,
      a0,
      a1,
      b0,
      b1,
      main,
      fa0,
      fa1,
      fb0,
      fb1,
      texs,
      fbs,
    }
  } catch (err) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    deleteRenderTargets(gl, { texs, fbs })
    throw err
  }
}
