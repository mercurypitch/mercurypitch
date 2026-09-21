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
  forceContextLoss: vi.fn(),
  canvasRemove: vi.fn(),
  skyDispose: vi.fn(),
  waterDispose: vi.fn(),
  environmentDispose: vi.fn(),
  environmentLoad: vi.fn(() => Promise.resolve()),
  loadModels: vi.fn(),
  loopDispose: vi.fn(),
  loopSetForeground: vi.fn(),
  canvasListeners: new Map<string, EventListenerOrEventListenerObject>(),
  renderFrame: undefined as
    | ((visibleSeconds: number, dt: number) => void)
    | undefined,
}))

vi.mock('three', async (original) => ({
  ...(await original<typeof ThreeTypes>()),
  WebGLRenderer: class {
    domElement = {
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
    info = {
      autoReset: true,
      render: { calls: 0, triangles: 0 },
      memory: { geometries: 0, textures: 0 },
      reset: vi.fn(),
    }
    shadowMap = { enabled: false }
    setPixelRatio = vi.fn()
    setSize = vi.fn()
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
  state.canvasListeners.clear()
  state.environmentLoad.mockResolvedValue(undefined)
})

function stubBrowser(): void {
  vi.stubGlobal('window', {
    devicePixelRatio: 1,
    matchMedia: () => ({ matches: false }),
  })
  vi.stubGlobal(
    'ResizeObserver',
    class {
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
})

it('does not report ready before a model-backed label projection is published', async () => {
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
})

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
    const selectionsBeforeLoss = model.setSelected.mock.calls.length

    dispatchCanvasEvent('pointerdown', {
      pointerId: 1,
      clientX: 512,
      clientY: 384,
    } as PointerEvent)
    const preventDefault = vi.fn()
    dispatchCanvasEvent('webglcontextlost', {
      preventDefault,
    } as unknown as Event)
    dispatchCanvasEvent('pointerup', {
      pointerId: 1,
      clientX: 512,
      clientY: 384,
    } as PointerEvent)
    dispatchCanvasEvent('pointerdown', {
      pointerId: 2,
      clientX: 512,
      clientY: 384,
    } as PointerEvent)
    dispatchCanvasEvent('pointerup', {
      pointerId: 2,
      clientX: 512,
      clientY: 384,
    } as PointerEvent)
    scene.setSelected('stage')

    expect(preventDefault).toHaveBeenCalledOnce()
    expect(onFailure).toHaveBeenCalledOnce()
    expect(onSelect).not.toHaveBeenCalled()
    expect(intersect).not.toHaveBeenCalled()
    expect(model.setSelected).toHaveBeenCalledTimes(selectionsBeforeLoss)
  } finally {
    scene.dispose()
    intersect.mockRestore()
    vi.unstubAllGlobals()
  }
})
