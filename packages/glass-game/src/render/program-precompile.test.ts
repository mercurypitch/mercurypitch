// Program precompile lifecycle tests — readiness polling must finish, fail or cancel without retaining renderer state.

import type { Material, WebGLRenderer } from 'three'
import { Group, MeshBasicMaterial, PerspectiveCamera } from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { precompileRendererPrograms } from './program-precompile'

function fixture(programs: readonly { isReady(): boolean }[]) {
  const materials = programs.map(() => new MeshBasicMaterial())
  const byMaterial = new Map<
    Material,
    { currentProgram: { isReady(): boolean } | undefined }
  >(
    materials.map((material, index) => [
      material,
      { currentProgram: programs[index] },
    ]),
  )
  return {
    materials,
    renderer: {
      compile: vi.fn(() => new Set<Material>(materials)),
      properties: {
        get: vi.fn((material: Material) => byMaterial.get(material)),
      },
    } as unknown as Pick<WebGLRenderer, 'compile' | 'properties'>,
  }
}

afterEach(() => vi.useRealTimers())

describe('renderer program precompile', () => {
  it('snapshots unique programs and resolves after every program is ready', async () => {
    vi.useFakeTimers()
    const shared = { isReady: vi.fn(() => true) }
    let secondReady = false
    const second = { isReady: vi.fn(() => secondReady) }
    const { renderer } = fixture([shared, shared, second])
    const controller = new AbortController()
    const pending = precompileRendererPrograms(
      renderer,
      new Group(),
      new PerspectiveCamera(),
      controller.signal,
    )

    expect(renderer.compile).toHaveBeenCalledOnce()
    expect(renderer.properties.get).toHaveBeenCalledTimes(3)
    expect(shared.isReady).toHaveBeenCalledOnce()
    expect(second.isReady).toHaveBeenCalledOnce()
    secondReady = true
    await vi.advanceTimersByTimeAsync(10)

    await expect(pending).resolves.toBeUndefined()
    expect(second.isReady).toHaveBeenCalledTimes(2)
  })

  it('rejects a readiness error and cancels its remaining timers', async () => {
    vi.useFakeTimers()
    const program = {
      isReady: vi.fn(() => {
        throw new Error('driver readiness failed')
      }),
    }
    const { renderer } = fixture([program])

    await expect(
      precompileRendererPrograms(
        renderer,
        new Group(),
        new PerspectiveCamera(),
        new AbortController().signal,
      ),
    ).rejects.toThrow('driver readiness failed')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(program.isReady).toHaveBeenCalledOnce()
  })

  it('settles cancellation and performs no later readiness reads', async () => {
    vi.useFakeTimers()
    const program = { isReady: vi.fn(() => false) }
    const { renderer } = fixture([program])
    const controller = new AbortController()
    const pending = precompileRendererPrograms(
      renderer,
      new Group(),
      new PerspectiveCamera(),
      controller.signal,
    )
    expect(program.isReady).toHaveBeenCalledOnce()

    controller.abort()
    await expect(pending).resolves.toBeUndefined()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(program.isReady).toHaveBeenCalledOnce()
  })

  it('stops before another program when a readiness read aborts reentrantly', async () => {
    const controller = new AbortController()
    const first = {
      isReady: vi.fn(() => {
        controller.abort()
        return false
      }),
    }
    const second = { isReady: vi.fn(() => true) }
    const { renderer } = fixture([first, second])

    await expect(
      precompileRendererPrograms(
        renderer,
        new Group(),
        new PerspectiveCamera(),
        controller.signal,
      ),
    ).resolves.toBeUndefined()
    expect(first.isReady).toHaveBeenCalledOnce()
    expect(second.isReady).not.toHaveBeenCalled()
  })

  it('rejects with a bounded diagnostic when a driver never becomes ready', async () => {
    vi.useFakeTimers()
    const program = { isReady: vi.fn(() => false) }
    const { renderer } = fixture([program])
    const pending = precompileRendererPrograms(
      renderer,
      new Group(),
      new PerspectiveCamera(),
      new AbortController().signal,
      { pollIntervalMs: 5, timeoutMs: 20 },
    )
    const rejection = expect(pending).rejects.toThrow(
      'Shader precompile timed out after 20 ms.',
    )

    await vi.advanceTimersByTimeAsync(20)
    await rejection
  })
})
