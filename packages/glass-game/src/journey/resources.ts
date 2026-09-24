// Journey resources — abortable glTF parsing and one foreground-owned frame clock.

import type { AnimationClip, Group } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { disposeObject } from '../render/dispose'

export interface JourneyGltfDocument {
  scene: Group
  animations: readonly AnimationClip[]
  dispose(): void
}

interface ParsedJourneyGltf {
  scene: Group
  animations: AnimationClip[]
}

export interface JourneyGltfLoadOptions {
  fetch?: typeof fetch
  parse?: (
    bytes: ArrayBuffer,
    resourcePath: string,
  ) => Promise<ParsedJourneyGltf>
}

function abortError(): Error {
  if (typeof DOMException === 'function')
    return new DOMException('Journey asset load cancelled.', 'AbortError')
  const error = new Error('Journey asset load cancelled.')
  error.name = 'AbortError'
  return error
}

export async function loadJourneyGltf(
  url: string,
  signal: AbortSignal,
  options: JourneyGltfLoadOptions = {},
): Promise<JourneyGltfDocument> {
  const response = await (options.fetch ?? fetch)(url, { signal })
  if (!response.ok) throw new Error(`Journey asset unavailable: ${url}`)
  const bytes = await response.arrayBuffer()
  if (signal.aborted) throw abortError()
  const resourcePath = url.slice(0, Math.max(0, url.lastIndexOf('/') + 1))
  const parsed = await (
    options.parse ?? ((data, path) => new GLTFLoader().parseAsync(data, path))
  )(bytes, resourcePath)
  if (signal.aborted) {
    disposeObject(parsed.scene)
    throw abortError()
  }
  let disposed = false
  return {
    scene: parsed.scene,
    animations: parsed.animations,
    dispose() {
      if (disposed) return
      disposed = true
      disposeObject(parsed.scene)
    },
  }
}

export interface JourneyFrameScheduler {
  request(callback: FrameRequestCallback): number
  cancel(id: number): void
}

export interface JourneyFrameLoop {
  setForeground(foreground: boolean): void
  visibleSeconds(): number
  dispose(): void
}

export type JourneyResourceState = 'active' | 'disposed' | 'failed'

/** A late model can install only into a live context; every other path retires it. */
export async function acceptJourneyResource<T extends { dispose(): void }>(
  pending: Promise<T>,
  state: () => JourneyResourceState,
  install: (resource: T) => void,
): Promise<void> {
  const resource = await pending
  const current = state()
  if (current === 'active') {
    install(resource)
    return
  }
  resource.dispose()
  if (current === 'failed')
    throw new Error('The floating museum lost its graphics context.')
}

const BROWSER_FRAME_SCHEDULER: JourneyFrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (id) => cancelAnimationFrame(id),
}

/** Hidden time never advances animation state and repeated signals stay idempotent. */
export function createJourneyFrameLoop(
  update: (visibleSeconds: number, dt: number) => void,
  scheduler: JourneyFrameScheduler = BROWSER_FRAME_SCHEDULER,
): JourneyFrameLoop {
  let foreground = false
  let disposed = false
  let frameId: number | undefined
  let previousMs: number | undefined
  let elapsed = 0

  const frame = (nowMs: number): void => {
    frameId = undefined
    if (disposed || !foreground) return
    const dt =
      previousMs === undefined
        ? 0
        : Math.max(0, Math.min(0.05, (nowMs - previousMs) / 1000))
    previousMs = nowMs
    elapsed += dt
    update(elapsed, dt)
    if (!disposed && foreground) frameId = scheduler.request(frame)
  }

  return {
    setForeground(next) {
      if (disposed || foreground === next) return
      foreground = next
      previousMs = undefined
      if (!next) {
        if (frameId !== undefined) scheduler.cancel(frameId)
        frameId = undefined
      } else if (frameId === undefined) frameId = scheduler.request(frame)
    },
    visibleSeconds: () => elapsed,
    dispose() {
      if (disposed) return
      disposed = true
      foreground = false
      if (frameId !== undefined) scheduler.cancel(frameId)
      frameId = undefined
      previousMs = undefined
    },
  }
}
