// GPU initialization may finish after a player has left any of the five worlds.

import { BoxGeometry, Group, Mesh } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHAMBERS } from '../levels/chambers'
import { LINES } from '../levels/lines'
import { SHELF_1 } from '../levels/shelf'
import { WORLD3D_CONFIG } from '../world3d-config'

const gpu = vi.hoisted(() => {
  class DeferredRenderer {
    static instances: DeferredRenderer[] = []
    finish!: () => void
    activeResources = false
    freed = 0
    private ready = new Promise<void>((resolve) => {
      this.finish = resolve
    })

    constructor() {
      DeferredRenderer.instances.push(this)
    }

    async init(): Promise<void> {
      await this.ready
      this.activeResources = true
    }

    dispose(): void {
      // Three r185 only frees its backend and internal animation loop
      // once init has completed. An earlier dispose cannot free them.
      if (!this.activeResources) return
      this.activeResources = false
      this.freed += 1
    }

    compileAsync(): Promise<void> {
      return Promise.resolve()
    }
  }
  return { DeferredRenderer }
})

vi.mock('three/webgpu', () => ({ WebGPURenderer: gpu.DeferredRenderer }))

const assets = vi.hoisted(() => ({
  loadGlass: vi.fn(),
  loadMerc: vi.fn(),
  loadShards: vi.fn(),
  loadPaneShards: vi.fn(),
}))
vi.mock('../assets', () => assets)

// Real scene factories, geometry, materials, rooms, timing and Merc lifecycle;
// only the GPU and asset-loading boundaries are replaced.
const { createRenderer3D } = await import('./Renderer3D')
const { createHallway3D } = await import('./Hallway3D')
const { createChamber3D } = await import('./Chamber3D')
const { createLine3D } = await import('./Line3D')
const { createShelf3D } = await import('./Shelf3D')

const factories = [
  [
    'Cabinet',
    (canvas: HTMLCanvasElement) => createRenderer3D(canvas, WORLD3D_CONFIG),
  ],
  [
    'Hallway',
    (canvas: HTMLCanvasElement) => createHallway3D(canvas, WORLD3D_CONFIG),
  ],
  [
    'Chamber',
    (canvas: HTMLCanvasElement) =>
      createChamber3D(canvas, WORLD3D_CONFIG, CHAMBERS[0]!),
  ],
  [
    'Line',
    (canvas: HTMLCanvasElement) =>
      createLine3D(canvas, WORLD3D_CONFIG, LINES[0]!),
  ],
  [
    'Shelf',
    (canvas: HTMLCanvasElement) =>
      createShelf3D(canvas, WORLD3D_CONFIG, SHELF_1),
  ],
] as const

beforeEach(() => {
  gpu.DeferredRenderer.instances = []
  vi.clearAllMocks()
  // Shelf labels permit a missing 2D canvas; no pixels are needed for teardown.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  assets.loadGlass.mockImplementation(async () => new Group())
  assets.loadMerc.mockImplementation(async () => {
    const scene = new Group()
    const body = new Mesh(new BoxGeometry(1, 2, 1))
    body.name = 'merc_body'
    scene.add(body)
    return { scene, clips: [] }
  })
  const shards = async () => ({
    meshes: [new Mesh(new BoxGeometry(0.1, 0.1, 0.1))],
    centroids: [{ x: 0, y: 0, z: 0 }],
  })
  assets.loadShards.mockImplementation(shards)
  assets.loadPaneShards.mockImplementation(shards)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe.each(factories)('%s renderer lifecycle', (_name, create) => {
  it('releases the backend when initialization finishes after leaving', async () => {
    const stage = create(document.createElement('canvas'))
    const renderer = gpu.DeferredRenderer.instances[0]!
    const initialized = stage.init()
    stage.dispose()
    renderer.finish()
    await initialized

    expect(renderer.activeResources).toBe(false)
    expect(renderer.freed).toBe(1)
    for (const load of Object.values(assets))
      expect(load).not.toHaveBeenCalled()
  })

  it('keeps a live stage initialized until its later disposal', async () => {
    const stage = create(document.createElement('canvas'))
    const renderer = gpu.DeferredRenderer.instances[0]!
    const initialized = stage.init()
    renderer.finish()
    await initialized

    expect(renderer.activeResources).toBe(true)
    expect(renderer.freed).toBe(0)
    stage.dispose()
    expect(renderer.activeResources).toBe(false)
    expect(renderer.freed).toBe(1)
  })
})
