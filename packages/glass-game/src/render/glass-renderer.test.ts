// Renderer readiness — an optional reflection failure never hides a playable museum.
import type * as ThreeTypes from 'three'
import type { PerspectiveCamera, Scene } from 'three'
import { BoxGeometry, DirectionalLight, Group, Mesh, MeshStandardMaterial, Texture, } from 'three'
import { afterEach, expect, it, vi } from 'vitest'
import { CLOUDWAY_THAWING_SONG } from '../content/cloudway-thawing-song'
import { GLASSWORKS } from '../content/glassworks'
import { createGlassGame } from '../core/game'
import type * as VesselModule from './vessels'

const state = vi.hoisted(() => {
  const visibleRoomIds = new Set<string>()
  return {
    render: vi.fn(),
    compile: vi.fn(
      (_scene: Scene, _camera: PerspectiveCamera) => new Set([{}]),
    ),
    programIsReady: vi.fn(() => true),
    programProperties: vi.fn(() => ({
      currentProgram: { isReady: () => state.programIsReady() },
    })),
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    reflectionProbeRender: Symbol('reflection-probe-render'),
    shadowNeedsUpdateAtProbeRender: [] as boolean[],
    shadowNeedsUpdateAtRender: [] as boolean[],
    mercVisibleAtRender: [] as boolean[],
    getError: vi.fn((): number => 0),
    listeners: new Map<string, EventListener>(),
    loseContext: false,
    assetFailure: null as Error | null,
    assetCompletions: [] as string[],
    assetInstalled: null as ((taskId: string) => void) | null,
    assetLoadOptions: null as {
      assetProfile?: string
      signal?: AbortSignal
      maximumConcurrentBundleLoads?: number
      onDecodedImage?: (image: TexImageSource) => void
    } | null,
    museumFailure: null as Error | null,
    museumOwnershipFixture: false,
    museumDispose: vi.fn(),
    museumLibraryDispose: vi.fn(),
    museumGeometryDispose: vi.fn(),
    museumWarningMaterialDispose: vi.fn(),
    museumLibraryMaterialDispose: vi.fn(),
    museumSharedTextureDispose: vi.fn(),
    warningSharesLibraryTexture: false,
    environmentLoadFailure: null as Error | null,
    rendererDispose: vi.fn(),
    forceContextLoss: vi.fn(),
    canvasRemove: vi.fn(),
    mercDispose: vi.fn(),
    mercUpdate: vi.fn(),
    vesselUpdates: [] as {
      id: string
      presentationVisible: boolean | undefined
    }[],
    runtimeRoomId: undefined as string | undefined,
    cullCloudwayPlatforms: vi.fn(),
    visibleRoomIds,
    updateRoomVisibility: vi.fn(() => ({
      visibleRoomIds,
      fallbackAllVisible: false,
      shadowVisibilityChanged: false,
    })),
    updatePlanarReflection: vi.fn((..._args: unknown[]) => false),
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
    compile = state.compile
    properties = { get: state.programProperties }
    getContext = () => ({
      drawingBufferWidth: 800,
      drawingBufferHeight: 600,
      getError: state.getError,
    })
    render = (...args: unknown[]) => {
      if (args[0] === state.reflectionProbeRender) {
        state.shadowNeedsUpdateAtProbeRender.push(this.shadowMap.needsUpdate)
        // Three consumes a requested shadow update inside the probe render.
        this.shadowMap.needsUpdate = false
        return
      }
      state.shadowNeedsUpdateAtRender.push(this.shadowMap.needsUpdate)
      state.mercVisibleAtRender.push(
        (args[0] as Scene).getObjectByName('test-adventure-merc')?.visible ??
          false,
      )
      return state.render(...args)
    }
    dispose = state.rendererDispose
    forceContextLoss = state.forceContextLoss
  },
}))
vi.mock('./environment', () => ({
  createMuseumEnvironment: (renderer: { render: (scene: symbol) => void }) => ({
    load: () => {
      if (state.environmentLoadFailure) throw state.environmentLoadFailure
      return Promise.resolve()
    },
    capture: () => {
      renderer.render(state.reflectionProbeRender)
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
    state.assetLoadOptions = args[9] as typeof state.assetLoadOptions
    state.assetCompletions.forEach((taskId) => state.assetInstalled?.(taskId))
    if (state.assetFailure) throw state.assetFailure
  },
}))
vi.mock('./materials', () => ({ createMuseumMaterials: () => ({}) }))
vi.mock('./merc', () => ({
  loadAdventureMerc: async () => {
    const root = new Group()
    root.name = 'test-adventure-merc'
    return { root, update: state.mercUpdate, dispose: state.mercDispose }
  },
}))
vi.mock('./atmosphere', () => ({
  createAtmosphere: () => ({ root: new Group(), setSky: vi.fn() }),
}))
vi.mock('./contact-shadow', () => ({
  createContactShadow: () => ({ mesh: new Group(), update: vi.fn() }),
}))
vi.mock('./vessels', async (original) => {
  const actual = await original<typeof VesselModule>()
  return {
    ...actual,
    createVessel: (...args: Parameters<typeof actual.createVessel>) => {
      const vessel = actual.createVessel(...args)
      const update = vessel.update.bind(vessel)
      vessel.update = ((snapshot, elapsedSeconds, presentationVisible) => {
        state.vesselUpdates.push({
          id: snapshot.id,
          presentationVisible,
        })
        update(snapshot, elapsedSeconds, presentationVisible)
      }) as typeof vessel.update
      return vessel
    },
  }
})
vi.mock('./museum', () => ({
  createMuseum: () => {
    if (state.museumFailure) throw state.museumFailure
    const root = new Group()
    const libraryMaterials = new Set<MeshStandardMaterial>()
    let disposeMuseum = vi.fn()
    let disposeLibrary = vi.fn()
    if (state.museumOwnershipFixture) {
      const sharedTexture = new Texture()
      sharedTexture.dispose = state.museumSharedTextureDispose
      const libraryMaterial = new MeshStandardMaterial({ map: sharedTexture })
      libraryMaterial.dispose = state.museumLibraryMaterialDispose
      libraryMaterials.add(libraryMaterial)
      const warningMaterial = libraryMaterial.clone()
      warningMaterial.dispose = state.museumWarningMaterialDispose
      state.warningSharesLibraryTexture = warningMaterial.map === sharedTexture
      const geometry = new BoxGeometry()
      geometry.dispose = state.museumGeometryDispose
      const adapterRoot = new Group()
      adapterRoot.add(new Mesh(geometry, warningMaterial))
      root.add(adapterRoot)
      let adapterDisposed = false
      disposeMuseum = state.museumDispose.mockImplementation(() => {
        if (adapterDisposed) return
        adapterDisposed = true
        geometry.dispose()
        warningMaterial.dispose()
        adapterRoot.removeFromParent()
      })
      let libraryDisposed = false
      disposeLibrary = state.museumLibraryDispose.mockImplementation(() => {
        if (libraryDisposed) return
        libraryDisposed = true
        libraryMaterial.dispose()
        sharedTexture.dispose()
        libraryMaterials.clear()
      })
    }
    return {
      root,
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
      dispose: disposeMuseum,
      materialLibrary: { materials: libraryMaterials, dispose: disposeLibrary },
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
  state.assetLoadOptions = null
  state.museumFailure = null
  state.museumOwnershipFixture = false
  state.museumDispose.mockReset()
  state.museumLibraryDispose.mockReset()
  state.museumGeometryDispose.mockReset()
  state.museumWarningMaterialDispose.mockReset()
  state.museumLibraryMaterialDispose.mockReset()
  state.museumSharedTextureDispose.mockReset()
  state.warningSharesLibraryTexture = false
  state.environmentLoadFailure = null
  state.render.mockClear()
  state.compile.mockClear()
  state.programIsReady.mockReset().mockReturnValue(true)
  state.programProperties.mockClear()
  state.setSize.mockClear()
  state.setPixelRatio.mockClear()
  state.shadowNeedsUpdateAtProbeRender.length = 0
  state.shadowNeedsUpdateAtRender.length = 0
  state.mercVisibleAtRender.length = 0
  state.getError.mockReset().mockReturnValue(0)
  state.rendererDispose.mockClear()
  state.forceContextLoss.mockClear()
  state.canvasRemove.mockClear()
  state.mercDispose.mockClear()
  state.mercUpdate.mockClear()
  state.vesselUpdates.length = 0
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

it('hides Merc only for the primary first-person render', async () => {
  const renderer = createGlassRenderer(
    browserFixture(),
    GLASSWORKS,
    (id) => id,
    { cameraMode: 'first-person' },
  )
  await renderer.ready
  const snapshot = createGlassGame(GLASSWORKS).snapshot()

  expect(renderer.getCameraMode()).toBe('first-person')
  renderer.render(snapshot, 0.016)
  renderer.setCameraMode('third-person')
  renderer.render(snapshot, 0.016)

  expect(state.mercVisibleAtRender).toEqual([false, true])
  renderer.dispose()
})

it('keeps Merc animation on elapsed presentation time across a dropped mobile frame', async () => {
  const renderer = createGlassRenderer(browserFixture(), GLASSWORKS, (id) => id)
  await renderer.ready
  state.mercUpdate.mockClear()
  const snapshot = createGlassGame(GLASSWORKS).snapshot()

  renderer.render(snapshot, 0.12)

  expect(state.mercUpdate).toHaveBeenCalledWith(snapshot, 0.12, false, {
    narrationLevel: undefined,
    facingYaw: undefined,
    turnDeltaSeconds: 0.05,
  })

  state.mercUpdate.mockClear()
  renderer.render(snapshot, 0.9)
  expect(state.mercUpdate).toHaveBeenCalledWith(snapshot, 0.25, false, {
    narrationLevel: undefined,
    facingYaw: undefined,
    turnDeltaSeconds: 0.05,
  })

  state.mercUpdate.mockClear()
  snapshot.paused = true
  renderer.render(snapshot, 0.12)
  expect(state.mercUpdate).toHaveBeenCalledWith(snapshot, 0, false, {
    narrationLevel: 0,
    facingYaw: undefined,
    turnDeltaSeconds: 0,
  })
  renderer.dispose()
})

it('passes voice energy to the mascot and suppresses it during a host pause', async () => {
  const renderer = createGlassRenderer(browserFixture(), GLASSWORKS, (id) => id)
  await renderer.ready
  const snapshot = createGlassGame(GLASSWORKS).snapshot()
  renderer.render(snapshot, 0.016, {
    paused: false,
    challengeEncounterId: null,
    narrationLevel: 0.7,
  })
  expect(state.mercUpdate).toHaveBeenLastCalledWith(
    snapshot,
    0.016,
    false,
    expect.objectContaining({ narrationLevel: 0.7 }),
  )
  renderer.render(snapshot, 0.016, {
    paused: true,
    challengeEncounterId: null,
    narrationLevel: 0.7,
  })
  expect(state.mercUpdate).toHaveBeenLastCalledWith(
    snapshot,
    0.016,
    false,
    expect.objectContaining({ narrationLevel: 0 }),
  )
  renderer.dispose()
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

it('balances Auto on a coarse-pointer tablet without a mobile browser hint', async () => {
  const container = browserFixture()
  const queries: string[] = []
  vi.stubGlobal('window', {
    devicePixelRatio: 2,
    innerWidth: 1194,
    innerHeight: 834,
    matchMedia: (query: string) => {
      queries.push(query)
      return { matches: query === '(pointer: coarse)' }
    },
  })
  vi.stubGlobal('navigator', {})

  const renderer = createGlassRenderer(container, GLASSWORKS, (id) => id)
  await renderer.ready

  expect(queries).toContain('(pointer: coarse)')
  expect(renderer.getRenderQuality()).toMatchObject({
    preference: 'auto',
    profile: 'balanced',
    assetProfile: 'mobile',
  })
  expect(state.assetLoadOptions).toMatchObject({
    assetProfile: 'mobile',
    maximumConcurrentBundleLoads: 1,
  })
  renderer.dispose()
})

it('keeps High display settings while a native host fixes the packaged asset tier', async () => {
  const renderer = createGlassRenderer(
    browserFixture(),
    GLASSWORKS,
    (id) => id,
    { renderQuality: 'high', assetProfile: 'mobile' },
  )
  await renderer.ready

  expect(renderer.getRenderQuality()).toMatchObject({
    preference: 'high',
    profile: 'high',
    assetProfile: 'mobile',
  })
  expect(state.assetLoadOptions).toMatchObject({
    assetProfile: 'mobile',
    maximumConcurrentBundleLoads: 2,
  })
  renderer.dispose()
})

it('keeps an unprofiled browser High startup on full assets', async () => {
  const renderer = createGlassRenderer(
    browserFixture(),
    GLASSWORKS,
    (id) => id,
    { renderQuality: 'high' },
  )
  await renderer.ready

  expect(renderer.getRenderQuality()).toMatchObject({
    preference: 'high',
    profile: 'high',
    assetProfile: 'full',
  })
  expect(state.assetLoadOptions).toMatchObject({
    assetProfile: 'full',
    maximumConcurrentBundleLoads: 2,
  })
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
    assetProfile: 'mobile',
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

it('bounds balanced bundle work and aborts the renderer attempt on teardown', async () => {
  const renderer = createGlassRenderer(
    browserFixture(),
    GLASSWORKS,
    (id) => id,
    { renderQuality: 'balanced' },
  )
  await renderer.ready

  expect(state.assetLoadOptions).toMatchObject({
    assetProfile: 'mobile',
    maximumConcurrentBundleLoads: 1,
  })
  expect(state.assetLoadOptions?.signal?.aborted).toBe(false)
  const close = vi.fn()
  const image = { close } as unknown as TexImageSource
  state.assetLoadOptions?.onDecodedImage?.(image)
  state.assetLoadOptions?.onDecodedImage?.(image)

  renderer.dispose()
  expect(state.assetLoadOptions?.signal?.aborted).toBe(true)
  expect(close).toHaveBeenCalledOnce()
})

it('initializes a balanced shadow for probe and playable frames after each renderer attempt', async () => {
  const snapshot = createGlassGame(GLASSWORKS).snapshot()

  for (let attempt = 0; attempt < 2; attempt++) {
    const renderer = createGlassRenderer(
      browserFixture(),
      GLASSWORKS,
      (id) => id,
      { renderQuality: 'balanced' },
    )
    await renderer.ready
    expect(state.shadowNeedsUpdateAtProbeRender.at(-1)).toBe(true)

    renderer.render(snapshot, 0.016)
    renderer.render(snapshot, 0.016)
    expect(state.shadowNeedsUpdateAtRender.slice(-2)).toEqual([true, false])
    renderer.dispose()
  }

  expect(state.shadowNeedsUpdateAtProbeRender).toEqual([true, true])
})

it('invalidates the first manual shadow after switching high to balanced', async () => {
  const renderer = createGlassRenderer(
    browserFixture(),
    GLASSWORKS,
    (id) => id,
    { renderQuality: 'high' },
  )
  await renderer.ready
  const snapshot = createGlassGame(GLASSWORKS).snapshot()

  renderer.render(snapshot, 0.016)
  renderer.setRenderQuality('balanced')
  renderer.render(snapshot, 0.016)
  renderer.render(snapshot, 0.016)

  expect(state.shadowNeedsUpdateAtRender).toEqual([true, true, false])
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
    assetProfile: 'mobile',
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
  const expectedTotal = assetPlan.taskIds.length + 4
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

it('keeps the loading gate until hidden shatter programs are compiled', async () => {
  state.programIsReady.mockReturnValue(false)
  const renderer = createGlassRenderer(browserFixture(), GLASSWORKS, (id) => id)
  let ready = false
  void renderer.ready.then(() => {
    ready = true
  })
  await vi.waitFor(() => expect(state.compile).toHaveBeenCalledOnce())
  const compiledScene = state.compile.mock.calls[0]![0] as Scene
  expect(
    compiledScene.getObjectByName(
      `vessel-shards-${GLASSWORKS.breakables[0]!.id}`,
    ),
  ).toBeDefined()
  expect(ready).toBe(false)
  state.programIsReady.mockReturnValue(true)
  await renderer.ready
  expect(ready).toBe(true)
  renderer.dispose()
})

it.each(['dispose', 'context loss'] as const)(
  'cancels pending shader polling before renderer teardown on %s',
  async (cause) => {
    state.programIsReady.mockReturnValue(false)
    const renderer = createGlassRenderer(
      browserFixture(),
      GLASSWORKS,
      (id) => id,
      {
        onContextLost: () => renderer.dispose(),
      },
    )
    await vi.waitFor(() => expect(state.compile).toHaveBeenCalledOnce())
    const readinessCalls = state.programIsReady.mock.calls.length

    if (cause === 'context loss')
      state.listeners.get('webglcontextlost')?.(new Event('webglcontextlost'))
    else renderer.dispose()

    await expect(renderer.ready).resolves.toBeUndefined()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(state.programIsReady).toHaveBeenCalledTimes(readinessCalls)
    expect(state.rendererDispose).toHaveBeenCalledOnce()
    expect(state.forceContextLoss).toHaveBeenCalledOnce()
  },
)

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

it('disposes museum adapter resources before shared library textures exactly once', async () => {
  state.museumOwnershipFixture = true
  const renderer = createGlassRenderer(browserFixture(), GLASSWORKS, (id) => id)
  await renderer.ready

  expect(state.warningSharesLibraryTexture).toBe(true)
  renderer.dispose()
  renderer.dispose()

  expect(state.museumDispose).toHaveBeenCalledOnce()
  expect(state.museumGeometryDispose).toHaveBeenCalledOnce()
  expect(state.museumWarningMaterialDispose).toHaveBeenCalledOnce()
  expect(state.museumLibraryDispose).toHaveBeenCalledOnce()
  expect(state.museumLibraryMaterialDispose).toHaveBeenCalledOnce()
  expect(state.museumSharedTextureDispose).toHaveBeenCalledOnce()
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
  expect(state.vesselUpdates).toHaveLength(level.breakables.length)
  expect(
    state.vesselUpdates.every((update) => update.presentationVisible === false),
  ).toBe(true)

  state.vesselUpdates.length = 0
  state.visibleRoomIds.add('hidden-room')
  renderer.render(snapshot, 0.016)
  expect(vessels.every((vessel) => vessel.visible)).toBe(true)
  expect(state.vesselUpdates).toHaveLength(level.breakables.length)
  expect(
    state.vesselUpdates.every((update) => update.presentationVisible === true),
  ).toBe(true)
  renderer.dispose()
})

it('keeps explicitly room-owned Rosebuds hidden during reflection capture', async () => {
  state.runtimeRoomId = 'hidden-room'
  const visibilityAtCapture: boolean[][] = []
  state.updatePlanarReflection.mockImplementation((...args: unknown[]) => {
    const scene = args[1] as Scene
    const withAdditionalVisible = args[5] as (capture: () => void) => void
    withAdditionalVisible(() => {
      visibilityAtCapture.push(
        scene.children
          .filter((child) => child.name.startsWith('vessel-'))
          .map((vessel) => vessel.visible),
      )
    })
    return false
  })
  const renderer = createGlassRenderer(
    browserFixture(),
    CLOUDWAY_THAWING_SONG,
    (id) => id,
  )
  await renderer.ready

  renderer.render(createGlassGame(CLOUDWAY_THAWING_SONG).snapshot(), 0.016)

  expect(visibilityAtCapture).toHaveLength(1)
  expect(visibilityAtCapture[0]).toHaveLength(
    CLOUDWAY_THAWING_SONG.breakables.length,
  )
  expect(visibilityAtCapture[0]!.every((visible) => !visible)).toBe(true)
  renderer.dispose()
})

it('temporarily reveals prefix-owned legacy vessels for reflections and restores culling', async () => {
  state.runtimeRoomId = 'hidden-room'
  const visibilityAtCapture: boolean[][] = []
  state.updatePlanarReflection.mockImplementation((...args: unknown[]) => {
    const scene = args[1] as Scene
    const withAdditionalVisible = args[5] as (capture: () => void) => void
    withAdditionalVisible(() => {
      visibilityAtCapture.push(
        scene.children
          .filter((child) => child.name.startsWith('vessel-'))
          .map((vessel) => vessel.visible),
      )
    })
    return false
  })
  const renderer = createGlassRenderer(browserFixture(), GLASSWORKS, (id) => id)
  await renderer.ready

  renderer.render(createGlassGame(GLASSWORKS).snapshot(), 0.016)

  const scene = state.render.mock.calls[0]![0] as Scene
  const vessels = scene.children.filter((child) =>
    child.name.startsWith('vessel-'),
  )
  expect(visibilityAtCapture[0]!.every((visible) => visible)).toBe(true)
  expect(vessels.every((vessel) => !vessel.visible)).toBe(true)
  expect(
    state.vesselUpdates.filter(
      (update) => update.presentationVisible === false,
    ),
  ).toHaveLength(GLASSWORKS.breakables.length)
  expect(
    state.vesselUpdates.filter((update) => update.presentationVisible === true),
  ).toHaveLength(GLASSWORKS.breakables.length)
  renderer.dispose()
})
