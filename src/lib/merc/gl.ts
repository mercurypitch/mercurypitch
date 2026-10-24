// ============================================================
// Merc GL helpers — render targets, camera and uniform data
// ============================================================
//
// Everything here is either a GL object factory with a matching release, or
// plain data prepared for uniforms. The factories clean up after themselves
// when they fail, because the stage retries nothing: a failure means Merc is
// not drawn and the exercise carries on without him. The programs, which
// must never be read before the driver has finished, are in programs.ts.

import type { MercLight, MercLook, MercPalette, MercView } from './constants'
import { GRAD_N, LIGHT_SLOTS } from './constants'
import { cross3, norm3 } from './rest-space'

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

/** The light set packed once per change, in the shader's slot order. */
export function lightUniforms(light: MercLight): Float32Array {
  return new Float32Array(LIGHT_SLOTS.flatMap((slot) => light[slot]))
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
