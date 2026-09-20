// Renderer readiness — an optional reflection failure never hides a playable museum.
import type * as ThreeTypes from 'three'
import type { PerspectiveCamera, Scene } from 'three'
import { DirectionalLight, Group } from 'three'
import { afterEach, expect, it, vi } from 'vitest'
import { GLASSWORKS } from '../content/glassworks'
import { createGlassGame } from '../core/game'

const state = vi.hoisted(() => {
  const visibleRoomIds = new Set<string>()
  return {
    render: vi.fn(),
    listeners: new Map<string, EventListener>(),
    loseContext: false,
    assetFailure: null as Error | null,
    museumFailure: null as Error | null,
    environmentLoadFailure: null as Error | null,
    rendererDispose: vi.fn(),
    forceContextLoss: vi.fn(),
    canvasRemove: vi.fn(),
    mercDispose: vi.fn(),
    runtimeRoomId: undefined as string | undefined,
    visibleRoomIds,
    updateRoomVisibility: vi.fn(() => ({
      visibleRoomIds,
      fallbackAllVisible: false,
    })),
  }
})
vi.mock('three', async (original) => ({
  ...(await original<typeof ThreeTypes>()),
  WebGLRenderer: class {
    domElement = {
      style: {},
      setAttribute: vi.fn(),
      remove: state.canvasRemove,
      addEventListener: (name: string, listener: EventListener) =>
        state.listeners.set(name, listener),
      removeEventListener: (name: string) => state.listeners.delete(name),
    }
    shadowMap = {}
    info = { render: {}, memory: {} }
    setSize = vi.fn()
    setPixelRatio = vi.fn()
    render = state.render
    dispose = state.rendererDispose
    forceContextLoss = state.forceContextLoss
  },
}))
vi.mock('./environment', () => ({
  createMuseumEnvironment: () => ({
    load: () => {
      if (state.environmentLoadFailure) throw state.environmentLoadFailure
      return Promise.resolve()
    },
    capture: () => {
      if (state.loseContext)
        state.listeners.get('webglcontextlost')?.(new Event('webglcontextlost'))
      throw new Error('optional cube allocation failed')
    },
    dispose: vi.fn(),
  }),
}))
vi.mock('./asset-kit', () => ({
  loadMuseumAssets: async () => {
    if (state.assetFailure) throw state.assetFailure
  },
}))
vi.mock('./materials', () => ({ createMuseumMaterials: () => ({}) }))
vi.mock('./merc', () => ({
  loadAdventureMerc: async () => ({
    root: new Group(),
    update: vi.fn(),
    dispose: state.mercDispose,
  }),
}))
vi.mock('./atmosphere', () => ({
  createAtmosphere: () => ({ root: new Group(), setSky: vi.fn() }),
}))
vi.mock('./contact-shadow', () => ({
  createContactShadow: () => ({ mesh: new Group(), update: vi.fn() }),
}))
vi.mock('./museum', () => ({
  createMuseum: () => {
    if (state.museumFailure) throw state.museumFailure
    return {
      root: new Group(),
      update: vi.fn(),
      cameraOccluders: () => [],
      roomIdForRuntimeId: () => state.runtimeRoomId,
      updateRoomVisibility: state.updateRoomVisibility,
      dispose: vi.fn(),
      materialLibrary: { materials: new Set(), dispose: vi.fn() },
    }
  },
}))
vi.mock('./resonance-portal', () => ({
  createResonancePortal: () => ({ root: new Group(), update: vi.fn() }),
}))
import { createGlassRenderer } from './glass-renderer'

function browserFixture() {
  vi.stubGlobal('window', { devicePixelRatio: 1 })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  return {
    clientWidth: 800,
    clientHeight: 600,
    append: vi.fn(),
  } as unknown as HTMLElement
}

afterEach(() => {
  vi.unstubAllGlobals()
  state.listeners.clear()
  state.loseContext = false
  state.assetFailure = null
  state.museumFailure = null
  state.environmentLoadFailure = null
  state.render.mockClear()
  state.rendererDispose.mockClear()
  state.forceContextLoss.mockClear()
  state.canvasRemove.mockClear()
  state.mercDispose.mockClear()
  state.updateRoomVisibility.mockClear()
  state.runtimeRoomId = undefined
  state.visibleRoomIds.clear()
})

it.each([false, true])(
  'resolves after optional capture failure while context-loss latch=%s remains authoritative',
  async (contextLoss) => {
    state.loseContext = contextLoss
    const onAssetError = vi.fn(),
      onContextLost = vi.fn()
    const container = browserFixture()
    const renderer = createGlassRenderer(container, GLASSWORKS, (id) => id, {
      onAssetError,
      onContextLost,
    })
    await expect(renderer.ready).resolves.toBeUndefined()
    renderer.render(createGlassGame(GLASSWORKS).snapshot(), 0.016)
    expect(onContextLost).toHaveBeenCalledTimes(contextLoss ? 1 : 0)
    expect(state.render).toHaveBeenCalledTimes(contextLoss ? 0 : 1)
    expect(state.updateRoomVisibility).toHaveBeenCalledTimes(
      contextLoss ? 0 : 1,
    )
    if (contextLoss) expect(onAssetError).not.toHaveBeenCalled()
    else
      expect(onAssetError).toHaveBeenCalledWith(
        'museum-reflection-probe',
        expect.any(Error),
      )
    renderer.dispose()
  },
)

it('rejects readiness when required museum art fails', async () => {
  state.assetFailure = new Error('required window failed')
  const renderer = createGlassRenderer(browserFixture(), GLASSWORKS, (id) => id)

  await expect(renderer.ready).rejects.toThrow('required window failed')
  renderer.dispose()
})

it('releases a partial renderer and its canvas when scene construction throws', () => {
  state.museumFailure = new Error('museum construction failed')

  expect(() =>
    createGlassRenderer(browserFixture(), GLASSWORKS, (id) => id),
  ).toThrow('museum construction failed')
  expect(state.rendererDispose).toHaveBeenCalledTimes(1)
  expect(state.forceContextLoss).toHaveBeenCalledTimes(1)
  expect(state.canvasRemove).toHaveBeenCalledTimes(1)
})

it('marks a partial scene unavailable before a late Merc resolves', async () => {
  state.environmentLoadFailure = new Error('environment URL failed')

  expect(() =>
    createGlassRenderer(browserFixture(), GLASSWORKS, (id) => id),
  ).toThrow('environment URL failed')
  await Promise.resolve()

  expect(state.mercDispose).toHaveBeenCalledTimes(1)
  expect(state.rendererDispose).toHaveBeenCalledTimes(1)
  expect(state.canvasRemove).toHaveBeenCalledTimes(1)
})

it('aims both authored lights and the camera range from translated bounds', async () => {
  const level = {
    ...GLASSWORKS,
    id: 'translated-renderer',
    spawn: {
      position: { x: 103, y: 0, z: -45 },
      facingYaw: Math.PI / 2,
    },
    presentation: {
      worldBounds: {
        minX: 100,
        maxX: 112,
        minY: -2,
        maxY: 4,
        minZ: -48,
        maxZ: -38,
      },
      lightBounds: {
        minX: 102,
        maxX: 110,
        minY: -1,
        maxY: 5,
        minZ: -47,
        maxZ: -39,
      },
      rooms: [],
      audioRegions: [],
      visuals: [],
      assetRecipeIds: [],
    },
  }
  const renderer = createGlassRenderer(browserFixture(), level, (id) => id)
  await renderer.ready
  renderer.render(createGlassGame(level).snapshot(), 0.016)

  const [scene, camera] = state.render.mock.calls[0] as [
    Scene,
    PerspectiveCamera,
  ]
  const lights = scene.children.filter(
    (child): child is DirectionalLight => child instanceof DirectionalLight,
  )
  expect(lights).toHaveLength(2)
  for (const light of lights)
    expect(light.target.position.toArray()).toEqual([106, 2, -43])
  expect(lights.find((light) => light.castShadow)?.shadow.normalBias).toBe(
    0.018,
  )
  expect(camera.far).toBeGreaterThan(50)
  expect(camera.far).toBeLessThan(70)
  renderer.dispose()
})

it('scales the shadow receiver offset to a long authored light frame', async () => {
  const level = {
    ...GLASSWORKS,
    id: 'long-shadow-frame',
    presentation: {
      worldBounds: {
        minX: -5,
        maxX: 30,
        minY: -2,
        maxY: 10,
        minZ: -5,
        maxZ: 72,
      },
      lightBounds: {
        minX: -4.7,
        maxX: 27,
        minY: 0,
        maxY: 8,
        minZ: -4.7,
        maxZ: 70,
      },
      rooms: [],
      audioRegions: [],
      visuals: [],
      assetRecipeIds: [],
    },
  }
  const renderer = createGlassRenderer(browserFixture(), level, (id) => id)
  await renderer.ready
  renderer.render(createGlassGame(level).snapshot(), 0.016)

  const scene = state.render.mock.calls[0]![0] as Scene
  const key = scene.children.find(
    (child): child is DirectionalLight =>
      child instanceof DirectionalLight && child.castShadow,
  )
  if (key === undefined) throw new Error('Missing directional shadow light.')
  const extent = key.shadow.camera.right
  expect(extent).toBeGreaterThan(40)
  expect(key.shadow.normalBias).toBeCloseTo((extent * 2 * 0.75) / 1024)
  expect(key.shadow.normalBias).toBeGreaterThan(0.06)
  renderer.dispose()
})

it('applies the selected room visibility to independently rendered vessels', async () => {
  state.runtimeRoomId = 'hidden-room'
  const level = GLASSWORKS
  const renderer = createGlassRenderer(browserFixture(), level, (id) => id)
  await renderer.ready
  const snapshot = createGlassGame(level).snapshot()

  renderer.render(snapshot, 0.016)
  const scene = state.render.mock.calls[0]![0] as Scene
  const vessels = scene.children.filter((child) =>
    child.name.startsWith('vessel-'),
  )
  expect(vessels.length).toBeGreaterThan(0)
  expect(vessels.every((vessel) => !vessel.visible)).toBe(true)

  state.visibleRoomIds.add('hidden-room')
  renderer.render(snapshot, 0.016)
  expect(vessels.every((vessel) => vessel.visible)).toBe(true)
  renderer.dispose()
})
