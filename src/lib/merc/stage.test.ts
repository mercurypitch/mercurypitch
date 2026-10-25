// ============================================================
// Merc stage tests — failure, pause, visibility, context loss, teardown,
// and a shader link that never makes the page wait
// ============================================================
//
// jsdom has no WebGL, so these run against a small stateful fake
// (fake-gl.test-fixtures.ts): a leak is a count, not a guess, and every
// query that would make a real page wait is logged.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeGl, frameQueue, stubContext } from './fake-gl.test-fixtures'
import type { MercVoice } from './sim'
import type { MercStage, MercStageOptions } from './stage'
import { mountMercStage } from './stage'

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
  vi.useRealTimers()
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

  it('tells the shader its loops start at 0', () => {
    // Arrange
    const frames = frameQueue()
    const fake = createFakeGl()
    stubContext(fake.gl)
    mountStage()

    // Act
    frames.run(1000)

    // Assert
    expect(fake.ints.get('uZero')).toBe(0)
  })

  it('stops the frame loop while the page is hidden and resumes when it shows', () => {
    // Arrange
    const frames = frameQueue()
    const fake = createFakeGl()
    stubContext(fake.gl)
    mountStage()
    frames.run(1000)
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

// The fake as a browser that compiles in the background: it offers
// KHR_parallel_shader_compile and holds every compile open until told.
function compilingGl() {
  const fake = createFakeGl()
  fake.state.parallel = true
  fake.state.done = false
  stubContext(fake.gl)
  return fake
}

describe('mountMercStage, while the driver compiles his shaders', () => {
  it('asks nothing that waits, and draws nothing, until the driver says done', () => {
    // Arrange
    const frames = frameQueue()
    const fake = compilingGl()
    const onReady = vi.fn()
    mountStage({ onReady })

    // Act
    frames.run(1000)
    frames.run(1016)
    frames.run(1033)
    const askedCompiling = [...new Set(fake.waits)]
    const drawsCompiling = fake.state.draws
    const readyCompiling = onReady.mock.calls.length
    fake.state.done = true
    frames.run(1050)

    // Assert
    expect(askedCompiling).toEqual(['completion'])
    expect(drawsCompiling).toBe(0)
    expect(readyCompiling).toBe(0)
    expect(fake.state.draws).toBe(DRAWS_PER_FRAME)
    expect(onReady).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['with', true],
    ['without', false],
  ])(
    'reads one link status a program and no shader status %s parallel compile',
    (_, parallel) => {
      // Arrange
      const frames = frameQueue()
      const fake = createFakeGl()
      fake.state.parallel = parallel
      stubContext(fake.gl)
      const onReady = vi.fn()

      // Act
      mountStage({ onReady })
      frames.run(1000)
      frames.run(1016)

      // Assert
      expect(fake.count('link')).toBe(4)
      expect(fake.count('compile')).toBe(0)
      expect(fake.state.draws).toBeGreaterThan(0)
      expect(onReady).toHaveBeenCalledTimes(1)
    },
  )

  it('says why a link failed once the driver is done, and leaves no GL object behind', () => {
    // Arrange
    const frames = frameQueue()
    const fake = compilingGl()
    fake.state.compiles = false
    const onFailure = vi.fn()
    const onReady = vi.fn()
    const stage = mountStage({ onFailure, onReady })
    frames.run(1000)
    const failedCompiling = onFailure.mock.calls.length

    // Act
    fake.state.done = true
    frames.run(1016)

    // Assert
    expect(failedCompiling).toBe(0)
    expect(onFailure).toHaveBeenCalledTimes(1)
    expect(onFailure).toHaveBeenCalledWith(
      expect.stringMatching(/Shader compile failed: ERROR: 0:1: 'fake'/),
    )
    expect(onReady).not.toHaveBeenCalled()
    expect([...fake.live]).toEqual([])
    expect(frames.pending).toBe(0)
    expect(stage.ok).toBe(false)
  })

  it('frees the context and stops asking when destroyed mid-compile', () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const frames = frameQueue()
    const fake = compilingGl()
    const onReady = vi.fn()
    const stage = mountStage({ onReady })
    frames.run(1000)
    const asked = fake.waits.length

    // Act
    stage.destroy()
    fake.state.done = true
    vi.advanceTimersByTime(1000)
    frames.run(2000)

    // Assert
    expect(fake.waits.length).toBe(asked)
    expect([...fake.live]).toEqual([])
    expect(fake.loseContext).toHaveBeenCalledTimes(1)
    expect(host.querySelector('canvas')).toBeNull()
    expect(frames.pending).toBe(0)
    expect(onReady).not.toHaveBeenCalled()
  })

  it('keeps asking on a hidden page, which has no frames, and says ready once he is drawn', () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const frames = frameQueue()
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')
    const fake = compilingGl()
    const onReady = vi.fn()
    mountStage({ onReady })

    // Act
    vi.advanceTimersByTime(300)
    const askedHidden = fake.count('completion')
    fake.state.done = true
    vi.advanceTimersByTime(100)
    const linkedHidden = fake.count('link')
    const readyHidden = onReady.mock.calls.length
    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    frames.run(1000)

    // Assert
    expect(askedHidden).toBe(3)
    expect(linkedHidden).toBe(4)
    expect(readyHidden).toBe(0)
    expect(fake.state.draws).toBe(DRAWS_PER_FRAME)
    expect(onReady).toHaveBeenCalledTimes(1)
  })

  // A browser forgets the extensions it enabled when the context is lost.
  it('asks for the parallel compile again on a restored context, and draws once the driver is done', () => {
    // Arrange
    const frames = frameQueue()
    const fake = compilingGl()
    const onReady = vi.fn()
    const stage = mountStage({ onReady })
    fake.state.done = true
    frames.run(1000)
    const canvas = host.querySelector('canvas')!
    fake.drop()
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    fake.state.lost = false
    fake.state.done = false
    const drawsBefore = fake.state.draws
    const asked = fake.waits.length

    // Act
    canvas.dispatchEvent(new Event('webglcontextrestored'))
    frames.run(2000)
    frames.run(2016)
    const linkedCompiling = fake.count('link', asked)
    const drawsCompiling = fake.state.draws - drawsBefore
    fake.state.done = true
    frames.run(2033)

    // Assert
    expect(linkedCompiling).toBe(0)
    expect(drawsCompiling).toBe(0)
    expect(fake.state.draws - drawsBefore).toBe(DRAWS_PER_FRAME)
    expect(stage.ok).toBe(true)
    expect(onReady).toHaveBeenCalledTimes(1)
  })
})

describe('mountMercStage, mounted again and again', () => {
  // Chrome keeps 16 WebGL contexts live at most and drops the oldest, so a
  // context a destroy kept would cost a later Merc his.
  it('gives every context back: twenty mounts and destroys, half mid-compile, leave nothing', () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const frames = frameQueue()
    const fakes = Array.from({ length: 20 }, (_, i) => {
      const fake = createFakeGl()
      fake.state.parallel = i % 2 === 1
      fake.state.done = i % 2 === 0
      return fake
    })
    let next = 0
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      (() => fakes[next++].gl) as unknown as HTMLCanvasElement['getContext'],
    )

    // Act
    for (let i = 0; i < 20; i++) {
      const stage = mountMercStage(host)
      frames.run(1000 + 16 * i)
      stage.destroy()
    }

    // Assert
    expect(fakes.map((f) => f.loseContext.mock.calls.length)).toEqual(
      Array.from({ length: 20 }, () => 1),
    )
    expect(fakes.flatMap((f) => [...f.live])).toEqual([])
    expect(fakes.filter((f) => f.state.draws > 0)).toHaveLength(10)
    expect(frames.pending).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
    expect(host.querySelector('canvas')).toBeNull()
  })
})
