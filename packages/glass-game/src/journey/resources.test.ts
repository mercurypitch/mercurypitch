// Journey resource tests — retired parses dispose and hidden time cannot leak.

import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { acceptJourneyResource, createJourneyFrameLoop, loadJourneyGltf, } from './resources'

describe('journey glTF loading', () => {
  it('accepts a non-empty status-0 body from the native bundled asset handler', async () => {
    const scene = new Group()
    const bytes = new Uint8Array([0x67, 0x6c, 0x54, 0x46]).buffer
    const parse = vi.fn().mockResolvedValue({ scene, animations: [] })

    const document = await loadJourneyGltf(
      '/games/journey-map-v1/map.glb',
      new AbortController().signal,
      {
        fetch: vi.fn().mockResolvedValue({
          ok: false,
          status: 0,
          arrayBuffer: () => Promise.resolve(bytes),
        }) as unknown as typeof fetch,
        parse,
      },
    )

    expect(parse).toHaveBeenCalledExactlyOnceWith(
      bytes,
      '/games/journey-map-v1/',
    )
    document.dispose()
  })

  it('rejects an empty status-0 body before parsing', async () => {
    const parse = vi.fn()

    await expect(
      loadJourneyGltf(
        '/games/journey-map-v1/map.glb',
        new AbortController().signal,
        {
          fetch: vi.fn().mockResolvedValue({
            ok: false,
            status: 0,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
          }) as unknown as typeof fetch,
          parse,
        },
      ),
    ).rejects.toThrow(
      'Journey asset unavailable: /games/journey-map-v1/map.glb',
    )
    expect(parse).not.toHaveBeenCalled()
  })

  it('reports an unresolved Git LFS asset before asking Three to parse it', async () => {
    const parse = vi.fn()
    const pointer = new TextEncoder().encode(
      'version https://git-lfs.github.com/spec/v1\n' +
        'oid sha256:17294f9ccec6aa5fb18c9a3a3c31ce501750fd4375d0a2abbfdcdb33c7a00709\n' +
        'size 6831200\n',
    )

    await expect(
      loadJourneyGltf(
        '/games/journey-map-v1/map.glb',
        new AbortController().signal,
        {
          fetch: vi.fn().mockResolvedValue({
            ok: true,
            arrayBuffer: () => Promise.resolve(pointer.buffer),
          }) as unknown as typeof fetch,
          parse,
        },
      ),
    ).rejects.toThrow(
      'Journey asset is an unresolved Git LFS pointer: /games/journey-map-v1/map.glb. Hydrate the runtime game assets with Git LFS, then reload the museum.',
    )
    expect(parse).not.toHaveBeenCalled()
  })

  it('keeps the asset URL and parser cause when glTF parsing fails', async () => {
    const parseFailure = new SyntaxError('Unexpected token v')
    let received: unknown
    try {
      await loadJourneyGltf(
        '/games/journey-map-v1/map.glb',
        new AbortController().signal,
        {
          fetch: vi.fn().mockResolvedValue({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
          }) as unknown as typeof fetch,
          parse: vi.fn().mockRejectedValue(parseFailure),
        },
      )
    } catch (error) {
      received = error
    }

    expect(received).toBeInstanceOf(Error)
    expect((received as Error).message).toBe(
      'Journey asset could not be parsed: /games/journey-map-v1/map.glb. Unexpected token v',
    )
    expect((received as Error).cause).toBe(parseFailure)
  })

  it('keeps cancellation semantics when parsing rejects after an abort', async () => {
    let rejectParse: ((reason?: unknown) => void) | undefined
    const controller = new AbortController()
    const pending = loadJourneyGltf('/map.glb', controller.signal, {
      fetch: vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      }) as unknown as typeof fetch,
      parse: () =>
        new Promise((_, reject) => {
          rejectParse = reject
        }),
    })

    await vi.waitFor(() => expect(rejectParse).toBeTypeOf('function'))
    controller.abort()
    rejectParse?.(new Error('Parser stopped'))

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

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
