// Runner renderer lifecycle tests — pending assets and context loss cannot retain a retired visit.
import type * as Three from 'three'
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Texture } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runnerCourseFixture } from '../browser/__fixtures__/runner-course'
import { deferred, flush } from '../browser/__fixtures__/runner-session'
import { SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY } from '../runner/crystal-obstacle-study'
import { SINGING_CURRENT_CONTINUOUS_TRIAL } from '../runner/first-course'
import { createSongRunnerGame } from '../runner/game'
import { runnerCameraFollowTarget, runnerCameraPose, } from './runner-world-layout'

const state = vi.hoisted(() => ({
  render: vi.fn(),
  pixelRatio: 1,
  setPixelRatio: vi.fn(),
  dispose: vi.fn(),
  loseContext: vi.fn(),
  canvasRemove: vi.fn(),
  listeners: new Map<string, (event: Event) => void>(),
  observerDisconnect: vi.fn(),
  model: vi.fn(),
  texture: vi.fn(),
  merc: vi.fn(),
  imageRelease: vi.fn(),
  environmentDispose: vi.fn(),
  environmentCapture: vi.fn(),
  openingCreate: vi.fn(),
  openingUpdate: vi.fn(),
  openingDispose: vi.fn(),
  worldDispose: vi.fn(),
  targetDispose: vi.fn(),
  sceneryDispose: vi.fn(),
  sceneryCreate: vi.fn(),
  sceneryUpdate: vi.fn(),
  scenerySetCamera: vi.fn(),
  sceneryWarm: vi.fn(),
  sceneryRestore: vi.fn(),
  mercDispose: vi.fn(),
  mercRoot: undefined as Group | undefined,
  worldUpdate: vi.fn(),
  targetUpdate: vi.fn(),
  targetCreate: vi.fn(),
  targetSpeed: vi.fn(),
  precompile: vi.fn(),
  verifyFirstFrame: vi.fn(),
  decoded: undefined as ((image: TexImageSource) => void) | undefined,
  observer: undefined as (() => void) | undefined,
}))
vi.mock('three', async (original) => ({
  ...(await original<typeof Three>()),
  TextureLoader: class {
    loadAsync = state.texture
  },
  WebGLRenderer: class {
    domElement = {
      style: {},
      setAttribute: vi.fn(),
      remove: state.canvasRemove,
      addEventListener: (name: string, fn: (event: Event) => void) =>
        state.listeners.set(name, fn),
      removeEventListener: (name: string) => state.listeners.delete(name),
    }
    shadowMap = {
      enabled: false,
      type: 0,
      autoUpdate: false,
      needsUpdate: false,
    }
    info = { render: { calls: 1, triangles: 2 } }
    setPixelRatio = (value: number) => {
      state.pixelRatio = value
      state.setPixelRatio(value)
    }
    getPixelRatio = () => state.pixelRatio
    setSize = vi.fn()
    getContext = () => ({})
    render = state.render
    dispose = state.dispose
    forceContextLoss = state.loseContext
  },
}))
vi.mock('./merc', () => ({ loadAdventureMerc: state.merc }))
vi.mock('./asset-scene-loader', () => ({
  loadProfiledAssetScene: (
    url: string,
    options: { onDecodedImage: (image: TexImageSource) => void },
  ) => {
    state.decoded = options.onDecodedImage
    return state.model(url)
  },
}))
vi.mock('./asset-texture-profile', () => ({
  releaseAssetImage: state.imageRelease,
}))
vi.mock('./environment', () => ({
  createMuseumEnvironment: () => ({
    load: vi.fn().mockResolvedValue(undefined),
    capture: state.environmentCapture,
    dispose: state.environmentDispose,
  }),
}))
vi.mock('./first-frame', () => ({ verifyFirstFrame: state.verifyFirstFrame }))
vi.mock('./program-precompile', () => ({
  precompileRendererPrograms: state.precompile,
}))
vi.mock('./sky-backdrop', () => ({ fitSkyBackdrop: vi.fn() }))
vi.mock('./backdrop-fog', () => ({ installBackdropFog: vi.fn() }))
vi.mock('./runner-world', () => ({
  createRunnerWorld: () => ({
    root: new Group(),
    update: state.worldUpdate,
    dispose: state.worldDispose,
    metrics: () => ({ residentChunks: 1 }),
  }),
}))
vi.mock('./runner-targets', () => ({
  createRunnerTargets: (...args: unknown[]) => {
    state.targetCreate(...args)
    return {
      root: new Group(),
      update: state.targetUpdate,
      setShatterPlaybackSpeed: state.targetSpeed,
      dispose: state.targetDispose,
      metrics: () => ({ targets: 1 }),
    }
  },
}))

import { createSongRunnerRenderer } from './runner-renderer'

vi.mock('./runner-opening', () => ({
  createRunnerOpening: (options: unknown) => {
    state.openingCreate(options)
    return {
      root: new Group(),
      update: state.openingUpdate,
      dispose: state.openingDispose,
      metrics: () => ({ drawBatches: 4, triangles: 2400 }),
    }
  },
}))

vi.mock('./runner-scenery', () => ({
  createRunnerScenery: (options: unknown) => {
    state.sceneryCreate(options)
    return {
      root: new Group(),
      update: state.sceneryUpdate,
      setCameraProfile: state.scenerySetCamera,
      dispose: state.sceneryDispose,
      metrics: () => ({ residentChunks: 2, drawBatches: 3, triangles: 1200 }),
      async withWarmupState(callback: () => Promise<void>) {
        state.sceneryWarm()
        try {
          await callback()
        } finally {
          state.sceneryRestore()
        }
      },
    }
  },
}))

function ownedScene() {
  const geometry = new BoxGeometry(),
    material = new MeshBasicMaterial()
  const geometryDispose = vi.spyOn(geometry, 'dispose'),
    materialDispose = vi.spyOn(material, 'dispose')
  const root = new Group()
  root.add(new Mesh(geometry, material))
  return { root, geometryDispose, materialDispose }
}

function fixture(
  dressedOpening = false,
  continuous = false,
  crystalStudy = false,
) {
  const source = crystalStudy
    ? SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY
    : continuous
      ? SINGING_CURRENT_CONTINUOUS_TRIAL
      : runnerCourseFixture()
  const course = dressedOpening
      ? {
          ...source,
          presentation: {
            ...source.presentation,
            cameraProfile: 'responsive-close' as const,
          },
        }
      : source,
    snapshot = createSongRunnerGame(course, { comfortableMidi: 60 }).snapshot()
  const container = {
    clientWidth: 800,
    clientHeight: 600,
    append: vi.fn(),
  } as unknown as HTMLElement
  const lost = vi.fn()
  const renderer = createSongRunnerRenderer(container, course, 60, (id) => id, {
    initialSnapshot: snapshot,
    onContextLost: lost,
  })
  return { renderer, lost, snapshot, container }
}
beforeEach(() => {
  vi.clearAllMocks()
  state.pixelRatio = 1
  state.listeners.clear()
  state.decoded = undefined
  vi.stubGlobal('window', {
    devicePixelRatio: 1,
    matchMedia: () => ({ matches: false }),
  })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        state.observer = callback
      }
      observe() {}
      disconnect = state.observerDisconnect
    },
  )
  state.mercRoot = new Group()
  state.merc.mockResolvedValue({
    root: state.mercRoot,
    update: vi.fn(),
    dispose: state.mercDispose,
  })
  state.texture.mockImplementation(async () => new Texture())
  state.model.mockImplementation(async () => new Group())
  state.precompile.mockResolvedValue(undefined)
  state.scenerySetCamera.mockReturnValue(true)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('runner renderer ownership', () => {
  it('changes a paused camera and fog together without reloading, warming or advancing the session', async () => {
    const { renderer, snapshot, container } = fixture(true, true)
    expect(renderer.setCameraProfile('steering-angled')).toBe(false)
    await renderer.ready
    const paused = {
      ...snapshot,
      status: 'paused' as const,
      courseDistanceMeters: 108,
      courseSeconds: 36,
      player: { ...snapshot.player, lateralX: 1.2 },
    }
    renderer.render(paused, 0)
    const before = {
      models: state.model.mock.calls.length,
      textures: state.texture.mock.calls.length,
      draws: state.render.mock.calls.length,
    }
    expect(renderer.setCameraProfile('steering-angled')).toBe(true)
    expect(state.scenerySetCamera).toHaveBeenCalledExactlyOnceWith(
      'steering-angled',
    )
    expect(state.render).toHaveBeenCalledTimes(before.draws + 1)
    const [scene, camera] = state.render.mock.lastCall! as [
      Three.Scene,
      Three.PerspectiveCamera,
    ]
    const pose = runnerCameraPose(
      container.clientWidth / container.clientHeight,
      SINGING_CURRENT_CONTINUOUS_TRIAL.laneCenters,
      'steering-angled',
    )
    const follow = runnerCameraFollowTarget(
      paused.player.lateralX,
      SINGING_CURRENT_CONTINUOUS_TRIAL.laneCenters,
      camera.aspect,
      'steering-angled',
      true,
    )
    expect(camera.position.toArray()).toEqual([pose.x + follow, pose.y, pose.z])
    expect((scene.fog as Three.Fog).far).toBe(35)
    expect(state.worldUpdate).toHaveBeenLastCalledWith(paused, 0)
    expect(state.targetUpdate).toHaveBeenLastCalledWith(paused, 0)
    expect(state.sceneryUpdate).toHaveBeenLastCalledWith(paused, 0)
    expect(state.model).toHaveBeenCalledTimes(before.models)
    expect(state.texture).toHaveBeenCalledTimes(before.textures)
    expect(state.sceneryCreate).toHaveBeenCalledOnce()
    expect(state.environmentCapture).toHaveBeenCalledOnce()
    expect(state.precompile).toHaveBeenCalledOnce()
    expect(state.merc).toHaveBeenCalledOnce()
    expect(state.dispose).not.toHaveBeenCalled()
    expect(renderer.setCameraProfile('steering-angled')).toBe(true)
    expect(state.render).toHaveBeenCalledTimes(before.draws + 1)
    expect(state.scenerySetCamera).toHaveBeenCalledOnce()
    expect(renderer.setCameraProfile('responsive-close')).toBe(true)
    expect((scene.fog as Three.Fog).far).toBe(37)
    Object.defineProperty(container, 'clientWidth', {
      value: 0,
      configurable: true,
    })
    const sceneryChanges = state.scenerySetCamera.mock.calls.length
    expect(renderer.setCameraProfile('steering-close')).toBe(false)
    expect(state.scenerySetCamera).toHaveBeenCalledTimes(sceneryChanges)
    expect((scene.fog as Three.Fog).far).toBe(37)
    Object.defineProperty(container, 'clientWidth', {
      value: 800,
      configurable: true,
    })
    renderer.render({ ...paused, status: 'running' }, 0)
    expect(renderer.setCameraProfile('steering-close')).toBe(false)
    renderer.render(paused, 0)
    expect(renderer.setCameraProfile('legacy-wide')).toBe(false)
    state.scenerySetCamera.mockReturnValueOnce(false)
    expect(renderer.setCameraProfile('steering-close')).toBe(false)
    expect((scene.fog as Three.Fog).far).toBe(37)
    renderer.dispose()
    expect(renderer.setCameraProfile('steering-close')).toBe(false)
  })

  it('rejects camera changes while shaders warm or the graphics context is lost', async () => {
    const pending = deferred<undefined>()
    state.precompile.mockReturnValueOnce(pending.promise)
    const { renderer } = fixture(true)
    await vi.waitFor(() => expect(state.precompile).toHaveBeenCalledOnce())
    expect(renderer.setCameraProfile('steering-angled')).toBe(false)
    expect(state.scenerySetCamera).not.toHaveBeenCalled()
    pending.resolve(undefined)
    await renderer.ready
    state.listeners.get('webglcontextlost')?.(
      new Event('webglcontextlost', { cancelable: true }),
    )
    expect(renderer.setCameraProfile('steering-angled')).toBe(false)
    expect(state.scenerySetCamera).not.toHaveBeenCalled()
    renderer.dispose()
  })

  it('captures only during preparation and retires the dressed opening with the visit', async () => {
    const { renderer, snapshot } = fixture(true)
    await renderer.ready
    expect(state.environmentCapture).toHaveBeenCalledOnce()
    expect(state.openingCreate).toHaveBeenCalledOnce()
    expect(state.merc).toHaveBeenCalledWith(expect.any(String), {
      initialFacingYaw: Math.PI,
    })
    expect(state.sceneryCreate).toHaveBeenCalledWith(
      expect.objectContaining({ skipFirstChunks: 2 }),
    )
    expect(state.openingUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      state.environmentCapture.mock.invocationCallOrder[0]!,
    )
    expect(state.environmentCapture.mock.invocationCallOrder[0]).toBeLessThan(
      state.precompile.mock.invocationCallOrder[0]!,
    )
    for (let frame = 0; frame < 4; frame++) renderer.render(snapshot, 1 / 60)
    expect(state.environmentCapture).toHaveBeenCalledOnce()
    expect(renderer.metrics()).toMatchObject({
      sceneryBatches: 7,
      sceneryTriangles: 3600,
    })
    renderer.dispose()
    renderer.dispose()
    expect(state.openingDispose).toHaveBeenCalledOnce()
  })

  it('retires a dressed opening when the reflection capture fails before readiness', async () => {
    state.environmentCapture.mockImplementationOnce(() => {
      throw new Error('probe failed')
    })
    const { renderer } = fixture(true)
    await expect(renderer.ready).rejects.toThrow('probe failed')
    expect(state.openingDispose).toHaveBeenCalledOnce()
    expect(state.environmentDispose).toHaveBeenCalledOnce()
    expect(state.precompile).not.toHaveBeenCalled()
  })

  it('disposes the partial scene on a missing mandatory texture', async () => {
    state.texture.mockRejectedValueOnce(new Error('Missing texture'))
    const { renderer } = fixture()
    await expect(renderer.ready).rejects.toThrow('Missing texture')
    renderer.dispose()
    expect(state.mercDispose).toHaveBeenCalledOnce()
    expect(state.environmentDispose).toHaveBeenCalledOnce()
    expect(state.dispose).toHaveBeenCalledOnce()
    expect(state.observerDisconnect).toHaveBeenCalledOnce()
    expect(state.model).not.toHaveBeenCalled()
  })

  it('releases earlier decoded geometry and textures when the next mandatory model fails', async () => {
    const first = ownedScene(),
      texture = new Texture(),
      textureDispose = vi.spyOn(texture, 'dispose')
    state.model
      .mockResolvedValueOnce(first.root)
      .mockRejectedValueOnce(new Error('Missing glass'))
    state.texture
      .mockResolvedValueOnce(texture)
      .mockResolvedValueOnce(new Texture())
    const { renderer } = fixture()
    await expect(renderer.ready).rejects.toThrow('Missing glass')
    expect(first.geometryDispose).toHaveBeenCalledOnce()
    expect(first.materialDispose).toHaveBeenCalledOnce()
    expect(textureDispose).toHaveBeenCalledOnce()
    expect(state.mercDispose).toHaveBeenCalledOnce()
    expect(state.dispose).toHaveBeenCalledOnce()
  })

  it('releases a Merc load that resolves after exit without beginning later asset loads', async () => {
    const pending = deferred<{
      root: Group
      update: () => void
      dispose: () => void
    }>()
    state.merc.mockReturnValue(pending.promise)
    const { renderer, snapshot } = fixture()
    renderer.dispose()
    pending.resolve({
      root: new Group(),
      update: vi.fn(),
      dispose: state.mercDispose,
    })
    await renderer.ready
    expect(state.mercDispose).toHaveBeenCalledOnce()
    expect(state.texture).not.toHaveBeenCalled()
    expect(renderer.render(snapshot, 0)).toBe(false)
    expect(state.render).not.toHaveBeenCalled()
  })

  it('releases a late model and decoded image after exit', async () => {
    const pending = deferred<Group>(),
      owned = ownedScene()
    state.model.mockReturnValueOnce(pending.promise)
    const { renderer } = fixture()
    await flush()
    expect(state.model).toHaveBeenCalledOnce()
    renderer.dispose()
    const image = {} as TexImageSource
    state.decoded?.(image)
    pending.resolve(owned.root)
    await renderer.ready
    expect(state.imageRelease).toHaveBeenCalledWith(image)
    expect(owned.geometryDispose).toHaveBeenCalledOnce()
    expect(owned.materialDispose).toHaveBeenCalledOnce()
    expect(state.model).toHaveBeenCalledOnce()
  })

  it('releases a late texture after exit without creating any model', async () => {
    const pending = deferred<Texture>(),
      texture = new Texture(),
      disposed = vi.spyOn(texture, 'dispose')
    state.texture.mockReturnValueOnce(pending.promise)
    const { renderer } = fixture()
    await flush()
    renderer.dispose()
    pending.resolve(texture)
    await renderer.ready
    expect(disposed).toHaveBeenCalledOnce()
    expect(state.model).not.toHaveBeenCalled()
  })

  it('notifies context loss, retires interactions and disposes every owner once', async () => {
    const { renderer, lost, snapshot } = fixture()
    await renderer.ready
    expect(state.render).toHaveBeenCalledTimes(2)
    expect(renderer.render(snapshot, 0)).toBe(true)
    lost.mockImplementation(() => renderer.dispose())
    const event = new Event('webglcontextlost', { cancelable: true })
    state.listeners.get('webglcontextlost')?.(event)
    expect(event.defaultPrevented).toBe(true)
    expect(lost).toHaveBeenCalledOnce()
    renderer.dispose()
    state.observer?.()
    expect(renderer.render(snapshot, 0.1)).toBe(false)
    expect(state.render).toHaveBeenCalledTimes(3)
    for (const disposer of [
      state.dispose,
      state.loseContext,
      state.canvasRemove,
      state.mercDispose,
      state.environmentDispose,
      state.worldDispose,
      state.targetDispose,
      state.sceneryDispose,
      state.observerDisconnect,
    ])
      expect(disposer).toHaveBeenCalledOnce()
    expect(state.listeners.size).toBe(0)
  })

  it('warms resident variants and paints the verified initial snapshot before readiness', async () => {
    const { renderer } = fixture()

    await renderer.ready

    expect(state.precompile).toHaveBeenCalledOnce()
    expect(state.render).toHaveBeenCalledTimes(2)
    expect(state.worldUpdate).toHaveBeenCalledTimes(2)
    expect(state.targetUpdate).toHaveBeenCalledTimes(2)
    expect(state.sceneryUpdate).toHaveBeenCalledTimes(2)
    expect(state.targetUpdate).toHaveBeenNthCalledWith(1, expect.any(Object), 0)
    expect(state.targetUpdate).toHaveBeenNthCalledWith(2, expect.any(Object), 0)
    expect(state.verifyFirstFrame).toHaveBeenCalledOnce()
    expect(state.precompile.mock.invocationCallOrder[0]).toBeLessThan(
      state.render.mock.invocationCallOrder[0]!,
    )
    expect(state.render.mock.invocationCallOrder[1]).toBeLessThan(
      state.verifyFirstFrame.mock.invocationCallOrder[0]!,
    )
    expect(state.sceneryWarm.mock.invocationCallOrder[0]).toBeLessThan(
      state.precompile.mock.invocationCallOrder[0]!,
    )
    expect(state.render.mock.invocationCallOrder[0]).toBeLessThan(
      state.sceneryRestore.mock.invocationCallOrder[0]!,
    )
    expect(state.sceneryRestore.mock.invocationCallOrder[0]).toBeLessThan(
      state.render.mock.invocationCallOrder[1]!,
    )
  })

  it('applies the runner-only Merc presentation scale before the first draw', async () => {
    const { renderer } = fixture()

    await renderer.ready

    expect(state.mercRoot!.scale.x).toBeCloseTo(0.82 / 0.55, 8)
    expect(state.mercRoot!.scale.y).toBeCloseTo(0.82 / 0.55, 8)
    expect(state.mercRoot!.scale.z).toBeCloseTo(0.82 / 0.55, 8)
    expect(state.render).toHaveBeenCalledTimes(2)
    renderer.dispose()
  })

  it('forwards presentation elapsed time to target feedback', async () => {
    const { renderer, snapshot } = fixture()
    await renderer.ready
    state.targetUpdate.mockClear()
    state.sceneryUpdate.mockClear()

    expect(renderer.render(snapshot, 0.075)).toBe(true)

    expect(state.targetUpdate).toHaveBeenCalledExactlyOnceWith(snapshot, 0.075)
    expect(state.sceneryUpdate).toHaveBeenCalledExactlyOnceWith(snapshot, 0.075)
  })

  it('applies pending shatter speed before loading and forwards later changes', async () => {
    const { renderer } = fixture()
    renderer.setShatterPlaybackSpeed(0.5)
    await renderer.ready
    expect(state.targetCreate.mock.lastCall?.[6]).toBe(0.5)
    renderer.setShatterPlaybackSpeed(1.3)
    expect(state.targetSpeed).toHaveBeenLastCalledWith(1.3)
    renderer.dispose()
  })

  it('changes display quality without reloading the startup asset tier or slowing simulation', async () => {
    vi.stubGlobal('window', {
      devicePixelRatio: 3,
      matchMedia: () => ({ matches: true }),
    })
    const { renderer, snapshot } = fixture()
    await renderer.ready
    const loads = state.model.mock.calls.length
    expect(renderer.getRenderQuality()).toMatchObject({
      preference: 'auto',
      profile: 'balanced',
      assetProfile: 'mobile',
      pixelRatio: 1.25,
      shadowFrameInterval: 2,
    })
    renderer.setRenderQuality('high')
    expect(renderer.getRenderQuality()).toMatchObject({
      preference: 'high',
      profile: 'high',
      assetProfile: 'mobile',
      pixelRatio: 1.5,
      shadowFrameInterval: 1,
    })
    const running = { ...snapshot, status: 'running' as const }
    for (let i = 0; i < 30; i++) renderer.render(running, 0.05)
    expect(renderer.metrics().adaptiveQualityActive).toBe(false)
    expect(state.worldUpdate).toHaveBeenLastCalledWith(running, 0.05)
    expect(state.model).toHaveBeenCalledTimes(loads)
    renderer.setRenderQuality('auto')
    expect(renderer.getRenderQuality()).toMatchObject({
      profile: 'balanced',
      pixelRatio: 1.25,
      shadowFrameInterval: 2,
    })
    renderer.dispose()
  })

  it('retires the renderer when the loading warmup draw fails', async () => {
    state.render.mockImplementationOnce(() => {
      throw new Error('warmup draw failed')
    })
    const { renderer } = fixture()

    await expect(renderer.ready).rejects.toThrow('warmup draw failed')

    expect(state.dispose).toHaveBeenCalledOnce()
    expect(state.loseContext).toHaveBeenCalledOnce()
    expect(state.worldDispose).toHaveBeenCalledOnce()
    expect(state.targetDispose).toHaveBeenCalledOnce()
    expect(state.sceneryRestore).toHaveBeenCalledOnce()
    expect(state.sceneryDispose).toHaveBeenCalledOnce()
  })

  it('loads the finished scenery donors once before readiness and reports their separate residency', async () => {
    const { renderer } = fixture()
    await renderer.ready
    expect(state.model.mock.calls.map(([id]) => id)).toEqual([
      'living-crystal-platform-v2',
      'cloudway-lab-frost-gold-arch-desktop-v1',
      'museum-kit-v2',
      'museum-garden-v2',
      'museum-arcade-v3',
      'museum-canopy-v3',
    ])
    expect(state.texture.mock.calls.map(([id]) => id)).toEqual([
      'floor-marble',
      'floating-museum-cloudscape-v3',
      'finish-champagne-crystal-roughness',
      'finish-champagne-crystal-normal',
      'finish-etched-frost-glass-roughness',
      'finish-etched-frost-glass-normal',
      'finish-celadon-porcelain-basecolor',
      'finish-celadon-porcelain-roughness',
      'finish-celadon-porcelain-normal',
    ])
    expect(state.sceneryCreate).toHaveBeenCalledOnce()
    expect(renderer.metrics()).toMatchObject({
      residentChunks: 1,
      sceneryChunks: 2,
      sceneryBatches: 3,
      sceneryTriangles: 1200,
    })
    renderer.dispose()
  })

  it('loads each obstacle bundle once for the crystal study and retires the owned donors', async () => {
    const bulwark = ownedScene(),
      hurdle = ownedScene()
    state.model.mockImplementation(async (id: string) => {
      if (id === 'runner-crystal-bulwark-v1') return bulwark.root
      if (id === 'runner-rose-hurdle-v1') return hurdle.root
      return new Group()
    })
    const { renderer } = fixture(true, true, true)
    await renderer.ready
    const ids = state.model.mock.calls.map(([id]) => id)
    expect(ids.filter((id) => id === 'runner-crystal-bulwark-v1')).toHaveLength(
      1,
    )
    expect(ids.filter((id) => id === 'runner-rose-hurdle-v1')).toHaveLength(1)
    renderer.dispose()
    renderer.dispose()
    for (const asset of [bulwark, hurdle]) {
      expect(asset.geometryDispose).toHaveBeenCalledOnce()
      expect(asset.materialDispose).toHaveBeenCalledOnce()
    }
  })

  it('retires prior obstacle donors when a required hurdle fails to load', async () => {
    const bulwark = ownedScene()
    state.model.mockImplementation(async (id: string) => {
      if (id === 'runner-crystal-bulwark-v1') return bulwark.root
      if (id === 'runner-rose-hurdle-v1') throw new Error('Missing hurdle')
      return new Group()
    })
    const { renderer } = fixture(true, true, true)
    await expect(renderer.ready).rejects.toThrow('Missing hurdle')
    expect(bulwark.geometryDispose).toHaveBeenCalledOnce()
    expect(bulwark.materialDispose).toHaveBeenCalledOnce()
    expect(state.worldUpdate).not.toHaveBeenCalled()
    expect(state.render).not.toHaveBeenCalled()
    expect(state.dispose).toHaveBeenCalledOnce()
  })

  it('rejects a missing garden and retires the already loaded museum instead of exposing partial scenery', async () => {
    const museum = ownedScene()
    state.model.mockImplementation(async (id: string) => {
      if (id === 'museum-kit-v2') return museum.root
      if (id === 'museum-garden-v2') throw new Error('Missing garden')
      return new Group()
    })
    const { renderer } = fixture()
    await expect(renderer.ready).rejects.toThrow('Missing garden')
    expect(state.sceneryCreate).not.toHaveBeenCalled()
    expect(state.render).not.toHaveBeenCalled()
    expect(museum.geometryDispose).toHaveBeenCalledOnce()
    expect(museum.materialDispose).toHaveBeenCalledOnce()
    expect(state.dispose).toHaveBeenCalledOnce()
  })
})

describe('runner mobile frame-pressure relief', () => {
  it('reduces pixels and shadow cadence after sustained running pressure only', async () => {
    vi.stubGlobal('window', {
      devicePixelRatio: 3,
      matchMedia: () => ({ matches: true }),
    })
    const { renderer, snapshot } = fixture()
    await renderer.ready
    const running = { ...snapshot, status: 'running' as const }
    for (let i = 0; i < 30; i++) renderer.render(snapshot, 0.05)
    expect(state.pixelRatio).toBe(1.25)
    for (let i = 0; i < 23; i++) renderer.render(running, 0.05)
    expect(state.pixelRatio).toBe(1.25)
    renderer.render(running, 0.05)
    expect(state.pixelRatio).toBe(1)
    expect(renderer.metrics()).toMatchObject({
      adaptiveQualityActive: true,
      actualPixelRatio: 1,
      actualShadowFrameInterval: 4,
    })
    const writes = state.setPixelRatio.mock.calls.length
    for (let i = 0; i < 30; i++) renderer.render(running, 1 / 60)
    expect(state.setPixelRatio.mock.calls).toHaveLength(writes)
    renderer.dispose()
  })
  it('does not lower desktop quality or respond to an isolated mobile hitch', async () => {
    const desktop = fixture()
    await desktop.renderer.ready
    for (let i = 0; i < 30; i++)
      desktop.renderer.render({ ...desktop.snapshot, status: 'running' }, 0.05)
    expect(desktop.renderer.metrics()).toMatchObject({
      adaptiveQualityActive: false,
      actualShadowFrameInterval: 1,
    })
    desktop.renderer.dispose()
    vi.stubGlobal('window', {
      devicePixelRatio: 3,
      matchMedia: () => ({ matches: true }),
    })
    const mobile = fixture()
    await mobile.renderer.ready
    mobile.renderer.render({ ...mobile.snapshot, status: 'running' }, 0.2)
    for (let i = 0; i < 30; i++)
      mobile.renderer.render({ ...mobile.snapshot, status: 'running' }, 1 / 60)
    expect(state.pixelRatio).toBe(1.25)
    expect(mobile.renderer.metrics()).toMatchObject({
      adaptiveQualityActive: false,
      actualShadowFrameInterval: 2,
    })
    mobile.renderer.dispose()
  })
})
