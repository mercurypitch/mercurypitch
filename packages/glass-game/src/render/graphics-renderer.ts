// ============================================================
// Graphics renderer — rolls back Three's canvas listeners when construction fails.
// ============================================================
import type { WebGLRendererParameters } from 'three'
import { WebGLRenderer } from 'three'
import type { GraphicsCanvasScene } from './graphics-diagnostics'
import { registerGraphicsCanvas, retireGraphicsCanvas, } from './graphics-diagnostics'

/** Three registers restore listeners before initializing the state they read. */
export function createGraphicsRenderer(
  scene: GraphicsCanvasScene,
  parameters: Omit<WebGLRendererParameters, 'canvas'> & {
    canvas?: HTMLCanvasElement
  },
): WebGLRenderer {
  const canvas = parameters.canvas ?? document.createElement('canvas')
  registerGraphicsCanvas(canvas, scene)
  const ownAdd = Object.getOwnPropertyDescriptor(canvas, 'addEventListener')
  const add = canvas.addEventListener
  const registrations: {
    type: string
    listener: EventListenerOrEventListenerObject
    capture: boolean
  }[] = []
  // This is synchronous and canvas-local. A successful renderer keeps its
  // listeners and removes them through Three's ordinary dispose method.
  canvas.addEventListener = (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => {
    registrations.push({
      type,
      listener,
      capture:
        typeof options === 'boolean' ? options : (options?.capture ?? false),
    })
    add.call(canvas, type, listener, options)
  }
  try {
    return new WebGLRenderer({ ...parameters, canvas })
  } catch (error) {
    retireGraphicsCanvas(canvas)
    for (const { type, listener, capture } of registrations)
      canvas.removeEventListener(type, listener, { capture })
    throw error
  } finally {
    if (ownAdd === undefined) Reflect.deleteProperty(canvas, 'addEventListener')
    else Object.defineProperty(canvas, 'addEventListener', ownAdd)
  }
}
