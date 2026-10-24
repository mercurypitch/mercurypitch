// ============================================================
// A fake WebGL2 for Merc's tests — stateful, so a leak is a count
// ============================================================
//
// jsdom has no WebGL. This fake hands out GL objects and records which are
// still alive, the shader texts it was given and the uniforms last set. It
// can offer KHR_parallel_shader_compile and hold a compile open, and it logs
// every query that would make a real page wait for the driver. Pixels are
// proved separately, in a real browser.

import { vi } from 'vitest'

export interface GlObject {
  kind: string
}

const COMPLETION_STATUS_KHR = 0x91b1

// The calls that wait for the driver in a real browser, as the fake saw them.
export type Wait = 'completion' | 'link' | 'compile' | 'uniform' | 'use'

export function createFakeGl() {
  // parallel: offers KHR_parallel_shader_compile; done: the driver finished.
  const state = {
    draws: 0,
    lost: false,
    compiles: true,
    parallel: false,
    done: true,
  }
  const waits: Wait[] = []
  // The int and vec3 uniforms last set, by name, and every shader's text.
  const ints = new Map<string, number>()
  const vec3s = new Map<string, number[]>()
  const sources: string[] = []
  const live = new Set<GlObject>()
  const created: GlObject[] = []
  const make = (kind: string): GlObject => {
    const o = { kind }
    live.add(o)
    created.push(o)
    return o
  }
  const release = (o: GlObject | null): void => {
    if (o) live.delete(o)
  }
  const loseContext = vi.fn(() => {
    state.lost = true
  })
  const noop = (): void => {}
  const gl = {
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
    TEXTURE_2D: 0x0de1,
    RGBA8: 0x8058,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    LINEAR: 0x2601,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    CLAMP_TO_EDGE: 0x812f,
    FRAMEBUFFER: 0x8d40,
    COLOR_ATTACHMENT0: 0x8ce0,
    FRAMEBUFFER_COMPLETE: 0x8cd5,
    TRIANGLES: 0x0004,
    TEXTURE0: 0x84c0,
    createShader: () => make('shader'),
    shaderSource: (_s: GlObject, src: string) => {
      sources.push(src)
    },
    compileShader: noop,
    getShaderParameter: () => {
      waits.push('compile')
      return state.compiles
    },
    getShaderInfoLog: () => "ERROR: 0:1: 'fake' : syntax error",
    deleteShader: release,
    createProgram: () => make('program'),
    attachShader: noop,
    linkProgram: noop,
    // A shader that did not compile fails its program's link.
    getProgramParameter: (_p: GlObject, pname: number) => {
      if (pname === COMPLETION_STATUS_KHR) {
        waits.push('completion')
        return state.done
      }
      waits.push('link')
      return state.compiles
    },
    getProgramInfoLog: () => '',
    deleteProgram: release,
    getUniformLocation: (_p: GlObject, name: string) => {
      waits.push('uniform')
      return { name }
    },
    createTexture: () => make('texture'),
    bindTexture: noop,
    texStorage2D: noop,
    texParameteri: noop,
    deleteTexture: release,
    createFramebuffer: () => make('framebuffer'),
    bindFramebuffer: noop,
    framebufferTexture2D: noop,
    drawBuffers: noop,
    checkFramebufferStatus: () => 0x8cd5,
    deleteFramebuffer: release,
    createVertexArray: () => make('vao'),
    bindVertexArray: noop,
    deleteVertexArray: release,
    viewport: noop,
    useProgram: () => {
      waits.push('use')
    },
    activeTexture: noop,
    finish: noop,
    uniform1f: noop,
    uniform1i: (loc: { name: string } | null, v: number) => {
      if (loc) ints.set(loc.name, v)
    },
    uniform1fv: noop,
    uniform2f: noop,
    uniform2fv: noop,
    uniform3fv: (loc: { name: string } | null, v: Float32Array) => {
      if (loc) vec3s.set(loc.name, Array.from(v))
    },
    uniform4f: noop,
    uniform4fv: noop,
    drawArrays: () => {
      state.draws++
    },
    isContextLost: () => state.lost,
    getExtension: (name: string) => {
      if (state.lost) return null
      if (name === 'WEBGL_lose_context') return { loseContext }
      if (name === 'KHR_parallel_shader_compile' && state.parallel) {
        return { COMPLETION_STATUS_KHR }
      }
      return null
    },
  }
  return {
    gl: gl as unknown as WebGL2RenderingContext,
    state,
    waits,
    ints,
    vec3s,
    sources,
    // How many of `kind` the fake has been asked, since `from`.
    count: (kind: Wait, from = 0) =>
      waits.slice(from).filter((w) => w === kind).length,
    live,
    created,
    loseContext,
    programs: () => created.filter((o) => o.kind === 'program').length,
    // What a driver does: every object dies with the context.
    drop: () => {
      state.lost = true
      live.clear()
    },
  }
}

// getContext's overloads end in WebGPU's, so a typed spy cannot return a GL
// context directly.
export function stubContext(ctx: WebGL2RenderingContext | null): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    (() => ctx) as unknown as HTMLCanvasElement['getContext'],
  )
}

// Animation frames that run only when the test says so.
export function frameQueue() {
  let next = 1
  const pending = new Map<number, FrameRequestCallback>()
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    pending.set(next, cb)
    return next++
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    pending.delete(id)
  })
  return {
    get pending() {
      return pending.size
    },
    run(now: number) {
      const cbs = [...pending.values()]
      pending.clear()
      for (const cb of cbs) cb(now)
    },
  }
}
