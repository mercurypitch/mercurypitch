// Local reflection ownership — a failed capture restores actors and a late load cannot resurrect a scene.
import type * as ThreeTypes from 'three'
import type { WebGLRenderer } from 'three'
import { Group, Scene, Texture, Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  targets: [] as { texture: unknown; dispose: ReturnType<typeof vi.fn> }[],
  fail: false,
  failInitial: false,
  generatorDispose: vi.fn(),
  resolve: undefined as ((texture: unknown) => void) | undefined,
}))
vi.mock('three', async (original) => {
  const actual = await original<typeof ThreeTypes>()
  const target = () => {
    const result = { texture: new actual.Texture(), dispose: vi.fn() }
    state.targets.push(result)
    return result
  }
  return {
    ...actual,
    PMREMGenerator: class {
      fromEquirectangular() {
        if (state.failInitial) throw new Error('initial reflection failed')
        return target()
      }
      fromCubemap = target
      dispose = state.generatorDispose
    },
    WebGLCubeRenderTarget: class {
      texture = new actual.Texture()
      dispose = vi.fn()
    },
    CubeCamera: class {
      position = new actual.Vector3()
      update() {
        if (state.fail) throw new Error('lost capture')
      }
    },
  }
})
vi.mock('three/addons/loaders/HDRLoader.js', () => ({
  HDRLoader: class {
    loadAsync() {
      return new Promise((resolve) => {
        state.resolve = resolve
      })
    }
  },
}))
import { createMuseumEnvironment } from './environment'

describe('one-time gallery reflection', () => {
  it('releases the generator when initial reflection preparation throws', () => {
    state.failInitial = true
    state.generatorDispose.mockClear()
    expect(() =>
      createMuseumEnvironment({} as WebGLRenderer, new Scene()),
    ).toThrow('initial reflection failed')
    expect(state.generatorDispose).toHaveBeenCalledTimes(1)
    state.failInitial = false
  })

  it('restores original actor visibility and retains the old environment after capture failure', () => {
    state.targets.length = 0
    state.fail = true
    const scene = new Scene()
    const environment = createMuseumEnvironment({} as WebGLRenderer, scene)
    const original = scene.environment
    const visible = new Group(),
      hidden = new Group()
    hidden.visible = false
    expect(() =>
      environment.capture(new Vector3(), [visible, hidden], 128),
    ).toThrow('lost capture')
    expect(visible.visible).toBe(true)
    expect(hidden.visible).toBe(false)
    expect(scene.environment).toBe(original)
    state.fail = false
    environment.capture(new Vector3(), [visible, hidden], 128)
    expect(scene.environment).not.toBe(original)
    expect(state.targets[0].dispose).toHaveBeenCalledTimes(1)
    environment.dispose()
    environment.dispose()
    expect(state.targets[1].dispose).toHaveBeenCalledTimes(1)
    expect(scene.environment).toBeNull()
  })
  it('disposes a late HDR download without replacing a disposed scene environment', async () => {
    state.targets.length = 0
    const scene = new Scene()
    const environment = createMuseumEnvironment({} as WebGLRenderer, scene)
    const pending = environment.load('local.hdr', () => false)
    environment.dispose()
    const texture = new Texture(),
      dispose = vi.fn()
    texture.addEventListener('dispose', dispose)
    state.resolve!(texture)
    await pending
    expect(dispose).toHaveBeenCalledTimes(1)
    expect(scene.environment).toBeNull()
    expect(state.targets).toHaveLength(1)
  })
})
