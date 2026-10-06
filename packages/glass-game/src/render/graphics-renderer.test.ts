// Graphics construction rollback — preserve unrelated listeners and normal Three disposal.
import type { WebGLRendererParameters } from 'three'
import { beforeEach, expect, it, vi } from 'vitest'
import { getGraphicsCanvasDiagnostic } from './graphics-diagnostics'
import { createGraphicsRenderer } from './graphics-renderer'

const state = vi.hoisted(() => ({
  fail: true,
  failure: new Error('context initialization failed'),
  restored: vi.fn(),
  lost: vi.fn(),
}))
vi.mock('three', () => ({
  WebGLRenderer: class {
    domElement: HTMLCanvasElement
    constructor(parameters: WebGLRendererParameters) {
      this.domElement = parameters.canvas as HTMLCanvasElement
      this.domElement.addEventListener(
        'webglcontextrestored',
        state.restored,
        true,
      )
      this.domElement.addEventListener('webglcontextlost', state.lost, {
        capture: false,
      })
      if (state.fail) throw state.failure
    }
    dispose() {
      this.domElement.removeEventListener(
        'webglcontextrestored',
        state.restored,
        { capture: true },
      )
      this.domElement.removeEventListener('webglcontextlost', state.lost, false)
    }
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  state.fail = true
})

it.each(['gallery', 'museum-map', 'singing-current', 'loading-merc'] as const)(
  'retires failed %s construction without removing an existing canvas listener',
  (scene) => {
    const canvas = new EventTarget() as HTMLCanvasElement
    const existing = vi.fn()
    canvas.addEventListener('webglcontextrestored', existing)
    const originalAdd = canvas.addEventListener

    expect(() => createGraphicsRenderer(scene, { canvas })).toThrow(
      state.failure,
    )
    expect(canvas.addEventListener).toBe(originalAdd)
    expect(Object.hasOwn(canvas, 'addEventListener')).toBe(false)
    canvas.dispatchEvent(new Event('webglcontextrestored'))
    canvas.dispatchEvent(new Event('webglcontextlost'))
    expect(existing).toHaveBeenCalledOnce()
    expect(state.restored).not.toHaveBeenCalled()
    expect(state.lost).not.toHaveBeenCalled()
    expect(getGraphicsCanvasDiagnostic(canvas)).toMatchObject({
      scene,
      lifecycle: 'disposed',
    })
  },
)

it('retains successful listeners until disposal and restores an own method descriptor', () => {
  state.fail = false
  const canvas = new EventTarget() as HTMLCanvasElement
  const add = vi.fn(canvas.addEventListener.bind(canvas))
  Object.defineProperty(canvas, 'addEventListener', {
    configurable: true,
    writable: true,
    value: add,
  })
  const descriptor = Object.getOwnPropertyDescriptor(canvas, 'addEventListener')
  const renderer = createGraphicsRenderer('gallery', { canvas })
  expect(Object.getOwnPropertyDescriptor(canvas, 'addEventListener')).toEqual(
    descriptor,
  )
  canvas.dispatchEvent(new Event('webglcontextrestored'))
  expect(state.restored).toHaveBeenCalledOnce()
  expect(getGraphicsCanvasDiagnostic(canvas)?.lifecycle).toBe('active')
  renderer.dispose()
  canvas.dispatchEvent(new Event('webglcontextrestored'))
  expect(state.restored).toHaveBeenCalledOnce()
})
