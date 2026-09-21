// Loading Merc lifecycle — optional 3D work retires cleanly and never gates the game.

import type * as ThreeTypes from 'three'
import { AnimationClip, AnimationMixer, Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, Texture, VectorKeyframeTrack, } from 'three'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  loadModel: vi.fn(),
  render: vi.fn(),
  rendererDispose: vi.fn(),
  forceContextLoss: vi.fn(),
  environmentDispose: vi.fn(),
  environmentFailure: null as Error | null,
  sourceDispose: vi.fn(),
  observerDisconnect: vi.fn(),
  visibility: 'visible' as DocumentVisibilityState,
  documentListeners: new Map<string, EventListener>(),
  rafCallbacks: new Map<number, FrameRequestCallback>(),
  nextRaf: 1,
}))

vi.mock('three', async (original) => ({
  ...(await original<typeof ThreeTypes>()),
  PMREMGenerator: class {
    fromEquirectangular() {
      if (state.environmentFailure !== null) throw state.environmentFailure
      return {
        texture: new Texture(),
        dispose: state.environmentDispose,
      }
    }
    dispose() {}
  },
  WebGLRenderer: class {
    outputColorSpace = ''
    toneMapping = 0
    toneMappingExposure = 1
    shadowMap = { enabled: true }
    setClearColor = vi.fn()
    setPixelRatio = vi.fn()
    setSize = vi.fn()
    render = state.render
    dispose = state.rendererDispose
    forceContextLoss = state.forceContextLoss
  },
}))

vi.mock('./materials', async () => {
  const { Texture: ThreeTexture } =
    await vi.importActual<typeof ThreeTypes>('three')
  return {
    createReflectionTexture: () => {
      const texture = new ThreeTexture()
      texture.dispose = state.sourceDispose
      return texture
    },
  }
})

vi.mock('./merc-model', () => ({
  loadMercModel: (...args: unknown[]) => state.loadModel(...args),
}))

import { createLoadingMerc, measureMercPreviewBounds } from './loading-merc'

interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T): void
  reject(error: unknown): void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept
    reject = decline
  })
  return { promise, resolve, reject }
}

function fakeAsset() {
  const body = new Group()
  body.add(new Mesh(new BoxGeometry(0.8, 1.4, 0.5), new MeshBasicMaterial()))
  return {
    body,
    animations: [
      new AnimationClip('welcome', 0.08, []),
      new AnimationClip('listen', 1, []),
      new AnimationClip('laugh', 0.08, []),
    ],
    bounds: new Box3().setFromObject(body),
    metal: new MeshPhysicalMaterial(),
    dispose: vi.fn(),
  }
}

function browserFixture() {
  const canvasListeners = new Map<string, EventListener>()
  const canvas = {
    clientWidth: 320,
    clientHeight: 260,
    width: 320,
    height: 260,
    addEventListener: (name: string, listener: EventListener) =>
      canvasListeners.set(name, listener),
    removeEventListener: (name: string, listener: EventListener) => {
      if (canvasListeners.get(name) === listener) canvasListeners.delete(name)
    },
  } as unknown as HTMLCanvasElement
  vi.stubGlobal('window', { devicePixelRatio: 2 })
  vi.stubGlobal('document', {
    get visibilityState() {
      return state.visibility
    },
    addEventListener(name: string, listener: EventListener) {
      state.documentListeners.set(name, listener)
    },
    removeEventListener(name: string, listener: EventListener) {
      if (state.documentListeners.get(name) === listener)
        state.documentListeners.delete(name)
    },
  })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect = state.observerDisconnect
    },
  )
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = state.nextRaf++
    state.rafCallbacks.set(id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    state.rafCallbacks.delete(id)
  })
  return { canvas, canvasListeners }
}

function runFrame(timestamp: number): void {
  const first = state.rafCallbacks.entries().next().value as
    | [number, FrameRequestCallback]
    | undefined
  if (first === undefined) throw new Error('No loading Merc frame scheduled')
  state.rafCallbacks.delete(first[0])
  first[1](timestamp)
}

async function flushLoad(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(() => {
  vi.clearAllMocks()
  state.visibility = 'visible'
  state.environmentFailure = null
  state.documentListeners.clear()
  state.rafCallbacks.clear()
  state.nextRaf = 1
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('measures animated hand travel and restores the authored pose', () => {
  const root = new Group()
  const hand = new Mesh(new BoxGeometry(0.2, 0.2, 0.2), new MeshBasicMaterial())
  hand.name = 'preview_hand'
  root.add(hand)
  const welcome = new AnimationClip('welcome', 1, [
    new VectorKeyframeTrack(
      'preview_hand.position',
      [0, 0.5, 1],
      [0, 0, 0, 2, 0, 0, 0, 0, 0],
    ),
  ])

  const measured = measureMercPreviewBounds(root, [welcome])

  expect(measured.max.x).toBeGreaterThan(2.09)
  expect(hand.position.x).toBeCloseTo(0)
})

it('rolls back the renderer and procedural source when studio setup fails', () => {
  const { canvas } = browserFixture()
  state.environmentFailure = new Error('PMREM allocation failed')

  expect(() =>
    createLoadingMerc(canvas, {
      modelUrl: 'merc.glb',
      reducedMotion: false,
      onFirstFrame: vi.fn(),
      onError: vi.fn(),
    }),
  ).toThrow('PMREM allocation failed')
  expect(state.sourceDispose).toHaveBeenCalledOnce()
  expect(state.rendererDispose).toHaveBeenCalledOnce()
  expect(state.forceContextLoss).toHaveBeenCalledOnce()
  expect(state.loadModel).not.toHaveBeenCalled()
})

it('renders once, stops scheduling while hidden, and resumes without hidden elapsed time', async () => {
  const pending = deferred<ReturnType<typeof fakeAsset>>()
  state.loadModel.mockReturnValueOnce(pending.promise)
  const { canvas } = browserFixture()
  const onFirstFrame = vi.fn()
  const controller = createLoadingMerc(canvas, {
    modelUrl: 'merc.glb',
    reducedMotion: false,
    onFirstFrame,
    onError: vi.fn(),
  })
  const loaded = fakeAsset()
  pending.resolve(loaded)
  await flushLoad()

  runFrame(100)
  expect(onFirstFrame).toHaveBeenCalledTimes(1)
  expect(state.rafCallbacks.size).toBe(1)
  state.visibility = 'hidden'
  state.documentListeners.get('visibilitychange')?.(
    new Event('visibilitychange'),
  )
  expect(state.rafCallbacks.size).toBe(0)

  state.visibility = 'visible'
  state.documentListeners.get('visibilitychange')?.(
    new Event('visibilitychange'),
  )
  runFrame(10_000)
  expect(onFirstFrame).toHaveBeenCalledTimes(1)
  expect(state.rafCallbacks.size).toBe(1)

  controller.dispose()
  expect(loaded.dispose).toHaveBeenCalledTimes(1)
  expect(state.rendererDispose).toHaveBeenCalledTimes(1)
  expect(state.forceContextLoss).toHaveBeenCalledTimes(1)
  expect(state.environmentDispose).toHaveBeenCalledTimes(1)
  expect(state.observerDisconnect).toHaveBeenCalledTimes(1)
  expect(state.rafCallbacks.size).toBe(0)
  expect(state.documentListeners.size).toBe(0)
})

it('retires a model that resolves after disposal without rendering or signalling', async () => {
  const pending = deferred<ReturnType<typeof fakeAsset>>()
  state.loadModel.mockReturnValueOnce(pending.promise)
  const { canvas } = browserFixture()
  const onFirstFrame = vi.fn()
  const onError = vi.fn()
  const controller = createLoadingMerc(canvas, {
    modelUrl: 'merc.glb',
    reducedMotion: false,
    onFirstFrame,
    onError,
  })
  controller.dispose()
  const loaded = fakeAsset()
  pending.resolve(loaded)
  await flushLoad()

  expect(loaded.dispose).toHaveBeenCalledTimes(1)
  expect(state.render).not.toHaveBeenCalled()
  expect(onFirstFrame).not.toHaveBeenCalled()
  expect(onError).not.toHaveBeenCalled()
})

it('releases graphics and reports an actual preview load failure once', async () => {
  const pending = deferred<ReturnType<typeof fakeAsset>>()
  state.loadModel.mockReturnValueOnce(pending.promise)
  const { canvas } = browserFixture()
  const failure = new Error('GLB unavailable')
  const onError = vi.fn()
  createLoadingMerc(canvas, {
    modelUrl: 'merc.glb',
    reducedMotion: false,
    onFirstFrame: vi.fn(),
    onError,
  })
  pending.reject(failure)
  await flushLoad()

  expect(onError).toHaveBeenCalledOnce()
  expect(onError).toHaveBeenCalledWith(failure)
  expect(state.rendererDispose).toHaveBeenCalledOnce()
  expect(state.environmentDispose).toHaveBeenCalledOnce()
  expect(state.rafCallbacks.size).toBe(0)
})

it('renders a calm first frame for a game-load error without treating it as a preview failure', async () => {
  const pending = deferred<ReturnType<typeof fakeAsset>>()
  state.loadModel.mockReturnValueOnce(pending.promise)
  const { canvas } = browserFixture()
  const onFirstFrame = vi.fn()
  const onError = vi.fn()
  const controller = createLoadingMerc(canvas, {
    modelUrl: 'merc.glb',
    reducedMotion: false,
    onFirstFrame,
    onError,
  })
  controller.setState({ phase: 'error', completedUnits: 2, totalUnits: 5 })
  pending.resolve(fakeAsset())
  await flushLoad()
  runFrame(0)

  expect(onFirstFrame).toHaveBeenCalledOnce()
  expect(onError).not.toHaveBeenCalled()
  expect(state.rafCallbacks.size).toBe(0)
  controller.dispose()
})

it('retires an active preview immediately on WebGL context loss', async () => {
  const pending = deferred<ReturnType<typeof fakeAsset>>()
  state.loadModel.mockReturnValueOnce(pending.promise)
  const { canvas, canvasListeners } = browserFixture()
  const onError = vi.fn()
  createLoadingMerc(canvas, {
    modelUrl: 'merc.glb',
    reducedMotion: false,
    onFirstFrame: vi.fn(),
    onError,
  })
  const loaded = fakeAsset()
  pending.resolve(loaded)
  await flushLoad()
  runFrame(0)
  const event = { preventDefault: vi.fn() } as unknown as Event
  canvasListeners.get('webglcontextlost')?.(event)

  expect(event.preventDefault).toHaveBeenCalledOnce()
  expect(onError).toHaveBeenCalledOnce()
  expect(loaded.dispose).toHaveBeenCalledOnce()
  expect(state.rafCallbacks.size).toBe(0)
  expect(canvasListeners.has('webglcontextlost')).toBe(false)
})

it('plays welcome once, returns to listen, and laughs once on later progress only', async () => {
  const clipAction = vi.spyOn(AnimationMixer.prototype, 'clipAction')
  const pending = deferred<ReturnType<typeof fakeAsset>>()
  state.loadModel.mockReturnValueOnce(pending.promise)
  const { canvas } = browserFixture()
  const controller = createLoadingMerc(canvas, {
    modelUrl: 'merc.glb',
    reducedMotion: false,
    onFirstFrame: vi.fn(),
    onError: vi.fn(),
  })
  pending.resolve(fakeAsset())
  await flushLoad()
  const names = () =>
    clipAction.mock.calls.map(([candidate]) =>
      typeof candidate === 'string' ? candidate : candidate.name,
    )
  expect(names().filter((name) => name === 'welcome')).toHaveLength(2)

  runFrame(0)
  runFrame(50)
  runFrame(100)
  expect(names().filter((name) => name === 'listen')).toHaveLength(2)
  controller.setState({
    phase: 'loading-assets',
    completedUnits: 1,
    totalUnits: 4,
  })
  expect(names().filter((name) => name === 'laugh')).toHaveLength(2)
  controller.setState({
    phase: 'loading-assets',
    completedUnits: 2,
    totalUnits: 4,
  })
  expect(names().filter((name) => name === 'laugh')).toHaveLength(2)
  controller.setState({
    phase: 'awaiting-first-frame',
    completedUnits: 4,
    totalUnits: 4,
  })
  expect(names().filter((name) => name === 'listen')).toHaveLength(3)
  controller.dispose()
})

it('stops an in-flight greeting before applying the exact reduced-motion listen pose', async () => {
  const stopAllActions = vi.spyOn(AnimationMixer.prototype, 'stopAllAction')
  const pending = deferred<ReturnType<typeof fakeAsset>>()
  state.loadModel.mockReturnValueOnce(pending.promise)
  const { canvas } = browserFixture()
  const controller = createLoadingMerc(canvas, {
    modelUrl: 'merc.glb',
    reducedMotion: false,
    onFirstFrame: vi.fn(),
    onError: vi.fn(),
  })
  pending.resolve(fakeAsset())
  await flushLoad()
  stopAllActions.mockClear()

  controller.setReducedMotion(true)
  expect(stopAllActions).toHaveBeenCalledOnce()
  runFrame(0)
  expect(state.rafCallbacks.size).toBe(0)
  controller.dispose()
})
