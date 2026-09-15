// Renderer readiness — an optional reflection failure never hides a playable museum.
import type * as ThreeTypes from 'three'
import { Group } from 'three'
import { afterEach, expect, it, vi } from 'vitest'
import { GLASSWORKS } from '../content/glassworks'
import { createGlassGame } from '../core/game'

const state = vi.hoisted(() => ({
  render: vi.fn(),
  listeners: new Map<string, EventListener>(),
  loseContext: false,
}))
vi.mock('three', async (original) => ({
  ...(await original<typeof ThreeTypes>()),
  WebGLRenderer: class {
    domElement = {
      style: {},
      setAttribute: vi.fn(),
      remove: vi.fn(),
      addEventListener: (name: string, listener: EventListener) =>
        state.listeners.set(name, listener),
      removeEventListener: (name: string) => state.listeners.delete(name),
    }
    shadowMap = {}
    info = { render: {}, memory: {} }
    setSize = vi.fn()
    setPixelRatio = vi.fn()
    render = state.render
    dispose = vi.fn()
    forceContextLoss = vi.fn()
  },
}))
vi.mock('./environment', () => ({
  createMuseumEnvironment: () => ({
    load: async () => {},
    capture: () => {
      if (state.loseContext)
        state.listeners.get('webglcontextlost')?.(new Event('webglcontextlost'))
      throw new Error('optional cube allocation failed')
    },
    dispose: vi.fn(),
  }),
}))
vi.mock('./asset-kit', () => ({ loadMuseumAssets: async () => {} }))
vi.mock('./materials', () => ({ createMuseumMaterials: () => ({}) }))
vi.mock('./merc', () => ({
  loadAdventureMerc: async () => ({
    root: new Group(),
    update: vi.fn(),
    dispose: vi.fn(),
  }),
}))
vi.mock('./atmosphere', () => ({
  createAtmosphere: () => ({ root: new Group(), setSky: vi.fn() }),
}))
vi.mock('./contact-shadow', () => ({
  createContactShadow: () => ({ mesh: new Group(), update: vi.fn() }),
}))
vi.mock('./museum', () => ({
  createMuseum: () => ({
    root: new Group(),
    update: vi.fn(),
    cameraOccluders: () => [],
    materialLibrary: { materials: new Set(), dispose: vi.fn() },
  }),
}))
import { createGlassRenderer } from './glass-renderer'

afterEach(() => {
  vi.unstubAllGlobals()
  state.listeners.clear()
  state.loseContext = false
  state.render.mockClear()
})

it.each([false, true])(
  'resolves after optional capture failure while context-loss latch=%s remains authoritative',
  async (contextLoss) => {
    vi.stubGlobal('window', { devicePixelRatio: 1 })
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    )
    state.loseContext = contextLoss
    const onAssetError = vi.fn(),
      onContextLost = vi.fn()
    const container = {
      clientWidth: 800,
      clientHeight: 600,
      append: vi.fn(),
    } as unknown as HTMLElement
    const renderer = createGlassRenderer(container, GLASSWORKS, (id) => id, {
      onAssetError,
      onContextLost,
    })
    await expect(renderer.ready).resolves.toBeUndefined()
    renderer.render(createGlassGame(GLASSWORKS).snapshot(), 0.016)
    expect(onContextLost).toHaveBeenCalledTimes(contextLoss ? 1 : 0)
    expect(state.render).toHaveBeenCalledTimes(contextLoss ? 0 : 1)
    if (contextLoss) expect(onAssetError).not.toHaveBeenCalled()
    else
      expect(onAssetError).toHaveBeenCalledWith(
        'museum-reflection-probe',
        expect.any(Error),
      )
    renderer.dispose()
  },
)
