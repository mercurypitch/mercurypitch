// Journey resource tests — retired parses dispose and hidden time cannot leak.

import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { acceptJourneyResource, createJourneyFrameLoop, loadJourneyGltf, } from './resources'

describe('journey glTF loading', () => {
  it('disposes a parse that finishes after cancellation', async () => {
    let finishParse:
      | ((value: { scene: Group; animations: [] }) => void)
      | undefined
    const geometry = new BoxGeometry()
    const material = new MeshBasicMaterial()
    const disposeGeometry = vi.spyOn(geometry, 'dispose')
    const disposeMaterial = vi.spyOn(material, 'dispose')
    const scene = new Group()
    scene.add(new Mesh(geometry, material))
    const controller = new AbortController()
    const pending = loadJourneyGltf('/map.glb', controller.signal, {
      fetch: vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      }) as unknown as typeof fetch,
      parse: () =>
        new Promise((resolve) => {
          finishParse = resolve
        }),
    })
    await vi.waitFor(() => expect(finishParse).toBeTypeOf('function'))
    controller.abort()
    finishParse?.({ scene, animations: [] })
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(disposeGeometry).toHaveBeenCalledOnce()
    expect(disposeMaterial).toHaveBeenCalledOnce()
  })
})

describe('journey frame loop', () => {
  it('owns one frame and excludes hidden time after resume', () => {
    let nextId = 0
    const callbacks = new Map<number, FrameRequestCallback>()
    const cancel = vi.fn((id: number) => callbacks.delete(id))
    const scheduler = {
      request(callback: FrameRequestCallback) {
        const id = ++nextId
        callbacks.set(id, callback)
        return id
      },
      cancel,
    }
    const updates = vi.fn()
    const loop = createJourneyFrameLoop(updates, scheduler)
    const run = (time: number) => {
      const [id, callback] = [...callbacks][0]!
      callbacks.delete(id)
      callback(time)
    }

    loop.setForeground(true)
    loop.setForeground(true)
    expect(callbacks.size).toBe(1)
    run(100)
    run(120)
    expect(updates).toHaveBeenLastCalledWith(0.02, 0.02)
    loop.setForeground(false)
    expect(callbacks.size).toBe(0)
    loop.setForeground(true)
    run(10_000)
    expect(updates).toHaveBeenLastCalledWith(0.02, 0)
    expect(loop.visibleSeconds()).toBeCloseTo(0.02)
    loop.dispose()
    expect(callbacks.size).toBe(0)
    expect(cancel).toHaveBeenCalled()
  })
})

describe('journey late resource acceptance', () => {
  it('keeps a context-loss failure after deferred models finish', async () => {
    let resolve!: (value: { dispose(): void }) => void
    const dispose = vi.fn()
    const pending = new Promise<{ dispose(): void }>((done) => {
      resolve = done
    })
    let state: 'active' | 'failed' = 'active'
    const installed = vi.fn()
    const accepted = acceptJourneyResource(pending, () => state, installed)

    state = 'failed'
    resolve({ dispose })

    await expect(accepted).rejects.toThrow('lost its graphics context')
    expect(dispose).toHaveBeenCalledOnce()
    expect(installed).not.toHaveBeenCalled()
  })
})
