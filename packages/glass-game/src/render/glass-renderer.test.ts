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
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    shadowNeedsUpdateAtRender: [] as boolean[],
    getError: vi.fn((): number => 0),
    listeners: new Map<string, EventListener>(),
    loseContext: false,
    assetFailure: null as Error | null,
    assetCompletions: [] as string[],
    assetInstalled: null as ((taskId: string) => void) | null,
    museumFailure: null as Error | null,
    environmentLoadFailure: null as Error | null,
    rendererDispose: vi.fn(),
    forceContextLoss: vi.fn(),
    canvasRemove: vi.fn(),
    mercDispose: vi.fn(),
    runtimeRoomId: undefined as string | undefined,
    cullCloudwayPlatforms: vi.fn(),
    visibleRoomIds,
    updateRoomVisibility: vi.fn(() => ({
      visibleRoomIds,
      fallbackAllVisible: false,
    })),
    updatePlanarReflection: vi.fn(() => false),
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
    shadowMap = {
      autoUpdate: true,
      enabled: false,
      needsUpdate: false,
      type: 0,
    }
    info = { render: {}, memory: {} }
    setSize = state.setSize
    setPixelRatio = state.setPixelRatio
    getContext = () => ({
      drawingBufferWidth: 800,
      drawingBufferHeight: 600,
      getError: state.getError,
    })
    render = (...args: unknown[]) => {
      state.shadowNeedsUpdateAtRender.push(this.shadowMap.needsUpdate)
      return state.render(...args)
    }
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
  loadMuseumAssets: async (...args: unknown[]) => {
    state.assetInstalled = args[8] as (taskId: string) => void
    state.assetCompletions.forEach((taskId) => state.assetInstalled?.(taskId))
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
      cullCloudwayPlatforms: state.cullCloudwayPlatforms,
      roomIdForRuntimeId: () => state.runtimeRoomId,
      updateRoomVisibility: state.updateRoomVisibility,
      updatePlanarReflection: state.updatePlanarReflection,
      planarReflectionMetrics: {
        captures: 3,
        targetWidth: 160,
        targetHeight: 256,
      },
      dispose: vi.fn(),
      materialLibrary: { materials: new Set(), dispose: vi.fn() },
    }
  },
}))
vi.mock('./resonance-portal', () => ({
  createResonancePortal: () => ({ root: new Group(), update: vi.fn() }),
}))
import { createMuseumAssetLoadPlan } from './asset-load-plan'
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
  state.assetCompletions = []
  state.assetInstalled = null
  state.museumFailure = null
  state.environmentLoadFailure = null
  state.render.mockClear()
  state.setSize.mockClear()
  state.setPixelRatio.mockClear()
  state.shadowNeedsUpdateAtRender.length = 0
  state.getError.mockReset().mockReturnValue(0)
  state.rendererDispose.mockClear()
  state.forceContextLoss.mockClear()
  state.canvasRemove.mockClear()
  state.mercDispose.mockClear()
  state.updateRoomVisibility.mockClear()
  state.updateRoomVisibility.mockReturnValue({
    visibleRoomIds: state.visibleRoomIds,
    fallbackAllVisible: false,
    shadowVisibilityChanged: false,
  })
  state.updatePlanarReflection.mockClear()
  state.cullCloudwayPlatforms.mockClear()
  state.cullCloudwayPlatforms.mockReturnValue(false)
  state.runtimeRoomId = undefined
  state.visibleRoomIds.clear()
})

it.each([1, 0.5])(
  'waits for a usable viewport and resumes rendering after hidden layout at pixel ratio %s',
  async (pixelRatio) => {
    const container = browserFixture()
    vi.stubGlobal('window', { devicePixelRatio: pixelRatio })
    Object.assign(container, { clientWidth: 0, clientHeight: 0 })
    const renderer = createGlassRenderer(container, GLASSWORKS, (id) => id)
    await renderer.ready
    const snapshot = createGlassGame(GLASSWORKS).snapshot()
    expect(renderer.render(snapshot, 0.016)).toBe(false)
    expect(state.render).not.toHaveBeenCalled()
    expect(state.setSize).not.toHaveBeenCalled()

    Object.assign(container, { clientWidth: 1, clientHeight: 600 })
    renderer.resize()
    expect(renderer.render(snapshot, 0.016)).toBe(false)
    expect(state.setSize).not.toHaveBeenCalled()

    Object.assign(container, { clientWidth: 800, clientHeight: 600 })
    renderer.resize()
    expect(renderer.render(snapshot, 0.016)).toBe(true)
    expect(state.render).toHaveBeenCalledOnce()
    expect(state.setSize).toHaveBeenLastCalledWith(800, 600, false)

    Object.assign(container, { clientWidth: 800, clientHeight: 1 })
    renderer.resize()
    expect(renderer.render(snapshot, 0.016)).toBe(false)
    expect(state.render).toHaveBeenCalledOnce()
    renderer.dispose()
  },
)

it('rejects a failed GPU upload before claiming a good first frame', async () => {
  const renderer = createGlassRenderer(browserFixture(), GLASSWORKS, (id) => id)
  await renderer.ready
  state.getError.mockReturnValueOnce(0x0502)
  expect(() =>
    renderer.render(createGlassGame(GLASSWORKS).snapshot(), 0.016),
  ).toThrow('0x502')
  renderer.dispose()
})

it('checks the first frame without polling the GPU on every game frame', async () => {
  const renderer = createGlassRenderer(browserFixture(), GLASSWORKS, (id) => id)
  await renderer.ready
  const snapshot = createGlassGame(GLASSWORKS).snapshot()
  renderer.render(snapshot, 0.016)
  renderer.render(snapshot, 0.016)
  expect(state.getError).toHaveBeenCalledOnce()
  renderer.dispose()
})

it('applies balanced pixels and reuses at most one shadow frame', async () => {
  const container = browserFixture()
  vi.stubGlobal('window', {
    devicePixelRatio: 3,
    innerWidth: 390,
    innerHeight: 844,
    matchMedia: () => ({ matches: true }),
  })
  const renderer = createGlassRenderer(container, GLASSWORKS, (id) => id, {
    renderQuality: 'balanced',
  })
  await renderer.ready
  const snapshot = createGlassGame(GLASSWORKS).snapshot()

  expect(renderer.getRenderQuality()).toEqual({
    preference: 'balanced',
    profile: 'balanced',
    pixelRatio: 1.25,
    shadowFrameInterval: 2,
  })
  expect(state.setPixelRatio).toHaveBeenLastCalledWith(1.25)
  renderer.render(snapshot, 0.016)
  renderer.render(snapshot, 0.016)
  renderer.render(snapshot, 0.016)
  expect(state.shadowNeedsUpdateAtRender).toEqual([true, false, true])
  expect(renderer.getMetrics()).toMatchObject({
    shadowUpdates: 2,
    shadowReuses: 1,
  })

  renderer.dispose()
})

it('invalidates a balanced shadow immediately when rendered visibility changes', async () => {
  const renderer = createGlassRenderer(
    browserFixture(),
    GLASSWORKS,
    (id) => id,
    { renderQuality: 'balanced' },
  )
  await renderer.ready
  const snapshot = createGlassGame(GLASSWORKS).snapshot()

  renderer.render(snapshot, 0.016)
  renderer.render(snapshot, 0.016)
  state.cullCloudwayPlatforms.mockReturnValueOnce(true)
  renderer.render(snapshot, 0.016)
  expect(state.shadowNeedsUpdateAtRender).toEqual([true, false, true])

  state.updateRoomVisibility.mockReturnValueOnce({
    visibleRoomIds: state.visibleRoomIds,
    fallbackAllVisible: false,
    shadowVisibilityChanged: true,
  })
  renderer.render(snapshot, 0.016)
  expect(state.shadowNeedsUpdateAtRender.at(-1)).toBe(true)
  renderer.dispose()
})

it('invalidates a balanced shadow when Merc starts moving or glass starts shattering', async () => {
  const renderer = createGlassRenderer(
    browserFixture(),
    GLASSWORKS,
    (id) => id,
    { renderQuality: 'balanced' },
  )
  await renderer.ready
  const snapshot = createGlassGame(GLASSWORKS).snapshot()

  renderer.render(snapshot, 0.016)
  renderer.render(snapshot, 0.016)
  const movingSnapshot = {
    ...snapshot,
    player: {
      ...snapshot.player,
      velocity: { ...snapshot.player.velocity, x: 1 },
    },
  }
  renderer.render(movingSnapshot, 0.016)
  renderer.render(movingSnapshot, 0.016)
  const shatteringSnapshot = {
    ...movingSnapshot,
    breakables: movingSnapshot.breakables.map((breakable, index) =>
      index === 0 ? { ...breakable, phase: 'shattering' as const } : breakable,
    ),
  }
  renderer.render(shatteringSnapshot, 0.016)

  expect(state.shadowNeedsUpdateAtRender).toEqual([
    true,
    false,
    true,
    false,
    true,
  ])
  renderer.dispose()
})

it('switches an explicit quality choice without changing the accepted high profile', async () => {
  const container = browserFixture()
  vi.stubGlobal('window', { devicePixelRatio: 3 })
  const renderer = createGlassRenderer(container, GLASSWORKS, (id) => id, {
    renderQuality: 'balanced',
  })
  await renderer.ready

  renderer.setRenderQuality('high')
  expect(renderer.getRenderQuality()).toEqual({
    preference: 'high',
    profile: 'high',
    pixelRatio: 1.5,
    shadowFrameInterval: 1,
  })
  expect(state.setPixelRatio).toHaveBeenLastCalledWith(1.5)

  const snapshot = createGlassGame(GLASSWORKS).snapshot()
  renderer.render(snapshot, 0.016)
  renderer.render(snapshot, 0.016)
  expect(state.shadowNeedsUpdateAtRender).toEqual([true, true])
  renderer.dispose()
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
    expect(state.cullCloudwayPlatforms).toHaveBeenCalledTimes(
      contextLoss ? 0 : 1,
    )
    expect(state.updateRoomVisibility).toHaveBeenCalledTimes(
      contextLoss ? 0 : 1,
    )
    expect(renderer.getMetrics()).toMatchObject({
      reflectionCaptures: 3,
      reflectionTargetPixels: 40_960,
    })
    if (contextLoss) expect(onAssetError).not.toHaveBeenCalled()
    else
      expect(onAssetError).toHaveBeenCalledWith(
        'museum-reflection-probe',
        expect.any(Error),
      )
    renderer.dispose()
  },
)

it('publishes a fixed plan synchronously and reaches full only after installs and accepted fallbacks', async () => {
  const assetPlan = createMuseumAssetLoadPlan(GLASSWORKS)
  state.assetCompletions = [...assetPlan.taskIds]
  const updates: { completedUnits: number; totalUnits: number }[] = []

  const renderer = createGlassRenderer(
    browserFixture(),
    GLASSWORKS,
    (id) => id,
    { onLoadingProgress: (progress) => updates.push(progress) },
  )
  const expectedTotal = assetPlan.taskIds.length + 3
  expect(updates[0]).toEqual({ completedUnits: 0, totalUnits: expectedTotal })

  await expect(renderer.ready).resolves.toBeUndefined()
  expect(updates.at(-1)).toEqual({
    completedUnits: expectedTotal,
    totalUnits: expectedTotal,
  })
  expect(updates).toHaveLength(expectedTotal + 1)
  updates.forEach((progress, index) => {
    expect(progress.completedUnits).toBe(index)
    expect(progress.totalUnits).toBe(expectedTotal)
  })
  renderer.dispose()
})

it('freezes progress after a required failure and ignores later installs', async () => {
  const assetPlan = createMuseumAssetLoadPlan(GLASSWORKS)
  state.assetCompletions = assetPlan.taskIds.slice(0, 1)
  state.assetFailure = new Error('required window failed')
  const updates: { completedUnits: number; totalUnits: number }[] = []
  const renderer = createGlassRenderer(
    browserFixture(),
    GLASSWORKS,
    (id) => id,
    { onLoadingProgress: (progress) => updates.push(progress) },
  )

  await expect(renderer.ready).rejects.toThrow('required window failed')
  const frozen = updates.at(-1)
  const updateCount = updates.length
  state.assetInstalled?.(assetPlan.taskIds[1]!)
  await Promise.resolve()
  expect(updates).toHaveLength(updateCount)
  expect(updates.at(-1)).toEqual(frozen)
  renderer.dispose()
})

it('freezes progress on context loss before late asset callbacks resolve', async () => {
  const assetPlan = createMuseumAssetLoadPlan(GLASSWORKS)
  const lateTask = assetPlan.taskIds.at(-1)!
  state.assetCompletions = assetPlan.taskIds.slice(0, -1)
  state.loseContext = true
  const updates: { completedUnits: number; totalUnits: number }[] = []
  const renderer = createGlassRenderer(
    browserFixture(),
    GLASSWORKS,
    (id) => id,
    { onLoadingProgress: (progress) => updates.push(progress) },
  )

  await expect(renderer.ready).resolves.toBeUndefined()
  const updateCount = updates.length
  state.assetInstalled?.(lateTask)
  expect(updates).toHaveLength(updateCount)
  expect(updates.at(-1)?.completedUnits).toBeLessThan(
    updates.at(-1)?.totalUnits ?? 0,
  )
  renderer.dispose()
})

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
