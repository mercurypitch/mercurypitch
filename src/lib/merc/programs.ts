// ============================================================
// Merc programs — the scene and bloom shaders, linked without blocking
// ============================================================
//
// Chrome compiles WebGL shaders in its GPU process, whose main thread also
// draws every tab and the browser's own window. On Windows, ANGLE compiles
// through Direct3D's compiler, which can take a very long time over a shader
// as big as Merc's on a first visit (a later visit reads the binary from
// Chrome's shader cache). A page that enables KHR_parallel_shader_compile
// lets ANGLE compile on worker threads instead; asking a shader or a program
// for its status before they finish would still make the GPU process wait.
// So the renderer asks for the extension, and nothing here reads a status
// before the driver says it is done:
//
// - startBuild() asks for every compile and the link, and reads nothing.
// - buildDone() asks COMPLETION_STATUS_KHR, the one query that never waits.
//   Without the extension it answers true, and the read that follows waits
//   once, for the whole set.
// - finishBuild() reads LINK_STATUS once per program. A shader's own status
//   and the info logs are read only when a link failed, to say why.
//
// Every step cleans up after itself when it fails (no shader or program left
// behind), because the stage retries nothing: a failure means Merc is not
// drawn and the exercise carries on without him.

import type { MercQuality, MercQualitySpec } from './constants'
import { QUALITY } from './constants'
import { POST_BLUR, POST_COMPOSITE, POST_DOWN } from './post-shaders'
import { fragSource, VERT } from './scene-shader'

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
  'uZero',
  'uLight[0]',
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

type SceneName = (typeof SCENE_UNIFORMS)[number]
type PostName = (typeof POST_UNIFORMS)[number]

// 'uEyeC[0]' is looked up by its array name, 'uEyeC'.
type UniformKey<N extends string> = N extends `${infer A}[0]` ? A : N

export type UniformLocations<N extends string> = Readonly<
  Record<UniformKey<N>, WebGLUniformLocation | null>
>

export interface LinkedProgram<N extends string> {
  readonly p: WebGLProgram
  readonly loc: UniformLocations<N>
}

export type SceneProgram = LinkedProgram<SceneName> & {
  readonly q: MercQualitySpec
}
export type PostProgram = LinkedProgram<PostName>

export interface PostPrograms {
  readonly down: PostProgram
  readonly blur: PostProgram
  readonly comp: PostProgram
}

/** A program whose compile and link were asked for, and nothing read yet. */
interface Pending<N extends string> {
  readonly p: WebGLProgram
  readonly shaders: readonly WebGLShader[]
  readonly names: readonly N[]
}

/** One quality's scene program, and the bloom programs when they are wanted too. */
export interface ProgramBuild {
  readonly quality: MercQuality
  readonly scene: Pending<SceneName>
  readonly post: readonly Pending<PostName>[]
}

export interface BuiltPrograms {
  readonly quality: MercQuality
  readonly scene: SceneProgram
  /** Null when the build asked for the scene program only. */
  readonly post: PostPrograms | null
}

function drop(gl: WebGL2RenderingContext, x: Pending<string>): void {
  gl.deleteProgram(x.p)
  for (const sh of x.shaders) gl.deleteShader(sh)
}

function start<N extends string>(
  gl: WebGL2RenderingContext,
  frag: string,
  names: readonly N[],
): Pending<N> {
  // Null on a lost context, whatever the DOM typings say.
  const p = gl.createProgram()
  if (p === null) throw new Error('Program link failed: no program object')
  const shaders: WebGLShader[] = []
  try {
    for (const [type, src] of [
      [gl.VERTEX_SHADER, VERT],
      [gl.FRAGMENT_SHADER, frag],
    ] as const) {
      const sh = gl.createShader(type)
      if (!sh) throw new Error('Shader compile failed: no shader object')
      shaders.push(sh)
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      gl.attachShader(p, sh)
    }
    gl.linkProgram(p)
  } catch (err) {
    drop(gl, { p, shaders, names })
    throw err
  }
  return { p, shaders, names }
}

// Why a link failed: the first shader that did not compile, else the link's log.
function whyNot(gl: WebGL2RenderingContext, x: Pending<string>): Error {
  for (const sh of x.shaders) {
    if (gl.getShaderParameter(sh, gl.COMPILE_STATUS) !== true) {
      return new Error(`Shader compile failed: ${gl.getShaderInfoLog(sh)}`)
    }
  }
  return new Error(`Program link failed: ${gl.getProgramInfoLog(x.p)}`)
}

function finish<N extends string>(
  gl: WebGL2RenderingContext,
  x: Pending<N>,
): LinkedProgram<N> {
  const linked = gl.getProgramParameter(x.p, gl.LINK_STATUS) === true
  const err = linked ? null : whyNot(gl, x)
  // A linked program keeps what it needs; flagged shaders go with it.
  for (const sh of x.shaders) gl.deleteShader(sh)
  if (err) {
    gl.deleteProgram(x.p)
    throw err
  }
  const loc: Partial<Record<string, WebGLUniformLocation | null>> = {}
  for (const n of x.names)
    loc[n.replace('[0]', '')] = gl.getUniformLocation(x.p, n)
  return { p: x.p, loc: loc as UniformLocations<N> }
}

/**
 * Asks the driver for a quality's scene program, and for the three bloom
 * programs when `withPost`, and reads nothing back. Throws only when a GL
 * object cannot be had (a lost context), leaving nothing behind.
 */
export function startBuild(
  gl: WebGL2RenderingContext,
  quality: MercQuality,
  withPost: boolean,
): ProgramBuild {
  const scene = start(gl, fragSource(QUALITY[quality]), SCENE_UNIFORMS)
  const post: Pending<PostName>[] = []
  try {
    if (withPost) {
      for (const frag of [POST_DOWN, POST_BLUR, POST_COMPOSITE]) {
        post.push(start(gl, frag, POST_UNIFORMS))
      }
    }
  } catch (err) {
    for (const x of [scene, ...post]) drop(gl, x)
    throw err
  }
  return { quality, scene, post }
}

/**
 * True once the driver has finished every program in the build. Never waits
 * when the browser offers KHR_parallel_shader_compile; without it (`parallel`
 * null) it answers true at once, and finishBuild() then waits.
 */
export function buildDone(
  gl: WebGL2RenderingContext,
  parallel: KHR_parallel_shader_compile | null,
  b: ProgramBuild,
): boolean {
  if (parallel === null) return true
  return [b.scene, ...b.post].every(
    (x) => gl.getProgramParameter(x.p, parallel.COMPLETION_STATUS_KHR) === true,
  )
}

/** Reads the build's results; throws the first failure, leaving nothing behind. */
export function finishBuild(
  gl: WebGL2RenderingContext,
  b: ProgramBuild,
): BuiltPrograms {
  const made: WebGLProgram[] = []
  try {
    const scene = finish(gl, b.scene)
    made.push(scene.p)
    const post = b.post.map((x) => {
      const prg = finish(gl, x)
      made.push(prg.p)
      return prg
    })
    return {
      quality: b.quality,
      scene: { ...scene, q: QUALITY[b.quality] },
      post:
        post.length === 3
          ? { down: post[0], blur: post[1], comp: post[2] }
          : null,
    }
  } catch (err) {
    // finish() released the one that failed; release what came before it
    // and what was never read.
    for (const p of made) gl.deleteProgram(p)
    for (const x of [b.scene, ...b.post].slice(made.length + 1)) drop(gl, x)
    throw err
  }
}

/** Releases a build that will never be read (destroy, a failure elsewhere). */
export function dropBuild(gl: WebGL2RenderingContext, b: ProgramBuild): void {
  for (const x of [b.scene, ...b.post]) drop(gl, x)
}

/**
 * Runs `poll` on the next frame, or after 100 ms where frames have stopped (a
 * hidden tab has none, and its programs still finish): once per ask, until
 * cancelled. A poll of a build costs a COMPLETION_STATUS_KHR query a program.
 */
export function createPoller(poll: () => void): {
  ask(): void
  cancel(): void
} {
  let frame = 0
  let timer = 0
  const cancel = (): void => {
    if (frame) cancelAnimationFrame(frame)
    window.clearTimeout(timer)
    frame = 0
    timer = 0
  }
  const run = (): void => {
    cancel()
    poll()
  }
  return {
    ask() {
      if (frame || timer) return
      frame = requestAnimationFrame(run)
      timer = window.setTimeout(run, 100)
    },
    cancel,
  }
}

/** Releases a build's programs once read, when they will not be drawn. */
export function deleteBuilt(
  gl: WebGL2RenderingContext,
  b: BuiltPrograms,
): void {
  gl.deleteProgram(b.scene.p)
  if (b.post) deletePostPrograms(gl, b.post)
}

export function deletePostPrograms(
  gl: WebGL2RenderingContext,
  post: PostPrograms,
): void {
  gl.deleteProgram(post.down.p)
  gl.deleteProgram(post.blur.p)
  gl.deleteProgram(post.comp.p)
}
