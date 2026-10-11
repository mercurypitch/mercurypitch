// ============================================================
// Merc stage tests — failure, pause, visibility, context loss, teardown
// ============================================================
//
// jsdom has no WebGL, so these run against a small stateful fake: it hands
// out GL objects and records which are still alive, so a leak is a count,
// not a guess. Pixels are proved separately, in a real browser.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MercVoice } from './sim'
import type { MercStage, MercStageOptions } from './stage'
import { mountMercStage } from './stage'

interface GlObject {
  kind: string
}

function createFakeGl() {
  const state = { draws: 0, lost: false, compiles: true }
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
    shaderSource: noop,
    compileShader: noop,
    getShaderParameter: () => state.compiles,
    getShaderInfoLog: () => "ERROR: 0:1: 'fake' : syntax error",
    deleteShader: release,
    createProgram: () => make('program'),
    attachShader: noop,
    linkProgram: noop,
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    deleteProgram: release,
    getUniformLocation: () => ({}),
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
    useProgram: noop,
    activeTexture: noop,
    finish: noop,
    uniform1f: noop,
    uniform1i: noop,
    uniform1fv: noop,
    uniform2f: noop,
    uniform2fv: noop,
    uniform3fv: noop,
    uniform4f: noop,
    uniform4fv: noop,
    drawArrays: () => {
      state.draws++
    },
    isContextLost: () => state.lost,
    getExtension: (name: string) =>
      name === 'WEBGL_lose_context' && !state.lost ? { loseContext } : null,
  }
  return {
    gl: gl as unknown as WebGL2RenderingContext,
    state,
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
function stubContext(ctx: WebGL2RenderingContext | null): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    (() => ctx) as unknown as HTMLCanvasElement['getContext'],
  )
}

// Animation frames that run only when the test says so.
function frameQueue() {
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

// Listeners still attached anywhere, as (type, listener) pairs.
function listenerLedger() {
  const live = new Set<string>()
  const ids = new WeakMap<object, number>()
  let n = 0
  const key = (t: EventTarget, type: string, l: unknown): string => {
    for (const o of [t, l as object]) if (!ids.has(o)) ids.set(o, ++n)
    return `${ids.get(t)}:${type}:${ids.get(l as object)}`
  }
  const add = EventTarget.prototype.addEventListener
  const remove = EventTarget.prototype.removeEventListener
  vi.spyOn(EventTarget.prototype, 'addEventListener').mockImplementation(
    function (this: EventTarget, type, l, o) {
      if (l) live.add(key(this, type, l))
      add.call(this, type, l, o)
    },
  )
  vi.spyOn(EventTarget.prototype, 'removeEventListener').mockImplementation(
    function (this: EventTarget, type, l, o) {
      if (l) live.delete(key(this, type, l))
      remove.call(this, type, l, o)
    },
  )
  return live
}

const VOICE: MercVoice = {
  voiced: true,
  cents: 0,
  level: 0.5,
  steady: 0.9,
  midi: 57,
}

// One frame: the scene, eight bloom passes, the composite.
const DRAWS_PER_FRAME = 10

let host: HTMLDivElement
const mounted: MercStage[] = []

// Every stage a test mounts is destroyed after it, so no listener of one
// test answers another test's events.
function mountStage(opts?: MercStageOptions): MercStage {
  const stage = mountMercStage(host, opts)
  mounted.push(stage)
  return stage
}

beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  for (const stage of mounted.splice(0)) stage.destroy()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  host.remove()
})

describe('mountMercStage', () => {
  it('returns a stage that is not ok, with no canvas left, when WebGL2 is missing', () => {
    // Arrange
    stubContext(null)
    const onFailure = vi.fn()

    // Act
    const stage = mountStage({ onFailure })

    // Assert
    expect(stage.ok).toBe(false)
    expect(host.querySelector('canvas')).toBeNull()
    expect(onFailure).toHaveBeenCalledTimes(1)
    expect(onFailure).toHaveBeenCalledWith(expect.stringMatching(/WebGL2/))
    expect(() => {
      stage.setState('sing')
      stage.setVoice(VOICE)
      stage.setPaused(true)
      stage.destroy()
    }).not.toThrow()
  })

  it('reports a shader the driver rejects and leaves no GL object behind', () => {
    // Arrange
    const fake = createFakeGl()
    fake.state.compiles = false
    stubContext(fake.gl)
    const onFailure = vi.fn()

    // Act
    const stage = mountStage({ onFailure })

    // Assert
    expect(stage.ok).toBe(false)
    expect(onFailure).toHaveBeenCalledWith(
      expect.stringMatching(/Shader compile failed/),
    )
    expect(fake.created.length).toBeGreaterThan(0)
    expect([...fake.live]).toEqual([])
    expect(fake.loseContext).toHaveBeenCalledTimes(1)
    expect(host.querySelector('canvas')).toBeNull()
  })

  it('draws every animation frame, and asks for none while paused', () => {
    // Arrange
    const frames = frameQueue()
    const fake = createFakeGl()
    stubContext(fake.gl)
    const stage = mountStage()
    frames.run(1000)
    const drawsRunning = fake.state.draws

    // Act
    stage.setPaused(true)
    const pendingPaused = frames.pending
    stage.setPaused(false)

    // Assert
    expect(drawsRunning).toBe(DRAWS_PER_FRAME)
    expect(pendingPaused).toBe(0)
    expect(frames.pending).toBe(1)
    expect(stage.ok).toBe(true)
  })

  it('stops the frame loop while the page is hidden and resumes when it shows', () => {
    // Arrange
    const frames = frameQueue()
    const fake = createFakeGl()
    stubContext(fake.gl)
    mountStage()
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')

    // Act
    document.dispatchEvent(new Event('visibilitychange'))
    const pendingHidden = frames.pending
    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))

    // Assert
    expect(pendingHidden).toBe(0)
    expect(frames.pending).toBe(1)
  })

  it('waits out a lost context, then rebuilds and draws again after the restore', () => {
    // Arrange
    const frames = frameQueue()
    const fake = createFakeGl()
    stubContext(fake.gl)
    const stage = mountStage()
    const canvas = host.querySelector('canvas')!
    const programsBefore = fake.programs()
    const lost = new Event('webglcontextlost', { cancelable: true })

    // Act
    fake.drop()
    canvas.dispatchEvent(lost)
    const pendingLost = frames.pending
    fake.state.lost = false
    canvas.dispatchEvent(new Event('webglcontextrestored'))
    frames.run(2000)

    // Assert
    expect(lost.defaultPrevented).toBe(true)
    expect(pendingLost).toBe(0)
    expect(fake.programs() - programsBefore).toBe(4)
    expect(fake.state.draws).toBe(DRAWS_PER_FRAME)
    expect(stage.ok).toBe(true)
  })

  it('turns not ok and reports once when the restore cannot rebuild', () => {
    // Arrange
    const frameq = frameQueue()
    const fake = createFakeGl()
    stubContext(fake.gl)
    const onFailure = vi.fn()
    const stage = mountStage({ onFailure })
    const canvas = host.querySelector('canvas')!
    fake.drop()
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))

    // Act
    fake.state.lost = false
    fake.state.compiles = false
    canvas.dispatchEvent(new Event('webglcontextrestored'))

    // Assert
    expect(stage.ok).toBe(false)
    expect(onFailure).toHaveBeenCalledTimes(1)
    expect([...fake.live]).toEqual([])
    expect(frameq.pending).toBe(0)
  })

  it('releases every GL object, listener, observer and the canvas on destroy', () => {
    // Arrange
    const frames = frameQueue()
    const listeners = listenerLedger()
    const observers: { active: boolean }[] = []
    vi.stubGlobal(
      'ResizeObserver',
      class {
        state = { active: false }
        constructor() {
          observers.push(this.state)
        }
        observe() {
          this.state.active = true
        }
        unobserve() {}
        disconnect() {
          this.state.active = false
        }
      },
    )
    const fake = createFakeGl()
    stubContext(fake.gl)
    const stage = mountStage()
    frames.run(1000)
    const liveBefore = fake.live.size
    const listenersBefore = listeners.size

    // Act
    stage.destroy()

    // Assert
    expect(liveBefore).toBeGreaterThan(0)
    expect(listenersBefore).toBe(3)
    expect([...fake.live]).toEqual([])
    expect([...listeners]).toEqual([])
    expect(observers).toEqual([{ active: false }])
    expect(fake.loseContext).toHaveBeenCalledTimes(1)
    expect(host.querySelector('canvas')).toBeNull()
    expect(frames.pending).toBe(0)
    expect(stage.ok).toBe(false)
  })
})
