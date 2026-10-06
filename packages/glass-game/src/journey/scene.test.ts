// Journey scene lifecycle tests — setup rollback and readiness include a projected model frame.

import type * as ThreeTypes from 'three'
import { Group, Raycaster } from 'three'
import { beforeEach, expect, it, vi } from 'vitest'
import type { MuseumJourneyDefinition } from '../content/museum-journey'
import type * as JourneyResourceTypes from './resources'

const state = vi.hoisted(() => ({
  setupFailure: new Error('initial reflection failed'),
  cleanupFailure: new Error('renderer cleanup failed'),
  environmentShouldFail: true,
  rendererDispose: vi.fn(),
  setPixelRatio: vi.fn(),
  forceContextLoss: vi.fn(),
  canvasRemove: vi.fn(),
  skyDispose: vi.fn(),
  waterDispose: vi.fn(),
  environmentDispose: vi.fn(),
  environmentLoad: vi.fn(() => Promise.resolve()),
  canvas: undefined as HTMLCanvasElement | undefined,
  loadModels: vi.fn(),
  loopDispose: vi.fn(),
  loopSetForeground: vi.fn(),
  resize: undefined as (() => void) | undefined,
  getError: vi.fn((): number => 0),
  canvasListeners: new Map<string, EventListenerOrEventListenerObject>(),
  renderFrame: undefined as
    | ((visibleSeconds: number, dt: number) => void)
    | undefined,
}))

function rendererCanvas() {
  return {
    style: { cssText: '' },
    dataset: {} as Record<string, string>,
    setAttribute: vi.fn(),
    addEventListener: vi.fn(
      (type: string, listener: EventListenerOrEventListenerObject) =>
        state.canvasListeners.set(type, listener),
    ),
    removeEventListener: vi.fn(
      (type: string, listener: EventListenerOrEventListenerObject) => {
        if (state.canvasListeners.get(type) === listener)
          state.canvasListeners.delete(type)
      },
    ),
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: vi.fn(() => false),
    getBoundingClientRect: vi.fn(() => ({
      left: 0,
      top: 0,
      width: 1024,
      height: 768,
    })),
    remove: state.canvasRemove,
  }
}

vi.mock('three', async (original) => ({
  ...(await original<typeof ThreeTypes>()),
  WebGLRenderer: class {
    domElement: ReturnType<typeof rendererCanvas>
    constructor(parameters: ThreeTypes.WebGLRendererParameters) {
      this.domElement = parameters.canvas as unknown as ReturnType<
        typeof rendererCanvas
      >
      state.canvas = this.domElement as unknown as HTMLCanvasElement
    }
    info = {
      autoReset: true,
      render: { calls: 0, triangles: 0 },
      memory: { geometries: 0, textures: 0 },
      reset: vi.fn(),
    }
    shadowMap = { enabled: false }
    pixelRatio = 1
    setPixelRatio(value: number) {
      this.pixelRatio = value
      state.setPixelRatio(value)
    }
    getPixelRatio() {
      return this.pixelRatio
    }
    setSize = vi.fn()
    getContext = () => ({
      drawingBufferWidth: 1024,
      drawingBufferHeight: 768,
      getError: state.getError,
    })
    render = vi.fn(() => {
      this.info.render.calls++
    })
    dispose = state.rendererDispose
    forceContextLoss = state.forceContextLoss
  },
}))

vi.mock('./sky', async () => {
  const { Group: ThreeGroup, Texture } =
    await vi.importActual<typeof ThreeTypes>('three')
  return {
    createJourneySky: () => ({
      root: new ThreeGroup(),
      background: new Texture(),
      ready: Promise.resolve(),
      resize: vi.fn(),
      update: vi.fn(),
      dispose: state.skyDispose,
    }),
  }
})

vi.mock('./water', async () => {
  const { Group: ThreeGroup } =
    await vi.importActual<typeof ThreeTypes>('three')
  return {
    createJourneyWater: () => ({
      root: new ThreeGroup(),
      setReducedMotion: vi.fn(),
      update: vi.fn(),
      getMetrics: () => ({
        triangles: 0,
        drawCalls: 0,
        secondaryRenderPasses: 0,
      }),
      dispose: state.waterDispose,
    }),
  }
})

vi.mock('./resources', async (original) => ({
  ...(await original<typeof JourneyResourceTypes>()),
  createJourneyFrameLoop: (
    update: (visibleSeconds: number, dt: number) => void,
  ) => {
    state.renderFrame = update
    return {
      setForeground: state.loopSetForeground,
      visibleSeconds: () => 0,
      dispose: state.loopDispose,
    }
  },
}))

vi.mock('./models', () => ({
  loadJourneyMapModels: (...args: unknown[]) => state.loadModels(...args),
}))

vi.mock('../render/environment', () => ({
  createMuseumEnvironment: () => {
    if (state.environmentShouldFail) throw state.setupFailure
    return {
      load: state.environmentLoad,
      dispose: state.environmentDispose,
    }
  },
}))

import { getGraphicsCanvasDiagnostic } from '../render/graphics-diagnostics'
import { createMuseumJourneyScene } from './scene'

const DEFINITION: MuseumJourneyDefinition = {
  id: 'construction-test',
  modelAssetId: 'map',
  landmasses: [
    {
      id: 'island',
      position: [0, 0, 0],
      yaw: 0,
      scale: [1, 1, 1],
      terraceScale: [1, 1, 1],
    },
  ],
  stages: [
    {
      id: 'stage',
      chapterIds: ['chapter'],
      islandId: 'island',
      position: [0, 0, 0],
      architecturePosition: [0, 0, 0],
      yaw: 0,
      scale: 1,
      focus: [0, 0, 0],
      kind: 'pavilion',
      accent: 'jade',
    },
  ],
  bridges: [],
  spillways: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  state.environmentShouldFail = true
  state.renderFrame = undefined
  state.canvas = undefined
  state.resize = undefined
  state.getError.mockReset().mockReturnValue(0)
  state.canvasListeners.clear()
  state.environmentLoad.mockResolvedValue(undefined)
})

function stubBrowser(): void {
  vi.stubGlobal('document', {
    createElement: rendererCanvas,
    visibilityState: 'visible',
  })
  vi.stubGlobal('window', {
    devicePixelRatio: 1,
    matchMedia: () => ({ matches: false }),
  })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(resize: () => void) {
        state.resize = resize
      }
      observe = vi.fn()
      disconnect = vi.fn()
    },
  )
}

function dispatchCanvasEvent(type: string, event: Event): void {
  const listener = state.canvasListeners.get(type)
  if (listener === undefined) throw new Error(`Missing ${type} listener`)
  if (typeof listener === 'function') listener(event)
  else listener.handleEvent(event)
}

it('retires acquired owners and preserves the original construction failure', () => {
  state.rendererDispose.mockImplementationOnce(() => {
    throw state.cleanupFailure
  })
  const append = vi.fn()
  stubBrowser()

  let thrown: unknown
  try {
    createMuseumJourneyScene(
      { append } as unknown as HTMLElement,
      DEFINITION,
      (id) => id,
      {
        selectedStageId: 'stage',
        foreground: true,
        reducedMotion: false,
        onSelect: vi.fn(),
        onFailure: vi.fn(),
      },
    )
  } catch (error) {
    thrown = error
  } finally {
    vi.unstubAllGlobals()
  }

  expect(thrown).toBe(state.setupFailure)
  expect(state.skyDispose).toHaveBeenCalledOnce()
  expect(state.rendererDispose).toHaveBeenCalledOnce()
  expect(state.forceContextLoss).toHaveBeenCalledOnce()
  expect(state.canvasRemove).toHaveBeenCalledOnce()
  expect(append).not.toHaveBeenCalled()
  expect(getGraphicsCanvasDiagnostic(state.canvas!)).toMatchObject({
    scene: 'museum-map',
    lifecycle: 'disposed',
  })
})

it.each([0, 1, 1024])(
  'does not report ready before a visible model-backed frame, starting at width %s',
  async (initialWidth) => {
    state.environmentShouldFail = false
    const markers = [new Group(), new Group(), new Group()] as const
    const model = {
      root: new Group(),
      selectableRoots: new Map([['stage', new Group()]]),
      portraitSurfaces: new Map(),
      portraitMysteries: new Map(),
      starMarkers: new Map([['stage', markers]]),
      setSelected: vi.fn(),
      update: vi.fn(),
      dispose: vi.fn(),
    }
    state.loadModels.mockResolvedValueOnce(model)
    const projections = vi.fn()
    const append = vi.fn()
    stubBrowser()
    const container = {
      append,
      clientWidth: initialWidth,
      clientHeight: 768,
    }
    const scene = createMuseumJourneyScene(
      container as unknown as HTMLElement,
      DEFINITION,
      (id) => id,
      {
        selectedStageId: 'stage',
        foreground: true,
        reducedMotion: false,
        onSelect: vi.fn(),
        onFailure: vi.fn(),
        onProjectStageLabels: projections,
      },
    )
    let readySettled = false
    void scene.ready.then(() => {
      readySettled = true
    })

    try {
      await vi.waitFor(() => expect(model.setSelected).toHaveBeenCalled())
      await Promise.resolve()
      expect(readySettled).toBe(false)
      expect(append).toHaveBeenCalledOnce()

      const renderFrame = state.renderFrame
      if (renderFrame === undefined)
        throw new Error('Missing scene frame callback')
      if (initialWidth < 2) {
        renderFrame(0, 0)
        await Promise.resolve()
        expect(readySettled).toBe(false)
        expect(projections).not.toHaveBeenCalled()
        container.clientWidth = 1024
        state.resize?.()
      }
      renderFrame(0, 0)
      await scene.ready

      expect(readySettled).toBe(true)
      expect(projections).toHaveBeenLastCalledWith([
        expect.objectContaining({ stageId: 'stage', visible: true }),
      ])
    } finally {
      scene.dispose()
      vi.unstubAllGlobals()
    }
  },
)

it('zooms and orbits without turning a pinch into a gallery selection, then resets', async () => {
  state.environmentShouldFail = false
  const hitTarget = new Group()
  hitTarget.userData.journeyStageId = 'stage'
  const model = {
    root: new Group(),
    selectableRoots: new Map([['stage', hitTarget]]),
    portraitSurfaces: new Map(),
    portraitMysteries: new Map(),
    starMarkers: new Map([
      ['stage', [new Group(), new Group(), new Group()] as const],
    ]),
    setSelected: vi.fn(),
    update: vi.fn(),
    dispose: vi.fn(),
  }
  state.loadModels.mockResolvedValueOnce(model)
  const onSelect = vi.fn()
  const onViewChange = vi.fn()
  const onProjectStageLabels = vi.fn()
  const append = vi.fn()
  stubBrowser()
  const scene = createMuseumJourneyScene(
    {
      append,
      clientWidth: 1024,
      clientHeight: 768,
    } as unknown as HTMLElement,
    DEFINITION,
    (id) => id,
    {
      selectedStageId: 'stage',
      foreground: true,
      reducedMotion: false,
      onSelect,
      onViewChange,
      onProjectStageLabels,
      onFailure: vi.fn(),
    },
  )

  try {
    await vi.waitFor(() => expect(model.setSelected).toHaveBeenCalled())
    const renderFrame = state.renderFrame
    if (renderFrame === undefined)
      throw new Error('Missing scene frame callback')
    renderFrame(0, 0)
    await scene.ready
    const canvas = append.mock.calls[0]![0] as {
      dataset: Record<string, string>
    }
    expect(canvas.dataset.journeyCameraZoom).toBe('0.000')
    expect(canvas.dataset.journeyCameraYaw).toBe('-0.140')

    const preventDefault = vi.fn()
    dispatchCanvasEvent('wheel', {
      deltaY: -240,
      deltaMode: 0,
      preventDefault,
    } as unknown as WheelEvent)
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(Number(canvas.dataset.journeyCameraZoom)).toBeGreaterThan(0.3)
    expect(onViewChange).toHaveBeenLastCalledWith(true)

    dispatchCanvasEvent('pointerdown', {
      pointerId: 1,
      clientX: 400,
      clientY: 380,
    } as PointerEvent)
    dispatchCanvasEvent('pointerdown', {
      pointerId: 2,
      clientX: 600,
      clientY: 380,
    } as PointerEvent)
    dispatchCanvasEvent('pointermove', {
      pointerId: 2,
      clientX: 800,
      clientY: 380,
    } as PointerEvent)
    dispatchCanvasEvent('pointerup', {
      pointerId: 1,
      clientX: 400,
      clientY: 380,
    } as PointerEvent)
    dispatchCanvasEvent('pointerup', {
      pointerId: 2,
      clientX: 800,
      clientY: 380,
    } as PointerEvent)
    expect(canvas.dataset.journeyCameraZoom).toBe('1.000')
    expect(onSelect).not.toHaveBeenCalled()

    const boundaryPreventDefault = vi.fn()
    dispatchCanvasEvent('wheel', {
      deltaY: -240,
      deltaMode: 0,
      preventDefault: boundaryPreventDefault,
    } as unknown as WheelEvent)
    expect(boundaryPreventDefault).toHaveBeenCalledOnce()
    expect(canvas.dataset.journeyCameraZoom).toBe('1.000')

    dispatchCanvasEvent('pointerdown', {
      pointerId: 3,
      clientX: 500,
      clientY: 380,
    } as PointerEvent)
    dispatchCanvasEvent('pointermove', {
      pointerId: 3,
      clientX: 580,
      clientY: 340,
    } as PointerEvent)
    dispatchCanvasEvent('pointerup', {
      pointerId: 3,
      clientX: 580,
      clientY: 340,
    } as PointerEvent)
    expect(Number(canvas.dataset.journeyCameraYaw)).toBeLessThan(-0.4)
    expect(onSelect).not.toHaveBeenCalled()

    scene.resetView()
    expect(canvas.dataset).toMatchObject({
      journeyCameraZoom: '0.000',
      journeyCameraYaw: '-0.140',
      journeyCameraPitch: '0.450',
    })
    expect(onViewChange).toHaveBeenLastCalledWith(false)
    expect(onProjectStageLabels).toHaveBeenLastCalledWith([])

    const overviewBoundaryPreventDefault = vi.fn()
    dispatchCanvasEvent('wheel', {
      deltaY: 240,
      deltaMode: 0,
      preventDefault: overviewBoundaryPreventDefault,
    } as unknown as WheelEvent)
    expect(overviewBoundaryPreventDefault).toHaveBeenCalledOnce()
    expect(canvas.dataset.journeyCameraZoom).toBe('0.000')
  } finally {
    scene.dispose()
    vi.unstubAllGlobals()
  }
})

it('retires active gestures and ignores selection mutations after context loss', async () => {
  state.environmentShouldFail = false
  const hitTarget = new Group()
  hitTarget.userData.journeyStageId = 'stage'
  const intersect = vi
    .spyOn(Raycaster.prototype, 'intersectObjects')
    .mockReturnValue([{ object: hitTarget }] as never)
  const model = {
    root: new Group(),
    selectableRoots: new Map([['stage', hitTarget]]),
    portraitSurfaces: new Map(),
    portraitMysteries: new Map(),
    starMarkers: new Map([
      ['stage', [new Group(), new Group(), new Group()] as const],
    ]),
    setSelected: vi.fn(),
    update: vi.fn(),
    dispose: vi.fn(),
  }
  state.loadModels.mockResolvedValueOnce(model)
  const onSelect = vi.fn()
  const onFailure = vi.fn()
  stubBrowser()
  const scene = createMuseumJourneyScene(
    {
      append: vi.fn(),
      clientWidth: 1024,
      clientHeight: 768,
    } as unknown as HTMLElement,
    DEFINITION,
    (id) => id,
    {
      selectedStageId: 'stage',
      foreground: true,
      reducedMotion: false,
      onSelect,
      onFailure,
    },
  )

  try {
    await vi.waitFor(() => expect(model.setSelected).toHaveBeenCalled())
    const renderFrame = state.renderFrame
    if (renderFrame === undefined)
      throw new Error('Missing scene frame callback')
    renderFrame(0, 0)
    await scene.ready
    const modelSignal = state.loadModels.mock.calls[0]?.[3] as AbortSignal
    expect(modelSignal.aborted).toBe(false)
    const selectionsBeforeLoss = model.setSelected.mock.calls.length
    const pendingPointerDown = state.canvasListeners.get('pointerdown') as (
      event: PointerEvent,
    ) => void
    const pendingPointerUp = state.canvasListeners.get('pointerup') as (
      event: PointerEvent,
    ) => void
    let diagnosticAtForcedLoss: ReturnType<typeof getGraphicsCanvasDiagnostic>
    let listenersAtForcedLoss: number | undefined
    state.forceContextLoss.mockImplementationOnce(() => {
      listenersAtForcedLoss = state.canvasListeners.size
      diagnosticAtForcedLoss = getGraphicsCanvasDiagnostic(state.canvas!)
    })

    dispatchCanvasEvent('pointerdown', {
      pointerId: 1,
      clientX: 512,
      clientY: 384,
    } as PointerEvent)
    const preventDefault = vi.fn()
    dispatchCanvasEvent('webglcontextlost', {
      preventDefault,
    } as unknown as Event)
    pendingPointerUp({
      pointerId: 1,
      clientX: 512,
      clientY: 384,
    } as PointerEvent)
    pendingPointerDown({
      pointerId: 2,
      clientX: 512,
      clientY: 384,
    } as PointerEvent)
    pendingPointerUp({
      pointerId: 2,
      clientX: 512,
      clientY: 384,
    } as PointerEvent)
    scene.setSelected('stage')

    expect(preventDefault).toHaveBeenCalledOnce()
    expect(modelSignal.aborted).toBe(true)
    expect(onFailure).toHaveBeenCalledOnce()
    expect(onSelect).not.toHaveBeenCalled()
    expect(intersect).not.toHaveBeenCalled()
    expect(model.setSelected).toHaveBeenCalledTimes(selectionsBeforeLoss)
    expect(model.dispose).toHaveBeenCalledOnce()
    expect(state.rendererDispose).toHaveBeenCalledOnce()
    expect(state.forceContextLoss).toHaveBeenCalledOnce()
    expect(state.loopDispose).toHaveBeenCalledOnce()
    expect(state.skyDispose).toHaveBeenCalledOnce()
    expect(state.waterDispose).toHaveBeenCalledOnce()
    expect(state.environmentDispose).toHaveBeenCalledOnce()
    expect(state.canvasRemove).toHaveBeenCalledOnce()
    expect(listenersAtForcedLoss).toBe(0)
    expect(diagnosticAtForcedLoss).toMatchObject({
      scene: 'museum-map',
      lifecycle: 'disposed',
    })
    scene.setForeground(true)
    renderFrame(1, 0.016)
    scene.dispose()
    scene.dispose()
    expect(model.dispose).toHaveBeenCalledOnce()
    expect(state.rendererDispose).toHaveBeenCalledOnce()
    expect(state.forceContextLoss).toHaveBeenCalledOnce()
  } finally {
    scene.dispose()
    intersect.mockRestore()
    vi.unstubAllGlobals()
  }
})

it('retires a failed map before a pending model resolves and never installs that model', async () => {
  state.environmentShouldFail = false
  const model = {
    root: new Group(),
    selectableRoots: new Map([['stage', new Group()]]),
    portraitSurfaces: new Map(),
    portraitMysteries: new Map(),
    starMarkers: new Map(),
    setSelected: vi.fn(),
    update: vi.fn(),
    dispose: vi.fn(),
  }
  let resolveModels!: (value: typeof model) => void
  state.loadModels.mockReturnValueOnce(
    new Promise<typeof model>((resolve) => {
      resolveModels = resolve
    }),
  )
  const onFailure = vi.fn()
  stubBrowser()
  const scene = createMuseumJourneyScene(
    {
      append: vi.fn(),
      clientWidth: 1024,
      clientHeight: 768,
    } as unknown as HTMLElement,
    DEFINITION,
    (id) => id,
    {
      selectedStageId: 'stage',
      foreground: true,
      reducedMotion: false,
      onSelect: vi.fn(),
      onFailure,
    },
  )
  const failure = scene.ready.catch((error: unknown) => error)
  try {
    const activeDiagnostic = getGraphicsCanvasDiagnostic(state.canvas!)
    const pendingFrame = state.renderFrame
    dispatchCanvasEvent('webglcontextlost', {
      preventDefault: vi.fn(),
    } as unknown as Event)

    expect(onFailure).toHaveBeenCalledOnce()
    expect(state.rendererDispose).toHaveBeenCalledOnce()
    expect(state.forceContextLoss).toHaveBeenCalledOnce()
    expect(state.skyDispose).toHaveBeenCalledOnce()
    expect(state.environmentDispose).toHaveBeenCalledOnce()
    expect(activeDiagnostic).toMatchObject({
      scene: 'museum-map',
      lifecycle: 'active',
    })
    resolveModels(model)
    expect(await failure).toMatchObject({
      message: expect.stringContaining('graphics context'),
    })

    pendingFrame?.(1, 0.016)
    scene.setSelected('stage')
    scene.dispose()
    expect(model.dispose).toHaveBeenCalledOnce()
    expect(model.root.parent).toBeNull()
    expect(model.setSelected).not.toHaveBeenCalled()
    expect(model.update).not.toHaveBeenCalled()
    expect(state.rendererDispose).toHaveBeenCalledOnce()
    expect(state.forceContextLoss).toHaveBeenCalledOnce()
    expect(state.loopDispose).toHaveBeenCalledOnce()
    expect(state.waterDispose).toHaveBeenCalledOnce()
  } finally {
    scene.dispose()
    resolveModels(model)
    await failure
    vi.unstubAllGlobals()
  }
})

it('rejects first-frame GPU errors through the map failure lifecycle', async () => {
  state.environmentShouldFail = false
  const model = {
    root: new Group(),
    selectableRoots: new Map([['stage', new Group()]]),
    portraitSurfaces: new Map(),
    portraitMysteries: new Map(),
    starMarkers: new Map([
      ['stage', [new Group(), new Group(), new Group()] as const],
    ]),
    setSelected: vi.fn(),
    update: vi.fn(),
    dispose: vi.fn(),
  }
  state.loadModels.mockResolvedValueOnce(model)
  stubBrowser()
  const onFailure = vi.fn()
  const scene = createMuseumJourneyScene(
    {
      append: vi.fn(),
      clientWidth: 1024,
      clientHeight: 768,
    } as unknown as HTMLElement,
    DEFINITION,
    (id) => id,
    {
      selectedStageId: 'stage',
      foreground: true,
      reducedMotion: false,
      onSelect: vi.fn(),
      onFailure,
    },
  )
  const rejected = expect(scene.ready).rejects.toThrow('0x502')
  try {
    await vi.waitFor(() => expect(model.setSelected).toHaveBeenCalled())
    state.getError.mockReturnValueOnce(0x0502)
    state.renderFrame?.(0, 0)
    await rejected
    expect(onFailure).toHaveBeenCalledOnce()
    expect(state.loopSetForeground).toHaveBeenLastCalledWith(false)
    const signal = state.loadModels.mock.calls[0]?.[3] as AbortSignal
    expect(signal.aborted).toBe(true)
    state.renderFrame?.(1, 0.016)
    expect(state.getError).toHaveBeenCalledOnce()
  } finally {
    scene.dispose()
    vi.unstubAllGlobals()
  }
})

it.each([true, false])(
  'preserves startup detail and only adapts a loaded mobile map (mobile=%s)',
  async (mobile) => {
    stubBrowser()
    vi.stubGlobal('window', {
      devicePixelRatio: 3,
      matchMedia: () => ({ matches: mobile }),
    })
    state.environmentShouldFail = false
    const model = {
      root: new Group(),
      selectableRoots: new Map([['stage', new Group()]]),
      portraitSurfaces: new Map(),
      portraitMysteries: new Map(),
      starMarkers: new Map(),
      setSelected: vi.fn(),
      update: vi.fn(),
      dispose: vi.fn(),
    }
    state.loadModels.mockResolvedValueOnce(model)
    const scene = createMuseumJourneyScene(
      {
        append: vi.fn(),
        clientWidth: 390,
        clientHeight: 844,
      } as unknown as HTMLElement,
      DEFINITION,
      (id) => id,
      {
        selectedStageId: 'stage',
        foreground: true,
        reducedMotion: false,
        onSelect: vi.fn(),
        onFailure: vi.fn(),
      },
    )
    try {
      expect(state.setPixelRatio).toHaveBeenLastCalledWith(mobile ? 1.25 : 1.8)
      expect(state.loadModels).toHaveBeenCalledWith(
        DEFINITION,
        'map',
        'merc',
        expect.any(AbortSignal),
        expect.objectContaining({
          assetProfile: mobile ? 'mobile' : 'full',
          maximumConcurrentBundleLoads: mobile ? 1 : 2,
        }),
      )
      for (let i = 0; i < 30; i++) state.renderFrame?.(i * 0.05, 0.05)
      expect(scene.getMetrics().adaptiveQualityActive).toBe(false)
      await vi.waitFor(() => expect(model.setSelected).toHaveBeenCalled())
      state.renderFrame?.(2, 0.016)
      await scene.ready
      expect(
        getGraphicsCanvasDiagnostic(state.canvas!)?.snapshot,
      ).toMatchObject({
        selectedStageId: 'stage',
        assetProfile: mobile ? 'mobile' : 'full',
        estimatedTextureBytes: 0,
      })
      scene.setForeground(false)
      for (let i = 0; i < 30; i++) state.renderFrame?.(i * 0.05, 0.05)
      expect(scene.getMetrics().adaptiveQualityActive).toBe(false)
      scene.setForeground(true)
      for (let i = 0; i < 23; i++) state.renderFrame?.(i * 0.05, 0.05)
      expect(scene.getMetrics().adaptiveQualityActive).toBe(false)
      state.renderFrame?.(1.2, 0.05)
      expect(scene.getMetrics()).toMatchObject({
        adaptiveQualityActive: mobile,
        actualPixelRatio: mobile ? 1 : 1.8,
        actualShadowFrameInterval: mobile ? 4 : 1,
      })
      expect(state.setPixelRatio).toHaveBeenCalledTimes(mobile ? 2 : 1)
      scene.dispose()
      state.renderFrame?.(4, 0.1)
      expect(state.setPixelRatio).toHaveBeenCalledTimes(mobile ? 2 : 1)
    } finally {
      scene.dispose()
      vi.unstubAllGlobals()
    }
  },
)
