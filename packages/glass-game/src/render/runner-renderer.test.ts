// Runner renderer lifecycle tests — pending assets and context loss cannot retain a retired visit.
import type * as Three from 'three'
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Texture } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runnerCourseFixture } from '../browser/__fixtures__/runner-course'
import { deferred, flush } from '../browser/__fixtures__/runner-session'
import { createSongRunnerGame } from '../runner/game'

const state = vi.hoisted(() => ({
  render: vi.fn(),
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
  worldDispose: vi.fn(),
  targetDispose: vi.fn(),
  mercDispose: vi.fn(),
  worldUpdate: vi.fn(),
  targetUpdate: vi.fn(),
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
    setPixelRatio = vi.fn()
    getPixelRatio = () => 1
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
  createRunnerTargets: () => ({
    root: new Group(),
    update: state.targetUpdate,
    dispose: state.targetDispose,
    metrics: () => ({ targets: 1 }),
  }),
}))

import { createSongRunnerRenderer } from './runner-renderer'

function ownedScene() {
  const geometry = new BoxGeometry(),
    material = new MeshBasicMaterial()
  const geometryDispose = vi.spyOn(geometry, 'dispose'),
    materialDispose = vi.spyOn(material, 'dispose')
  const root = new Group()
  root.add(new Mesh(geometry, material))
  return { root, geometryDispose, materialDispose }
}

function fixture() {
  const course = runnerCourseFixture(),
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
  state.merc.mockResolvedValue({
    root: new Group(),
    update: vi.fn(),
    dispose: state.mercDispose,
  })
  state.texture.mockImplementation(async () => new Texture())
  state.model.mockImplementation(async () => new Group())
  state.precompile.mockResolvedValue(undefined)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('runner renderer ownership', () => {
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
    expect(state.targetUpdate).toHaveBeenNthCalledWith(1, expect.any(Object), 0)
    expect(state.targetUpdate).toHaveBeenNthCalledWith(2, expect.any(Object), 0)
    expect(state.verifyFirstFrame).toHaveBeenCalledOnce()
    expect(state.precompile.mock.invocationCallOrder[0]).toBeLessThan(
      state.render.mock.invocationCallOrder[0]!,
    )
    expect(state.render.mock.invocationCallOrder[1]).toBeLessThan(
      state.verifyFirstFrame.mock.invocationCallOrder[0]!,
    )
  })

  it('forwards presentation elapsed time to target feedback', async () => {
    const { renderer, snapshot } = fixture()
    await renderer.ready
    state.targetUpdate.mockClear()

    expect(renderer.render(snapshot, 0.075)).toBe(true)

    expect(state.targetUpdate).toHaveBeenCalledExactlyOnceWith(snapshot, 0.075)
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
  })
})
